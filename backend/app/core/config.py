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
    VERSION: str = "0.2.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # MOEX ISS API (бесплатный, без токена)
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
    
    # Redis (для Celery, опционально)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # Демо-счёт
    DEMO_BALANCE: float = 100000.0  # 100 000 рублей
    DEMO_COMMISSION: float = 0.0005  # 0.05% комиссия
    
    # Торговые параметры
    MAX_DAILY_LOSS: float = 0.02  # 2% от депозита
    MAX_POSITION_SIZE: int = 1    # 1 контракт
    MAX_TRADES_PER_DAY: int = 10  # максимум сделок в день
    
    # Инструменты
    INSTRUMENTS: List[str] = ["RTS", "Si"]
    
    # Инструменты MOEX (актуальные коды на 2026 год)
    MOEX_INSTRUMENTS: dict = {
        "RTS": {
            "security": "RTS-9.26",  # Фьючерс RTS на сентябрь 2026
            "board": "RFUD"
        },
        "Si": {
            "security": "Si-9.26",   # Фьючерс Si на сентябрь 2026
            "board": "RFUD"
        }
    }
    
    # Настройки времени торговли (Московское время)
    MARKET_OPEN: time = time(10, 0)      # 10:00 МСК
    MARKET_CLOSE: time = time(18, 45)    # 18:45 МСК
    EVENING_OPEN: time = time(19, 0)     # 19:00 МСК
    EVENING_CLOSE: time = time(23, 50)   # 23:50 МСК
    
    # Интервалы обновления (секунды)
    QUOTE_INTERVAL: int = 2      # Запрос котировок каждые 2 секунды
    WS_INTERVAL: int = 2         # WebSocket обновление каждые 2 секунды
    SCHEDULER_INTERVAL: int = 60 # Проверка статуса каждые 60 секунд
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Игнорируем лишние переменные

# Создаём глобальный экземпляр настроек
settings = Settings()

# Выводим настройки при запуске (для отладки)
if settings.DEBUG:
    print("=" * 50)
    print("📊 НАСТРОЙКИ ПРИЛОЖЕНИЯ")
    print("=" * 50)
    print(f"Проект: {settings.PROJECT_NAME}")
    print(f"Версия: {settings.VERSION}")
    print(f"База данных: {settings.DATABASE_URL}")
    print(f"Демо-баланс: {settings.DEMO_BALANCE} ₽")
    print(f"Инструменты: {', '.join(settings.INSTRUMENTS)}")
    print(f"Время торгов: {settings.MARKET_OPEN} - {settings.MARKET_CLOSE} МСК")
    print(f"Вечерняя сессия: {settings.EVENING_OPEN} - {settings.EVENING_CLOSE} МСК")
    print("=" * 50)
