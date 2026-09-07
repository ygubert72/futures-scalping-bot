// ============================================================
//  ПРОФЕССИОНАЛЬНАЯ ТОРГОВАЯ ЛОГИКА (Order Flow + Volume Profile)
// ============================================================

// === ПРОФЕССИОНАЛЬНЫЕ ПАРАМЕТРЫ ===
const PROFESSIONAL_CONFIG = {
    // Риск-менеджмент
    riskPerTrade: 0.01,        // 1% от баланса на сделку
    maxDailyLoss: 0.05,        // 5% дневной просадки — стоп
    maxDailyTrades: 8,         // Максимум 8 сделок в день
    minProfitFactor: 2.0,      // Минимальное соотношение риск/прибыль 1:2
    
    // Фильтры для входа
    minVolumeSpike: 1.5,       // Объем должен быть в 1.5 раза выше среднего
    minDeltaStrength: 0.3,     // Минимальная сила дельты для входа
    minFvgSize: 0.5,           // Минимальный размер FVG в ATR
    
    // Таймфреймы для анализа
    timeframes: [1, 5, 15],    // 1м, 5м, 15м
};

// ============================================================
//  РАСЧЕТ ОБЪЕМНОГО ПРОФИЛЯ
// ============================================================

function calculateVolumeProfile(candles, numLevels = 20) {
    if (!candles || candles.length < 10) return null;
    
    // Находим диапазон цен
    const prices = candles.map(c => c.close);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const step = (maxPrice - minPrice) / numLevels;
    
    if (step === 0) return null;
    
    // Строим профиль объема
    const profile = {};
    let maxVolume = 0;
    let pocPrice = 0;
    let totalVolume = 0;
    
    candles.forEach(c => {
        const level = Math.floor((c.close - minPrice) / step);
        const key = (minPrice + level * step).toFixed(2);
        const volume = c.volume || 1;
        
        if (!profile[key]) profile[key] = 0;
        profile[key] += volume;
        totalVolume += volume;
        
        if (profile[key] > maxVolume) {
            maxVolume = profile[key];
            pocPrice = parseFloat(key);
        }
    });
    
    // Находим Value Area (70% объема)
    const sortedLevels = Object.entries(profile).sort((a, b) => a[1] - b[1]);
    let cumVolume = 0;
    let valueAreaLow = pocPrice;
    let valueAreaHigh = pocPrice;
    const targetVolume = totalVolume * 0.7;
    
    for (const [price, vol] of sortedLevels.reverse()) {
        cumVolume += vol;
        if (cumVolume < targetVolume) {
            if (parseFloat(price) < pocPrice) valueAreaLow = parseFloat(price);
            if (parseFloat(price) > pocPrice) valueAreaHigh = parseFloat(price);
        }
    }
    
    return {
        poc: pocPrice,
        valueAreaLow: valueAreaLow,
        valueAreaHigh: valueAreaHigh,
        maxVolume: maxVolume,
        totalVolume: totalVolume,
        levels: profile
    };
}

// ============================================================
//  РАСЧЕТ КУМУЛЯТИВНОЙ ДЕЛЬТЫ (CVD)
// ============================================================

function calculateCVD(candles) {
    if (!candles || candles.length < 2) return [];
    
    const cvd = [];
    let cumulative = 0;
    
    for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const prev = i > 0 ? candles[i-1] : c;
        
        // Расчет дельты: разница между объемом покупок и продаж
        // Аппроксимация на основе движения цены
        const priceChange = c.close - c.open;
        const volume = c.volume || 1;
        
        // Если цена растет — считаем, что покупки > продаж
        const delta = priceChange > 0 ? volume * 0.7 : -volume * 0.7;
        
        cumulative += delta;
        cvd.push({
            time: c.time,
            delta: delta,
            cumulative: cumulative
        });
    }
    
    return cvd;
}

// ============================================================
//  ПОИСК ORDER BLOCKS
// ============================================================

