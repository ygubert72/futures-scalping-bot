// ============================================================
//  ТОРГОВАЯ ЛОГИКА
// ============================================================

function executeTrade(instrument, side, price) {
    const pos = STATE.positions[instrument];
    
    if (side === 'buy') {
        if (pos) return;
        STATE.positions[instrument] = { side: 'buy', entry: price };
        return;
    }

    if (side === 'sell') {
        if (!pos) return;
        const profit = (price - pos.entry);
        STATE.balance += profit;
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
        STATE.stats.total++;
        if (profit > 0) STATE.stats.wins++; else STATE.stats.losses++;
        STATE.stats.profit += profit;
        render();
    }
}

function runStrategies() {
    if (!STATE.strategies.RTS && !STATE.strategies.Si) return;

    const rts = STATE.quotes.RTS;
    const si = STATE.quotes.Si;
    const minuteData = STATE.minuteCandles;

    if (STATE.strategies.RTS && rts.price > 0) {
        const pos = STATE.positions.RTS;
        const candles = minuteData.RTS || [];
        if (!pos) {
            const high = candles.slice(-20).reduce((a,b) => a.high > b.high ? a : b)?.high || rts.price;
            const low = candles.slice(-20).reduce((a,b) => a.low < b.low ? a : b)?.low || rts.price;
            if (rts.price > high) {
                executeTrade('RTS', 'buy', rts.price);
            } else if (rts.price < low) {
                executeTrade('RTS', 'sell', rts.price);
            }
        } else {
            const profit = pos.side === 'buy' ? rts.price - pos.entry : pos.entry - rts.price;
            if (profit >= 120 || profit <= -45) {
                executeTrade('RTS', 'sell', rts.price);
            }
        }
    }

    if (STATE.strategies.Si && si.price > 0) {
        const pos = STATE.positions.Si;
        const candles = minuteData.Si || [];
        if (!pos) {
            const avg = candles.slice(-20).reduce((a,b) => a + b.close, 0) / (candles.slice(-20).length || 1) || si.price;
            if (si.price < avg * 0.995) {
                executeTrade('Si', 'buy', si.price);
            } else if (si.price > avg * 1.005) {
                executeTrade('Si', 'sell', si.price);
            }
        } else {
            const profit = pos.side === 'buy' ? si.price - pos.entry : pos.entry - si.price;
            if (profit >= 70 || profit <= -25) {
                executeTrade('Si', 'sell', si.price);
            }
        }
    }
}

// Экспортируем для других файлов (включая Firebase)
window.executeTrade = executeTrade;
window.runStrategies = runStrategies;
