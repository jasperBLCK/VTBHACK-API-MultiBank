"""
Конфигурация банка
Команды кастомизируют эти параметры
"""
from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import Optional


class BankConfig(BaseSettings):
    """Настройки банка"""
    
    # === ИДЕНТИФИКАЦИЯ БАНКА (КАСТОМИЗИРУЙ!) ===
    BANK_CODE: str = "mybank"
    BANK_NAME: str = "My Awesome Bank"
    BANK_DESCRIPTION: str = "Custom bank for hackathon"
    PUBLIC_URL: str = "http://localhost:8080"
    
    # === TEAM CREDENTIALS (для межбанковских операций) ===
    # Эти креды используются для получения банковского токена при межбанковских запросах
    TEAM_CLIENT_ID: Optional[str] = "team251"  # ID команды для доступа к песочницам
    TEAM_CLIENT_SECRET: Optional[str] = "iOin4bZP3rRl44r7TNy5ZigMUjcQIem1"  # Пароль команды
    
    # === DATABASE ===
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "ansar09595"
    POSTGRES_DB: str = "vtbhack_db"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    
    # DATABASE_URL может быть задан напрямую, или будет сформирован из POSTGRES_* переменных
    DATABASE_URL: Optional[str] = None
    
    # === SECURITY ===
    SECRET_KEY: str = "change-this-to-random-string-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # === API ===
    API_VERSION: str = "2.1"
    API_BASE_PATH: str = ""
    
    # === REGISTRY (для федеративной архитектуры) ===
    REGISTRY_URL: str = "http://localhost:3000"
    
    @model_validator(mode='after')
    def build_database_url(self):
        """Если DATABASE_URL не задан, формируем его из POSTGRES_* переменных"""
        if self.DATABASE_URL is None:
            # Формируем синхронный URL для SQLAlchemy (будет преобразован в async в database.py)
            self.DATABASE_URL = f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        return self
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        # Игнорируем переменные которые не определены в классе (например, NEXT_PUBLIC_* для фронтенда)
        extra = "ignore"


# Singleton instance
config = BankConfig()

