"""
Middleware для логирования API calls
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import time
from datetime import datetime

try:
    from .database import get_db
    from .models import APICallLog
except ImportError:
    from database import get_db
    from models import APICallLog


class APILoggingMiddleware(BaseHTTPMiddleware):
    """
    Логирование всех API запросов
    
    Сохраняет в БД информацию о каждом запросе для аналитики
    """
    
    async def dispatch(self, request: Request, call_next):
        # Пропускаем служебные endpoints
        skip_paths = [
            "/docs",
            "/openapi.json",
            "/health",
            "/static/",
            "/favicon.ico",
            "/.well-known/",
            "/admin/api-calls"  # Не логируем запрос самих логов
        ]
        
        should_skip = any(request.url.path.startswith(path) for path in skip_paths)
        
        # Замер времени
        start_time = time.time()
        
        # Выполнить запрос
        response = await call_next(request)
        
        # Вычислить время ответа
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Логировать если не пропускается
        if not should_skip:
            # Определить caller
            caller_id = "anonymous"
            caller_type = "external"
            person_id = None  # Сохраним конкретный person_id для деталей
            
            # 1. Попробовать извлечь из JWT token
            auth_header = request.headers.get("Authorization", "")
            if "Bearer" in auth_header:
                try:
                    import jwt
                    import re
                    token = auth_header.replace("Bearer ", "")
                    # Декодировать без проверки (только для логирования)
                    decoded = jwt.decode(token, options={"verify_signature": False})
                    
                    # Извлечь caller_id из разных полей
                    if "sub" in decoded:
                        sub_value = decoded["sub"]
                        person_id = sub_value  # Сохраняем оригинальный person_id
                        
                        # Если это team200-1, team200-2, etc - извлечь team ID
                        match = re.match(r'(team\d+)-\d+', str(sub_value))
                        if match:
                            caller_id = match.group(1)  # team200
                            caller_type = "team"
                        elif "client-" in str(sub_value):
                            caller_id = sub_value
                            caller_type = "client"
                        elif str(sub_value).startswith("team"):
                            # Уже в формате team200 (без суффикса)
                            caller_id = sub_value
                            caller_type = "team"
                        else:
                            caller_id = sub_value
                            caller_type = "client"
                    elif "client_id" in decoded:
                        caller_id = decoded["client_id"]
                        caller_type = "team"
                        person_id = caller_id
                except Exception as e:
                    # Debug: логировать ошибки декодирования Authorization header
                    print(f"⚠️  Authorization header decode error: {e}")
            
            # 2. Попробовать извлечь из Cookie (session)
            if caller_id == "anonymous":
                cookie_header = request.headers.get("Cookie", "")
                if "session_token=" in cookie_header or "access_token=" in cookie_header:
                    try:
                        import re
                        # Попытка извлечь из cookie
                        cookies = {}
                        for item in cookie_header.split(';'):
                            if '=' in item:
                                key, val = item.strip().split('=', 1)
                                cookies[key] = val
                        
                        # Попробовать декодировать JWT из cookie
                        token = cookies.get('session_token') or cookies.get('access_token')
                        if token:
                            decoded = jwt.decode(token, options={"verify_signature": False})
                            
                            if "sub" in decoded:
                                sub_value = decoded["sub"]
                                person_id = sub_value  # Сохраняем оригинальный person_id
                                
                                # Если это team200-1, team200-2, etc - извлечь team ID
                                match = re.match(r'(team\d+)-\d+', str(sub_value))
                                if match:
                                    caller_id = match.group(1)  # team200
                                    caller_type = "team"
                                elif "client-" in str(sub_value):
                                    caller_id = sub_value
                                    caller_type = "client"
                                elif str(sub_value).startswith("team"):
                                    caller_id = sub_value
                                    caller_type = "team"
                                else:
                                    caller_id = sub_value
                                    caller_type = "client"
                    except Exception as e:
                        # Debug: логировать ошибки декодирования
                        print(f"⚠️  Cookie decode error: {e}")
            
            # 3. Попробовать извлечь из X-Consent-ID (межбанковские запросы)
            if caller_id == "anonymous":
                consent_id = request.headers.get("X-Consent-ID") or request.headers.get("x-consent-id")
                if consent_id:
                    try:
                        from sqlalchemy import select
                        import re
                        try:
                            from .models import Consent, PaymentConsent, ProductAgreementConsent, VRPConsent, Client
                        except ImportError:
                            from models import Consent, PaymentConsent, ProductAgreementConsent, VRPConsent, Client
                        
                        # Попробовать найти согласие в БД
                        async for db in get_db():
                            # Проверить все типы согласий
                            consent = None
                            client_id = None
                            
                            # 1. Account Consent
                            stmt = select(Consent).where(Consent.consent_id == consent_id)
                            result = await db.execute(stmt)
                            consent = result.scalar_one_or_none()
                            if consent:
                                client_id = consent.client_id
                            
                            # 2. Payment Consent
                            if not consent:
                                stmt = select(PaymentConsent).where(PaymentConsent.consent_id == consent_id)
                                result = await db.execute(stmt)
                                consent = result.scalar_one_or_none()
                                if consent:
                                    client_id = consent.client_id
                            
                            # 3. Product Agreement Consent
                            if not consent:
                                stmt = select(ProductAgreementConsent).where(ProductAgreementConsent.consent_id == consent_id)
                                result = await db.execute(stmt)
                                consent = result.scalar_one_or_none()
                                if consent:
                                    client_id = consent.client_id
                            
                            # 4. VRP Consent
                            if not consent:
                                stmt = select(VRPConsent).where(VRPConsent.consent_id == consent_id)
                                result = await db.execute(stmt)
                                consent = result.scalar_one_or_none()
                                if consent:
                                    client_id = consent.client_id
                            
                            # Если нашли client_id - найти person_id
                            if client_id:
                                stmt = select(Client).where(Client.id == client_id)
                                result = await db.execute(stmt)
                                client = result.scalar_one_or_none()
                                if client and client.person_id:
                                    person_id = client.person_id
                                    
                                    # Извлечь team ID из person_id (team200-1 -> team200)
                                    match = re.match(r'(team\d+)-\d+', str(person_id))
                                    if match:
                                        caller_id = match.group(1)  # team200
                                        caller_type = "team-interbank"
                                    elif str(person_id).startswith("team"):
                                        caller_id = person_id
                                        caller_type = "team-interbank"
                                    else:
                                        caller_id = person_id
                                        caller_type = "interbank"
                            
                            break
                    except Exception as e:
                        # Debug: логировать ошибки извлечения consent
                        print(f"⚠️  Consent ID extraction error: {e}")
            
            # 4. Попробовать извлечь из query параметров (для /auth/bank-token)
            if caller_id == "anonymous":
                query_params = dict(request.query_params)
                if "client_id" in query_params:
                    import re
                    client_id_value = query_params["client_id"]
                    person_id = client_id_value  # Сохраняем полный person_id (team200-1)
                    
                    # Извлечь team ID (team200-1 -> team200)
                    match = re.match(r'(team\d+)-\d+', str(client_id_value))
                    if match:
                        caller_id = match.group(1)  # team200
                        caller_type = "team"
                    elif str(client_id_value).startswith("team"):
                        # Уже в формате team200 (без суффикса)
                        caller_id = client_id_value
                        caller_type = "team"
                        person_id = client_id_value  # Используем как есть
                    else:
                        caller_id = client_id_value
                        caller_type = "client"
            
            # 5. Проверить User-Agent для известных ботов/сканеров
            user_agent = request.headers.get("User-Agent", "")
            if caller_id == "anonymous":
                if "YandexBot" in user_agent:
                    caller_id = "yandex-bot"
                    caller_type = "bot"
                elif "ApiSecurityAnalyzer" in user_agent:
                    caller_id = "security-scanner"
                    caller_type = "scanner"
                elif "Postman" in user_agent:
                    caller_id = "postman-test"
                    caller_type = "testing"
            
            # Сохранить в БД асинхронно (не блокируя ответ)
            try:
                async for db in get_db():
                    log_entry = APICallLog(
                        caller_id=caller_id,
                        caller_type=caller_type,
                        person_id=person_id,  # Конкретный пользователь (team200-1)
                        endpoint=request.url.path,
                        method=request.method,
                        status_code=response.status_code,
                        response_time_ms=response_time_ms,
                        ip_address=request.client.host if request.client else None,
                        user_agent=request.headers.get("User-Agent", "")[:500],
                        created_at=datetime.utcnow(),
                        synced_to_directory=False
                    )
                    
                    db.add(log_entry)
                    await db.commit()
                    break
            except Exception as e:
                # Не ломаем запрос если логирование не удалось
                print(f"⚠️  Failed to log API call: {e}")
        
        return response

