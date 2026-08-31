import logging
from typing import Dict, Any, Optional
from collections import deque
import numpy as np

from app.strategies.base_strategy import BaseStrategy
from app.services.demo_account import DemoAccount

logger = logging.getLogger(__name__)

class ImpulseStrategy(BaseStrategy):
    """
    СТРАТЕГИЯ ДЛЯ RTS — СЛЕДОВАНИЕ ЗА ТРЕНДОМ
    """
    
    def __init__(self, instrument: str = "RTS", demo_account: DemoAccount = None):
        super().__init__(name="ImpulseStrategy", instrument=instrument)
        self.demo_account = demo_account
        
        # ПАРАМЕТРЫ
        self.atr_period = 14
        self.ma_fast_period = 5
        self.ma_slow_period = 20
        self.atr_multiplier = 2.0  # для стоп-лосса
        self.tp_ratio = 2.5        # тейк-профит = стоп * 2.5
        
        # ДАННЫЕ
        self.prices = deque(maxlen=100)
        self.entry_price = None
        self.position_open = False
        self.position_side = None  # 'buy' или 'sell'
        
    async def on_quote(self, quote_data: Dict[str, Any]):
        if not self.is_active:
            return
            
        price = quote_data.get("price")
        if price is None:
            return
            
        self.prices.append(price)
        
        if len(self.prices) < self.ma_slow_period:
            return
            
        # Генерируем сигнал
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
                logger.info(f"[RTS] Открыта {signal['action']} по {price}")
                
    async def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict]:
        price = market_data.get("price")
        if price is None or len(self.prices) < self.ma_slow_period:
            return None
            
        # ИНДИКАТОРЫ
        prices = list(self.prices)
        ma_fast = np.mean(prices[-self.ma_fast_period:])
        ma_slow = np.mean(prices[-self.ma_slow_period:])
        atr = self._calculate_atr(prices)
        
        # Проверка открытой позиции
        if self.position_open and self.entry_price:
            profit = self._calculate_profit(price)
            
            # Стоп-лосс (ATR * множитель)
            stop_loss = atr * self.atr_multiplier
            
            if self.position_side == 'buy':
                if profit >= stop_loss * self.tp_ratio:
                    await self._close_position(price, "take_profit")
                elif profit <= -stop_loss:
                    await self._close_position(price, "stop_loss")
            else:  # sell
                if profit >= stop_loss * self.tp_ratio:
                    await self._close_position(price, "take_profit")
                elif profit <= -stop_loss:
                    await self._close_position(price, "stop_loss")
            return None
            
        # СИГНАЛ НА ВХОД
        if ma_fast > ma_slow and (ma_fast - ma_slow) > atr * 0.5:
            return {"action": "buy", "price": price, "reason": "Тренд вверх"}
            
        elif ma_slow > ma_fast and (ma_slow - ma_fast) > atr * 0.5:
            return {"action": "sell", "price": price, "reason": "Тренд вниз"}
            
        return None
        
    def _calculate_atr(self, prices, period=14):
        if len(prices) < period + 1:
            return 50.0  # Значение по умолчанию
        # Упрощённый ATR
        ranges = []
        for i in range(1, min(len(prices), period + 1)):
            ranges.append(abs(prices[-i] - prices[-i-1]))
        return np.mean(ranges) if ranges else 50.0
        
    def _calculate_profit(self, current_price):
        if self.position_side == 'buy':
            return current_price - self.entry_price
        else:  # sell
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
            logger.info(f"[RTS] Закрыта: {reason} по {price}")
            
    async def validate_signal(self, signal: Dict) -> bool:
        return True
