# Настройка команды team251

## Проблема: Backend недоступен или пользователь team251-1 не найден

### Шаг 1: Проверьте что backend запущен

```bash
python run.py
```

Должно появиться:
```
🏦 Starting My Awesome Bank on port 8001
📍 Swagger UI: http://localhost:8001/docs
```

### Шаг 2: Проверьте подключение к backend

```bash
python test_backend_connection.py
```

Или откройте в браузере: `http://localhost:8001/health`

### Шаг 3: Создайте команду team251 и пользователя team251-1

```bash
python create_account.py
```

Или используйте скрипт проверки:
```bash
python check_and_create_user.py
```

Это создаст:
- Команду `team251` в таблице `teams`
- Клиента `team251-1` в таблице `clients`
- Счет для клиента `team251-1`

### Шаг 4: Вход в систему

После создания пользователя, войдите используя:
- **Username:** `team251-1`
- **Password:** `***REMOVED***` (client_secret из config.py)

### Важно!

Пароль для team251-1 - это `TEAM_CLIENT_SECRET` из `config.py`, а не `password`!

Если команда team251 не найдена в БД, система использует секрет из конфига автоматически.

## Проверка в БД

Если нужно проверить что пользователь создан, можно использовать:

```sql
-- Проверка команды
SELECT * FROM teams WHERE client_id = 'team251';

-- Проверка клиента
SELECT * FROM clients WHERE person_id = 'team251-1';

-- Проверка счета
SELECT a.* FROM accounts a
JOIN clients c ON a.client_id = c.id
WHERE c.person_id = 'team251-1';
```

## Устранение проблем

### Backend не запускается

1. Проверьте что порт 8001 свободен
2. Проверьте настройки базы данных в `config.py`
3. Убедитесь что PostgreSQL запущен

### Пользователь не может войти

1. Убедитесь что команда team251 создана: `python create_account.py`
2. Проверьте пароль - должен быть `***REMOVED***`
3. Проверьте что клиент team251-1 существует в БД

### FrontendN не может подключиться к backend

1. Убедитесь что backend запущен на порту 8001
2. Проверьте `FrontendN/.env.local` - должен содержать `NEXT_PUBLIC_BACKEND_URL=http://localhost:8001`
3. Перезапустите FrontendN после изменения `.env.local`

