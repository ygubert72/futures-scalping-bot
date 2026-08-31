from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import asyncio
from contextlib import asynccontextmanager

from app.api.routes import router
from app.core.config import settings
from app.core.database import engine, Base
from app.scheduler.trading_scheduler import TradingScheduler

# Создание таблиц в базе данных
Base.metadata.create_all(bind=engine)

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Глобальный планировщик
scheduler = TradingScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    # Запуск приложения
    logger.info("🚀 Запуск Futures Scalping Bot API")
    logger.info(f"📊 Настройки: {settings.model_dump()}")
    
    # Запускаем планировщик в фоновом режиме
    asyncio.create_task(scheduler.start())
    logger.info("⏰ Торговый планировщик запущен в фоновом режиме")
    
    yield  # Здесь приложение работает
    
    # Остановка приложения
    logger.info("🛑 Остановка Futures Scalping Bot API")
    await scheduler.stop()
    logger.info("⏰ Торговый планировщик остановлен")

# Создаём приложение FastAPI
app = FastAPI(
    title="Futures Scalping Bot API",
    description="API для автоматической торговли фьючерсами RTS и Si на Московской бирже",
    version="0.2.0",
    lifespan=lifespan
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене заменить на конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем роуты
app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    """Корневой эндпоинт"""
    return {
        "message": "Futures Scalping Bot API",
        "status": "running",
        "version": "0.2.0",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health")
async def health_check():
    """Проверка здоровья сервиса"""
    from app.utils.market_hours import MarketHours
    return {
        "status": "healthy",
        "timestamp": __import__('datetime').datetime.now().isoformat(),
        "market_open": MarketHours.is_market_open(),
        "strategies_active": len(scheduler.active_strategies) if scheduler else 0
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # Только для разработки
    )
