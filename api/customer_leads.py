"""
Customer Leads API - Лидогенерация
OpenBanking Russia Products API v1.3.1
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
import uuid

from database import get_db
from models import CustomerLead, Client
from services.auth_service import get_current_client

router = APIRouter(
    prefix="/customer-leads",
    tags=["07 OpenBanking: Customer Leads"],
    include_in_schema=False  # Скрыто из публичной документации
)


# === Pydantic Models ===

class CustomerLeadRequest(BaseModel):
    """Запрос на создание лида"""
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    interested_products: Optional[List[str]] = []
    source: Optional[str] = "api"
    estimated_income: Optional[float] = None
    notes: Optional[str] = None


# === Endpoints ===

@router.post("", status_code=201)
async def create_customer_lead(
    request: CustomerLeadRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Создать лид (потенциальный клиент)
    
    OpenBanking Russia Products API v1.3.1
    POST /customer-leads
    
    Используется для передачи информации о лидах от СПУ к банку.
    """
    # Проверить email на дубликаты
    if request.email:
        existing = await db.execute(
            select(CustomerLead).where(CustomerLead.email == request.email)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(400, f"Lead with email {request.email} already exists")
    
    # Создать лид
    lead_id = f"lead-{uuid.uuid4().hex[:12]}"
    
    lead = CustomerLead(
        customer_lead_id=lead_id,
        full_name=request.full_name,
        phone=request.phone,
        email=request.email,
        interested_products=request.interested_products or [],
        source=request.source,
        notes=request.notes,
        estimated_income=Decimal(str(request.estimated_income)) if request.estimated_income else None,
        status="pending"
    )
    
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    
    return {
        "data": {
            "customer_lead_id": lead.customer_lead_id,
            "full_name": lead.full_name,
            "phone": lead.phone,
            "email": lead.email,
            "interested_products": lead.interested_products,
            "source": lead.source,
            "status": lead.status,
            "created_at": lead.created_at.isoformat() + "Z"
        },
        "links": {
            "self": f"/customer-leads/{lead.customer_lead_id}"
        },
        "meta": {
            "message": "Customer lead created successfully"
        }
    }


@router.get("/{customer_lead_id}")
async def get_customer_lead(
    customer_lead_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Получить детали лида
    
    OpenBanking Russia Products API v1.3.1
    GET /customer-leads/{customerLeadId}
    """
    result = await db.execute(
        select(CustomerLead).where(CustomerLead.customer_lead_id == customer_lead_id)
    )
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(404, "Customer lead not found")
    
    response_data = {
        "customer_lead_id": lead.customer_lead_id,
        "full_name": lead.full_name,
        "phone": lead.phone,
        "email": lead.email,
        "interested_products": lead.interested_products,
        "source": lead.source,
        "status": lead.status,
        "estimated_income": float(lead.estimated_income) if lead.estimated_income else None,
        "notes": lead.notes,
        "created_at": lead.created_at.isoformat() + "Z",
        "updated_at": lead.updated_at.isoformat() + "Z"
    }
    
    if lead.contacted_at:
        response_data["contacted_at"] = lead.contacted_at.isoformat() + "Z"
    
    if lead.converted_to_client_id:
        response_data["converted_to_client_id"] = lead.converted_to_client_id
        response_data["conversion_status"] = "converted"
    
    return {
        "data": response_data,
        "links": {
            "self": f"/customer-leads/{customer_lead_id}"
        }
    }


@router.delete("/{customer_lead_id}")
async def delete_customer_lead(
    customer_lead_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Удалить лид
    
    OpenBanking Russia Products API v1.3.1
    DELETE /customer-leads/{customerLeadId}
    """
    result = await db.execute(
        select(CustomerLead).where(CustomerLead.customer_lead_id == customer_lead_id)
    )
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(404, "Customer lead not found")
    
    # Проверить, что лид не конвертирован в клиента
    if lead.converted_to_client_id:
        raise HTTPException(400, "Cannot delete converted lead")
    
    await db.delete(lead)
    await db.commit()
    
    return {
        "meta": {
            "message": "Customer lead deleted successfully"
        }
    }

