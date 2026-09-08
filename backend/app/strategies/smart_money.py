"""
SMART MONEY STRATEGY (Стратегия умных денег)
============================================
Основана на концепциях:
1. Wyckoff Accumulation/Distribution
2. Order Blocks (зоны крупных заявок)
3. Fair Value Gaps (разрывы)
4. Liquidity Sweeps (сбор ликвидности)
5. Change of Character (смена характера движения)
"""

import logging
import numpy as np
from typing import Dict, Any, Optional, List, Tuple
from collections import deque
from datetime import datetime

from app.strategies.base_strategy import BaseStrategy

logger = logging.getLogger(__name__)

class SmartMoneyStrategy(BaseStrategy):
    """
    Стратегия, следующая за "умными деньгами"
    """
    
    def __init__(self, instrument: str = "Si", demo_account=None):
        super().__init__(name="SmartMoney", instrument=instrument)
        self.demo_account = demo_account
        
        # Параметры
        self.lookback = 100
        self.min_order_block_size = 30
        self.fvg_threshold = 0.5  # Минимальный размер FVG в ATR
        self.liquidity_lookback = 50
        
        # Данные
        self.order_blocks: List[Dict] = []
        self.fvgs: List[Dict] = []
        self.liquidity_levels: List[float] = []
        self.higher_timeframe_trend = 'neutral'
        
        # Состояние
        self.accumulation_zone = None
        self.distribution_zone = None
        self.market_structure = 'range'  # 'trend', 'range', 'breakout'
        
    async def on_quote(self, quote_data: Dict[str, Any]):
        if not self.is_active:
            return
            
        price = quote_data.get("price")
        volume = quote_data.get("volume", 0)
        
        if price is None:
            return
            
        self.prices.append(price)
        self.volumes.append(volume)
        
        if len(self.prices) < self.lookback:
            return
            
        # Обновляем структуру рынка
        self._update_market_structure()
        
        # Ищем зоны умных денег
        self._find_order_blocks()
        self._find_fvgs()
        self._find_liquidity_levels()
        
        # Генерируем сигнал
        signal = await self.generate_signal(quote_data)
        if signal and await self.validate_signal(signal):
            await self._execute_signal(signal, price)
            
        # Управление позицией
        if self.position_open:
            await self._manage_position(price)
            
    async def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict]:
        """Генерация сигнала на основе Smart Money концепций"""
        price = market_data.get("price")
        
        if price is None or len(self.prices) < self.lookback:
            return None
            
        prices = list(self.prices)
        atr = self._calculate_atr()
        
        # === АНАЛИЗ СТРУКТУРЫ ===
        # 1. Находим последний Order Block
        latest_ob = self.order_blocks[-1] if self.order_blocks else None
        
        # 2. Находим FVG
        latest_fvg = self.fvgs[-1] if self.fvgs else None
        
        # 3. Определяем уровни ликвидности
        liquidity_buy = self._find_liquidity('buy')
        liquidity_sell = self._find_liquidity('sell')
        
        # 4. Определяем тренд на HTF
        htf_trend = self._get_htf_trend()
        
        # === ПОИСК СИГНАЛОВ ===
        signals = []
        
        # СИГНАЛ A: Вход от Order Block
        if latest_ob:
            ob_signal = self._analyze_order_block(latest_ob, price, atr)
            if ob_signal:
                signals.append(ob_signal)
                
        # СИГНАЛ B: Вход в FVG
        if latest_fvg:
            fvg_signal = self._analyze_fvg(latest_fvg, price, atr)
            if fvg_signal:
                signals.append(fvg_signal)
                
        # СИГНАЛ C: Сбор ликвидности
        if liquidity_buy or liquidity_sell:
            liq_signal = self._analyze_liquidity(price, liquidity_buy, liquidity_sell, atr)
            if liq_signal:
                signals.append(liq_signal)
                
        # === ВЫБОР ЛУЧШЕГО СИГНАЛА ===
        if signals:
            # Сортируем по качеству
            signals.sort(key=lambda x: x.get('confidence', 0), reverse=True)
            best = signals[0]
            
            if best['confidence'] > 70:
                return {
                    'action': best['action'],
                    'price': price,
                    'confidence': best['confidence'],
                    'reasons': best['reasons'],
                    'stop_loss': best.get('stop_loss'),
                    'take_profit': best.get('take_profit'),
                    'type': best.get('type', 'smart_money')
                }
                
        return None
        
    def _find_order_blocks(self):
        """Поиск Order Blocks (зоны крупных заявок)"""
        prices = list(self.prices)
        
        if len(prices) < 20:
            return
            
        # Ищем свечи с большим объемом и разворотом
        for i in range(5, len(prices) - 5):
            candle = prices[i]
            prev = prices[i-1]
            next_candle = prices[i+1]
            
            volume = list(self.volumes)[i] if i < len(self.volumes) else 0
            avg_volume = np.mean(list(self.volumes)[-20:]) if len(self.volumes) >= 20 else volume
            
            # Объемный всплеск
            if volume < avg_volume * 1.5:
                continue
                
            # Бычий Order Block
            if prev < candle and next_candle < candle:
                if len(self.order_blocks) == 0 or abs(self.order_blocks[-1]['price'] - candle) > 10:
                    self.order_blocks.append({
                        'type': 'bullish',
                        'price': candle,
                        'low': min(prev, candle),
                        'high': max(prev, candle),
                        'volume': volume,
                        'time': i
                    })
                    
            # Медвежий Order Block
            elif prev > candle and next_candle > candle:
                if len(self.order_blocks) == 0 or abs(self.order_blocks[-1]['price'] - candle) > 10:
                    self.order_blocks.append({
                        'type': 'bearish',
                        'price': candle,
                        'low': min(prev, candle),
                        'high': max(prev, candle),
                        'volume': volume,
                        'time': i
                    })
                    
        # Оставляем только последние 10 блоков
        if len(self.order_blocks) > 10:
            self.order_blocks = self.order_blocks[-10:]
            
    def _find_fvgs(self):
        """Поиск Fair Value Gaps"""
        prices = list(self.prices)
        
        if len(prices) < 20:
            return
            
        for i in range(1, len(prices) - 1):
            prev = prices[i-1]
            current = prices[i]
            next_candle = prices[i+1]
            
            # Бычий FVG: up gap
            if prev > current and current > next_candle:
                if len(self.fvgs) == 0 or abs(self.fvgs[-1]['top'] - prev) > 5:
                    self.fvgs.append({
                        'type': 'bullish',
                        'top': prev,
                        'bottom': current,
                        'mid': (prev + current) / 2,
                        'time': i
                    })
                    
            # Медвежий FVG: down gap
            elif prev < current and current < next_candle:
                if len(self.fvgs) == 0 or abs(self.fvgs[-1]['top'] - current) > 5:
                    self.fvgs.append({
                        'type': 'bearish',
                        'top': current,
                        'bottom': prev,
                        'mid': (current + prev) / 2,
                        'time': i
                    })
                    
        if len(self.fvgs) > 10:
            self.fvgs = self.fvgs[-10:]
            
    def _find_liquidity_levels(self):
        """Поиск уровней ликвидности (свип-уровни)"""
        prices = list(self.prices)
        
        if len(prices) < self.liquidity_lookback:
            return
            
        recent = prices[-self.liquidity_lookback:]
        
        # Локальные максимумы и минимумы
        highs = []
        lows = []
        
        for i in range(2, len(recent) - 2):
            if recent[i] > recent[i-1] and recent[i] > recent[i-2] and \
               recent[i] > recent[i+1] and recent[i] > recent[i+2]:
                highs.append(recent[i])
            if recent[i] < recent[i-1] and recent[i] < recent[i-2] and \
               recent[i] < recent[i+1] and recent[i] < recent[i+2]:
                lows.append(recent[i])
                
        # Объединяем близкие уровни
        self.liquidity_levels = []
        for level in sorted(set(highs + lows)):
            # Проверка, нет ли уже близкого уровня
            if not self.liquidity_levels or abs(self.liquidity_levels[-1] - level) > 10:
                self.liquidity_levels.append(level)
                
        # Оставляем последние 20 уровней
        if len(self.liquidity_levels) > 20:
            self.liquidity_levels = self.liquidity_levels[-20:]
            
    def _analyze_order_block(self, ob: Dict, price: float, atr: float) -> Optional[Dict]:
        """Анализ Order Block для входа"""
        if ob['type'] == 'bullish' and price < ob['price']:
            distance = ob['price'] - price
            if distance < atr * 0.5:  # Близко к блоку
                return {
                    'action': 'buy',
                    'confidence': 75,
                    'reasons': [f'Order Block {ob["type"]}'],
                    'stop_loss': ob['low'] - atr * 0.3,
                    'take_profit': ob['price'] + atr * 2,
                    'type': 'order_block'
                }
        elif ob['type'] == 'bearish' and price > ob['price']:
            distance = price - ob['price']
            if distance < atr * 0.5:
                return {
                    'action': 'sell',
                    'confidence': 75,
                    'reasons': [f'Order Block {ob["type"]}'],
                    'stop_loss': ob['high'] + atr * 0.3,
                    'take_profit': ob['price'] - atr * 2,
                    'type': 'order_block'
                }
        return None
        
    def _analyze_fvg(self, fvg: Dict, price: float, atr: float) -> Optional[Dict]:
        """Анализ FVG для входа"""
        if fvg['type'] == 'bullish' and price < fvg['top'] and price > fvg['bottom']:
            # Цена внутри FVG
            return {
                'action': 'buy',
                'confidence': 70,
                'reasons': [f'FVG {fvg["type"]}'],
                'stop_loss': fvg['bottom'] - atr * 0.5,
                'take_profit': fvg['top'] + atr * 2,
                'type': 'fvg'
            }
        elif fvg['type'] == 'bearish' and price < fvg['top'] and price > fvg['bottom']:
            return {
                'action': 'sell',
                'confidence': 70,
                'reasons': [f'FVG {fvg["type"]}'],
                'stop_loss': fvg['top'] + atr * 0.5,
                'take_profit': fvg['bottom'] - atr * 2,
                'type': 'fvg'
            }
        return None
        
    def _analyze_liquidity(self, price: float, buy_level: float, sell_level: float, atr: float) -> Optional[Dict]:
        """Анализ уровней ликвидности"""
        # Сбор ликвидности выше или ниже
        if buy_level and price < buy_level and abs(price - buy_level) < atr * 0.3:
            # Цена под уровнем, ждем пробой вверх
            return {
                'action': 'buy',
                'confidence': 75,
                'reasons': ['Liquidity sweep buy'],
                'stop_loss': price - atr * 1.5,
                'take_profit': buy_level + atr * 2,
                'type': 'liquidity'
            }
        elif sell_level and price > sell_level and abs(price - sell_level) < atr * 0.3:
            return {
                'action': 'sell',
                'confidence': 75,
                'reasons': ['Liquidity sweep sell'],
                'stop_loss': price + atr * 1.5,
                'take_profit': sell_level - atr * 2,
                'type': 'liquidity'
            }
        return None
        
    def _find_liquidity(self, side: str) -> Optional[float]:
        """Поиск ближайшего уровня ликвидности"""
        price = self.prices[-1] if self.prices else 0
        levels = self.liquidity_levels
        
        if side == 'buy':
            # Ищем ближайший уровень выше цены
            above = [l for l in levels if l > price]
            return min(above) if above else None
        else:
            below = [l for l in levels if l < price]
            return max(below) if below else None
            
    def _update_market_structure(self):
        """Обновление структуры рынка"""
        if len(self.prices) < 50:
            return
            
        prices = list(self.prices)
        recent = prices[-30:]
        
        # Определяем тренд
        slope = np.polyfit(range(len(recent)), recent, 1)[0]
        
        if slope > 1:
            self.market_structure = 'uptrend'
        elif slope < -1:
            self.market_structure = 'downtrend'
        else:
            self.market_structure = 'range'
            
    def _get_htf_trend(self) -> str:
        """Определение тренда на более высоком таймфрейме"""
        if len(self.prices) < 50:
            return 'neutral'
            
        prices = list(self.prices)
        
        # EMA 50 и EMA 200
        ema_50 = self._calculate_ema(50)
        ema_200 = self._calculate_ema(200)
        
        if ema_50 > ema_200:
            return 'bullish'
        elif ema_50 < ema_200:
            return 'bearish'
        return 'neutral'
        
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
        
    async def _execute_signal(self, signal: Dict, price: float):
        """Исполнение сигнала"""
        if self.position_open:
            return
            
        await self.open_position(
            signal['action'],
            price,
            f"{signal['type']}: {', '.join(signal['reasons'])}"
        )
        
        self.stop_loss = signal['stop_loss']
        self.take_profit = signal['take_profit']
        
        if self.demo_account:
            await self.demo_account.execute_order(
                instrument=self.instrument,
                side=signal['action'],
                price=price,
                quantity=self.quantity
            )
            
    async def _manage_position(self, price: float):
        """Управление позицией"""
        if not self.position_open:
            return
            
        profit = self._calculate_profit(price)
        atr = self._calculate_atr()
        
        # === ТРЕЙЛИНГ-СТОП С УМНЫМ ДЕНЬГАМИ ===
        if profit > atr * 0.5:
            # Ищем следующий уровень ликвидности для трейлинга
            if self.position_side == 'buy':
                next_liq = self._find_liquidity('buy')
                if next_liq:
                    new_sl = max(self.stop_loss, next_liq - atr * 0.3)
                    if new_sl > self.stop_loss:
                        self.stop_loss = new_sl
            else:
                next_liq = self._find_liquidity('sell')
                if next_liq:
                    new_sl = min(self.stop_loss, next_liq + atr * 0.3)
                    if new_sl < self.stop_loss:
                        self.stop_loss = new_sl
                        
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
