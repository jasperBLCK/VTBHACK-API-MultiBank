"""
Account-Consents API - Управление согласиями
OpenBanking Russia v2.1 compatible

---

**📊 Sequence диаграммы:**  
На landing есть интерактивные диаграммы: https://open.bankingapi.ru/ → кнопка "Посмотреть sequence диаграммы согласий"

Два варианта flow:
- ✅ Автоматическое одобрение (VBank, ABank) - 3 запроса
- 🔐 Ручное одобрение (SBank) - реалистичный production flow

**⚠️ ВАЖНО:** Настройки банков могут измениться по ходу хакатона!

---
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

from database import get_db
from models import Consent, ConsentRequest, Notification, Client
from services.auth_service import get_current_client, get_current_bank, get_optional_client
from services.consent_service import ConsentService


router = APIRouter(prefix="/account-consents", tags=["1 Согласия на доступ к счетам"])


# === Pydantic Models (OpenBanking Russia format) ===

class ConsentDataRequest(BaseModel):
    """Data для создания согласия"""
    permissions: List[str] = Field(..., description="ReadAccountsDetail, ReadBalances, ReadTransactionsDetail")
    expirationDateTime: Optional[str] = None
    transactionFromDateTime: Optional[str] = None
    transactionToDateTime: Optional[str] = None


class ConsentCreateRequest(BaseModel):
    """Запрос создания согласия (OpenBanking Russia format)"""
    data: ConsentDataRequest
    risk: Optional[dict] = {}


class ConsentData(BaseModel):
    """Данные согласия в ответе"""
    consentId: str
    status: str
    creationDateTime: str
    statusUpdateDateTime: str
    permissions: List[str]
    expirationDateTime: Optional[str] = None


class ConsentResponse(BaseModel):
    """Ответ с согласием"""
    data: ConsentData
    links: dict
    meta: Optional[dict] = {}




# === Межбанковские endpoints (для других банков) ===

class ConsentRequestBody(BaseModel):
    """Body для запроса согласия"""
    client_id: str
    permissions: List[str]
    reason: str = ""
    requesting_bank: str = "test_bank"
    requesting_bank_name: str = "Test Bank"


@router.post("/request", summary="Создать согласие")
async def request_consent(
    body: ConsentRequestBody,
    x_requesting_bank: Optional[str] = Header(None, alias="x-requesting-bank"),
    db: AsyncSession = Depends(get_db)
):
    """
    ## 🚀 Быстрое создание согласия (только для хакатона!)
    
    **⚠️ ВНИМАНИЕ: Это НЕ стандартный OpenBanking Russia endpoint!**
    
    Упрощённый способ получить согласие в один шаг без OAuth редиректов.
    
    ### Для изучения стандарта используйте:
    - `POST /account-consents` — создание consent resource (АФТ)
    - `POST /account-consents/{id}/authorize` — авторизация
    - `GET /account-consents/{id}` — проверка статуса
    
    ### ⚠️ В production используйте OAuth 2.0 Authorization Code Flow
    """
    # В sandbox режиме: разрешаем запросы для тестирования
    requesting_bank = x_requesting_bank or body.requesting_bank
    requesting_bank_name = body.requesting_bank_name
    
    try:
        consent_request, consent = await ConsentService.create_consent_request(
            db=db,
            client_person_id=body.client_id,
            requesting_bank=requesting_bank,
            requesting_bank_name=requesting_bank_name,
            permissions=body.permissions,
            reason=body.reason
        )
        
        if consent:
            # Автоодобрено
            return {
                "request_id": consent_request.request_id,
                "consent_id": consent.consent_id,
                "status": "approved",
                "message": "Согласие одобрено автоматически",
                "created_at": consent_request.created_at.isoformat(),
                "auto_approved": True
            }
        else:
            # Требуется одобрение
            return {
                "request_id": consent_request.request_id,
                "status": "pending",
                "message": "Запрос отправлен на одобрение",
                "created_at": consent_request.created_at.isoformat(),
                "auto_approved": False
            }
        
    except ValueError as e:
        raise HTTPException(404, str(e))




# === OpenBanking Russia стандартные endpoints ===

@router.post("", response_model=ConsentResponse, status_code=201, include_in_schema=False)
async def create_account_access_consents(
    request: ConsentCreateRequest,
    x_fapi_interaction_id: Optional[str] = Header(None, alias="x-fapi-interaction-id"),
    current_bank: Optional[dict] = Depends(get_current_bank),
    db: AsyncSession = Depends(get_db)
):
    """
    ## 📖 Создание ресурса согласия (OpenBanking Russia v2.1)
    
    **Стандартный endpoint из спецификации АФТ.**
    
    ### ⚠️ Для быстрого старта используйте `POST /account-consents/request`
    
    Этот endpoint показывает правильный OpenBanking Russia flow.
    """
    
    # Получить requesting_bank из токена или заголовка
    requesting_bank = x_fapi_interaction_id or (current_bank.get("client_id") if current_bank else "unknown")
    requesting_bank_name = f"App {requesting_bank}"
    
    # Создать consent request в БД
    consent_id = f"ac-{uuid.uuid4().hex[:12]}"
    
    # Рассчитать expiration
    if request.data.expirationDateTime:
        expiration = datetime.fromisoformat(request.data.expirationDateTime.replace("Z", ""))
    else:
        expiration = datetime.utcnow() + timedelta(days=90)
    
    consent_request = ConsentRequest(
        request_id=consent_id,
        client_id=None,  # будет заполнен при авторизации
        requesting_bank=requesting_bank,
        requesting_bank_name=requesting_bank_name,
        permissions=request.data.permissions,
        reason="Consent resource created via standard endpoint",
        status="pending"
    )
    db.add(consent_request)
    await db.commit()
    
    now = datetime.utcnow()
    
    consent_data = ConsentData(
        consentId=consent_id,
        status="AwaitingAuthorization",
        creationDateTime=now.isoformat() + "Z",
        statusUpdateDateTime=now.isoformat() + "Z",
        permissions=request.data.permissions,
        expirationDateTime=expiration.isoformat() + "Z"
    )
    
    return ConsentResponse(
        data=consent_data,
        links={
            "self": f"/account-consents/{consent_id}"
        },
        meta={}
    )


@router.post("/{consent_id}/authorize", include_in_schema=False)
async def authorize_consent(
    consent_id: str,
    action: str = "approve",
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    ## 🧪 Упрощённая авторизация consent (только для sandbox)
    
    **В production это происходит через OAuth redirect.**
    
    Для sandbox: клиент может авторизовать consent напрямую через API.
    """
    if not current_client:
        raise HTTPException(401, "Client authentication required")
    
    try:
        status, consent = await ConsentService.authorize_consent_by_id(
            db=db,
            consent_id=consent_id,
            client_person_id=current_client["client_id"],
            action=action
        )
        
        if consent:
            return {
                "consentId": consent.consent_id,
                "status": status,
                "message": "Consent authorized successfully",
                "permissions": consent.permissions,
                "expiresAt": consent.expiration_date_time.isoformat() + "Z" if consent.expiration_date_time else None
            }
        else:
            return {
                "consentId": consent_id,
                "status": status,
                "message": "Consent rejected"
            }
            
    except ValueError as e:
        raise HTTPException(404, str(e))