function findOrderBlocks(candles, lookback = 50) {
    if (!candles || candles.length < lookback) return [];
    
    const blocks = [];
    const recent = candles.slice(-lookback);
    
    for (let i = 2; i < recent.length - 2; i++) {
        const c = recent[i];
        const prev = recent[i-1];
        const next = recent[i+1];
        
        // Ищем свечи с большим объемом и разворотом цены
        const avgVolume = recent.slice(-20).reduce((s, x) => s + (x.volume || 1), 0) / 20;
        const volumeSpike = (c.volume || 1) > avgVolume * 1.5;
        
        // Разворот (бычий или медвежий)
        const isBullishReversal = prev.close > prev.open && c.close > c.open && c.close > prev.high;
        const isBearishReversal = prev.close < prev.open && c.close < c.open && c.close < prev.low;
        
        if (volumeSpike && (isBullishReversal || isBearishReversal)) {
            blocks.push({
                price: c.close,
                high: c.high,
                low: c.low,
                type: isBullishReversal ? 'bullish' : 'bearish',
                volume: c.volume,
                time: c.time
            });
        }
    }
    
    return blocks;
}

// ============================================================
//  ПОИСК FAIR VALUE GAPS (FVG)
// ============================================================

function findFVG(candles, lookback = 30) {
    if (!candles || candles.length < 3) return [];
    
    const fvgs = [];
    const recent = candles.slice(-lookback);
    
    for (let i = 1; i < recent.length - 1; i++) {
        const c = recent[i];
        const prev = recent[i-1];
        const next = recent[i+1];
        
        // Бычий FVG: разрыв между low предыдущей и low следующей
        const bullishGap = prev.low > next.high;
        // Медвежий FVG: разрыв между high предыдущей и high следующей
        const bearishGap = prev.high < next.low;
        
        if (bullishGap) {
            fvgs.push({
                type: 'bullish',
                top: prev.low,
                bottom: next.high,
                time: c.time
            });
        } else if (bearishGap) {
            fvgs.push({
                type: 'bearish',
                top: prev.high,
                bottom: next.low,
                time: c.time
            });
        }
    }
    
    return fvgs;
}

// ============================================================
//  ОСНОВНАЯ ТОРГОВАЯ ЛОГИКА (СИГНАЛЫ)
// ============================================================

