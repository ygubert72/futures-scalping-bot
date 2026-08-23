import logging
from typing import Dict, Any, Optional
from collections import deque

from app.strategies.base_strategy import BaseStrategy

logger = logging.getLogger(__name__)

class ImpulseStrategy(BaseStrategy):
    """
    Стратегия импульсного пробоя для RTS
    
    Правила:
    - Вход при пробое уровня с увеличением объёма
    - Тейк-профит: 100-150 пунктов
    - Стоп-лосс: 40-50 пунктов
    - Фильтр: ATR для определения волатильности
    """
    
    def __init__(self, instrument: str = "RTS"):
        super().__init__(name="ImpulseStrategy", instrument=instrument)
        
        # Параметры стратегии
        self.take_profit = 120  # пунктов
        self.stop_loss = 45     # пунктов
        self.volume_threshold = 1.5  # увеличение объёма в X раз
        self.lookback_period = 20    # период для расчёта уровней
        
        # Хранилище данных
        self.prices = deque(maxlen=self.lookback_period)
        self.volumes = deque(maxlen=self.lookback_period)
        self.levels = {"high": None, "low": None}
        self.entry_price = None
        
    async def on_quote(self, quote_data: Dict[str, Any]):
        """
        Обработка новой котировки
        """
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
            # Здесь будет отправка заявки через клиент
            logger.info(f"[{self.name}] Сигнал: {signal}")
            # В реальном коде здесь был бы вызов finam_client.place_order()
            
    async def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict]:
        """
        Генерация торгового сигнала
        """
        if not self.is_active:
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
                "reason": f"Пробой уровня {current_high} с объёмом {volume}",
                "take_profit": price + self.take_profit,
                "stop_loss": price - self.stop_loss
            }
            
        elif price < current_low and volume_spike:
            return {
                "action": "sell",
                "price": price,
                "reason": f"Пробой уровня {current_low} с объёмом {volume}",
                "take_profit": price - self.take_profit,
                "stop_loss": price + self.stop_loss
            }
            
        return None
        
    async def validate_signal(self, signal: Dict) -> bool:
        """
        Проверка валидности сигнала
        """
        # Проверяем, что у нас нет открытых позиций
        if self.entry_price is not None:
            return False
            
        # Проверяем, что цена не слишком далеко от текущей
        if abs(signal["price"] - self.prices[-1]) > self.stop_loss * 2:
            return False
            
        return True
        
    async def on_trade_filled(self, trade_data: Dict[str, Any]):
        """
        Обработка исполненной сделки
        """
        await super().on_trade_filled(trade_data)
        self.entry_price = trade_data.get("price")
        
        # Если сделка закрыта (есть close_price)
        if trade_data.get("close_price"):
            self.entry_price = None
