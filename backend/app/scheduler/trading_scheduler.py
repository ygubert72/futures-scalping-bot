import asyncio
import logging
from datetime import datetime

from app.utils.market_hours import MarketHours
from app.services.market_data import market_data
from app.strategies.impulse_strategy import ImpulseStrategy
from app.strategies.level_strategy import LevelStrategy
from app.services.demo_account import demo_account

logger = logging.getLogger(__name__)

class TradingScheduler:
    """Планировщик для автоматической торговли с улучшенным управлением"""
    
    def __init__(self):
        self.active_strategies = {}
        self.is_running = False
        self.daily_trades = 0
        self.last_reset_date = datetime.now().date()
        
    async def start(self):
        """Запуск планировщика"""
        self.is_running = True
        logger.info("Торговый планировщик запущен (v0.3.0)")
        
        while self.is_running:
            try:
                # Сброс дневного счетчика
                today = datetime.now().date()
                if today != self.last_reset_date:
                    self.daily_trades = 0
                    self.last_reset_date = today
                    logger.info("Дневной счетчик сделок сброшен")
                
                market_open = MarketHours.is_market_open()
                
                if market_open:
                    # Проверка лимита сделок
                    if self.daily_trades < 10:
                        for instrument in ["RTS", "Si"]:
                            key = f"{instrument}_auto"
                            if key not in self.active_strategies:
                                await self._start_strategy(instrument)
                    else:
                        logger.info(f"Достигнут лимит сделок ({self.daily_trades}/10)")
                        # Останавливаем стратегии, если лимит достигнут
                        for key in list(self.active_strategies.keys()):
                            if key.endswith("_auto"):
                                await self._stop_strategy(key)
                else:
                    # Рынок закрыт — останавливаем стратегии
                    for key in list(self.active_strategies.keys()):
                        if key.endswith("_auto"):
                            await self._stop_strategy(key)
                
                await asyncio.sleep(60)
                
            except Exception as e:
                logger.error(f"Ошибка в планировщике: {e}")
                await asyncio.sleep(60)
    
    async def _start_strategy(self, instrument: str):
        """Запуск стратегии с расчетом размера позиции"""
        strategy_type = "impulse" if instrument == "RTS" else "level"
        
        try:
            if strategy_type == "impulse":
                strategy = ImpulseStrategy(instrument, demo_account)
            else:
                strategy = LevelStrategy(instrument, demo_account)
            
            await strategy.start()
            key = f"{instrument}_auto"
            self.active_strategies[key] = strategy
            logger.info(f"Запущена стратегия для {instrument}")
        except Exception as e:
            logger.error(f"Ошибка запуска стратегии {instrument}: {e}")
    
    async def _stop_strategy(self, key: str):
        """Остановка стратегии"""
        try:
            if key in self.active_strategies:
                await self.active_strategies[key].stop()
                del self.active_strategies[key]
                logger.info(f"Остановлена стратегия {key}")
        except Exception as e:
            logger.error(f"Ошибка остановки стратегии {key}: {e}")
    
    async def stop(self):
        """Остановка планировщика"""
        self.is_running = False
        for key in list(self.active_strategies.keys()):
            await self._stop_strategy(key)
        logger.info("Торговый планировщик остановлен")
