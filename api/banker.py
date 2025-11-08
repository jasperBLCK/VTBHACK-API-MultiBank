"""
Banker API - Кабинет банкира
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
import uuid

from database import get_db
from models import Product, ConsentRequest, Client, Account, ProductAgreement

router = APIRouter(prefix="/banker", tags=["Internal: Banker"], include_in_schema=False)


class ProductUpdate(BaseModel):
    """Обновление продукта"""
    interest_rate: float = None
    min_amount: float = None
    max_amount: float = None
    is_active: bool = None


@router.get("/clients")
async def get_all_clients(db: AsyncSession = Depends(get_db)):
    """Получить всех клиентов (для банкира)"""
    result = await db.execute(select(Client).order_by(Client.created_at.desc()))
    clients = result.scalars().all()
    
    return [
        {
            "id": c.id,
            "person_id": c.person_id,
            "client_type": c.client_type,
            "full_name": c.full_name,
            "segment": c.segment,
            "birth_year": c.birth_year,
            "monthly_income": float(c.monthly_income) if c.monthly_income else None,
            "created_at": c.created_at.isoformat() if c.created_at else None
        }
        for c in clients
    ]


@router.get("/products")
async def get_all_products(db: AsyncSession = Depends(get_db)):
    """Получить все продукты (для банкира)"""
    result = await db.execute(select(Product))
    products = result.scalars().all()
    
    return {
        "products": [
            {
                "product_id": p.product_id,
                "type": p.product_type,
                "name": p.name,
                "interest_rate": float(p.interest_rate) if p.interest_rate else None,
                "min_amount": float(p.min_amount) if p.min_amount else None,
                "is_active": p.is_active
            }
            for p in products
        ]
    }


@router.put("/products/{product_id}")
async def update_product(
    product_id: str,
    update: ProductUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Изменить продукт (ставки, лимиты)"""
    result = await db.execute(
        select(Product).where(Product.product_id == product_id)
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(404, "Product not found")
    
    # Обновить поля
    if update.interest_rate is not None:
        product.interest_rate = Decimal(str(update.interest_rate))
    if update.min_amount is not None:
        product.min_amount = Decimal(str(update.min_amount))
    if update.max_amount is not None:
        product.max_amount = Decimal(str(update.max_amount))
    if update.is_active is not None:
        product.is_active = update.is_active
    
    await db.commit()
    
    return {"status": "updated", "product_id": product_id}


@router.post("/products")
async def create_product(
    product_type: str,
    name: str,
    interest_rate: float,
    min_amount: float = 0,
    db: AsyncSession = Depends(get_db)
):
    """Создать новый продукт"""
    product = Product(
        product_id=f"prod-{uuid.uuid4().hex[:12]}",
        product_type=product_type,
        name=name,
        interest_rate=Decimal(str(interest_rate)),
        min_amount=Decimal(str(min_amount)),
        is_active=True
    )
    
    db.add(product)
    await db.commit()
    await db.refresh(product)
    
    return {"product_id": product.product_id, "status": "created"}


# === Consent Management ===

@router.get("/consents/all")
async def get_all_consents(db: AsyncSession = Depends(get_db)):
    """
    Получить все запросы на согласия
    
    Для banker - просмотр всех запросов на доступ к данным клиентов
    """
    result = await db.execute(
        select(ConsentRequest, Client)
        .join(Client, ConsentRequest.client_id == Client.id)
        .order_by(ConsentRequest.created_at.desc())
    )
    
    consents_data = result.all()
    
    return {
        "data": [
            {
                "request_id": consent.request_id,
                "client_id": client.person_id,
                "client_name": client.full_name,
                "requesting_bank": consent.requesting_bank,
                "requesting_bank_name": consent.requesting_bank_name,
                "permissions": consent.permissions,
                "reason": consent.reason,
                "status": consent.status,
                "created_at": consent.created_at.isoformat(),
                "responded_at": consent.responded_at.isoformat() if consent.responded_at else None
            }
            for consent, client in consents_data
        ]
    }


@router.get("/consents/pending")
async def get_pending_consents(db: AsyncSession = Depends(get_db)):
    """
    Получить запросы ожидающие одобрения
    """
    result = await db.execute(
        select(ConsentRequest, Client)
        .join(Client, ConsentRequest.client_id == Client.id)
        .where(ConsentRequest.status == "pending")
        .order_by(ConsentRequest.created_at.desc())
    )
    
    consents_data = result.all()
    
    return {
        "data": [
            {
                "request_id": consent.request_id,
                "client_id": client.person_id,
                "client_name": client.full_name,
                "requesting_bank": consent.requesting_bank,
                "requesting_bank_name": consent.requesting_bank_name,
                "permissions": consent.permissions,
                "reason": consent.reason,
                "created_at": consent.created_at.isoformat()
            }
            for consent, client in consents_data
        ]
    }


@router.put("/consents/{request_id}/approve")
async def approve_consent(
    request_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Одобрить запрос на согласие
    """
    result = await db.execute(
        select(ConsentRequest).where(ConsentRequest.request_id == request_id)
    )
    consent = result.scalar_one_or_none()
    
    if not consent:
        raise HTTPException(404, "Consent request not found")
    
    if consent.status != "pending":
        raise HTTPException(400, "Consent already processed")
    
    consent.status = "approved"
    consent.responded_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "data": {
            "request_id": consent.request_id,
            "status": "approved"
        },
        "meta": {
            "message": "Consent approved successfully"
        }
    }


@router.put("/consents/{request_id}/reject")
async def reject_consent(
    request_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Отклонить запрос на согласие
    """
    result = await db.execute(
        select(ConsentRequest).where(ConsentRequest.request_id == request_id)
    )
    consent = result.scalar_one_or_none()
    
    if not consent:
        raise HTTPException(404, "Consent request not found")
    
    if consent.status != "pending":
        raise HTTPException(400, "Consent already processed")
    
    consent.status = "rejected"
    consent.responded_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "data": {
            "request_id": consent.request_id,
            "status": "rejected"
        },
        "meta": {
            "message": "Consent rejected successfully"
        }
    }


# === Client Management ===

@router.get("/clients")
async def get_clients(db: AsyncSession = Depends(get_db)):
    """
    Получить список всех клиентов банка с агрегированными данными
    """
    result = await db.execute(select(Client))
    clients = result.scalars().all()
    
    clients_data = []
    for client in clients:
        # Get client accounts count and total balance
        accounts_result = await db.execute(
            select(func.count(Account.id), func.sum(Account.balance))
            .where(Account.client_id == client.id)
            .where(Account.status == "active")
        )
        accounts_count, total_balance = accounts_result.first()
        
        # Get product agreements count
        agreements_result = await db.execute(
            select(func.count(ProductAgreement.id))
            .where(ProductAgreement.client_id == client.id)
            .where(ProductAgreement.status == "active")
        )
        agreements_count = agreements_result.scalar()
        
        clients_data.append({
            "client_id": client.person_id,
            "full_name": client.full_name,
            "client_type": client.client_type,
            "segment": client.segment,
            "accounts_count": accounts_count or 0,
            "total_balance": float(total_balance) if total_balance else 0,
            "agreements_count": agreements_count or 0,
            "created_at": client.created_at.isoformat()
        })
    
    return {
        "data": clients_data,
        "meta": {
            "total": len(clients_data)
        }
    }


@router.get("/clients/{client_id}")
async def get_client_details(
    client_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Получить детальную информацию о клиенте со счетами
    """
    result = await db.execute(
        select(Client).where(Client.person_id == client_id)
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Get accounts
    accounts_result = await db.execute(
        select(Account)
        .where(Account.client_id == client.id)
        .where(Account.status == "active")
    )
    accounts = accounts_result.scalars().all()
    
    return {
        "data": {
            "client_id": client.person_id,
            "full_name": client.full_name,
            "client_type": client.client_type,
            "segment": client.segment,
            "birth_year": client.birth_year,
            "monthly_income": float(client.monthly_income) if client.monthly_income else None,
            "created_at": client.created_at.isoformat(),
            "accounts": [
                {
                    "account_id": f"acc-{acc.id}",
                    "account_number": acc.account_number,
                    "account_type": acc.account_type,
                    "balance": float(acc.balance),
                    "currency": acc.currency,
                    "status": acc.status,
                    "opened_at": acc.opened_at.isoformat()
                }
                for acc in accounts
            ]
        }
    }