# === Клиентские endpoints (для собственных клиентов) ===

@router.get("/requests", tags=["Internal: Consents"], include_in_schema=False)
async def get_consent_requests(
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """Получить все запросы на согласие для клиента"""
    if not current_client:
        raise HTTPException(401, "Unauthorized")
    
    # Получить client.id
    client_result = await db.execute(
        select(Client).where(Client.person_id == current_client["client_id"])
    )
    client = client_result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Получить pending запросы
    result = await db.execute(
        select(ConsentRequest).where(
            and_(
                ConsentRequest.client_id == client.id,
                ConsentRequest.status == "pending"
            )
        ).order_by(ConsentRequest.created_at.desc())
    )
    requests = result.scalars().all()
    
    return {
        "requests": [
            {
                "request_id": req.request_id,
                "requesting_bank": req.requesting_bank,
                "requesting_bank_name": req.requesting_bank_name,
                "permissions": req.permissions,
                "reason": req.reason,
                "created_at": req.created_at.isoformat(),
                "status": req.status
            }
            for req in requests
        ]
    }


class SignConsentBody(BaseModel):
    """Body для подписания согласия"""
    request_id: str
    action: str  # approve / reject
    signature: str = "password"


@router.post("/sign", tags=["Internal: Consents"], include_in_schema=False)
async def sign_consent(
    body: SignConsentBody,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Подписание или отклонение согласия клиентом
    
    Не из стандарта, но необходимо для процесса подписания
    """
    if not current_client:
        raise HTTPException(401, "Unauthorized")
    
    try:
        status, consent = await ConsentService.sign_consent(
            db=db,
            request_id=body.request_id,
            client_person_id=current_client["client_id"],
            action=body.action,
            signature=body.signature
        )
        
        if body.action == "approve" and consent:
            return {
                "consent_id": consent.consent_id,
                "status": consent.status,
                "granted_to": consent.granted_to,
                "permissions": consent.permissions,
                "expires_at": consent.expiration_date_time.isoformat(),
                "signed_at": consent.signed_at.isoformat()
            }
        else:
            return {
                "request_id": body.request_id,
                "status": "rejected"
            }
            
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/my-consents", tags=["Internal: Consents"], include_in_schema=False)
async def get_my_consents(
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """Получить все активные согласия клиента"""
    if not current_client:
        raise HTTPException(401, "Unauthorized")
    
    client_result = await db.execute(
        select(Client).where(Client.person_id == current_client["client_id"])
    )
    client = client_result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Получить все согласия
    result = await db.execute(
        select(Consent).where(Consent.client_id == client.id)
        .order_by(Consent.creation_date_time.desc())
    )
    consents = result.scalars().all()
    
    return {
        "consents": [
            {
                "consent_id": c.consent_id,
                "granted_to": c.granted_to,
                "permissions": c.permissions,
                "status": c.status,
                "signed_at": c.signed_at.isoformat() if c.signed_at else None,
                "expires_at": c.expiration_date_time.isoformat() if c.expiration_date_time else None,
                "last_accessed": c.last_accessed_at.isoformat() if c.last_accessed_at else None
            }
            for c in consents
        ]
    }


@router.delete("/my-consents/{consent_id}", tags=["Internal: Consents"], include_in_schema=False)
async def revoke_consent(
    consent_id: str,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """Отозвать согласие"""
    if not current_client:
        raise HTTPException(401, "Unauthorized")
    
    success = await ConsentService.revoke_consent(
        db=db,
        consent_id=consent_id,
        client_person_id=current_client["client_id"]
    )
    
    if not success:
        raise HTTPException(404, "Consent not found or already revoked")
    
    return {
        "consent_id": consent_id,
        "status": "Revoked",
        "revoked_at": datetime.utcnow().isoformat()
    }


@router.get("/{consent_id}", response_model=ConsentResponse, summary="Получить согласие по ID")
async def get_account_access_consents_consent_id(
    consent_id: str,
    x_fapi_interaction_id: Optional[str] = Header(None, alias="x-fapi-interaction-id"),
    current_bank: Optional[dict] = Depends(get_current_bank),
    db: AsyncSession = Depends(get_db)
):
    """
    Получение ресурса согласия
    
    OpenBanking Russia Account-Consents API v2.1
    GET /account-consents/{consentId}
    """
    # Сначала проверяем в Consent (если уже авторизован)
    result = await db.execute(
        select(Consent).where(Consent.consent_id == consent_id)
    )
    consent = result.scalar_one_or_none()
    
    if consent:
        # Маппинг статусов из БД в OpenBanking формат
        status_mapping = {
            "active": "Authorized",
            "Revoked": "Revoked",
            "expired": "Expired",
            "rejected": "Rejected"
        }
        
        consent_data = ConsentData(
            consentId=consent.consent_id,
            status=status_mapping.get(consent.status, "Authorized"),  # используем реальный статус из БД
            creationDateTime=consent.creation_date_time.isoformat() + "Z",
            statusUpdateDateTime=consent.status_update_date_time.isoformat() + "Z",
            permissions=consent.permissions,
            expirationDateTime=consent.expiration_date_time.isoformat() + "Z" if consent.expiration_date_time else None
        )
        
        return ConsentResponse(
            data=consent_data,
            links={
                "self": f"/account-consents/{consent_id}"
            },
            meta={}
        )
    
    # Если нет в Consent, проверяем ConsentRequest (ожидает авторизации)
    request_result = await db.execute(
        select(ConsentRequest).where(ConsentRequest.request_id == consent_id)
    )
    consent_request = request_result.scalar_one_or_none()
    
    if not consent_request:
        raise HTTPException(404, "Consent not found")
    
    consent_data = ConsentData(
        consentId=consent_id,
        status="AwaitingAuthorization",
        creationDateTime=consent_request.created_at.isoformat() + "Z",
        statusUpdateDateTime=consent_request.created_at.isoformat() + "Z",
        permissions=consent_request.permissions,
        expirationDateTime=(datetime.utcnow() + timedelta(days=90)).isoformat() + "Z"
    )
    
    return ConsentResponse(
        data=consent_data,
        links={
            "self": f"/account-consents/{consent_id}"
        },
        meta={}
    )


@router.delete("/{consent_id}", status_code=204, summary="Отозвать согласие")
async def delete_account_access_consents_consent_id(
    consent_id: str,
    x_fapi_interaction_id: Optional[str] = Header(None, alias="x-fapi-interaction-id"),
    current_bank: Optional[dict] = Depends(get_current_bank),
    db: AsyncSession = Depends(get_db)
):
    """
    Удаление ресурса согласия
    
    OpenBanking Russia Account-Consents API v2.1
    DELETE /account-consents/{consentId}
    """
    result = await db.execute(
        select(Consent).where(Consent.consent_id == consent_id)
    )
    consent = result.scalar_one_or_none()
    
    if not consent:
        raise HTTPException(404, "Consent not found")
    
    # Удалить (или изменить статус на Revoked)
    consent.status = "Revoked"
    consent.status_update_date_time = datetime.utcnow()
    await db.commit()
    
    return None  # 204 No Content







