import os
from typing import List, Optional
from datetime import time
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Загружаем переменные из .env
load_dotenv()

class Settings(BaseSettings):
    """Настройки приложения"""
    
    # Общие настройки
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "Futures Scalping Bot"
    VERSION: str = "0.3.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # MOEX ISS API
    MOEX_API_URL: str = "https://iss.moex.com/iss"
    MOEX_WS_URL: str = "wss://iss.moex.com/iss/ws"
    
    # Настройки Финам (для будущего реального счёта)
    FINAM_CLIENT_ID: str = os.getenv("FINAM_CLIENT_ID", "")
    FINAM_API_TOKEN: str = os.getenv("FINAM_API_TOKEN", "")
    FINAM_API_URL: str = "https://api.finam.ru"
    FINAM_WS_URL: str = "wss://api.finam.ru/ws"
    
    # База данных
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./futures.db"
    )
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # Демо-счёт
    DEMO_BALANCE: float = 100000.0
    DEMO_COMMISSION: float = 0.0005
    
    # НОВЫЕ ПАРАМЕТРЫ УПРАВЛЕНИЯ РИСКАМИ
    RISK_PER_TRADE: float = 0.01  # 1% от баланса на сделку
    MAX_DAILY_LOSS: float = 0.03  # 3% от депозита в день
    MAX_POSITION_SIZE: int = 5    # Максимум 5 контрактов
    MAX_TRADES_PER_DAY: int = 10
    
    # Инструменты
    INSTRUMENTS: List[str] = ["RTS", "Si"]
    
    MOEX_INSTRUMENTS: dict = {
        "RTS": {
            "security": "RTS-9.26",
            "board": "RFUD"
        },
        "Si": {
            "security": "Si-9.26",
            "board": "RFUD"
        }
    }
    
    # Время торговли
    MARKET_OPEN: time = time(10, 0)
    MARKET_CLOSE: time = time(18, 45)
    EVENING_OPEN: time = time(19, 0)
    EVENING_CLOSE: time = time(23, 50)
    
    # Интервалы обновления
    QUOTE_INTERVAL: int = 2
    WS_INTERVAL: int = 2
    SCHEDULER_INTERVAL: int = 60
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()

if settings.DEBUG:
    print("=" * 50)
    print("📊 НАСТРОЙКИ ПРИЛОЖЕНИЯ (v0.3.0)")
    print("=" * 50)
    print(f"Проект: {settings.PROJECT_NAME}")
    print(f"Версия: {settings.VERSION}")
    print(f"Демо-баланс: {settings.DEMO_BALANCE} ₽")
    print(f"Риск на сделку: {settings.RISK_PER_TRADE * 100}%")
    print(f"Макс. позиция: {settings.MAX_POSITION_SIZE} контрактов")
    print(f"Дневной лимит: {settings.MAX_DAILY_LOSS * 100}%")
    print("=" * 50)
