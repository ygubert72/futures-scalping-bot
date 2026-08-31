import logging
from typing import Dict, Any, Optional
from collections import deque

from app.strategies.base_strategy import BaseStrategy
from app.services.demo_account import DemoAccount

logger = logging.getLogger(__name__)

class LevelStrategy(BaseStrategy):
    """
    Стратегия отскока от уровней для Si
    """
    
    def __init__(self, instrument: str = "Si", demo_account: DemoAccount = None):
        super().__init__(name="LevelStrategy", instrument=instrument)
        self.demo_account = demo_account
        
        self.take_profit = 70
        self.stop_loss = 25
        self.lookback_period = 30
        self.rsi_period = 14
        
        self.prices = deque(maxlen=self.lookback_period)
        self.levels = {"high": None, "low": None}
        self.entry_price = None
        self.position_open = False
        
    async def on_quote(self, quote_data: Dict[str, Any]):
        """Обработка новой котировки"""
        if not self.is_active:
            return
            
        price = quote_data.get("price")
        if price is None:
            return
            
        self.prices.append(price)
        
        if len(self.prices) >= self.lookback_period:
            self.levels["high"] = max(self.prices)
            self.levels["low"] = min(self.prices)
            
        signal = await self.generate_signal(quote_data)
        if signal and await self.validate_signal(signal):
            result = await self.demo_account.execute_order(
                instrument=self.instrument,
                side=signal["action"],
                price=price,
                quantity=1
            )
            
            if result:
                self.position_open = True
                self.entry_price = price
                
    async def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict]:
        """Генерация торгового сигнала"""
        if not self.is_active or self.position_open:
            return None
            
        price = market_data.get("price")
        if price is None or len(self.prices) < self.lookback_period:
            return None
            
        current_high = self.levels.get("high")
        current_low = self.levels.get("low")
        
        if current_high is None or current_low is None:
            return None
            
        rsi = self._calculate_rsi()
        
        # Проверяем отскок от поддержки
        if price <= current_low * 1.001 and rsi < 30:
            if self._is_bounce_up():
                return {
                    "action": "buy",
                    "price": price,
                    "reason": f"Отскок от поддержки {current_low}, RSI={rsi:.1f}"
                }
                
        # Проверяем отскок от сопротивления
        if price >= current_high * 0.999 and rsi > 70:
            if self._is_bounce_down():
                return {
                    "action": "sell",
                    "price": price,
                    "reason": f"Отскок от сопротивления {current_high}, RSI={rsi:.1f}"
                }
                
        # Проверка тейк-профит и стоп-лосс
        if self.position_open and self.entry_price:
            if price >= self.entry_price + self.take_profit:
                await self._close_position(price, "take_profit")
            elif price <= self.entry_price - self.stop_loss:
                await self._close_position(price, "stop_loss")
                
        return None
        
    def _calculate_rsi(self) -> float:
        """Упрощённый расчёт RSI"""
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
        return 100 - (100 / (1 + rs))
        
    def _is_bounce_up(self) -> bool:
        if len(self.prices) < 5:
            return False
        prices = list(self.prices)
        return prices[-1] > prices[-2] and prices[-2] > prices[-3]
        
    def _is_bounce_down(self) -> bool:
        if len(self.prices) < 5:
            return False
        prices = list(self.prices)
        return prices[-1] < prices[-2] and prices[-2] < prices[-3]
        
    async def _close_position(self, price: float, reason: str):
        side = "sell"
        result = await self.demo_account.execute_order(
            instrument=self.instrument,
            side=side,
            price=price,
            quantity=1
        )
        if result:
            self.position_open = False
            self.entry_price = None
            
    async def validate_signal(self, signal: Dict) -> bool:
        return True
