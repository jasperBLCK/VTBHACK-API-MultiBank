"""
Payments API - Инициирование переводов
OpenBanking Russia Payments API compatible
Спецификация: https://wiki.opendatarussia.ru/specifications (Payments API)
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
from datetime import datetime
from decimal import Decimal
import uuid

from database import get_db
from models import Payment, Account, PaymentConsent
from services.auth_service import get_current_client
from services.payment_service import PaymentService


router = APIRouter(prefix="/payments", tags=["4 Переводы"])


# === Pydantic Models (OpenBanking Russia format) ===

class AmountModel(BaseModel):
    """Сумма платежа"""
    amount: str = Field(..., description="Сумма в формате строки")
    currency: str = "RUB"


class AccountIdentification(BaseModel):
    """Идентификация счета"""
    schemeName: str = "RU.CBR.PAN"
    identification: str = Field(..., description="Номер счета")
    name: Optional[str] = None


class PaymentInitiation(BaseModel):
    """Данные для инициации платежа"""
    instructionIdentification: str = Field(default_factory=lambda: f"instr-{uuid.uuid4().hex[:8]}")
    endToEndIdentification: str = Field(default_factory=lambda: f"e2e-{uuid.uuid4().hex[:8]}")
    instructedAmount: AmountModel
    debtorAccount: AccountIdentification
    creditorAccount: AccountIdentification
    remittanceInformation: Optional[dict] = None


class PaymentRequest(BaseModel):
    """Запрос создания платежа (OpenBanking Russia format)"""
    data: dict = Field(..., description="Содержит initiation")
    risk: Optional[dict] = {}


class PaymentData(BaseModel):
    """Данные платежа в ответе"""
    paymentId: str
    status: str
    creationDateTime: str
    statusUpdateDateTime: str


class PaymentResponse(BaseModel):
    """Ответ с платежом"""
    data: PaymentData
    links: dict
    meta: Optional[dict] = {}


# === Endpoints ===

@router.post("", response_model=PaymentResponse, status_code=201, summary="Создать платеж")
async def create_payment(
    request: PaymentRequest,
    x_fapi_interaction_id: Optional[str] = Header(None, alias="x-fapi-interaction-id"),
    x_fapi_customer_ip_address: Optional[str] = Header(None, alias="x-fapi-customer-ip-address"),
    x_payment_consent_id: Optional[str] = Header(None, alias="x-payment-consent-id"),
    x_requesting_bank: Optional[str] = Header(None, alias="x-requesting-bank"),
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    ## 💸 Создание платежа (разовый перевод)
    
    **OpenBanking Russia Payments API**
    
    ### Два типа платежей:
    
    #### 1️⃣ Внутрибанковский перевод (тот же банк)
    ```json
    {
      "data": {
        "initiation": {
          "instructedAmount": {
            "amount": "1000.00",
            "currency": "RUB"
          },
          "debtorAccount": {
            "schemeName": "RU.CBR.PAN",
            "identification": "40817810099910004312"
          },
          "creditorAccount": {
            "schemeName": "RU.CBR.PAN",
            "identification": "40817810099910005423"
          }
        }
      }
    }
    ```
    
    #### 2️⃣ Межбанковский перевод
    Добавьте в `creditorAccount`:
    ```json
    {
      "creditorAccount": {
        "identification": "40817810099910001234",
        "bank_code": "abank"  // Код банка получателя
      }
    }
    ```
    
    ### Статусы платежа:
    - `pending` — ожидает обработки
    - `completed` — успешно выполнен
    - `failed` — ошибка (недостаточно средств, счет не найден)
    
    ### Проверка статуса:
    ```bash
    GET /payments/{payment_id}
    ```
    
    ### ⚠️ Важно:
    - Проверяйте баланс счета перед платежом: `GET /accounts/{account_id}/balances`
    - Счет списания (`debtorAccount`) должен принадлежать авторизованному клиенту
    - Для межбанковых переводов используйте правильный `bank_code`
    - Коды банков: `vbank`, `abank`, `sbank`
    
    ### Sandbox особенности:
    - Межбанковые переводы выполняются мгновенно
    - Комиссия не взимается
    - Все валюты конвертируются по курсу 1:1 для упрощения
    """
    if not current_client:
        raise HTTPException(401, "Unauthorized")
    
    # Проверка согласия для межбанковых запросов
    payment_consent_id_to_store = None
    if x_requesting_bank:
        # Межбанковый запрос - требуется согласие на платеж
        if not x_payment_consent_id:
            raise HTTPException(
                403,
                detail={
                    "error": "PAYMENT_CONSENT_REQUIRED",
                    "message": "Требуется согласие клиента на платеж",
                    "consent_request_url": "/payment-consents/request"
                }
            )
        
        # Проверить согласие
        consent_result = await db.execute(
            select(PaymentConsent).where(
                and_(
                    PaymentConsent.consent_id == x_payment_consent_id,
                    PaymentConsent.status == "active",
                    PaymentConsent.expiration_date_time > datetime.utcnow()
                )
            )
        )
        payment_consent = consent_result.scalar_one_or_none()
        
        if not payment_consent:
            raise HTTPException(
                403,
                detail={
                    "error": "INVALID_CONSENT",
                    "message": "Согласие недействительно, истекло или уже использовано"
                }
            )
        
        # Проверить что согласие выдано запрашивающему банку
        if payment_consent.granted_to != x_requesting_bank:
            raise HTTPException(
                403,
                detail={
                    "error": "CONSENT_MISMATCH",
                    "message": "Согласие выдано другому банку"
                }
            )
        
        payment_consent_id_to_store = x_payment_consent_id
    
    # Извлечь данные из request
    initiation = request.data.get("initiation")
    if not initiation:
        raise HTTPException(400, "Missing initiation data")
    
    amount_data = initiation.get("instructedAmount", {})
    debtor_account = initiation.get("debtorAccount", {})
    creditor_account = initiation.get("creditorAccount", {})
    
    # Описание платежа
    remittance = initiation.get("remittanceInformation", {})
    description = remittance.get("unstructured", "") if remittance else ""
    
    try:
        # Инициировать платеж
        payment, interbank = await PaymentService.initiate_payment(
            db=db,
            from_account_number=debtor_account.get("identification"),
            to_account_number=creditor_account.get("identification"),
            amount=Decimal(amount_data.get("amount", "0")),
            description=description,
            payment_consent_id=payment_consent_id_to_store
        )
        
        # Если использовалось согласие - пометить его как использованное
        if payment_consent_id_to_store:
            consent_result = await db.execute(
                select(PaymentConsent).where(PaymentConsent.consent_id == payment_consent_id_to_store)
            )
            consent = consent_result.scalar_one_or_none()
            if consent:
                consent.status = "used"
                consent.used_at = datetime.utcnow()
                consent.status_update_date_time = datetime.utcnow()
                await db.commit()
        
        # Формируем ответ OpenBanking Russia
        now = datetime.utcnow()
        
        payment_data = PaymentData(
            paymentId=payment.payment_id,
            status=payment.status,
            creationDateTime=payment.creation_date_time.isoformat() + "Z",
            statusUpdateDateTime=payment.status_update_date_time.isoformat() + "Z"
        )
        
        return PaymentResponse(
            data=payment_data,
            links={
                "self": f"/payments/{payment.payment_id}"
            },
            meta={}
        )
        
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/{payment_id}", response_model=PaymentResponse, summary="Получить платеж")
async def get_payment(
    payment_id: str,
    x_fapi_interaction_id: Optional[str] = Header(None, alias="x-fapi-interaction-id"),
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Получение статуса платежа
    
    OpenBanking Russia Payments API
    GET /payments/{paymentId}
    """
    if not current_client:
        raise HTTPException(401, "Unauthorized")
    
    payment = await PaymentService.get_payment(db, payment_id)
    
    if not payment:
        raise HTTPException(404, "Payment not found")
    
    # TODO: Проверить что клиент имеет право просматривать этот платеж
    
    payment_data = PaymentData(
        paymentId=payment.payment_id,
        status=payment.status,
        creationDateTime=payment.creation_date_time.isoformat() + "Z",
        statusUpdateDateTime=payment.status_update_date_time.isoformat() + "Z"
    )
    
    return PaymentResponse(
        data=payment_data,
        links={
            "self": f"/payments/{payment_id}"
        }
    )

