// ============================================================
//  ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ============================================================
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
};

const INSTRUMENT_CODES = { RTS: null, Si: null };
