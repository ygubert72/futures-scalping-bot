import logging
from typing import Dict, Any, Optional
from collections import deque
import numpy as np

from app.strategies.base_strategy import BaseStrategy
from app.services.demo_account import DemoAccount

logger = logging.getLogger(__name__)

class LevelStrategy(BaseStrategy):
    """
    ПЕРЕРАБОТАННАЯ СТРАТЕГИЯ ДЛЯ Si — ВОЗВРАТ К СРЕДНЕМУ + ТРЕНДОВЫЙ ФИЛЬТР
    """
    
    def __init__(self, instrument: str = "Si", demo_account: DemoAccount = None):
        super().__init__(name="LevelStrategy", instrument=instrument)
        self.demo_account = demo_account
        
        # НОВЫЕ ОПТИМИЗИРОВАННЫЕ ПАРАМЕТРЫ
        self.ma_period = 20
        self.std_multiplier = 2.5      # Увеличен для более сильных сигналов
        self.atr_multiplier = 2.0      # Увеличен для более широкого стопа
        self.tp_ratio = 2.0            # Уменьшен для более быстрой фиксации
        self.min_trend_threshold = 0.3  # Минимальная сила тренда для входа
        
        # ДАННЫЕ
        self.prices = deque(maxlen=100)
        self.entry_price = None
        self.position_open = False
        self.position_side = None
        self.last_signal_time = 0
        self.min_signal_interval = 30  # Минимальный интервал между сигналами (секунд)
        
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
                quantity=2  # Увеличиваем объем для Si (меньший риск на пункт)
            )
            if result:
                self.position_open = True
                self.entry_price = price
                self.position_side = signal["action"]
                self.last_signal_time = signal.get("timestamp", 0)
                logger.info(f"[Si] Открыта {signal['action']} по {price} (причина: {signal.get('reason', '')})")
                
    async def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict]:
        price = market_data.get("price")
        if price is None or len(self.prices) < self.ma_period:
            return None
            
        prices = list(self.prices)
        current_time = market_data.get("timestamp", 0)
        
        # === ИНДИКАТОРЫ ===
        ma = np.mean(prices[-self.ma_period:])
        std = np.std(prices[-self.ma_period:])
        atr = self._calculate_atr(prices)
        
        # === НОВЫЙ ФИЛЬТР: СИЛА ТРЕНДА ===
        # Используем наклон скользящей средней для определения тренда
        ma_prev = np.mean(prices[-self.ma_period-5:-5]) if len(prices) > self.ma_period + 5 else ma
        trend_slope = (ma - ma_prev) / atr if atr > 0 else 0
        trend_strength = abs(trend_slope)
        
        # Определяем направление тренда
        is_uptrend = trend_slope > 0.1
        is_downtrend = trend_slope < -0.1
        is_sideways = trend_strength < self.min_trend_threshold
        
        # === ФИЛЬТР: ИНТЕРВАЛ МЕЖДУ СИГНАЛАМИ ===
        time_since_last = current_time - self.last_signal_time
        if time_since_last < self.min_signal_interval * 1000 and self.last_signal_time > 0:
            return None
            
        # === УПРАВЛЕНИЕ ПОЗИЦИЕЙ ===
        if self.position_open and self.entry_price:
            profit = self._calculate_profit(price)
            stop_loss = atr * self.atr_multiplier
            
            if self.position_side == 'buy':
                # Тейк-профит
                if profit >= atr * 1.5:  # Фиксируем раньше
                    await self._close_position(price, "take_profit")
                # Стоп-лосс
                elif profit <= -stop_loss:
                    await self._close_position(price, "stop_loss")
                # Выход при развороте тренда
                elif is_downtrend and profit > 0:
                    await self._close_position(price, "trend_reversal")
            else:  # sell
                if profit >= atr * 1.5:
                    await self._close_position(price, "take_profit")
                elif profit <= -stop_loss:
                    await self._close_position(price, "stop_loss")
                elif is_uptrend and profit > 0:
                    await self._close_position(price, "trend_reversal")
            return None
            
        # === СИГНАЛ НА ВХОД ===
        deviation = (price - ma) / std if std > 0 else 0
        
        # Вход только в боковике или при слабом тренде
        if is_sideways:
            # Отскок от нижней границы
            if deviation < -self.std_multiplier:
                return {
                    "action": "buy", 
                    "price": price, 
                    "reason": f"Отскок вверх (отклонение: {deviation:.2f}σ)",
                    "timestamp": current_time
                }
            # Отскок от верхней границы
            elif deviation > self.std_multiplier:
                return {
                    "action": "sell", 
                    "price": price, 
                    "reason": f"Отскок вниз (отклонение: {deviation:.2f}σ)",
                    "timestamp": current_time
                }
                
        # Вход по тренду (только в сторону тренда)
        elif is_uptrend and deviation < -self.std_multiplier * 0.5:
            return {
                "action": "buy", 
                "price": price, 
                "reason": f"Коррекция вверх (тренд + отклонение: {deviation:.2f}σ)",
                "timestamp": current_time
            }
        elif is_downtrend and deviation > self.std_multiplier * 0.5:
            return {
                "action": "sell", 
                "price": price, 
                "reason": f"Коррекция вниз (тренд + отклонение: {deviation:.2f}σ)",
                "timestamp": current_time
            }
            
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
            quantity=2
        )
        if result:
            self.position_open = False
            self.entry_price = None
            self.position_side = None
            logger.info(f"[Si] Закрыта: {reason} по {price}")
            
    async def validate_signal(self, signal: Dict) -> bool:
        # Проверка: не входить при экстремальных движениях
        price = signal.get("price")
        if price is None:
            return False
            
        prices = list(self.prices)
        if len(prices) > 1:
            prev_close = prices[-1]
            gap = abs(price - prev_close)
            atr = self._calculate_atr(prices)
            if gap > atr * 2:  # Слишком большой гэп
                logger.warning(f"[Si] Гэп {gap} пунктов, вход отменен")
                return False
                
        return True
