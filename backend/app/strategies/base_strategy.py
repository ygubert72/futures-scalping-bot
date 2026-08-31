from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class BaseStrategy(ABC):
    """Базовый класс для всех торговых стратегий"""
    
    def __init__(self, name: str, instrument: str):
        self.name = name
        self.instrument = instrument
        self.is_active = False
        self.positions = {}
        self.trades = []
        self.entry_price = None
        self.position_open = False
        self.position_side = None  # 'buy' или 'sell'
        
    @abstractmethod
    async def on_quote(self, quote_data: Dict[str, Any]):
        """Обработка новой котировки"""
        pass
        
    @abstractmethod
    async def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict]:
        """
        Генерация торгового сигнала
        
        Returns:
            Dict с полями: action (buy/sell), price, reason
            или None, если сигнала нет
        """
        pass
        
    async def validate_signal(self, signal: Dict) -> bool:
        """
        Проверка валидности сигнала перед отправкой заявки
        Можно переопределить в наследниках
        """
        return True
        
    async def on_trade_filled(self, trade_data: Dict[str, Any]):
        """Обработка исполненной сделки"""
        self.trades.append(trade_data)
        logger.info(f"[{self.name}] Сделка исполнена: {trade_data}")
        
    async def start(self):
        """Запуск стратегии"""
        self.is_active = True
        logger.info(f"[{self.name}] Стратегия запущена для {self.instrument}")
        
    async def stop(self):
        """Остановка стратегии"""
        self.is_active = False
        self.position_open = False
        self.entry_price = None
        self.position_side = None
        logger.info(f"[{self.name}] Стратегия остановлена")
        
    def get_stats(self) -> Dict:
        """Получение статистики стратегии"""
        total = len(self.trades)
        if total == 0:
            return {
                "total": 0,
                "wins": 0,
                "losses": 0,
                "win_rate": 0,
                "profit": 0,
                "avg_profit": 0,
                "max_profit": 0,
                "max_loss": 0
            }
            
        wins = sum(1 for t in self.trades if t.get('profit', 0) > 0)
        losses = sum(1 for t in self.trades if t.get('profit', 0) <= 0)
        total_profit = sum(t.get('profit', 0) for t in self.trades)
        profits = [t.get('profit', 0) for t in self.trades if t.get('profit', 0) > 0]
        losses_vals = [t.get('profit', 0) for t in self.trades if t.get('profit', 0) < 0]
        
        return {
            "total": total,
            "wins": wins,
            "losses": losses,
            "win_rate": wins / total if total > 0 else 0,
            "profit": total_profit,
            "avg_profit": sum(profits) / len(profits) if profits else 0,
            "max_profit": max(profits) if profits else 0,
            "max_loss": min(losses_vals) if losses_vals else 0,
        }
    
    def _calculate_profit(self, current_price: float) -> float:
        """Расчёт текущей прибыли по открытой позиции"""
        if not self.position_open or self.entry_price is None:
            return 0.0
            
        if self.position_side == 'buy':
            return current_price - self.entry_price
        else:  # sell
            return self.entry_price - current_price
    
    def _reset_position(self):
        """Сброс состояния позиции"""
        self.position_open = False
        self.entry_price = None
        self.position_side = None
