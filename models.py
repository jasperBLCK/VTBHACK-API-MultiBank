"""
SQLAlchemy модели для банка
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, ARRAY, Boolean, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


# === Teams (участники хакатона) ===
class Team(Base):
    """Команды участников хакатона"""
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(String(100), unique=True, nullable=False)  # team200
    client_secret = Column(String(255), nullable=False)  # api_key
    team_name = Column(String(255))  # название команды
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Client(Base):
    """Клиент банка"""
    __tablename__ = "clients"
    
    id = Column(Integer, primary_key=True)
    person_id = Column(String(100), unique=True)  # ID из общей базы людей
    client_type = Column(String(20))  # individual / legal
    full_name = Column(String(255), nullable=False)
    segment = Column(String(50))  # employee, student, pensioner, etc.
    birth_year = Column(Integer)
    monthly_income = Column(Numeric(15, 2))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    accounts = relationship("Account", back_populates="client")


class Account(Base):
    """Счет клиента"""
    __tablename__ = "accounts"
    
    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    account_number = Column(String(20), unique=True, nullable=False)
    account_type = Column(String(50))  # checking, savings, deposit
    balance = Column(Numeric(15, 2), default=0)
    currency = Column(String(3), default="RUB")
    status = Column(String(20), default="active")
    opened_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    client = relationship("Client", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account")


class Transaction(Base):
    """Транзакция по счету"""
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    transaction_id = Column(String(100), unique=True, nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    direction = Column(String(10))  # credit / debit
    counterparty = Column(String(255))
    description = Column(Text)
    transaction_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    account = relationship("Account", back_populates="transactions")


class BankSettings(Base):
    """Настройки банка"""
    __tablename__ = "bank_settings"
    
    key = Column(String(100), primary_key=True)
    value = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuthToken(Base):
    """Токены авторизации"""
    __tablename__ = "auth_tokens"
    
    id = Column(Integer, primary_key=True)
    token_type = Column(String(20))  # client / bank
    subject_id = Column(String(100))  # client_id или bank_code
    token_hash = Column(String(255))
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class ConsentRequest(Base):
    """Запросы на согласие (от других банков)"""
    __tablename__ = "consent_requests"
    
    id = Column(Integer, primary_key=True)
    request_id = Column(String(100), unique=True, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    requesting_bank = Column(String(100))  # bank_code запрашивающего банка
    requesting_bank_name = Column(String(255))
    permissions = Column(ARRAY(String))  # ReadAccounts, ReadBalances, etc.
    reason = Column(Text)
    status = Column(String(20), default="pending")  # pending / approved / rejected
    created_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime)
    
    # Relationships
    client = relationship("Client")


class Consent(Base):
    """Согласие клиента (активное)"""
    __tablename__ = "consents"
    
    id = Column(Integer, primary_key=True)
    consent_id = Column(String(100), unique=True, nullable=False)
    request_id = Column(Integer, ForeignKey("consent_requests.id"))
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    granted_to = Column(String(100), nullable=False)  # bank_code
    permissions = Column(ARRAY(String), nullable=False)
    status = Column(String(20), default="active")  # active / revoked / expired
    expiration_date_time = Column(DateTime)
    creation_date_time = Column(DateTime, default=datetime.utcnow)
    status_update_date_time = Column(DateTime, default=datetime.utcnow)
    signed_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime)
    last_accessed_at = Column(DateTime)
    
    # Relationships
    client = relationship("Client")


class Notification(Base):
    """Уведомления для клиентов"""
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    notification_type = Column(String(50))  # consent_request / consent_approved / etc
    title = Column(String(255))
    message = Column(Text)
    related_id = Column(String(100))  # request_id or consent_id
    status = Column(String(20), default="unread")  # unread / read
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    client = relationship("Client")


class PaymentConsentRequest(Base):
    """Запросы на согласие для платежей (от других банков)"""
    __tablename__ = "payment_consent_requests"
    
    id = Column(Integer, primary_key=True)
    request_id = Column(String(100), unique=True, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    requesting_bank = Column(String(100))  # bank_code запрашивающего банка
    requesting_bank_name = Column(String(255))
    # Данные платежа для одобрения
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="RUB")
    debtor_account = Column(String(255))  # Счет списания
    creditor_account = Column(String(255))  # Счет получателя
    creditor_name = Column(String(255))  # Имя получателя
    reference = Column(String(255))  # Назначение платежа
    reason = Column(Text)
    status = Column(String(20), default="pending")  # pending / approved / rejected
    created_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime)
    
    # Relationships
    client = relationship("Client")


class PaymentConsent(Base):
    """Согласие клиента на платеж (активное)"""
    __tablename__ = "payment_consents"
    
    id = Column(Integer, primary_key=True)
    consent_id = Column(String(100), unique=True, nullable=False)
    request_id = Column(Integer, ForeignKey("payment_consent_requests.id"))
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    granted_to = Column(String(100), nullable=False)  # bank_code
    # Данные платежа
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="RUB")
    debtor_account = Column(String(255))
    creditor_account = Column(String(255))
    creditor_name = Column(String(255))
    reference = Column(String(255))
    status = Column(String(20), default="active")  # active / used / revoked / expired
    expiration_date_time = Column(DateTime)
    creation_date_time = Column(DateTime, default=datetime.utcnow)
    status_update_date_time = Column(DateTime, default=datetime.utcnow)
    signed_at = Column(DateTime, default=datetime.utcnow)
    used_at = Column(DateTime)  # Когда использовано (платеж создан)
    revoked_at = Column(DateTime)
    
    # Relationships
    client = relationship("Client")


class ProductAgreementConsentRequest(Base):
    """Запросы на согласие для управления договорами (от других банков)"""
    __tablename__ = "product_agreement_consent_requests"
    
    id = Column(Integer, primary_key=True)
    request_id = Column(String(100), unique=True, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    requesting_bank = Column(String(100))  # bank_code запрашивающего банка
    requesting_bank_name = Column(String(255))
    
    # Разрешения
    read_product_agreements = Column(Boolean, default=False)
    open_product_agreements = Column(Boolean, default=False)
    close_product_agreements = Column(Boolean, default=False)
    
    # Ограничения
    allowed_product_types = Column(ARRAY(String))  # ["deposit", "card", "credit"]
    max_amount = Column(Numeric(15, 2))  # Макс сумма открытия продукта
    
    # Срок действия
    valid_until = Column(DateTime)
    
    reason = Column(Text)
    status = Column(String(20), default="pending")  # pending / approved / rejected
    created_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime)
    
    # Relationships
    client = relationship("Client")


class ProductAgreementConsent(Base):
    """Согласие клиента на управление договорами (активное)"""
    __tablename__ = "product_agreement_consents"
    
    id = Column(Integer, primary_key=True)
    consent_id = Column(String(100), unique=True, nullable=False)
    request_id = Column(Integer, ForeignKey("product_agreement_consent_requests.id"))
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    granted_to = Column(String(100), nullable=False)  # bank_code
    
    # Разрешения
    read_product_agreements = Column(Boolean, default=False)
    open_product_agreements = Column(Boolean, default=False)
    close_product_agreements = Column(Boolean, default=False)
    
    # Ограничения
    allowed_product_types = Column(ARRAY(String))  # Разрешенные типы продуктов
    max_amount = Column(Numeric(15, 2))  # Макс сумма открытия
    current_total_opened = Column(Numeric(15, 2), default=0)  # Текущая сумма открытых
    
    # Срок действия
    valid_until = Column(DateTime)
    
    status = Column(String(20), default="active")  # active / revoked / expired
    creation_date_time = Column(DateTime, default=datetime.utcnow)
    status_update_date_time = Column(DateTime, default=datetime.utcnow)
    signed_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime)
    last_used_at = Column(DateTime)
    
    # Relationships
    client = relationship("Client")


class Payment(Base):
    """Платеж (OpenBanking Russia Payments API)"""
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True)
    payment_id = Column(String(100), unique=True, nullable=False)
    payment_consent_id = Column(String(100))  # Ссылка на согласие (если использовалось)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)  # Счет-отправитель
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="RUB")
    destination_account = Column(String(255))  # Номер счета получателя
    destination_bank = Column(String(100))  # Код банка получателя
    description = Column(Text)
    status = Column(String(50), default="AcceptedSettlementInProcess")
    # AcceptedSettlementInProcess, AcceptedSettlementCompleted, Rejected
    creation_date_time = Column(DateTime, default=datetime.utcnow)
    status_update_date_time = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    account = relationship("Account")


class InterbankTransfer(Base):
    """Межбанковский перевод (для отслеживания капитала)"""
    __tablename__ = "interbank_transfers"
    
    id = Column(Integer, primary_key=True)
    transfer_id = Column(String(100), unique=True, nullable=False)
    payment_id = Column(String(100), ForeignKey("payments.payment_id"))
    from_bank = Column(String(100), nullable=False)  # Код банка-отправителя
    to_bank = Column(String(100), nullable=False)  # Код банка-получателя
    amount = Column(Numeric(15, 2), nullable=False)
    status = Column(String(50), default="processing")  # processing / completed / failed
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)


class BankCapital(Base):
    """Капитал банка (для экономической модели)"""
    __tablename__ = "bank_capital"
    
    id = Column(Integer, primary_key=True)
    bank_code = Column(String(100), unique=True, nullable=False)
    capital = Column(Numeric(15, 2), nullable=False)  # Текущий капитал
    initial_capital = Column(Numeric(15, 2), nullable=False)  # Начальный капитал
    total_deposits = Column(Numeric(15, 2), default=0)  # Сумма депозитов клиентов
    total_loans = Column(Numeric(15, 2), default=0)  # Выданные кредиты
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Product(Base):
    """Финансовый продукт банка"""
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True)
    product_id = Column(String(100), unique=True, nullable=False)
    product_type = Column(String(50), nullable=False)  # deposit, credit_card, loan
    name = Column(String(255), nullable=False)
    description = Column(Text)
    interest_rate = Column(Numeric(5, 2))  # Процентная ставка
    min_amount = Column(Numeric(15, 2))  # Минимальная сумма
    max_amount = Column(Numeric(15, 2))  # Максимальная сумма
    term_months = Column(Integer)  # Срок в месяцах
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ProductAgreement(Base):
    """Договор клиента с продуктом (кредит, депозит, карта)"""
    __tablename__ = "product_agreements"
    
    id = Column(Integer, primary_key=True)
    agreement_id = Column(String(100), unique=True, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"))  # Связанный счет
    amount = Column(Numeric(15, 2), nullable=False)
    status = Column(String(50), default="active")  # active, closed, defaulted
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    client = relationship("Client")
    product = relationship("Product")


class KeyRateHistory(Base):
    """История изменений ключевой ставки ЦБ"""
    __tablename__ = "key_rate_history"
    
    id = Column(Integer, primary_key=True)
    rate = Column(Numeric(5, 2), nullable=False)  # Например 7.50%
    effective_from = Column(DateTime, default=datetime.utcnow)
    changed_by = Column(String(100))  # admin
    created_at = Column(DateTime, default=datetime.utcnow)


# === Products API v1.3.1 Models ===

class CustomerLead(Base):
    """Лид (потенциальный клиент) - Products API v1.3.1"""
    __tablename__ = "customer_leads"
    
    id = Column(Integer, primary_key=True)
    customer_lead_id = Column(String(100), unique=True, nullable=False)
    status = Column(String(50), default="pending")  # pending, contacted, converted, rejected
    
    # Контактная информация
    full_name = Column(String(255))
    phone = Column(String(50))
    email = Column(String(255))
    
    # Интерес к продуктам
    interested_products = Column(ARRAY(String))  # product_id list
    source = Column(String(100))  # откуда пришел лид (website, partner, etc)
    
    # Дополнительные данные
    notes = Column(Text)
    estimated_income = Column(Numeric(15, 2))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    contacted_at = Column(DateTime)
    converted_to_client_id = Column(Integer, ForeignKey("clients.id"))  # если конвертировался


class ProductOffer(Base):
    """Персональное предложение по продукту - Products API v1.3.1"""
    __tablename__ = "product_offers"
    
    id = Column(Integer, primary_key=True)
    offer_id = Column(String(100), unique=True, nullable=False)
    customer_lead_id = Column(String(100), ForeignKey("customer_leads.customer_lead_id"))
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    
    # Персонализированные условия
    personalized_rate = Column(Numeric(5, 2))  # персональная ставка
    personalized_amount = Column(Numeric(15, 2))  # персональная сумма
    personalized_term_months = Column(Integer)
    
    status = Column(String(50), default="pending")  # pending, sent, viewed, accepted, rejected, expired
    valid_until = Column(DateTime)  # срок действия предложения
    
    # Причина отклонения (если rejected)
    rejection_reason = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    sent_at = Column(DateTime)
    viewed_at = Column(DateTime)
    responded_at = Column(DateTime)
    
    # Relationships
    product = relationship("Product")


class ProductOfferConsent(Base):
    """Согласие на получение персональных предложений - Products API v1.3.1"""
    __tablename__ = "product_offer_consents"
    
    id = Column(Integer, primary_key=True)
    consent_id = Column(String(100), unique=True, nullable=False)
    customer_lead_id = Column(String(100), ForeignKey("customer_leads.customer_lead_id"))
    client_id = Column(Integer, ForeignKey("clients.id"))  # если есть клиент
    
    # Разрешения
    permissions = Column(ARRAY(String))  # список разрешений (use_credit_history, use_income_data, etc)
    status = Column(String(20), default="active")  # active, revoked, expired
    
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime)


class ProductApplication(Base):
    """Заявка клиента на банковский продукт - Products API v1.3.1"""
    __tablename__ = "product_applications"
    
    id = Column(Integer, primary_key=True)
    application_id = Column(String(100), unique=True, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    offer_id = Column(String(100), ForeignKey("product_offers.offer_id"))  # если из предложения
    
    # Запрошенные условия
    requested_amount = Column(Numeric(15, 2), nullable=False)
    requested_term_months = Column(Integer)
    
    # Статус заявки
    status = Column(String(50), default="pending")
    # pending, under_review, additional_info_required, approved, rejected, cancelled
    
    # Данные заявки
    application_data = Column(Text)  # JSON с доп. данными (доход, стаж работы, и т.д.)
    
    # Решение банка
    decision = Column(String(50))  # approved, rejected
    decision_reason = Column(Text)  # причина одобрения/отклонения
    approved_amount = Column(Numeric(15, 2))  # одобренная сумма (может отличаться)
    approved_rate = Column(Numeric(5, 2))  # одобренная ставка
    
    # Timestamps
    submitted_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime)
    decision_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    client = relationship("Client")
    product = relationship("Product")


# === VRP API v1.3.1 Models ===

class VRPConsent(Base):
    """Согласие на периодические переводы с переменными реквизитами - VRP API v1.3.1"""
    __tablename__ = "vrp_consents"
    
    id = Column(Integer, primary_key=True)
    consent_id = Column(String(100), unique=True, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)  # счет плательщика
    
    # Статус согласия
    status = Column(String(50), default="AwaitingAuthorisation")
    # AwaitingAuthorisation, Authorised, Rejected, Revoked, Expired
    
    # Параметры контроля
    max_individual_amount = Column(Numeric(15, 2))  # макс сумма одного платежа
    max_amount_period = Column(Numeric(15, 2))  # макс сумма за период
    period_type = Column(String(20))  # day, week, month, year
    
    # Лимиты
    max_payments_count = Column(Integer)  # макс количество платежей
    
    # Дата действия
    valid_from = Column(DateTime)
    valid_to = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    authorised_at = Column(DateTime)
    revoked_at = Column(DateTime)
    
    # Relationships
    client = relationship("Client")
    account = relationship("Account")


class VRPPayment(Base):
    """Периодический платеж по VRP согласию - VRP API v1.3.1"""
    __tablename__ = "vrp_payments"
    
    id = Column(Integer, primary_key=True)
    payment_id = Column(String(100), unique=True, nullable=False)
    vrp_consent_id = Column(String(100), ForeignKey("vrp_consents.consent_id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    
    # Детали платежа
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="RUB")
    destination_account = Column(String(255), nullable=False)
    destination_bank = Column(String(100))
    description = Column(Text)
    
    # Статус
    status = Column(String(50), default="AcceptedSettlementInProcess")
    # AcceptedSettlementInProcess, AcceptedSettlementCompleted, Rejected
    
    # Периодичность
    is_recurring = Column(Boolean, default=True)
    recurrence_frequency = Column(String(20))  # daily, weekly, monthly
    next_payment_date = Column(DateTime)
    
    # Timestamps
    creation_date_time = Column(DateTime, default=datetime.utcnow)
    status_update_date_time = Column(DateTime, default=datetime.utcnow)
    executed_at = Column(DateTime)
    
    # Relationships
    account = relationship("Account")


class APICallLog(Base):
    """Лог вызовов API для мониторинга"""
    __tablename__ = "api_calls_log"
    
    id = Column(Integer, primary_key=True)
    
    # Кто вызвал (может быть client_id или team_id)
    caller_id = Column(String(100))  # team200, client-123, etc
    caller_type = Column(String(50))  # team, client, external
    person_id = Column(String(100))  # team200-1, team200-2 - конкретный пользователь
    
    # Детали запроса
    endpoint = Column(String(500), nullable=False)
    method = Column(String(10), nullable=False)  # GET, POST, PUT, DELETE
    
    # Результат
    status_code = Column(Integer)
    response_time_ms = Column(Integer)
    
    # IP и метаданные
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Для синхронизации с Directory
    synced_to_directory = Column(Boolean, default=False)
    synced_at = Column(DateTime)

