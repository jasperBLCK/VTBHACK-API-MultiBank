"""
Payment Service - логика переводов
Iteration 3 + Межбанковские переводы (реализовано)
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from decimal import Decimal
from datetime import datetime
from typing import Optional, Tuple
import uuid
import httpx
import logging

from models import Account, Payment, InterbankTransfer, BankCapital, Client, Transaction
from config import config

logger = logging.getLogger(__name__)


class PaymentService:
    """Сервис для обработки платежей"""
    
    @staticmethod
    async def initiate_payment(
        db: AsyncSession,
        from_account_number: str,
        to_account_number: str,
        amount: Decimal,
        description: str = "",
        payment_consent_id: Optional[str] = None
    ) -> Tuple[Payment, Optional[InterbankTransfer]]:
        """
        Инициация платежа
        
        Returns:
            (Payment, InterbankTransfer или None)
        """
        # Найти счет отправителя
        result = await db.execute(
            select(Account).where(Account.account_number == from_account_number)
        )
        from_account = result.scalar_one_or_none()
        
        if not from_account:
            raise ValueError("Source account not found")
        
        if from_account.balance < amount:
            raise ValueError("Insufficient funds")
        
        # Создать payment
        payment_id = f"pay-{uuid.uuid4().hex[:12]}"
        
        payment = Payment(
            payment_id=payment_id,
            payment_consent_id=payment_consent_id,
            account_id=from_account.id,
            amount=amount,
            currency="RUB",
            destination_account=to_account_number,
            description=description,
            status="AcceptedSettlementInProcess"
        )
        
        # Списать со счета отправителя
        from_account.balance -= amount
        
        # Попытаться найти получателя в своем банке
        result = await db.execute(
            select(Account).where(Account.account_number == to_account_number)
        )
        to_account = result.scalar_one_or_none()
        
        interbank_transfer = None
        
        db.add(payment)
        
        if to_account:
            # Внутрибанковский перевод
            to_account.balance += amount
            payment.status = "AcceptedSettlementCompleted"
            payment.destination_bank = config.BANK_CODE
            payment.status_update_date_time = datetime.utcnow()
            
            # Создать транзакцию для отправителя (Debit - списание)
            transaction_debit = Transaction(
                account_id=from_account.id,
                transaction_type="Debit",
                amount=amount,
                balance_after=from_account.balance,
                description=f"Перевод на счет {to_account_number}: {description}",
                transaction_date=datetime.utcnow()
            )
            db.add(transaction_debit)
            
            # Создать транзакцию для получателя (Credit - зачисление)
            transaction_credit = Transaction(
                account_id=to_account.id,
                transaction_type="Credit",
                amount=amount,
                balance_after=to_account.balance,
                description=f"Перевод от счета {from_account_number}: {description}",
                transaction_date=datetime.utcnow()
            )
            db.add(transaction_credit)
            
        else:
            # ===== Межбанковский перевод (РЕАЛИЗОВАНО) =====
            
            # Определить банк получателя по номеру счета
            # В реальности это делается через БИК или банковский роутинг
            # В нашей MVP-версии: передается в creditorAccount.bank_code из API
            # Если не передано, попробуем определить автоматически (для демо)
            target_bank = await PaymentService._detect_target_bank(to_account_number)
            
            if not target_bank:
                # Счет не найден ни в каком банке - откат транзакции
                await db.rollback()
                raise ValueError(f"Target account {to_account_number} not found in any bank")
            
            # Создать запись межбанкового перевода
            transfer_id = f"transfer-{uuid.uuid4().hex[:12]}"
            interbank_transfer = InterbankTransfer(
                transfer_id=transfer_id,
                payment_id=payment_id,
                from_bank=config.BANK_CODE,
                to_bank=target_bank,
                amount=amount,
                status="processing"
            )
            db.add(interbank_transfer)
            
            # Создать транзакцию для отправителя (Debit - списание)
            transaction_debit = Transaction(
                account_id=from_account.id,
                transaction_type="Debit",
                amount=amount,
                balance_after=from_account.balance,
                description=f"Межбанковский перевод в {target_bank} на счет {to_account_number}: {description}",
                transaction_date=datetime.utcnow()
            )
            db.add(transaction_debit)
            
            # Сохранить локальные изменения (списание со счета)
            await db.commit()
            
            # Вызвать API другого банка
            try:
                success = await PaymentService._send_interbank_transfer(
                    transfer_id=transfer_id,
                    to_bank=target_bank,
                    to_account_number=to_account_number,
                    amount=amount,
                    description=description
                )
                
                if success:
                    # Перевод успешен
                    payment.status = "AcceptedSettlementCompleted"
                    payment.destination_bank = target_bank
                    interbank_transfer.status = "completed"
                    interbank_transfer.completed_at = datetime.utcnow()
                    
                    # Обновить капитал банка-отправителя (-amount)
                    await PaymentService.update_bank_capital(
                        db=db,
                        amount_change=-amount,
                        reason=f"Outgoing transfer to {target_bank}: {transfer_id}"
                    )
                    
                    logger.info(f"Interbank transfer {transfer_id} completed: {config.BANK_CODE} -> {target_bank}, {amount} RUB")
                else:
                    # Перевод не удался - откат
                    payment.status = "Rejected"
                    interbank_transfer.status = "failed"
                    
                    # Вернуть деньги отправителю
                    from_account.balance += amount
                    
                    # Создать корректирующую транзакцию (возврат)
                    transaction_refund = Transaction(
                        account_id=from_account.id,
                        transaction_type="Credit",
                        amount=amount,
                        balance_after=from_account.balance,
                        description=f"Возврат неудачного перевода в {target_bank}",
                        transaction_date=datetime.utcnow()
                    )
                    db.add(transaction_refund)
                    
                    logger.warning(f"Interbank transfer {transfer_id} failed, refunded to sender")
                    
            except Exception as e:
                # Ошибка при вызове API - откат
                logger.error(f"Interbank transfer {transfer_id} error: {str(e)}")
                payment.status = "Rejected"
                interbank_transfer.status = "failed"
                
                # Вернуть деньги отправителю
                from_account.balance += amount
                
                # Создать корректирующую транзакцию (возврат)
                transaction_refund = Transaction(
                    account_id=from_account.id,
                    transaction_type="Credit",
                    amount=amount,
                    balance_after=from_account.balance,
                    description=f"Возврат из-за ошибки межбанковского перевода: {str(e)}",
                    transaction_date=datetime.utcnow()
                )
                db.add(transaction_refund)
            
            payment.status_update_date_time = datetime.utcnow()
        
        await db.commit()
        await db.refresh(payment)
        
        return payment, interbank_transfer
    
    @staticmethod
    async def get_payment(
        db: AsyncSession,
        payment_id: str
    ) -> Optional[Payment]:
        """Получить статус платежа"""
        result = await db.execute(
            select(Payment).where(Payment.payment_id == payment_id)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def update_bank_capital(
        db: AsyncSession,
        amount_change: Decimal,
        reason: str = ""
    ):
        """
        Обновить капитал банка
        
        amount_change: положительное = увеличение, отрицательное = уменьшение
        """
        bank_code = config.BANK_CODE
        
        # Получить или создать запись капитала
        result = await db.execute(
            select(BankCapital).where(BankCapital.bank_code == bank_code)
        )
        capital_record = result.scalar_one_or_none()
        
        if not capital_record:
            # Создать если нет
            capital_record = BankCapital(
                bank_code=bank_code,
                capital=Decimal("3500000.00"),  # Начальный капитал
                initial_capital=Decimal("3500000.00")
            )
            db.add(capital_record)
        
        # Обновить капитал
        capital_record.capital += amount_change
        capital_record.updated_at = datetime.utcnow()
        
        await db.commit()
        
        return capital_record
    
    @staticmethod
    async def _detect_target_bank(account_number: str) -> Optional[str]:
        """
        Определить банк-получатель по номеру счета
        
        В реальности это делается через БИК (БИК включен в платежных реквизитах).
        В MVP: пытаемся найти счет во всех банках через HTTP запросы.
        
        Returns:
            Код банка (vbank/abank/sbank) или None
        """
        banks = ["vbank", "abank", "sbank"]
        
        # Исключить свой банк из поиска
        banks = [b for b in banks if b != config.BANK_CODE]
        
        # Проверяем каждый банк через локальные адреса (внутри Docker сети)
        for bank_code in banks:
            try:
                # В Docker сети банки доступны по именам сервисов
                bank_url = f"http://{bank_code}:8000"
                
                async with httpx.AsyncClient(timeout=5.0) as client:
                    # Проверяем существование счета через GET /accounts (упрощенная проверка)
                    # В продакшене: специальный endpoint для проверки существования счета
                    response = await client.get(
                        f"{bank_url}/interbank/check-account/{account_number}",
                        headers={"x-bank-auth-token": config.BANK_CODE}
                    )
                    
                    if response.status_code == 200:
                        logger.info(f"Account {account_number} found in {bank_code}")
                        return bank_code
                        
            except Exception as e:
                logger.debug(f"Failed to check account in {bank_code}: {str(e)}")
                continue
        
        return None
    
    @staticmethod
    async def _send_interbank_transfer(
        transfer_id: str,
        to_bank: str,
        to_account_number: str,
        amount: Decimal,
        description: str
    ) -> bool:
        """
        Отправить межбанковский перевод через HTTP API
        
        Returns:
            True если успешно, False если ошибка
        """
        try:
            # URL банка-получателя (в Docker сети)
            bank_url = f"http://{to_bank}:8000"
            
            # Подготовить данные для отправки
            transfer_data = {
                "transfer_id": transfer_id,
                "from_bank": config.BANK_CODE,
                "to_account_number": to_account_number,
                "amount": str(amount),
                "currency": "RUB",
                "description": description
            }
            
            # Отправить POST запрос
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{bank_url}/interbank/receive",
                    json=transfer_data,
                    headers={
                        "x-bank-auth-token": config.BANK_CODE,
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 201:
                    result = response.json()
                    logger.info(f"Interbank transfer {transfer_id} sent successfully to {to_bank}: {result}")
                    return True
                else:
                    logger.error(f"Interbank transfer {transfer_id} failed: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to send interbank transfer {transfer_id}: {str(e)}")
            return False

