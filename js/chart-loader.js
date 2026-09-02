// ============================================================
//  ГРАФИК (lightweight-charts) — ПОЛНАЯ ВЕРСИЯ
// ============================================================

let chartInstance = null;
let candlestickSeries = null;
let priceScaleRef = null;

// ============================================================
//  БЕЗОПАСНАЯ ОТРИСОВКА
// ============================================================

function safeDrawCandleChart() {
    if (typeof LightweightCharts !== 'undefined') {
        window._libraryLoaded = true;
        drawCandleChart();
        return true;
    } else {
        console.warn('⏳ Библиотека не загружена, откладываем отрисовку');
        // Сохраняем вызов для повторной попытки
        window._pendingDraw = drawCandleChart;
        return false;
    }
}

// ============================================================
//  ОСНОВНАЯ ФУНКЦИЯ ОТРИСОВКИ
// ============================================================

function drawCandleChart() {
    const container = document.getElementById('chart-container');
    if (!container) {
        console.error('Контейнер не найден');
        return;
    }

    if (typeof LightweightCharts === 'undefined') {
        console.warn('⏳ Библиотека ещё не загружена');
        container.innerHTML = '<div style="color:#94a3b8;padding:20px;text-align:center;">⏳ Загрузка библиотеки графиков...</div>';
        // Пробуем загрузить снова
        if (!window._libraryLoaded) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lightweight-charts/4.1.0/lightweight-charts.standalone.js';
            script.onload = function() {
                window._libraryLoaded = true;
                console.log('✅ Библиотека загружена (принудительно)');
                drawCandleChart();
            };
            document.head.appendChild(script);
        }
        return;
    }

    const instrument = STATE.currentInstrument || 'RTS';
    const data = getCandleData(instrument);

    if (data.length === 0) {
        container.innerHTML = '<div style="color:#64748b;padding:20px;text-align:center;">⏳ Загрузка данных...</div>';
        return;
    }

    const containerWidth = container.clientWidth || 600;
    const containerHeight = container.clientHeight || 500;

    // --- СОЗДАНИЕ ГРАФИКА ---
    if (!chartInstance) {
        container.innerHTML = '';
        
        chartInstance = LightweightCharts.createChart(container, {
            width: containerWidth,
            height: containerHeight,
            layout: { 
                background: { color: '#0f172a' }, 
                textColor: '#d1d5db' 
            },
            grid: { 
                vertLines: { color: '#1e293b' }, 
                horzLines: { color: '#1e293b' } 
            },
            timeScale: { 
                timeVisible: true, 
                secondsVisible: false, 
                borderColor: '#1e293b',
                fixLeftEdge: true,
                fixRightEdge: true,
                minBarSpacing: 1,
            },
            rightPriceScale: { 
                borderColor: '#1e293b',
                scaleMargins: {
                    top: 0.10,
                    bottom: 0.10,
                },
                autoScale: true,
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
            },
            handleScale: {
                mouseWheel: true,
                pinch: true,
                axisPressedMouseMove: {
                    time: true,
                    price: true,
                },
            },
        });

        priceScaleRef = chartInstance.priceScale();
        
        candlestickSeries = chartInstance.addCandlestickSeries({
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
            priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
            },
        });

        // Обработчик ресайза
        const resizeObserver = new ResizeObserver(() => {
            if (chartInstance && container) {
                const w = container.clientWidth || 600;
                const h = container.clientHeight || 500;
                chartInstance.applyOptions({
                    width: w,
                    height: h,
                });
                setTimeout(centerChart, 100);
            }
        });
        resizeObserver.observe(container);
        window._resizeObserver = resizeObserver;
        
        console.log('✅ График создан');
    }

    // --- ОБНОВЛЕНИЕ ДАННЫХ ---
    if (candlestickSeries) {
        candlestickSeries.setData(data);
        chartInstance.timeScale().fitContent();
        
        if (priceScaleRef) {
            priceScaleRef.applyOptions({
                scaleMargins: {
                    top: 0.10,
                    bottom: 0.10,
                },
            });
        }
    }

    document.getElementById('candleCount').textContent = data.length;
    document.getElementById('timeframeLabel').textContent =
        STATE.interval < 60 ? STATE.interval + 'м' : (STATE.interval / 60) + 'ч';
}

// ============================================================
//  ПОЛУЧЕНИЕ ДАННЫХ
// ============================================================

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

