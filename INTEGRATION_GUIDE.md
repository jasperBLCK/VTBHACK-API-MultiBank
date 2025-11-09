# Руководство по интеграции FrontendN

## Краткое описание

FrontendN (новый Next.js фронтенд) интегрирован с существующим FastAPI backend. Старый фронтенд (`frontend/`) заменен на новый, но все API эндпоинты остались прежними.

## Быстрый старт

### 1. Запуск Backend (FastAPI)

```bash
# В корневой папке проекта
python run.py
```

Backend будет доступен на `http://localhost:8001`

### 2. Запуск FrontendN (Next.js)

```bash
# В папке FrontendN
cd FrontendN
npm install
npm run dev
```

FrontendN будет доступен на `http://localhost:3000`

### 3. Вход в систему

Откройте `http://localhost:3000` и войдите используя тестовые учетные данные:
- Username: `team200-1` (или любой другой тестовый клиент)
- Password: `password`

## Конфигурация

### Backend (env.txt)

Добавлена переменная для FrontendN:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:8001
```

**Примечание:** Эта переменная не используется в backend, она только для справки. Реальная конфигурация находится в `FrontendN/.env.local`

### FrontendN (.env.local)

Создайте файл `FrontendN/.env.local`:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8001
```

Или скопируйте из шаблона:
```bash
cd FrontendN
cp env.template .env.local
```

## Архитектура

### API Проксирование

Все запросы из FrontendN проксируются через Next.js API routes к FastAPI:

- `FrontendN/app/api/accounts/route.ts` → `FastAPI /accounts`
- `FrontendN/app/api/transactions/route.ts` → `FastAPI /accounts/{id}/transactions`
- `FrontendN/app/api/transfer/route.ts` → `FastAPI /payments`
- `FrontendN/app/api/auth/login/route.ts` → `FastAPI /auth/login`
- `FrontendN/app/api/auth/me/route.ts` → `FastAPI /auth/me`

### Аутентификация

1. Пользователь входит через `/login`
2. Токен сохраняется в `localStorage` как `access_token`
3. Все API запросы включают заголовок `Authorization: Bearer <token>`
4. При истечении токена пользователь автоматически перенаправляется на `/login`

### Форматы данных

FrontendN преобразует ответы FastAPI (формат OpenBanking Russia) в внутренний формат:

- **Счета**: `{ data: { account: [...] } }` → `BankAccount[]`
- **Балансы**: `{ data: { balance: [...] } }` → `number`
- **Транзакции**: `{ data: { transaction: [...] } }` → `Transaction[]`

## Основные изменения

### 1. Старый фронтенд (`frontend/`)

Старый фронтенд остался в папке `frontend/`, но больше не используется. Его можно удалить или оставить для справки.

### 2. Новый фронтенд (`FrontendN/`)

- Использует Next.js 14 с App Router
- React компоненты с TypeScript
- Tailwind CSS для стилей
- Интегрирован с существующими API эндпоинтами

### 3. Backend (FastAPI)

- Не изменен, все API эндпоинты работают как прежде
- Добавлен CORS для `http://localhost:3000` (FrontendN)
- Все существующие эндпоинты сохранены

## Тестирование

### Тестовые клиенты

- `team200-1`, `team200-2`, ... `team200-10`
- `demo-client-001`, `demo-client-002`, `demo-client-003`

Пароль для всех: `password`

### Проверка работы

1. Запустите backend и frontend
2. Войдите в систему
3. Проверьте загрузку счетов и транзакций
4. Попробуйте выполнить перевод между счетами

## Устранение проблем

### Ошибка подключения к backend

Убедитесь что:
1. Backend запущен на порту 8001
2. `FrontendN/.env.local` содержит правильный `NEXT_PUBLIC_BACKEND_URL`
3. CORS настроен правильно в `main.py`

### Ошибка авторизации

1. Проверьте что токен сохраняется в `localStorage`
2. Убедитесь что заголовок `Authorization` отправляется с каждым запросом
3. Проверьте срок действия токена (24 часа по умолчанию)

### Ошибка загрузки данных

1. Проверьте консоль браузера на наличие ошибок
2. Проверьте логи backend
3. Убедитесь что API эндпоинты доступны

## Дополнительная информация

См. `FrontendN/INTEGRATION.md` для более подробной информации о интеграции.

