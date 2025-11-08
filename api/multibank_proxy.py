"""
Multibank Proxy API - Проксирование запросов к другим банкам
Реализует правильный OpenBanking flow через consent (согласия)
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
import httpx
import logging
from config import config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/multibank", tags=["Internal: Multibank"], include_in_schema=False)

# Креды команды из конфига
# TEAM_CLIENT_ID - это ID команды (например, "team251"), используется для межбанковских запросов
# Не путать с client_id пользователя (например, "team251-1")
# Эти креды используются для получения банковского токена от песочниц банков
TEAM_CLIENT_ID = config.TEAM_CLIENT_ID or "team251"
TEAM_CLIENT_SECRET = config.TEAM_CLIENT_SECRET or "iOin4bZP3rRl44r7TNy5ZigMUjcQIem1"

logger.info(f"Multibank API: TEAM_CLIENT_ID={TEAM_CLIENT_ID}, TEAM_CLIENT_SECRET={'*' * 10}")


class BankTokenRequest(BaseModel):
    bank_url: str


class ConsentRequest(BaseModel):
    bank_url: str
    bank_token: str
    client_id: str  # ID клиента в целевом банке


class AccountsWithConsentRequest(BaseModel):
    bank_url: str
    bank_token: str
    consent_id: str
    client_id: str


class LoginRequest(BaseModel):
    bank_url: str
    username: str = "demo-client-001"
    password: str = "password"


class ProxyRequest(BaseModel):
    bank_url: str
    endpoint: str
    token: str


@router.post("/bank-token")
async def get_bank_token(request: BankTokenRequest):
    """
    ШАГ 1: Получить банковский токен для межбанковых операций
    
    Использует креды команды (client_id и client_secret) для доступа к песочницам банков
    Для команды team251: client_id=team251, client_secret из конфига
    """
    try:
        logger.info(f"Запрос банковского токена от {request.bank_url} используя TEAM_CLIENT_ID={TEAM_CLIENT_ID}")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{request.bank_url}/auth/bank-token",
                params={
                    "client_id": TEAM_CLIENT_ID,
                    "client_secret": TEAM_CLIENT_SECRET
                },
                headers={"accept": "application/json"}
            )
            
            logger.info(f"Ответ от {request.bank_url}/auth/bank-token: статус {response.status_code}")
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"Ошибка получения банковского токена от {request.bank_url}: {error_text}")
                raise HTTPException(
                    response.status_code, 
                    f"Failed to get bank token: {error_text}"
                )
            
            token_data = response.json()
            logger.info(f"✅ Банковский токен успешно получен от {request.bank_url}")
            return token_data
            
    except httpx.TimeoutException:
        raise HTTPException(504, "Bank server timeout")
    except httpx.RequestError as e:
        raise HTTPException(502, f"Connection error: {str(e)}")


@router.post("/request-consent")
async def request_consent(request: ConsentRequest):
    """
    ШАГ 2: Запросить согласие на доступ к счетам клиента
    
    Требуется банковский токен из шага 1
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Запрос на создание consent (формат согласно API банков)
            consent_data = {
                "client_id": request.client_id,
                "permissions": [
                    "ReadAccountsBasic", 
                    "ReadAccountsDetail", 
                    "ReadBalances", 
                    "ReadTransactionsDetail"
                ],
                "expiration_date": "2025-12-31T23:59:59.000Z"
            }
            
            response = await client.post(
                f"{request.bank_url}/account-consents/request",
                json=consent_data,
                headers={
                    "Authorization": f"Bearer {request.bank_token}",
                    "Content-Type": "application/json",
                    "x-requesting-bank": TEAM_CLIENT_ID  # ВАЖНО: указываем requesting_bank!
                }
            )
            
            if response.status_code not in [200, 201]:
                raise HTTPException(
                    response.status_code,
                    f"Failed to request consent: {response.text}"
                )
            
            return response.json()
            
    except httpx.TimeoutException:
        raise HTTPException(504, "Bank server timeout")
    except httpx.RequestError as e:
        raise HTTPException(502, f"Connection error: {str(e)}")


