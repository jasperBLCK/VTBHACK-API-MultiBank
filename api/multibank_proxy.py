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


class TransactionsWithConsentRequest(BaseModel):
    account_id: str
    bank_url: str
    bank_token: str
    consent_id: str


class CardsWithConsentRequest(BaseModel):
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
        
        async with httpx.AsyncClient(timeout=30.0) as client:
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
    Для SBank: отправляем ОДИН запрос и ждем подписания до 20 секунд
    """
    import asyncio
    import time
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Запрос на создание consent (формат согласно API банков)
            consent_data = {
                "client_id": request.client_id,
                "permissions": [
                    "ReadAccountsBasic", 
                    "ReadAccountsDetail", 
                    "ReadBalances", 
                    "ReadTransactionsDetail",
                    "ReadCards"  # Добавляем разрешение на чтение карт
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
            
            consent_response = response.json()
            
            # Проверяем, является ли это SBank
            is_sbank = "sbank" in request.bank_url.lower() or "smart" in request.bank_url.lower()
            
            # Если это SBank и согласие требует подписания
            if is_sbank:
                request_id = (
                    consent_response.get("Data", {}).get("ConsentRequestId") or
                    consent_response.get("request_id") or
                    consent_response.get("ConsentRequestId")
                )
                
                # Если есть request_id, значит требуется подписание
                if request_id and not consent_response.get("Data", {}).get("ConsentId"):
                    logger.info(f"SBank: требуется подписание согласия request_id={request_id}, ждем до 20 секунд...")
                    
                    # Ждем подписания до 20 секунд (ОДИН запрос, без polling каждые 4 секунды)
                    start_time = time.time()
                    max_wait_time = 20  # 20 секунд
                    check_interval = 2  # Проверяем каждые 2 секунды
                    
                    while time.time() - start_time < max_wait_time:
                        await asyncio.sleep(check_interval)
                        
                        # Проверяем статус согласия
                        try:
                            status_response = await client.get(
                                f"{request.bank_url}/account-consents/{request_id}",
                                headers={
                                    "Authorization": f"Bearer {request.bank_token}",
                                    "x-requesting-bank": TEAM_CLIENT_ID
                                }
                            )
                            
                            if status_response.status_code == 200:
                                status_data = status_response.json()
                                consent_id = (
                                    status_data.get("Data", {}).get("ConsentId") or
                                    status_data.get("consent_id") or
                                    status_data.get("ConsentId")
                                )
                                
                                if consent_id:
                                    logger.info(f"SBank: согласие подписано, consent_id={consent_id}")
                                    # Обновляем ответ с consent_id
                                    if "Data" not in consent_response:
                                        consent_response["Data"] = {}
                                    consent_response["Data"]["ConsentId"] = consent_id
                                    break
                        except Exception as e:
                            logger.warning(f"SBank: ошибка проверки статуса согласия: {e}")
                            continue
                    
                    # Если не подписано за 20 секунд - возвращаем без consent_id
                    if not consent_response.get("Data", {}).get("ConsentId"):
                        logger.warning(f"SBank: согласие не подписано в течение {max_wait_time} секунд")
                        # Возвращаем ответ без consent_id - фронтенд не будет показывать счета
            
            return consent_response
            
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
        
        async with httpx.AsyncClient(timeout=30.0) as client:
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


@router.post("/cards-with-consent")
async def get_cards_with_consent(request: CardsWithConsentRequest):
    """
    Получить карты клиента используя consent
    
    Требуется банковский токен и consent_id с разрешением ReadCards
    """
    try:
        logger.info(f"Запрос карт из банка {request.bank_url} для client_id={request.client_id} с consent_id={request.consent_id}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{request.bank_url}/cards"
            headers = {
                "accept": "application/json",
                "Authorization": f"Bearer {request.bank_token}",
                "x-consent-id": request.consent_id,
                "x-requesting-bank": TEAM_CLIENT_ID
            }
            params = {"client_id": request.client_id}
            
            logger.info(f"Отправка запроса GET {url} с параметрами: {params}, headers: x-consent-id={request.consent_id}, x-requesting-bank={TEAM_CLIENT_ID}")
            
            response = await client.get(url, headers=headers, params=params)
            
            logger.info(f"Ответ карт от {request.bank_url}: статус {response.status_code}")
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"Ошибка получения карт из {request.bank_url}: {error_text}")
                # Не выбрасываем ошибку, просто возвращаем пустой список
                return {"data": {"card": []}}
            
            cards_data = response.json()
            # Проверяем формат ответа
            if isinstance(cards_data, list):
                cards_data = {"data": {"card": cards_data}}
            elif "data" not in cards_data:
                cards_data = {"data": {"card": [cards_data] if cards_data else []}}
            
            card_count = len(cards_data.get("data", {}).get("card", []))
            logger.info(f"Получено {card_count} карт из {request.bank_url} для client_id={request.client_id}")
            
            return cards_data
            
    except httpx.TimeoutException:
        logger.warning(f"Timeout при получении карт из {request.bank_url}")
        return {"data": {"card": []}}
    except httpx.RequestError as e:
        logger.warning(f"Ошибка подключения при получении карт из {request.bank_url}: {str(e)}")
        return {"data": {"card": []}}


@router.post("/transactions-with-consent")
async def get_transactions_with_consent(request: TransactionsWithConsentRequest):
    """
    Получить транзакции счета используя consent
    """
    try:
        logger.info(f"Запрос транзакций для account_id={request.account_id} из банка {request.bank_url}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            transactions_url = f"{request.bank_url}/accounts/{request.account_id}/transactions"
            response = await client.get(
                transactions_url,
                headers={
                    "accept": "application/json",
                    "Authorization": f"Bearer {request.bank_token}",
                    "x-consent-id": request.consent_id,
                    "x-requesting-bank": TEAM_CLIENT_ID
                }
            )
            
            logger.info(f"Ответ транзакций от {request.bank_url} для account_id={request.account_id}: статус {response.status_code}")
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"Ошибка получения транзакций для account_id={request.account_id} из {request.bank_url}: {error_text}")
                raise HTTPException(response.status_code, f"Failed to fetch transactions: {error_text}")
            
            transactions_data = response.json()
            transaction_count = len(transactions_data.get("data", {}).get("transaction", []))
            logger.info(f"Получено {transaction_count} транзакций для account_id={request.account_id} из {request.bank_url}")
            
            return transactions_data
            
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
        async with httpx.AsyncClient(timeout=30.0) as client:
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
        async with httpx.AsyncClient(timeout=30.0) as client:
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
