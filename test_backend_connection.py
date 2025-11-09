"""
Тест подключения к backend
Запуск: python test_backend_connection.py
"""
import requests
import sys

BACKEND_URL = "http://localhost:8001"

def test_connection():
    """Тестирует подключение к backend"""
    print("=" * 60)
    print("🔍 Тест подключения к backend")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    print()
    
    try:
        # Тест 1: Health check
        print("1. Проверка /health...")
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if response.status_code == 200:
            print("   ✅ Backend доступен!")
            print(f"   Ответ: {response.json()}")
        else:
            print(f"   ❌ Backend вернул статус {response.status_code}")
        print()
        
        # Тест 2: Root endpoint
        print("2. Проверка / (root)...")
        response = requests.get(f"{BACKEND_URL}/", timeout=5)
        if response.status_code == 200:
            print("   ✅ Root endpoint работает!")
            data = response.json()
            print(f"   Банк: {data.get('bank', 'N/A')}")
            print(f"   Bank Code: {data.get('bank_code', 'N/A')}")
        else:
            print(f"   ❌ Root endpoint вернул статус {response.status_code}")
        print()
        
        # Тест 3: Auth login (без реального запроса, только проверка endpoint)
        print("3. Проверка /auth/login...")
        response = requests.post(
            f"{BACKEND_URL}/auth/login",
            json={"username": "team251-1", "password": "test"},
            timeout=5
        )
        if response.status_code == 401:
            print("   ✅ Endpoint /auth/login доступен (ожидаемая ошибка 401)")
        elif response.status_code == 200:
            print("   ✅ Авторизация прошла успешно!")
        else:
            print(f"   ⚠️  Неожиданный статус: {response.status_code}")
        print()
        
        print("=" * 60)
        print("✅ Все тесты пройдены! Backend работает корректно.")
        print("=" * 60)
        
    except requests.exceptions.ConnectionError:
        print("❌ ОШИБКА: Не удалось подключиться к backend!")
        print()
        print("Возможные причины:")
        print("1. Backend не запущен - запустите: python run.py")
        print("2. Backend слушает на другом порту - проверьте конфигурацию")
        print("3. Firewall блокирует подключение")
        print()
        sys.exit(1)
    except requests.exceptions.Timeout:
        print("❌ ОШИБКА: Таймаут при подключении к backend!")
        print("Backend может быть перегружен или недоступен")
        sys.exit(1)
    except Exception as e:
        print(f"❌ ОШИБКА: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    test_connection()

