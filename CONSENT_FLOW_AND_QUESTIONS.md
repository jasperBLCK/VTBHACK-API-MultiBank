# 🔍 Consent Flow - Ключевые моменты кода и вопросы для эксперта

Документ для обсуждения проблемы с consent (согласиями) с экспертом.

---

## 🎯 Проблема

**Симптомы:**
1. При запросе балансов из SBank запрос зависает на этапе `POST /multibank/request-consent`
2. Даже после ручного подписания согласия в UI банка, балансы не загружаются
3. Код пытается автоматически подписать согласие для SBank, но это не работает как ожидается

---

## 📊 Flow работы Consent (как это должно работать)

### Этап 1: Запрос согласия
```
POST /multibank/request-consent
→ Вызывает POST {bank_url}/account-consents/request
→ SBank создает ConsentRequest в статусе "pending"
→ SBank возвращает request_id
```

### Этап 2: Подписание согласия
```
POST {bank_url}/account-consents/sign
→ SBank проверяет токен клиента
→ SBank создает Consent в статусе "active"
→ SBank возвращает consent_id
```

### Этап 3: Использование согласия
```
POST /multibank/accounts-with-consent
→ Передает consent_id в заголовке x-consent-id
→ SBank проверяет согласие через ConsentService.check_consent()
→ Если согласие активно → возвращает счета
```

---

## 🔑 Ключевые места в коде

### 1. Запрос согласия (наш код → SBank)

**Файл:** `api/multibank_proxy.py`, строки 96-219

```python
@router.post("/request-consent")
async def request_consent(request: ConsentRequest):
    # 1. Делаем запрос на создание согласия
    response = await client.post(
        f"{request.bank_url}/account-consents/request",
        json=consent_data,
        headers={
            "Authorization": f"Bearer {request.bank_token}",
            "x-requesting-bank": TEAM_CLIENT_ID
        }
    )
    
    consent_response = response.json()
    
    # 2. Если это SBank - пытаемся автоматически подписать
    if is_sbank:
        # Извлекаем request_id из ответа
        request_id = consent_response.get("Data", {}).get("ConsentRequestId") or ...
        
        # 3. Получаем токен клиента
        login_response = await client.post(
            f"{request.bank_url}/auth/login",
            json={"username": request.client_id, "password": "password"}
        )
        client_token = login_data.get("access_token")
        
        # 4. Подписываем согласие
        sign_response = await client.post(
            f"{request.bank_url}/account-consents/sign",
            json={"request_id": request_id, "action": "approve"},
            headers={"Authorization": f"Bearer {client_token}"}
        )
        
        # 5. Извлекаем consent_id из ответа
        consent_id = signed_data.get("consent_id") or ...
        
        # 6. Обновляем ответ, чтобы вернуть consent_id
        consent_response["Data"]["ConsentId"] = consent_id
```

**Вопросы к эксперту:**
1. ✅ Правильно ли мы извлекаем `request_id` из ответа SBank? Может быть он в другом поле?
2. ✅ Правильный ли формат запроса на подписание? Может быть нужны другие поля?
3. ✅ Правильно ли мы получаем `consent_id` после подписания? Может быть нужно проверить статус запроса?

---

### 2. Создание согласия в SBank (код SBank)

**Файл:** `api/consents.py`, строки 81-137

```python
@router.post("/request", summary="Создать согласие")
async def request_consent(
    body: ConsentRequestBody,
    x_requesting_bank: Optional[str] = Header(None, alias="x-requesting-bank"),
    db: AsyncSession = Depends(get_db)
):
    # Вызываем ConsentService.create_consent_request()
    consent_request, consent = await ConsentService.create_consent_request(
        db=db,
        client_person_id=body.client_id,
        requesting_bank=requesting_bank,
        permissions=body.permissions,
        reason=body.reason
    )
    
    if consent:
        # Автоодобрено - возвращаем consent_id
        return {
            "request_id": consent_request.request_id,
            "consent_id": consent.consent_id,
            "status": "approved",
            "auto_approved": True
        }
    else:
        # Требуется одобрение - возвращаем только request_id
        return {
            "request_id": consent_request.request_id,
            "status": "pending",
            "auto_approved": False
        }
```

