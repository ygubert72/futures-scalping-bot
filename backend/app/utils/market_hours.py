from datetime import datetime, time
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class MarketHours:
    """Класс для работы с торговыми часами"""
    
    @staticmethod
    def is_market_open() -> bool:
        """Проверяет, открыта ли биржа сейчас"""
        now = datetime.now().time()
        
        # Основная сессия
        if settings.MARKET_OPEN <= now <= settings.MARKET_CLOSE:
            return True
            
        # Вечерняя сессия
        if settings.EVENING_OPEN <= now <= settings.EVENING_CLOSE:
            return True
            
        return False
    
    @staticmethod
    def get_next_session_start() -> datetime:
        """Получает время начала следующей сессии"""
        now = datetime.now()
        
        # Если сейчас до 10:00 - сегодня в 10:00
        if now.time() < settings.MARKET_OPEN:
            return now.replace(hour=10, minute=0, second=0, microsecond=0)
        
        # Если сейчас между 18:45 и 19:00 - сегодня в 19:00
        if settings.MARKET_CLOSE < now.time() < settings.EVENING_OPEN:
            return now.replace(hour=19, minute=0, second=0, microsecond=0)
        
        # Если сейчас после 23:50 - завтра в 10:00
        if now.time() > settings.EVENING_CLOSE:
            tomorrow = now + timedelta(days=1)
            return tomorrow.replace(hour=10, minute=0, second=0, microsecond=0)
        
        # Иначе - сейчас торги идут
        return now
    
    @staticmethod
    def get_session_remaining() -> str:
        """Возвращает оставшееся время сессии в формате ЧЧ:ММ:СС"""
        if not MarketHours.is_market_open():
            return "Торги закрыты"
            
        now = datetime.now()
        close_time = None
        
        # Определяем время закрытия текущей сессии
        if now.time() <= settings.MARKET_CLOSE:
            close_time = now.replace(
                hour=settings.MARKET_CLOSE.hour,
                minute=settings.MARKET_CLOSE.minute,
                second=0
            )
        else:
            close_time = now.replace(
                hour=settings.EVENING_CLOSE.hour,
                minute=settings.EVENING_CLOSE.minute,
                second=0
            )
        
        remaining = close_time - now
        hours = remaining.seconds // 3600
        minutes = (remaining.seconds % 3600) // 60
        seconds = remaining.seconds % 60
        
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
