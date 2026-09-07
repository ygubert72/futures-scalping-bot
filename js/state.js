// ============================================================
//  ГЛОБАЛЬНОЕ СОСТОЯНИЕ (С РАСШИРЕННЫМИ ДАННЫМИ)
// ============================================================

const STATE = {
    // Баланс и сделки
    balance: 100000,
    trades: [],
    positions: { RTS: null, Si: null },
    
    // Стратегии
    strategies: { RTS: false, Si: false },
    
    // Котировки
    quotes: { RTS: { price: 0, change: 0 }, Si: { price: 0, change: 0 } },
    
    // Свечи
    minuteCandles: { RTS: [], Si: [] },
    candles: { RTS: [], Si: [] },
    maxCandles: 500,
    
    // === ПРОФЕССИОНАЛЬНЫЕ ДАННЫЕ ===
    // Объемный профиль
    volumeProfile: { RTS: null, Si: null },
    // Кумулятивная дельта
    cvd: { RTS: [], Si: [] },
    // Order Blocks (зоны крупных заявок)
    orderBlocks: { RTS: [], Si: [] },
    // Fair Value Gaps
    fvg: { RTS: [], Si: [] },
    
    // Текущий инструмент и настройки графика
    currentInstrument: 'RTS',
    interval: 1,
    zoomLevel: 1,
    verticalZoom: 1,
    visibleCandles: [],
    
    // === ДНЕВНАЯ СТАТИСТИКА ===
    dailyStats: {
        date: null,
        total: 0,
        wins: 0,
        losses: 0,
        profit: 0,
        trades: [],
        maxDrawdown: 0,
        peakBalance: 100000
    },
    
    // Общая статистика
    stats: { total: 0, wins: 0, losses: 0, profit: 0, maxDrawdown: 0 }
};

const INSTRUMENT_CODES = { RTS: null, Si: null };

// ============================================================
//  СБРОС СТАТИСТИКИ
// ============================================================

function resetDailyStats() {
    const today = new Date().toDateString();
    if (STATE.dailyStats.date !== today) {
        console.log(`📊 Сброс дневной статистики (${today})`);
        STATE.dailyStats = {
            date: today,
            total: 0,
            wins: 0,
            losses: 0,
            profit: 0,
            trades: [],
            maxDrawdown: 0,
            peakBalance: STATE.balance || 100000
        };
        if (typeof render === 'function') render();
        return true;
    }
    return false;
}

function resetAllStats() {
    console.log('🔄 Полный сброс статистики');
    STATE.stats = { total: 0, wins: 0, losses: 0, profit: 0, maxDrawdown: 0 };
    STATE.trades = [];
    STATE.positions = { RTS: null, Si: null };
    STATE.balance = 100000;
    resetDailyStats();
    if (typeof render === 'function') render();
    return true;
}

window.resetDailyStats = resetDailyStats;
window.resetAllStats = resetAllStats;

console.log('📦 state.js загружен (профессиональная версия)');
