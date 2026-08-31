import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from decimal import Decimal

from app.core.config import settings
from app.models.trade import Trade, TradeCreate
from app.models.account import Account, Position

logger = logging.getLogger(__name__)

class DemoAccount:
    """Демо-счёт с эмуляцией торговли"""
    
    def __init__(self):
        self.balance = settings.DEMO_BALANCE
        self.initial_balance = settings.DEMO_BALANCE
        self.currency = "RUB"
        self.positions: Dict[str, Position] = {}
        self.trades: List[Trade] = []
        self.commission = settings.DEMO_COMMISSION
        self.daily_loss_limit = settings.MAX_DAILY_LOSS
        self.daily_loss = 0.0
        self.trades_today = 0
        self.last_reset_date = datetime.now().date()
        
    def reset_daily_limit(self):
        """Сброс дневного лимита при новом дне"""
        today = datetime.now().date()
        if today != self.last_reset_date:
            self.daily_loss = 0.0
            self.trades_today = 0
            self.last_reset_date = today
            logger.info("Дневные лимиты сброшены")
            
    def can_trade(self) -> bool:
        """Проверка возможности торговли"""
        self.reset_daily_limit()
        
        # Проверка дневного лимита убытков
        max_loss = self.initial_balance * self.daily_loss_limit
        if self.daily_loss >= max_loss:
            logger.warning(f"Дневной лимит убытков достигнут: {self.daily_loss} руб.")
            return False
            
        # Проверка количества сделок
        if self.trades_today >= settings.MAX_TRADES_PER_DAY:
            logger.warning(f"Дневной лимит сделок достигнут: {self.trades_today}")
            return False
            
        return True
        
    async def execute_order(self, instrument: str, side: str, price: float, quantity: int = 1) -> Optional[Dict]:
        """
        Исполнение заявки на демо-счёте
        
        Args:
            instrument: RTS или Si
            side: buy или sell
            price: цена
            quantity: количество контрактов
            
        Returns:
            Dict с информацией о сделке
        """
        if not self.can_trade():
            return None
            
        # Проверка средств
        order_value = price * quantity
        commission = order_value * self.commission
        
        # Проверка для покупки
        if side == "buy":
            required = order_value + commission
            if required > self.balance:
                logger.warning(f"Недостаточно средств: требуется {required}, доступно {self.balance}")
                return None
                
            # Списание средств
            self.balance -= required
            
            # Открытие позиции
            position = Position(
                instrument=instrument,
                side="long",
                entry_price=price,
                current_price=price,
                quantity=quantity,
                profit=0.0,
                is_open=True
            )
            self.positions[instrument] = position
            
        elif side == "sell":
            # Проверка наличия позиции
            if instrument not in self.positions or not self.positions[instrument].is_open:
                logger.warning(f"Нет открытой позиции для {instrument}")
                return None
                
            position = self.positions[instrument]
            
            # Расчёт P&L
            if position.side == "long":
                profit = (price - position.entry_price) * quantity - commission
            else:  # short
                profit = (position.entry_price - price) * quantity - commission
                
            # Обновление баланса
            self.balance += price * quantity + profit
            
            # Закрытие позиции
            position.is_open = False
            position.profit = profit
            position.current_price = price
            
            # Обновление статистики
            self.daily_loss += abs(profit) if profit < 0 else 0
            self.trades_today += 1
            
            # Создание записи о сделке
            trade = {
                "id": len(self.trades) + 1,
                "instrument": instrument,
                "side": side,
                "price": price,
                "quantity": quantity,
                "timestamp": datetime.now().isoformat(),
                "status": "filled",
                "profit": profit,
                "close_price": price,
                "close_time": datetime.now().isoformat(),
                "commission": commission
            }
            self.trades.append(trade)
            
            logger.info(f"Сделка исполнена: {instrument} {side} {price} | P&L: {profit:.2f} ₽")
            return trade
            
        return None
        
    async def close_position(self, instrument: str) -> Optional[Dict]:
        """
        Закрытие позиции по текущей цене
        """
        if instrument not in self.positions:
            return None
            
        position = self.positions[instrument]
        if not position.is_open:
            return None
            
        current_price = position.current_price
        side = "sell" if position.side == "long" else "buy"
        
        return await self.execute_order(instrument, side, current_price, position.quantity)
        
    def get_balance(self) -> Dict:
        """Получение баланса"""
        # Расчёт текущей стоимости открытых позиций
        total_positions_value = 0
        for pos in self.positions.values():
            if pos.is_open:
                if pos.side == "long":
                    total_positions_value += (pos.current_price - pos.entry_price) * pos.quantity
                else:
                    total_positions_value += (pos.entry_price - pos.current_price) * pos.quantity
                    
        total_balance = self.balance + total_positions_value
        
        return {
            "balance": total_balance,
            "available": self.balance,
            "currency": self.currency,
            "initial_balance": self.initial_balance,
            "total_profit": total_balance - self.initial_balance,
            "positions_count": len([p for p in self.positions.values() if p.is_open])
        }
        
    def get_stats(self) -> Dict:
        """Получение статистики торговли"""
        closed_trades = [t for t in self.trades if t.get("status") == "filled"]
        
        if not closed_trades:
            return {
                "total_trades": 0,
                "winning_trades": 0,
                "losing_trades": 0,
                "total_profit": 0,
                "win_rate": 0,
                "avg_profit": 0,
                "avg_loss": 0,
                "max_drawdown": 0,
                "profit_factor": 0
            }
            
        wins = [t for t in closed_trades if t.get("profit", 0) > 0]
        losses = [t for t in closed_trades if t.get("profit", 0) < 0]
        
        total_profit = sum(t.get("profit", 0) for t in closed_trades)
        total_wins = sum(t.get("profit", 0) for t in wins)
        total_losses = abs(sum(t.get("profit", 0) for t in losses))
        
        return {
            "total_trades": len(closed_trades),
            "winning_trades": len(wins),
            "losing_trades": len(losses),
            "total_profit": total_profit,
            "win_rate": (len(wins) / len(closed_trades) * 100) if closed_trades else 0,
            "avg_profit": total_wins / len(wins) if wins else 0,
            "avg_loss": total_losses / len(losses) if losses else 0,
            "max_drawdown": self._calculate_max_drawdown(),
            "profit_factor": total_wins / total_losses if total_losses > 0 else float('inf')
        }
        
    def _calculate_max_drawdown(self) -> float:
        """Расчёт максимальной просадки"""
        if not self.trades:
            return 0.0
            
        balance_curve = [self.initial_balance]
        current_balance = self.initial_balance
        
        for trade in self.trades:
            current_balance += trade.get("profit", 0)
            balance_curve.append(current_balance)
            
        max_drawdown = 0.0
        peak = balance_curve[0]
        
        for value in balance_curve:
            if value > peak:
                peak = value
            drawdown = (peak - value) / peak * 100
            if drawdown > max_drawdown:
                max_drawdown = drawdown
                
        return max_drawdown

# Глобальный экземпляр
demo_account = DemoAccount()
