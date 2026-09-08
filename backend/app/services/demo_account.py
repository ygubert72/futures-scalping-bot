import logging
import random
from typing import Dict, Any, Optional, List
from datetime import datetime
from decimal import Decimal

from app.core.config import settings

logger = logging.getLogger(__name__)

class DemoAccount:
    """Демо-счёт с профессиональным управлением рисками"""
    
    def __init__(self):
        self.balance = settings.DEMO_BALANCE
        self.initial_balance = settings.DEMO_BALANCE
        self.currency = "RUB"
        self.positions: Dict[str, Dict] = {}
        self.trades: List[Dict] = []
        self.commission = settings.DEMO_COMMISSION
        
        # Риск-менеджмент
        self.daily_loss = 0.0
        self.daily_trades = 0
        self.last_reset_date = datetime.now().date()
        self.max_daily_loss = settings.MAX_DAILY_LOSS
        self.max_trades_per_day = settings.MAX_TRADES_PER_DAY
        self.max_position_size = settings.MAX_POSITION_SIZE
        self.risk_per_trade = settings.RISK_PER_TRADE
        
        # Стоимость пункта
        self.point_cost = {"RTS": 1000, "Si": 10}
        
        # Slippage (проскальзывание)
        self.slippage = {"RTS": 10, "Si": 1}  # пунктов
        
    def reset_daily_limit(self):
        """Сброс дневных лимитов"""
        today = datetime.now().date()
        if today != self.last_reset_date:
            self.daily_loss = 0.0
            self.daily_trades = 0
            self.last_reset_date = today
            logger.info("Дневные лимиты сброшены")
            
    def can_trade(self) -> bool:
        """Проверка возможности торговли"""
        self.reset_daily_limit()
        
        # Проверка дневного убытка
        max_loss = self.initial_balance * self.max_daily_loss
        if self.daily_loss >= max_loss:
            logger.warning(f"Дневной лимит убытков достигнут: {self.daily_loss:.2f}")
            return False
            
        # Проверка количества сделок
        if self.daily_trades >= self.max_trades_per_day:
            logger.warning(f"Дневной лимит сделок: {self.daily_trades}/{self.max_trades_per_day}")
            return False
            
        return True
        
    def calculate_position_size(self, instrument: str, stop_loss_points: float) -> int:
        """Расчет размера позиции с учетом риска"""
        risk_amount = self.balance * self.risk_per_trade
        point_cost = self.point_cost.get(instrument, 10)
        
        risk_per_contract = stop_loss_points * point_cost
        size = int(risk_amount / risk_per_contract)
        
        size = max(1, min(size, self.max_position_size))
        
        # Ограничение для RTS
        if instrument == "RTS":
            size = min(size, 1)
            
        return size
        
    async def execute_order(self, instrument: str, side: str, price: float, quantity: int = 1) -> Optional[Dict]:
        """Исполнение заявки с симуляцией проскальзывания"""
        if not self.can_trade():
            return None
            
        # Симуляция проскальзывания
        slippage = self.slippage.get(instrument, 0)
        if side == "buy":
            exec_price = price + random.uniform(0, slippage)
        else:
            exec_price = price - random.uniform(0, slippage)
            
        # Округляем
        exec_price = round(exec_price, 2)
        
        # Комиссия
        commission = exec_price * quantity * self.commission
        
        # Проверка баланса для покупки
        if side == "buy":
            required = exec_price * quantity + commission
            if required > self.balance:
                logger.warning(f"Недостаточно средств: {required:.2f} > {self.balance:.2f}")
                return None
                
            self.balance -= required
            
            self.positions[instrument] = {
                "side": "long",
                "entry_price": exec_price,
                "quantity": quantity,
                "open_time": datetime.now().isoformat()
            }
            
            logger.info(f"ОТКРЫТА {instrument} LONG {quantity}x по {exec_price:.2f}")
            
        elif side == "sell":
            if instrument not in self.positions:
                logger.warning(f"Нет позиции для {instrument}")
                return None
                
            pos = self.positions[instrument]
            
            if pos["side"] == "long":
                profit = (exec_price - pos["entry_price"]) * quantity - commission
            else:
                profit = (pos["entry_price"] - exec_price) * quantity - commission
                
            self.balance += exec_price * quantity + profit
            
            trade = {
                "instrument": instrument,
                "side": pos["side"],
                "entry_price": pos["entry_price"],
                "exit_price": exec_price,
                "quantity": quantity,
                "profit": profit,
                "open_time": pos["open_time"],
                "close_time": datetime.now().isoformat(),
                "commission": commission
            }
            
            self.trades.append(trade)
            
            if profit < 0:
                self.daily_loss += abs(profit)
            self.daily_trades += 1
            
            del self.positions[instrument]
            
            logger.info(f"ЗАКРЫТА {instrument} P&L: {profit:+.2f}")
            return trade
            
        return None
        
    def get_stats(self) -> Dict:
        """Полная статистика"""
        closed_trades = [t for t in self.trades if "exit_price" in t]
        
        if not closed_trades:
            return {
                "total_trades": 0,
                "win_rate": 0,
                "profit_factor": 0,
                "total_profit": 0,
                "avg_win": 0,
                "avg_loss": 0,
                "max_win": 0,
                "max_loss": 0,
                "sharpe": 0,
                "max_drawdown": 0
            }
            
        profits = [t["profit"] for t in closed_trades]
        wins = [p for p in profits if p > 0]
        losses = [p for p in profits if p < 0]
        
        total_profit = sum(profits)
        win_rate = len(wins) / len(closed_trades) if closed_trades else 0
        gross_profit = sum(wins) if wins else 0
        gross_loss = abs(sum(losses)) if losses else 1
        
        return {
            "total_trades": len(closed_trades),
            "win_rate": round(win_rate * 100, 1),
            "profit_factor": round(gross_profit / gross_loss, 2),
            "total_profit": round(total_profit, 2),
            "avg_win": round(sum(wins) / len(wins), 2) if wins else 0,
            "avg_loss": round(sum(losses) / len(losses), 2) if losses else 0,
            "max_win": round(max(wins) if wins else 0, 2),
            "max_loss": round(min(losses) if losses else 0, 2),
            "sharpe": self._calculate_sharpe(profits),
            "max_drawdown": self._calculate_max_drawdown(profits)
        }
        
    def _calculate_sharpe(self, profits: List[float]) -> float:
        """Расчет Sharpe Ratio"""
        if len(profits) < 2:
            return 0
            
        mean_p = np.mean(profits)
        std_p = np.std(profits)
        
        if std_p == 0:
            return 0
            
        return (mean_p / std_p) * np.sqrt(252)
        
    def _calculate_max_drawdown(self, profits: List[float]) -> float:
        """Расчет максимальной просадки"""
        balance_curve = [self.initial_balance]
        for p in profits:
            balance_curve.append(balance_curve[-1] + p)
            
        peak = balance_curve[0]
        max_dd = 0
        
        for val in balance_curve:
            if val > peak:
                peak = val
            dd = (peak - val) / peak * 100
            if dd > max_dd:
                max_dd = dd
                
        return round(max_dd, 1)
