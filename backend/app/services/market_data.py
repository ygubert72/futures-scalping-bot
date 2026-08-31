import httpx
import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from app.core.config import settings

logger = logging.getLogger(__name__)

class MOEXDataService:
    """Сервис для получения реальных котировок с MOEX"""
    
    def __init__(self):
        self.base_url = settings.MOEX_API_URL
        self.cache = {}
        self.last_update = {}
        
    async def get_quote(self, instrument: str) -> Optional[Dict[str, Any]]:
        """
        Получение текущей котировки для инструмента
        
        Args:
            instrument: RTS или Si
            
        Returns:
            Dict с полями: price, volume, high, low, time
        """
        try:
            # Получаем данные через MOEX ISS API
            security = settings.MOEX_INSTRUMENTS.get(instrument, {}).get("security")
            board = settings.MOEX_INSTRUMENTS.get(instrument, {}).get("board")
            
            if not security:
                logger.error(f"Неизвестный инструмент: {instrument}")
                return None
                
            # Запрос к MOEX
            url = f"{self.base_url}/engines/futures/markets/forts/boards/{board}/securities/{security}.json"
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                
                # Парсим данные
                market_data = data.get("marketdata", {}).get("data", [])
                if not market_data:
                    logger.warning(f"Нет данных для {instrument}")
                    return None
                    
                # Первая строка - текущие данные
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
                
                # Расчёт изменения
                if quote["open"] and quote["open"] > 0:
                    quote["change"] = ((quote["price"] - quote["open"]) / quote["open"]) * 100
                
                self.cache[instrument] = quote
                self.last_update[instrument] = datetime.now()
                
                logger.debug(f"Котировка {instrument}: {quote['price']}")
                return quote
                
        except Exception as e:
            logger.error(f"Ошибка получения котировки {instrument}: {e}")
            
            # Возвращаем из кэша, если есть
            if instrument in self.cache:
                logger.info(f"Использую кэшированную котировку {instrument}")
                return self.cache[instrument]
            return None
            
    def _get_value(self, row, columns, name):
        """Получение значения по имени колонки"""
        try:
            idx = columns.index(name)
            return row[idx]
        except (ValueError, IndexError):
            return None
            
    async def get_historical_data(self, instrument: str, days: int = 7) -> List[Dict]:
        """
        Получение исторических данных для стратегий
        
        Args:
            instrument: RTS или Si
            days: количество дней
            
        Returns:
            Список OHLCV данных
        """
        try:
            security = settings.MOEX_INSTRUMENTS.get(instrument, {}).get("security")
            board = settings.MOEX_INSTRUMENTS.get(instrument, {}).get("board")
            
            if not security:
                return []
                
            # Дата начала
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            url = f"{self.base_url}/engines/futures/markets/forts/boards/{board}/securities/{security}/candles.json"
            params = {
                "from": start_date.strftime("%Y-%m-%d"),
                "till": end_date.strftime("%Y-%m-%d"),
                "interval": 1  # 1 минута
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                
                candles = data.get("candles", {}).get("data", [])
                columns = data.get("candles", {}).get("columns", [])
                
                result = []
                for row in candles:
                    result.append({
                        "time": row[columns.index("begin")],
                        "open": row[columns.index("open")],
                        "high": row[columns.index("high")],
                        "low": row[columns.index("low")],
                        "close": row[columns.index("close")],
                        "volume": row[columns.index("volume")]
                    })
                    
                return result
                
        except Exception as e:
            logger.error(f"Ошибка получения истории {instrument}: {e}")
            return []

# Глобальный экземпляр
market_data = MOEXDataService()
