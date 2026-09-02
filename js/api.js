// ============================================================
//  ЗАПРОСЫ К МОСКОВСКОЙ БИРЖЕ (MOEX) — ИСПРАВЛЕННАЯ ВЕРСИЯ
// ============================================================

// ============================================================
//  ОПРЕДЕЛЕНИЕ КОДОВ ИНСТРУМЕНТОВ
// ============================================================

async function detectInstrumentCodes() {
    try {
        // Пробуем получить список инструментов
        const resp = await fetch('https://iss.moex.com/iss/engines/futures/markets/forts/boards/RFUD/securities.json?limit=100');
        const data = await resp.json();
        const rows = data.securities?.data || [];
        const cols = data.securities?.columns || [];
        
        const secIdx = cols.indexOf('SECID');
        const nameIdx = cols.indexOf('SHORTNAME');
        const boardIdx = cols.indexOf('BOARDID');
        const matDateIdx = cols.indexOf('MATDATE');
        
        let rtsCodes = [], siCodes = [];
        
        rows.forEach(row => {
            const board = row[boardIdx];
            if (board !== 'RFUD') return;
            
            const secid = row[secIdx];
            const name = row[nameIdx] || '';
            const matDate = row[matDateIdx] || '';
            
            // Ищем RTS фьючерсы (RTS-* или RTSM-*)
            if (name.startsWith('RTS-') || name.startsWith('RTSM-')) {
                rtsCodes.push({ secid, name, matDate });
            }
            // Ищем Si фьючерсы
            if (name.startsWith('Si-') || name.startsWith('SiM-')) {
                siCodes.push({ secid, name, matDate });
            }
        });
        
        // Сортируем по дате экспирации (ближайшие вперед)
        const sortByDate = (arr) => {
            return arr.sort((a, b) => {
                const dateA = a.matDate || '9999999999999';
                const dateB = b.matDate || '9999999999999';
                return dateA.localeCompare(dateB);
            });
        };
        
        const sortedRTS = sortByDate(rtsCodes);
        const sortedSi = sortByDate(siCodes);
        
        // Выбираем ближайший действующий контракт
        if (sortedRTS.length > 0) {
            INSTRUMENT_CODES.RTS = sortedRTS[0].secid;
            INSTRUMENT_CODES.RTS_NAME = sortedRTS[0].name;
            console.log(`✅ Найден RTS: ${sortedRTS[0].name} (${INSTRUMENT_CODES.RTS})`);
        }
        if (sortedSi.length > 0) {
            INSTRUMENT_CODES.Si = sortedSi[0].secid;
            INSTRUMENT_CODES.Si_NAME = sortedSi[0].name;
            console.log(`✅ Найден Si: ${sortedSi[0].name} (${INSTRUMENT_CODES.Si})`);
        }
        
        // Если не нашли — используем fallback с актуальными на 2026 год
        if (!INSTRUMENT_CODES.RTS) {
            INSTRUMENT_CODES.RTS = 'RTS-9.26';
            INSTRUMENT_CODES.RTS_NAME = 'RTS-9.26';
            console.warn('⚠️ RTS не найден, используем запасной:', INSTRUMENT_CODES.RTS);
        }
        if (!INSTRUMENT_CODES.Si) {
            INSTRUMENT_CODES.Si = 'Si-9.26';
            INSTRUMENT_CODES.Si_NAME = 'Si-9.26';
            console.warn('⚠️ Si не найден, используем запасной:', INSTRUMENT_CODES.Si);
        }
        
        return true;
    } catch (e) {
        console.warn('⚠️ Ошибка определения кодов:', e);
        // Fallback на 2026 год
        INSTRUMENT_CODES.RTS = 'RTS-9.26';
        INSTRUMENT_CODES.RTS_NAME = 'RTS-9.26';
        INSTRUMENT_CODES.Si = 'Si-9.26';
        INSTRUMENT_CODES.Si_NAME = 'Si-9.26';
        return true;
    }
}

// ============================================================
//  ПОЛУЧЕНИЕ МИНУТНЫХ СВЕЧЕЙ — УЛУЧШЕННАЯ ВЕРСИЯ
// ============================================================

