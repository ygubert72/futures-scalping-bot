// ============================================================
//  ЗАПРОСЫ К МОСКОВСКОЙ БИРЖЕ (MOEX)
// ============================================================

// ============================================================
//  АГРЕГАЦИЯ СВЕЧЕЙ
// ============================================================

function aggregateCandles(minuteCandles, intervalMinutes) {
    if (intervalMinutes === 1 || !minuteCandles || minuteCandles.length === 0) {
        return minuteCandles || [];
    }
    
    const result = [];
    let current = null;
    let count = 0;
    
    for (const candle of minuteCandles) {
        if (!current) {
            current = {
                time: candle.time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
            };
            count = 1;
        } else {
            current.high = Math.max(current.high, candle.high);
            current.low = Math.min(current.low, candle.low);
            current.close = candle.close;
            count++;
        }
        
        if (count >= intervalMinutes) {
            result.push({ ...current });
            current = null;
            count = 0;
        }
    }
    
    if (current) {
        result.push(current);
    }
    
    return result;
}

window.aggregateCandles = aggregateCandles;

// ============================================================
//  ОПРЕДЕЛЕНИЕ КОДОВ ИНСТРУМЕНТОВ
// ============================================================

async function detectInstrumentCodes() {
    try {
        const resp = await fetch('https://iss.moex.com/iss/engines/futures/markets/forts/boards/RFUD/securities.json');
        const data = await resp.json();
        const rows = data.securities?.data || [];
        const cols = data.securities?.columns || [];
        
        const secIdx = cols.indexOf('SECID');
        const nameIdx = cols.indexOf('SHORTNAME');
        const boardIdx = cols.indexOf('BOARDID');
        
        let rtsCodes = [], siCodes = [];
        
        rows.forEach(row => {
            const board = row[boardIdx];
            if (board !== 'RFUD') return;
            
            const secid = row[secIdx];
            const name = row[nameIdx] || '';
            
            if (name.startsWith('RTS-') || name.startsWith('RTSM-')) {
                rtsCodes.push({ secid, name });
            }
            if (name.startsWith('Si-') || name.startsWith('SiM-')) {
                siCodes.push({ secid, name });
            }
        });
        
        const sortByDate = (arr) => {
            return arr.sort((a, b) => {
                const dateA = a.name.match(/\d{2}\.\d{2}/)?.[0] || '99.99';
                const dateB = b.name.match(/\d{2}\.\d{2}/)?.[0] || '99.99';
                return dateA.localeCompare(dateB);
            });
        };
        
        const sortedRTS = sortByDate(rtsCodes);
        const sortedSi = sortByDate(siCodes);
        
        if (sortedRTS.length > 0) {
            INSTRUMENT_CODES.RTS = sortedRTS[0].secid;
            console.log(`✅ Найден RTS: ${sortedRTS[0].name} (${INSTRUMENT_CODES.RTS})`);
        }
        if (sortedSi.length > 0) {
            INSTRUMENT_CODES.Si = sortedSi[0].secid;
            console.log(`✅ Найден Si: ${sortedSi[0].name} (${INSTRUMENT_CODES.Si})`);
        }
        
        if (!INSTRUMENT_CODES.RTS) {
            INSTRUMENT_CODES.RTS = 'RIU6';
            console.warn('⚠️ RTS не найден, используем запасной:', INSTRUMENT_CODES.RTS);
        }
        if (!INSTRUMENT_CODES.Si) {
            INSTRUMENT_CODES.Si = 'SIU6';
            console.warn('⚠️ Si не найден, используем запасной:', INSTRUMENT_CODES.Si);
        }
        
        return true;
    } catch (e) {
        console.warn('⚠️ Ошибка определения кодов:', e);
        INSTRUMENT_CODES.RTS = 'RIU6';
        INSTRUMENT_CODES.Si = 'SIU6';
        return true;
    }
}

// ============================================================
//  ПОЛУЧЕНИЕ МИНУТНЫХ СВЕЧЕЙ
// ============================================================

async function fetchMinuteCandles(instrument) {
    try {
        const sec = INSTRUMENT_CODES[instrument];
        if (!sec) return null;
        
        const now = new Date();
        const from = new Date(now);
        from.setDate(from.getDate() - 30);
        
        const url = `https://iss.moex.com/iss/engines/futures/markets/forts/boards/RFUD/securities/${sec}/candles.json`;
        const params = new URLSearchParams({
            from: from.toISOString().slice(0,16),
            till: now.toISOString().slice(0,16),
            interval: 1,
        });
        
        const resp = await fetch(`${url}?${params}`);
        const data = await resp.json();
        const candles = data.candles?.data || [];
        const cols = data.candles?.columns || [];
        
        if (candles.length === 0) return null;
        
        return candles.map(row => ({
            time: new Date(row[cols.indexOf('begin')]).getTime(),
            open: row[cols.indexOf('open')],
            high: row[cols.indexOf('high')],
            low: row[cols.indexOf('low')],
            close: row[cols.indexOf('close')],
        }));
    } catch (e) {
        console.warn('MOEX ошибка:', e);
        return null;
    }
}

// ============================================================
//  ПОЛУЧЕНИЕ ТЕКУЩЕЙ КОТИРОВКИ
// ============================================================

async function fetchQuote(instrument) {
    try {
        const sec = INSTRUMENT_CODES[instrument];
        if (!sec) return null;
        
        const url = `https://iss.moex.com/iss/engines/futures/markets/forts/boards/RFUD/securities/${sec}.json`;
        const resp = await fetch(url);
        const data = await resp.json();
        const row = data.marketdata?.data?.[0];
        const cols = data.marketdata?.columns || [];
        const price = row?.[cols.indexOf('LAST')] || 0;
        const open = row?.[cols.indexOf('OPEN')] || price;
        const change = open ? ((price - open) / open) * 100 : 0;
        return { price, change };
    } catch {
        return null;
    }
}

// ============================================================
//  ГЕНЕРАЦИЯ ТЕСТОВЫХ СВЕЧЕЙ
// ============================================================

function generateTestCandles(count, startPrice, stepMinutes = 1) {
    const now = Date.now();
    const candles = [];
    let price = startPrice;
    const volMultiplier = Math.sqrt(stepMinutes / 5);
    for (let i = 0; i < count; i++) {
        const change = (Math.random() - 0.5) * 300 * volMultiplier * 2;
        const open = price;
        let close = price + change;
        if (close < 1000) close = 1000 + Math.random() * 100;
        const high = Math.max(open, close) + Math.random() * 80 * volMultiplier * 2;
        const low = Math.min(open, close) - Math.random() * 80 * volMultiplier * 2;
        candles.push({
            time: now - (count - i) * stepMinutes * 60000,
            open: Math.round(open * 100) / 100,
            high: Math.round(high * 100) / 100,
            low: Math.round(low * 100) / 100,
            close: Math.round(close * 100) / 100
        });
        price = close;
    }
    return candles;
}

// ============================================================
//  ЭКСПОРТ
// ============================================================

window.detectInstrumentCodes = detectInstrumentCodes;
window.fetchMinuteCandles = fetchMinuteCandles;
window.fetchQuote = fetchQuote;
window.generateTestCandles = generateTestCandles;

console.log('📡 api.js загружен');
