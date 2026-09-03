from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import asyncio
from contextlib import asynccontextmanager

from app.api.routes import router
from app.core.config import settings
from app.core.database import engine, Base
from app.scheduler.trading_scheduler import TradingScheduler

# Создание таблиц
Base.metadata.create_all(bind=engine)

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

scheduler = TradingScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    logger.info("🚀 Запуск Futures Scalping Bot API v0.3.0")
    logger.info(f"📊 Настройки: риск={settings.RISK_PER_TRADE*100}%, макс.позиция={settings.MAX_POSITION_SIZE}")
    
    asyncio.create_task(scheduler.start())
    logger.info("⏰ Торговый планировщик запущен")
    
    yield
    
    logger.info("🛑 Остановка Futures Scalping Bot API")
    await scheduler.stop()
    logger.info("⏰ Торговый планировщик остановлен")

app = FastAPI(
    title="Futures Scalping Bot API",
    description="Профессиональный скальпинг фьючерсов RTS и Si",
    version="0.3.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {
        "message": "Futures Scalping Bot API v0.3.0",
        "status": "running",
        "risk_per_trade": f"{settings.RISK_PER_TRADE * 100}%",
        "max_position": settings.MAX_POSITION_SIZE,
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    from app.utils.market_hours import MarketHours
    return {
        "status": "healthy",
        "timestamp": __import__('datetime').datetime.now().isoformat(),
        "market_open": MarketHours.is_market_open(),
        "strategies_active": len(scheduler.active_strategies)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
