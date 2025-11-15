"""
Product-Agreement-Consents API - Согласия на управление договорами
OpenBanking Russia Products API extension

Позволяет сторонним приложениям (TPP):
- Просматривать договоры клиента (депозиты, кредиты, карты)
- Открывать новые продукты от имени клиента
- Закрывать существующие договоры

Требует явного согласия клиента с указанием разрешений и лимитов.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from datetime import datetime, timedelta
from decimal import Decimal
import uuid

try:
    from database import get_db
    from models import (
        ProductAgreementConsentRequest, 
        ProductAgreementConsent,
        Client,
        Notification,
        BankSettings
    )
    from services.auth_service import get_current_client, get_current_banker, get_optional_client
except ImportError:
    from database import get_db
    from models import (
        ProductAgreementConsentRequest, 
        ProductAgreementConsent,
        Client,
        Notification,
        BankSettings
    )
    from services.auth_service import get_current_client, get_current_banker, get_optional_client


router = APIRouter(
    prefix="/product-agreement-consents",
    tags=["6 Согласия на управление договорами"]
)


# === Pydantic Models ===

class ProductAgreementConsentRequestData(BaseModel):
    """Запрос на создание согласия для управления договорами"""
    requesting_bank: str = Field(..., description="Код банка-инициатора")
    client_id: str = Field(..., description="ID клиента")
    
    # Разрешения
    read_product_agreements: bool = Field(False, description="Читать список договоров")
    open_product_agreements: bool = Field(False, description="Открывать новые договоры")
    close_product_agreements: bool = Field(False, description="Закрывать договоры")
    
    # Ограничения
    allowed_product_types: Optional[List[str]] = Field(
        None,
        description="Разрешенные типы продуктов: deposit, card, credit"
    )
    max_amount: Optional[Decimal] = Field(
        None,
        description="Макс сумма открытия продукта"
    )
    
    # Срок действия
    valid_until: Optional[datetime] = Field(
        None,
        description="Действует до"
    )
    
    reason: Optional[str] = Field(None, description="Причина запроса")


class ProductAgreementConsentResponse(BaseModel):
    """Ответ с данными согласия"""
    consent_id: Optional[str] = None
    request_id: str
    status: str
    granted_to: str
    
    # Разрешения
    read_product_agreements: bool
    open_product_agreements: bool
    close_product_agreements: bool
    
    # Ограничения
    allowed_product_types: Optional[List[str]] = None
    max_amount: Optional[float] = None
    current_total_opened: Optional[float] = None
    
    # Даты
    created_at: str
    valid_until: Optional[str] = None


# === Endpoints ===

@router.post("/request", response_model=dict, status_code=200, summary="Создать запрос согласия на управление договорами")
async def create_product_agreement_consent_request(
    data: ProductAgreementConsentRequestData,
    client_id: Optional[str] = Query(None, description="ID клиента (обязательно для bank_token)", example="team200-1"),
    current_client: Optional[dict] = Depends(get_optional_client),
    db: AsyncSession = Depends(get_db)
):
    """
    ## 📋 Создание запроса на согласие для управления договорами
    
    **OpenBanking Russia Products API Extension**
    
    ### 🔑 Аутентификация:
    - **bank_token** (type="team"): укажите `client_id` в query параметре
    - **client_token** (type="client"): `client_id` определится автоматически
    
    ### Use Case:
    Финансовый агрегатор или маркетплейс хочет:
    - Показывать все продукты клиента из разных банков
    - Открывать депозиты/карты от имени клиента
    - Закрывать неактуальные договоры
    
    ### Пример запроса:
    ```json
    {
      "requesting_bank": "team200",
      "client_id": "team200-1",
      "read_product_agreements": true,
      "open_product_agreements": true,
      "close_product_agreements": false,
      "allowed_product_types": ["deposit", "card"],
      "max_amount": 1000000.00,
      "valid_until": "2025-12-31T23:59:59",
      "reason": "Финансовый агрегатор для управления продуктами"
    }
    ```
    
    ### Разрешения:
    - `read_product_agreements`: просмотр списка договоров (депозиты, кредиты, карты)
    - `open_product_agreements`: открытие новых продуктов
    - `close_product_agreements`: закрытие существующих договоров
    
    ### Ограничения:
    - `allowed_product_types`: только указанные типы продуктов
    - `max_amount`: макс сумма для открытия одного продукта
    """
    
    # Определить client_id (либо из токена, либо из параметра для bank_token)
    target_client_id = None
    if current_client:
        target_client_id = current_client.get("client_id")
    elif client_id:
        # Используется bank_token с параметром client_id - это OK
        target_client_id = client_id
    else:
        raise HTTPException(401, "Unauthorized. Укажите client_id или используйте client_token")
    
    # Проверить что запрошено хотя бы одно разрешение
    if not any([
        data.read_product_agreements,
        data.open_product_agreements,
        data.close_product_agreements
    ]):
        raise HTTPException(400, "At least one permission must be requested")
    
    # Найти клиента (используем target_client_id, а не data.client_id!)
    result = await db.execute(
        select(Client).where(Client.person_id == target_client_id)
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(404, f"Client {target_client_id} not found")
    
    # Создать запрос на согласие
    request_id = f"pagcr-{uuid.uuid4().hex[:12]}"
    
    consent_request = ProductAgreementConsentRequest(
        request_id=request_id,
        client_id=client.id,
        requesting_bank=data.requesting_bank,
        requesting_bank_name=data.requesting_bank.upper(),
        read_product_agreements=data.read_product_agreements,
        open_product_agreements=data.open_product_agreements,
        close_product_agreements=data.close_product_agreements,
        allowed_product_types=data.allowed_product_types,
        max_amount=data.max_amount,
        valid_until=data.valid_until or (datetime.utcnow() + timedelta(days=365)),
        reason=data.reason or "Product agreement management",
        status="pending"
    )
    db.add(consent_request)
    
    # Проверить настройки банка (авто-одобрение?)
    settings_result = await db.execute(
        select(BankSettings).where(BankSettings.key == "auto_approve_product_agreement_consents")
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
        consent_id = f"pagc-{uuid.uuid4().hex[:12]}"
        
        product_agreement_consent = ProductAgreementConsent(
            consent_id=consent_id,
            request_id=consent_request.id,
            client_id=client.id,
            granted_to=data.requesting_bank,
            read_product_agreements=data.read_product_agreements,
            open_product_agreements=data.open_product_agreements,
            close_product_agreements=data.close_product_agreements,
            allowed_product_types=data.allowed_product_types,
            max_amount=data.max_amount,
            current_total_opened=Decimal("0"),
            valid_until=data.valid_until or (datetime.utcnow() + timedelta(days=365)),
            status="active"
        )
        db.add(product_agreement_consent)
        
        consent_request.status = "approved"
        consent_request.responded_at = datetime.utcnow()
        status = "approved"
    else:
        # Требуется ручное одобрение
        notification = Notification(
            client_id=client.id,
            notification_type="product_agreement_consent_request",
            title=f"Запрос на управление договорами от {data.requesting_bank}",
            message=f"Разрешения: чтение={data.read_product_agreements}, открытие={data.open_product_agreements}, закрытие={data.close_product_agreements}",
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
        "valid_until": (data.valid_until or (datetime.utcnow() + timedelta(days=365))).isoformat() + "Z"
    }


@router.get("/{consent_id}", response_model=dict, summary="Получить согласие по ID")
async def get_product_agreement_consent(
    consent_id: str,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    ## 📋 Получение согласия на управление договорами
    """
    result = await db.execute(
        select(ProductAgreementConsent).where(
            ProductAgreementConsent.consent_id == consent_id
        )
    )
    consent = result.scalar_one_or_none()
    
    if not consent:
        raise HTTPException(404, "Product agreement consent not found")
    
    return {
        "consent_id": consent.consent_id,
        "granted_to": consent.granted_to,
        "status": consent.status,
        "read_product_agreements": consent.read_product_agreements,
        "open_product_agreements": consent.open_product_agreements,
        "close_product_agreements": consent.close_product_agreements,
        "allowed_product_types": consent.allowed_product_types,
        "max_amount": float(consent.max_amount) if consent.max_amount else None,
        "current_total_opened": float(consent.current_total_opened) if consent.current_total_opened else 0,
        "created_at": consent.creation_date_time.isoformat() + "Z",
        "valid_until": consent.valid_until.isoformat() + "Z" if consent.valid_until else None
    }


