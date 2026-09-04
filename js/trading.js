// ============================================================
//  ТОРГОВАЯ ЛОГИКА (С ДНЕВНОЙ СТАТИСТИКОЙ)
// ============================================================

function executeTrade(instrument, side, price) {
    const pos = STATE.positions[instrument];
    
    // === ОТКРЫТИЕ ПОЗИЦИИ ===
    if (side === 'buy') {
        if (pos) {
            console.log(`⚠️ Уже есть позиция по ${instrument}, нельзя открыть BUY`);
            return;
        }
        STATE.positions[instrument] = { 
            side: 'buy', 
            entry: price,
            openTime: new Date().toISOString()
        };
        console.log(`✅ ОТКРЫТА BUY по ${instrument} по цене ${price}`);
        render();
        return;
    }
    
    if (side === 'sell') {
        if (!pos) {
            STATE.positions[instrument] = { 
                side: 'sell', 
                entry: price,
                openTime: new Date().toISOString()
            };
            console.log(`✅ ОТКРЫТА SHORT по ${instrument} по цене ${price}`);
            render();
            return;
        }
        
        // === ЗАКРЫТИЕ ПОЗИЦИИ ===
        const profit = pos.side === 'buy' 
            ? price - pos.entry
            : pos.entry - price;
        
        STATE.balance += profit;
        
        const trade = {
            id: Date.now(),
            instrument,
            side: pos.side === 'buy' ? 'sell' : 'buy',
            price: Math.round(price * 100) / 100,
            entryPrice: Math.round(pos.entry * 100) / 100,
            profit: Math.round(profit * 100) / 100,
            timestamp: new Date().toISOString(),
            timeStr: new Date().toLocaleTimeString(),
            entryTime: pos.openTime || new Date().toISOString()
        };
        STATE.trades.push(trade);
        STATE.positions[instrument] = null;
        
        // === ОБНОВЛЕНИЕ СТАТИСТИКИ ===
        // Общая
        STATE.stats.total++;
        if (profit > 0) STATE.stats.wins++;
        else STATE.stats.losses++;
        STATE.stats.profit += profit;
        
        // Дневная
        const today = new Date().toDateString();
        if (STATE.dailyStats.date !== today) {
            STATE.dailyStats.date = today;
            STATE.dailyStats.total = 0;
            STATE.dailyStats.wins = 0;
            STATE.dailyStats.losses = 0;
            STATE.dailyStats.profit = 0;
            STATE.dailyStats.trades = [];
        }
        STATE.dailyStats.total++;
        if (profit > 0) STATE.dailyStats.wins++;
        else STATE.dailyStats.losses++;
        STATE.dailyStats.profit += profit;
        STATE.dailyStats.trades.push(trade);
        
        console.log(`✅ ЗАКРЫТА позиция по ${instrument}, P&L: ${profit > 0 ? '+' : ''}${profit}`);
        render();
        return;
    }
}

// ============================================================
//  СТРАТЕГИИ (С УЧЕТОМ ДНЕВНОЙ СТАТИСТИКИ)
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
            if (candles.length >= 20) {
                const high = candles.slice(-20).reduce((a, b) => a.high > b.high ? a : b).high;
                const low = candles.slice(-20).reduce((a, b) => a.low < b.low ? a : b).low;
                
                // НОВЫЕ ПАРАМЕТРЫ: меньший стоп, меньший тейк
                if (rts.price > high) {
                    executeTrade('RTS', 'buy', rts.price);
                } else if (rts.price < low) {
                    executeTrade('RTS', 'sell', rts.price);
                }
            }
        } else {
            // УПРАВЛЕНИЕ ПОЗИЦИЕЙ — НОВЫЕ ПАРАМЕТРЫ
            const profit = pos.side === 'buy' 
                ? rts.price - pos.entry 
                : pos.entry - rts.price;
            
            // Тейк-профит: 90 пунктов (было 120)
            if (profit >= 90) {
                console.log(`🎯 RTS: Тейк-профит ${profit} пунктов`);
                executeTrade('RTS', 'sell', rts.price);
            } 
            // Стоп-лосс: 30 пунктов (было 45)
            else if (profit <= -30) {
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
            if (candles.length >= 20) {
                const avg = candles.slice(-20).reduce((a, b) => a + b.close, 0) / 20;
                const std = Math.sqrt(candles.slice(-20).reduce((a, b) => a + Math.pow(b.close - avg, 2), 0) / 20);
                
                // НОВЫЕ ПАРАМЕТРЫ: более сильные сигналы
                const deviation = (si.price - avg) / std;
                
                if (deviation < -2.0) {  // Было -1.5
                    executeTrade('Si', 'buy', si.price);
                } else if (deviation > 2.0) {  // Было 1.5
                    executeTrade('Si', 'sell', si.price);
                }
            }
        } else {
            const profit = pos.side === 'buy' 
                ? si.price - pos.entry 
                : pos.entry - si.price;
            
            // Тейк-профит: 50 пунктов (было 70)
            if (profit >= 50) {
                console.log(`🎯 Si: Тейк-профит ${profit} пунктов`);
                executeTrade('Si', 'sell', si.price);
            } 
            // Стоп-лосс: 20 пунктов (было 25)
            else if (profit <= -20) {
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

console.log('📊 trading.js загружен (с дневной статистикой)');
