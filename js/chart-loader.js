// ============================================================
//  ГРАФИК (lightweight-charts) — ПОЛНАЯ ВЕРСИЯ
// ============================================================

let chartInstance = null;
let candlestickSeries = null;
let priceScaleRef = null;

// ============================================================
//  ПОЛУЧЕНИЕ БИБЛИОТЕКИ
// ============================================================

function getLibrary() {
    if (typeof LightweightCharts !== 'undefined') return LightweightCharts;
    if (typeof window.LightweightCharts !== 'undefined') return window.LightweightCharts;
    if (typeof window.lightweightCharts !== 'undefined') return window.lightweightCharts;
    if (typeof LW !== 'undefined') return LW;
    return null;
}

function isLibraryLoaded() {
    return getLibrary() !== null;
}

// ============================================================
//  БЕЗОПАСНАЯ ОТРИСОВКА
// ============================================================

function safeDrawCandleChart() {
    const lib = getLibrary();
    if (lib) {
        window._libraryLoaded = true;
        drawCandleChart();
        return true;
    } else {
        console.warn('⏳ Библиотека не загружена, откладываем отрисовку');
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

    const lib = getLibrary();
    if (!lib) {
        console.warn('⏳ Библиотека ещё не загружена');
        container.innerHTML = '<div style="color:#94a3b8;padding:20px;text-align:center;">⏳ Загрузка библиотеки графиков...</div>';
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
        
        chartInstance = lib.createChart(container, {
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
                autoScale: false,
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
    
    let currentMargins;
    try {
        currentMargins = priceScaleRef.options().scaleMargins || { top: 0.10, bottom: 0.10 };
    } catch (e) {
        currentMargins = { top: 0.10, bottom: 0.10 };
    }
    
    let newTop = currentMargins.top * factor;
    let newBottom = currentMargins.bottom * factor;
    
    newTop = Math.max(0.01, Math.min(0.45, newTop));
    newBottom = Math.max(0.01, Math.min(0.45, newBottom));
    
    try {
        priceScaleRef.applyOptions({
            scaleMargins: {
                top: newTop,
                bottom: newBottom,
            },
        });
        console.log(`📊 Зум: ${currentMargins.top.toFixed(3)} → ${newTop.toFixed(3)}`);
    } catch (e) {
        console.warn('Ошибка применения зума:', e);
    }
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
//  ЗАГРУЗКА СВЕЧЕЙ (ИСПРАВЛЕННАЯ)
// ============================================================

async function loadMinuteCandles(instrument = 'RTS') {
    console.log(`🔄 Загрузка данных для ${instrument}...`);
    
    // 1. Пробуем загрузить с MOEX
    const candles = await fetchMinuteCandles(instrument);
    
    if (candles && candles.length > 10) {
        STATE.minuteCandles[instrument] = candles;
        console.log(`✅ Загружено 1м свечей (${instrument}):`, candles.length);
    } else {
        // 2. Если MOEX не дал данные — генерируем тестовые
        const startPrice = instrument === 'RTS' ? 78000 : 88;
        STATE.minuteCandles[instrument] = generateTestCandles(200, startPrice, 1);
        console.log(`📊 Тестовые 1м свечи (${instrument})`);
    }
    
    // 3. ВСЕГДА обновляем STATE.candles из minuteCandles
    const minuteCandles = STATE.minuteCandles[instrument] || [];
    if (minuteCandles.length > 0) {
        // ВСЕГДА используем минутные данные для отображения
        STATE.candles[instrument] = minuteCandles.slice();
        
        // Ограничиваем количество для производительности
        if (STATE.candles[instrument].length > STATE.maxCandles) {
            STATE.candles[instrument] = STATE.candles[instrument].slice(-STATE.maxCandles);
        }
        
        console.log(`📊 ${instrument} свечей для графика:`, STATE.candles[instrument].length);
    }
    
    // 4. Если это текущий инструмент — перерисовываем
    if (STATE.currentInstrument === instrument) {
        drawCandleChart();
    }
}

// ============================================================
//  ПЕРЕКЛЮЧЕНИЕ ИНСТРУМЕНТА (ИСПРАВЛЕННОЕ)
// ============================================================

window.switchInstrument = async function(instrument) {
    STATE.currentInstrument = instrument;
    
    // Обновляем кнопки
    document.getElementById('instRTS').className = 'inst-btn' + (instrument === 'RTS' ? ' active' : '');
    document.getElementById('instSi').className = 'inst-btn' + (instrument === 'Si' ? ' active' : '');
    document.getElementById('chartTitle').textContent = '📈 ГРАФИК ' + instrument;
    
    // Проверяем, есть ли данные для этого инструмента
    if (!STATE.minuteCandles[instrument] || STATE.minuteCandles[instrument].length === 0) {
        await loadMinuteCandles(instrument);
    } else {
        // Данные есть — обновляем STATE.candles из minuteCandles
        const minuteCandles = STATE.minuteCandles[instrument] || [];
        if (minuteCandles.length > 0) {
            STATE.candles[instrument] = minuteCandles.slice();
            if (STATE.candles[instrument].length > STATE.maxCandles) {
                STATE.candles[instrument] = STATE.candles[instrument].slice(-STATE.maxCandles);
            }
            console.log(`📊 ${instrument} свечей для графика:`, STATE.candles[instrument].length);
        }
    }
    
    drawCandleChart();
};

// ============================================================
//  ОБНОВЛЕНИЕ ТАЙМФРЕЙМА
// ============================================================

function updateTimeframe(interval) {
    STATE.interval = interval;
    const inst = STATE.currentInstrument || 'RTS';
    const minuteCandles = STATE.minuteCandles[inst] || [];
    if (minuteCandles.length > 0) {
        // ВСЕГДА используем минутные данные
        STATE.candles[inst] = minuteCandles.slice();
        if (STATE.candles[inst].length > STATE.maxCandles) {
            STATE.candles[inst] = STATE.candles[inst].slice(-STATE.maxCandles);
        }
        console.log(`📊 ${inst} свечей для графика (таймфрейм ${interval}м):`, STATE.candles[inst].length);
    }
    drawCandleChart();
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
    
    // Зум колесиком
    const container = document.getElementById('chart-container');
    if (container) {
        let accumulatedDelta = 0;
        let zoomTimeout = null;
        const ZOOM_THRESHOLD = 0.2;
        
        container.addEventListener('wheel', function(e) {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                
                accumulatedDelta += e.deltaY;
                clearTimeout(zoomTimeout);
                
                if (Math.abs(accumulatedDelta) >= ZOOM_THRESHOLD) {
                    const factor = accumulatedDelta > 0 ? 1.2 : 0.8;
                    zoomVertical(factor);
                    accumulatedDelta = 0;
                }
                
                zoomTimeout = setTimeout(() => {
                    accumulatedDelta = 0;
                }, 150);
            }
        }, { passive: false });
        
        console.log('✅ Обработчик колесика добавлен');
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
window.getLibrary = getLibrary;
window.isLibraryLoaded = isLibraryLoaded;

console.log('📊 chart-loader.js загружен (ИСПРАВЛЕННАЯ ВЕРСИЯ)');