// ============================================================
//  ЦЕНТРИРОВАНИЕ
// ============================================================

function centerChart() {
    if (chartInstance && candlestickSeries) {
        chartInstance.timeScale().fitContent();
        if (priceScaleRef) {
            priceScaleRef.applyOptions({
                scaleMargins: {
                    top: 0.10,
                    bottom: 0.10,
                },
            });
        }
    }
}

// ============================================================
//  ВЕРТИКАЛЬНЫЙ ЗУМ
// ============================================================

function zoomVertical(factor) {
    if (!chartInstance || !priceScaleRef) return;
    
    const currentMargins = priceScaleRef.options().scaleMargins || { top: 0.10, bottom: 0.10 };
    
    let newTop = currentMargins.top * factor;
    let newBottom = currentMargins.bottom * factor;
    
    newTop = Math.max(0.01, Math.min(0.40, newTop));
    newBottom = Math.max(0.01, Math.min(0.40, newBottom));
    
    priceScaleRef.applyOptions({
        scaleMargins: {
            top: newTop,
            bottom: newBottom,
        },
    });
}

// ============================================================
//  СБРОС ЗУМА
// ============================================================

function resetZoom() {
    if (!chartInstance) return;
    if (priceScaleRef) {
        priceScaleRef.applyOptions({
            scaleMargins: {
                top: 0.10,
                bottom: 0.10,
            },
        });
    }
    chartInstance.timeScale().fitContent();
}

// ============================================================
//  ЗАГРУЗКА СВЕЧЕЙ
// ============================================================

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
    safeDrawCandleChart();
}

// ============================================================
//  ПЕРЕКЛЮЧЕНИЕ ИНСТРУМЕНТА
// ============================================================

window.switchInstrument = async function(instrument) {
    STATE.currentInstrument = instrument;
    document.getElementById('instRTS').className = 'inst-btn' + (instrument === 'RTS' ? ' active' : '');
    document.getElementById('instSi').className = 'inst-btn' + (instrument === 'Si' ? ' active' : '');
    document.getElementById('chartTitle').textContent = '📈 ГРАФИК ' + instrument;
    if (STATE.minuteCandles[instrument].length === 0) {
        await loadMinuteCandles(instrument);
    }
    safeDrawCandleChart();
};

// ============================================================
//  ОБНОВЛЕНИЕ ТАЙМФРЕЙМА
// ============================================================

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
    safeDrawCandleChart();
}

// ============================================================
//  НАСТРОЙКА УПРАВЛЕНИЯ
// ============================================================

function setupChartControls() {
    // Кнопки таймфрейма
    document.querySelectorAll('#timeframeControls button[data-interval]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#timeframeControls button[data-interval]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            updateTimeframe(parseInt(this.dataset.interval));
        });
    });
    
    // Вертикальный зум
    document.getElementById('zoomInV')?.addEventListener('click', () => {
        zoomVertical(0.7);
    });
    document.getElementById('zoomOutV')?.addEventListener('click', () => {
        zoomVertical(1.3);
    });
    document.getElementById('zoomResetV')?.addEventListener('click', resetZoom);
    
    // Обработчик колесика мыши
    const container = document.getElementById('chart-container');
    if (container) {
        container.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const factor = e.deltaY > 0 ? 1.3 : 0.7;
                zoomVertical(factor);
            }
        }, { passive: false });
    }
    
    // Добавляем кнопку центрирования
    const controls = document.getElementById('timeframeControls');
    if (controls) {
        const centerBtn = document.createElement('button');
        centerBtn.id = 'centerChart';
        centerBtn.textContent = '🎯 Центр';
        centerBtn.title = 'Центрировать график';
        centerBtn.style.marginLeft = 'auto';
        centerBtn.onclick = centerChart;
        controls.appendChild(centerBtn);
    }
    
    console.log('✅ Управление графиком настроено');
}

// ============================================================
//  ЭКСПОРТ
// ============================================================

window.drawCandleChart = drawCandleChart;
window.safeDrawCandleChart = safeDrawCandleChart;
window.loadMinuteCandles = loadMinuteCandles;
window.setupChartControls = setupChartControls;
window.updateTimeframe = updateTimeframe;
window.centerChart = centerChart;
window.zoomVertical = zoomVertical;
window.resetZoom = resetZoom;

console.log('📊 chart-loader.js загружен');