**Вопросы к эксперту:**
4. ✅ Какой формат ответа возвращает SBank? Есть ли поле `Data.ConsentRequestId` или другое?
5. ✅ Если `auto_approve_consents = false` в SBank, возвращается ли `consent_id` сразу или только после подписания?

---

### 3. Логика автоодобрения (код SBank)

**Файл:** `services/consent_service.py`, строки 70-156

```python
@staticmethod
async def create_consent_request(
    db: AsyncSession,
    client_person_id: str,
    requesting_bank: str,
    permissions: List[str],
    reason: str = ""
) -> tuple[ConsentRequest, Optional[Consent]]:
    # 1. Получаем клиента
    client = await db.execute(select(Client).where(Client.person_id == client_person_id))
    
    # 2. Проверяем настройку автоодобрения
    settings_result = await db.execute(
        select(BankSettings).where(BankSettings.key == "auto_approve_consents")
    )
    auto_approve_setting = settings_result.scalar_one_or_none()
    auto_approve = auto_approve_setting and auto_approve_setting.value.lower() == "true"
    
    # 3. Создаем запрос
    consent_request = ConsentRequest(
        request_id=request_id,
        client_id=client.id,
        requesting_bank=requesting_bank,
        status="pending"
    )
    db.add(consent_request)
    
    # 4. Если автоодобрение включено - создаем согласие сразу
    consent = None
    if auto_approve:
        consent = Consent(
            consent_id=consent_id,
            request_id=consent_request.id,
            client_id=client.id,
            granted_to=requesting_bank,
            status="active",
            expiration_date_time=datetime.utcnow() + timedelta(days=365)
        )
        db.add(consent)
        consent_request.status = "approved"
    else:
        # Создаем уведомление для клиента
        notification = Notification(...)
        db.add(notification)
    
    await db.commit()
    return (consent_request, consent)
```

**Вопросы к эксперту:**
6. ✅ Какое значение `auto_approve_consents` в SBank? `true` или `false`?
7. ✅ Если `auto_approve_consents = false`, нужно ли обязательно подписывать согласие через `/account-consents/sign`?
8. ✅ Может ли быть так, что согласие создается автоматически, но без `consent_id` до подписания?

---

### 4. Подписание согласия (код SBank)

**Файл:** `api/consents.py`, строки 303-342

```python
@router.post("/sign", tags=["Internal: Consents"], include_in_schema=False)
async def sign_consent(
    body: SignConsentBody,
    current_client: dict = Depends(get_current_client),
    db: AsyncSession = Depends(get_db)
):
    # Вызываем ConsentService.sign_consent()
    status, consent = await ConsentService.sign_consent(
        db=db,
        request_id=body.request_id,
        client_person_id=current_client["client_id"],
        action=body.action,
        signature=body.signature
    )
    
    if body.action == "approve" and consent:
        return {
            "consent_id": consent.consent_id,
            "status": consent.status,
            "granted_to": consent.granted_to,
            "permissions": consent.permissions,
            "expires_at": consent.expiration_date_time.isoformat(),
            "signed_at": consent.signed_at.isoformat()
        }
```

**Файл:** `services/consent_service.py`, строки 158-231

```python
@staticmethod
async def sign_consent(
    db: AsyncSession,
    request_id: str,
    client_person_id: str,
    action: str,  # approve / reject
    signature: str = ""
) -> tuple[str, Optional[Consent]]:
    # 1. Находим запрос
    consent_request = await db.execute(
        select(ConsentRequest).where(ConsentRequest.request_id == request_id)
    )
    
    if not consent_request or consent_request.status != "pending":
        raise ValueError("Consent request not found or already processed")
    
    # 2. Если approve - создаем согласие
    if action == "approve":
        consent_id = f"consent-{uuid.uuid4().hex[:12]}"
        consent = Consent(
            consent_id=consent_id,
            request_id=consent_request.id,
            client_id=client.id,
            granted_to=consent_request.requesting_bank,
            permissions=consent_request.permissions,
            status="active",
            expiration_date_time=datetime.utcnow() + timedelta(days=365),
            signed_at=datetime.utcnow()
        )
        db.add(consent)
        consent_request.status = "approved"
        await db.commit()
        return ("approved", consent)
```