function generateProfessionalSignal(instrument, candles, quote) {
    if (!candles || candles.length < 30 || !quote || !quote.price) {
        return null;
    }
    
    const price = quote.price;
    const currentCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];
    
    // === 1. РАСЧЕТ ИНДИКАТОРОВ ===
    const vp = calculateVolumeProfile(candles);
    const cvd = calculateCVD(candles);
    const blocks = findOrderBlocks(candles);
    const fvgs = findFVG(candles);
    
    if (!vp) return null;
    
    // === 2. АНАЛИЗ ОБЪЕМНОГО ПРОФИЛЯ ===
    const isNearPOC = Math.abs(price - vp.poc) / vp.poc < 0.002; // 0.2% от POC
    const isBelowVAL = price < vp.valueAreaLow;
    const isAboveVAH = price > vp.valueAreaHigh;
    
    // === 3. АНАЛИЗ ДЕЛЬТЫ ===
    const currentDelta = cvd.length > 0 ? cvd[cvd.length - 1].delta : 0;
    const prevDelta = cvd.length > 1 ? cvd[cvd.length - 2].delta : 0;
    const isDeltaIncreasing = currentDelta > prevDelta;
    const isDeltaPositive = currentDelta > 0;
    const isDeltaNegative = currentDelta < 0;
    
    // Дивергенция: цена растет, а дельта падает
    const priceUp = currentCandle.close > currentCandle.open;
    const deltaDivergence = priceUp && !isDeltaIncreasing;
    
    // === 4. АНАЛИЗ ORDER BLOCKS ===
    const nearestBlock = blocks.length > 0 ? blocks[blocks.length - 1] : null;
    const isNearBlock = nearestBlock && 
        Math.abs(price - nearestBlock.price) / nearestBlock.price < 0.003;
    const blockType = nearestBlock?.type || null;
    
    // === 5. АНАЛИЗ FVG ===
    const nearestFVG = fvgs.length > 0 ? fvgs[fvgs.length - 1] : null;
    const isInFVG = nearestFVG && 
        price > nearestFVG.bottom && price < nearestFVG.top;
    
    // === 6. КОМБИНИРОВАННЫЙ СИГНАЛ ===
    let signal = null;
    let confidence = 0;
    let reasons = [];
    
    // ---- СИГНАЛ НА ПОКУПКУ ----
    if (
        // Цена ниже POC (отскок вверх)
        price < vp.poc &&
        // Близко к уровню поддержки (VAL или блок)
        (isBelowVAL || (isNearBlock && blockType === 'bullish')) &&
        // Дельта показывает силу покупателей
        (isDeltaPositive || (isDeltaIncreasing && isDeltaNegative)) &&
        // Подтверждение от FVG
        (isInFVG || !isInFVG)
    ) {
        signal = 'buy';
        confidence += 30;
        reasons.push('Цена ниже POC');
        if (isBelowVAL) { confidence += 20; reasons.push('У уровня VAL'); }
        if (isDeltaPositive) { confidence += 20; reasons.push('Дельта положительная'); }
        if (isInFVG) { confidence += 15; reasons.push('В зоне FVG'); }
        if (isNearBlock && blockType === 'bullish') { confidence += 15; reasons.push('Near Order Block'); }
    }
    
    // ---- СИГНАЛ НА ПРОДАЖУ ----
    if (
        // Цена выше POC (отскок вниз)
        price > vp.poc &&
        // Близко к уровню сопротивления (VAH или блок)
        (isAboveVAH || (isNearBlock && blockType === 'bearish')) &&
        // Дельта показывает силу продавцов
        (isDeltaNegative || (isDeltaIncreasing && isDeltaPositive)) &&
        // Подтверждение от FVG
        (isInFVG || !isInFVG)
    ) {
        signal = 'sell';
        confidence += 30;
        reasons.push('Цена выше POC');
        if (isAboveVAH) { confidence += 20; reasons.push('У уровня VAH'); }
        if (isDeltaNegative) { confidence += 20; reasons.push('Дельта отрицательная'); }
        if (isInFVG) { confidence += 15; reasons.push('В зоне FVG'); }
        if (isNearBlock && blockType === 'bearish') { confidence += 15; reasons.push('Near Order Block'); }
    }
    
    // === 7. ФИЛЬТРАЦИЯ СИГНАЛОВ ===
    // Сигнал должен иметь уверенность > 60%
    if (confidence < 60) {
        signal = null;
    }
    
    // Фильтр: не входить при экстремальных движениях
    if (currentCandle) {
        const candleSize = Math.abs(currentCandle.close - currentCandle.open);
        const avgSize = candles.slice(-20).reduce((s, c) => s + Math.abs(c.close - c.open), 0) / 20;
        if (candleSize > avgSize * 2) {
            signal = null;
            reasons.push('Экстремальное движение, пропускаем');
        }
    }
    
    if (signal) {
        console.log(`📊 СИГНАЛ ${instrument.toUpperCase()}: ${signal.toUpperCase()}`);
        console.log(`   Уверенность: ${confidence}%`);
        console.log(`   Причины: ${reasons.join(', ')}`);
    }
    
    return signal ? { action: signal, confidence, reasons, price } : null;
}

// ============================================================
//  ИСПОЛНЕНИЕ СДЕЛКИ (С УПРАВЛЕНИЕМ РИСКАМИ)
// ============================================================

