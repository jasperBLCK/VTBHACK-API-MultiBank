"""
Payment-Consents API - Согласия на платежи
OpenBanking Russia Payments API compatible

Аналогично Account-Consents, но для платежей
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional, List
from datetime import datetime, timedelta
from decimal import Decimal
import uuid

from database import get_db
from models import PaymentConsentRequest, PaymentConsent, Client, Notification, BankSettings
from services.auth_service import get_current_client, get_current_banker
from config import config


router = APIRouter(prefix="/payment-consents", tags=["3 Согласия на переводы"])


# === Pydantic Models ===

class PaymentInitiationData(BaseModel):
    """Данные платежа для согласия"""
    instructedAmount: dict = Field(..., description="Сумма платежа")
    debtorAccount: dict = Field(..., description="Счет списания")
    creditorAccount: dict = Field(..., description="Счет получателя")
    creditorName: Optional[str] = Field(None, description="Имя получателя")
    remittanceInformation: Optional[dict] = Field(None, description="Назначение платежа")


class PaymentConsentRequestModel(BaseModel):
    """Запрос на создание согласия на платеж"""
    data: dict = Field(..., description="Содержит initiation с данными платежа")
    risk: Optional[dict] = {}


class PaymentConsentResponseData(BaseModel):
    """Данные ответа на запрос согласия"""
    consentId: Optional[str] = None
    status: str
    creationDateTime: str
    statusUpdateDateTime: str
    initiation: Optional[dict] = None


class PaymentConsentResponse(BaseModel):
    """Ответ с согласием на платеж"""
    data: PaymentConsentResponseData
    links: dict
    meta: Optional[dict] = {}


# === Endpoints ===

@router.post("/request", response_model=dict, status_code=200, summary="Создать запрос согласия на перевод")
async def create_payment_consent_request(
    request: PaymentConsentRequestModel,
    x_requesting_bank: Optional[str] = Header(None, alias="x-requesting-bank"),
    client_id: Optional[str] = None,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    ## 💳 Создание запроса на согласие для платежа
    
    **OpenBanking Russia Payment Consents API**
    
    ### Процесс (аналогично Account Consents):
    
    1. **TPP приложение** запрашивает согласие на платеж
    2. **Банк** проверяет настройки (авто-одобрение или ручное)
    3. **Клиент/Банкир** одобряет (если требуется)
    4. **TPP** использует consent_id для создания платежа
    
    ### Пример запроса:
    ```json
    {
      "data": {
        "initiation": {
          "instructedAmount": {
            "amount": "500.00",
            "currency": "RUB"
          },
          "debtorAccount": {
            "schemeName": "RU.CBR.PAN",
            "identification": "40817..."
          },
          "creditorAccount": {
            "schemeName": "RU.CBR.PAN",
            "identification": "40817..."
          },
          "creditorName": "Иван Иванов",
          "remittanceInformation": {
            "unstructured": "Оплата услуг"
          }
        }
      }
    }
    ```
    
    ### Headers:
    - `x-requesting-bank`: код банка-инициатора (TPP)
    - `Authorization`: Bearer token
    
    ### Query параметры:
    - `client_id`: ID клиента в этом банке
    """
    
    if not x_requesting_bank:
        raise HTTPException(400, "Header x-requesting-bank required")
    
    if not client_id:
        raise HTTPException(400, "Query parameter client_id required")
    
    # Найти клиента
    result = await db.execute(
        select(Client).where(Client.person_id == client_id)
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(404, f"Client {client_id} not found")
    
    # Извлечь данные платежа
    initiation = request.data.get("initiation", {})
    amount_data = initiation.get("instructedAmount", {})
    debtor_account = initiation.get("debtorAccount", {})
    creditor_account = initiation.get("creditorAccount", {})
    remittance = initiation.get("remittanceInformation", {})
    
    amount = Decimal(amount_data.get("amount", "0"))
    currency = amount_data.get("currency", "RUB")
    debtor_account_number = debtor_account.get("identification")
    creditor_account_number = creditor_account.get("identification")
    creditor_name = initiation.get("creditorName", "")
    reference = remittance.get("unstructured", "") if remittance else ""
    
    # Создать запрос на согласие
    request_id = f"pcr-{uuid.uuid4().hex[:12]}"
    
    consent_request = PaymentConsentRequest(
        request_id=request_id,
        client_id=client.id,
        requesting_bank=x_requesting_bank,
        requesting_bank_name=x_requesting_bank.upper(),
        amount=amount,
        currency=currency,
        debtor_account=debtor_account_number,
        creditor_account=creditor_account_number,
        creditor_name=creditor_name,
        reference=reference,
        reason=f"Платёж на сумму {amount} {currency}",
        status="pending"
    )
    db.add(consent_request)
    
    # Проверить настройки банка (авто-одобрение?)
    settings_result = await db.execute(
        select(BankSettings).where(BankSettings.key == "auto_approve_payment_consents")
    )
    auto_approve_setting = settings_result.scalar_one_or_none()
    auto_approve = auto_approve_setting and auto_approve_setting.value.lower() == "true"
    
    # По умолчанию auto_approve = True (sandbox режим)
    if auto_approve_setting is None:
        auto_approve = True
    
    consent_id = None
    status = "pending"
    
    if auto_approve:
        # Автоматическое одобрение
        consent_id = f"pcon-{uuid.uuid4().hex[:12]}"
        
        payment_consent = PaymentConsent(
            consent_id=consent_id,
            request_id=consent_request.id,
            client_id=client.id,
            granted_to=x_requesting_bank,
            amount=amount,
            currency=currency,
            debtor_account=debtor_account_number,
            creditor_account=creditor_account_number,
            creditor_name=creditor_name,
            reference=reference,
            status="active",
            expiration_date_time=datetime.utcnow() + timedelta(days=90)
        )
        db.add(payment_consent)
        
        consent_request.status = "approved"
        consent_request.responded_at = datetime.utcnow()
        status = "approved"
    else:
        # Требуется ручное одобрение - создать уведомление
        notification = Notification(
            client_id=client.id,
            notification_type="payment_consent_request",
            title=f"Запрос на платёж от {x_requesting_bank}",
            message=f"Приложение {x_requesting_bank} запрашивает согласие на платёж: {amount} {currency} → {creditor_name}",
            related_id=request_id,
            status="unread"
        )
        db.add(notification)
    
    await db.commit()
    
    return {
        "request_id": request_id,
        "consent_id": consent_id,
        "status": status,
        "auto_approved": auto_approve,
        "message": "Согласие одобрено автоматически" if auto_approve else "Требуется одобрение клиента",
        "expires_in": "90 days" if auto_approve else None
    }


@router.get("/{consent_id}", response_model=PaymentConsentResponse, summary="Получить согласие по ID")
async def get_payment_consent(
    consent_id: str,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    ## 📋 Получение согласия на платеж
    
    OpenBanking Russia Payment Consents API
    """
    result = await db.execute(
        select(PaymentConsent).where(PaymentConsent.consent_id == consent_id)
    )
    consent = result.scalar_one_or_none()
    
    if not consent:
        raise HTTPException(404, "Payment consent not found")
    
    return PaymentConsentResponse(
        data=PaymentConsentResponseData(
            consentId=consent.consent_id,
            status=consent.status,
            creationDateTime=consent.creation_date_time.isoformat() + "Z",
            statusUpdateDateTime=consent.status_update_date_time.isoformat() + "Z",
            initiation={
                "instructedAmount": {
                    "amount": str(consent.amount),
                    "currency": consent.currency
                },
                "debtorAccount": {
                    "identification": consent.debtor_account
                },
                "creditorAccount": {
                    "identification": consent.creditor_account
                },
                "creditorName": consent.creditor_name,
                "remittanceInformation": {
                    "unstructured": consent.reference
                }
            }
        ),
        links={"self": f"/payment-consents/{consent_id}"},
        meta={}
    )


@router.delete("/{consent_id}", status_code=204, summary="Отозвать согласие")
async def revoke_payment_consent(
    consent_id: str,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    ## 🗑️ Отзыв согласия на платеж
    """
    result = await db.execute(
        select(PaymentConsent).where(PaymentConsent.consent_id == consent_id)
    )
    consent = result.scalar_one_or_none()
    
    if not consent:
        raise HTTPException(404, "Payment consent not found")
    
    consent.status = "revoked"
    consent.revoked_at = datetime.utcnow()
    consent.status_update_date_time = datetime.utcnow()
    
    await db.commit()
    
    return None


@router.get("/pending/list", response_model=List[dict], include_in_schema=False)
async def list_pending_payment_consents(
    current_banker: dict = Depends(get_current_banker),
    db: AsyncSession = Depends(get_db)
):
    """
    ## 📋 Список ожидающих согласий на платежи (для банкира)
    """
    if not current_banker:
        raise HTTPException(401, "Banker access required")
    
    result = await db.execute(
        select(PaymentConsentRequest)
        .where(PaymentConsentRequest.status == "pending")
        .order_by(PaymentConsentRequest.created_at.desc())
    )
    requests = result.scalars().all()
    
    response = []
    for req in requests:
        # Получить клиента
        client_result = await db.execute(
            select(Client).where(Client.id == req.client_id)
        )
        client = client_result.scalar_one_or_none()
        
        response.append({
            "request_id": req.request_id,
            "client_id": client.person_id if client else "unknown",
            "client_name": client.full_name if client else "Unknown",
            "requesting_bank": req.requesting_bank,
            "amount": float(req.amount),
            "currency": req.currency,
            "debtor_account": req.debtor_account,
            "creditor_account": req.creditor_account,
            "creditor_name": req.creditor_name,
            "reference": req.reference,
            "created_at": req.created_at.isoformat() if req.created_at else None
        })
    
    return response


@router.post("/{request_id}/approve", response_model=dict, include_in_schema=False)
async def approve_payment_consent(
    request_id: str,
    current_banker: dict = Depends(get_current_banker),
    db: AsyncSession = Depends(get_db)
):
    """
    ## ✅ Одобрение согласия на платеж (банкиром)
    """
    if not current_banker:
        raise HTTPException(401, "Banker access required")
    
    result = await db.execute(
        select(PaymentConsentRequest).where(PaymentConsentRequest.request_id == request_id)
    )
    consent_request = result.scalar_one_or_none()
    
    if not consent_request:
        raise HTTPException(404, "Payment consent request not found")
    
    if consent_request.status != "pending":
        raise HTTPException(400, f"Request already {consent_request.status}")
    
    # Создать активное согласие
    consent_id = f"pcon-{uuid.uuid4().hex[:12]}"
    
    payment_consent = PaymentConsent(
        consent_id=consent_id,
        request_id=consent_request.id,
        client_id=consent_request.client_id,
        granted_to=consent_request.requesting_bank,
        amount=consent_request.amount,
        currency=consent_request.currency,
        debtor_account=consent_request.debtor_account,
        creditor_account=consent_request.creditor_account,
        creditor_name=consent_request.creditor_name,
        reference=consent_request.reference,
        status="active",
        expiration_date_time=datetime.utcnow() + timedelta(days=90)
    )
    db.add(payment_consent)
    
    # Обновить запрос
    consent_request.status = "approved"
    consent_request.responded_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "request_id": request_id,
        "consent_id": consent_id,
        "status": "approved",
        "message": "Payment consent approved by banker"
    }


@router.post("/{request_id}/reject", response_model=dict, include_in_schema=False)
async def reject_payment_consent(
    request_id: str,
    reason: Optional[str] = None,
    current_banker: dict = Depends(get_current_banker),
    db: AsyncSession = Depends(get_db)
):
    """
    ## ❌ Отклонение согласия на платеж (банкиром)
    """
    if not current_banker:
        raise HTTPException(401, "Banker access required")
    
    result = await db.execute(
        select(PaymentConsentRequest).where(PaymentConsentRequest.request_id == request_id)
    )
    consent_request = result.scalar_one_or_none()
    
    if not consent_request:
        raise HTTPException(404, "Payment consent request not found")
    
    if consent_request.status != "pending":
        raise HTTPException(400, f"Request already {consent_request.status}")
    
    # Отклонить
    consent_request.status = "rejected"
    consent_request.responded_at = datetime.utcnow()
    if reason:
        consent_request.reason = reason
    
    await db.commit()
    
    return {
        "request_id": request_id,
        "status": "rejected",
        "message": "Payment consent rejected by banker"
    }

