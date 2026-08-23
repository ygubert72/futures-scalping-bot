import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # Настройки API Финам
    FINAM_CLIENT_ID: str = os.getenv("FINAM_CLIENT_ID", "")
    FINAM_API_TOKEN: str = os.getenv("FINAM_API_TOKEN", "")
    FINAM_API_URL: str = "https://api.finam.ru"
    FINAM_WS_URL: str = "wss://api.finam.ru/ws"
    
    # Настройки базы данных
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./futures.db")
    
    # Настройки торговли
    MAX_DAILY_LOSS: float = 0.02  # 2% от депозита
    MAX_POSITION_SIZE: int = 1    # 1 контракт
    MAX_TRADES_PER_DAY: int = 10  # максимум сделок в день
    
    # Инструменты
    INSTRUMENTS: list = ["RTS", "Si"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
