// ============================================================
//  ЗАГРУЗЧИК БИБЛИОТЕКИ lightweight-charts (ESM)
// ============================================================

let chartInstance = null;
let candlestickSeries = null;

// Функция для загрузки библиотеки
async function loadLightweightCharts() {
    try {
        const module = await import('https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.0/dist/lightweight-charts.esm.js');
        return module;
    } catch (error) {
        console.error('Ошибка загрузки lightweight-charts:', error);
        return null;
    }
}

// Функция для получения данных из STATE
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

// Создание или обновление графика
async function drawCandleChart() {
    const container = document.getElementById('chart-container');
    if (!container) {
        console.error('Контейнер chart-container не найден');
        return;
    }

    // Загружаем библиотеку, если ещё не загружена
    if (!window._lightweightCharts) {
        const module = await loadLightweightCharts();
        if (module) {
            window._lightweightCharts = module;
            window.createChart = module.createChart;
            console.log('✅ Библиотека lightweight-charts загружена!');
        } else {
            console.error('❌ Не удалось загрузить библиотеку');
            container.innerHTML = '<div style="color:#ef4444;text-align:center;padding:20px;">Ошибка загрузки библиотеки графиков</div>';
            return;
        }
    }

    const createChart = window.createChart;
    const instrument = STATE.currentInstrument || 'RTS';
    const data = getCandleData(instrument);

    if (data.length === 0) {
        console.log('Нет данных для графика');
        container.innerHTML = '<div style="color:#64748b;text-align:center;padding:20px;">Загрузка данных...</div>';
        return;
    }

    // Если графика нет — создаём
    if (!chartInstance) {
        container.innerHTML = '';

        chartInstance = createChart(container, {
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
                fixLeftEdge: true,
                fixRightEdge: true,
            },
            rightPriceScale: {
                borderColor: '#1e293b',
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1,
                },
            },
        });

        candlestickSeries = chartInstance.addCandlestickSeries({
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        // Автоматическое обновление при ресайзе
        const resizeObserver = new ResizeObserver(() => {
            if (chartInstance && container) {
                const width = container.clientWidth || 600;
                const height = container.clientHeight || 500;
                chartInstance.applyOptions({ width, height });
            }
        });
        resizeObserver.observe(container);
        window._resizeObserver = resizeObserver;
        
        console.log('✅ График создан');
    }

    // Обновляем данные
    candlestickSeries.setData(data);
    chartInstance.timeScale().fitContent();

    // Обновляем счётчик свечей
    document.getElementById('candleCount').textContent = data.length;
    document.getElementById('timeframeLabel').textContent = 
        STATE.interval < 60 ? STATE.interval + 'м' : (STATE.interval/60) + 'ч';
}

// ===== ФУНКЦИЯ ЗАГРУЗКИ СВЕЧЕЙ (ГЛОБАЛЬНАЯ) =====
async function loadMinuteCandles(instrument = 'RTS') {
    const candles = await fetchMinuteCandles(instrument);
    if (candles && candles.length > 10) {
        STATE.minuteCandles[instrument] = candles;
        console.log(`✅ Загружено 1м свечей (${instrument}):`, candles.length);
    } else {
        const startPrice = instrument === 'RTS' ? 78000 : 88;
        STATE.minuteCandles[instrument] = generateTestCandles(200, startPrice, 1);
        console.log(`📊 Используются тестовые 1м свечи (${instrument})`);
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
    await drawCandleChart();
}

// ===== ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ИНСТРУМЕНТА =====
window.switchInstrument = async function(instrument) {
    STATE.currentInstrument = instrument;
    
    document.getElementById('instRTS').className = 'inst-btn' + (instrument === 'RTS' ? ' active' : '');
    document.getElementById('instSi').className = 'inst-btn' + (instrument === 'Si' ? ' active' : '');
    document.getElementById('chartTitle').textContent = '📈 ГРАФИК ' + instrument;
    
    if (STATE.minuteCandles[instrument].length === 0) {
        await loadMinuteCandles(instrument);
    }
    await drawCandleChart();
};

// ===== ФУНКЦИЯ ОБНОВЛЕНИЯ ТАЙМФРЕЙМА =====
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

// ===== НАСТРОЙКА КНОПОК ТАЙМФРЕЙМОВ =====
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

// ===== ВЕРТИКАЛЬНЫЙ ЗУМ (кнопки) =====
document.addEventListener('DOMContentLoaded', function() {
    const zoomInBtn = document.getElementById('zoomInV');
    const zoomOutBtn = document.getElementById('zoomOutV');
    const zoomResetBtn = document.getElementById('zoomResetV');
    
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            if (chartInstance) {
                const priceScale = chartInstance.priceScale();
                const currentScale = priceScale.scale();
                priceScale.applyOptions({ scale: currentScale * 1.2 });
            }
        });
    }
    
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            if (chartInstance) {
                const priceScale = chartInstance.priceScale();
                const currentScale = priceScale.scale();
                priceScale.applyOptions({ scale: currentScale * 0.8 });
            }
        });
    }
    
    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', () => {
            if (chartInstance) {
                chartInstance.priceScale().applyOptions({ scale: 1 });
                chartInstance.timeScale().fitContent();
            }
        });
    }
});

// ===== ЭКСПОРТЫ В ГЛОБАЛЬНЫЙ ОБЪЕКТ =====
window.drawCandleChart = drawCandleChart;
window.loadMinuteCandles = loadMinuteCandles;
window.setupChartControls = setupChartControls;
window.updateTimeframe = updateTimeframe;

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
    if (container) {
        container.innerHTML = '';
    }
};

console.log('📊 chart-loader.js загружен');
