from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from typing import Dict, Any, List
from datetime import datetime
import logging

from app.services.market_data import market_data
from app.services.demo_account import demo_account
from app.strategies.impulse_strategy import ImpulseStrategy
from app.strategies.level_strategy import LevelStrategy
from app.utils.market_hours import MarketHours

logger = logging.getLogger(__name__)

router = APIRouter()
active_strategies = {}
ws_connections = []

@router.get("/status")
async def get_status():
    """Получить статус системы"""
    return {
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "market_open": MarketHours.is_market_open(),
        "market_remaining": MarketHours.get_session_remaining(),
        "strategies": len(active_strategies),
        "connections": len(ws_connections)
    }

# ... остальные эндпоинты остаются без изменений ...

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket для реального времени"""
    await websocket.accept()
    ws_connections.append(websocket)
    logger.info(f"WebSocket подключён, всего соединений: {len(ws_connections)}")
    
    try:
        await websocket.send_json({
            "type": "connected",
            "message": "Подключение установлено",
            "timestamp": datetime.now().isoformat()
        })
        
        import asyncio
        while True:
            try:
                # Получаем статус рынка
                market_open = MarketHours.is_market_open()
                
                # Получаем котировки только если рынок открыт
                rts_quote = None
                si_quote = None
                
                if market_open:
                    rts_quote = await market_data.get_quote("RTS")
                    si_quote = await market_data.get_quote("Si")
                else:
                    # Если рынок закрыт, используем последние данные
                    logger.debug("Рынок закрыт, котировки не обновляются")
                
                # Получаем баланс и статистику
                balance = demo_account.get_balance()
                stats = demo_account.get_stats()
                
                await websocket.send_json({
                    "type": "update",
                    "timestamp": datetime.now().isoformat(),
                    "market": {
                        "is_open": market_open,
                        "remaining": MarketHours.get_session_remaining(),
                        "next_session": MarketHours.get_next_session_start().isoformat()
                    },
                    "quotes": {
                        "RTS": rts_quote,
                        "Si": si_quote
                    },
                    "balance": balance,
                    "stats": stats,
                    "trades": demo_account.trades[-10:]
                })
                
                # Если рынок закрыт, увеличиваем интервал до 60 секунд
                interval = 2 if market_open else 60
                await asyncio.sleep(interval)
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket ошибка отправки: {e}")
                await asyncio.sleep(1)
                
    except WebSocketDisconnect:
        if websocket in ws_connections:
            ws_connections.remove(websocket)
        logger.info(f"WebSocket отключён, осталось: {len(ws_connections)}")
    except Exception as e:
        logger.error(f"WebSocket ошибка: {e}")
        if websocket in ws_connections:
            ws_connections.remove(websocket)
