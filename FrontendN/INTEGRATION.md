# Интеграция FrontendN с FastAPI Backend

FrontendN интегрирован с существующим FastAPI backend. Все API запросы проксируются через Next.js API routes к FastAPI эндпоинтам.

## Конфигурация

### 1. Backend (FastAPI)

Backend должен быть запущен на порту 8001 (или изменить в `env.txt` и `FrontendN/.env.local`).

### 2. FrontendN (Next.js)

Создайте файл `.env.local` в папке `FrontendN`:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8001
```

Или используйте существующий `env.template` как основу.

## Запуск

### 1. Запуск Backend

```bash
# В корневой папке проекта
python run.py
```

Backend будет доступен на `http://localhost:8001`

### 2. Запуск FrontendN

```bash
# В папке FrontendN
cd FrontendN
npm install
npm run dev
```

FrontendN будет доступен на `http://localhost:3000`

## API Интеграция

Все API запросы из FrontendN проксируются через Next.js API routes (`/app/api/*`) к FastAPI эндпоинтам:

- `/api/accounts` → `/accounts` (FastAPI)
- `/api/transactions` → `/accounts/{id}/transactions` (FastAPI)
- `/api/transfer` → `/payments` (FastAPI)
- `/api/auth/login` → `/auth/login` (FastAPI)
- `/api/auth/me` → `/auth/me` (FastAPI)

## Аутентификация

1. Пользователь входит через `/login`
2. Токен сохраняется в `localStorage` как `access_token`
3. Все последующие запросы включают заголовок `Authorization: Bearer <token>`
4. При истечении токена пользователь перенаправляется на `/login`

## Тестовые клиенты

Для тестирования можно использовать:
- `team200-1`, `team200-2`, ... `team200-10`
- `demo-client-001`, `demo-client-002`, `demo-client-003`

Пароль для всех: `password`

## Структура

- `FrontendN/app/api/*` - Next.js API routes (прокси к FastAPI)
- `FrontendN/lib/bank-api-client.ts` - API клиент (пока не используется, но может быть полезен)
- `FrontendN/app/login/page.tsx` - Страница входа
- `FrontendN/app/page.tsx` - Главная страница (требует авторизации)

## CORS

Backend настроен для разрешения запросов с `http://localhost:3000` (Next.js FrontendN).

## Известные ограничения

1. Уведомления пока работают только в памяти (не сохраняются в БД)
2. Некоторые функции FrontendN могут требовать дополнительной интеграции с FastAPI
3. Балансы загружаются отдельным запросом для каждого счета

