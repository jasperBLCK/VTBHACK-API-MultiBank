# 🚀 FastAPI в Bank-in-a-Box - Подробное руководство

Руководство по использованию FastAPI в этом проекте. Объяснение всех паттернов и концепций.

---

## 📚 Содержание

1. [Базовые концепции](#базовые-концепции)
2. [Роутеры (Routers)](#роутеры-routers)
3. [Dependency Injection (Depends)](#dependency-injection-depends)
4. [Async функции](#async-функции)
5. [Pydantic модели](#pydantic-модели)
6. [Параметры запросов](#параметры-запросов)
7. [Обработка ошибок](#обработка-ошибок)
8. [Response модели](#response-модели)
9. [Заголовки (Headers)](#заголовки-headers)
10. [Middleware](#middleware)
11. [Реальные примеры из проекта](#реальные-примеры-из-проекта)

---

## 🎯 Базовые концепции

### Что такое FastAPI?

FastAPI - современный веб-фреймворк для создания API на Python. Основные особенности:
- **Автоматическая документация** (Swagger/OpenAPI)
- **Валидация данных** через Pydantic
- **Асинхронность** (async/await)
- **Типизация** (type hints)
- **Dependency Injection** встроенный

---

## 🔀 Роутеры (Routers)

### Что это?

Роутеры позволяют разделять API на модули. В проекте каждый файл в `api/` - это отдельный роутер.

### Как создается роутер?

```python
from fastapi import APIRouter

router = APIRouter(
    prefix="/accounts",  # Префикс для всех endpoints
    tags=["2 Счета и балансы"]  # Тег для документации
)
```

**Пример из проекта:** `api/accounts.py`
```python
router = APIRouter(prefix="/accounts", tags=["2 Счета и балансы"])
```

### Как регистрируется роутер?

В `main.py`:
```python
from api import accounts, consents, payments

app = FastAPI()

app.include_router(accounts.router)
app.include_router(consents.router)
app.include_router(payments.router)
```

### Зачем это нужно?

- ✅ Организация кода по модулям
- ✅ Легко добавлять/удалять endpoints
- ✅ Автоматическая группировка в документации
- ✅ Можно использовать одинаковые имена функций в разных роутерах

---

## 🔌 Dependency Injection (Depends)

### Что это?

**Dependency Injection** - это паттерн, где зависимости передаются извне, а не создаются внутри функции.

### Как работает в FastAPI?

FastAPI использует `Depends()` для внедрения зависимостей:

```python
from fastapi import Depends
from database import get_db
from services.auth_service import get_current_client

async def get_accounts(
    db: AsyncSession = Depends(get_db),  # ← Внедрение БД сессии
    current_client: dict = Depends(get_current_client)  # ← Внедрение клиента
):
    # db и current_client уже доступны!
    return accounts
```

### Примеры зависимостей в проекте:

#### 1. База данных (get_db)

**Файл:** `database.py`
```python
async def get_db():
    async with AsyncSession(engine) as session:
        yield session  # yield вместо return для контекстного менеджера
        await session.close()
```

**Использование:**
```python
@router.get("/accounts")
async def get_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Account))
    return result.scalars().all()
```

**Что происходит:**
1. FastAPI вызывает `get_db()`
2. Создается сессия БД
3. Сессия передается в функцию
4. После выполнения функции сессия закрывается

#### 2. Авторизация (get_current_client)

**Файл:** `services/auth_service.py`
```python
async def get_current_client(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> dict:
    # 1. Извлекаем токен из заголовка Authorization
    token = credentials.credentials
    
    # 2. Проверяем токен
    payload = verify_token(token)
    
    # 3. Проверяем тип токена
    if payload.get("type") != "client":
        raise HTTPException(401, "Invalid token type")
    
    # 4. Возвращаем данные клиента
    return {
        "client_id": payload.get("sub"),
        "type": payload.get("type")
    }
```

**Использование:**
```python
@router.get("/accounts")
async def get_accounts(
    current_client: dict = Depends(get_current_client)  # ← Автоматически проверяет авторизацию
):
    # current_client уже содержит данные клиента
    client_id = current_client["client_id"]
    return accounts
```

**Что происходит:**
1. FastAPI извлекает токен из заголовка `Authorization: Bearer <token>`
2. Вызывает `get_current_client()`
3. Проверяет токен
4. Если токен валиден → передает данные клиента в функцию
5. Если токен невалиден → возвращает ошибку 401

#### 3. Опциональная авторизация (get_optional_client)

**Файл:** `services/auth_service.py`
```python
async def get_optional_client(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    db: AsyncSession = Depends(get_db)
) -> Optional[dict]:
    if not credentials:
        return None  # Нет токена - возвращаем None
    
    try:
        token = credentials.credentials
        payload = verify_token(token)
        if payload.get("type") != "client":
            return None
        return {
            "client_id": payload.get("sub"),
            "type": payload.get("type")
        }
    except:
        return None  # Ошибка - возвращаем None
```

**Использование:**
```python
@router.get("/accounts")
async def get_accounts(
    current_client: Optional[dict] = Depends(get_optional_client)  # ← Опционально
):
    if current_client:
        # Запрос от авторизованного клиента
        client_id = current_client["client_id"]
    else:
        # Запрос без авторизации (межбанковский)
        # Проверяем x-requesting-bank
        pass
```

**Зачем это нужно?**
- Для межбанковских запросов авторизация может быть необязательной
- Нужно проверять заголовок `x-requesting-bank` вместо токена

---

## ⚡ Async функции

### Что это?

**Async функции** - это функции, которые могут выполняться асинхронно, не блокируя выполнение других операций.

### Как работает?

```python
# Обычная функция (синхронная)
def get_accounts():
    result = db.execute(select(Account))  # Блокирует выполнение
    return result.scalars().all()

# Async функция (асинхронная)
async def get_accounts():
    result = await db.execute(select(Account))  # Не блокирует выполнение
    return result.scalars().all()
```

### Ключевые слова:

- **`async def`** - определяет асинхронную функцию
- **`await`** - ждет завершения асинхронной операции

### Пример из проекта:

```python
@router.get("/accounts")
async def get_accounts(db: AsyncSession = Depends(get_db)):
    # await - ждет завершения запроса к БД
    result = await db.execute(select(Account))
    accounts = result.scalars().all()
    return accounts
```

### Зачем это нужно?

- ✅ Не блокирует выполнение других запросов
- ✅ Можно обрабатывать много запросов одновременно
- ✅ Быстрее для I/O операций (БД, HTTP запросы)

---

## 📦 Pydantic модели

### Что это?

**Pydantic** - библиотека для валидации данных. Модели автоматически валидируют и преобразуют данные.

### Как создается модель?

```python
from pydantic import BaseModel, Field
from typing import Optional

class CreateAccountRequest(BaseModel):
    account_type: str  # Обязательное поле
    currency: str = "RUB"  # Поле со значением по умолчанию
    name: Optional[str] = None  # Опциональное поле
    balance: float = Field(default=0.0, ge=0)  # Поле с валидацией (>= 0)
```

### Как используется?

```python
@router.post("/accounts")
async def create_account(request: CreateAccountRequest):  # ← FastAPI автоматически валидирует
    # request уже содержит валидированные данные
    account_type = request.account_type
    currency = request.currency
    return {"account_id": "acc-123"}
```

**Что происходит:**
1. FastAPI получает JSON из body запроса
2. Автоматически валидирует данные по модели
3. Если данные невалидны → возвращает ошибку 422
4. Если данные валидны → передает объект в функцию

### Пример из проекта:

**Файл:** `api/accounts.py`
```python
class CreateAccountRequest(BaseModel):
    account_type: str
    currency: str = "RUB"
    name: Optional[str] = None

@router.post("")
async def create_account(
    request: CreateAccountRequest,  # ← Автоматическая валидация
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    # request уже валидирован
    account = Account(
        account_type=request.account_type,
        currency=request.currency
    )
    db.add(account)
    await db.commit()
    return {"account_id": f"acc-{account.id}"}
```

### Валидация полей:

```python
from pydantic import Field, validator

class PaymentRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Сумма должна быть > 0")
    currency: str = Field(default="RUB", regex="^[A-Z]{3}$")
    
    @validator('amount')
    def validate_amount(cls, v):
        if v > 1000000:
            raise ValueError('Сумма слишком большая')
        return v
```

---

## 📥 Параметры запросов

### 1. Path параметры

**Что это?** Параметры в URL пути.

```python
@router.get("/accounts/{account_id}")  # ← account_id в пути
async def get_account(account_id: str):  # ← Получаем из URL
    return {"account_id": account_id}
```

**Пример запроса:**
```
GET /accounts/acc-123
→ account_id = "acc-123"
```

**Пример из проекта:**
```python
@router.get("/{account_id}")
async def get_account(
    account_id: str,  # ← Path параметр
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Account).where(Account.id == int(account_id.replace("acc-", "")))
    )
    return result.scalar_one_or_none()
```

### 2. Query параметры

**Что это?** Параметры после `?` в URL.

```python
@router.get("/accounts")
async def get_accounts(
    client_id: Optional[str] = None,  # ← Query параметр
    limit: int = 10  # ← Query параметр со значением по умолчанию
):
    return {"client_id": client_id, "limit": limit}
```

**Пример запроса:**
```
GET /accounts?client_id=team251-1&limit=20
→ client_id = "team251-1"
→ limit = 20
```

**Явное указание Query:**
```python
from fastapi import Query

@router.get("/accounts")
async def get_accounts(
    client_id: Optional[str] = Query(None, description="ID клиента"),
    limit: int = Query(10, ge=1, le=100)  # ← Валидация: от 1 до 100
):
    return accounts
```

**Пример из проекта:**
```python
@router.get("")
async def get_accounts(
    client_id: Optional[str] = None,  # ← Query параметр
    x_consent_id: Optional[str] = Header(None, alias="x-consent-id"),
    db: AsyncSession = Depends(get_db)
):
    if client_id:
        # Межбанковский запрос
        pass
    else:
        # Запрос от текущего клиента
        pass
```

### 3. Body параметры

**Что это?** Данные в теле запроса (JSON).

```python
@router.post("/accounts")
async def create_account(request: CreateAccountRequest):  # ← Body параметр
    return {"account_id": "acc-123"}
```

**Пример запроса:**
```
POST /accounts
Content-Type: application/json

{
  "account_type": "current",
  "currency": "RUB"
}
```

**Пример из проекта:**
```python
class ConsentRequest(BaseModel):
    bank_url: str
    bank_token: str
    client_id: str

@router.post("/request-consent")
async def request_consent(request: ConsentRequest):  # ← Body параметр
    # request.bank_url, request.bank_token, request.client_id доступны
    return {"consent_id": "consent-123"}
```

### 4. Заголовки (Headers)

**Что это?** Данные в HTTP заголовках.

```python
from fastapi import Header

@router.get("/accounts")
async def get_accounts(
    x_consent_id: Optional[str] = Header(None, alias="x-consent-id"),  # ← Заголовок
    authorization: str = Header(..., alias="authorization")  # ← Обязательный заголовок
):
    return accounts
```

**Пример запроса:**
```
GET /accounts
x-consent-id: consent-123
Authorization: Bearer token-xyz
```

**Пример из проекта:**
```python
@router.get("")
async def get_accounts(
    x_consent_id: Optional[str] = Header(None, alias="x-consent-id"),
    x_requesting_bank: Optional[str] = Header(None, alias="x-requesting-bank"),
    db: AsyncSession = Depends(get_db)
):
    if x_requesting_bank:
        # Межбанковский запрос
        # Проверяем согласие через x_consent_id
        pass
```

**Особенности:**
- `alias` - указывает имя заголовка (может отличаться от имени параметра)
- Заголовки с `-` автоматически преобразуются в `_` (например, `x-consent-id` → `x_consent_id`)
- `Header(...)` - обязательный заголовок
- `Header(None)` - опциональный заголовок

---

## ⚠️ Обработка ошибок

### HTTPException

**Что это?** Исключение для возврата HTTP ошибок.

```python
from fastapi import HTTPException

@router.get("/accounts/{account_id}")
async def get_account(account_id: str, db: AsyncSession = Depends(get_db)):
    account = await db.execute(select(Account).where(Account.id == account_id))
    account = account.scalar_one_or_none()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")  # ← Возвращает 404
    
    return account
```

### Примеры из проекта:

```python
# 401 Unauthorized
if not current_client:
    raise HTTPException(401, "Unauthorized")

# 404 Not Found
if not account:
    raise HTTPException(404, "Account not found")

# 403 Forbidden
if not consent:
    raise HTTPException(
        403,
        detail={
            "error": "CONSENT_REQUIRED",
            "message": "Требуется согласие клиента"
        }
    )

# 400 Bad Request
if not client_id:
    raise HTTPException(400, "client_id required for interbank requests")
```

### Обработка исключений БД:

```python
try:
    result = await db.execute(select(Account))
    accounts = result.scalars().all()
except Exception as e:
    raise HTTPException(500, f"Database error: {str(e)}")
```

---

## 📤 Response модели

### Что это?

**Response модели** - определяют формат ответа API.

```python
from pydantic import BaseModel

class AccountResponse(BaseModel):
    account_id: str
    status: str
    balance: float

@router.get("/accounts/{account_id}", response_model=AccountResponse)
async def get_account(account_id: str):
    return AccountResponse(
        account_id="acc-123",
        status="active",
        balance=1000.0
    )
```

### Пример из проекта:

```python
class ConsentResponse(BaseModel):
    data: ConsentData
    links: dict
    meta: Optional[dict] = {}

@router.post("", response_model=ConsentResponse, status_code=201)
async def create_consent(request: ConsentCreateRequest):
    # FastAPI автоматически валидирует ответ по модели
    return ConsentResponse(
        data=consent_data,
        links={},
        meta={}
    )
```

### Status codes:

```python
@router.post("/accounts", status_code=201)  # ← Возвращает 201 вместо 200
async def create_account(request: CreateAccountRequest):
    return {"account_id": "acc-123"}

@router.delete("/accounts/{account_id}", status_code=204)  # ← Возвращает 204 (No Content)
async def delete_account(account_id: str):
    # Нет return - возвращает пустой ответ
    pass
```

---

## 🔒 Заголовки (Headers) - подробнее

### Авторизация через заголовок:

```python
from fastapi.security import HTTPBearer

security = HTTPBearer()  # Извлекает токен из заголовка Authorization

async def get_current_client(
    credentials: HTTPAuthorizationCredentials = Depends(security)  # ← Автоматически извлекает токен
):
    token = credentials.credentials  # Токен из Authorization: Bearer <token>
    payload = verify_token(token)
    return payload
```

### Кастомные заголовки:

```python
@router.get("/accounts")
async def get_accounts(
    x_consent_id: Optional[str] = Header(None, alias="x-consent-id"),
    x_requesting_bank: Optional[str] = Header(None, alias="x-requesting-bank")
):
    # x_consent_id получается из заголовка x-consent-id
    # x_requesting_bank получается из заголовка x-requesting-bank
    pass
```

---

## 🔄 Middleware

### Что это?

**Middleware** - функции, которые выполняются до/после обработки запроса.

### CORS Middleware:

**Файл:** `main.py`
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8001"],  # Разрешенные домены
    allow_credentials=True,
    allow_methods=["*"],  # Разрешенные HTTP методы
    allow_headers=["*"]  # Разрешенные заголовки
)
```

**Что делает:**
- Разрешает запросы с других доменов
- Нужно для работы фронтенда на другом порту/домене

### Custom Middleware:

**Файл:** `middleware.py`
```python
class APILoggingMiddleware:
    async def __call__(self, request: Request, call_next):
        # Выполняется перед обработкой запроса
        start_time = time.time()
        
        # Обрабатываем запрос
        response = await call_next(request)
        
        # Выполняется после обработки запроса
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        
        return response
```

---

## 💡 Реальные примеры из проекта

### Пример 1: Простой GET endpoint

**Файл:** `api/products.py`
```python
@router.get("", summary="Получить продукты")
async def get_products(
    product_type: str = None,  # ← Query параметр
    db: AsyncSession = Depends(get_db)  # ← Dependency Injection
):
    query = select(Product).where(Product.is_active == True)
    
    if product_type:
        query = query.where(Product.product_type == product_type)
    
    result = await db.execute(query)  # ← Async запрос к БД
    products = result.scalars().all()
    
    return {
        "data": {
            "product": [
                {
                    "productId": p.product_id,
                    "productType": p.product_type,
                    "productName": p.name
                }
                for p in products
            ]
        }
    }
```

**Что происходит:**
1. Запрос: `GET /products?product_type=deposit`
2. FastAPI извлекает `product_type` из query параметров
3. FastAPI вызывает `get_db()` для получения сессии БД
4. Функция выполняет запрос к БД
5. Возвращает JSON ответ

### Пример 2: POST endpoint с авторизацией

**Файл:** `api/accounts.py`
```python
@router.post("", summary="Создать счет")
async def create_account(
    request: CreateAccountRequest,  # ← Body параметр (Pydantic модель)
    current_client: dict = Depends(get_current_client),  # ← Dependency Injection (авторизация)
    db: AsyncSession = Depends(get_db)  # ← Dependency Injection (БД)
):
    # current_client уже содержит данные клиента (проверено автоматически)
    client_id = current_client["client_id"]
    
    # request уже валидирован (Pydantic)
    account = Account(
        account_type=request.account_type,
        currency=request.currency,
        client_id=client_id
    )
    
    db.add(account)
    await db.commit()  # ← Async операция
    
    return {"account_id": f"acc-{account.id}"}
```

**Что происходит:**
1. Запрос: `POST /accounts` с JSON body
2. FastAPI валидирует body по модели `CreateAccountRequest`
3. FastAPI проверяет авторизацию через `get_current_client()`
4. FastAPI получает сессию БД через `get_db()`
5. Функция создает счет и возвращает ответ

### Пример 3: Межбанковский запрос с заголовками

**Файл:** `api/accounts.py`
```python
@router.get("")
async def get_accounts(
    client_id: Optional[str] = None,  # ← Query параметр
    x_consent_id: Optional[str] = Header(None, alias="x-consent-id"),  # ← Заголовок
    x_requesting_bank: Optional[str] = Header(None, alias="x-requesting-bank"),  # ← Заголовок
    current_client: Optional[dict] = Depends(get_optional_client),  # ← Опциональная авторизация
    db: AsyncSession = Depends(get_db)
):
    # Определяем тип запроса
    if x_requesting_bank:
        # Межбанковский запрос - требуется согласие
        if not client_id:
            raise HTTPException(400, "client_id required for interbank requests")
        
        # Проверяем согласие
        consent = await ConsentService.check_consent(
            db=db,
            client_person_id=client_id,
            requesting_bank=x_requesting_bank,
            permissions=["ReadAccountsDetail"]
        )
        
        if not consent:
            raise HTTPException(
                403,
                detail={
                    "error": "CONSENT_REQUIRED",
                    "message": "Требуется согласие клиента"
                }
            )
        
        target_client_id = client_id
    else:
        # Запрос собственного клиента
        if not current_client:
            raise HTTPException(401, "Unauthorized")
        target_client_id = current_client["client_id"]
    
    # Получаем счета
    result = await db.execute(
        select(Account).where(Account.client_id == target_client_id)
    )
    accounts = result.scalars().all()
    
    return {"data": {"account": accounts}}
```

**Что происходит:**
1. Запрос: `GET /accounts?client_id=team251-1` с заголовками
2. FastAPI извлекает query параметры и заголовки
3. Проверяет тип запроса (межбанковский или собственный)
4. Для межбанковского запроса проверяет согласие
5. Возвращает счета

### Пример 4: Multibank Proxy с HTTP запросами

**Файл:** `api/multibank_proxy.py`
```python
@router.post("/request-consent")
async def request_consent(request: ConsentRequest):  # ← Body параметр
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:  # ← Async HTTP клиент
            # Делаем запрос к другому банку
            response = await client.post(
                f"{request.bank_url}/account-consents/request",
                json={
                    "client_id": request.client_id,
                    "permissions": ["ReadAccountsDetail"]
                },
                headers={
                    "Authorization": f"Bearer {request.bank_token}",
                    "x-requesting-bank": TEAM_CLIENT_ID
                }
            )
            
            if response.status_code not in [200, 201]:
                raise HTTPException(
                    response.status_code,
                    f"Failed to request consent: {response.text}"
                )
            
            return response.json()  # ← Возвращаем JSON ответ
            
    except httpx.TimeoutException:
        raise HTTPException(504, "Bank server timeout")
    except httpx.RequestError as e:
        raise HTTPException(502, f"Connection error: {str(e)}")
```

**Что происходит:**
1. Запрос: `POST /multibank/request-consent` с JSON body
2. FastAPI валидирует body по модели `ConsentRequest`
3. Функция делает HTTP запрос к другому банку
4. Обрабатывает ответ и ошибки
5. Возвращает результат

---

## 🎓 Частые паттерны в проекте

### 1. Получение данных из БД

```python
@router.get("/accounts/{account_id}")
async def get_account(account_id: str, db: AsyncSession = Depends(get_db)):
    # Выполняем запрос
    result = await db.execute(
        select(Account).where(Account.id == account_id)
    )
    
    # Получаем один объект
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(404, "Account not found")
    
    return account
```

### 2. Создание данных в БД

```python
@router.post("/accounts")
async def create_account(
    request: CreateAccountRequest,
    db: AsyncSession = Depends(get_db)
):
    # Создаем объект
    account = Account(
        account_type=request.account_type,
        currency=request.currency
    )
    
    # Добавляем в сессию
    db.add(account)
    
    # Сохраняем изменения
    await db.commit()
    
    # Обновляем объект (получаем ID)
    await db.refresh(account)
    
    return {"account_id": f"acc-{account.id}"}
```

### 3. Обновление данных в БД

```python
@router.put("/accounts/{account_id}")
async def update_account(
    account_id: str,
    request: UpdateAccountRequest,
    db: AsyncSession = Depends(get_db)
):
    # Находим объект
    result = await db.execute(
        select(Account).where(Account.id == account_id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(404, "Account not found")
    
    # Обновляем поля
    account.balance = request.balance
    account.status = request.status
    
    # Сохраняем изменения
    await db.commit()
    
    return account
```

### 4. Удаление данных из БД

```python
@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: str,
    db: AsyncSession = Depends(get_db)
):
    # Находим объект
    result = await db.execute(
        select(Account).where(Account.id == account_id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(404, "Account not found")
    
    # Удаляем объект
    await db.delete(account)
    
    # Сохраняем изменения
    await db.commit()
    
    return {"message": "Account deleted"}
```

---

## 🔍 Отладка

### Как посмотреть документацию API?

1. Запустите сервер: `python run.py`
2. Откройте: `http://localhost:8080/docs`
3. Там будет Swagger UI с всеми endpoints

### Как посмотреть логи?

```python
import logging

logger = logging.getLogger(__name__)

@router.get("/accounts")
async def get_accounts(db: AsyncSession = Depends(get_db)):
    logger.info("Запрос счетов")  # ← Логирование
    result = await db.execute(select(Account))
    return result.scalars().all()
```

### Как тестировать endpoints?

```python
# Через curl
curl -X GET "http://localhost:8080/accounts" \
  -H "Authorization: Bearer <token>"

# Через Python
import httpx

async with httpx.AsyncClient() as client:
    response = await client.get(
        "http://localhost:8080/accounts",
        headers={"Authorization": "Bearer <token>"}
    )
    print(response.json())
```

---

## ✅ Чеклист понимания

Проверьте, что вы понимаете:

- [ ] Как создаются роутеры
- [ ] Как работает Dependency Injection (Depends)
- [ ] Как работают async функции
- [ ] Как создаются Pydantic модели
- [ ] Как извлекаются параметры (path, query, body, headers)
- [ ] Как обрабатываются ошибки (HTTPException)
- [ ] Как определяются response модели
- [ ] Как работает авторизация через Depends
- [ ] Как работают заголовки
- [ ] Как делаются запросы к БД
- [ ] Как делаются HTTP запросы к другим сервисам

---

## 🎯 Итог

FastAPI в этом проекте использует:
1. **Роутеры** - для организации endpoints
2. **Dependency Injection** - для БД, авторизации, etc.
3. **Async/await** - для асинхронных операций
4. **Pydantic** - для валидации данных
5. **Заголовки** - для межбанковских запросов
6. **HTTPException** - для обработки ошибок

Все это работает автоматически - FastAPI делает большую часть работы за вас! 🚀


