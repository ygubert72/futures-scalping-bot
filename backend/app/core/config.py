import os
from typing import List
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # Настройки API
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "Futures Scalping Bot"
    
    # MOEX ISS API (бесплатный, без токена)
    MOEX_API_URL: str = "https://iss.moex.com/iss"
    MOEX_WS_URL: str = "wss://iss.moex.com/iss/ws"
    
    # Настройки Финам (для будущего)
    FINAM_CLIENT_ID: str = os.getenv("FINAM_CLIENT_ID", "")
    FINAM_API_TOKEN: str = os.getenv("FINAM_API_TOKEN", "")
    FINAM_API_URL: str = "https://api.finam.ru"
    FINAM_WS_URL: str = "wss://api.finam.ru/ws"
    
    # База данных
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./futures.db")
    
    # Демо-счёт
    DEMO_BALANCE: float = 100000.0  # 100 000 рублей
    DEMO_COMMISSION: float = 0.0005  # 0.05% комиссия
    
    # Торговые параметры
    MAX_DAILY_LOSS: float = 0.02  # 2% от депозита
    MAX_POSITION_SIZE: int = 1    # 1 контракт
    MAX_TRADES_PER_DAY: int = 10
    
    # Инструменты
    INSTRUMENTS: List[str] = ["RTS", "Si"]
    
    # Инструменты MOEX
    MOEX_INSTRUMENTS: dict = {
        "RTS": {"security": "RTS-9.26", "board": "RFUD"},
        "Si": {"security": "Si-9.26", "board": "RFUD"}
    }
    
    # Redis (для Celery)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
