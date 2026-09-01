// ============================================================
//  ГРАФИК НА lightweight-charts
//  Всё работает "из коробки": зум, центр, адаптация
// ============================================================

let chartInstance = null;
let candlestickSeries = null;
let currentSymbol = 'RTS';

// Функция для получения данных из STATE
function getCandleData(instrument) {
    const candles = STATE.candles[instrument] || [];
    return candles.map(c => ({
        time: Math.floor(c.time / 1000), // lightweight-charts требует секунды
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
    }));
}

// Создание или обновление графика
function drawCandleChart() {
    const container = document.getElementById('chart-container');
    if (!container) return;

    const instrument = STATE.currentInstrument || 'RTS';
    const data = getCandleData(instrument);

    if (data.length === 0) {
        console.log('Нет данных для графика');
        return;
    }

    // Если графика нет — создаём
    if (!chartInstance) {
        chartInstance = createChart(container, {
            width: container.clientWidth,
            height: container.clientHeight,
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
            if (chartInstance) {
                chartInstance.applyOptions({
                    width: container.clientWidth,
                    height: container.clientHeight,
                });
            }
        });
        resizeObserver.observe(container);
        window._resizeObserver = resizeObserver;
    }

    // Обновляем данные
    candlestickSeries.setData(data);

    // Автоматическое масштабирование
    chartInstance.timeScale().fitContent();

    // Обновляем счётчик свечей
    document.getElementById('candleCount').textContent = data.length;
    document.getElementById('timeframeLabel').textContent = 
        STATE.interval < 60 ? STATE.interval + 'м' : (STATE.interval/60) + 'ч';
}

// Функция для переключения инструмента
window.switchInstrument = async function(instrument) {
    STATE.currentInstrument = instrument;
    currentSymbol = instrument;
    
    document.getElementById('instRTS').className = 'inst-btn' + (instrument === 'RTS' ? ' active' : '');
    document.getElementById('instSi').className = 'inst-btn' + (instrument === 'Si' ? ' active' : '');
    document.getElementById('chartTitle').textContent = '📈 ГРАФИК ' + instrument;
    
    if (STATE.minuteCandles[instrument].length === 0) {
        await loadMinuteCandles(instrument);
    }
    drawCandleChart();
};

// Функция для обновления таймфрейма
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

// Инициализация контролов
function setupChartControls() {
    // Переключение таймфреймов
    document.querySelectorAll('#timeframeControls button[data-interval]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#timeframeControls button[data-interval]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            updateTimeframe(parseInt(this.dataset.interval));
        });
    });
}

// Очистка графика при необходимости
function destroyChart() {
    if (window._resizeObserver) {
        window._resizeObserver.disconnect();
        window._resizeObserver = null;
    }
    if (chartInstance) {
        chartInstance.remove();
        chartInstance = null;
        candlestickSeries = null;
    }
}

// Функция загрузки 1-минутных свечей (добавляем, чтобы не было ошибок)
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
    drawCandleChart();
}
