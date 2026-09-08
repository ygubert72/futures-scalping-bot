"""
Анализ потока заявок (Order Flow)
================================
Реальный анализ рыночного потока для профессионального скальпинга
"""

import logging
import numpy as np
from typing import Dict, List, Optional, Tuple
from collections import deque
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class OrderFlowData:
    """Данные потока заявок"""
    timestamp: float
    price: float
    bid_volume: int
    ask_volume: int
    delta: float  # bid_volume - ask_volume
    cumulative_delta: float
    vwap: float
    imbalance: float  # (bid_volume - ask_volume) / (bid_volume + ask_volume)

class OrderFlowAnalyzer:
    """
    Анализатор потока заявок
    
    Ключевые метрики:
    - Delta: разница между объемом покупок и продаж
    - CVD: Cumulative Volume Delta
    - VWAP: Volume Weighted Average Price
    - Imbalance: дисбаланс заявок
    - Absorption: поглощение объемов
    """
    
    def __init__(self, window: int = 100):
        self.window = window
        self.data: deque = deque(maxlen=window)
        self.cvd = 0.0
        self.vwap_history = deque(maxlen=window)
        self.delta_history = deque(maxlen=window)
        
    def add_tick(self, bid: float, ask: float, bid_vol: int, ask_vol: int):
        """Добавление тика"""
        mid = (bid + ask) / 2
        delta = bid_vol - ask_vol
        self.cvd += delta
        
        # VWAP
        total_vol = bid_vol + ask_vol
        if total_vol > 0:
            vwap = (bid * bid_vol + ask * ask_vol) / total_vol
        else:
            vwap = mid
            
        data = OrderFlowData(
            timestamp=datetime.now().timestamp(),
            price=mid,
            bid_volume=bid_vol,
            ask_volume=ask_vol,
            delta=delta,
            cumulative_delta=self.cvd,
            vwap=vwap,
            imbalance=(bid_vol - ask_vol) / total_vol if total_vol > 0 else 0
        )
        
        self.data.append(data)
        self.delta_history.append(delta)
        self.vwap_history.append(vwap)
        
    def get_metrics(self) -> Dict:
        """Получение всех метрик"""
        if len(self.data) < 10:
            return {}
            
        deltas = [d.delta for d in self.data]
        imbalances = [d.imbalance for d in self.data]
        prices = [d.price for d in self.data]
        
        return {
            'delta': {
                'current': deltas[-1] if deltas else 0,
                'avg': np.mean(deltas) if deltas else 0,
                'std': np.std(deltas) if len(deltas) > 1 else 0,
                'cvd': self.cvd,
                'trend': self._calculate_delta_trend(deltas)
            },
            'imbalance': {
                'current': imbalances[-1] if imbalances else 0,
                'avg': np.mean(imbalances) if imbalances else 0,
                'std': np.std(imbalances) if len(imbalances) > 1 else 0
            },
            'vwap': {
                'current': self.vwap_history[-1] if self.vwap_history else 0,
                'avg': np.mean(list(self.vwap_history)) if self.vwap_history else 0
            },
            'price_vs_vwap': prices[-1] - self.vwap_history[-1] if prices and self.vwap_history else 0
        }
        
    def _calculate_delta_trend(self, deltas: List[float]) -> str:
        """Определение тренда дельты"""
        if len(deltas) < 20:
            return 'neutral'
            
        recent = deltas[-10:]
        older = deltas[-20:-10]
        
        mean_recent = np.mean(recent)
        mean_older = np.mean(older)
        
        diff = mean_recent - mean_older
        
        if diff > 5:
            return 'bullish'
        elif diff < -5:
            return 'bearish'
        return 'neutral'
        
    def detect_absorption(self) -> Optional[Dict]:
        """
        Обнаружение поглощения объемов
        Absorption = крупный объем на одной стороне, который не двигает цену
        """
        if len(self.data) < 5:
            return None
            
        recent = list(self.data)[-5:]
        
        # Ищем большой объем при малом изменении цены
        price_range = max(d.price for d in recent) - min(d.price for d in recent)
        total_vol = sum(d.bid_volume + d.ask_volume for d in recent)
        
        # Если объем большой, а цена почти не меняется
        if total_vol > 1000 and price_range < 5:
            # Определяем, где было поглощение
            bid_vol_sum = sum(d.bid_volume for d in recent)
            ask_vol_sum = sum(d.ask_volume for d in recent)
            
            if bid_vol_sum > ask_vol_sum * 1.5:
                return {
                    'side': 'buy',
                    'strength': bid_vol_sum / ask_vol_sum,
                    'price_range': price_range,
                    'total_volume': total_vol
                }
            elif ask_vol_sum > bid_vol_sum * 1.5:
                return {
                    'side': 'sell',
                    'strength': ask_vol_sum / bid_vol_sum,
                    'price_range': price_range,
                    'total_volume': total_vol
                }
                
        return None
        
    def detect_delta_divergence(self) -> Optional[Dict]:
        """
        Обнаружение дивергенции между ценой и дельтой
        """
        if len(self.data) < 30:
            return None
            
        prices = [d.price for d in self.data]
        deltas = [d.delta for d in self.data]
        
        # Цена делает новые максимумы, а дельта падает
        price_high = max(prices[-10:])
        delta_recent = deltas[-10:]
        
        if price_high > max(prices[-20:-10]):
            if max(delta_recent) < max(deltas[-20:-10]):
                return {
                    'type': 'bearish_divergence',
                    'price': price_high,
                    'delta': delta_recent[-1]
                }
                
        # Цена делает новые минимумы, а дельта растет
        price_low = min(prices[-10:])
        if price_low < min(prices[-20:-10]):
            if min(delta_recent) > min(deltas[-20:-10]):
                return {
                    'type': 'bullish_divergence',
                    'price': price_low,
                    'delta': delta_recent[-1]
                }
                
        return None