**Вопросы к эксперту:**
9. ✅ Правильно ли мы передаем `request_id` в запросе на подписание? Может быть нужен другой формат?
10. ✅ Нужен ли параметр `signature` для подписания? Какой формат?
11. ✅ Возвращается ли `consent_id` в ответе на `/account-consents/sign`? В каком поле?

---

### 5. Проверка согласия при запросе данных

**Файл:** `services/consent_service.py`, строки 17-68

```python
@staticmethod
async def check_consent(
    db: AsyncSession,
    client_person_id: str,
    requesting_bank: str,
    permissions: List[str]
) -> Optional[Consent]:
    # 1. Получаем клиента
    client = await db.execute(select(Client).where(Client.person_id == client_person_id))
    
    # 2. Ищем активное согласие
    result = await db.execute(
        select(Consent).where(
            and_(
                Consent.client_id == client.id,
                Consent.granted_to == requesting_bank,
                Consent.status == "active",
                Consent.expiration_date_time > datetime.utcnow()
            )
        )
    )
    consent = result.scalar_one_or_none()
    
    # 3. Проверяем permissions
    if not consent:
        return None
    
    if not all(perm in consent.permissions for perm in permissions):
        return None
    
    # 4. Обновляем last_accessed_at
    consent.last_accessed_at = datetime.utcnow()
    await db.commit()
    
    return consent
```

**Файл:** `api/accounts.py`, строки 38-60

```python
@router.get("")
async def get_accounts(
    client_id: Optional[str] = None,
    x_consent_id: Optional[str] = Header(None, alias="x-consent-id"),
    x_requesting_bank: Optional[str] = Header(None, alias="x-requesting-bank"),
    current_client: Optional[dict] = Depends(get_optional_client),
    db: AsyncSession = Depends(get_db)
):
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
```

**Вопросы к эксперту:**
12. ✅ Правильно ли мы передаем `x-consent-id` в заголовке? Или нужно проверять согласие по `x-requesting-bank` и `client_id`?
13. ✅ Может ли быть так, что согласие создано, но не находится при проверке? Почему?
14. ✅ Нужно ли передавать `x-consent-id` или достаточно `x-requesting-bank`?

---

### 6. Использование согласия в Multibank Proxy

**Файл:** `api/multibank_proxy.py`, строки 227-272

```python
@router.post("/accounts-with-consent")
async def get_accounts_with_consent(request: AccountsWithConsentRequest):
    # Делаем запрос к другому банку
    response = await client.get(
        f"{request.bank_url}/accounts",
        headers={
            "Authorization": f"Bearer {request.bank_token}",
            "x-consent-id": request.consent_id,  # ← Передаем consent_id
            "x-requesting-bank": TEAM_CLIENT_ID
        },
        params={"client_id": request.client_id}
    )
```

**Файл:** `frontend/client/dashboard.html`, строки 2968-2987

```javascript
// Получаем consent
const consentResponse = await fetch(`${apiBase}/multibank/request-consent`, {
    method: 'POST',
    body: JSON.stringify({
        bank_url: bank.url,
        bank_token: bankToken,
        client_id: clientIdToTry
    })
});

const consentData = await consentResponse.json();

// Извлекаем consent_id
consentId = consentData.Data?.ConsentId || 
           consentData.consent_id || 
           consentData.ConsentId ||
           consentData.id;

// Используем consent_id для запроса счетов
const accountsResponse = await fetch(`${apiBase}/multibank/accounts-with-consent`, {
    method: 'POST',
    body: JSON.stringify({
        bank_url: bank.url,
        bank_token: bankToken,
        consent_id: consentId,  // ← Используем consent_id
        client_id: workingClientId
    })
});
```

**Вопросы к эксперту:**
15. ✅ Правильно ли мы извлекаем `consent_id` из ответа `request-consent`? Может быть он в другом поле?
16. ✅ Если согласие не автоодобрено, нужно ли ждать подписания или можно проверить статус?
17. ✅ Может ли быть так, что `consent_id` не возвращается в ответе `request-consent`, а только после подписания?

---

