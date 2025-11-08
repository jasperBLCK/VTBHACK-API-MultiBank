"""
Product Offer Consents API - Согласия на персональные предложения
OpenBanking Russia Products API v1.3.1
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

from database import get_db
from models import ProductOfferConsent, CustomerLead, Client
from services.auth_service import get_current_client

router = APIRouter(
    prefix="/product-offer-consents",
    tags=["09 OpenBanking: Product Offer Consents"],
    include_in_schema=False  # Скрыто из публичной документации
)


# === Pydantic Models ===

class ProductOfferConsentRequest(BaseModel):
    """Запрос на создание согласия"""
    customer_lead_id: Optional[str] = None
    permissions: List[str]
    expires_days: Optional[int] = 365  # срок действия согласия в днях


# === Endpoints ===

@router.post("", status_code=201)
async def create_product_offer_consent(
    request: ProductOfferConsentRequest,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Создать согласие на получение персональных предложений
    
    OpenBanking Russia Products API v1.3.1
    POST /product-offer-consents
    
    Клиент/лид дает согласие на обработку данных для персонализации предложений.
    """
    client_id = None
    
    # Если авторизован - найти клиента
    if current_client:
        result = await db.execute(
            select(Client).where(Client.person_id == current_client["client_id"])
        )
        client = result.scalar_one_or_none()
        if client:
            client_id = client.id
    
    # Проверить лид если указан
    if request.customer_lead_id:
        lead_result = await db.execute(
            select(CustomerLead).where(CustomerLead.customer_lead_id == request.customer_lead_id)
        )
        lead = lead_result.scalar_one_or_none()
        
        if not lead:
            raise HTTPException(404, f"Customer lead {request.customer_lead_id} not found")
    
    # Создать согласие
    consent_id = f"poc-{uuid.uuid4().hex[:12]}"
    expires_at = datetime.utcnow() + timedelta(days=request.expires_days)
    
    consent = ProductOfferConsent(
        consent_id=consent_id,
        customer_lead_id=request.customer_lead_id,
        client_id=client_id,
        permissions=request.permissions,
        status="active",
        expires_at=expires_at
    )
    
    db.add(consent)
    await db.commit()
    await db.refresh(consent)
    
    return {
        "data": {
            "consent_id": consent.consent_id,
            "customer_lead_id": consent.customer_lead_id,
            "client_id": client_id,
            "permissions": consent.permissions,
            "status": consent.status,
            "expires_at": consent.expires_at.isoformat() + "Z",
            "created_at": consent.created_at.isoformat() + "Z"
        },
        "links": {
            "self": f"/product-offer-consents/{consent.consent_id}"
        },
        "meta": {
            "message": "Consent created successfully"
        }
    }


@router.get("/{consent_id}")
async def get_product_offer_consent(
    consent_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Получить детали согласия
    
    OpenBanking Russia Products API v1.3.1
    GET /product-offer-consents/{consentId}
    """
    result = await db.execute(
        select(ProductOfferConsent).where(ProductOfferConsent.consent_id == consent_id)
    )
    consent = result.scalar_one_or_none()
    
    if not consent:
        raise HTTPException(404, "Consent not found")
    
    return {
        "data": {
            "consent_id": consent.consent_id,
            "customer_lead_id": consent.customer_lead_id,
            "client_id": consent.client_id,
            "permissions": consent.permissions,
            "status": consent.status,
            "expires_at": consent.expires_at.isoformat() + "Z" if consent.expires_at else None,
            "created_at": consent.created_at.isoformat() + "Z",
            "revoked_at": consent.revoked_at.isoformat() + "Z" if consent.revoked_at else None
        },
        "links": {
            "self": f"/product-offer-consents/{consent_id}"
        }
    }


@router.delete("/{consent_id}")
async def delete_product_offer_consent(
    consent_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Отозвать согласие
    
    OpenBanking Russia Products API v1.3.1
    DELETE /product-offer-consents/{consentId}
    """
    result = await db.execute(
        select(ProductOfferConsent).where(ProductOfferConsent.consent_id == consent_id)
    )
    consent = result.scalar_one_or_none()
    
    if not consent:
        raise HTTPException(404, "Consent not found")
    
    # Отозвать согласие
    consent.status = "revoked"
    consent.revoked_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "data": {
            "consent_id": consent.consent_id,
            "status": "revoked",
            "revoked_at": consent.revoked_at.isoformat() + "Z"
        },
        "meta": {
            "message": "Consent revoked successfully"
        }
    }

