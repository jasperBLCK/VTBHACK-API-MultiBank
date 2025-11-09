# Быстрый старт для хакатона

> **Для Windows:** См. также [WINDOWS_SETUP.md](./WINDOWS_SETUP.md)

## SQLite (для демо) - 3 шага

### 1. Установите зависимости
```bash
npm install
```

### 2. Настройте .env.local
Создайте файл `.env.local` в корне проекта:
```env
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_VTB_API_URL=https://api.vtb.ru
NEXT_PUBLIC_VTB_CLIENT_ID=your_client_id
NEXT_PUBLIC_VTB_CLIENT_SECRET=your_client_secret
```

### 3. Запустите проект
```bash
npx prisma generate
npx prisma db push
npm run dev
```

Готово! Откройте http://localhost:3000

## PostgreSQL (для продакшена)

### 1. Используйте PostgreSQL схему
```bash
npm run db:postgresql
```

### 2. Настройте .env.local
Создайте файл `.env.local` в корне проекта:
```env
DATABASE_URL="postgresql://user:password@host:5432/dbname"
NEXT_PUBLIC_VTB_API_URL=https://api.vtb.ru
NEXT_PUBLIC_VTB_CLIENT_ID=your_client_id
NEXT_PUBLIC_VTB_CLIENT_SECRET=your_client_secret
```

### 3. Запустите миграции
```bash
npx prisma migrate dev --name init
npm run dev
```

## Полезные команды

```bash
# Генерация Prisma Client
npm run db:generate

# Применить изменения схемы
npm run db:push

# Создать миграцию (PostgreSQL)
npm run db:migrate

# Открыть Prisma Studio (визуальный редактор БД)
npm run db:studio
```

## Важно для Windows

В Windows PowerShell переменные окружения устанавливаются иначе. 

**Неправильно:**
```powershell
DATABASE_URL="file:./dev.db"
```

**Правильно:**
1. Создайте файл `.env.local` в корне проекта
2. Добавьте в него:
```env
DATABASE_URL="file:./dev.db"
```

Или установите переменную для текущей сессии:
```powershell
$env:DATABASE_URL="file:./dev.db"
```

Но лучше использовать файл `.env.local` - Next.js автоматически загрузит его.
