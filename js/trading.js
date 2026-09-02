// ============================================================
//  ТОРГОВАЯ ЛОГИКА (ИСПРАВЛЕННАЯ)
// ============================================================

function executeTrade(instrument, side, price) {
    const pos = STATE.positions[instrument];
    
    // === ОТКРЫТИЕ ПОЗИЦИИ ===
    if (side === 'buy') {
        if (pos) {
            console.log(`⚠️ Уже есть позиция по ${instrument}, нельзя открыть BUY`);
            return;
        }
        STATE.positions[instrument] = { side: 'buy', entry: price };
        console.log(`✅ ОТКРЫТА BUY по ${instrument} по цене ${price}`);
        render();
        return;
    }
    
    if (side === 'sell') {
        // Если нет позиции — открываем SHORT
        if (!pos) {
            STATE.positions[instrument] = { side: 'sell', entry: price };
            console.log(`✅ ОТКРЫТА SHORT по ${instrument} по цене ${price}`);
            render();
            return;
        }
        
        // === ЗАКРЫТИЕ ПОЗИЦИИ ===
        // Если позиция есть — закрываем её
        const profit = pos.side === 'buy' 
            ? price - pos.entry   // Для LONG: продажа дороже входа
            : pos.entry - price;  // Для SHORT: покупка дешевле входа
        
        // Обновляем баланс
        STATE.balance += profit;
        
        // Создаём запись о сделке
        const trade = {
            id: Date.now(),
            instrument,
            side: pos.side === 'buy' ? 'sell' : 'buy',
            price: Math.round(price * 100) / 100,
            profit: Math.round(profit * 100) / 100,
            timestamp: new Date().toISOString(),
            timeStr: new Date().toLocaleTimeString()
        };
        STATE.trades.push(trade);
        STATE.positions[instrument] = null;
        
        // Обновляем статистику
        STATE.stats.total++;
        if (profit > 0) STATE.stats.wins++;
        else STATE.stats.losses++;
        STATE.stats.profit += profit;
        
        console.log(`✅ ЗАКРЫТА позиция по ${instrument}, P&L: ${profit > 0 ? '+' : ''}${profit}`);
        render();
        return;
    }
}

// ============================================================
//  СТРАТЕГИИ
// ============================================================

function runStrategies() {
    if (!STATE.strategies.RTS && !STATE.strategies.Si) return;

    const rts = STATE.quotes.RTS;
    const si = STATE.quotes.Si;
    const minuteData = STATE.minuteCandles;

    // ===== СТРАТЕГИЯ ДЛЯ RTS =====
    if (STATE.strategies.RTS && rts.price > 0) {
        const pos = STATE.positions.RTS;
        const candles = minuteData.RTS || [];
        
        if (!pos) {
            // Ищем максимум и минимум за последние 20 свечей
            if (candles.length >= 20) {
                const high = candles.slice(-20).reduce((a, b) => a.high > b.high ? a : b).high;
                const low = candles.slice(-20).reduce((a, b) => a.low < b.low ? a : b).low;
                
                if (rts.price > high) {
                    executeTrade('RTS', 'buy', rts.price);
                } else if (rts.price < low) {
                    executeTrade('RTS', 'sell', rts.price);
                }
            }
        } else {
            // Управление позицией
            const profit = pos.side === 'buy' 
                ? rts.price - pos.entry 
                : pos.entry - rts.price;
            
            if (profit >= 120) {
                console.log(`🎯 RTS: Тейк-профит ${profit} пунктов`);
                executeTrade('RTS', 'sell', rts.price);
            } else if (profit <= -45) {
                console.log(`🛑 RTS: Стоп-лосс ${profit} пунктов`);
                executeTrade('RTS', 'sell', rts.price);
            }
        }
    }

    // ===== СТРАТЕГИЯ ДЛЯ Si =====
    if (STATE.strategies.Si && si.price > 0) {
        const pos = STATE.positions.Si;
        const candles = minuteData.Si || [];
        
        if (!pos) {
            // Поиск сигнала на вход
            if (candles.length >= 20) {
                const avg = candles.slice(-20).reduce((a, b) => a + b.close, 0) / 20;
                
                if (si.price < avg * 0.995) {
                    executeTrade('Si', 'buy', si.price);
                } else if (si.price > avg * 1.005) {
                    executeTrade('Si', 'sell', si.price);
                }
            }
        } else {
            // Управление позицией
            const profit = pos.side === 'buy' 
                ? si.price - pos.entry 
                : pos.entry - si.price;
            
            if (profit >= 70) {
                console.log(`🎯 Si: Тейк-профит ${profit} пунктов`);
                executeTrade('Si', 'sell', si.price);
            } else if (profit <= -25) {
                console.log(`🛑 Si: Стоп-лосс ${profit} пунктов`);
                executeTrade('Si', 'sell', si.price);
            }
        }
    }
}

// ============================================================
//  ЭКСПОРТ
// ============================================================

window.executeTrade = executeTrade;
window.runStrategies = runStrategies;

console.log('📊 trading.js загружен (ИСПРАВЛЕННАЯ ВЕРСИЯ)');
