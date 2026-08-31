import logging
from typing import Dict, Any, Optional
from collections import deque

from app.strategies.base_strategy import BaseStrategy
from app.services.demo_account import DemoAccount
from app.services.market_data import market_data

logger = logging.getLogger(__name__)

class ImpulseStrategy(BaseStrategy):
    """
    Стратегия импульсного пробоя для RTS
    
    Правила:
    - Вход при пробое уровня с увеличением объёма
    - Тейк-профит: 100-150 пунктов
    - Стоп-лосс: 40-50 пунктов
    """
    
    def __init__(self, instrument: str = "RTS", demo_account: DemoAccount = None):
        super().__init__(name="ImpulseStrategy", instrument=instrument)
        self.demo_account = demo_account
        
        # Параметры стратегии
        self.take_profit = 120
        self.stop_loss = 45
        self.volume_threshold = 1.5
        self.lookback_period = 20
        
        # Хранилище данных
        self.prices = deque(maxlen=self.lookback_period)
        self.volumes = deque(maxlen=self.lookback_period)
        self.levels = {"high": None, "low": None}
        self.entry_price = None
        self.position_open = False
        
    async def on_quote(self, quote_data: Dict[str, Any]):
        """Обработка новой котировки"""
        if not self.is_active:
            return
            
        price = quote_data.get("price")
        volume = quote_data.get("volume", 0)
        
        if price is None:
            return
            
        # Добавляем данные в историю
        self.prices.append(price)
        self.volumes.append(volume)
        
        # Обновляем уровни
        if len(self.prices) >= self.lookback_period:
            self.levels["high"] = max(self.prices)
            self.levels["low"] = min(self.prices)
            
        # Генерируем сигнал
        signal = await self.generate_signal(quote_data)
        if signal and await self.validate_signal(signal):
            # Исполняем сделку на демо-счёте
            side = signal["action"]
            result = await self.demo_account.execute_order(
                instrument=self.instrument,
                side=side,
                price=price,
                quantity=1
            )
            
            if result:
                self.position_open = True
                self.entry_price = price
                logger.info(f"[{self.name}] Сделка открыта: {side} по {price}")
                
    async def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict]:
        """Генерация торгового сигнала"""
        if not self.is_active or self.position_open:
            return None
            
        price = market_data.get("price")
        volume = market_data.get("volume", 0)
        
        if price is None or len(self.prices) < self.lookback_period:
            return None
            
        current_high = self.levels.get("high")
        current_low = self.levels.get("low")
        
        if current_high is None or current_low is None:
            return None
            
        # Проверяем увеличение объёма
        avg_volume = sum(self.volumes) / len(self.volumes) if self.volumes else 1
        volume_spike = volume > avg_volume * self.volume_threshold
        
        # Определяем направление пробоя
        if price > current_high and volume_spike:
            return {
                "action": "buy",
                "price": price,
                "reason": f"Пробой уровня {current_high} с объёмом {volume}"
            }
            
        elif price < current_low and volume_spike:
            return {
                "action": "sell",
                "price": price,
                "reason": f"Пробой уровня {current_low} с объёмом {volume}"
            }
            
        # Проверка тейк-профит и стоп-лосс для открытой позиции
        if self.position_open and self.entry_price:
            if price >= self.entry_price + self.take_profit:
                # Закрываем позицию
                await self._close_position(price, "take_profit")
            elif price <= self.entry_price - self.stop_loss:
                await self._close_position(price, "stop_loss")
                
        return None
        
    async def _close_position(self, price: float, reason: str):
        """Закрытие позиции"""
        side = "sell"  # Всегда продаём для закрытия long
        result = await self.demo_account.execute_order(
            instrument=self.instrument,
            side=side,
            price=price,
            quantity=1
        )
        
        if result:
            self.position_open = False
            self.entry_price = None
            logger.info(f"[{self.name}] Позиция закрыта: {reason} по {price}")
        
    async def validate_signal(self, signal: Dict) -> bool:
        """Проверка валидности сигнала"""
        return True  # Упрощённо
