import asyncio
import logging
from datetime import datetime, timedelta

from app.utils.market_hours import MarketHours
from app.services.market_data import market_data
from app.strategies.impulse_strategy import ImpulseStrategy
from app.strategies.level_strategy import LevelStrategy
from app.services.demo_account import demo_account

logger = logging.getLogger(__name__)

class TradingScheduler:
    """Планировщик для автоматической торговли"""
    
    def __init__(self):
        self.active_strategies = {}
        self.is_running = False
        
    async def start(self):
        """Запуск планировщика"""
        self.is_running = True
        logger.info("Торговый планировщик запущен")
        
        while self.is_running:
            try:
                market_open = MarketHours.is_market_open()
                
                if market_open:
                    # Рынок открыт - запускаем стратегии, если они не запущены
                    for instrument in ["RTS", "Si"]:
                        key = f"{instrument}_auto"
                        if key not in self.active_strategies:
                            await self._start_strategy(instrument)
                else:
                    # Рынок закрыт - останавливаем стратегии
                    for key in list(self.active_strategies.keys()):
                        if key.endswith("_auto"):
                            await self._stop_strategy(key)
                
                # Проверяем каждые 60 секунд
                await asyncio.sleep(60)
                
            except Exception as e:
                logger.error(f"Ошибка в планировщике: {e}")
                await asyncio.sleep(60)
    
    async def _start_strategy(self, instrument: str):
        """Автоматический запуск стратегии"""
        strategy_type = "impulse" if instrument == "RTS" else "level"
        
        try:
            if strategy_type == "impulse":
                strategy = ImpulseStrategy(instrument, demo_account)
            else:
                strategy = LevelStrategy(instrument, demo_account)
            
            await strategy.start()
            key = f"{instrument}_auto"
            self.active_strategies[key] = strategy
            logger.info(f"Автоматически запущена стратегия для {instrument}")
        except Exception as e:
            logger.error(f"Ошибка запуска стратегии {instrument}: {e}")
    
    async def _stop_strategy(self, key: str):
        """Автоматическая остановка стратегии"""
        try:
            if key in self.active_strategies:
                await self.active_strategies[key].stop()
                del self.active_strategies[key]
                logger.info(f"Автоматически остановлена стратегия {key}")
        except Exception as e:
            logger.error(f"Ошибка остановки стратегии {key}: {e}")
    
    async def stop(self):
        """Остановка планировщика"""
        self.is_running = False
        # Останавливаем все стратегии
        for key in list(self.active_strategies.keys()):
            await self._stop_strategy(key)
        logger.info("Торговый планировщик остановлен")
