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

# ============================================================
#  СТАТУС
# ============================================================
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

# ============================================================
#  БАЛАНС
# ============================================================
@router.get("/balance")
async def get_balance():
    """Получить баланс демо-счёта"""
    return demo_account.get_balance()

# ============================================================
#  СТАТИСТИКА
# ============================================================
@router.get("/stats")
async def get_stats():
    """Получить статистику"""
    return demo_account.get_stats()

# ============================================================
#  СДЕЛКИ
# ============================================================
@router.get("/trades")
async def get_trades(limit: int = 20):
    """Получить последние сделки"""
    return demo_account.trades[-limit:] if demo_account.trades else []

# ============================================================
#  КОТИРОВКИ
# ============================================================
@router.get("/quote/{instrument}")
async def get_quote(instrument: str):
    """Получить текущую котировку"""
    if instrument not in ["RTS", "Si"]:
        raise HTTPException(status_code=400, detail="Неизвестный инструмент")
    quote = await market_data.get_quote(instrument)
    if not quote:
        raise HTTPException(status_code=503, detail="Нет данных от MOEX")
    return quote

# ============================================================
#  ЗАПУСК СТРАТЕГИИ
# ============================================================
@router.post("/strategies/start")
async def start_strategy(instrument: str, strategy_type: str = "impulse"):
    """Запустить стратегию"""
    if instrument not in ["RTS", "Si"]:
        raise HTTPException(status_code=400, detail="Неподдерживаемый инструмент")
    
    if strategy_type == "impulse":
        strategy = ImpulseStrategy(instrument, demo_account)
    elif strategy_type == "level":
        strategy = LevelStrategy(instrument, demo_account)
    else:
        raise HTTPException(status_code=400, detail="Неподдерживаемая стратегия")
    
    await strategy.start()
    key = f"{instrument}_{strategy_type}"
    active_strategies[key] = strategy
    
    return {
        "status": "started",
        "instrument": instrument,
        "strategy": strategy_type,
        "message": f"Стратегия {strategy_type} запущена для {instrument}"
    }

# ============================================================
#  ОСТАНОВКА СТРАТЕГИИ
# ============================================================
@router.post("/strategies/stop")
async def stop_strategy(instrument: str, strategy_type: str = "impulse"):
    """Остановить стратегию"""
    key = f"{instrument}_{strategy_type}"
    if key in active_strategies:
        await active_strategies[key].stop()
        del active_strategies[key]
        return {"status": "stopped", "instrument": instrument, "strategy": strategy_type}
    raise HTTPException(status_code=404, detail="Стратегия не найдена")

# ============================================================
#  СПИСОК СТРАТЕГИЙ
# ============================================================
@router.get("/strategies")
async def list_strategies():
    """Получить список активных стратегий"""
    result = []
    for key, strategy in active_strategies.items():
        result.append({
            "key": key,
            "instrument": strategy.instrument,
            "name": strategy.name,
            "is_active": strategy.is_active,
            "stats": strategy.get_stats()
        })
    return result

# ============================================================
#  ЗАКРЫТИЕ ПОЗИЦИИ
# ============================================================
@router.post("/trade/close")
async def close_position(instrument: str):
    """Закрыть позицию по инструменту"""
    result = await demo_account.close_position(instrument)
    if not result:
        raise HTTPException(status_code=400, detail="Нет открытой позиции")
    return {"status": "closed", "trade": result}

# ============================================================
#  WEBSOCKET
# ============================================================
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
                market_open = MarketHours.is_market_open()
                
                rts_quote = None
                si_quote = None
                
                if market_open:
                    rts_quote = await market_data.get_quote("RTS")
                    si_quote = await market_data.get_quote("Si")
                else:
                    logger.debug("Рынок закрыт, котировки не обновляются")
                
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
