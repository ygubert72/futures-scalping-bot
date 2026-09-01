// ============================================================
//  ГРАФИК (lightweight-charts) — упрощённая версия
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
        console.error('Контейнер не найден');
        return;
    }

    // Проверяем, что библиотека загружена
    if (typeof LightweightCharts === 'undefined') {
        console.error('❌ Библиотека не загружена!');
        container.innerHTML = '<div style="color:#ef4444;padding:20px;">Ошибка: библиотека графиков не загружена</div>';
        return;
    }

    const instrument = STATE.currentInstrument || 'RTS';
    const data = getCandleData(instrument);

    if (data.length === 0) {
        container.innerHTML = '<div style="color:#64748b;padding:20px;">Загрузка данных...</div>';
        return;
    }

    if (!chartInstance) {
        container.innerHTML = '';
        chartInstance = LightweightCharts.createChart(container, {
            width: container.clientWidth || 600,
            height: container.clientHeight || 500,
            layout: { background: { color: '#0f172a' }, textColor: '#d1d5db' },
            grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
            timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#1e293b' },
            rightPriceScale: { borderColor: '#1e293b', scaleMargins: { top: 0.1, bottom: 0.1 } },
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

// ===== ОСТАЛЬНЫЕ ФУНКЦИИ (без изменений) =====

async function loadMinuteCandles(instrument = 'RTS') {
    const candles = await fetchMinuteCandles(instrument);
    if (candles && candles.length > 10) {
        STATE.minuteCandles[instrument] = candles;
        console.log(`✅ Загружено 1м свечей (${instrument}):`, candles.length);
    } else {
        const startPrice = instrument === 'RTS' ? 78000 : 88;
        STATE.minuteCandles[instrument] = generateTestCandles(200, startPrice, 1);
        console.log(`📊 Тестовые 1м свечи (${instrument})`);
    }
    const minuteCandles = STATE.minuteCandles[instrument] || [];
    if (minuteCandles.length > 0) {
        const interval = STATE.interval || 1;
        STATE.candles[instrument] = interval === 1
            ? minuteCandles
            : aggregateCandles(minuteCandles, interval);
        if (STATE.candles[instrument].length > STATE.maxCandles) {
            STATE.candles[instrument] = STATE.candles[instrument].slice(-STATE.maxCandles);
        }
    }
    drawCandleChart();
}

window.switchInstrument = async function(instrument) {
    STATE.currentInstrument = instrument;
    document.getElementById('instRTS').className = 'inst-btn' + (instrument === 'RTS' ? ' active' : '');
    document.getElementById('instSi').className = 'inst-btn' + (instrument === 'Si' ? ' active' : '');
    document.getElementById('chartTitle').textContent = '📈 ГРАФИК ' + instrument;
    if (STATE.minuteCandles[instrument].length === 0) {
        await loadMinuteCandles(instrument);
    }
    drawCandleChart();
};

function updateTimeframe(interval) {
    STATE.interval = interval;
    const inst = STATE.currentInstrument || 'RTS';
    const minuteCandles = STATE.minuteCandles[inst] || [];
    if (minuteCandles.length > 0) {
        STATE.candles[inst] = interval === 1
            ? minuteCandles
            : aggregateCandles(minuteCandles, interval);
        if (STATE.candles[inst].length > STATE.maxCandles) {
            STATE.candles[inst] = STATE.candles[inst].slice(-STATE.maxCandles);
        }
    }
    drawCandleChart();
}

function setupChartControls() {
    document.querySelectorAll('#timeframeControls button[data-interval]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#timeframeControls button[data-interval]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            updateTimeframe(parseInt(this.dataset.interval));
        });
    });
    console.log('✅ Управление графиком настроено');
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('zoomInV')?.addEventListener('click', () => {
        if (chartInstance) {
            const s = chartInstance.priceScale().scale();
            chartInstance.priceScale().applyOptions({ scale: s * 1.2 });
        }
    });
    document.getElementById('zoomOutV')?.addEventListener('click', () => {
        if (chartInstance) {
            const s = chartInstance.priceScale().scale();
            chartInstance.priceScale().applyOptions({ scale: s * 0.8 });
        }
    });
    document.getElementById('zoomResetV')?.addEventListener('click', () => {
        if (chartInstance) {
            chartInstance.priceScale().applyOptions({ scale: 1 });
            chartInstance.timeScale().fitContent();
        }
    });
});

window.destroyChart = function() {
    if (window._resizeObserver) {
        window._resizeObserver.disconnect();
        window._resizeObserver = null;
    }
    if (chartInstance) {
        chartInstance.remove();
        chartInstance = null;
        candlestickSeries = null;
    }
    const container = document.getElementById('chart-container');
    if (container) container.innerHTML = '';
};

window.drawCandleChart = drawCandleChart;
window.loadMinuteCandles = loadMinuteCandles;
window.setupChartControls = setupChartControls;
window.updateTimeframe = updateTimeframe;

console.log('📊 chart-loader.js загружен');
