// ============================================================
//  ЗАГРУЗЧИК ГРАФИКА (без динамического импорта)
// ============================================================

let chartInstance = null;
let candlestickSeries = null;

function getCandleData(instrument) {
    const candles = STATE.candles[instrument] || [];
    return candles.map(c => ({
        time: Math.floor(c.time / 1000),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
    }));
}

function drawCandleChart() {
    const container = document.getElementById('chart-container');
    if (!container) {
        console.error('Контейнер chart-container не найден');
        return;
    }

    // Проверяем, что библиотека загружена
    if (typeof LightweightCharts === 'undefined') {
        console.error('Библиотека lightweight-charts не загружена!');
        container.innerHTML = '<div style="color:#ef4444;text-align:center;padding:20px;">Ошибка загрузки библиотеки графиков</div>';
        return;
    }

    const instrument = STATE.currentInstrument || 'RTS';
    const data = getCandleData(instrument);

    if (data.length === 0) {
        container.innerHTML = '<div style="color:#64748b;text-align:center;padding:20px;">Загрузка данных...</div>';
        return;
    }

    if (!chartInstance) {
        container.innerHTML = '';
        chartInstance = LightweightCharts.createChart(container, {
            width: container.clientWidth || 600,
            height: container.clientHeight || 500,
            layout: {
                background: { color: '#0f172a' },
                textColor: '#d1d5db',
            },
            grid: {
                vertLines: { color: '#1e293b' },
                horzLines: { color: '#1e293b' },
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#1e293b',
            },
            rightPriceScale: {
                borderColor: '#1e293b',
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
        });

        candlestickSeries = chartInstance.addCandlestickSeries({
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        const resizeObserver = new ResizeObserver(() => {
            if (chartInstance && container) {
                chartInstance.applyOptions({
                    width: container.clientWidth || 600,
                    height: container.clientHeight || 500,
                });
            }
        });
        resizeObserver.observe(container);
        window._resizeObserver = resizeObserver;
        console.log('✅ График создан');
    }

    candlestickSeries.setData(data);
    chartInstance.timeScale().fitContent();

    document.getElementById('candleCount').textContent = data.length;
    document.getElementById('timeframeLabel').textContent =
        STATE.interval < 60 ? STATE.interval + 'м' : (STATE.interval / 60) + 'ч';
}

// ---- Остальные функции (loadMinuteCandles, switchInstrument, setupChartControls) ----
// Оставьте их без изменений. Они уже были в предыдущей версии.
// Убедитесь, что в конце файла есть:
window.drawCandleChart = drawCandleChart;
console.log('📊 chart-loader.js загружен');
