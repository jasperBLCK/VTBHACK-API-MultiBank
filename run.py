"""
Точка входа для запуска Bank-in-a-Box

Используется для корректной работы относительных импортов
"""
import sys
from pathlib import Path

# Добавляем корневую директорию в PYTHONPATH
root_dir = Path(__file__).parent
sys.path.insert(0, str(root_dir))

# Импортируем и запускаем приложение
if __name__ == "__main__":
    import uvicorn
    
    # Импортируем app из модуля
    from main import app, config
    
    # Определяем порт на основе bank_code
    port_map = {
        "vbank": 8001,
        "abank": 8002,
        "sbank": 8003,
        "mybank": 8001,  # Для команды team251
    }
    port = port_map.get(config.BANK_CODE, 8001)  # По умолчанию 8001
    
    print(f"🏦 Starting {config.BANK_NAME} on port {port}")
    print(f"📍 Swagger UI: http://localhost:{port}/docs")
    print(f"📍 Client UI: http://localhost:{port}/client/")
    print(f"📍 FrontendN: http://localhost:3000 (запустите отдельно: cd FrontendN && npm run dev)")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info"
    )

