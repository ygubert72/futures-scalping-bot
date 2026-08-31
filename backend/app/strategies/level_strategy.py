import logging
from typing import Dict, Any, Optional
from collections import deque
import numpy as np

from app.strategies.base_strategy import BaseStrategy
from app.services.demo_account import DemoAccount

logger = logging.getLogger(__name__)

class LevelStrategy(BaseStrategy):
    """
    СТРАТЕГИЯ ДЛЯ Si — ВОЗВРАТ К СРЕДНЕМУ (Mean Reversion)
    """
    
    def __init__(self, instrument: str = "Si", demo_account: DemoAccount = None):
        super().__init__(name="LevelStrategy", instrument=instrument)
        self.demo_account = demo_account
        
        # ПАРАМЕТРЫ
        self.ma_period = 20
        self.std_multiplier = 2.0   # для входа
        self.atr_multiplier = 1.5   # для стоп-лосса
        self.tp_ratio = 1.5         # тейк-профит = стоп * 1.5
        
        # ДАННЫЕ
        self.prices = deque(maxlen=100)
        self.entry_price = None
        self.position_open = False
        self.position_side = None
        
    async def on_quote(self, quote_data: Dict[str, Any]):
        if not self.is_active:
            return
            
        price = quote_data.get("price")
        if price is None:
            return
            
        self.prices.append(price)
        
        if len(self.prices) < self.ma_period:
            return
            
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
                self.position_side = signal["action"]
                logger.info(f"[Si] Открыта {signal['action']} по {price}")
                
    async def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict]:
        price = market_data.get("price")
        if price is None or len(self.prices) < self.ma_period:
            return None
            
        prices = list(self.prices)
        ma = np.mean(prices[-self.ma_period:])
        std = np.std(prices[-self.ma_period:])
        atr = self._calculate_atr(prices)
        
        # Проверка открытой позиции
        if self.position_open and self.entry_price:
            profit = self._calculate_profit(price)
            stop_loss = atr * self.atr_multiplier
            
            if self.position_side == 'buy':
                # Закрываем при возврате к средней
                if price >= ma:
                    await self._close_position(price, "mean_reversion")
                elif profit <= -stop_loss:
                    await self._close_position(price, "stop_loss")
            else:  # sell
                if price <= ma:
                    await self._close_position(price, "mean_reversion")
                elif profit <= -stop_loss:
                    await self._close_position(price, "stop_loss")
            return None
            
        # СИГНАЛ НА ВХОД
        deviation = (price - ma) / std
        
        if deviation < -self.std_multiplier:
            return {"action": "buy", "price": price, "reason": f"Отклонение {deviation:.2f}σ"}
            
        elif deviation > self.std_multiplier:
            return {"action": "sell", "price": price, "reason": f"Отклонение {deviation:.2f}σ"}
            
        return None
        
    def _calculate_atr(self, prices, period=14):
        if len(prices) < period + 1:
            return 0.5
        ranges = []
        for i in range(1, min(len(prices), period + 1)):
            ranges.append(abs(prices[-i] - prices[-i-1]))
        return np.mean(ranges) if ranges else 0.5
        
    def _calculate_profit(self, current_price):
        if self.position_side == 'buy':
            return current_price - self.entry_price
        else:
            return self.entry_price - current_price
            
    async def _close_position(self, price: float, reason: str):
        side = "sell" if self.position_side == 'buy' else "buy"
        result = await self.demo_account.execute_order(
            instrument=self.instrument,
            side=side,
            price=price,
            quantity=1
        )
        if result:
            self.position_open = False
            self.entry_price = None
            self.position_side = None
            logger.info(f"[Si] Закрыта: {reason} по {price}")
            
    async def validate_signal(self, signal: Dict) -> bool:
        return True
