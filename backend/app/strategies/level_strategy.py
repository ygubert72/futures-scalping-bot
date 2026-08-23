import logging
from typing import Dict, Any, Optional
from collections import deque

from app.strategies.base_strategy import BaseStrategy

logger = logging.getLogger(__name__)

class LevelStrategy(BaseStrategy):
    """
    Стратегия отскока от уровней для Si
    
    Правила:
    - Вход при касании уровня поддержки/сопротивления
    - Подтверждение отскока (изменение направления)
    - Фильтр: RSI для перекупленности/перепроданности
    - Тейк-профит: 50-100 пунктов
    - Стоп-лосс: 20-30 пунктов
    """
    
    def __init__(self, instrument: str = "Si"):
        super().__init__(name="LevelStrategy", instrument=instrument)
        
        # Параметры стратегии
        self.take_profit = 70    # пунктов
        self.stop_loss = 25      # пунктов
        self.lookback_period = 30 # период для расчёта уровней
        self.rsi_period = 14     # период RSI
        
        # Хранилище данных
        self.prices = deque(maxlen=self.lookback_period)
        self.levels = {"high": None, "low": None}
        self.entry_price = None
        self.last_price = None
        
    async def on_quote(self, quote_data: Dict[str, Any]):
        """
        Обработка новой котировки
        """
        price = quote_data.get("price")
        
        if price is None:
            return
            
        self.last_price = price
        self.prices.append(price)
        
        # Обновляем уровни
        if len(self.prices) >= self.lookback_period:
            self.levels["high"] = max(self.prices)
            self.levels["low"] = min(self.prices)
            
        # Генерируем сигнал
        signal = await self.generate_signal(quote_data)
        if signal and await self.validate_signal(signal):
            logger.info(f"[{self.name}] Сигнал: {signal}")
            
    async def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict]:
        """
        Генерация торгового сигнала
        """
        if not self.is_active:
            return None
            
        price = market_data.get("price")
        
        if price is None or len(self.prices) < self.lookback_period:
            return None
            
        current_high = self.levels.get("high")
        current_low = self.levels.get("low")
        
        if current_high is None or current_low is None:
            return None
            
        # Расчёт RSI (упрощённый)
        rsi = self._calculate_rsi()
        
        # Проверяем отскок от уровня поддержки (покупка)
        if price <= current_low * 1.001 and rsi < 30:
            # Подтверждение: цена начала расти
            if self._is_bounce_up():
                return {
                    "action": "buy",
                    "price": price,
                    "reason": f"Отскок от поддержки {current_low}, RSI={rsi:.1f}",
                    "take_profit": price + self.take_profit,
                    "stop_loss": price - self.stop_loss
                }
                
        # Проверяем отскок от уровня сопротивления (продажа)
        if price >= current_high * 0.999 and rsi > 70:
            # Подтверждение: цена начала падать
            if self._is_bounce_down():
                return {
                    "action": "sell",
                    "price": price,
                    "reason": f"Отскок от сопротивления {current_high}, RSI={rsi:.1f}",
                    "take_profit": price - self.take_profit,
                    "stop_loss": price + self.stop_loss
                }
                
        return None
        
    def _calculate_rsi(self) -> float:
        """
        Упрощённый расчёт RSI
        """
        if len(self.prices) < self.rsi_period + 1:
            return 50.0
            
        gains = 0.0
        losses = 0.0
        
        prices = list(self.prices)
        for i in range(1, len(prices)):
            change = prices[i] - prices[i-1]
            if change >= 0:
                gains += change
            else:
                losses -= change
                
        if losses == 0:
            return 100.0
            
        rs = gains / losses
        rsi = 100 - (100 / (1 + rs))
        return rsi
        
    def _is_bounce_up(self) -> bool:
        """
        Проверка подтверждения отскока вверх
        """
        if len(self.prices) < 5:
            return False
            
        prices = list(self.prices)
        # Проверяем: последние 2 цены растут
        return prices[-1] > prices[-2] and prices[-2] > prices[-3]
        
    def _is_bounce_down(self) -> bool:
        """
        Проверка подтверждения отскока вниз
        """
        if len(self.prices) < 5:
            return False
            
        prices = list(self.prices)
        # Проверяем: последние 2 цены падают
        return prices[-1] < prices[-2] and prices[-2] < prices[-3]
        
    async def validate_signal(self, signal: Dict) -> bool:
        """
        Проверка валидности сигнала
        """
        # Проверяем, что у нас нет открытых позиций
        if self.entry_price is not None:
            return False
            
        # Проверяем, что цена не слишком далеко от уровня
        if abs(signal["price"] - self.prices[-1]) > self.stop_loss:
            return False
            
        return True
        
    async def on_trade_filled(self, trade_data: Dict[str, Any]):
        """
        Обработка исполненной сделки
        """
        await super().on_trade_filled(trade_data)
        self.entry_price = trade_data.get("price")
        
        if trade_data.get("close_price"):
            self.entry_price = None
