import asyncio
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime

import websockets
import aiohttp
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

class FinamClient:
    """Клиент для работы с API Финам"""
    
    def __init__(self):
        self.client_id = settings.FINAM_CLIENT_ID
        self.api_token = settings.FINAM_API_TOKEN
        self.base_url = settings.FINAM_API_URL
        self.ws_url = settings.FINAM_WS_URL
        self.ws_connection: Optional[websockets.WebSocketClientProtocol] = None
        self.is_connected = False
        self._message_handlers = []
        
    async def connect(self) -> bool:
        """Подключение к WebSocket API"""
        try:
            self.ws_connection = await websockets.connect(
                self.ws_url,
                extra_headers={
                    "Authorization": f"Bearer {self.api_token}"
                }
            )
            self.is_connected = True
            logger.info("Подключение к WebSocket API Финам установлено")
            return True
        except Exception as e:
            logger.error(f"Ошибка подключения к WebSocket: {e}")
            return False
            
    async def disconnect(self):
        """Отключение от WebSocket API"""
        if self.ws_connection:
            await self.ws_connection.close()
            self.is_connected = False
            logger.info("Отключение от WebSocket API Финам")
            
    async def subscribe_to_quotes(self, instruments: list):
        """Подписка на получение котировок по инструментам"""
        if not self.is_connected:
            await self.connect()
            
        for instrument in instruments:
            subscription_msg = {
                "action": "subscribe",
                "instrument": instrument,
                "type": "quotes"
            }
            await self.ws_connection.send(json.dumps(subscription_msg))
            logger.info(f"Подписка на котировки {instrument} отправлена")
            
    async def listen_quotes(self):
        """Прослушивание входящих сообщений с котировками"""
        if not self.is_connected:
            logger.error("Нет подключения к WebSocket")
            return
            
        try:
            async for message in self.ws_connection:
                try:
                    data = json.loads(message)
                    await self._process_message(data)
                except json.JSONDecodeError:
                    logger.warning(f"Получено невалидное JSON сообщение: {message}")
        except websockets.exceptions.ConnectionClosed:
            logger.warning("Соединение с WebSocket закрыто")
            self.is_connected = False
            
    async def _process_message(self, data: Dict[str, Any]):
        """Обработка полученных сообщений"""
        # Здесь будет логика обработки котировок
        # Пока просто логируем
        if data.get("type") == "quote":
            logger.debug(f"Котировка: {data}")
            # Вызываем зарегистрированные обработчики
            for handler in self._message_handlers:
                await handler(data)
                
    def register_handler(self, handler_func):
        """Регистрация обработчика сообщений"""
        self._message_handlers.append(handler_func)
        
    async def place_order(self, instrument: str, side: str, price: float, quantity: int = 1) -> Dict:
        """
        Отправка заявки на биржу
        
        Args:
            instrument: Инструмент (RTS, Si)
            side: Направление (buy, sell)
            price: Цена
            quantity: Количество контрактов
            
        Returns:
            Dict с информацией о заявке
        """
        # В демо-версии просто имитируем отправку заявки
        order_data = {
            "instrument": instrument,
            "side": side,
            "price": price,
            "quantity": quantity,
            "status": "filled",  # В демо всегда исполнено
            "order_id": f"DEMO_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        }
        logger.info(f"Заявка отправлена: {order_data}")
        return order_data
        
    async def get_balance(self) -> Dict:
        """Получение баланса счёта"""
        # В демо-версии возвращаем тестовые данные
        return {
            "balance": 1000000,  # 1 млн рублей на демо
            "available": 1000000,
            "currency": "RUB"
        }

# Создаём глобальный экземпляр клиента
finam_client = FinamClient()
