// ============================================================
//  ЗАПУСК ПРИЛОЖЕНИЯ (ПОЛНАЯ ВЕРСИЯ С ТЕСТОВЫМ РЕЖИМОМ)
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Запуск приложения...');
    
    // 1. Определяем инструменты
    console.log('🔍 Определение актуальных фьючерсов...');
    await detectInstrumentCodes();
    console.log('📊 Используемые коды:', INSTRUMENT_CODES);
    
    // 2. Настраиваем управление графиком
    setupChartControls();
    
    // 3. Загружаем данные для обоих инструментов
    console.log('🔄 Загрузка данных для RTS...');
    await loadMinuteCandles('RTS');
    
    console.log('🔄 Загрузка данных для Si...');
    await loadMinuteCandles('Si');
    
    // 4. Получаем текущие котировки
    const rts = await fetchQuote('RTS');
    if (rts && rts.price > 0) STATE.quotes.RTS = rts;
    
    const si = await fetchQuote('Si');
    if (si && si.price > 0) STATE.quotes.Si = si;
    
    // 5. Отрисовываем интерфейс
    render();
    
    // 6. Если библиотека ещё не загружена - пробуем через 1 секунду
    setTimeout(() => {
        if (!isLibraryLoaded()) {
            console.log('🔄 Повторная попытка загрузки библиотеки...');
            if (typeof safeDrawCandleChart === 'function') {
                safeDrawCandleChart();
            }
        }
    }, 1000);
    
    // 7. Запускаем цикл обновления
    startUpdateLoop();
    
    // 8. Экспорт отчёта
    document.getElementById('exportBtn').addEventListener('click', exportToExcel);
    
    // 9. Обновление графика при ресайзе
    window.addEventListener('resize', () => {
        if (typeof drawCandleChart === 'function') {
            setTimeout(drawCandleChart, 100);
        }
    });
    
    console.log('✅ Приложение запущено');
});

// ============================================================
//  ЦИКЛ ОБНОВЛЕНИЯ (С ТЕСТОВЫМ РЕЖИМОМ)
// ============================================================

let updateInterval = null;
let testMode = true; // Включаем тестовый режим для демонстрации

function startUpdateLoop() {
    if (updateInterval) {
        clearTimeout(updateInterval);
    }
    
    async function updateAll() {
        try {
            const inst = STATE.currentInstrument || 'RTS';
            
            // === 1. ПОЛУЧАЕМ РЕАЛЬНЫЕ КОТИРОВКИ ===
            let rts = await fetchQuote('RTS');
            let si = await fetchQuote('Si');
            
            // === 2. ЕСЛИ ЦЕНЫ НЕ МЕНЯЮТСЯ — ДОБАВЛЯЕМ ТЕСТОВОЕ ДВИЖЕНИЕ ===
            if (testMode) {
                // Базовые цены (последние реальные)
                const baseRts = rts?.price || 80040;
                const baseSi = si?.price || 89974;
                
                // Добавляем случайное движение (как на реальном рынке)
                const rtsDelta = (Math.random() - 0.5) * 60; // ±30 пунктов
                const siDelta = (Math.random() - 0.5) * 30;  // ±15 пунктов
                
                // Обновляем цены
                if (rts) {
                    rts.price = Math.round((baseRts + rtsDelta) * 100) / 100;
                    rts.change = ((rts.price - (rts.open || baseRts)) / (rts.open || baseRts) * 100);
                }
                if (si) {
                    si.price = Math.round((baseSi + siDelta) * 100) / 100;
                    si.change = ((si.price - (si.open || baseSi)) / (si.open || baseSi) * 100);
                }
            }
            
            // Обновляем STATE
            if (rts && rts.price > 0) STATE.quotes.RTS = rts;
            if (si && si.price > 0) STATE.quotes.Si = si;
            
            // === 3. ОБНОВЛЯЕМ СВЕЧИ ===
            const minuteCandles = STATE.minuteCandles[inst];
            if (minuteCandles && minuteCandles.length > 0 && STATE.quotes[inst]?.price > 0) {
                const last = minuteCandles[minuteCandles.length - 1];
                const now = Date.now();
                const price = STATE.quotes[inst].price;
                
                // Проверяем, нужно ли создать новую свечу
                const timeSinceLastCandle = now - last.time;
                const shouldCreateNewCandle = timeSinceLastCandle > 120000;
                
                if (shouldCreateNewCandle) {
                    // Создаем новую свечу
                    const newTime = now - (now % 60000);
                    const existingCandle = minuteCandles.find(c => 
                        Math.abs(c.time - newTime) < 1000
                    );
                    
                    if (!existingCandle) {
                        const newCandle = {
                            time: newTime,
                            open: price,
                            high: price,
                            low: price,
                            close: price,
                        };
                        minuteCandles.push(newCandle);
                    } else {
                        existingCandle.close = price;
                        if (price > existingCandle.high) existingCandle.high = price;
                        if (price < existingCandle.low) existingCandle.low = price;
                    }
                } else if (last) {
                    // Обновляем текущую свечу
                    last.close = price;
                    if (price > last.high) last.high = price;
                    if (price < last.low) last.low = price;
                }
                
                // Ограничиваем количество свечей
                if (minuteCandles.length > 2000) {
                    STATE.minuteCandles[inst] = minuteCandles.slice(-1500);
                }
                
                // Обновляем агрегированные свечи
                const interval = STATE.interval;
                if (interval === 1) {
                    STATE.candles[inst] = minuteCandles.slice();
                } else {
                    STATE.candles[inst] = aggregateCandles(minuteCandles, interval);
                }
                if (STATE.candles[inst].length > STATE.maxCandles) {
                    STATE.candles[inst] = STATE.candles[inst].slice(-STATE.maxCandles);
                }
            }
            
            // Запускаем стратегии
            runStrategies();
            
            // Отрисовываем интерфейс
            render();
            
        } catch (e) {
            console.error('❌ Ошибка обновления:', e);
        }
        
        // Планируем следующее обновление
        updateInterval = setTimeout(updateAll, 2000);
    }
    
    updateAll();
}

// ============================================================
//  УПРАВЛЕНИЕ ТЕСТОВЫМ РЕЖИМОМ
// ============================================================

function toggleTestMode() {
    testMode = !testMode;
    console.log(`🧪 Тестовый режим: ${testMode ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    return testMode;
}

// ============================================================
//  ОСТАНОВКА ОБНОВЛЕНИЙ
// ============================================================

function stopUpdateLoop() {
    if (updateInterval) {
        clearTimeout(updateInterval);
        updateInterval = null;
        console.log('⏹ Цикл обновлений остановлен');
    }
}

// ============================================================
//  ЭКСПОРТ
// ============================================================

window.toggleTestMode = toggleTestMode;
window.stopUpdateLoop = stopUpdateLoop;
window.startUpdateLoop = startUpdateLoop;

console.log('🧪 Тестовый режим ВКЛЮЧЕН для демонстрации графика');
console.log('📊 Чтобы выключить, выполните: toggleTestMode()');
console.log('📱 app.js загружен (ПОЛНАЯ ВЕРСИЯ)');
