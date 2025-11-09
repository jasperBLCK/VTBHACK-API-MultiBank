# Создание файла .env.local

## Быстрый способ

Создайте файл `.env.local` в корне проекта (рядом с `package.json`) со следующим содержимым:

```env
# Database (SQLite для демо)
DATABASE_URL="file:./dev.db"

# VTB API
NEXT_PUBLIC_VTB_API_URL=https://api.vtb.ru
NEXT_PUBLIC_VTB_CLIENT_ID=your_client_id
NEXT_PUBLIC_VTB_CLIENT_SECRET=your_client_secret
```

## Способ через PowerShell

Выполните в PowerShell (в корне проекта):

```powershell
New-Item -Path .env.local -ItemType File -Force
Add-Content -Path .env.local -Value 'DATABASE_URL="file:./dev.db"'
Add-Content -Path .env.local -Value 'NEXT_PUBLIC_VTB_API_URL=https://api.vtb.ru'
Add-Content -Path .env.local -Value 'NEXT_PUBLIC_VTB_CLIENT_ID=your_client_id'
Add-Content -Path .env.local -Value 'NEXT_PUBLIC_VTB_CLIENT_SECRET=your_client_secret'
```

## Способ через блокнот

1. Откройте Блокнот (Notepad)
2. Скопируйте содержимое из блока выше
3. Сохраните файл как `.env.local` в корне проекта (тип файла: "Все файлы")

## Проверка

После создания файла выполните:

```powershell
Get-Content .env.local
```

Должно отображаться содержимое файла.

## Для PostgreSQL

Если используете PostgreSQL, измените `DATABASE_URL` на:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/multibank?schema=public"
```

