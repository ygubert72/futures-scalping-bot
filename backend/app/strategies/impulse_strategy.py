import logging
from typing import Dict, Any, Optional
from collections import deque
import numpy as np

from app.strategies.base_strategy import BaseStrategy
from app.services.demo_account import DemoAccount

logger = logging.getLogger(__name__)

class ImpulseStrategy(BaseStrategy):
    """
    УЛУЧШЕННАЯ СТРАТЕГИЯ ДЛЯ RTS — ИМПУЛЬСНЫЙ ПРОБОЙ С ФИЛЬТРАМИ
    """
    
    def __init__(self, instrument: str = "RTS", demo_account: DemoAccount = None):
        super().__init__(name="ImpulseStrategy", instrument=instrument)
        self.demo_account = demo_account
        
        # НОВЫЕ ОПТИМИЗИРОВАННЫЕ ПАРАМЕТРЫ
        self.atr_period = 14
        self.ma_fast_period = 5
        self.ma_slow_period = 20
        self.atr_multiplier = 1.5      # Уменьшен для более точного входа
        self.tp_ratio = 2.5            # Сохранен для хорошего соотношения
        self.min_volume_threshold = 100  # Минимальный объем для подтверждения
        
        # ДАННЫЕ
        self.prices = deque(maxlen=100)
        self.volumes = deque(maxlen=100)
        self.entry_price = None
        self.position_open = False
        self.position_side = None
        
    async def on_quote(self, quote_data: Dict[str, Any]):
        if not self.is_active:
            return
            
        price = quote_data.get("price")
        volume = quote_data.get("volume", 0)
        
        if price is None:
            return
            
        self.prices.append(price)
        self.volumes.append(volume)
        
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
                logger.info(f"[RTS] Открыта {signal['action']} по {price} (причина: {signal.get('reason', '')})")
                
    async def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict]:
        price = market_data.get("price")
        volume = market_data.get("volume", 0)
        
        if price is None or len(self.prices) < self.ma_slow_period:
            return None
            
        prices = list(self.prices)
        volumes = list(self.volumes)
        
        # === ИНДИКАТОРЫ ===
        ma_fast = np.mean(prices[-self.ma_fast_period:])
        ma_slow = np.mean(prices[-self.ma_slow_period:])
        atr = self._calculate_atr(prices)
        
        # === ФИЛЬТР 1: ОБЪЕМ ===
        avg_volume = np.mean(volumes[-20:]) if len(volumes) >= 20 else 1
        volume_confirm = volume > avg_volume * 1.5  # Объем выше среднего на 50%
        
        # === ФИЛЬТР 2: ВОЛАТИЛЬНОСТЬ ===
        volatility_ok = atr > 30  # Минимальная волатильность для торговли
        
        # === ФИЛЬТР 3: НАПРАВЛЕНИЕ ТРЕНДА ===
        trend_strength = abs(ma_fast - ma_slow) / atr if atr > 0 else 0
        is_trending = trend_strength > 0.5  # Тренд достаточно сильный
        
        # === ФИЛЬТР 4: ПРОБОЙ УРОВНЕЙ ===
        high_20 = max(prices[-20:])
        low_20 = min(prices[-20:])
        price_vs_high = (price - high_20) / atr if atr > 0 else 0
        price_vs_low = (low_20 - price) / atr if atr > 0 else 0
        
        # === УПРАВЛЕНИЕ ПОЗИЦИЕЙ ===
        if self.position_open and self.entry_price:
            profit = self._calculate_profit(price)
            stop_loss = atr * self.atr_multiplier
            
            # Трейлинг-стоп для фиксации прибыли
            if profit > stop_loss * 0.5:
                # Обновляем стоп-лосс на уровне безубытка
                pass
            
            if self.position_side == 'buy':
                if profit >= stop_loss * self.tp_ratio:
                    await self._close_position(price, "take_profit")
                elif profit <= -stop_loss:
                    await self._close_position(price, "stop_loss")
                # Трейлинг-стоп
                elif profit > stop_loss * 1.5:
                    # Передвигаем стоп на уровень безубытка
                    pass
            else:  # sell
                if profit >= stop_loss * self.tp_ratio:
                    await self._close_position(price, "take_profit")
                elif profit <= -stop_loss:
                    await self._close_position(price, "stop_loss")
            return None
            
        # === СИГНАЛ НА ВХОД ===
        # Условие 1: Пробой вверх с подтверждением
        if (price > high_20 and volume_confirm and is_trending and volatility_ok 
            and price_vs_high > 0.3):
            return {
                "action": "buy", 
                "price": price, 
                "reason": f"Пробой вверх (объем: {volume}, тренд: {trend_strength:.2f})"
            }
            
        # Условие 2: Пробой вниз с подтверждением
        elif (price < low_20 and volume_confirm and is_trending and volatility_ok 
              and price_vs_low > 0.3):
            return {
                "action": "sell", 
                "price": price, 
                "reason": f"Пробой вниз (объем: {volume}, тренд: {trend_strength:.2f})"
            }
            
        return None
        
    def _calculate_atr(self, prices, period=14):
        if len(prices) < period + 1:
            return 50.0
        ranges = []
        for i in range(1, min(len(prices), period + 1)):
            ranges.append(abs(prices[-i] - prices[-i-1]))
        return np.mean(ranges) if ranges else 50.0
        
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
            logger.info(f"[RTS] Закрыта: {reason} по {price}")
            
    async def validate_signal(self, signal: Dict) -> bool:
        # Дополнительная проверка: не входить при экстремальных движениях
        price = signal.get("price")
        if price is None:
            return False
            
        # Проверка: не входить при гэпах
        prices = list(self.prices)
        if len(prices) > 1:
            prev_close = prices[-1]
            gap = abs(price - prev_close)
            if gap > 100:  # Слишком большой гэп
                logger.warning(f"[RTS] Гэп {gap} пунктов, вход отменен")
                return False
                
        return True