async function fetchMinuteCandles(instrument) {
    try {
        let sec = INSTRUMENT_CODES[instrument];
        if (!sec) {
            console.warn(`⚠️ Нет кода для ${instrument}, пробуем определить...`);
            await detectInstrumentCodes();
            sec = INSTRUMENT_CODES[instrument];
            if (!sec) return null;
        }
        
        // Пробуем получить данные за последние 30 дней
        const now = new Date();
        const from = new Date(now);
        from.setDate(from.getDate() - 30);
        
        // Форматируем дату для MOEX
        const fromStr = from.toISOString().slice(0, 16).replace('T', ' ');
        const tillStr = now.toISOString().slice(0, 16).replace('T', ' ');
        
        // Пробуем прямой запрос к API свечей
        const url = `https://iss.moex.com/iss/engines/futures/markets/forts/boards/RFUD/securities/${sec}/candles.json`;
        const params = new URLSearchParams({
            from: fromStr,
            till: tillStr,
            interval: 1,  // 1 минута
            start: 0,
            limit: 2000
        });
        
        console.log(`📡 Запрос свечей для ${instrument}: ${url}?${params}`);
        
        const resp = await fetch(`${url}?${params}`);
        if (!resp.ok) {
            console.warn(`⚠️ MOEX вернул ${resp.status} для ${instrument}`);
            return null;
        }
        
        const data = await resp.json();
        const candles = data.candles?.data || [];
        const cols = data.candles?.columns || [];
        
        if (candles.length === 0) {
            console.warn(`⚠️ Нет свечей для ${instrument}, пробуем альтернативный запрос...`);
            return await fetchCandlesAlternative(instrument);
        }
        
        // Парсим свечи
        const beginIdx = cols.indexOf('begin');
        const openIdx = cols.indexOf('open');
        const highIdx = cols.indexOf('high');
        const lowIdx = cols.indexOf('low');
        const closeIdx = cols.indexOf('close');
        const volumeIdx = cols.indexOf('volume');
        
        const result = candles.map(row => {
            const timeStr = row[beginIdx];
            let time;
            if (timeStr) {
                // Парсим дату в формате "2026-09-02 10:00:00"
                time = new Date(timeStr.replace(' ', 'T') + 'Z').getTime();
                if (isNaN(time)) {
                    time = new Date(timeStr).getTime();
                }
            }
            if (isNaN(time) || !time) {
                time = Date.now() - Math.random() * 60000;
            }
            
            return {
                time: time,
                open: parseFloat(row[openIdx]) || 0,
                high: parseFloat(row[highIdx]) || 0,
                low: parseFloat(row[lowIdx]) || 0,
                close: parseFloat(row[closeIdx]) || 0,
                volume: parseInt(row[volumeIdx]) || 0
            };
        }).filter(c => c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0);
        
        console.log(`✅ Загружено ${result.length} свечей для ${instrument}`);
        return result;
        
    } catch (e) {
        console.warn(`⚠️ Ошибка загрузки свечей ${instrument}:`, e);
        return await fetchCandlesAlternative(instrument);
    }
}

// ============================================================
//  АЛЬТЕРНАТИВНЫЙ МЕТОД ПОЛУЧЕНИЯ СВЕЧЕЙ
// ============================================================

