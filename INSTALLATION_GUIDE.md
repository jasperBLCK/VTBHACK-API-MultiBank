# 🚀 Полный гайд по запуску проекта "Мультибанк"

## 📋 Системные требования

### Минимальные требования
- **CPU**: 2 ядра
- **RAM**: 4 GB  
- **Диск**: 5 GB свободного места
- **Операционная система**: Windows 10/11, macOS, Linux

### Необходимое ПО
- **Docker** 24.0+ и **Docker Compose** 2.0+
- **Git** для клонирования репозитория
- (Опционально) **Node.js** 18+ и **Python** 3.11+ для локальной разработки

---

## 🐳 Вариант 1: Запуск через Docker (Рекомендуется)

### Шаг 1: Подготовка

```bash
# 1. Клонируем репозиторий
git clone https://github.com/jasperBLCK/VTBHACK-API-MultiBank.git
cd VTBHACK-API-MultiBank

# 2. Проверяем установку Docker
docker --version
docker-compose --version
```

### Шаг 2: Настройка переменных окружения

```bash
# Создаем файл .env из шаблона
cp .env.example .env

# Редактируем настройки (опционально)
notepad .env  # Windows
nano .env     # Linux/macOS
```

**Основные настройки в .env:**
```env
# Team Credentials (замените на свои)
TEAM_CLIENT_ID=team251
TEAM_CLIENT_SECRET=your_secret_key

# Bank Settings
BANK_CODE=multibank
BANK_NAME=Мультибанк
BANK_DESCRIPTION=Единый интерфейс финансового сервиса

# Database (по умолчанию подходят для Docker)
POSTGRES_USER=multibank
POSTGRES_PASSWORD=password
POSTGRES_DB=multibank
```

### Шаг 3: Запуск всей платформы

```bash
# Запуск всех сервисов одной командой
docker-compose up -d

# Проверка статуса сервисов
docker-compose ps
```

### Шаг 4: Проверка работы

После запуска будут доступны следующие сервисы:

| Сервис | URL | Описание |
|--------|-----|----------|
| 🎨 **Frontend** | http://localhost:3000 | Основной интерфейс мультибанка |
| 🔧 **Backend API** | http://localhost:8000 | REST API сервер |
| 📚 **API Docs** | http://localhost:8000/docs | Swagger документация |
| 💾 **PostgreSQL** | localhost:5432 | База данных |
| 🚀 **Redis** | localhost:6379 | Кэш сервер |

### Шаг 5: Первый вход

```bash
# Тестовые аккаунты для входа:
Username: team251-1
Password: password

# Или демо аккаунт:
Username: demo-client-001  
Password: password
```

### 🛠️ Управление Docker сервисами

```bash
# Просмотр логов
docker-compose logs -f frontend    # Логи фронтенда
docker-compose logs -f backend     # Логи бэкенда
docker-compose logs -f postgres    # Логи базы данных

# Перезапуск сервисов
docker-compose restart frontend
docker-compose restart backend

# Остановка всех сервисов
docker-compose down

# Полная очистка (удаление данных)
docker-compose down -v --remove-orphans
```

---

## 🔧 Вариант 2: Локальная разработка

### Подготовка окружения

#### 1. Backend (FastAPI)

```bash
# Переход в корневую директорию
cd VTBHACK-API-MultiBank

# Создание виртуального окружения Python
python -m venv venv

# Активация виртуального окружения
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Установка зависимостей
pip install -r requirements.txt

# Настройка базы данных PostgreSQL
# Установите PostgreSQL и создайте базу:
createdb multibank

# Настройка переменных окружения
cp .env.example .env
# Отредактируйте .env файл с настройками локальной БД

# Запуск backend сервера
python run.py
```

Backend будет доступен на: http://localhost:8000

#### 2. Frontend (Next.js)

```bash
# Переход в директорию фронтенда
cd FrontendN

# Установка зависимостей
npm install

# Настройка окружения фронтенда
cp .env.example .env.local

# Редактирование настроек
notepad .env.local  # Windows
nano .env.local     # Linux/macOS
```

