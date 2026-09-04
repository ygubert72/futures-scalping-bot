// ============================================================
//  ГЛОБАЛЬНОЕ СОСТОЯНИЕ (С ДНЕВНОЙ СТАТИСТИКОЙ)
// ============================================================

// Основное состояние
const STATE = {
    balance: 100000,
    trades: [],
    strategies: { RTS: false, Si: false },
    quotes: { RTS: { price: 0, change: 0 }, Si: { price: 0, change: 0 } },
    positions: { RTS: null, Si: null },
    stats: { total: 0, wins: 0, losses: 0, profit: 0 },
    minuteCandles: { RTS: [], Si: [] },
    candles: { RTS: [], Si: [] },
    visibleCandles: [],
    interval: 1,
    maxCandles: 300,
    zoomLevel: 1,
    offset: 0,
    verticalZoom: 1,
    currentInstrument: 'RTS',
    
    // === ДНЕВНАЯ СТАТИСТИКА ===
    dailyStats: {
        date: null,        // Текущая дата
        total: 0,
        wins: 0,
        losses: 0,
        profit: 0,
        trades: []          // Сделки за сегодня
    }
};

const INSTRUMENT_CODES = { RTS: null, Si: null };

// ============================================================
//  ФУНКЦИЯ СБРОСА ДНЕВНОЙ СТАТИСТИКИ
// ============================================================

function resetDailyStats() {
    const today = new Date().toDateString();
    
    // Если дата изменилась — сбрасываем
    if (STATE.dailyStats.date !== today) {
        console.log(`📊 Сброс дневной статистики (${today})`);
        console.log(`   Вчерашний P&L: ${STATE.dailyStats.profit.toFixed(2)} ₽`);
        console.log(`   Вчерашних сделок: ${STATE.dailyStats.total}`);
        
        STATE.dailyStats = {
            date: today,
            total: 0,
            wins: 0,
            losses: 0,
            profit: 0,
            trades: []
        };
        
        // Обновляем интерфейс
        if (typeof render === 'function') {
            render();
        }
        
        return true;
    }
    return false;
}

// ============================================================
//  ФУНКЦИЯ ПОЛНОГО СБРОСА СТАТИСТИКИ (ВРУЧНУЮ)
// ============================================================

function resetAllStats() {
    console.log('🔄 ПОДТВЕРЖДЕНИЕ: полный сброс статистики');
    console.log(`   Текущий P&L: ${STATE.stats.profit.toFixed(2)} ₽`);
    console.log(`   Текущих сделок: ${STATE.stats.total}`);
    
    // Сброс основной статистики
    STATE.stats = { total: 0, wins: 0, losses: 0, profit: 0 };
    STATE.trades = [];
    STATE.positions = { RTS: null, Si: null };
    STATE.balance = 100000;
    
    // Сброс дневной статистики
    const today = new Date().toDateString();
    STATE.dailyStats = {
        date: today,
        total: 0,
        wins: 0,
        losses: 0,
        profit: 0,
        trades: []
    };
    
    console.log('✅ Статистика сброшена!');
    
    // Обновляем интерфейс
    if (typeof render === 'function') {
        render();
    }
    
    return true;
}

// ============================================================
//  АВТОМАТИЧЕСКИЙ СБРОС ПРИ ЗАГРУЗКЕ
// ============================================================

// Проверяем смену дня при загрузке
resetDailyStats();

// ============================================================
//  ЭКСПОРТ
// ============================================================

window.resetDailyStats = resetDailyStats;
window.resetAllStats = resetAllStats;

console.log('📦 state.js загружен (с дневной статистикой)');
