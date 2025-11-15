"""
Product Offers API - Персональные предложения продуктов
OpenBanking Russia Products API v1.3.1
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import datetime, timedelta
import uuid

from database import get_db
from models import ProductOffer, CustomerLead, Product, Client
from services.auth_service import get_current_client

router = APIRouter(
    prefix="/product-offers",
    tags=["08 OpenBanking: Product Offers"],
    include_in_schema=False  # Скрыто из публичной документации
)


# === Pydantic Models ===

class ProductOfferRequest(BaseModel):
    """Запрос на создание персонального предложения"""
    customer_lead_id: Optional[str] = None
    product_id: str
    personalized_rate: Optional[float] = None
    personalized_amount: Optional[float] = None
    personalized_term_months: Optional[int] = None
    valid_days: Optional[int] = 30  # срок действия предложения в днях


# === Endpoints ===

@router.post("", status_code=201)
async def create_product_offer(
    request: ProductOfferRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Создать персональное предложение по продукту
    
    OpenBanking Russia Products API v1.3.1
    POST /product-offers
    
    Банк создает персонализированное предложение для лида с индивидуальными условиями.
    """
    # Найти продукт
    product_result = await db.execute(
        select(Product).where(Product.product_id == request.product_id)
    )
    product = product_result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(404, f"Product {request.product_id} not found")
    
    # Проверить лид если указан
    if request.customer_lead_id:
        lead_result = await db.execute(
            select(CustomerLead).where(CustomerLead.customer_lead_id == request.customer_lead_id)
        )
        lead = lead_result.scalar_one_or_none()
        
        if not lead:
            raise HTTPException(404, f"Customer lead {request.customer_lead_id} not found")
    
    # Создать предложение
    offer_id = f"offer-{uuid.uuid4().hex[:12]}"
    valid_until = datetime.utcnow() + timedelta(days=request.valid_days)
    
    offer = ProductOffer(
        offer_id=offer_id,
        customer_lead_id=request.customer_lead_id,
        product_id=product.id,
        personalized_rate=Decimal(str(request.personalized_rate)) if request.personalized_rate else product.interest_rate,
        personalized_amount=Decimal(str(request.personalized_amount)) if request.personalized_amount else None,
        personalized_term_months=request.personalized_term_months or product.term_months,
        status="pending",
        valid_until=valid_until
    )
    
    db.add(offer)
    await db.commit()
    await db.refresh(offer)
    
    return {
        "data": {
            "offer_id": offer.offer_id,
            "customer_lead_id": offer.customer_lead_id,
            "product_id": product.product_id,
            "product_name": product.name,
            "personalized_rate": float(offer.personalized_rate) if offer.personalized_rate else None,
            "personalized_amount": float(offer.personalized_amount) if offer.personalized_amount else None,
            "personalized_term_months": offer.personalized_term_months,
            "status": offer.status,
            "valid_until": offer.valid_until.isoformat() + "Z",
            "created_at": offer.created_at.isoformat() + "Z"
        },
        "links": {
            "self": f"/product-offers/{offer.offer_id}"
        },
        "meta": {
            "message": "Product offer created successfully"
        }
    }


@router.get("")
async def get_product_offers(
    customer_lead_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Получить список персональных предложений
    
    OpenBanking Russia Products API v1.3.1
    GET /product-offers
    
    Query params:
    - customer_lead_id: фильтр по лиду
    - status: фильтр по статусу
    """
    query = select(ProductOffer, Product).join(
        Product, ProductOffer.product_id == Product.id
    )
    
    if customer_lead_id:
        query = query.where(ProductOffer.customer_lead_id == customer_lead_id)
    
    if status:
        query = query.where(ProductOffer.status == status)
    
    query = query.order_by(ProductOffer.created_at.desc())
    
    result = await db.execute(query)
    offers_data = result.all()
    
    offers_list = []
    for offer, product in offers_data:
        offers_list.append({
            "offer_id": offer.offer_id,
            "customer_lead_id": offer.customer_lead_id,
            "product_id": product.product_id,
            "product_name": product.name,
            "personalized_rate": float(offer.personalized_rate) if offer.personalized_rate else None,
            "personalized_amount": float(offer.personalized_amount) if offer.personalized_amount else None,
            "personalized_term_months": offer.personalized_term_months,
            "status": offer.status,
            "valid_until": offer.valid_until.isoformat() + "Z" if offer.valid_until else None,
            "created_at": offer.created_at.isoformat() + "Z"
        })
    
    return {
        "data": {
            "offers": offers_list
        },
        "meta": {
            "total": len(offers_list)
        }
    }


@router.get("/{offer_id}")
async def get_product_offer(
    offer_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Получить детали персонального предложения
    
    OpenBanking Russia Products API v1.3.1
    GET /product-offers/{offerId}
    """
    result = await db.execute(
        select(ProductOffer, Product).join(
            Product, ProductOffer.product_id == Product.id
        ).where(ProductOffer.offer_id == offer_id)
    )
    
    offer_data = result.first()
    
    if not offer_data:
        raise HTTPException(404, "Product offer not found")
    
    offer, product = offer_data
    
    return {
        "data": {
            "offer_id": offer.offer_id,
            "customer_lead_id": offer.customer_lead_id,
            "product_id": product.product_id,
            "product_name": product.name,
            "product_type": product.product_type,
            "product_description": product.description,
            "personalized_rate": float(offer.personalized_rate) if offer.personalized_rate else None,
            "personalized_amount": float(offer.personalized_amount) if offer.personalized_amount else None,
            "personalized_term_months": offer.personalized_term_months,
            "status": offer.status,
            "valid_until": offer.valid_until.isoformat() + "Z" if offer.valid_until else None,
            "created_at": offer.created_at.isoformat() + "Z",
            "sent_at": offer.sent_at.isoformat() + "Z" if offer.sent_at else None,
            "viewed_at": offer.viewed_at.isoformat() + "Z" if offer.viewed_at else None,
            "responded_at": offer.responded_at.isoformat() + "Z" if offer.responded_at else None
        },
        "links": {
            "self": f"/product-offers/{offer_id}"
        }
    }


@router.delete("/{offer_id}")
async def delete_product_offer(
    offer_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Удалить персональное предложение
    
    OpenBanking Russia Products API v1.3.1
    DELETE /product-offers/{offerId}
    """
    result = await db.execute(
        select(ProductOffer).where(ProductOffer.offer_id == offer_id)
    )
    offer = result.scalar_one_or_none()
    
    if not offer:
        raise HTTPException(404, "Product offer not found")
    
    # Проверить статус
    if offer.status in ["accepted"]:
        raise HTTPException(400, "Cannot delete accepted offer")
    
    await db.delete(offer)
    await db.commit()
    
    return {
        "meta": {
            "message": "Product offer deleted successfully"
        }
    }

