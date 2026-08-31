import httpx
import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta

from app.core.config import settings
from app.utils.market_hours import MarketHours

logger = logging.getLogger(__name__)

class MOEXDataService:
    """Сервис для получения реальных котировок с MOEX"""
    
    def __init__(self):
        self.base_url = settings.MOEX_API_URL
        self.cache = {}
        self.last_update = {}
        self.last_valid_quotes = {}  # Храним последние валидные котировки
        
    async def get_quote(self, instrument: str) -> Optional[Dict[str, Any]]:
        """Получение текущей котировки для инструмента"""
        
        # Если рынок закрыт, возвращаем последнюю известную котировку
        if not MarketHours.is_market_open():
            logger.debug(f"Рынок закрыт, возвращаем кэшированную котировку {instrument}")
            return self.last_valid_quotes.get(instrument)
        
        try:
            security = settings.MOEX_INSTRUMENTS.get(instrument, {}).get("security")
            board = settings.MOEX_INSTRUMENTS.get(instrument, {}).get("board")
            
            if not security:
                logger.error(f"Неизвестный инструмент: {instrument}")
                return None
                
            url = f"{self.base_url}/engines/futures/markets/forts/boards/{board}/securities/{security}.json"
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                
                market_data = data.get("marketdata", {}).get("data", [])
                if not market_data:
                    logger.warning(f"Нет данных для {instrument}")
                    return self.last_valid_quotes.get(instrument)
                    
                row = market_data[0]
                columns = data["marketdata"]["columns"]
                
                quote = {
                    "instrument": instrument,
                    "price": self._get_value(row, columns, "LAST"),
                    "open": self._get_value(row, columns, "OPEN"),
                    "high": self._get_value(row, columns, "HIGH"),
                    "low": self._get_value(row, columns, "LOW"),
                    "volume": self._get_value(row, columns, "VOLTODAY"),
                    "time": datetime.now().isoformat(),
                    "change": 0.0
                }
                
                if quote["price"] and quote["price"] > 0:
                    # Сохраняем как последнюю валидную котировку
                    self.last_valid_quotes[instrument] = quote
                    
                    if quote["open"] and quote["open"] > 0:
                        quote["change"] = ((quote["price"] - quote["open"]) / quote["open"]) * 100
                
                self.cache[instrument] = quote
                self.last_update[instrument] = datetime.now()
                
                logger.debug(f"Котировка {instrument}: {quote['price']}")
                return quote
                
        except Exception as e:
            logger.error(f"Ошибка получения котировки {instrument}: {e}")
            return self.last_valid_quotes.get(instrument)

    def _get_value(self, row, columns, name):
        """Получение значения по имени колонки"""
        try:
            idx = columns.index(name)
            return row[idx]
        except (ValueError, IndexError):
            return None

# Глобальный экземпляр
market_data = MOEXDataService()
