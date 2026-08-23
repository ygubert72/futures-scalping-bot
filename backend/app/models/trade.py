from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class TradeBase(BaseModel):
    """Базовая модель сделки"""
    instrument: str  # RTS или Si
    side: str  # buy или sell
    price: float
    quantity: int
    timestamp: datetime = datetime.now()

class TradeCreate(TradeBase):
    """Модель для создания сделки"""
    pass

class Trade(TradeBase):
    """Полная модель сделки с ID"""
    id: int
    status: str  # pending, filled, cancelled, rejected
    order_id: str
    profit: Optional[float] = None
    close_price: Optional[float] = None
    close_time: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class TradeStats(BaseModel):
    """Статистика по сделкам"""
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    total_profit: float = 0.0
    win_rate: float = 0.0
    avg_profit: float = 0.0
    avg_loss: float = 0.0
    max_drawdown: float = 0.0
