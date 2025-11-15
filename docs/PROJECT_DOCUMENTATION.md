# Проект "Мультибанк" — Техническая документация

## 1. Назначение
Проект создан как расширение открытого решения "Bank-in-a-Box" от VTB Hackathon. Базовый шаблон предоставляет готовый бэкенд OpenBanking Russia 2.1. Наша версия добавляет клиентский Next.js‑интерфейс, AI‑ассистента, аналитику кошельков и автоматизацию сценариев мультибанкинга.

## 2. Ключевые отличия от Bank-in-a-Box
- **Новый фронтенд (Next.js 14 + Tailwind)** вместо статического шаблона из репозитория VTB.
- **AI-ассистент MultiBank Copilot** с доступом к данным счетов/транзакций и DOM контексту страницы.
- **Упрощённый onboarding клиента**: создание локального счёта в 1 клик, автоматический номер карты (Мир/Visa/Mastercard).
- **Разделы "Бюджет", "История", "Аналитика"** с прогнозами и категориями расходов.
- **Проактивная безопасность**: токены, прокси-роуты Next.js → FastAPI, строгие CORS и rate limit.
- **Докеризация full-stack** (frontend + backend + PostgreSQL) и готовый `docker-compose`.

## 3. Архитектура
```
┌───────────────┐    fetch/REST    ┌──────────────┐
│ Next.js 14 UI │◄───────────────►│ FastAPI 0.104│
└──────┬────────┘                 └──────┬───────┘
       │                                │
       │ webs fetch AI context          │ SQLAlchemy async
       ▼                                ▼
┌──────────────┐      OpenAI API       ┌──────────────┐
│AI Proxy (API │◄─────────────────────►│PostgreSQL 16 │
│ route)       │                      │(shared/db)   │
└──────────────┘                      └──────────────┘
```
- **Frontend** (`FrontendN/`): App Router, TypeScript, серверные/клиентские компоненты, LLM proxy `/api/ai-chat`.
- **Backend** (`api/`, `services/`, `main.py`): FastAPI модули Account/Admin/Payments/etc., сервисы для согласий и платежей, SQLAlchemy models и миграции.
- **Shared DB** (`shared/database/init.sql`): 16 таблиц (clients, accounts, transactions, products, consents...).
- **Docs/Diagrams** (`docs/diagrams/*.puml`): PlantUML диаграммы компонентов, структуры банка, ERD.

## 4. Основные пользовательские сценарии
1. **Авторизация** — стеклянный login UI, восстановления ошибок клиента.
2. **Dashboard** — баланс, быстрые карты счётов, быстрые действия.
3. **Создание счёта** — модальное окно, валюта RUB, баланс 0, генерация BIN.
4. **Мультибанк** — подключение песочниц SBank/ABank/VBank, агрегация счетов.
5. **История / Аналитика** — объединённая лента транзакций, графики (Recharts).
6. **Бюджет** — демо бюджеты + прогноз расходов (utils/forecast.ts).
7. **AI-ассистент** — всплывающий чат, контекст от API и DOM, советы по балансам/бюджетам.

## 5. AI-ассистент
- **Прокси**: `FrontendN/app/api/ai-chat/route.ts` отправляет запросы в nixai.ru (model `gpt-4o-mini`).
- **Контекст**: комбинирует данные FastAPI (`/accounts`, `/transactions`, `/budgets`) и DOM-слой страницы (балансы, транзакции, бюджеты).
- **Возможности**: ответы про балансы, советы по бюджету, объяснение мультибанка, сценарии безопасности, интерактивные инсайты.
- **Безопасность**: ключ хранится в `.env.local`, запросы идут через бэкенд маршруты, токен пользователя подтягивается автоматом.

## 6. Backend-модули
- `api/accounts.py` — CRUD по счетам, генерация карт, локальные/внешние счета.
- `api/multibank_*.py` — consent flow, внешние балансы, межбанковские операции.
- `api/payments.py` / `services/payment_service.py` — переводы, расписание, статусы.
- `api/admin.py` / `api/banker.py` — управление капиталом, статистикой, логи API.
- `services/consent_service.py` — жизненный цикл согласий OpenBanking.

## 7. Frontend-модули
- `app/` — страницы: dashboard, accounts, analytics, history, budget, login, settings.
- `components/` — карточки счетов, модалки, графики, сайдбар, AI чат.
- `lib/` — API-клиенты (bank-api-client.ts, vtb-api.ts), Prisma конфиги.
- `utils/` — бюджет/категоризация/прогнозирование.

## 8. Развёртывание
### Docker
```bash
cp .env.example .env   # заполнить креды команды
cp FrontendN/env.template FrontendN/.env.local
make up                 # либо docker compose up -d
```
### Локально
- Backend: `pip install -r requirements.txt` → `python run.py`.
- Frontend: `cd FrontendN && npm install && npm run dev`.
- DB: `docker compose up postgres` или локальный PostgreSQL; структура из `shared/database/init.sql`.

## 9. Мониторинг и логи
- FastAPI: `/docs`, `/redoc`, `/admin/*` метрики.
- Frontend: developer console, `next dev --turbo`.
- Docker: `docker compose logs -f` для слежения за сервисами.

## 10. Будущие улучшения
1. Полноценная синхронизация бюджетов с БД вместо демо.
2. Push-уведомления и webhooks от внешних банков.
3. Расширение AI: планирование переводов, голосовой ввод.
4. e2e тесты для Next.js страниц (Playwright).
5. Observability стек (Prometheus + Grafana).
