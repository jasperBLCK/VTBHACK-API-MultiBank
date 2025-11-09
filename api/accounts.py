"""
Accounts API - Получение информации о счетах клиента
OpenBanking Russia v2.1 compatible
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from decimal import Decimal
import uuid

from database import get_db
from models import Account, Client, Transaction, BankCapital
from services.auth_service import get_current_client, get_optional_client
from services.consent_service import ConsentService


router = APIRouter(prefix="/accounts", tags=["2 Счета и балансы"])


@router.get("", summary="Получить счета")
async def get_accounts(
    client_id: Optional[str] = None,
    x_consent_id: Optional[str] = Header(None, alias="x-consent-id"),
    x_requesting_bank: Optional[str] = Header(None, alias="x-requesting-bank"),
    current_client: Optional[dict] = Depends(get_optional_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Получение списка счетов
    
    Для собственного клиента: используется JWT токен
    Для межбанковского запроса: требуется consent_id и bank token
    """
    
    # Определяем, чей это запрос
    if x_requesting_bank:
        # Межбанковский запрос - требуется согласие
        if not client_id:
            raise HTTPException(400, "client_id required for interbank requests")
        
        # Проверить согласие
        consent = await ConsentService.check_consent(
            db=db,
            client_person_id=client_id,
            requesting_bank=x_requesting_bank,
            permissions=["ReadAccountsDetail"]
        )
        
        if not consent:
            raise HTTPException(
                403,
                detail={
                    "error": "CONSENT_REQUIRED",
                    "message": "Требуется согласие клиента",
                    "consent_request_url": f"/account-consents/request"
                }
            )
        
        target_client_id = client_id
        
    else:
        # Запрос собственного клиента
        if not current_client:
            raise HTTPException(401, "Unauthorized")
        target_client_id = current_client["client_id"]
    
    # Получаем клиента для имени
    client_result = await db.execute(
        select(Client).where(Client.person_id == target_client_id)
    )
    client = client_result.scalar_one_or_none()
    client_name = client.full_name if client else ""
    
    # Получаем счета
    result = await db.execute(
        select(Account)
        .join(Client)
        .where(Client.person_id == target_client_id)
        .where(Account.status == "active")
    )
    accounts = result.scalars().all()
    
    # Логирование для отладки
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Запрос счетов для client_id={target_client_id}, найдено счетов: {len(accounts)}")
    for acc in accounts:
        logger.info(f"  - Счет ID={acc.id}, номер={acc.account_number}, баланс={acc.balance}")
    
    # Формируем ответ в формате OpenBanking Russia
    return {
        "data": {
            "account": [
                {
                    "accountId": f"acc-{acc.id}",
                    "status": "Enabled" if acc.status == "active" else "Disabled",
                    "currency": acc.currency,
                    "accountType": "Personal" if acc.account_type == "checking" else "Business",
                    "accountSubType": acc.account_type.title(),
                    "nickname": f"{acc.account_type.title()} счет",
                    "openingDate": acc.opened_at.date().isoformat(),
                    "account": [
                        {
                            "schemeName": "RU.CBR.PAN",
                            "identification": acc.account_number,
                            "name": client_name
                        }
                    ]
                }
                for acc in accounts
            ]
        },
        "links": {
            "self": "/accounts"
        },
        "meta": {
            "totalPages": 1
        }
    }


