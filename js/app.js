// ============================================================
//  ЗАПУСК ПРИЛОЖЕНИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔍 Определение актуальных фьючерсов...');
    await detectInstrumentCodes();
    console.log('📊 Используемые коды:', INSTRUMENT_CODES);
    
    // Настраиваем управление графиком (кнопки таймфреймов)
    if (typeof setupChartControls === 'function') {
        setupChartControls();
        console.log('✅ setupChartControls вызван');
    } else {
        console.warn('⚠️ setupChartControls не определён');
    }
    
    // Загружаем свечи для RTS
    await loadMinuteCandles('RTS');
    
    // Получаем текущие котировки
    const rts = await fetchQuote('RTS');
    if (rts) STATE.quotes.RTS = rts;
    const si = await fetchQuote('Si');
    if (si) STATE.quotes.Si = si;
    
    // Отрисовываем интерфейс
    render();
    
    // ============================================================
    //  ЦИКЛ ОБНОВЛЕНИЯ
    // ============================================================
    async function updateAll() {
        try {
            const inst = STATE.currentInstrument || 'RTS';
            
            // Обновляем котировки
            const rts = await fetchQuote('RTS');
            if (rts && rts.price > 0) STATE.quotes.RTS = rts;
            
            const si = await fetchQuote('Si');
            if (si && si.price > 0) STATE.quotes.Si = si;
            
            // Обновляем свечи
            const minuteCandles = STATE.minuteCandles[inst];
            if (minuteCandles && minuteCandles.length > 0 && STATE.quotes[inst]?.price > 0) {
                const last = minuteCandles[minuteCandles.length-1];
                const now = Date.now();
                if (last && now - last.time > 120000) {
                    const newCandle = {
                        time: now - (now % 60000),
                        open: STATE.quotes[inst].price,
                        high: STATE.quotes[inst].price,
                        low: STATE.quotes[inst].price,
                        close: STATE.quotes[inst].price,
                    };
                    minuteCandles.push(newCandle);
                    if (minuteCandles.length > 2000) {
                        STATE.minuteCandles[inst] = minuteCandles.slice(-1500);
                    }
                } else if (last) {
                    last.close = STATE.quotes[inst].price;
                    if (last.close > last.high) last.high = last.close;
                    if (last.close < last.low) last.low = last.close;
                }
                // Обновляем агрегированные свечи
                const interval = STATE.interval;
                if (interval === 1) {
                    STATE.candles[inst] = minuteCandles;
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
            console.error('Ошибка обновления:', e);
        }
        
        setTimeout(updateAll, 2000);
    }
    
    updateAll();
    
    // Экспорт отчёта
    document.getElementById('exportBtn').addEventListener('click', exportToExcel);
    
    // Обновление графика при ресайзе
    window.addEventListener('resize', drawCandleChart);
});
