# Настройка для Windows

## Проблема с командами

В Windows PowerShell команда `cp` не работает. Используйте следующие решения:

## Решение 1: Используйте SQLite (рекомендуется для демо)

### 1. Создайте файл `.env.local`

**Способ А: Скопируйте шаблон (самый простой)**
```powershell
Copy-Item env.template .env.local
```

**Способ Б: Создайте вручную**
Создайте файл `.env.local` в корне проекта со следующим содержимым:

```env
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_VTB_API_URL=https://api.vtb.ru
NEXT_PUBLIC_VTB_CLIENT_ID=your_client_id
NEXT_PUBLIC_VTB_CLIENT_SECRET=your_client_secret
```

> **См. также:** [CREATE_ENV.md](./CREATE_ENV.md) - подробные инструкции по созданию файла

### 2. Запустите команды

```powershell
# Генерация Prisma Client
npm run db:generate

# Применение схемы базы данных
npm run db:push

# Запуск проекта
npm run dev
```

## Решение 2: Используйте PostgreSQL

### 1. Создайте файл `.env.local`

```env
DATABASE_URL="postgresql://user:password@localhost:5432/multibank?schema=public"
NEXT_PUBLIC_VTB_API_URL=https://api.vtb.ru
NEXT_PUBLIC_VTB_CLIENT_ID=your_client_id
NEXT_PUBLIC_VTB_CLIENT_SECRET=your_client_secret
```

### 2. Скопируйте PostgreSQL схему вручную

**Вариант А: Через PowerShell**
```powershell
Copy-Item prisma\schema.postgresql.prisma prisma\schema.prisma
```

**Вариант Б: Через npm скрипт (кроссплатформенный)**
```powershell
npm run db:postgresql
```

### 3. Запустите миграции

```powershell
npm run db:generate
npm run db:migrate
npm run dev
```

## Частые ошибки

### Ошибка: "Environment variable not found: DATABASE_URL"

**Причина:** Файл `.env.local` не создан или находится не в корне проекта.

**Решение:**
1. Убедитесь, что файл `.env.local` существует в корне проекта (рядом с `package.json`)
2. Перезапустите сервер разработки (`npm run dev`)

### Ошибка: "cp не является внутренней или внешней командой"

**Причина:** Команда `cp` не работает в Windows PowerShell.

**Решение:**
- Используйте `npm run db:postgresql` (кроссплатформенный скрипт)
- Или скопируйте файл вручную: `Copy-Item prisma\schema.postgresql.prisma prisma\schema.prisma`

### Ошибка: "ReferenceError: forecastedBalance is not defined"

**Решение:** Уже исправлено. Убедитесь, что вы используете последнюю версию кода.

## Быстрый старт для Windows

```powershell
# 1. Установите зависимости
npm install

# 2. Убедитесь, что файл .env.local существует
# (он уже создан автоматически, но проверьте содержимое)

# 3. Инициализируйте базу данных (SQLite)
npm run db:generate
npm run db:push

# 4. Запустите проект
npm run dev
```

Готово! Откройте http://localhost:3000

