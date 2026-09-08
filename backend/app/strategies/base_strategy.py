from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from datetime import datetime
import logging
import numpy as np
from collections import deque

logger = logging.getLogger(__name__)

class BaseStrategy(ABC):
    """Базовый класс для всех торговых стратегий"""
    
    def __init__(self, name: str, instrument: str):
        self.name = name
        self.instrument = instrument
        self.is_active = False
        
        # Данные для индикаторов
        self.prices = deque(maxlen=200)
        self.volumes = deque(maxlen=200)
        self.bid_ask_imbalance = deque(maxlen=200)
        
        # Позиция
        self.position_open = False
        self.entry_price = None
        self.entry_time = None
        self.position_side = None  # 'buy' или 'sell'
        self.quantity = 1
        self.stop_loss = None
        self.take_profit = None
        
        # Статистика
        self.trades: List[Dict] = []
        self.pnl_history: List[float] = []
        
        # Параметры риска
        self.risk_per_trade = 0.01  # 1% от баланса
        self.max_daily_loss = 0.03  # 3% в день
        self.max_trades_per_day = 10
        
        # Кэш
        self._cache = {}
        
    @abstractmethod
    async def on_quote(self, quote_data: Dict[str, Any]):
        """Обработка новой котировки"""
        pass
        
    @abstractmethod
    async def generate_signal(self, market_data: Dict[str, Any]) -> Optional[Dict]:
        """Генерация торгового сигнала"""
        pass
    
    async def validate_signal(self, signal: Dict) -> bool:
        """Проверка валидности сигнала"""
        if not signal:
            return False
            
        # Проверка: не входить при экстремальных движениях
        price = signal.get("price")
        if price is None:
            return False
            
        # Проверка: достаточно ли данных
        if len(self.prices) < 20:
            return False
            
        # Проверка: интервал между сделками
        if self.trades:
            last_trade = self.trades[-1]
            # Используем close_time если есть, иначе open_time
            trade_time_str = last_trade.get('close_time') or last_trade.get('open_time') or last_trade.get('time')
            if trade_time_str:
                try:
                    # Пробуем разные форматы даты
                    if isinstance(trade_time_str, str):
                        trade_time = datetime.fromisoformat(trade_time_str.replace('Z', '+00:00'))
                    else:
                        trade_time = trade_time_str
                    time_since = (datetime.now() - trade_time).total_seconds()
                    if time_since < 30:  # Минимум 30 секунд между сделками
                        return False
                except (ValueError, TypeError, AttributeError):
                    # Если не удалось распарсить время, пропускаем проверку
                    pass
                
        return True
        
    async def on_trade_filled(self, trade_data: Dict[str, Any]):
        """Обработка исполненной сделки"""
        self.trades.append(trade_data)
        logger.info(f"[{self.name}] Сделка: {trade_data}")
        
    async def start(self):
        self.is_active = True
        logger.info(f"[{self.name}] Запущена для {self.instrument}")
        
    async def stop(self):
        self.is_active = False
        if self.position_open:
            await self.close_position(self.prices[-1] if self.prices else self.entry_price, "manual_stop")
        logger.info(f"[{self.name}] Остановлена")
        
    def get_stats(self) -> Dict:
        """Получение статистики"""
        total = len(self.trades)
        if total == 0:
            return {
                "total": 0, "wins": 0, "losses": 0,
                "win_rate": 0, "profit": 0, "avg_profit": 0,
                "max_profit": 0, "max_loss": 0, "profit_factor": 0,
                "sharpe_ratio": 0, "max_drawdown": 0
            }
            
        profits = [t.get('profit', 0) for t in self.trades]
        wins = [p for p in profits if p > 0]
        losses = [p for p in profits if p < 0]
        
        total_profit = sum(profits)
        win_rate = len(wins) / total if total > 0 else 0
        
        # Profit Factor
        gross_profit = sum(wins) if wins else 0
        gross_loss = abs(sum(losses)) if losses else 1
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
        
        # Sharpe Ratio (упрощенно)
        mean_profit = np.mean(profits) if profits else 0
        std_profit = np.std(profits) if len(profits) > 1 else 1
        sharpe = (mean_profit / std_profit) * np.sqrt(252) if std_profit > 0 else 0
        
        # Max Drawdown
        balance_curve = [100000]
        for p in profits:
            balance_curve.append(balance_curve[-1] + p)
        peak = balance_curve[0]
        max_drawdown = 0
        for val in balance_curve:
            if val > peak:
                peak = val
            drawdown = (peak - val) / peak * 100
            if drawdown > max_drawdown:
                max_drawdown = drawdown
                
        return {
            "total": total,
            "wins": len(wins),
            "losses": len(losses),
            "win_rate": round(win_rate * 100, 1),
            "profit": round(total_profit, 2),
            "avg_profit": round(sum(profits) / total, 2),
            "max_profit": round(max(wins) if wins else 0, 2),
            "max_loss": round(min(losses) if losses else 0, 2),
            "profit_factor": round(profit_factor, 2),
            "sharpe_ratio": round(sharpe, 2),
            "max_drawdown": round(max_drawdown, 1)
        }
        
    async def open_position(self, side: str, price: float, reason: str):
        """Открытие позиции"""
        if self.position_open:
            return
            
        self.position_side = side
        self.entry_price = price
        self.entry_time = datetime.now()
        self.position_open = True
        
        # Расчет стоп-лосса и тейк-профита
        atr = self._calculate_atr()
        if side == 'buy':
            self.stop_loss = price - atr * 1.5
            self.take_profit = price + atr * 2.5
        else:
            self.stop_loss = price + atr * 1.5
            self.take_profit = price - atr * 2.5
            
        logger.info(f"[{self.name}] ОТКРЫТА {side} по {price:.4f} | SL: {self.stop_loss:.4f} | TP: {self.take_profit:.4f} | {reason}")
        
    async def close_position(self, price: float, reason: str):
        """Закрытие позиции"""
        if not self.position_open:
            return
            
        profit = 0
        if self.position_side == 'buy':
            profit = (price - self.entry_price) * self.quantity
        else:
            profit = (self.entry_price - price) * self.quantity
            
        trade = {
            'instrument': self.instrument,
            'side': self.position_side,
            'entry_price': self.entry_price,
            'exit_price': price,
            'quantity': self.quantity,
            'profit': profit,
            'open_time': self.entry_time.isoformat(),
            'close_time': datetime.now().isoformat(),
            'reason': reason,
            'duration_seconds': (datetime.now() - self.entry_time).total_seconds()
        }
        
        self.trades.append(trade)
        self.pnl_history.append(profit)
        
        self.position_open = False
        self.entry_price = None
        self.entry_time = None
        self.position_side = None
        
        logger.info(f"[{self.name}] ЗАКРЫТА {self.instrument} P&L: {profit:+.2f} | {reason}")
        
    def _calculate_atr(self, period: int = 14) -> float:
        """Расчет ATR"""
        if len(self.prices) < period + 1:
            return 0.01
            
        prices = list(self.prices)
        trs = []
        for i in range(1, min(len(prices), period + 1)):
            high = prices[-i]
            low = prices[-i]
            prev_close = prices[-i-1] if i < len(prices) else high
            tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
            trs.append(tr)
            
        return np.mean(trs) if trs else 0.01
        
    def _calculate_rsi(self, period: int = 14) -> float:
        """Расчет RSI"""
        if len(self.prices) < period + 1:
            return 50.0
            
        prices = list(self.prices)
        gains = []
        losses = []
        
        for i in range(1, period + 1):
            diff = prices[-i] - prices[-i-1]
            if diff > 0:
                gains.append(diff)
                losses.append(0)
            else:
                gains.append(0)
                losses.append(-diff)
                
        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period
        
        if avg_loss == 0:
            return 100.0
            
        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))
        
    def _calculate_profit(self, current_price: float) -> float:
        """Расчёт текущей прибыли по открытой позиции"""
        if not self.position_open or self.entry_price is None:
            return 0.0
            
        if self.position_side == 'buy':
            return (current_price - self.entry_price) * self.quantity
        else:  # sell
            return (self.entry_price - current_price) * self.quantity
