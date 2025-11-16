# 🏦 MultiBank Platform

<div align="center">

[![VTB API Hackathon 2025](https://img.shields.io/badge/VTB%20API-Hackathon%202025-blue?style=for-the-badge)](https://hackathon.vtb.ru/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)

**Единое мультибанковское приложение с AI-ассистентом и глубоким OpenBanking стеком.**

</div>

---

## TL;DR
- Один фронт для локальных и внешних счетов (FinScope + SBank/ABank/VBank).
- Next.js 14 UI, FastAPI backend, PostgreSQL.
- AI-ассистент MultiBank Copilot, который читает данные API и контент страницы.
- Расширенный функционал по сравнению с шаблоном **Bank-in-a-Box**: аналитика, бюджеты, генерация карт, стеклянный login, демо сценарии хакатона.

Полная техническая документация: [`docs/PROJECT_DOCUMENTATION.md`](docs/PROJECT_DOCUMENTATION.md)

---

## Что изменено относительно Bank-in-a-Box

| Категория | Bank-in-a-Box | MultiBank Platform |
|-----------|---------------|--------------------|
| UI | legacy frontend | **Next.js 14 + Tailwind** SPA/SSR, 8 страниц, светлая/тёмная темы |
| AI | нет | **AI чат** (nixai gpt-4o-mini) с доступом к счетам, транзакциям и DOM |
| Клиентский onboarding | Ручное создание | **Модалка "Создать счёт"** + генератор карт Мир/Visa/Mastercard |
| Аналитика | базовая | **Dashboard, Analytics, History, Budget** с прогнозами и категориями |
| Безопасность | стандартная | Token proxy в Next.js, строгие CORS, rate limits, скрытие LLM key |
| Докер | backend-only | **Full stack docker-compose** (frontend + backend + db) |

---

## Архитектура

```
┌───────────────┐    fetch/REST    ┌──────────────┐
│ Next.js UI    │◄───────────────►│ FastAPI API  │
│ (FrontendN)   │                  │ (api/*)      │
└──────┬────────┘                  └──────┬───────┘
       │                                 │
       │ AI proxy (/api/ai-chat)         │ SQLAlchemy async
       ▼                                 ▼
┌──────────────┐          ┌──────────────┐
│ nixai.ru LLM │          │ PostgreSQL   │
└──────────────┘          └──────────────┘
```

- **Frontend:** Next.js App Router, TypeScript, Tailwind, Prisma client helpers, Recharts.
- **Backend:** FastAPI 0.104, services в `services/`, модели в `models.py`, запуск через `run.py`.
- **Database:** PostgreSQL 16 (см. `shared/database/init.sql`).
- **Docs:** PlantUML диаграммы (`docs/diagrams`) + новая текстовая документация.

---

## Ключевые фичи
- 🧠 **AI Copilot**: отвечает на вопросы о балансах, расходах, бюджете; понимает что пользователь видит на странице.
- 🏦 **Мультибанк счета**: локальные FinScope + внешние песочницы (SBank, ABank, VBank) по OpenBanking 2.1.
- 💳 **Создание счёта**: карточка создаётся с нуля, номер генерируется автоматически (Мир/Visa/MasterCard BIN).
- 📈 **Analytics & History**: единая лента транзакций, графики, фильтры, экспорт.
- 💰 **Budget & Forecast**: демо бюджеты, расчёт прогресса, прогноз расходов (utils/forecast.ts).
- 🔐 **Security & Compliance**: JWT, OAuth 2.0 consent flow, JWKS endpoint, Admin/Banker APIs.
- 🎨 **UI/UX**: стеклянная авторизация, плавающая кнопка AI, адаптивный сайдбар, skeleton загрузчики.

---

## Быстрый старт

> Детальный гайд: [`INSTALLATION_GUIDE.md`](INSTALLATION_GUIDE.md)

### 1. Docker (рекомендуется)

```bash
git clone https://github.com/your-team/VTBHACK-API-MultiBank.git
cd VTBHACK-API-MultiBank
cp .env.example .env              # заполните креды команды/БД
cp FrontendN/env.template FrontendN/.env.local
docker compose up -d
```

Сервисы: `frontend` (3000), `api` (8000), `postgres` (5432). Swagger доступен на `http://localhost:8000/docs`.

### 2. Локальная разработка

```bash
# Backend
python -m venv .venv && .\.venv\Scripts\activate
pip install -r requirements.txt
python run.py  # http://localhost:8000

# Frontend
cd FrontendN
npm install
npm run dev    # http://localhost:3000
```

### Переменные окружения
- `.env`: секреты команды, настройки БД, ключи OAuth.
- `FrontendN/.env.local`: `NEXT_PUBLIC_BACKEND_URL`, `LLM_API_KEY`, `LLM_API_URL`.
- Примеры значений лежат в `env.template` и комментариях `.env`.

---

## Структура проекта

```
├── api/                  # FastAPI endpoints
├── services/             # бизнес-логика (auth/payment/consent)
├── shared/database/      # init.sql и сиды
├── FrontendN/            # Next.js приложение
│   ├── app/              # страницы и API роуты
│   ├── components/       # UI блоки (AIChat, графики, модалки)
│   ├── lib/              # клиенты к backend/VTB API
│   └── utils/            # бюджет, категоризация, форматирование
├── docs/                 # diagrams + PROJECT_DOCUMENTATION
├── docker-compose.yml
└── run.py                # запуск FastAPI
```

---

## AI Copilot кратко
- Файл `FrontendN/components/AIChat.tsx` — UI и сбор DOM-контекста.
- API роут `FrontendN/app/api/ai-chat/route.ts` объединяет данные аккаунта и страницы, проксирует к `https://api.nixai.ru/v1/chat/completions` (model `gpt-4o-mini`).
- Ответы всегда локализованы, содержат персональные инсайты, рекомендации и объяснение мультибанкинга.

---

## Тестовые аккаунты
- `team251-1 ... team251-10 / password`
- `demo-client-001 / password`

---

## Ссылки
- Swagger: `http://localhost:8000/docs`
- Project docs: [`docs/PROJECT_DOCUMENTATION.md`](docs/PROJECT_DOCUMENTATION.md)
- Диаграммы: [`docs/diagrams`](docs/diagrams)

---

## Лицензия
[MIT](LICENSE)

Настройки в `main.py`:
```python
allowed_origins = [
    "https://open.bankingapi.ru",  # HackAPI Platform
    "http://localhost:8001",  # VBank
    "http://localhost:8002",  # ABank
    "http://localhost:8003",  # SBank
    # + regex для localhost:*
]
```

Если нужно добавить свой домен - отредактируй `main.py` и перезапусти контейнер.

## 🏗️ Архитектура

### Компоненты системы

![Bank Architecture](./docs/diagrams/bank-structure.svg)

**Основные компоненты:**
- **FastAPI App** - веб-сервер с 42+ API endpoints
- **PostgreSQL** - реляционная база данных (16 таблиц)
- **JWT Service** - авторизация HS256/RS256
- **Consent Service** - управление согласиями клиентов
- **Payment Service** - обработка платежей и переводов
- **Client UI** - веб-интерфейс для клиентов (5 страниц)
- **Banker UI** - административная панель (4 страницы)

## 📊 Структура проекта

```
bank-in-a-box/
├── api/                    # API endpoints
│   ├── accounts.py         # Accounts API
│   ├── consents.py         # Consents API
│   ├── payments.py         # Payments API
│   ├── products.py         # Products API
│   ├── product_agreements.py
│   ├── multibank_proxy.py  # Multibank API (NEW!)
│   ├── banker.py           # Banker API
│   ├── admin.py            # Admin API
│   ├── auth.py             # Авторизация
│   └── well_known.py       # JWKS endpoint
│
├── services/               # Бизнес-логика
│   ├── auth_service.py     # JWT + RS256
│   ├── consent_service.py  # Управление согласиями
│   └── payment_service.py  # Платежи и переводы
│
├── frontend/               # UI
│   ├── client/             # Client UI (5 страниц)
│   └── banker/             # Banker UI (4 страницы)
│
├── shared/                 # Общие ресурсы
│   ├── database/           # SQL init скрипты
│   └── keys/               # RSA ключи
│
├── main.py                 # FastAPI app
├── models.py               # SQLAlchemy models (16 таблиц)
├── config.py               # Конфигурация
├── database.py             # Async PostgreSQL
├── docker-compose.yml      # Docker конфигурация
├── Dockerfile              # Docker образ
└── requirements.txt        # Python зависимости
```

## 🗄️ База данных

### Таблицы (16 шт):

1. **clients** - клиенты банка
2. **accounts** - счета клиентов
3. **transactions** - транзакции
4. **products** - финансовые продукты
5. **product_agreements** - договоры (депозиты, кредиты, карты)
6. **consents** - согласия клиентов
7. **consent_requests** - запросы на согласия
8. **payments** - платежи
9. **interbank_transfers** - межбанковские переводы
10. **bank_capital** - капитал банка
11. **bank_settings** - настройки
12. **auth_tokens** - токены авторизации
13. **notifications** - уведомления
14. **key_rate_history** - история ключевой ставки ЦБ

### Изменения в базе данных

Структура БД определена в `shared/database/init.sql`.

**Для применения изменений:**
```bash
# 1. Отредактируйте init.sql
nano shared/database/init.sql

# 2. Пересоздайте базу данных
docker compose down -v
docker compose up -d
```

**Важно:** При пересоздании БД все данные будут удалены и созданы заново из `init.sql`.

## 🧪 Тестирование

### 1. Через UI

Открой http://localhost:8080/client/

**Тестовые клиенты команды:**
- `team200-1` до `team200-10` / `password`

**Demo клиенты:**
- `demo-client-001`, `demo-client-002`, `demo-client-003` / `password`

### 2. Через Swagger

Открой http://localhost:8080/docs

### 3. Через curl

```bash
# Авторизация
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "team200-1", "password": "password"}'

# Получить счета
curl -X GET http://localhost:8080/accounts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📡 API Endpoints

### Auth API
- `POST /auth/login` - авторизация клиента
- `POST /auth/bank-token` - токен для межбанковских запросов
- `POST /auth/banker-login` - авторизация банкира
- `GET /auth/me` - информация о текущем пользователе

### Accounts API (OpenBanking Russia v2.1)
- `GET /accounts` - список счетов
- `GET /accounts/{accountId}` - детали счета
- `GET /accounts/{accountId}/balances` - баланс
- `GET /accounts/{accountId}/transactions` - транзакции
- `POST /accounts` - создать счет
- `DELETE /accounts/{accountId}` - закрыть счет

### Account-Consents API (OpenBanking Russia v2.1)
- `POST /account-consents/request` - запросить согласие
- `POST /account-consents/sign` - подписать согласие
- `GET /account-consents/my-consents` - мои согласия
- `GET /account-consents/requests` - запросы на согласие
- `POST /account-consents/requests/{id}/approve` - одобрить
- `POST /account-consents/requests/{id}/reject` - отклонить
- `DELETE /account-consents/{consentId}` - отозвать согласие

### Payments API
- `POST /payments` - создать платеж
- `GET /payments/{paymentId}` - статус платежа

### Multibank API 
- `POST /multibank/bank-token` - получить токен банка для межбанковских операций
- `POST /multibank/request-consent` - запросить согласие клиента другого банка
- `POST /multibank/accounts-with-consent` - получить счета клиента с использованием consent
- `POST /multibank/balances-with-consent` - получить балансы счетов

### Products API
- `GET /products` - каталог продуктов
- `GET /products/{productId}` - детали продукта

### ProductAgreements API
- `GET /product-agreements` - список договоров
- `POST /product-agreements` - открыть продукт
- `GET /product-agreements/{agreementId}` - детали
- `DELETE /product-agreements/{agreementId}` - закрыть

### Banker API
- `GET /banker/products` - все продукты
- `PUT /banker/products/{id}` - изменить ставки
- `POST /banker/products` - создать продукт
- `GET /banker/clients` - список клиентов
- `GET /banker/consents` - запросы на согласия

### Admin API
- `GET /admin/capital` - капитал банков
- `GET /admin/stats` - статистика
- `GET /admin/transfers` - межбанковские переводы
- `GET /admin/payments` - все платежи
- `GET /admin/key-rate` - ключевая ставка ЦБ (только чтение)
- `GET /admin/key-rate/history` - история изменений ставки

### JWKS
- `GET /.well-known/jwks.json` - публичные ключи для RS256

## 🔐 Безопасность

### Авторизация

**Client tokens** - HS256 JWT:
```json
{
  "sub": "cli-mybank-001",
  "type": "client",
  "bank": "self"
}
```

**Bank tokens** - RS256 JWT:
```json
{
  "sub": "mybank",
  "type": "bank",
  "iss": "mybank",
  "aud": "interbank"
}
```

### Согласия (Consents)

Для межбанковских запросов требуется согласие клиента:
```http
GET /accounts?client_id=cli-001
Authorization: Bearer BANK_TOKEN
X-Consent-ID: consent-abc-123
X-Requesting-Bank: otherbank
```

## 🌐 Деплой в продакшн

### 1. На VPS/VDS

```bash
# Скопируй на сервер
scp -r bank-in-a-box/ user@server:/opt/

# Настрой nginx
sudo nano /etc/nginx/sites-available/mybank

# SSL через certbot
sudo certbot --nginx -d api.mybank.com

# Запусти
cd /opt/bank-in-a-box
docker compose up -d
```

### 2. На Kubernetes

```bash
# Создай deployment
kubectl apply -f k8s/deployment.yml

# Создай service
kubectl apply -f k8s/service.yml

# Настрой ingress
kubectl apply -f k8s/ingress.yml
```
