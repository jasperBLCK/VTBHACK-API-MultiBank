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
from models import Payment, Account, PaymentConsent, Transaction, Client
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
    Создать платеж (инициация). Делегирует в PaymentService.
    """
    if not current_client:
        raise HTTPException(401, "Unauthorized")

    initiation = request.data.get("initiation")
    if not initiation:
        raise HTTPException(400, "Missing initiation data")

    amount_data = initiation.get("instructedAmount", {})
    debtor_account = initiation.get("debtorAccount", {})
    creditor_account = initiation.get("creditorAccount", {})
    remittance = initiation.get("remittanceInformation", {})
    description = remittance.get("unstructured", "") if remittance else ""

    try:
        payment, interbank = await PaymentService.initiate_payment(
            db=db,
            from_account_number=debtor_account.get("identification"),
            to_account_number=creditor_account.get("identification"),
            amount=Decimal(amount_data.get("amount", "0")),
            description=description,
            payment_consent_id=x_payment_consent_id
        )

        # Если использовалось согласие - пометить его как использованное
        if x_payment_consent_id:
            consent_result = await db.execute(
                select(PaymentConsent).where(PaymentConsent.consent_id == x_payment_consent_id)
            )
            consent = consent_result.scalar_one_or_none()
            if consent:
                consent.status = "used"
                consent.used_at = datetime.utcnow()
                consent.status_update_date_time = datetime.utcnow()
                await db.commit()

        payment_data = PaymentData(
            paymentId=payment.payment_id,
            status=payment.status,
            creationDateTime=payment.creation_date_time.isoformat() + "Z",
            statusUpdateDateTime=payment.status_update_date_time.isoformat() + "Z"
        )

        return PaymentResponse(
            data=payment_data,
            links={"self": f"/payments/{payment.payment_id}"},
            meta={}
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
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


# === Simple Transfer Endpoint (for internal transfers) ===

class SimpleTransferRequest(BaseModel):
    """Простой запрос на перевод между своими счетами"""
    from_account_id: str = Field(..., description="ID счета-отправителя")
    to_account_id: str = Field(..., description="ID счета-получателя")
    amount: str = Field(..., description="Сумма перевода")
    description: Optional[str] = None


class SimpleTransferResponse(BaseModel):
    """Ответ на перевод"""
    success: bool
    transfer_id: str
    message: str


@router.post("/transfer/internal", response_model=SimpleTransferResponse, status_code=201, summary="Перевод между своими счетами")
async def transfer_internal(
    request: SimpleTransferRequest,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Простой перевод между счетами одного клиента
    
    **Требования:**
    - Оба счета должны принадлежать текущему клиенту
    - Достаточно средств на счете-отправителе
    - Сумма > 0
    """
    
    if not current_client:
        raise HTTPException(401, "Unauthorized")
    
    import logging
    logger = logging.getLogger(__name__)

    try:
        # Получаем клиента
        client_result = await db.execute(
            select(Client).where(Client.person_id == current_client["client_id"])
        )
        client = client_result.scalar_one_or_none()

        if not client:
            raise HTTPException(401, "Client not found")

        # Попробуем разрешить переданные идентификаторы в нескольких форматах:
        # - числовой id (1, "1")
        # - со схемой "acc-<id>"
        # - account_number (строка)

        def resolve_candidate(candidate: str):
            # Возвращает tuple (by_id:int or None, by_number:str or None)
            if candidate is None:
                return (None, None)
            s = str(candidate)
            if s.startswith('acc-'):
                s = s.replace('acc-', '')
            # Попытка преобразовать в int
            try:
                return (int(s), None)
            except Exception:
                return (None, s)

        from_id_candidate, from_number_candidate = resolve_candidate(request.from_account_id)
        to_id_candidate, to_number_candidate = resolve_candidate(request.to_account_id)

        from_account = None
        to_account = None

        # Сначала пытаемся по id
        if from_id_candidate is not None:
            from_result = await db.execute(
                select(Account).where(and_(Account.id == from_id_candidate, Account.client_id == client.id))
            )
            from_account = from_result.scalar_one_or_none()

        if not from_account and from_number_candidate:
            from_result = await db.execute(
                select(Account).where(and_(Account.account_number == from_number_candidate, Account.client_id == client.id))
            )
            from_account = from_result.scalar_one_or_none()

        if to_id_candidate is not None:
            to_result = await db.execute(
                select(Account).where(and_(Account.id == to_id_candidate, Account.client_id == client.id))
            )
            to_account = to_result.scalar_one_or_none()

        if not to_account and to_number_candidate:
            to_result = await db.execute(
                select(Account).where(and_(Account.account_number == to_number_candidate, Account.client_id == client.id))
            )
            to_account = to_result.scalar_one_or_none()

        if not from_account:
            raise HTTPException(404, "From account not found or not yours")

        if not to_account:
            raise HTTPException(404, "To account not found or not yours")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("transfer_internal failed during lookup")
        raise HTTPException(500, f"Internal error resolving accounts: {str(e)}")
    
    try:
        if from_account.id == to_account.id:
            raise HTTPException(400, "Cannot transfer to the same account")

        # Проверяем сумму
        try:
            amount = Decimal(request.amount)
        except Exception:
            raise HTTPException(400, "Invalid amount format")

        if amount <= 0:
            raise HTTPException(400, "Amount must be greater than 0")

        if from_account.balance < amount:
            raise HTTPException(400, "Insufficient funds")

        # Выполняем перевод
        transfer_id = f"transfer-{uuid.uuid4().hex[:12]}"

        # Обновляем балансы
        from_account.balance = from_account.balance - amount
        to_account.balance = to_account.balance + amount

        # Создаем транзакции
        debit_tx = Transaction(
            account_id=from_account.id,
            transaction_id=f"tx-{uuid.uuid4().hex[:12]}",
            amount=amount,
            direction="debit",
            counterparty=to_account.account_number,
            description=request.description or f"Перевод на {to_account.account_number}"
        )
        db.add(debit_tx)

        credit_tx = Transaction(
            account_id=to_account.id,
            transaction_id=f"tx-{uuid.uuid4().hex[:12]}",
            amount=amount,
            direction="credit",
            counterparty=from_account.account_number,
            description=request.description or f"Перевод с {from_account.account_number}"
        )
        db.add(credit_tx)

        # Создаем платеж для отслеживания (используем поля, определенные в модели Payment)
        payment = Payment(
            payment_id=transfer_id,
            account_id=from_account.id,
            payment_consent_id=None,
            amount=amount,
            currency=from_account.currency or "RUB",
            destination_account=to_account.account_number,
            destination_bank=None,
            description=request.description or "Internal transfer",
            status="AcceptedSettlementCompleted",
            creation_date_time=datetime.utcnow(),
            status_update_date_time=datetime.utcnow()
        )
        db.add(payment)

        await db.commit()

        logger.info(f"Internal transfer: {from_account.account_number} -> {to_account.account_number}, amount={amount}")

        return SimpleTransferResponse(
            success=True,
            transfer_id=transfer_id,
            message=f"Transfer of {amount} RUB completed successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("transfer_internal failed during execution")
        # Если commit не выполнен, откат будет выполнен при закрытии сессии/контексте
        raise HTTPException(500, f"Internal error performing transfer: {str(e)}")

