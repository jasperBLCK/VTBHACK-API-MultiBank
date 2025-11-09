# Исправление проблемы с DATABASE_URL

## Проблема
При запуске `npx prisma db seed` возникает ошибка, что переменная `DATABASE_URL` не найдена.

## Решение

### 1. Убедитесь, что файл `.env.local` существует

Создайте файл `.env.local` в корне проекта со следующим содержимым:

```
DATABASE_URL="file:./dev.db"
```

### 2. Установите dotenv (если еще не установлен)

```bash
npm install dotenv
```

### 3. Перезапустите команды

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

## Альтернативный способ

Если проблема сохраняется, можно задать переменную окружения напрямую в PowerShell:

```powershell
$env:DATABASE_URL="file:./dev.db"
npx prisma db seed
```

Или в одной команде:

```powershell
$env:DATABASE_URL="file:./dev.db"; npx prisma db seed
```

## Проверка

Убедитесь, что файл `.env.local` существует:

```powershell
Get-Content .env.local
```

Должно вывести:
```
DATABASE_URL="file:./dev.db"
```

