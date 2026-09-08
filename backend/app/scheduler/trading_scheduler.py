import asyncio
import logging
from datetime import datetime
from typing import Dict, Optional

from app.utils.market_hours import MarketHours
from app.services.market_data import market_data
from app.strategies.pro_scalping import ProScalpingStrategy
from app.strategies.smart_money import SmartMoneyStrategy
from app.services.demo_account import DemoAccount
from app.services.order_flow import OrderFlowAnalyzer

logger = logging.getLogger(__name__)

class TradingScheduler:
    """Профессиональный торговый планировщик"""
    
    def __init__(self):
        self.strategies: Dict[str, BaseStrategy] = {}
        self.demo_account = DemoAccount()
        self.order_flow = OrderFlowAnalyzer()
        self.is_running = False
        self.last_reset = datetime.now().date()
        
        # Активные стратегии
        self.strategy_map = {
            "RTS": ProScalpingStrategy,
            "Si": SmartMoneyStrategy
        }
        
    async def start(self):
        """Запуск планировщика"""
        self.is_running = True
        logger.info("🚀 Профессиональный планировщик запущен")
        
        # Запускаем стратегии для всех инструментов
        for instrument in ["RTS", "Si"]:
            await self._start_strategy(instrument)
            
        # Основной цикл
        while self.is_running:
            try:
                await self._tick()
                await asyncio.sleep(1)  # Обновление каждую секунду
            except Exception as e:
                logger.error(f"Ошибка в планировщике: {e}")
                await asyncio.sleep(5)
                
    async def _tick(self):
        """Тик обновления"""
        # Сброс дневных лимитов
        today = datetime.now().date()
        if today != self.last_reset:
            self.last_reset = today
            self.demo_account.reset_daily_limit()
            logger.info("📊 Дневные лимиты сброшены")
            
        # Проверка рынка
        market_open = MarketHours.is_market_open()
        
        if not market_open:
            # Если рынок закрыт, останавливаем стратегии
            for key, strategy in list(self.strategies.items()):
                if strategy.is_active:
                    await strategy.stop()
            return
            
        # Получаем данные для каждого инструмента
        for instrument in ["RTS", "Si"]:
            try:
                quote = await market_data.get_quote(instrument)
                if quote and quote.get("price"):
                    # Обновляем стратегию
                    strategy = self.strategies.get(instrument)
                    if strategy and strategy.is_active:
                        await strategy.on_quote(quote)
            except Exception as e:
                logger.error(f"Ошибка обработки {instrument}: {e}")
                
    async def _start_strategy(self, instrument: str):
        """Запуск стратегии"""
        try:
            strategy_class = self.strategy_map.get(instrument)
            if not strategy_class:
                logger.warning(f"Нет стратегии для {instrument}")
                return
                
            strategy = strategy_class(instrument, self.demo_account)
            await strategy.start()
            self.strategies[instrument] = strategy
            logger.info(f"✅ Стратегия запущена для {instrument}")
        except Exception as e:
            logger.error(f"Ошибка запуска {instrument}: {e}")
            
    async def stop(self):
        """Остановка планировщика"""
        self.is_running = False
        for strategy in self.strategies.values():
            await strategy.stop()
        logger.info("⏹ Планировщик остановлен")
