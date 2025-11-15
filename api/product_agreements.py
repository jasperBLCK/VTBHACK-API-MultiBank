"""
ProductAgreements API - Договоры клиентов с продуктами (депозиты, кредиты, карты)
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
from models import ProductAgreement, Product, Client, Account, BankCapital, Transaction
from services.auth_service import get_current_client

router = APIRouter(prefix="/product-agreements", tags=["7 Договоры с продуктами"])


class ProductAgreementRequest(BaseModel):
    """Запрос на открытие продукта"""
    product_id: str
    amount: float
    term_months: Optional[int] = None
    source_account_id: Optional[str] = None  # Счет для списания средств (для deposit/card)


class ProductAgreementResponse(BaseModel):
    """Ответ с договором"""
    agreement_id: str
    product_id: str
    product_name: str
    product_type: str
    amount: float
    status: str
    start_date: str
    end_date: Optional[str]
    account_number: Optional[str]


@router.get("", summary="Получить договоры")
async def get_agreements(
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить список договоров клиента
    
    Возвращает все активные договоры с продуктами (депозиты, кредиты, карты)
    """
    # Найти клиента
    result = await db.execute(
        select(Client).where(Client.person_id == current_client["client_id"])
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Получить договоры
    agreements_result = await db.execute(
        select(ProductAgreement, Product)
        .join(Product, ProductAgreement.product_id == Product.id)
        .where(ProductAgreement.client_id == client.id)
        .order_by(ProductAgreement.created_at.desc())
    )
    
    agreements_data = agreements_result.all()
    
    # Получить связанные счета
    agreements_list = []
    for agreement, product in agreements_data:
        account_number = None
        if agreement.account_id:
            account_result = await db.execute(
                select(Account).where(Account.id == agreement.account_id)
            )
            account = account_result.scalar_one_or_none()
            if account:
                account_number = account.account_number
        
        agreements_list.append({
            "agreement_id": agreement.agreement_id,
            "product_id": product.product_id,
            "product_name": product.name,
            "product_type": product.product_type,
            "amount": float(agreement.amount),
            "status": agreement.status,
            "start_date": agreement.start_date.isoformat(),
            "end_date": agreement.end_date.isoformat() if agreement.end_date else None,
            "account_number": account_number
        })
    
    return {
        "data": agreements_list,
        "meta": {
            "total": len(agreements_list)
        }
    }


@router.post("", summary="Создать договор")
async def create_agreement(
    request: ProductAgreementRequest,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Открыть договор с продуктом (депозит, кредит, карта)
    
    - Депозит: создается счет, деньги списываются с основного счета
    - Кредит: проверяется капитал банка, создается счет с кредитными средствами
    - Карта: создается счет с лимитом
    """
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
        raise HTTPException(404, "Product not found")
    
    if not product.is_active:
        raise HTTPException(400, "Product is not active")
    
    # Проверить минимальную сумму
    if product.min_amount and Decimal(str(request.amount)) < product.min_amount:
        raise HTTPException(400, f"Amount must be at least {product.min_amount}")
    
    # Проверить максимальную сумму
    if product.max_amount and Decimal(str(request.amount)) > product.max_amount:
        raise HTTPException(400, f"Amount must not exceed {product.max_amount}")
    
    # Создать договор
    agreement_id = f"agr-{uuid.uuid4().hex[:12]}"
    
    # Определить дату окончания
    end_date = None
    if request.term_months:
        end_date = datetime.utcnow() + timedelta(days=request.term_months * 30)
    elif product.term_months:
        end_date = datetime.utcnow() + timedelta(days=product.term_months * 30)
    
    # Обработка в зависимости от типа продукта
    account_id = None
    
    if product.product_type == "deposit":
        # Депозит: ТРЕБУЕТСЯ пополнение из существующего счета
        if not request.source_account_id:
            raise HTTPException(400, "Deposit requires source_account_id for funding")
        
        # Депозит: создать счет депозита
        account_number = f"423{uuid.uuid4().hex[:15]}"  # 42 - депозит
        
        # Списать средства со source account
        if True:  # Always true now
            source_acc_id = int(request.source_account_id.replace("acc-", ""))
            source_acc_result = await db.execute(
                select(Account).where(Account.id == source_acc_id, Account.client_id == client.id)
            )
            source_account = source_acc_result.scalar_one_or_none()
            
            if not source_account:
                raise HTTPException(404, "Source account not found")
            
            if source_account.balance < Decimal(str(request.amount)):
                raise HTTPException(400, f"Insufficient funds. Available: {source_account.balance}, Required: {request.amount}")
            
            # Списать со source account
            source_account.balance -= Decimal(str(request.amount))
            
            # Создать транзакцию списания
            debit_tx = Transaction(
                account_id=source_account.id,
                transaction_id=f"tx-{uuid.uuid4().hex[:12]}",
                amount=Decimal(str(request.amount)),
                direction="debit",
                counterparty=f"Открытие депозита {product.name}",
                description=f"Пополнение депозита {account_number}"
            )
            db.add(debit_tx)
        
        deposit_account = Account(
            client_id=client.id,
            account_number=account_number,
            account_type="deposit",
            balance=Decimal(str(request.amount)),
            status="active"
        )
        db.add(deposit_account)
        await db.flush()
        account_id = deposit_account.id
        
        # Создать транзакцию зачисления на депозит
        credit_tx = Transaction(
            account_id=deposit_account.id,
            transaction_id=f"tx-{uuid.uuid4().hex[:12]}",
            amount=Decimal(str(request.amount)),
            direction="credit",
            counterparty="Начальное пополнение",
            description=f"Открытие депозита{' из счета ' + request.source_account_id if request.source_account_id else ''}"
        )
        db.add(credit_tx)
        
    elif product.product_type == "loan":
        # Кредит: проверить капитал банка
        from config import config
        capital_result = await db.execute(
            select(BankCapital).where(BankCapital.bank_code == config.BANK_CODE)
        )
        capital = capital_result.scalar_one_or_none()
        
        if capital and capital.capital < Decimal(str(request.amount)):
            raise HTTPException(400, "Insufficient bank capital for loan")
        
        # Создать кредитный счет
        account_number = f"455{uuid.uuid4().hex[:15]}"  # 45 - кредит
        
        loan_account = Account(
            client_id=client.id,
            account_number=account_number,
            account_type="loan",
            balance=Decimal(str(request.amount)),
            status="active"
        )
        db.add(loan_account)
        await db.flush()
        account_id = loan_account.id
        
        # Уменьшить капитал банка
        if capital:
            capital.capital -= Decimal(str(request.amount))
            capital.total_loans += Decimal(str(request.amount))
        
    elif product.product_type == "card":
        # Карта: ТРЕБУЕТСЯ пополнение из существующего счета (если amount > 0)
        if request.amount > 0 and not request.source_account_id:
            raise HTTPException(400, "Card funding requires source_account_id")
        
        # Карта: создать карточный счет
        account_number = f"408{uuid.uuid4().hex[:15]}"  # 408 - карта
        
        # Пополнить карту если указана сумма
        initial_balance = Decimal("0")
        if request.source_account_id and request.amount > 0:
            source_acc_id = int(request.source_account_id.replace("acc-", ""))
            source_acc_result = await db.execute(
                select(Account).where(Account.id == source_acc_id, Account.client_id == client.id)
            )
            source_account = source_acc_result.scalar_one_or_none()
            
            if not source_account:
                raise HTTPException(404, "Source account not found")
            
            if source_account.balance < Decimal(str(request.amount)):
                raise HTTPException(400, f"Insufficient funds. Available: {source_account.balance}, Required: {request.amount}")
            
            # Списать со source account
            source_account.balance -= Decimal(str(request.amount))
            
            # Создать транзакцию списания
            debit_tx = Transaction(
                account_id=source_account.id,
                transaction_id=f"tx-{uuid.uuid4().hex[:12]}",
                amount=Decimal(str(request.amount)),
                direction="debit",
                counterparty=f"Пополнение карты {product.name}",
                description=f"Пополнение карты {account_number}"
            )
            db.add(debit_tx)
            
            initial_balance = Decimal(str(request.amount))
        
        card_account = Account(
            client_id=client.id,
            account_number=account_number,
            account_type="card",
            balance=initial_balance,
            status="active"
        )
        db.add(card_account)
        await db.flush()
        account_id = card_account.id
        
        # Создать транзакцию зачисления на карту (если было пополнение)
        if initial_balance > 0:
            credit_tx = Transaction(
                account_id=card_account.id,
                transaction_id=f"tx-{uuid.uuid4().hex[:12]}",
                amount=initial_balance,
                direction="credit",
                counterparty="Начальное пополнение",
                description=f"Пополнение карты{' из счета ' + request.source_account_id if request.source_account_id else ''}"
            )
            db.add(credit_tx)
    
    # Создать договор
    agreement = ProductAgreement(
        agreement_id=agreement_id,
        client_id=client.id,
        product_id=product.id,
        account_id=account_id,
        amount=Decimal(str(request.amount)),
        status="active",
        start_date=datetime.utcnow(),
        end_date=end_date
    )
    
    db.add(agreement)
    await db.commit()
    await db.refresh(agreement)
    
    # Получить номер счета
    account_number = None
    if account_id:
        account_result = await db.execute(
            select(Account).where(Account.id == account_id)
        )
        account = account_result.scalar_one_or_none()
        if account:
            account_number = account.account_number
    
    return {
        "data": {
            "agreement_id": agreement.agreement_id,
            "product_id": product.product_id,
            "product_name": product.name,
            "product_type": product.product_type,
            "amount": float(agreement.amount),
            "status": agreement.status,
            "start_date": agreement.start_date.isoformat(),
            "end_date": agreement.end_date.isoformat() if agreement.end_date else None,
            "account_number": account_number
        },
        "meta": {
            "message": "Agreement created successfully"
        }
    }


@router.get("/{agreement_id}", summary="Получить договор")
async def get_agreement(
    agreement_id: str,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить детали договора
    """
    # Найти клиента
    result = await db.execute(
        select(Client).where(Client.person_id == current_client["client_id"])
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Найти договор
    agreement_result = await db.execute(
        select(ProductAgreement, Product)
        .join(Product, ProductAgreement.product_id == Product.id)
        .where(
            ProductAgreement.agreement_id == agreement_id,
            ProductAgreement.client_id == client.id
        )
    )
    
    agreement_data = agreement_result.first()
    
    if not agreement_data:
        raise HTTPException(404, "Agreement not found")
    
    agreement, product = agreement_data
    
    # Получить счет
    account_number = None
    account_balance = None
    if agreement.account_id:
        account_result = await db.execute(
            select(Account).where(Account.id == agreement.account_id)
        )
        account = account_result.scalar_one_or_none()
        if account:
            account_number = account.account_number
            account_balance = float(account.balance)
    
    return {
        "data": {
            "agreement_id": agreement.agreement_id,
            "product_id": product.product_id,
            "product_name": product.name,
            "product_type": product.product_type,
            "interest_rate": float(product.interest_rate) if product.interest_rate else None,
            "amount": float(agreement.amount),
            "status": agreement.status,
            "start_date": agreement.start_date.isoformat(),
            "end_date": agreement.end_date.isoformat() if agreement.end_date else None,
            "account_number": account_number,
            "account_balance": account_balance
        }
    }


class CloseAgreementRequest(BaseModel):
    """Запрос на закрытие договора с погашением"""
    repayment_account_id: Optional[str] = None
    repayment_amount: Optional[float] = None


@router.delete("/{agreement_id}", summary="Закрыть договор")
async def close_agreement(
    agreement_id: str,
    request: Optional[CloseAgreementRequest] = None,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Закрыть договор
    
    - Депозит: закрыть счет
    - Кредит: погасить задолженность из указанного счета
    - Карта: заблокировать
    """
    # Найти клиента
    result = await db.execute(
        select(Client).where(Client.person_id == current_client["client_id"])
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Найти договор с продуктом
    agreement_result = await db.execute(
        select(ProductAgreement, Product)
        .join(Product, ProductAgreement.product_id == Product.id)
        .where(
            ProductAgreement.agreement_id == agreement_id,
            ProductAgreement.client_id == client.id
        )
    )
    
    agreement_data = agreement_result.first()
    
    if not agreement_data:
        raise HTTPException(404, "Agreement not found")
    
    agreement, product = agreement_data
    
    if agreement.status == "closed":
        raise HTTPException(400, "Agreement already closed")
    
    # Получить связанный счет
    loan_account = None
    if agreement.account_id:
        account_result = await db.execute(
            select(Account).where(Account.id == agreement.account_id)
        )
        loan_account = account_result.scalar_one_or_none()
    
    # Если это кредит с задолженностью - требуется погашение
    if product.product_type == "loan" and loan_account and loan_account.balance > 0:
        if not request or not request.repayment_account_id:
            raise HTTPException(400, f"Loan has debt of {loan_account.balance}. Repayment required. Provide repayment_account_id.")
        
        # Получить счет для погашения
        repay_acc_id = int(request.repayment_account_id.replace("acc-", ""))
        repay_result = await db.execute(
            select(Account).where(Account.id == repay_acc_id, Account.client_id == client.id)
        )
        repayment_account = repay_result.scalar_one_or_none()
        
        if not repayment_account:
            raise HTTPException(404, "Repayment account not found")
        
        debt = loan_account.balance
        
        if repayment_account.balance < debt:
            raise HTTPException(400, f"Insufficient funds for repayment. Available: {repayment_account.balance}, Required: {debt}")
        
        # Погасить кредит
        repayment_account.balance -= debt
        loan_account.balance = Decimal("0")
        
        # Создать транзакции
        debit_tx = Transaction(
            account_id=repayment_account.id,
            transaction_id=f"tx-{uuid.uuid4().hex[:12]}",
            amount=debt,
            direction="debit",
            counterparty="Погашение кредита",
            description=f"Погашение кредита {product.name}"
        )
        db.add(debit_tx)
        
        credit_tx = Transaction(
            account_id=loan_account.id,
            transaction_id=f"tx-{uuid.uuid4().hex[:12]}",
            amount=debt,
            direction="credit",
            counterparty="Погашение",
            description=f"Погашение кредита из счета {repayment_account.account_number}"
        )
        db.add(credit_tx)
        
        # Увеличить капитал банка (вернуть выданный кредит)
        from config import config
        capital_result = await db.execute(
            select(BankCapital).where(BankCapital.bank_code == config.BANK_CODE)
        )
        capital = capital_result.scalar_one_or_none()
        if capital:
            capital.capital += debt
            capital.total_loans -= debt
    
    # Закрыть договор
    agreement.status = "closed"
    
    # Закрыть связанный счет
    if loan_account:
        loan_account.status = "closed"
    
    await db.commit()
    
    return {
        "data": {
            "agreement_id": agreement.agreement_id,
            "status": "closed",
            "repaid": float(loan_account.balance) if loan_account and product.product_type == "loan" else 0
        },
        "meta": {
            "message": "Agreement closed successfully"
        }
    }