function executeTrade(instrument, side, price) {
    const pos = STATE.positions[instrument];
    const config = PROFESSIONAL_CONFIG;
    
    // === ПРОВЕРКА ДНЕВНЫХ ЛИМИТОВ ===
    const todayTrades = STATE.dailyStats.trades || [];
    if (todayTrades.length >= config.maxDailyTrades) {
        console.log(`⚠️ Дневной лимит сделок (${config.maxDailyTrades}) достигнут`);
        return;
    }
    
    // Проверка дневной просадки
    if (STATE.dailyStats.maxDrawdown > config.maxDailyLoss * 100) {
        console.log(`⚠️ Дневная просадка ${STATE.dailyStats.maxDrawdown.toFixed(2)}% превысила лимит`);
        return;
    }
    
    // === ОТКРЫТИЕ ПОЗИЦИИ ===
    if (side === 'buy') {
        if (pos) {
            console.log(`⚠️ Уже есть позиция по ${instrument}`);
            return;
        }
        
        // Расчет размера позиции (риск 1%)
        const riskAmount = STATE.balance * config.riskPerTrade;
        const pointCost = instrument === 'RTS' ? 1000 : 10;
        const stopLossPoints = 30; // RTS: 30, Si: 20
        const riskPerContract = stopLossPoints * pointCost;
        let quantity = Math.max(1, Math.floor(riskAmount / riskPerContract));
        if (instrument === 'RTS') quantity = Math.min(quantity, 1);
        
        STATE.positions[instrument] = {
            side: 'buy',
            entry: price,
            quantity: quantity,
            openTime: new Date().toISOString(),
            stopLoss: price - (instrument === 'RTS' ? 30 : 20),
            takeProfit: price + (instrument === 'RTS' ? 60 : 40) // 1:2 соотношение
        };
        
        console.log(`✅ ОТКРЫТА BUY ${instrument} ${quantity} шт по ${price}`);
        render();
        return;
    }
    
    if (side === 'sell') {
        if (!pos) {
            // Открытие SHORT
            const riskAmount = STATE.balance * config.riskPerTrade;
            const pointCost = instrument === 'RTS' ? 1000 : 10;
            const stopLossPoints = 30;
            const riskPerContract = stopLossPoints * pointCost;
            let quantity = Math.max(1, Math.floor(riskAmount / riskPerContract));
            if (instrument === 'RTS') quantity = Math.min(quantity, 1);
            
            STATE.positions[instrument] = {
                side: 'sell',
                entry: price,
                quantity: quantity,
                openTime: new Date().toISOString(),
                stopLoss: price + (instrument === 'RTS' ? 30 : 20),
                takeProfit: price - (instrument === 'RTS' ? 60 : 40)
            };
            console.log(`✅ ОТКРЫТА SELL ${instrument} ${quantity} шт по ${price}`);
            render();
            return;
        }
        
        // === ЗАКРЫТИЕ ПОЗИЦИИ ===
        const profit = pos.side === 'buy'
            ? (price - pos.entry) * pos.quantity
            : (pos.entry - price) * pos.quantity;
        
        STATE.balance += profit;
        
        const trade = {
            id: Date.now(),
            instrument,
            side: pos.side,
            price: Math.round(price * 100) / 100,
            entryPrice: Math.round(pos.entry * 100) / 100,
            profit: Math.round(profit * 100) / 100,
            quantity: pos.quantity || 1,
            timestamp: new Date().toISOString(),
            timeStr: new Date().toLocaleTimeString(),
            entryTime: pos.openTime || new Date().toISOString()
        };
        STATE.trades.push(trade);
        STATE.positions[instrument] = null;
        
        // === ОБНОВЛЕНИЕ СТАТИСТИКИ ===
        STATE.stats.total++;
        if (profit > 0) STATE.stats.wins++;
        else STATE.stats.losses++;
        STATE.stats.profit += profit;
        
        // Дневная статистика
        const today = new Date().toDateString();
        if (STATE.dailyStats.date !== today) resetDailyStats();
        STATE.dailyStats.total++;
        if (profit > 0) STATE.dailyStats.wins++;
        else STATE.dailyStats.losses++;
        STATE.dailyStats.profit += profit;
        STATE.dailyStats.trades.push(trade);
        
        // Расчет просадки
        const currentBalance = STATE.balance;
        const peakBalance = STATE.dailyStats.peakBalance || currentBalance;
        if (currentBalance > peakBalance) STATE.dailyStats.peakBalance = currentBalance;
        const drawdown = ((peakBalance - currentBalance) / peakBalance) * 100;
        if (drawdown > STATE.dailyStats.maxDrawdown) {
            STATE.dailyStats.maxDrawdown = drawdown;
        }
        
        console.log(`✅ ЗАКРЫТА ${instrument} P&L: ${profit > 0 ? '+' : ''}${profit}`);
        render();
    }
}

// ============================================================
//  ЗАПУСК СТРАТЕГИЙ (С ПРОФЕССИОНАЛЬНЫМИ СИГНАЛАМИ)
// ============================================================

