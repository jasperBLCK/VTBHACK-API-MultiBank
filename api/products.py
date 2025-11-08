"""
Products API - Каталог продуктов банка
OpenBanking Russia Products API v1.3
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Product

router = APIRouter(prefix="/products", tags=["5 Каталог продуктов"])


@router.get("", summary="Получить продукты")
async def get_products(
    product_type: str = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Получить каталог продуктов
    
    OpenBanking Russia Products API v1.3
    """
    query = select(Product).where(Product.is_active == True)
    
    if product_type:
        query = query.where(Product.product_type == product_type)
    
    result = await db.execute(query)
    products = result.scalars().all()
    
    return {
        "data": {
            "product": [
                {
                    "productId": p.product_id,
                    "productType": p.product_type,
                    "productName": p.name,
                    "description": p.description,
                    "interestRate": str(p.interest_rate) if p.interest_rate else None,
                    "minAmount": str(p.min_amount) if p.min_amount else None,
                    "maxAmount": str(p.max_amount) if p.max_amount else None,
                    "termMonths": p.term_months
                }
                for p in products
            ]
        }
    }


@router.get("/{product_id}", summary="Получить продукт")
async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Получить детали продукта"""
    result = await db.execute(
        select(Product).where(Product.product_id == product_id)
    )
    product = result.scalar_one_or_none()
    
    if not product:
        from fastapi import HTTPException
        raise HTTPException(404, "Product not found")
    
    return {
        "data": {
            "productId": product.product_id,
            "productType": product.product_type,
            "productName": product.name,
            "description": product.description,
            "interestRate": str(product.interest_rate),
            "minAmount": str(product.min_amount),
            "termMonths": product.term_months
        }
    }