async function fetchCandlesAlternative(instrument) {
    try {
        let sec = INSTRUMENT_CODES[instrument];
        if (!sec) return null;
        
        // Пробуем получить данные через securities endpoint
        const url = `https://iss.moex.com/iss/engines/futures/markets/forts/boards/RFUD/securities/${sec}.json`;
        const resp = await fetch(url);
        const data = await resp.json();
        
        // Пробуем получить историю через другой эндпоинт
        const historyUrl = `https://iss.moex.com/iss/engines/futures/markets/forts/securities/${sec}/candles.json`;
        const params = new URLSearchParams({
            interval: 1,
            start: 0,
            limit: 500
        });
        
        const histResp = await fetch(`${historyUrl}?${params}`);
        const histData = await histResp.json();
        const candles = histData.candles?.data || [];
        const cols = histData.candles?.columns || [];
        
        if (candles.length === 0) {
            // Если данных нет — генерируем тестовые
            console.log(`📊 Генерируем тестовые свечи для ${instrument}`);
            const startPrice = instrument === 'RTS' ? 78000 : 88;
            return generateTestCandles(300, startPrice, 1);
        }
        
        const beginIdx = cols.indexOf('begin');
        const openIdx = cols.indexOf('open');
        const highIdx = cols.indexOf('high');
        const lowIdx = cols.indexOf('low');
        const closeIdx = cols.indexOf('close');
        
        return candles.map(row => ({
            time: new Date(row[beginIdx]).getTime(),
            open: parseFloat(row[openIdx]) || 0,
            high: parseFloat(row[highIdx]) || 0,
            low: parseFloat(row[lowIdx]) || 0,
            close: parseFloat(row[closeIdx]) || 0
        })).filter(c => c.open > 0);
        
    } catch (e) {
        console.warn(`⚠️ Ошибка альтернативной загрузки ${instrument}:`, e);
        // Генерируем тестовые данные
        const startPrice = instrument === 'RTS' ? 78000 : 88;
        return generateTestCandles(300, startPrice, 1);
    }
}

// ============================================================
//  ГЕНЕРАЦИЯ ТЕСТОВЫХ СВЕЧЕЙ (УЛУЧШЕННАЯ)
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
        
        // Ограничиваем слишком сильные движения
        const maxChange = startPrice * 0.02;
        if (close > open + maxChange) close = open + maxChange;
        if (close < open - maxChange) close = open - maxChange;
        
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
//  ПОЛУЧЕНИЕ ТЕКУЩЕЙ КОТИРОВКИ (УЛУЧШЕННАЯ)
// ============================================================

async function fetchQuote(instrument) {
    try {
        let sec = INSTRUMENT_CODES[instrument];
        if (!sec) {
            await detectInstrumentCodes();
            sec = INSTRUMENT_CODES[instrument];
            if (!sec) return null;
        }
        
        const url = `https://iss.moex.com/iss/engines/futures/markets/forts/boards/RFUD/securities/${sec}.json`;
        const resp = await fetch(url);
        const data = await resp.json();
        const row = data.marketdata?.data?.[0];
        const cols = data.marketdata?.columns || [];
        
        if (!row) {
            // Если нет рыночных данных — пробуем получить последнюю цену из свечей
            const candles = await fetchMinuteCandles(instrument);
            if (candles && candles.length > 0) {
                const last = candles[candles.length - 1];
                return { 
                    price: last.close, 
                    change: 0,
                    open: last.open,
                    high: last.high,
                    low: last.low
                };
            }
            return null;
        }
        
        const lastIdx = cols.indexOf('LAST');
        const openIdx = cols.indexOf('OPEN');
        const highIdx = cols.indexOf('HIGH');
        const lowIdx = cols.indexOf('LOW');
        
        const price = row[lastIdx] || 0;
        const open = row[openIdx] || price;
        const high = row[highIdx] || price;
        const low = row[lowIdx] || price;
        const change = open > 0 ? ((price - open) / open) * 100 : 0;
        
        return { price, change, open, high, low };
    } catch (e) {
        console.warn(`⚠️ Ошибка получения котировки ${instrument}:`, e);
        return null;
    }
}

// ============================================================
//  АГРЕГАЦИЯ СВЕЧЕЙ
// ============================================================

function aggregateCandles(minuteCandles, intervalMinutes) {
    if (intervalMinutes === 1 || !minuteCandles || minuteCandles.length === 0) {
        return minuteCandles || [];
    }
    
    // Сортируем по времени
    const sorted = [...minuteCandles].sort((a, b) => a.time - b.time);
    const result = [];
    let current = null;
    let count = 0;
    
    for (const candle of sorted) {
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

// ============================================================
//  ЭКСПОРТ
// ============================================================

window.detectInstrumentCodes = detectInstrumentCodes;
window.fetchMinuteCandles = fetchMinuteCandles;
window.fetchCandlesAlternative = fetchCandlesAlternative;
window.fetchQuote = fetchQuote;
window.generateTestCandles = generateTestCandles;
window.aggregateCandles = aggregateCandles;

console.log('📡 api.js загружен (ИСПРАВЛЕННАЯ ВЕРСИЯ)');