**Настройки .env.local:**
```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Database для Prisma
DATABASE_URL="postgresql://multibank:password@localhost:5432/multibank?schema=public"

# VTB API Credentials
NEXT_PUBLIC_VTB_API_URL=https://api.vtb.ru
NEXT_PUBLIC_VTB_CLIENT_ID=your_client_id
NEXT_PUBLIC_VTB_CLIENT_SECRET=your_client_secret
```

```bash
# Генерация Prisma клиента
npx prisma generate

# Применение миграций базы данных
npx prisma db push

# Запуск фронтенда
npm run dev
```

Frontend будет доступен на: http://localhost:3000

#### 3. База данных

```bash
# Вариант 1: PostgreSQL через Docker
docker run -d \
  --name multibank-postgres \
  -e POSTGRES_USER=multibank \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=multibank \
  -p 5432:5432 \
  postgres:16

# Вариант 2: Локальная установка PostgreSQL
# Следуйте инструкциям для вашей ОС на postgresql.org
```

---

## 🔍 Диагностика проблем

### Проблема: Docker сервисы не запускаются

```bash
# Проверка доступности портов
netstat -an | grep :3000
netstat -an | grep :8000
netstat -an | grep :5432

# Освобождение занятых портов (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Очистка Docker системы
docker system prune -a
docker volume prune
```

### Проблема: Frontend не подключается к Backend

1. Проверьте, что backend запущен на http://localhost:8000
2. Убедитесь, что в .env.local указан правильный NEXT_PUBLIC_API_URL
3. Проверьте CORS настройки в backend

### Проблема: Ошибки базы данных

```bash
# Проверка подключения к PostgreSQL
docker exec -it multibank-postgres psql -U multibank -d multibank

# Пересоздание базы данных
docker-compose down -v
docker-compose up -d postgres
# Дождитесь инициализации БД, затем запустите другие сервисы
docker-compose up -d
```

### Проблема: Ошибки npm в Windows

```bash
# Очистка npm кэша
npm cache clean --force

# Удаление node_modules и переустановка
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

---

## 📊 Мониторинг и отладка

### Логи приложения

```bash
# Все логи
docker-compose logs -f

# Логи конкретного сервиса
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Последние 100 строк логов
docker-compose logs --tail=100 backend
```

### Проверка состояния сервисов

```bash
# Статус всех контейнеров
docker-compose ps

# Подробная информация о контейнере
docker inspect multibank-backend

# Использование ресурсов
docker stats
```

### Подключение к контейнерам

```bash
# Подключение к backend контейнеру
docker exec -it multibank-backend bash

# Подключение к базе данных
docker exec -it multibank-postgres psql -U multibank -d multibank

# Подключение к Redis
docker exec -it multibank-redis redis-cli
```

---

## 🎯 Проверка функциональности

После успешного запуска проверьте основные функции:

### 1. Авторизация
- Откройте http://localhost:3000
- Войдите с учетными данными `team251-1` / `password`

### 2. API функциональность
- Откройте http://localhost:8000/docs
- Протестируйте эндпоинты через Swagger UI

### 3. Multibank функции
- В интерфейсе попробуйте подключить банки
- Проверьте агрегацию счетов
- Протестируйте переводы между банками

### 4. Аналитика
- Перейдите в раздел "Аналитика"
- Проверьте отображение графиков и статистики

---

## 🚀 Production деплой

Для production развертывания:

```bash
# Создание production docker-compose файла
cp docker-compose.yml docker-compose.prod.yml

# Редактирование для production (изменить пароли, домены, SSL)
# Добавьте nginx, SSL сертификаты, мониторинг

# Production запуск
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🆘 Получить помощь

Если возникли проблемы:

1. **Проверьте логи** приложения
2. **Убедитесь**, что все порты свободны
3. **Перезапустите** Docker сервисы
4. **Создайте issue** в GitHub репозитории
5. **Напишите в Telegram**: @jasperblck_team

---

**🏆 Успешного запуска и удачи на хакатоне!**