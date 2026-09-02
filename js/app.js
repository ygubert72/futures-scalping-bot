// ============================================================
//  ЗАПУСК ПРИЛОЖЕНИЯ (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {.
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
//  ЦИКЛ ОБНОВЛЕНИЯ
// ============================================================

let updateInterval = null;

function startUpdateLoop() {
    if (updateInterval) {
        clearTimeout(updateInterval);
    }
    
    async function updateAll() {
        try {
            const inst = STATE.currentInstrument || 'RTS';
            
            // Обновляем котировки
            const rts = await fetchQuote('RTS');
            if (rts && rts.price > 0) STATE.quotes.RTS = rts;
            
            const si = await fetchQuote('Si');
            if (si && si.price > 0) STATE.quotes.Si = si;
            
            // Обновляем свечи для текущего инструмента
            const minuteCandles = STATE.minuteCandles[inst];
            if (minuteCandles && minuteCandles.length > 0 && STATE.quotes[inst]?.price > 0) {
                const last = minuteCandles[minuteCandles.length - 1];
                const now = Date.now();
                const price = STATE.quotes[inst].price;
                
                if (last && now - last.time > 120000) {
                    // Новая свеча
                    const newCandle = {
                        time: now - (now % 60000),
                        open: price,
                        high: price,
                        low: price,
                        close: price,
                    };
                    minuteCandles.push(newCandle);
                    if (minuteCandles.length > 2000) {
                        STATE.minuteCandles[inst] = minuteCandles.slice(-1500);
                    }
                } else if (last) {
                    // Обновляем текущую свечу
                    last.close = price;
                    if (price > last.high) last.high = price;
                    if (price < last.low) last.low = price;
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
//  ОСТАНОВКА ОБНОВЛЕНИЙ
// ============================================================

function stopUpdateLoop() {
    if (updateInterval) {
        clearTimeout(updateInterval);
        updateInterval = null;
        console.log('⏹ Цикл обновлений остановлен');
    }
}

// Экспортируем для возможности остановки
window.stopUpdateLoop = stopUpdateLoop;
window.startUpdateLoop = startUpdateLoop;

console.log('📱 app.js загружен (ИСПРАВЛЕННАЯ ВЕРСИЯ)');