@router.delete("/{consent_id}", status_code=204, summary="Отозвать согласие")
async def revoke_product_agreement_consent(
    consent_id: str,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    ## 🗑️ Отзыв согласия на управление договорами
    """
    result = await db.execute(
        select(ProductAgreementConsent).where(
            ProductAgreementConsent.consent_id == consent_id
        )
    )
    consent = result.scalar_one_or_none()
    
    if not consent:
        raise HTTPException(404, "Product agreement consent not found")
    
    consent.status = "revoked"
    consent.revoked_at = datetime.utcnow()
    consent.status_update_date_time = datetime.utcnow()
    
    await db.commit()
    
    return None


@router.get("/pending/list", response_model=List[dict], include_in_schema=False)
async def list_pending_product_agreement_consents(
    current_banker: dict = Depends(get_current_banker),
    db: AsyncSession = Depends(get_db)
):
    """
    ## 📋 Список ожидающих согласий на управление договорами (для банкира)
    """
    if not current_banker:
        raise HTTPException(401, "Banker access required")
    
    result = await db.execute(
        select(ProductAgreementConsentRequest)
        .where(ProductAgreementConsentRequest.status == "pending")
        .order_by(ProductAgreementConsentRequest.created_at.desc())
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
            "read_product_agreements": req.read_product_agreements,
            "open_product_agreements": req.open_product_agreements,
            "close_product_agreements": req.close_product_agreements,
            "allowed_product_types": req.allowed_product_types,
            "max_amount": float(req.max_amount) if req.max_amount else None,
            "created_at": req.created_at.isoformat() if req.created_at else None
        })
    
    return response


@router.post("/{request_id}/approve", response_model=dict, include_in_schema=False)
async def approve_product_agreement_consent(
    request_id: str,
    current_banker: dict = Depends(get_current_banker),
    db: AsyncSession = Depends(get_db)
):
    """
    ## ✅ Одобрение согласия на управление договорами (банкиром)
    """
    if not current_banker:
        raise HTTPException(401, "Banker access required")
    
    result = await db.execute(
        select(ProductAgreementConsentRequest).where(
            ProductAgreementConsentRequest.request_id == request_id
        )
    )
    consent_request = result.scalar_one_or_none()
    
    if not consent_request:
        raise HTTPException(404, "Product agreement consent request not found")
    
    if consent_request.status != "pending":
        raise HTTPException(400, f"Request already {consent_request.status}")
    
    # Создать активное согласие
    consent_id = f"pagc-{uuid.uuid4().hex[:12]}"
    
    product_agreement_consent = ProductAgreementConsent(
        consent_id=consent_id,
        request_id=consent_request.id,
        client_id=consent_request.client_id,
        granted_to=consent_request.requesting_bank,
        read_product_agreements=consent_request.read_product_agreements,
        open_product_agreements=consent_request.open_product_agreements,
        close_product_agreements=consent_request.close_product_agreements,
        allowed_product_types=consent_request.allowed_product_types,
        max_amount=consent_request.max_amount,
        current_total_opened=Decimal("0"),
        valid_until=consent_request.valid_until or (datetime.utcnow() + timedelta(days=365)),
        status="active"
    )
    db.add(product_agreement_consent)
    
    # Обновить запрос
    consent_request.status = "approved"
    consent_request.responded_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "request_id": request_id,
        "consent_id": consent_id,
        "status": "approved",
        "message": "Product agreement consent approved by banker"
    }


@router.post("/{request_id}/reject", response_model=dict, include_in_schema=False)
async def reject_product_agreement_consent(
    request_id: str,
    reason: Optional[str] = None,
    current_banker: dict = Depends(get_current_banker),
    db: AsyncSession = Depends(get_db)
):
    """
    ## ❌ Отклонение согласия на управление договорами (банкиром)
    """
    if not current_banker:
        raise HTTPException(401, "Banker access required")
    
    result = await db.execute(
        select(ProductAgreementConsentRequest).where(
            ProductAgreementConsentRequest.request_id == request_id
        )
    )
    consent_request = result.scalar_one_or_none()
    
    if not consent_request:
        raise HTTPException(404, "Product agreement consent request not found")
    
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
        "message": "Product agreement consent rejected by banker"
    }