## 🔍 Детальный анализ проблемы

### Сценарий 1: SBank с `auto_approve_consents = true`

**Что должно происходить:**
1. `POST /multibank/request-consent` → SBank создает согласие автоматически
2. SBank возвращает `consent_id` сразу
3. Мы используем `consent_id` для запроса счетов
4. ✅ Все работает

**Что происходит на самом деле:**
- ❓ Нужно проверить: возвращается ли `consent_id` в ответе?

### Сценарий 2: SBank с `auto_approve_consents = false`

**Что должно происходить:**
1. `POST /multibank/request-consent` → SBank создает запрос в статусе "pending"
2. SBank возвращает только `request_id`
3. Мы автоматически подписываем согласие через `/account-consents/sign`
4. SBank создает согласие и возвращает `consent_id`
5. Мы используем `consent_id` для запроса счетов
6. ✅ Все работает

**Что происходит на самом деле:**
- ❌ Запрос зависает на этапе `request-consent`
- ❌ Даже после ручного подписания балансы не загружаются
- ❓ Нужно проверить: правильно ли мы подписываем согласие?

---

## ❓ Вопросы для эксперта

### Вопросы о формате данных

1. **Какой формат ответа возвращает SBank при `POST /account-consents/request`?**
   - Есть ли поле `Data.ConsentRequestId`?
   - Есть ли поле `Data.ConsentId` (если автоодобрено)?
   - Какой точный формат JSON ответа?

2. **Какой формат ответа возвращает SBank при `POST /account-consents/sign`?**
   - Есть ли поле `consent_id`?
   - Есть ли поле `Data.ConsentId`?
   - Какой точный формат JSON ответа?

3. **Как извлечь `consent_id` из ответа?**
   - Нужно ли проверять несколько полей?
   - Может ли быть так, что `consent_id` в другом формате?

### Вопросы о логике работы

4. **Как работает автоодобрение в SBank?**
   - Какое значение `auto_approve_consents` в SBank?
   - Если `auto_approve_consents = false`, нужно ли обязательно подписывать?
   - Может ли быть так, что согласие создается, но без `consent_id`?

5. **Как работает подписание согласия?**
   - Правильно ли мы передаем `request_id`?
   - Нужен ли параметр `signature`? Какой формат?
   - Может ли быть так, что подписание не создает согласие сразу?

6. **Как работает проверка согласия?**
   - Нужно ли передавать `x-consent-id` в заголовке?
   - Или достаточно `x-requesting-bank` и `client_id`?
   - Может ли быть так, что согласие не находится при проверке?

### Вопросы о проблеме

7. **Почему запрос зависает на `request-consent`?**
   - Может быть SBank не отвечает сразу?
   - Может быть нужно ждать подписания?
   - Может быть есть timeout?

8. **Почему балансы не загружаются после подписания?**
   - Может быть `consent_id` не извлекается правильно?
   - Может быть согласие не создается?
   - Может быть проверка согласия не работает?

9. **Как правильно автоматически подписать согласие?**
   - Нужно ли получать токен клиента?
   - Нужно ли проверять статус после подписания?
   - Нужно ли получать `consent_id` из списка согласий?

### Вопросы о решении

10. **Как сделать так, чтобы согласие автоматически подписывалось?**
    - Можно ли установить `auto_approve_consents = true` в SBank?
    - Или нужно обязательно подписывать через `/sign`?
    - Есть ли другой способ?

11. **Как правильно получить `consent_id` после подписания?**
    - Из ответа `/sign`?
    - Из списка согласий `/my-consents`?
    - Из проверки статуса `/requests`?

12. **Как правильно использовать согласие?**
    - Передавать `x-consent-id` в заголовке?
    - Или достаточно `x-requesting-bank`?
    - Нужно ли проверять статус согласия перед использованием?

---

## 🎯 Что показать эксперту

### 1. Код запроса согласия
```python
# api/multibank_proxy.py, строки 119-127
response = await client.post(
    f"{request.bank_url}/account-consents/request",
    json=consent_data,
    headers={
        "Authorization": f"Bearer {request.bank_token}",
        "x-requesting-bank": TEAM_CLIENT_ID
    }
)
```