function runStrategies() {
    if (!STATE.strategies.RTS && !STATE.strategies.Si) return;
    
    const instruments = [];
    if (STATE.strategies.RTS) instruments.push('RTS');
    if (STATE.strategies.Si) instruments.push('Si');
    
    for (const inst of instruments) {
        const quote = STATE.quotes[inst];
        const candles = STATE.minuteCandles[inst] || [];
        
        if (!quote || !quote.price || candles.length < 30) continue;
        
        // Проверяем, есть ли уже позиция
        const pos = STATE.positions[inst];
        if (pos) {
            // Управление открытой позицией
            const currentPrice = quote.price;
            const profit = pos.side === 'buy'
                ? (currentPrice - pos.entry) * pos.quantity
                : (pos.entry - currentPrice) * pos.quantity;
            
            // Трейлинг-стоп
            if (profit > 0) {
                // Подтягиваем стоп-лосс при росте прибыли
                const trailingStop = pos.side === 'buy'
                    ? currentPrice - (inst === 'RTS' ? 20 : 10)
                    : currentPrice + (inst === 'RTS' ? 20 : 10);
                
                if (pos.side === 'buy' && trailingStop > pos.stopLoss) {
                    pos.stopLoss = trailingStop;
                } else if (pos.side === 'sell' && trailingStop < pos.stopLoss) {
                    pos.stopLoss = trailingStop;
                }
            }
            
            // Проверка стоп-лосса и тейк-профита
            if (pos.side === 'buy') {
                if (currentPrice <= pos.stopLoss) {
                    executeTrade(inst, 'sell', currentPrice);
                    continue;
                }
                if (currentPrice >= pos.takeProfit) {
                    executeTrade(inst, 'sell', currentPrice);
                    continue;
                }
            } else {
                if (currentPrice >= pos.stopLoss) {
                    executeTrade(inst, 'buy', currentPrice);
                    continue;
                }
                if (currentPrice <= pos.takeProfit) {
                    executeTrade(inst, 'buy', currentPrice);
                    continue;
                }
            }
            
            // Если позиция открыта и нет сигнала на закрытие — пропускаем
            continue;
        }
        
        // Генерация сигнала
        const signal = generateProfessionalSignal(inst, candles, quote);
        if (signal) {
            // Проверка: не слишком ли часто входим
            const lastTrade = STATE.dailyStats.trades[STATE.dailyStats.trades.length - 1];
            if (lastTrade) {
                const timeSinceLast = Date.now() - new Date(lastTrade.timestamp).getTime();
                if (timeSinceLast < 60000) { // Минута между сделками
                    console.log(`⏳ Слишком рано для новой сделки (${Math.round(timeSinceLast/1000)}с)`);
                    continue;
                }
            }
            
            // Защита от повторного входа в ту же сторону
            const lastClosedTrade = STATE.trades[STATE.trades.length - 1];
            if (lastClosedTrade && lastClosedTrade.instrument === inst) {
                const timeSinceLastClosed = Date.now() - new Date(lastClosedTrade.timestamp).getTime();
                if (timeSinceLastClosed < 120000) { // 2 минуты
                    console.log(`⏳ Ждем 2 минуты после закрытия`);
                    continue;
                }
            }
            
            // Исполняем сигнал
            const action = signal.action;
            if (action === 'buy') {
                executeTrade(inst, 'buy', signal.price);
            } else if (action === 'sell') {
                executeTrade(inst, 'sell', signal.price);
            }
        }
    }
}

// ============================================================
//  ЭКСПОРТ
// ============================================================

window.executeTrade = executeTrade;
window.runStrategies = runStrategies;
window.generateProfessionalSignal = generateProfessionalSignal;
window.calculateVolumeProfile = calculateVolumeProfile;
window.calculateCVD = calculateCVD;
window.findOrderBlocks = findOrderBlocks;
window.findFVG = findFVG;
window.PROFESSIONAL_CONFIG = PROFESSIONAL_CONFIG;

console.log('📊 trading.js загружен (ПРОФЕССИОНАЛЬНАЯ ВЕРСИЯ)');
