"""
Сервис управления согласиями
Соответствует OpenBanking Russia Account-Consents API v2.1
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timedelta
from typing import Optional, List
import uuid

from models import Consent, ConsentRequest, Notification, Client, BankSettings


class ConsentService:
    """Сервис для работы с согласиями клиентов"""
    
    @staticmethod
    async def check_consent(
        db: AsyncSession,
        client_person_id: str,
        requesting_bank: str,
        permissions: List[str]
    ) -> Optional[Consent]:
        """
        Проверка наличия активного согласия
        
        Args:
            client_person_id: ID клиента (person_id)
            requesting_bank: Код банка, запрашивающего доступ
            permissions: Требуемые permissions
        
        Returns:
            Consent если найдено и активно, иначе None
        """
        # Получить client.id по person_id
        client_result = await db.execute(
            select(Client).where(Client.person_id == client_person_id)
        )
        client = client_result.scalar_one_or_none()
        
        if not client:
            return None
        
        # Найти активное согласие
        result = await db.execute(
            select(Consent).where(
                and_(
                    Consent.client_id == client.id,
                    Consent.granted_to == requesting_bank,
                    Consent.status == "active",
                    Consent.expiration_date_time > datetime.utcnow()
                )
            )
        )
        consent = result.scalar_one_or_none()
        
        if not consent:
            return None
        
        # Проверить что все требуемые permissions есть
        if not all(perm in consent.permissions for perm in permissions):
            return None
        
        # Обновить last_accessed_at
        consent.last_accessed_at = datetime.utcnow()
        await db.commit()
        
        return consent
    
    @staticmethod
    async def create_consent_request(
        db: AsyncSession,
        client_person_id: str,
        requesting_bank: str,
        requesting_bank_name: str,
        permissions: List[str],
        reason: str = ""
    ) -> tuple[ConsentRequest, Optional[Consent]]:
        """
        Создание запроса на согласие от другого банка
        
        Returns:
            (consent_request, consent) - запрос и согласие (если автоодобрено)
        """
        # Получить client
        client_result = await db.execute(
            select(Client).where(Client.person_id == client_person_id)
        )
        client = client_result.scalar_one_or_none()
        
        if not client:
            raise ValueError(f"Client {client_person_id} not found")
        
        # Проверить настройку автоодобрения
        settings_result = await db.execute(
            select(BankSettings).where(BankSettings.key == "auto_approve_consents")
        )
        auto_approve_setting = settings_result.scalar_one_or_none()
        auto_approve = auto_approve_setting and auto_approve_setting.value.lower() == "true"
        
        # Создать request_id
        request_id = f"req-{uuid.uuid4().hex[:12]}"
        
        # Создать запрос
        consent_request = ConsentRequest(
            request_id=request_id,
            client_id=client.id,
            requesting_bank=requesting_bank,
            requesting_bank_name=requesting_bank_name,
            permissions=permissions,
            reason=reason,
            status="pending"
        )
        db.add(consent_request)
        await db.flush()  # Flush to get consent_request.id
        
        # Если автоодобрение включено - сразу создать согласие
        consent = None
        if auto_approve:
            consent_id = f"consent-{uuid.uuid4().hex[:12]}"
            
            consent = Consent(
                consent_id=consent_id,
                request_id=consent_request.id,
                client_id=client.id,
                granted_to=requesting_bank,
                permissions=permissions,
                status="active",
                expiration_date_time=datetime.utcnow() + timedelta(days=365),
                creation_date_time=datetime.utcnow(),
                status_update_date_time=datetime.utcnow(),
                signed_at=datetime.utcnow()
            )
            db.add(consent)
            
            # Обновить статус запроса
            consent_request.status = "approved"
            consent_request.responded_at = datetime.utcnow()
        else:
            # Создать уведомление для клиента (если требуется ручное одобрение)
            notification = Notification(
                client_id=client.id,
                notification_type="consent_request",
                title=f"Запрос на доступ от {requesting_bank_name}",
                message=f"{requesting_bank_name} запрашивает доступ к: {', '.join(permissions)}",
                related_id=request_id,
                status="unread"
            )
            db.add(notification)
        
        await db.commit()
        await db.refresh(consent_request)
        if consent:
            await db.refresh(consent)
        
        return (consent_request, consent)
    
    @staticmethod
    async def sign_consent(
        db: AsyncSession,
        request_id: str,
        client_person_id: str,
        action: str,  # approve / reject
        signature: str = ""
    ) -> tuple[str, Optional[Consent]]:
        """
        Подписание или отклонение согласия клиентом
        
        Returns:
            (status, consent) - статус и созданное согласие (если approved)
        """
        # Получить client
        client_result = await db.execute(
            select(Client).where(Client.person_id == client_person_id)
        )
        client = client_result.scalar_one_or_none()
        
        if not client:
            raise ValueError(f"Client {client_person_id} not found")
        
        # Получить запрос
        request_result = await db.execute(
            select(ConsentRequest).where(
                and_(
                    ConsentRequest.request_id == request_id,
                    ConsentRequest.client_id == client.id,
                    ConsentRequest.status == "pending"
                )
            )
        )
        consent_request = request_result.scalar_one_or_none()
        
        if not consent_request:
            raise ValueError(f"Consent request {request_id} not found or already processed")
        
        # TODO: Проверить signature (пароль или OTP)
        # В MVP: упрощенная проверка
        
        if action == "approve":
            # Создать активное согласие
            consent_id = f"consent-{uuid.uuid4().hex[:12]}"
            
            consent = Consent(
                consent_id=consent_id,
                request_id=consent_request.id,
                client_id=client.id,
                granted_to=consent_request.requesting_bank,
                permissions=consent_request.permissions,
                status="active",  # Системный активный статус
                expiration_date_time=datetime.utcnow() + timedelta(days=365),
                creation_date_time=datetime.utcnow(),
                status_update_date_time=datetime.utcnow(),
                signed_at=datetime.utcnow()
            )
            db.add(consent)
            
            # Обновить статус запроса
            consent_request.status = "approved"
            consent_request.responded_at = datetime.utcnow()
            
            await db.commit()
            await db.refresh(consent)
            
            return ("approved", consent)
            
        else:  # reject
            consent_request.status = "rejected"
            consent_request.responded_at = datetime.utcnow()
            await db.commit()
            
            return ("rejected", None)
    
    @staticmethod
    async def authorize_consent_by_id(
        db: AsyncSession,
        consent_id: str,
        client_person_id: str,
        action: str  # approve / reject
    ) -> tuple[str, Optional[Consent]]:
        """
        Авторизация consent resource по ID (упрощённый OAuth для sandbox)
        
        В production это происходит через OAuth redirect flow.
        Для sandbox: клиент может авторизовать consent напрямую.
        
        Args:
            consent_id: ID consent resource (формат ac-xxxx из POST /account-consents)
            client_person_id: person_id клиента
            action: approve / reject
            
        Returns:
            (status, consent) - статус и созданное согласие (если approved)
        """
        # Получить client
        client_result = await db.execute(
            select(Client).where(Client.person_id == client_person_id)
        )
        client = client_result.scalar_one_or_none()
        
        if not client:
            raise ValueError(f"Client {client_person_id} not found")
        
        # Найти consent request по consent_id
        request_result = await db.execute(
            select(ConsentRequest).where(
                and_(
                    ConsentRequest.request_id == consent_id,
                    ConsentRequest.client_id == client.id,
                    ConsentRequest.status == "pending"
                )
            )
        )
        consent_request = request_result.scalar_one_or_none()
        
        if not consent_request:
            raise ValueError(f"Consent {consent_id} not found or already processed")
        
        if action == "approve":
            # Создать активное согласие
            final_consent_id = f"consent-{uuid.uuid4().hex[:12]}"
            
            consent = Consent(
                consent_id=final_consent_id,
                request_id=consent_request.id,
                client_id=client.id,
                granted_to=consent_request.requesting_bank,
                permissions=consent_request.permissions,
                status="active",
                expiration_date_time=datetime.utcnow() + timedelta(days=365),
                creation_date_time=datetime.utcnow(),
                status_update_date_time=datetime.utcnow(),
                signed_at=datetime.utcnow()
            )
            db.add(consent)
            
            # Обновить статус запроса
            consent_request.status = "approved"
            consent_request.responded_at = datetime.utcnow()
            
            await db.commit()
            await db.refresh(consent)
            
            return ("Authorized", consent)
            
        else:  # reject
            consent_request.status = "rejected"
            consent_request.responded_at = datetime.utcnow()
            await db.commit()
            
            return ("Rejected", None)
    
    @staticmethod
    async def revoke_consent(
        db: AsyncSession,
        consent_id: str,
        client_person_id: str
    ) -> bool:
        """Отзыв согласия клиентом"""
        # Получить client
        client_result = await db.execute(
            select(Client).where(Client.person_id == client_person_id)
        )
        client = client_result.scalar_one_or_none()
        
        if not client:
            return False
        
        # Найти согласие
        result = await db.execute(
            select(Consent).where(
                and_(
                    Consent.consent_id == consent_id,
                    Consent.client_id == client.id,
                    Consent.status == "active"
                )
            )
        )
        consent = result.scalar_one_or_none()
        
        if not consent:
            return False
        
        # Отозвать
        consent.status = "Revoked"  # OpenBanking формат с заглавной буквы
        consent.status_update_date_time = datetime.utcnow()
        consent.revoked_at = datetime.utcnow()
        
        await db.commit()
        return True