### 2. Код автоматического подписания
```python
# api/multibank_proxy.py, строки 154-184
# Получаем токен клиента
login_response = await client.post(
    f"{request.bank_url}/auth/login",
    json={"username": request.client_id, "password": "password"}
)
client_token = login_data.get("access_token")

# Подписываем согласие
sign_response = await client.post(
    f"{request.bank_url}/account-consents/sign",
    json={"request_id": request_id, "action": "approve"},
    headers={"Authorization": f"Bearer {client_token}"}
)

# Извлекаем consent_id
consent_id = signed_data.get("consent_id") or ...
```

### 3. Код проверки согласия
```python
# services/consent_service.py, строки 17-68
consent = await ConsentService.check_consent(
    db=db,
    client_person_id=client_id,
    requesting_bank=x_requesting_bank,
    permissions=["ReadAccountsDetail"]
)
```

### 4. Код использования согласия
```python
# api/multibank_proxy.py, строки 255-263
response = await client.get(
    f"{request.bank_url}/accounts",
    headers={
        "Authorization": f"Bearer {request.bank_token}",
        "x-consent-id": request.consent_id,
        "x-requesting-bank": TEAM_CLIENT_ID
    },
    params={"client_id": request.client_id}
)
```

---

## 📝 Чеклист для эксперта

Попросите эксперта проверить:

- [ ] Формат ответа `POST /account-consents/request` в SBank
- [ ] Формат ответа `POST /account-consents/sign` в SBank
- [ ] Значение `auto_approve_consents` в SBank
- [ ] Правильность извлечения `request_id` из ответа
- [ ] Правильность извлечения `consent_id` из ответа
- [ ] Правильность подписания согласия
- [ ] Правильность проверки согласия
- [ ] Правильность использования согласия
- [ ] Логи работы (что происходит на каждом этапе)
- [ ] Возможные проблемы и решения

---

## 🔧 Возможные решения

### Решение 1: Установить `auto_approve_consents = true` в SBank
- ✅ Согласие создается автоматически
- ✅ `consent_id` возвращается сразу
- ❓ Нужно проверить, можно ли это сделать

### Решение 2: Правильно подписывать согласие
- ✅ Получать токен клиента
- ✅ Подписывать согласие
- ✅ Правильно извлекать `consent_id`
- ❓ Нужно проверить формат ответа

### Решение 3: Проверять статус после подписания
- ✅ После подписания проверять статус запроса
- ✅ Получать `consent_id` из списка согласий
- ✅ Использовать `consent_id` для запроса данных
- ❓ Нужно проверить, как это сделать

---

## 📊 Диаграмма Flow

```
1. POST /multibank/request-consent
   ↓
2. POST {bank_url}/account-consents/request
   ↓
3. SBank создает ConsentRequest (pending)
   ↓
4. SBank возвращает request_id
   ↓
5. [Автоматическое подписание для SBank]
   ↓
6. POST {bank_url}/auth/login (получаем токен клиента)
   ↓
7. POST {bank_url}/account-consents/sign (подписываем)
   ↓
8. SBank создает Consent (active)
   ↓
9. SBank возвращает consent_id
   ↓
10. Используем consent_id для запроса данных
   ↓
11. POST /multibank/accounts-with-consent
   ↓
12. POST {bank_url}/accounts (с x-consent-id)
   ↓
13. SBank проверяет согласие
   ↓
14. SBank возвращает счета
```

---

## 🎯 Итоговые вопросы

**Главный вопрос:** Как правильно автоматически подписать согласие в SBank и получить `consent_id` для дальнейшего использования?

**Подвопросы:**
1. Какой формат ответа возвращает SBank?
2. Как правильно извлечь `consent_id`?
3. Нужно ли проверять статус после подписания?
4. Почему запрос зависает?
5. Почему балансы не загружаются?

---

## 💡 Что нужно от эксперта

1. **Проверить формат ответов SBank** - показать точный JSON
2. **Проверить логику работы** - объяснить flow
3. **Найти проблему** - где именно происходит зависание
4. **Предложить решение** - как правильно сделать автоматическое подписание
5. **Проверить код** - правильность реализации

---

Удачи с экспертом! 🚀

