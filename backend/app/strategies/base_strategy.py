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
        
    @abstractmethod
    async def on_quote(self, quote_data: Dict[str, Any]):
        """
        Обработка новой котировки
        
        Args:
            quote_data: Данные котировки (цена, объем, время)
        """
        pass
        
    @abstractmethod
    async def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict]:
        """
        Генерация торгового сигнала
        
        Returns:
            Dict с полями: action (buy/sell/close), price, reason
            или None, если сигнала нет
        """
        pass
        
    @abstractmethod
    async def validate_signal(self, signal: Dict) -> bool:
        """
        Проверка валидности сигнала перед отправкой заявки
        """
        pass
        
    async def on_trade_filled(self, trade_data: Dict[str, Any]):
        """
        Обработка исполненной сделки
        """
        self.trades.append(trade_data)
        logger.info(f"[{self.name}] Сделка исполнена: {trade_data}")
        
    async def start(self):
        """Запуск стратегии"""
        self.is_active = True
        logger.info(f"[{self.name}] Стратегия запущена для {self.instrument}")
        
    async def stop(self):
        """Остановка стратегии"""
        self.is_active = False
        logger.info(f"[{self.name}] Стратегия остановлена")
        
    def get_stats(self) -> Dict:
        """Получение статистики стратегии"""
        total = len(self.trades)
        if total == 0:
            return {"total": 0, "win_rate": 0, "profit": 0}
            
        wins = sum(1 for t in self.trades if t.get('profit', 0) > 0)
        total_profit = sum(t.get('profit', 0) for t in self.trades)
        
        return {
            "total": total,
            "wins": wins,
            "losses": total - wins,
            "win_rate": wins / total if total > 0 else 0,
            "profit": total_profit,
            "avg_profit": total_profit / total if total > 0 else 0
        }
