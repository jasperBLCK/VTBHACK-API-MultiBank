# База данных для Мультибанка

## Выбор базы данных

Проект поддерживает два варианта базы данных:

1. **SQLite + Prisma** - для разработки и демо (проще, не требует отдельного сервера)
2. **PostgreSQL + Prisma** - для продакшена (масштабируемый, надежный)

### Почему SQLite для демо?

- ✅ Не требует отдельного сервера
- ✅ Простая настройка (один файл)
- ✅ Идеально для разработки и демонстрации
- ✅ Нулевая конфигурация
- ✅ Быстрый старт

### Почему PostgreSQL для продакшена?

- ✅ Надежность и ACID-совместимость
- ✅ Отличная производительность
- ✅ Поддержка JSON для метаданных
- ✅ Масштабируемость
- ✅ Бесплатные хостинги (Supabase, Neon, Railway)

### Почему Prisma?

- ✅ Type-safe запросы
- ✅ Автоматическая генерация типов
- ✅ Миграции базы данных
- ✅ Отличная интеграция с Next.js
- ✅ Удобная работа с отношениями

## Установка

### 1. Установите зависимости

```bash
npm install @prisma/client
npm install -D prisma
```

### 2. Настройте переменные окружения

Добавьте в `.env.local`:

**Для разработки/демо (SQLite):**
```env
# SQLite (для демо)
DATABASE_URL="file:./dev.db"
```

**Для продакшена (PostgreSQL):**
```env
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@localhost:5432/multibank?schema=public"

# Для продакшена (Supabase, Neon, Railway)
# DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
```

### 3. Инициализируйте Prisma

**Для SQLite (демо):**
```bash
npx prisma generate
npx prisma db push
```

**Для PostgreSQL (продакшен):**
```bash
# Используйте schema.postgresql.prisma
# Windows:
copy prisma\schema.postgresql.prisma prisma\schema.prisma
# Linux/Mac:
# cp prisma/schema.postgresql.prisma prisma/schema.prisma

npx prisma generate
npx prisma migrate dev --name init
```

Или используйте npm скрипт:
```bash
npm run db:postgresql
```

## Структура базы данных

### Модели

1. **User** - Пользователи системы
2. **BankConnection** - Подключения к банкам (OAuth токены)
3. **Account** - Банковские счета
4. **Transaction** - Транзакции
5. **UserSettings** - Настройки пользователя
6. **Notification** - Уведомления

### Диаграмма отношений

```
User
  ├── BankConnection (1:N)
  │     └── Account (1:N)
  ├── Account (1:N)
  │     └── Transaction (1:N)
  ├── Transaction (1:N)
  ├── UserSettings (1:1)
  └── Notification (1:N)
```

## Использование в коде

### Создание Prisma Client

Создайте файл `lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Примеры использования

#### Получение счетов пользователя

```typescript
import { prisma } from '@/lib/prisma'

export async function getAccounts(userId: string) {
  return await prisma.account.findMany({
    where: { userId },
    include: {
      bankConnection: true,
    },
    orderBy: { updatedAt: 'desc' },
  })
}
```

#### Сохранение банковского подключения

```typescript
export async function saveBankConnection(
  userId: string,
  bankName: string,
  bankId: string,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: Date
) {
  return await prisma.bankConnection.create({
    data: {
      userId,
      bankName,
      bankId,
      accessToken, // В реальности нужно зашифровать!
      refreshToken,
      expiresAt,
    },
  })
}
```

#### Получение транзакций

```typescript
export async function getTransactions(
  userId: string,
  accountId?: string,
  fromDate?: Date,
  toDate?: Date
) {
  return await prisma.transaction.findMany({
    where: {
      userId,
      accountId: accountId || undefined,
      date: {
        gte: fromDate,
        lte: toDate,
      },
    },
    include: {
      account: true,
    },
    orderBy: { date: 'desc' },
  })
}
```

## Безопасность

### Шифрование токенов

⚠️ **ВАЖНО**: Токены доступа должны храниться в зашифрованном виде!

Используйте библиотеку для шифрования:

```typescript
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY! // 32 bytes
const IV_LENGTH = 16

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(text: string): string {
  const textParts = text.split(':')
  const iv = Buffer.from(textParts.shift()!, 'hex')
  const encryptedText = Buffer.from(textParts.join(':'), 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString()
}
```

## Миграции

### Создание миграции

```bash
npx prisma migrate dev --name add_new_field
```

### Применение миграций

```bash
npx prisma migrate deploy
```

### Откат миграции

```bash
npx prisma migrate resolve --rolled-back <migration_name>
```

## Рекомендации по хостингу

### Для разработки

- **Локально**: Docker с PostgreSQL
- **Cloud**: Supabase (бесплатный tier)

### Для продакшена

- **Supabase**: Бесплатный tier до 500MB
- **Neon**: Serverless PostgreSQL, бесплатный tier
- **Railway**: Простая настройка, платный
- **AWS RDS**: Для масштабируемых решений

## Синхронизация данных

### Автоматическая синхронизация

Используйте cron jobs или Next.js API routes для периодической синхронизации:

```typescript
// app/api/sync/route.ts
export async function GET() {
  const users = await prisma.user.findMany({
    include: { bankConnections: true },
  })

  for (const user of users) {
    for (const connection of user.bankConnections) {
      if (connection.isActive) {
        await syncBankData(user.id, connection)
      }
    }
  }

  return Response.json({ success: true })
}
```

## Индексирование

Для улучшения производительности добавлены индексы:

- `userId` в Account, Transaction, Notification
- `accountId` в Transaction
- `date` в Transaction
- `isRead` в Notification

## Резервное копирование

Рекомендуется настроить автоматическое резервное копирование:

```bash
# Пример команды для бэкапа
pg_dump $DATABASE_URL > backup.sql
```

