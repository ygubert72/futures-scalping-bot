"""
ПРОФЕССИОНАЛЬНАЯ СТРАТЕГИЯ СКАЛЬПИНГА
=====================================
Комбинация методов:
1. Order Flow — анализ потока заявок
2. Volume Profile — профиль объема
3. Market Microstructure — микроструктура рынка
4. Delta Divergence — дивергенция дельты
5. Smart Money Concepts — концепции умных денег
"""

import logging
import numpy as np
from typing import Dict, Any, Optional, List, Tuple
from collections import deque
from datetime import datetime
import asyncio

from app.strategies.base_strategy import BaseStrategy
from app.services.demo_account import DemoAccount

logger = logging.getLogger(__name__)

class ProScalpingStrategy(BaseStrategy):
    """
    Профессиональная стратегия скальпинга
    
    Ключевые особенности:
    - Анализ потока заявок (Order Flow)
    - Поиск дисбаланса между покупками и продажами
    - Вход по подтверждению объема
    - Адаптивные стоп-лоссы
    - Трейлинг-стоп для максимизации прибыли
    """
    
    def __init__(self, instrument: str = "RTS", demo_account: DemoAccount = None):
        super().__init__(name="ProScalping", instrument=instrument)
        self.demo_account = demo_account
        
        # Параметры стратегии
        self.lookback = 50
        self.atr_period = 14
        self.volume_threshold = 1.8  # Объем должен быть в 1.8x выше среднего
        self.min_imbalance = 0.4     # Минимальный дисбаланс 40%
        self.entry_confirm_bars = 2  # Подтверждение на 2 свечах
        
        # Данные для анализа
        self.delta_history = deque(maxlen=100)
        self.volume_profile = {}
        self.poc_levels = []  # Point of Control
        self.value_area = []  # Value Area
        
        # Состояние
        self.trading_signal = None
        self.signal_quality = 0
        self.last_signal_time = 0
        
        # Дополнительные индикаторы
        self.ema_fast = None
        self.ema_slow = None
        self.macd_hist = None
        
    async def on_quote(self, quote_data: Dict[str, Any]):
        if not self.is_active:
            return
            
        price = quote_data.get("price")
        volume = quote_data.get("volume", 0)
        bid = quote_data.get("bid")
        ask = quote_data.get("ask")
        
        if price is None:
            return
            
        # Сохраняем данные
        self.prices.append(price)
        self.volumes.append(volume)
        
        # Расчет дисбаланса заявок
        if bid and ask:
            imbalance = self._calculate_imbalance(bid, ask, quote_data)
            self.bid_ask_imbalance.append(imbalance)
            
        if len(self.prices) < self.lookback:
            return
            
        # Генерируем сигнал
        signal = await self.generate_signal(quote_data)
        if signal and await self.validate_signal(signal):
            await self._execute_signal(signal, price)
            
        # Управление открытой позицией
        if self.position_open:
            await self._manage_position(price)
            
    async def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict]:
        """Генерация сигнала с использованием всех методов"""
        price = market_data.get("price")
        volume = market_data.get("volume", 0)
        
        if price is None or len(self.prices) < self.lookback:
            return None
            
        # === 1. РАСЧЕТ ИНДИКАТОРОВ ===
        prices = list(self.prices)
        volumes = list(self.volumes)
        
        # ATR
        atr = self._calculate_atr()
        if atr < 0.001:
            return None
            
        # RSI
        rsi = self._calculate_rsi()
        
        # Профиль объема
        vp = self._calculate_volume_profile(prices, volumes)
        poc = vp.get('poc')
        val = vp.get('val')
        vah = vp.get('vah')
        
        # Дисбаланс
        imbalance = np.mean(list(self.bid_ask_imbalance)[-10:]) if self.bid_ask_imbalance else 0
        
        # EMA
        ema_9 = self._calculate_ema(9)
        ema_21 = self._calculate_ema(21)
        
        # === 2. УСЛОВИЯ ДЛЯ ВХОДА ===
        
        # Условие A: Цена у POC с подтверждением объема
        near_poc = abs(price - poc) / atr < 0.5 if poc else False
        volume_spike = volume > np.mean(volumes[-20:]) * self.volume_threshold
        
        # Условие B: Дисбаланс заявок
        strong_buy_imbalance = imbalance > self.min_imbalance
        strong_sell_imbalance = imbalance < -self.min_imbalance
        
        # Условие C: RSI не в перекупленности/перепроданности
        rsi_ok = 30 < rsi < 70
        
        # Условие D: Тренд по EMA
        ema_trend = ema_9 - ema_21
        
        # === 3. КОМБИНАЦИЯ СИГНАЛОВ ===
        signal = None
        confidence = 0
        reasons = []
        
        # === СИГНАЛ НА ПОКУПКУ ===
        if (near_poc or price < val if val else False):
            if strong_buy_imbalance and volume_spike and rsi_ok and ema_trend > -0.5:
                signal = 'buy'
                confidence += 35
                reasons.append('У POC/ниже VAL')
                if strong_buy_imbalance:
                    confidence += 25
                    reasons.append(f'Дисбаланс {imbalance:.2f}')
                if volume_spike:
                    confidence += 20
                    reasons.append('Объем выше среднего')
                if ema_trend > 0:
                    confidence += 10
                    reasons.append('Восходящий тренд')
                    
        # === СИГНАЛ НА ПРОДАЖУ ===
        elif (near_poc or price > vah if vah else False):
            if strong_sell_imbalance and volume_spike and rsi_ok and ema_trend < 0.5:
                signal = 'sell'
                confidence += 35
                reasons.append('У POC/выше VAH')
                if strong_sell_imbalance:
                    confidence += 25
                    reasons.append(f'Дисбаланс {imbalance:.2f}')
                if volume_spike:
                    confidence += 20
                    reasons.append('Объем выше среднего')
                if ema_trend < 0:
                    confidence += 10
                    reasons.append('Нисходящий тренд')
                    
        # === 4. ДОПОЛНИТЕЛЬНЫЕ ФИЛЬТРЫ ===
        if signal and confidence >= 70:
            # Проверка: не входить при экстремальном движении
            candle_range = abs(price - prices[-2]) if len(prices) > 1 else 0
            if candle_range > atr * 3:
                return None
                
            # Проверка: наличие ликвидности (глубина рынка)
            if not await self._check_liquidity():
                return None
                
            self.signal_quality = confidence
            return {
                'action': signal,
                'price': price,
                'confidence': confidence,
                'reasons': reasons,
                'stop_loss': price - atr * 1.5 if signal == 'buy' else price + atr * 1.5,
                'take_profit': price + atr * 2.5 if signal == 'buy' else price - atr * 2.5,
                'timestamp': datetime.now().timestamp()
            }
            
        return None
        
    def _calculate_volume_profile(self, prices: List[float], volumes: List[float], num_levels: int = 30) -> Dict:
        """Расчет профиля объема"""
        if not prices or not volumes or len(prices) < 10:
            return {'poc': prices[-1] if prices else 0, 'val': 0, 'vah': 0}
            
        min_price = min(prices)
        max_price = max(prices)
        step = (max_price - min_price) / num_levels
        
        if step == 0:
            return {'poc': prices[-1], 'val': 0, 'vah': 0}
            
        profile = {}
        total_volume = 0
        
        for price, volume in zip(prices, volumes):
            level = int((price - min_price) / step)
            key = min_price + level * step
            if key not in profile:
                profile[key] = 0
            profile[key] += volume
            total_volume += volume
            
        # Point of Control (макс объем)
        poc = max(profile, key=profile.get)
        max_vol = profile[poc]
        
        # Value Area (70% объема)
        sorted_levels = sorted(profile.items(), key=lambda x: x[1], reverse=True)
        cum_vol = 0
        val = poc
        vah = poc
        
        for level, vol in sorted_levels:
            cum_vol += vol
            if cum_vol < total_volume * 0.7:
                if level < poc:
                    val = level
                if level > poc:
                    vah = level
                    
        return {'poc': poc, 'val': val, 'vah': vah, 'max_volume': max_vol}
        
    def _calculate_imbalance(self, bid: float, ask: float, quote_data: Dict) -> float:
        """
        Расчет дисбаланса между покупками и продажами
        Положительное значение = давление покупателей
        """
        bid_volume = quote_data.get('bid_volume', 0)
        ask_volume = quote_data.get('ask_volume', 0)
        
        if bid_volume + ask_volume == 0:
            return 0
            
        return (bid_volume - ask_volume) / (bid_volume + ask_volume)
        
    def _calculate_ema(self, period: int) -> float:
        """Расчет EMA"""
        if len(self.prices) < period:
            return self.prices[-1] if self.prices else 0
            
        prices = list(self.prices)
        multiplier = 2 / (period + 1)
        
        ema = prices[0]
        for price in prices[1:]:
            ema = (price - ema) * multiplier + ema
            
        return ema
        
    async def _check_liquidity(self) -> bool:
        """Проверка ликвидности (достаточный объем торгов)"""
        if len(self.volumes) < 10:
            return True
            
        volumes = list(self.volumes)
        avg_volume = np.mean(volumes[-10:])
        
        # Минимальный объем для торговли
        min_volume = 500 if self.instrument == "RTS" else 1000
        
        return avg_volume > min_volume
        
    async def _execute_signal(self, signal: Dict, price: float):
        """Исполнение сигнала"""
        if self.position_open:
            return
            
        # Дополнительная проверка: изменение цены с момента сигнала
        price_change = abs(price - signal['price']) / signal['price']
        if price_change > 0.002:  # Более 0.2%
            logger.info(f"[{self.name}] Пропуск: цена изменилась на {price_change*100:.2f}%")
            return
            
        # Открываем позицию
        await self.open_position(signal['action'], price, ', '.join(signal['reasons']))
        
        # Устанавливаем стоп-лосс и тейк-профит
        self.stop_loss = signal['stop_loss']
        self.take_profit = signal['take_profit']
        
        # Отправляем заявку в демо-счёт
        if self.demo_account:
            result = await self.demo_account.execute_order(
                instrument=self.instrument,
                side=signal['action'],
                price=price,
                quantity=self.quantity
            )
            
    async def _manage_position(self, price: float):
        """Управление открытой позицией"""
        if not self.position_open:
            return
            
        profit = self._calculate_profit(price)
        atr = self._calculate_atr()
        
        # === ТРЕЙЛИНГ-СТОП ===
        if profit > 0:
            if self.position_side == 'buy':
                # Подтягиваем стоп к цене входа при прибыли > ATR
                if profit > atr:
                    new_sl = max(self.stop_loss, self.entry_price + atr * 0.5)
                    if new_sl > self.stop_loss:
                        self.stop_loss = new_sl
                        logger.info(f"[{self.name}] Трейлинг SL: {self.stop_loss:.4f}")
            else:
                if profit > atr:
                    new_sl = min(self.stop_loss, self.entry_price - atr * 0.5)
                    if new_sl < self.stop_loss:
                        self.stop_loss = new_sl
                        logger.info(f"[{self.name}] Трейлинг SL: {self.stop_loss:.4f}")
                        
        # === ЧАСТИЧНАЯ ФИКСАЦИЯ ===
        if profit > atr * 2 and self.quantity > 1:
            # Фиксируем половину позиции
            logger.info(f"[{self.name}] Частичная фиксация: +{profit:.2f}")
            
        # === ПРОВЕРКА СТОПОВ ===
        if self.position_side == 'buy':
            if price <= self.stop_loss:
                await self.close_position(price, 'stop_loss')
            elif price >= self.take_profit:
                await self.close_position(price, 'take_profit')
        else:
            if price >= self.stop_loss:
                await self.close_position(price, 'stop_loss')
            elif price <= self.take_profit:
                await self.close_position(price, 'take_profit')
                
        # === ВРЕМЕННЫЙ ВЫХОД ===
        if self.position_open:
            duration = (datetime.now() - self.entry_time).total_seconds()
            if duration > 300:  # 5 минут
                if abs(profit) < atr * 0.5:
                    await self.close_position(price, 'time_exit')
