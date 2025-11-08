"""
Auth API - Авторизация клиентов
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Form, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from config import config
from database import get_db
from models import Client, Team
from services.auth_service import create_access_token, hash_password, verify_password, get_current_client


router = APIRouter(prefix="/auth")


class LoginRequest(BaseModel):
    username: str  # person_id клиента
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    client_id: str


@router.post("/login", response_model=LoginResponse, include_in_schema=False)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Авторизация клиента в веб-интерфейсе банка
    
    ⚠️ **Для встроенного UI банка, НЕ для внешних приложений**
    
    Этот endpoint используется клиентским интерфейсом банка для входа пользователя.
    Внешние приложения должны использовать стандартный OAuth 2.0 flow.
    
    **Пример:**
    ```json
    {
      "username": "cli-vb-001",
      "password": "password"
    }
    ```
    
    **Ответ:**
    - `access_token` — JWT токен (валиден 24 часа)
    - `token_type` — "bearer"
    - `client_id` — ID клиента
    
    Используйте токен в заголовке: `Authorization: Bearer <token>`
    """
    
    # Найти клиента
    result = await db.execute(
        select(Client).where(Client.person_id == request.username)
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(401, "Invalid credentials")
    
    # В MVP: простая проверка пароля (для упрощения тестирования)
    # В production: проверять хешированный пароль
    
    # Определяем правильный пароль для клиента
    expected_password = None
    
    if request.username.startswith("demo-"):
        # Demo клиенты: пароль = "password"
        expected_password = "password"
    elif request.username.startswith("team"):
        # Командные клиенты: проверяем пароль из таблицы teams
        # Извлекаем номер команды из person_id (team010-1 → team010)
        import re
        match = re.match(r'(team\d+)-\d+', request.username)
        if match:
            team_id = match.group(1)
            
            # Ищем команду в БД
            team_result = await db.execute(
                select(Team).where(Team.client_id == team_id)
            )
            team = team_result.scalar_one_or_none()
            
            if team:
                # Используем client_secret из таблицы teams как пароль
                expected_password = team.client_secret
            else:
                # Команда не найдена в БД - используем fallback "password" для локальной разработки
                expected_password = "password"
        else:
            # Неправильный формат - используем fallback
            expected_password = "password"
    else:
        # Старые клиенты: пароль = username или "password"
        if request.password in [request.username, "password"]:
            expected_password = request.password
    
    # Проверка пароля
    if not expected_password or request.password != expected_password:
        raise HTTPException(401, "Invalid credentials")
    
    # Создать JWT токен
    access_token = create_access_token(
        data={
            "sub": client.person_id,
            "type": "client",
            "bank": "self"
        }
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        client_id=client.person_id
    )


@router.get("/me", include_in_schema=False)
async def get_current_user(
    current_client: dict = Depends(get_current_client)
):
    """Получение информации о текущем клиенте"""
    
    if not current_client:
        raise HTTPException(401, "Not authenticated")
    
    return current_client


@router.post("/bank-token", tags=["0 Аутентификация вызывающей системы"], include_in_schema=True, summary="Получить токен для доступа к API")
async def create_bank_token(
    client_id: str = Query(..., description="ID команды от организаторов", example="team200"),
    client_secret: str = Query(..., description="Secret команды от организаторов", example="5OAaa4DYzYKfnOU6zbR34ic5qMm7VSMB"),
    db: AsyncSession = Depends(get_db)
):
    """
    ## 🎯 Получение токена для работы с API банка
    
    **Этот endpoint - точка входа для всех участников хакатона!**
    
    Токен выдается банком, У КОТОРОГО вы запрашиваете данные.
    Каждый банк подписывает токен своим приватным ключом (RS256).
    
    ### Где взять credentials?
    
    Получите у организаторов хакатона:
    - `client_id` — код вашей команды (например: team200)
    - `client_secret` — ваш секретный ключ (API key)
    
    ### Пример запроса:
    
    ```bash
    # Получить токен для запросов к VBank
    POST https://vbank.open.bankingapi.ru/auth/bank-token
    ?client_id=team200
    &client_secret=5OAaa4DYzYKfnOU6zbR34ic5qMm7VSMB
    
    # Ответ:
    {
      "access_token": "eyJ...",
      "token_type": "bearer",
      "client_id": "team200",
      "expires_in": 86400
    }
    ```
    
    ### Использование токена:
    
    ```bash
    GET https://vbank.open.bankingapi.ru/accounts
    Headers:
      Authorization: Bearer eyJ...
    ```
    
    ### Важно:
    
    - Токен валиден 24 часа
    - Для каждого банка нужен свой токен (VBank, ABank, SBank)
    - Токен подписан приватным ключом банка (RS256)
    - Публичный ключ: `/.well-known/jwks.json`
    
    ### Межбанковые запросы:
    
    Для получения данных клиента из другого банка добавьте:
    ```
    X-Requesting-Bank: your_client_id
    ```
    И создайте согласие: `POST /account-consents`
    """
    from config import config
    
    # Проверить credentials в базе
    result = await db.execute(
        select(Team).where(
            Team.client_id == client_id,
            Team.is_active == True
        )
    )
    team = result.scalar_one_or_none()
    
    if not team:
        raise HTTPException(401, "Invalid client_id")
    
    if team.client_secret != client_secret:
        raise HTTPException(401, "Invalid client_secret")
    
    # Создать токен с HS256 подписью (для упрощения в sandbox)
    access_token = create_access_token(
        data={
            "sub": client_id,
            "client_id": client_id,
            "type": "team",
            "iss": config.BANK_CODE,
            "aud": "openbanking"
        },
        use_rs256=False  # Используем HS256 для токенов команд (проще для sandbox)
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "client_id": client_id,
        "algorithm": "HS256",
        "expires_in": 86400  # 24 часа
    }


@router.post("/banker-login", include_in_schema=False)
async def banker_login(
    username: str = Form(...),
    password: str = Form(...)
):
    """
    Авторизация сотрудника банка
    
    Для доступа к Banker UI и управления продуктами банка.
    """
    # Проверка учетных данных (для хакатона - упрощенная схема)
    if username != "admin" or password != "admin":
        raise HTTPException(401, "Invalid credentials")
    
    from config import config
    
    # Создать токен банкира
    banker_token = create_access_token(
        data={
            "sub": "banker",
            "type": "banker",
            "bank": config.BANK_CODE,
            "username": username
        }
    )
    
    return {
        "access_token": banker_token,
        "token_type": "bearer",
        "role": "banker",
        "username": username
    }


class RandomClientResponse(BaseModel):
    person_id: str
    full_name: str
    password: str


class TeamRegisterRequest(BaseModel):
    """Регистрация команды для хакатона"""
    team_name: str
    client_id: str  # Предпочитаемый client_id (будет проверен на уникальность)
    email: Optional[str] = None  # Опционально
    contact_person: Optional[str] = None  # Опционально
    telegram: Optional[str] = None  # Опционально


@router.get("/random-demo-client", response_model=RandomClientResponse, include_in_schema=False)
async def get_random_demo_client(db: AsyncSession = Depends(get_db)):
    """
    Получить случайного клиента для тестирования
    
    Возвращает случайного клиента с богатой историей транзакций
    для быстрого тестирования интерфейса.
    """
    # Выбираем случайного demo клиента
    result = await db.execute(
        select(Client).where(Client.person_id.like('demo-%')).order_by(func.random()).limit(1)
    )
    client = result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(404, "No demo clients found")
    
    return RandomClientResponse(
        person_id=client.person_id,
        full_name=client.full_name,
        password="demo"
    )


@router.post("/register-team", include_in_schema=False)
async def register_team(
    request: TeamRegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Регистрация команды для участия в хакатоне
    
    Создает учетные данные для доступа к API банка:
    - client_id для межбанковских запросов
    - client_secret для аутентификации
    - 10 тестовых клиентов для UI
    
    **Пример:**
    ```json
    {
      "team_name": "Awesome Team",
      "organisation_name": "Tech Corp",
      "email": "team@example.com",
      "contact_person": "John Doe"
    }
    ```
    """
    import secrets
    import string
    from datetime import datetime
    import re
    
    # Validate client_id format
    if not re.match(r'^team[0-9]+$', request.client_id):
        raise HTTPException(400, "Client ID must match pattern: team<number> (e.g., team201)")
    
    client_id = request.client_id
    
    # Check if already exists
    existing = await db.execute(
        select(Team).where(Team.client_id == client_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Client ID '{client_id}' уже занят. Попробуйте другой.")
    
    # Generate secure client secret
    client_secret = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
    
    # Create team
    # Формируем team_name с контактной информацией
    team_info_parts = [request.team_name]
    if request.email:
        team_info_parts.append(f"📧 {request.email}")
    if request.contact_person:
        team_info_parts.append(f"👤 {request.contact_person}")
    if request.telegram:
        team_info_parts.append(f"📱 {request.telegram}")
    
    team_name_with_contacts = " | ".join(team_info_parts)
    
    new_team = Team(
        client_id=client_id,
        client_secret=client_secret,
        team_name=team_name_with_contacts,  # Включаем всю контактную информацию
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(new_team)
    
    # Create 10 test clients for this team
    test_clients = []
    for i in range(1, 11):
        client = Client(
            person_id=f"{client_id}-{i}",
            client_type="INDIVIDUAL",
            full_name=f"{request.team_name} Test Client {i}",
            segment="MASS",
            birth_year=1990,
            monthly_income=50000,
            created_at=datetime.utcnow()
        )
        db.add(client)
        test_clients.append(f"{client_id}-{i}")
    
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        # Check if it's an integrity error (duplicate key)
        if "duplicate key" in str(e).lower() or "unique constraint" in str(e).lower():
            raise HTTPException(400, f"Тестовые клиенты для '{client_id}' уже существуют. Попробуйте другой Client ID.")
        # Re-raise other exceptions
        raise HTTPException(500, f"Ошибка при создании команды: {str(e)}")
    
    # Determine base URL for links
    # Use 8080 for Docker deployment (regardless of PUBLIC_URL setting)
    # This can be overridden by setting PUBLIC_URL in .env
    if config.PUBLIC_URL.startswith("http://localhost:8"):
        # Default localhost:8xxx ports -> use Docker port 8080
        base_url = "http://localhost:8080"
    else:
        # Custom URL provided
        base_url = config.PUBLIC_URL
    
    return {
        "success": True,
        "message": "Команда успешно зарегистрирована!",
        "credentials": {
            "client_id": client_id,
            "client_secret": client_secret,
            "team_name": request.team_name
        },
        "test_clients": test_clients,
        "test_password": "password",
        "next_steps": "Сохраните Client ID и Client Secret в надежном месте",
        "links": {
            "ui": f"{base_url}/client/",
            "api_docs": f"{base_url}/docs"
        }
    }

