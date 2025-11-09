#!/usr/bin/env python
import requests
import time
import json

# Ждём, пока сервер запустится
time.sleep(3)

try:
    # Тест endpoint для transfer  
    url = 'http://localhost:8001/api/payments/transfer/internal'
    
    # Данные для теста
    data = {
        'from_account_id': '1',
        'to_account_id': '2', 
        'amount': '100'
    }
    
    headers = {
        'Authorization': 'Bearer test',
        'Content-Type': 'application/json'
    }
    
    print("Отправляю запрос на:", url)
    print("Данные:", json.dumps(data, indent=2))
    
    response = requests.post(url, json=data, headers=headers)
    
    print(f"\nСтатус: {response.status_code}")
    print(f"Тип контента: {response.headers.get('content-type')}")
    print(f"Ответ:\n{response.text}")
    
except Exception as e:
    print(f"Ошибка: {e}")
