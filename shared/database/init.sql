-- Bank-in-a-Box - создание таблиц и тестовые данные

-- Создание таблиц
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    person_id VARCHAR(100) UNIQUE,
    client_type VARCHAR(20),
    full_name VARCHAR(255) NOT NULL,
    segment VARCHAR(50),
    birth_year INTEGER,
    monthly_income NUMERIC(15, 2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    account_number VARCHAR(20) UNIQUE NOT NULL,
    account_type VARCHAR(50),
    balance NUMERIC(15, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'RUB',
    status VARCHAR(20) DEFAULT 'active',
    opened_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id),
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    direction VARCHAR(10),
    counterparty VARCHAR(255),
    description TEXT,
    transaction_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_tokens (
    id SERIAL PRIMARY KEY,
    token_type VARCHAR(20),
    subject_id VARCHAR(100),
    token_hash VARCHAR(255),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    payment_id VARCHAR(100) UNIQUE NOT NULL,
    payment_consent_id VARCHAR(100),
    account_id INTEGER REFERENCES accounts(id),
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'RUB',
    destination_account VARCHAR(255),
    destination_bank VARCHAR(100),
    description TEXT,
    status VARCHAR(50) DEFAULT 'AcceptedSettlementInProcess',
    creation_date_time TIMESTAMP DEFAULT NOW(),
    status_update_date_time TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interbank_transfers (
    id SERIAL PRIMARY KEY,
    transfer_id VARCHAR(100) UNIQUE NOT NULL,
    payment_id VARCHAR(100) REFERENCES payments(payment_id),
    from_bank VARCHAR(100) NOT NULL,
    to_bank VARCHAR(100) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'processing',
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_capital (
    id SERIAL PRIMARY KEY,
    bank_code VARCHAR(100) UNIQUE NOT NULL,
    capital NUMERIC(15, 2) NOT NULL,
    initial_capital NUMERIC(15, 2) NOT NULL,
    total_deposits NUMERIC(15, 2) DEFAULT 0,
    total_loans NUMERIC(15, 2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(100) UNIQUE NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    team_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Клиенты команды team200 (для работы на хакатоне)
INSERT INTO clients (person_id, client_type, full_name, segment, birth_year, monthly_income) VALUES
('team200-1', 'individual', 'Участник команды №1', 'employee', 1995, 100000),
('team200-2', 'individual', 'Участник команды №2', 'employee', 1994, 110000),
('team200-3', 'individual', 'Участник команды №3', 'employee', 1993, 105000),
('team200-4', 'individual', 'Участник команды №4', 'entrepreneur', 1992, 150000),
('team200-5', 'individual', 'Участник команды №5', 'employee', 1996, 95000),
('team200-6', 'individual', 'Участник команды №6', 'employee', 1997, 90000),
('team200-7', 'individual', 'Участник команды №7', 'employee', 1991, 120000),
('team200-8', 'individual', 'Участник команды №8', 'employee', 1998, 85000),
('team200-9', 'individual', 'Участник команды №9', 'entrepreneur', 1990, 200000),
('team200-10', 'individual', 'Участник команды №10', 'employee', 1999, 80000),
-- Demo клиенты (для тестирования)
('demo-client-001', 'individual', 'Демо клиент №1', 'employee', 1988, 120000),
('demo-client-002', 'individual', 'Демо клиент №2', 'employee', 1982, 150000),
('demo-client-003', 'individual', 'Демо клиент №3', 'entrepreneur', 1975, 200000);

-- Счета для команды team200
INSERT INTO accounts (client_id, account_number, account_type, balance, currency, status) VALUES
(1, '40817810200000000001', 'checking', 500000.00, 'RUB', 'active'),
(2, '40817810200000000002', 'checking', 450000.00, 'RUB', 'active'),
(3, '40817810200000000003', 'checking', 480000.00, 'RUB', 'active'),
(4, '40817810200000000004', 'checking', 600000.00, 'RUB', 'active'),
(5, '40817810200000000005', 'checking', 350000.00, 'RUB', 'active'),
(6, '40817810200000000006', 'checking', 320000.00, 'RUB', 'active'),
(7, '40817810200000000007', 'checking', 550000.00, 'RUB', 'active'),
(8, '40817810200000000008', 'checking', 280000.00, 'RUB', 'active'),
(9, '40817810200000000009', 'checking', 750000.00, 'RUB', 'active'),
(10, '40817810200000000010', 'checking', 420000.00, 'RUB', 'active'),
-- Demo счета
(11, '40817810099920011001', 'checking', 320000.00, 'RUB', 'active'),
(12, '40817810099920012001', 'checking', 450000.50, 'RUB', 'active'),
(13, '40817810099920013001', 'checking', 550000.75, 'RUB', 'active');

-- Транзакции для team200
INSERT INTO transactions (account_id, transaction_id, amount, direction, counterparty, description, transaction_date) VALUES
(1, 'tx-team200-001', 100000.00, 'credit', 'ООО Работодатель', 'Зарплата', '2025-10-01 10:00:00'),
(2, 'tx-team200-002', 110000.00, 'credit', 'ООО Компания', 'Зарплата', '2025-10-01 10:00:00'),
(3, 'tx-team200-003', 105000.00, 'credit', 'ООО Работодатель', 'Зарплата', '2025-10-01 10:00:00'),
(4, 'tx-team200-004', 150000.00, 'credit', 'Клиенты', 'Доход от бизнеса', '2025-09-30 18:00:00'),
(5, 'tx-team200-005', 95000.00, 'credit', 'ООО Работодатель', 'Зарплата', '2025-10-01 10:00:00'),
(6, 'tx-team200-006', 90000.00, 'credit', 'ООО Компания', 'Зарплата', '2025-10-01 10:00:00'),
(7, 'tx-team200-007', 120000.00, 'credit', 'ООО Работодатель', 'Зарплата', '2025-10-01 10:00:00'),
(8, 'tx-team200-008', 85000.00, 'credit', 'ООО Компания', 'Зарплата', '2025-10-01 10:00:00'),
(9, 'tx-team200-009', 200000.00, 'credit', 'Клиенты', 'Доход от бизнеса', '2025-09-30 18:00:00'),
(10, 'tx-team200-010', 80000.00, 'credit', 'ООО Работодатель', 'Зарплата', '2025-10-01 10:00:00'),
-- Demo транзакции
(11, 'tx-demo-001', 120000.00, 'credit', 'ООО Работодатель', 'Зарплата', '2025-10-01 10:00:00'),
(12, 'tx-demo-002', 150000.00, 'credit', 'ООО Компания', 'Зарплата', '2025-10-01 10:00:00'),
(13, 'tx-demo-003', 200000.00, 'credit', 'Клиенты', 'Доход от бизнеса', '2025-09-30 18:00:00');

-- Настройки банка
INSERT INTO bank_settings (key, value) VALUES
('bank_code', 'abank'),
('bank_name', 'Awesome Bank'),
('public_address', 'http://localhost:8002'),
('capital', '3500000.00');

-- Капитал банка
INSERT INTO bank_capital (bank_code, capital, initial_capital, total_deposits, total_loans) VALUES
('abank', 3500000.00, 3500000.00, 0, 0);



-- Продукты банка
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(100) UNIQUE NOT NULL,
    product_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    interest_rate NUMERIC(5, 2),
    min_amount NUMERIC(15, 2),
    max_amount NUMERIC(15, 2),
    term_months INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO products (product_id, product_type, name, description, interest_rate, min_amount, term_months) VALUES
('prod-ab-deposit-001', 'deposit', 'Выгодный депозит', 'Ставка 9.0% годовых', 9.0, 100000, 12),
('prod-ab-card-001', 'card', 'Кредитная карта Gold', 'Ставка 16.5%, кэшбэк 3%', 16.5, 0, NULL),
('prod-ab-loan-001', 'loan', 'Кредит наличными', 'Ставка 13.5% годовых', 13.5, 100000, 24);


-- Договоры с продуктами
CREATE TABLE IF NOT EXISTS product_agreements (
    id SERIAL PRIMARY KEY,
    agreement_id VARCHAR(100) UNIQUE NOT NULL,
    client_id INTEGER REFERENCES clients(id),
    product_id INTEGER REFERENCES products(id),
    account_id INTEGER REFERENCES accounts(id),
    amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    start_date TIMESTAMP DEFAULT NOW(),
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);


-- История ключевой ставки ЦБ
CREATE TABLE IF NOT EXISTS key_rate_history (
    id SERIAL PRIMARY KEY,
    rate NUMERIC(5, 2) NOT NULL,
    effective_from TIMESTAMP DEFAULT NOW(),
    changed_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO key_rate_history (rate, changed_by) VALUES (7.50, 'system');

-- Обновление настроек
INSERT INTO bank_settings (key, value) VALUES 
('key_rate', '7.50'),
('auto_approve_consents', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Команда team200 (пример для документации)
INSERT INTO teams (client_id, client_secret, team_name, is_active) VALUES 
('team200', '5OAaa4DYzYKfnOU6zbR34ic5qMm7VSMB', 'Команда 200 (пример)', true)
ON CONFLICT (client_id) DO NOTHING;