@router.get("/{account_id}", summary="Получить счет")
async def get_account(
    account_id: str,
    x_consent_id: Optional[str] = Header(None, alias="x-consent-id"),
    current_client: Optional[dict] = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """Получение детальной информации о счете"""
    
    # Извлекаем ID из строки "acc-123"
    acc_id = int(account_id.replace("acc-", ""))
    
    result = await db.execute(
        select(Account).where(Account.id == acc_id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(404, "Account not found")
    
    # TODO: Проверить права доступа
    
    return {
        "data": {
            "account": [
                {
                    "accountId": f"acc-{account.id}",
                    "status": "Enabled",
                    "currency": account.currency,
                    "accountType": "Personal",
                    "accountSubType": account.account_type.title(),
                    "description": f"{account.account_type} account",
                    "nickname": f"{account.account_type.title()} счет",
                    "openingDate": account.opened_at.date().isoformat()
                }
            ]
        }
    }


@router.get("/{account_id}/balances", summary="Получить балансы")
async def get_balances(
    account_id: str,
    x_consent_id: Optional[str] = Header(None, alias="x-consent-id"),
    current_client: Optional[dict] = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """Получение баланса счета"""
    
    acc_id = int(account_id.replace("acc-", ""))
    
    result = await db.execute(
        select(Account).where(Account.id == acc_id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(404, "Account not found")
    
    # Логирование для отладки
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Запрос баланса для account_id={account_id} (ID={acc_id}), номер={account.account_number}, баланс={account.balance}")
    
    return {
        "data": {
            "balance": [
                {
                    "accountId": f"acc-{account.id}",
                    "type": "InterimAvailable",
                    "dateTime": datetime.utcnow().isoformat() + "Z",
                    "amount": {
                        "amount": str(account.balance),
                        "currency": account.currency
                    },
                    "creditDebitIndicator": "Credit"
                },
                {
                    "accountId": f"acc-{account.id}",
                    "type": "InterimBooked",
                    "dateTime": datetime.utcnow().isoformat() + "Z",
                    "amount": {
                        "amount": str(account.balance),
                        "currency": account.currency
                    },
                    "creditDebitIndicator": "Credit"
                }
            ]
        }
    }


@router.get("/{account_id}/transactions", summary="Получить транзакции")
async def get_transactions(
    account_id: str,
    from_booking_date_time: Optional[str] = None,
    to_booking_date_time: Optional[str] = None,
    x_consent_id: Optional[str] = Header(None, alias="x-consent-id"),
    current_client: Optional[dict] = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """Получение списка транзакций по счету"""
    
    acc_id = int(account_id.replace("acc-", ""))
    
    query = select(Transaction).where(Transaction.account_id == acc_id)
    
    # Фильтры по датам (опционально)
    if from_booking_date_time:
        # TODO: parse date
        pass
    
    result = await db.execute(query.order_by(Transaction.transaction_date.desc()).limit(50))
    transactions = result.scalars().all()
    
    return {
        "data": {
            "transaction": [
                {
                    "accountId": f"acc-{acc_id}",
                    "transactionId": tx.transaction_id,
                    "amount": {
                        "amount": str(abs(tx.amount)),
                        "currency": "RUB"
                    },
                    "creditDebitIndicator": "Credit" if tx.direction == "credit" else "Debit",
                    "status": "Booked",
                    "bookingDateTime": tx.transaction_date.isoformat() + "Z",
                    "valueDateTime": tx.transaction_date.isoformat() + "Z",
                    "transactionInformation": tx.description or "",
                    "bankTransactionCode": {
                        "code": "ReceivedCreditTransfer" if tx.direction == "credit" else "IssuedDebitTransfer"
                    }
                }
                for tx in transactions
            ]
        },
        "links": {
            "self": f"/accounts/{account_id}/transactions"
        }
    }


class CreateAccountRequest(BaseModel):
    """Запрос на создание нового счета"""
    account_type: str
    initial_balance: float = 0


class AccountStatusUpdate(BaseModel):
    """Обновление статуса счета"""
    status: str


class AccountCloseRequest(BaseModel):
    """Запрос на закрытие счета с переводом остатка"""
    action: str  # "transfer" или "donate"
    destination_account_id: Optional[str] = None  # Для action=transfer


@router.post("", summary="Создать счет", include_in_schema=False)
async def create_account(
    request: CreateAccountRequest,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Создание нового счета
    
    Поддерживаемые типы: checking, savings
    """
    # Найти клиента
    result = await db.execute(
        select(Client).where(Client.person_id == current_client["client_id"])
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Валидация типа счета
    valid_types = ["checking", "savings"]
    if request.account_type not in valid_types:
        raise HTTPException(400, f"Invalid account type. Must be one of: {', '.join(valid_types)}")
    
    # Генерация номера счета
    # 408 - текущий счет, 42301 - сберегательный
    if request.account_type == "checking":
        account_prefix = "408"
    elif request.account_type == "savings":
        account_prefix = "42301"
    else:
        account_prefix = "408"
    
    account_number = f"{account_prefix}{uuid.uuid4().hex[:15]}"
    
    # Создать счет
    new_account = Account(
        client_id=client.id,
        account_number=account_number,
        account_type=request.account_type,
        balance=Decimal(str(request.initial_balance)),
        currency="RUB",
        status="active"
    )
    
    db.add(new_account)
    await db.commit()
    await db.refresh(new_account)
    
    # Если начальный баланс > 0, создать транзакцию
    if request.initial_balance > 0:
        initial_tx = Transaction(
            account_id=new_account.id,
            transaction_id=f"tx-{uuid.uuid4().hex[:12]}",
            amount=Decimal(str(request.initial_balance)),
            direction="credit",
            counterparty="Начальное пополнение",
            description="Начальный баланс при открытии счета"
        )
        db.add(initial_tx)
        await db.commit()
    
    return {
        "data": {
            "accountId": f"acc-{new_account.id}",
            "account_number": new_account.account_number,
            "account_type": new_account.account_type,
            "balance": float(new_account.balance),
            "status": new_account.status
        },
        "meta": {
            "message": "Account created successfully"
        }
    }


@router.put("/{account_id}/status", summary="Изменить статус счета", include_in_schema=False)
async def update_account_status(
    account_id: str,
    request: AccountStatusUpdate,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Изменение статуса счета (закрытие)
    
    Допустимые статусы: active, closed
    """
    # Извлечь ID
    acc_id = int(account_id.replace("acc-", ""))
    
    # Найти счет
    result = await db.execute(
        select(Account, Client)
        .join(Client, Account.client_id == Client.id)
        .where(Account.id == acc_id)
    )
    account_data = result.first()
    
    if not account_data:
        raise HTTPException(404, "Account not found")
    
    account, client = account_data
    
    # Проверить что это счет текущего клиента
    if client.person_id != current_client["client_id"]:
        raise HTTPException(403, "Access denied")
    
    # Проверить валидность статуса
    valid_statuses = ["active", "closed"]
    if request.status not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    
    # Обновить статус
    account.status = request.status
    await db.commit()
    
    return {
        "data": {
            "accountId": f"acc-{account.id}",
            "account_number": account.account_number,
            "status": account.status
        },
        "meta": {
            "message": f"Account status updated to {request.status}"
        }
    }


@router.put("/{account_id}/close", summary="Закрыть счет", include_in_schema=False)
async def close_account_with_balance(
    account_id: str,
    request: AccountCloseRequest,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Закрытие счета с переводом остатка или дарением банку
    
    Actions:
    - transfer: перевести остаток на другой счет
    - donate: подарить остаток банку (увеличить capital)
    """
    # Извлечь ID
    acc_id = int(account_id.replace("acc-", ""))
    
    # Найти счет
    result = await db.execute(
        select(Account, Client)
        .join(Client, Account.client_id == Client.id)
        .where(Account.id == acc_id)
    )
    account_data = result.first()
    
    if not account_data:
        raise HTTPException(404, "Account not found")
    
    account, client = account_data
    
    # Проверить что это счет текущего клиента
    if client.person_id != current_client["client_id"]:
        raise HTTPException(403, "Access denied")
    
    balance = account.balance
    
    if request.action == "transfer":
        # Перевести остаток на другой счет
        if not request.destination_account_id:
            raise HTTPException(400, "destination_account_id required for transfer action")
        
        dest_acc_id = int(request.destination_account_id.replace("acc-", ""))
        dest_result = await db.execute(
            select(Account).where(Account.id == dest_acc_id, Account.client_id == client.id)
        )
        dest_account = dest_result.scalar_one_or_none()
        
        if not dest_account:
            raise HTTPException(404, "Destination account not found")
        
        # Перевести средства
        dest_account.balance += balance
        account.balance = Decimal("0")
        
        # Создать транзакции
        debit_tx = Transaction(
            account_id=account.id,
            transaction_id=f"tx-{uuid.uuid4().hex[:12]}",
            amount=balance,
            direction="debit",
            counterparty="Закрытие счета",
            description=f"Перевод на {dest_account.account_number} при закрытии"
        )
        db.add(debit_tx)
        
        credit_tx = Transaction(
            account_id=dest_account.id,
            transaction_id=f"tx-{uuid.uuid4().hex[:12]}",
            amount=balance,
            direction="credit",
            counterparty="Пополнение",
            description=f"Перевод с {account.account_number} (закрытие счета)"
        )
        db.add(credit_tx)
        
    elif request.action == "donate":
        # Подарить банку (увеличить capital)
        from config import config
        
        capital_result = await db.execute(
            select(BankCapital).where(BankCapital.bank_code == config.BANK_CODE)
        )
        capital = capital_result.scalar_one_or_none()
        
        if capital:
            capital.capital += balance
        
        # Создать транзакцию списания
        donate_tx = Transaction(
            account_id=account.id,
            transaction_id=f"tx-{uuid.uuid4().hex[:12]}",
            amount=balance,
            direction="debit",
            counterparty="Дар банку",
            description="Дарение средств банку при закрытии счета"
        )
        db.add(donate_tx)
        
        account.balance = Decimal("0")
    
    else:
        raise HTTPException(400, f"Invalid action: {request.action}")
    
    # Закрыть счет
    account.status = "closed"
    await db.commit()
    
    return {
        "data": {
            "accountId": f"acc-{account.id}",
            "account_number": account.account_number,
            "status": "closed",
            "action": request.action,
            "amount_transferred": float(balance)
        },
        "meta": {
            "message": f"Account closed with {request.action} action"
        }
    }


@router.delete("/{account_id}", status_code=204, summary="Удалить счет")
async def delete_account(
    account_id: str,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    """
    Удаление счета клиента
    Возвращает 204 No Content при успехе
    """
    # Извлекаем ID из строки "acc-123" или просто число
    if account_id.startswith("acc-"):
        acc_id = int(account_id.replace("acc-", ""))
    else:
        acc_id = int(account_id)
    
    # Получаем клиента
    client_result = await db.execute(
        select(Client).where(Client.person_id == current_client["client_id"])
    )
    client = client_result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(401, "Unauthorized")
    
    # Получаем счет
    result = await db.execute(
        select(Account).where(
            and_(Account.id == acc_id, Account.client_id == client.id)
        )
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(404, "Account not found")
    
    # Логируем удаление
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Удаление счета ID={acc_id} для client_id={current_client['client_id']}")
    
    # Удаляем счет из БД
    await db.delete(account)
    await db.commit()
    
    return None

