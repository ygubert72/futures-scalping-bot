from sqlalchemy import Column, Integer, Float, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.core.database import Base

class Account(Base):
    __tablename__ = "accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, default="demo")
    balance = Column(Float, default=100000.0)
    available = Column(Float, default=100000.0)
    currency = Column(String, default="RUB")
    total_profit = Column(Float, default=0.0)
    total_trades = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Position(Base):
    __tablename__ = "positions"
    
    id = Column(Integer, primary_key=True, index=True)
    instrument = Column(String)
    side = Column(String)  # long или short
    entry_price = Column(Float)
    current_price = Column(Float)
    quantity = Column(Integer)
    profit = Column(Float, default=0.0)
    is_open = Column(Boolean, default=True)
    opened_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
