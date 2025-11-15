"""
Product Applications API - Заявки на банковские продукты
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
import json

from database import get_db
from models import ProductApplication, Product, Client
from services.auth_service import get_current_client

router = APIRouter(
    prefix="/product-application", 
    tags=["10 OpenBanking: Product Applications"],
    include_in_schema=False  # Скрыто из публичной документации
)


# === Pydantic Models ===

class ProductApplicationRequest(BaseModel):
    """Запрос на подачу заявки"""
    product_id: str
    requested_amount: float
    requested_term_months: Optional[int] = None
    application_data: Optional[dict] = None  # доп. данные (доход, стаж, и т.д.)


class ProductApplicationResponse(BaseModel):
    """Ответ с данными заявки"""
    application_id: str
    client_id: str
    product_id: str
    product_name: str
    requested_amount: float
    requested_term_months: Optional[int]
    status: str
    decision: Optional[str]
    decision_reason: Optional[str]
    approved_amount: Optional[float]
    approved_rate: Optional[float]
    submitted_at: str
    reviewed_at: Optional[str]
    decision_at: Optional[str]


# === Endpoints ===

@router.post("", status_code=201)
async def create_product_application(
    request: ProductApplicationRequest,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    ## 📝 Подача заявки на банковский продукт
    
    **OpenBanking Russia Products API v1.3.1 - четвертый шаг продуктовой воронки**
    
    ### Продуктовая воронка:
    1. ✅ Каталог → `GET /products` (выбрать продукт)
    2. ✅ Лид → `POST /customer-leads` (оставить контакты)
    3. ✅ Предложение → `GET /product-offers` (получить персональное предложение)
    4. **👉 Заявка → `POST /product-application` (ВЫ ЗДЕСЬ)**
    5. ⏭️ Договор → `POST /product-agreements` (после одобрения)
    
    ### Когда использовать:
    - Клиент готов оформить продукт
    - Нужна формальная заявка с документами
    - Требуется проверка платежеспособности
    
    ### Пример запроса:
    ```json
    {
      "product_id": "prod-vb-loan-002",
      "requested_amount": 500000.0,
      "requested_term_months": 36,
      "application_data": {
        "monthly_income": 80000,
        "employment_type": "permanent",
        "work_experience_months": 48,
        "has_collateral": false
      }
    }
    ```
    
    ### Жизненный цикл заявки:
    
    **1. Подача заявки (клиент)**
    - Статус: `pending`
    - Заявка отправлена в банк
    
    **2. Рассмотрение (банкир через Banker API)**
    - Статус: `under_review`
    - Проверка данных, скоринг
    
    **3. Решение (автоматическое или банкиром)**
    - Одобрено: `approved` → можно создать договор
    - Отклонено: `rejected` → указана причина
    
    ### Автоматическое одобрение (sandbox):
    В sandbox заявки могут одобряться автоматически при выполнении условий:
    - Сумма в пределах лимитов продукта
    - Клиент имеет достаточно средств (для депозитов)
    - Нет активных просрочек
    
    ### Проверка статуса:
    ```bash
    GET /product-application/{application_id}
    ```
    
    ### ⚠️ Важно:
    - Одна заявка на один продукт в один момент времени
    - Для изменения заявки нужно удалить старую и создать новую
    - После одобрения используйте `POST /product-agreements` для активации
    
    ### Следующий шаг после одобрения:
    ```bash
    POST /product-agreements
    {
      "product_id": "prod-vb-loan-002",
      "source_account_id": "acc-123",  # для пополнения
      "amount": 500000.0,
      "term_months": 36
    }
    ```
    """
    if not current_client:
        raise HTTPException(401, "Unauthorized")
    
    # Найти клиента
    result = await db.execute(
        select(Client).where(Client.person_id == current_client["client_id"])
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Найти продукт
    product_result = await db.execute(
        select(Product).where(Product.product_id == request.product_id)
    )
    product = product_result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(404, f"Product {request.product_id} not found")
    
    if not product.is_active:
        raise HTTPException(400, "Product is not available")
    
    # Проверить минимальную сумму
    if product.min_amount and Decimal(str(request.requested_amount)) < product.min_amount:
        raise HTTPException(
            400, 
            f"Requested amount must be at least {product.min_amount}"
        )
    
    # Проверить максимальную сумму
    if product.max_amount and Decimal(str(request.requested_amount)) > product.max_amount:
        raise HTTPException(
            400, 
            f"Requested amount must not exceed {product.max_amount}"
        )
    
    # Создать заявку
    application_id = f"app-{uuid.uuid4().hex[:12]}"
    
    application = ProductApplication(
        application_id=application_id,
        client_id=client.id,
        product_id=product.id,
        requested_amount=Decimal(str(request.requested_amount)),
        requested_term_months=request.requested_term_months or product.term_months,
        status="pending",
        application_data=json.dumps(request.application_data) if request.application_data else None,
        submitted_at=datetime.utcnow()
    )
    
    db.add(application)
    await db.commit()
    await db.refresh(application)
    
    return {
        "data": {
            "application_id": application.application_id,
            "client_id": client.person_id,
            "product_id": product.product_id,
            "product_name": product.name,
            "requested_amount": float(application.requested_amount),
            "requested_term_months": application.requested_term_months,
            "status": application.status,
            "submitted_at": application.submitted_at.isoformat() + "Z"
        },
        "links": {
            "self": f"/product-application/{application.application_id}"
        },
        "meta": {
            "message": "Application submitted successfully. It will be reviewed by bank."
        }
    }


@router.get("")
async def get_product_applications(
    status: Optional[str] = None,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить список заявок клиента
    
    OpenBanking Russia Products API v1.3.1
    GET /product-application
    
    Query params:
    - status: фильтр по статусу (pending, approved, rejected, cancelled)
    """
    if not current_client:
        raise HTTPException(401, "Unauthorized")
    
    # Найти клиента
    result = await db.execute(
        select(Client).where(Client.person_id == current_client["client_id"])
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Получить заявки
    query = select(ProductApplication, Product).join(
        Product, ProductApplication.product_id == Product.id
    ).where(
        ProductApplication.client_id == client.id
    )
    
    if status:
        query = query.where(ProductApplication.status == status)
    
    query = query.order_by(ProductApplication.submitted_at.desc())
    
    result = await db.execute(query)
    applications_data = result.all()
    
    applications_list = []
    for application, product in applications_data:
        app_data = {
            "application_id": application.application_id,
            "product_id": product.product_id,
            "product_name": product.name,
            "product_type": product.product_type,
            "requested_amount": float(application.requested_amount),
            "requested_term_months": application.requested_term_months,
            "status": application.status,
            "submitted_at": application.submitted_at.isoformat() + "Z"
        }
        
        # Добавить решение банка если есть
        if application.decision:
            app_data["decision"] = application.decision
            app_data["decision_reason"] = application.decision_reason
            app_data["approved_amount"] = float(application.approved_amount) if application.approved_amount else None
            app_data["approved_rate"] = float(application.approved_rate) if application.approved_rate else None
            app_data["decision_at"] = application.decision_at.isoformat() + "Z" if application.decision_at else None
        
        applications_list.append(app_data)
    
    return {
        "data": {
            "applications": applications_list
        },
        "meta": {
            "total": len(applications_list)
        }
    }


@router.get("/{application_id}")
async def get_product_application(
    application_id: str,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить детали заявки
    
    OpenBanking Russia Products API v1.3.1
    GET /product-applications/{productApplicationId}
    """
    if not current_client:
        raise HTTPException(401, "Unauthorized")
    
    # Найти клиента
    result = await db.execute(
        select(Client).where(Client.person_id == current_client["client_id"])
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Найти заявку
    app_result = await db.execute(
        select(ProductApplication, Product).join(
            Product, ProductApplication.product_id == Product.id
        ).where(
            ProductApplication.application_id == application_id,
            ProductApplication.client_id == client.id
        )
    )
    
    app_data = app_result.first()
    
    if not app_data:
        raise HTTPException(404, "Application not found")
    
    application, product = app_data
    
    response_data = {
        "application_id": application.application_id,
        "client_id": client.person_id,
        "product_id": product.product_id,
        "product_name": product.name,
        "product_type": product.product_type,
        "product_interest_rate": float(product.interest_rate) if product.interest_rate else None,
        "requested_amount": float(application.requested_amount),
        "requested_term_months": application.requested_term_months,
        "status": application.status,
        "submitted_at": application.submitted_at.isoformat() + "Z"
    }
    
    # Добавить application_data если есть
    if application.application_data:
        try:
            response_data["application_data"] = json.loads(application.application_data)
        except:
            pass
    
    # Добавить решение банка если есть
    if application.decision:
        response_data.update({
            "decision": application.decision,
            "decision_reason": application.decision_reason,
            "approved_amount": float(application.approved_amount) if application.approved_amount else None,
            "approved_rate": float(application.approved_rate) if application.approved_rate else None,
            "reviewed_at": application.reviewed_at.isoformat() + "Z" if application.reviewed_at else None,
            "decision_at": application.decision_at.isoformat() + "Z" if application.decision_at else None
        })
    
    return {
        "data": response_data,
        "links": {
            "self": f"/product-application/{application_id}"
        }
    }


@router.delete("/{application_id}")
async def delete_product_application(
    application_id: str,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Отозвать заявку
    
    OpenBanking Russia Products API v1.3.1
    DELETE /product-applications/{productApplicationId}
    
    Клиент может отозвать заявку только если она в статусе 'pending'
    """
    if not current_client:
        raise HTTPException(401, "Unauthorized")
    
    # Найти клиента
    result = await db.execute(
        select(Client).where(Client.person_id == current_client["client_id"])
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Найти заявку
    app_result = await db.execute(
        select(ProductApplication).where(
            ProductApplication.application_id == application_id,
            ProductApplication.client_id == client.id
        )
    )
    
    application = app_result.scalar_one_or_none()
    
    if not application:
        raise HTTPException(404, "Application not found")
    
    # Проверить статус
    if application.status not in ["pending", "under_review"]:
        raise HTTPException(
            400, 
            f"Cannot cancel application with status '{application.status}'"
        )
    
    # Отменить заявку
    application.status = "cancelled"
    application.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "data": {
            "application_id": application.application_id,
            "status": "cancelled"
        },
        "meta": {
            "message": "Application cancelled successfully"
        }
    }

