# Быстрое создание .env.local

## Способ 1: Через PowerShell

Выполните в PowerShell:

```powershell
Copy-Item env.template .env.local
```

Или создайте файл вручную:

```powershell
echo 'DATABASE_URL="file:./dev.db"' > .env.local
```

## Способ 2: Вручную

1. Создайте файл `.env.local` в корне проекта
2. Добавьте следующую строку:

```
DATABASE_URL="file:./dev.db"
```

## После создания файла

Запустите команды:

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