@router.post("/accounts-with-consent")
async def get_accounts_with_consent(request: AccountsWithConsentRequest):
    """
    ШАГ 3: Получить счета клиента используя consent
    
    Требуется банковский токен и consent_id из предыдущих шагов
    """
    try:
        logger.info(f"Запрос счетов из банка {request.bank_url} для client_id={request.client_id} с consent_id={request.consent_id}")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"{request.bank_url}/accounts"
            headers = {
                "accept": "application/json",
                "Authorization": f"Bearer {request.bank_token}",
                "x-consent-id": request.consent_id,
                "x-requesting-bank": TEAM_CLIENT_ID
            }
            params = {"client_id": request.client_id}
            
            logger.info(f"Отправка запроса GET {url} с параметрами: {params}, headers: x-consent-id={request.consent_id}, x-requesting-bank={TEAM_CLIENT_ID}")
            
            response = await client.get(url, headers=headers, params=params)
            
            logger.info(f"Ответ от {request.bank_url}: статус {response.status_code}")
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"Ошибка получения счетов из {request.bank_url}: {error_text}")
                raise HTTPException(
                    response.status_code,
                    f"Failed to get accounts: {error_text}"
                )
            
            accounts_data = response.json()
            account_count = len(accounts_data.get("data", {}).get("account", []))
            logger.info(f"Получено {account_count} счетов из {request.bank_url} для client_id={request.client_id}")
            
            return accounts_data
            
    except httpx.TimeoutException:
        raise HTTPException(504, "Bank server timeout")
    except httpx.RequestError as e:
        raise HTTPException(502, f"Connection error: {str(e)}")


@router.post("/login")
async def proxy_login(request: LoginRequest):
    """
    УСТАРЕВШИЙ: Прямой логин (оставлен для обратной совместимости)
    
    Используйте новый flow: bank-token -> request-consent -> accounts-with-consent
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{request.bank_url}/auth/login",
                json={
                    "username": request.username,
                    "password": request.password
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(response.status_code, "Authentication failed")
            
            return response.json()
            
    except httpx.TimeoutException:
        raise HTTPException(504, "Bank server timeout")
    except httpx.RequestError as e:
        raise HTTPException(502, f"Connection error: {str(e)}")


@router.post("/accounts")
async def proxy_accounts(request: ProxyRequest):
    """
    Проксирует запрос получения счетов к другому банку
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{request.bank_url}{request.endpoint}",
                headers={
                    "Authorization": f"Bearer {request.token}"
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(response.status_code, "Failed to fetch accounts")
            
            return response.json()
            
    except httpx.TimeoutException:
        raise HTTPException(504, "Bank server timeout")
    except httpx.RequestError as e:
        raise HTTPException(502, f"Connection error: {str(e)}")


@router.post("/balances-with-consent")
async def get_balance_with_consent(
    account_id: str,
    bank_url: str,
    bank_token: str,
    consent_id: str
):
    """
    Получить баланс счета используя consent (правильный OpenBanking flow)
    """
    try:
        logger.info(f"Запрос баланса для account_id={account_id} из банка {bank_url}")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            balance_url = f"{bank_url}/accounts/{account_id}/balances"
            response = await client.get(
                balance_url,
                headers={
                    "accept": "application/json",
                    "Authorization": f"Bearer {bank_token}",
                    "x-consent-id": consent_id,
                    "x-requesting-bank": TEAM_CLIENT_ID
                }
            )
            
            logger.info(f"Ответ баланса от {bank_url} для account_id={account_id}: статус {response.status_code}")
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"Ошибка получения баланса для account_id={account_id} из {bank_url}: {error_text}")
                raise HTTPException(response.status_code, f"Failed to fetch balance: {error_text}")
            
            balance_data = response.json()
            balance_amount = balance_data.get("data", {}).get("balance", [{}])[0].get("amount", {}).get("amount", "0")
            logger.info(f"Баланс для account_id={account_id} из {bank_url}: {balance_amount}")
            
            return balance_data
            
    except httpx.TimeoutException:
        raise HTTPException(504, "Bank server timeout")
    except httpx.RequestError as e:
        raise HTTPException(502, f"Connection error: {str(e)}")


@router.get("/accounts/{account_id}/balances")
async def proxy_balance(
    account_id: str,
    bank_url: str,
    token: str
):
    """
    УСТАРЕВШИЙ: Получить баланс (старый метод, оставлен для совместимости)
    
    Используйте balances-with-consent для правильного OpenBanking flow
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{bank_url}/accounts/{account_id}/balances",
                headers={
                    "Authorization": f"Bearer {token}"
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(response.status_code, "Failed to fetch balance")
            
            return response.json()
            
    except httpx.TimeoutException:
        raise HTTPException(504, "Bank server timeout")
    except httpx.RequestError as e:
        raise HTTPException(502, f"Connection error: {str(e)}")

