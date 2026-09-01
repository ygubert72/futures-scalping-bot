from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from typing import Dict, Any, List
from datetime import datetime, timedelta
import logging
import random

# ... существующий код ...

@router.get("/history/{symbol}")
async def get_history(symbol: str, timeframe: str = "1min", limit: int = 500):
    """
    Получить исторические данные для графика
    
    Args:
        symbol: RTS или Si
        timeframe: 1min, 5min, 15min, 30min, 1hour, 4hour, 1day, 1week
        limit: количество свечей
    """
    if symbol not in ["RTS", "Si"]:
        raise HTTPException(status_code=400, detail="Неподдерживаемый инструмент")
    
    # В реальном приложении здесь запрос к API Финам
    # Сейчас генерируем тестовые данные
    
    # Определяем интервал в минутах
    interval_map = {
        "1min": 1,
        "5min": 5,
        "15min": 15,
        "30min": 30,
        "1hour": 60,
        "4hour": 240,
        "1day": 1440,
        "1week": 10080,
    }
    
    interval_minutes = interval_map.get(timeframe, 1)
    
    # Генерируем данные
    data = []
    now = datetime.now()
    price = 120000 if symbol == "RTS" else 90
    
    for i in range(limit, 0, -1):
        time_point = now - timedelta(minutes=interval_minutes * i)
        
        # Имитация движения цены
        change = (random.random() - 0.5) * 200 if symbol == "RTS" else (random.random() - 0.5) * 2
        open_price = price
        close_price = price + change
        high_price = max(open_price, close_price) + random.random() * 100
        low_price = min(open_price, close_price) - random.random() * 100
        price = close_price
        
        data.append({
            "time": int(time_point.timestamp()),
            "open": round(open_price, 2),
            "high": round(high_price, 2),
            "low": round(low_price, 2),
            "close": round(close_price, 2),
            "volume": random.randint(100, 1000)
        })
    
    return data

@router.websocket("/ws/chart/{symbol}")
async def websocket_chart_endpoint(websocket: WebSocket, symbol: str):
    """WebSocket для реальных котировок графика"""
    await websocket.accept()
    logger.info(f"Chart WebSocket подключён для {symbol}")
    
    try:
        while True:
            # Получаем сообщение от клиента
            data = await websocket.receive_text()
            logger.debug(f"Получено: {data}")
            
            # Имитация реальных котировок
            # В реальном приложении здесь будет подписка на API Финам
            import asyncio
            base_price = 120000 if symbol == "RTS" else 90
            
            for _ in range(100):  # Отправляем 100 котировок
                if symbol == "RTS":
                    price = base_price + (random.random() - 0.5) * 50
                else:
                    price = base_price + (random.random() - 0.5) * 0.5
                
                await websocket.send_json({
                    "type": "quote",
                    "symbol": symbol,
                    "price": round(price, 2),
                    "volume": random.randint(100, 500),
                    "timestamp": datetime.now().isoformat()
                })
                
                await asyncio.sleep(0.5)  # Каждые 500 мс
            
    except WebSocketDisconnect:
        logger.info(f"Chart WebSocket отключён для {symbol}")
    except Exception as e:
        logger.error(f"Chart WebSocket ошибка: {e}")
