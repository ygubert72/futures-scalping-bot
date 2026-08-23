from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from typing import Dict, Any, List
from datetime import datetime
import logging

from app.models.trade import Trade, TradeCreate, TradeStats
from app.services.finam_client import finam_client
from app.strategies.impulse_strategy import ImpulseStrategy
from app.strategies.level_strategy import LevelStrategy

logger = logging.getLogger(__name__)

router = APIRouter()

# Хранилище активных стратегий
active_strategies = {}

# WebSocket соединения
ws_connections = []

@router.get("/")
async def get_status():
    """Получить статус системы"""
    return {
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "strategies": len(active_strategies),
        "connections": len(ws_connections)
    }

@router.get("/balance")
async def get_balance():
    """Получить баланс счёта"""
    return await finam_client.get_balance()

@router.post("/strategies/start")
async def start_strategy(instrument: str, strategy_type: str = "impulse"):
    """
    Запустить стратегию для инструмента
    
    Args:
        instrument: RTS или Si
        strategy_type: impulse или level
    """
    if instrument not in ["RTS", "Si"]:
        raise HTTPException(status_code=400, detail="Неподдерживаемый инструмент")
    
    # Создаём стратегию
    if strategy_type == "impulse":
        strategy = ImpulseStrategy(instrument)
    elif strategy_type == "level":
        strategy = LevelStrategy(instrument)
    else:
        raise HTTPException(status_code=400, detail="Неподдерживаемая стратегия")
    
    # Запускаем
    await strategy.start()
    active_strategies[f"{instrument}_{strategy_type}"] = strategy
    
    return {
        "status": "started",
        "instrument": instrument,
        "strategy": strategy_type,
        "message": f"Стратегия {strategy_type} запущена для {instrument}"
    }

@router.post("/strategies/stop")
async def stop_strategy(instrument: str, strategy_type: str = "impulse"):
    """Остановить стратегию"""
    key = f"{instrument}_{strategy_type}"
    if key in active_strategies:
        await active_strategies[key].stop()
        del active_strategies[key]
        return {"status": "stopped", "instrument": instrument, "strategy": strategy_type}
    
    raise HTTPException(status_code=404, detail="Стратегия не найдена")

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

@router.get("/trades")
async def get_trades(limit: int = 100):
    """Получить последние сделки"""
    # В демо-версии возвращаем тестовые данные
    return [
        {
            "id": i,
            "instrument": "RTS" if i % 2 == 0 else "Si",
            "side": "buy" if i % 3 == 0 else "sell",
            "price": 120000 + i * 10,
            "quantity": 1,
            "timestamp": datetime.now().isoformat(),
            "status": "filled",
            "profit": i * 5 if i % 2 == 0 else -i * 3
        }
        for i in range(1, min(limit, 20))
    ]

@router.get("/stats")
async def get_stats():
    """Получить общую статистику"""
    # В демо-версии возвращаем тестовые данные
    return TradeStats(
        total_trades=150,
        winning_trades=82,
        losing_trades=68,
        total_profit=12500.0,
        win_rate=54.7,
        avg_profit=152.4,
        avg_loss=-89.3,
        max_drawdown=2500.0
    )

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket для реального времени"""
    await websocket.accept()
    ws_connections.append(websocket)
    logger.info(f"WebSocket подключён, всего соединений: {len(ws_connections)}")
    
    try:
        # Отправляем приветственное сообщение
        await websocket.send_json({
            "type": "connected",
            "message": "Подключение установлено",
            "timestamp": datetime.now().isoformat()
        })
        
        while True:
            # Ждём сообщения от клиента
            data = await websocket.receive_text()
            logger.debug(f"Получено WebSocket сообщение: {data}")
            
            # Отправляем подтверждение
            await websocket.send_json({
                "type": "ack",
                "received": data,
                "timestamp": datetime.now().isoformat()
            })
            
    except WebSocketDisconnect:
        ws_connections.remove(websocket)
        logger.info(f"WebSocket отключён, осталось: {len(ws_connections)}")
    except Exception as e:
        logger.error(f"WebSocket ошибка: {e}")
        if websocket in ws_connections:
            ws_connections.remove(websocket)
