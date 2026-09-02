// ============================================================
//  ГРАФИК (lightweight-charts) — ФИКСАЦИЯ ПРАВОГО КРАЯ
// ============================================================

let chartInstance = null;
let candlestickSeries = null;
let priceScaleRef = null;
let _resizeObserver = null;

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
//  ОСНОВНАЯ ФУНКЦИЯ ОТРИСОВКИ (С ФИКСАЦИЕЙ ПРАВОГО КРАЯ)
// ============================================================

function drawCandleChart() {
    const container = document.getElementById('chart-container');
    if (!container) {
        console.error('❌ Контейнер не найден');
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
                // ===== ГЛАВНОЕ: ФИКСИРУЕМ ПРАВЫЙ КРАЙ =====
                fixLeftEdge: false,   // Отключаем фиксацию левого края
                fixRightEdge: true,   // ВКЛЮЧАЕМ фиксацию правого края — график всегда показывает последнюю свечу!
                minBarSpacing: 0.5,
                rightOffset: 10,      // Отступ справа для видимости последней свечи
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
        if (_resizeObserver) {
            _resizeObserver.disconnect();
        }
        _resizeObserver = new ResizeObserver(() => {
            if (chartInstance && container) {
                const w = container.clientWidth || 600;
                const h = container.clientHeight || 500;
                chartInstance.applyOptions({
                    width: w,
                    height: h,
                });
            }
        });
        _resizeObserver.observe(container);
        
        console.log('✅ График создан с fixRightEdge=true');
    }

    // --- ОБНОВЛЕНИЕ ДАННЫХ ---
    if (candlestickSeries && data.length > 0) {
        try {
            candlestickSeries.setData(data);
            
            // ===== ВАЖНО: Применяем настройки, чтобы последняя свеча всегда была видна =====
            chartInstance.timeScale().applyOptions({
                fixRightEdge: true,
                rightOffset: 10,
            });
            
            // Центрируем график так, чтобы последняя свеча была справа
            chartInstance.timeScale().fitContent();
            
            if (priceScaleRef) {
                priceScaleRef.applyOptions({
                    scaleMargins: {
                        top: 0.10,
                        bottom: 0.10,
                    },
                });
            }
            
            console.log(`📊 График обновлен: ${data.length} свечей`);
        } catch (e) {
            console.warn('Ошибка обновления данных:', e);
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
    if (candles.length === 0) return [];
    
    return candles.map(c => ({
        time: Math.floor(c.time / 1000),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
    }));
}

// ============================================================
//  ЦЕНТРИРОВАНИЕ (С ФИКСАЦИЕЙ ПРАВОГО КРАЯ)
// ============================================================

function centerChart() {
    if (!chartInstance || !candlestickSeries) return;
    
    try {
        // Применяем настройки с фиксацией правого края
        chartInstance.timeScale().applyOptions({
            fixRightEdge: true,
            rightOffset: 10,
        });
        chartInstance.timeScale().fitContent();
        
        if (priceScaleRef) {
            priceScaleRef.applyOptions({
                scaleMargins: {
                    top: 0.10,
                    bottom: 0.10,
                },
            });
        }
        
        console.log('🎯 График центрирован (правый край зафиксирован)');
    } catch (e) {
        console.warn('Ошибка центрирования:', e);
    }
}

// ============================================================
//  ВЕРТИКАЛЬНЫЙ ЗУМ
// ============================================================

function zoomVertical(factor) {
    if (!chartInstance || !priceScaleRef) return;
    
    try {
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
        
        priceScaleRef.applyOptions({
            scaleMargins: {
                top: newTop,
                bottom: newBottom,
            },
        });
        
        console.log(`📊 Вертикальный зум: ${currentMargins.top.toFixed(3)} → ${newTop.toFixed(3)}`);
    } catch (e) {
        console.warn('Ошибка вертикального зума:', e);
    }
}

// ============================================================
//  СБРОС ЗУМА
// ============================================================

function resetZoom() {
    if (!chartInstance) return;
    
    try {
        if (priceScaleRef) {
            priceScaleRef.applyOptions({
                scaleMargins: {
                    top: 0.10,
                    bottom: 0.10,
                },
            });
        }
        chartInstance.timeScale().applyOptions({
            fixRightEdge: true,
            rightOffset: 10,
        });
        chartInstance.timeScale().fitContent();
        console.log('⟲ Зум сброшен');
    } catch (e) {
        console.warn('Ошибка сброса зума:', e);
    }
}

// ============================================================
//  ЗАГРУЗКА СВЕЧЕЙ
// ============================================================

async function loadMinuteCandles(instrument = 'RTS') {
    console.log(`🔄 Загрузка данных для ${instrument}...`);
    
    let candles = await fetchMinuteCandles(instrument);
    
    if (candles && candles.length > 10) {
        STATE.minuteCandles[instrument] = candles;
        console.log(`✅ Загружено ${candles.length} свечей (${instrument})`);
    } else {
        const startPrice = instrument === 'RTS' ? 78000 : 88;
        candles = generateTestCandles(300, startPrice, 1);
        STATE.minuteCandles[instrument] = candles;
        console.log(`📊 Сгенерировано ${candles.length} тестовых свечей (${instrument})`);
    }
    
    const minuteCandles = STATE.minuteCandles[instrument] || [];
    if (minuteCandles.length > 0) {
        STATE.candles[instrument] = minuteCandles.slice();
        if (STATE.candles[instrument].length > STATE.maxCandles) {
            STATE.candles[instrument] = STATE.candles[instrument].slice(-STATE.maxCandles);
        }
    }
    
    if (STATE.currentInstrument === instrument) {
        drawCandleChart();
    }
}

// ============================================================
//  ПЕРЕКЛЮЧЕНИЕ ИНСТРУМЕНТА
// ============================================================

window.switchInstrument = async function(instrument) {
    STATE.currentInstrument = instrument;
    
    document.getElementById('instRTS').className = 'inst-btn' + (instrument === 'RTS' ? ' active' : '');
    document.getElementById('instSi').className = 'inst-btn' + (instrument === 'Si' ? ' active' : '');
    document.getElementById('chartTitle').textContent = '📈 ГРАФИК ' + instrument;
    
    if (!STATE.minuteCandles[instrument] || STATE.minuteCandles[instrument].length === 0) {
        await loadMinuteCandles(instrument);
    } else {
        const minuteCandles = STATE.minuteCandles[instrument] || [];
        if (minuteCandles.length > 0) {
            STATE.candles[instrument] = minuteCandles.slice();
            if (STATE.candles[instrument].length > STATE.maxCandles) {
                STATE.candles[instrument] = STATE.candles[instrument].slice(-STATE.maxCandles);
            }
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
        if (interval === 1) {
            STATE.candles[inst] = minuteCandles.slice();
        } else {
            STATE.candles[inst] = aggregateCandles(minuteCandles, interval);
        }
        if (STATE.candles[inst].length > STATE.maxCandles) {
            STATE.candles[inst] = STATE.candles[inst].slice(-STATE.maxCandles);
        }
    }
    
    drawCandleChart();
}

// ============================================================
//  НАСТРОЙКА УПРАВЛЕНИЯ
// ============================================================

function setupChartControls() {
    document.querySelectorAll('#timeframeControls button[data-interval]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#timeframeControls button[data-interval]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            updateTimeframe(parseInt(this.dataset.interval));
        });
    });
    
    document.getElementById('zoomInV')?.addEventListener('click', () => {
        zoomVertical(0.7);
    });
    document.getElementById('zoomOutV')?.addEventListener('click', () => {
        zoomVertical(1.3);
    });
    document.getElementById('zoomResetV')?.addEventListener('click', resetZoom);
    
    const container = document.getElementById('chart-container');
    if (container) {
        container.removeEventListener('wheel', handleWheel);
        container.addEventListener('wheel', handleWheel, { passive: false });
    }
    
    const controls = document.getElementById('timeframeControls');
    if (controls) {
        let centerBtn = document.getElementById('centerChart');
        if (!centerBtn) {
            centerBtn = document.createElement('button');
            centerBtn.id = 'centerChart';
            centerBtn.textContent = '🎯 Центр';
            centerBtn.title = 'Центрировать график';
            centerBtn.style.marginLeft = 'auto';
            controls.appendChild(centerBtn);
        }
        centerBtn.onclick = centerChart;
    }
    
    console.log('✅ Управление графиком настроено');
}

let accumulatedDelta = 0;
let zoomTimeout = null;
const ZOOM_THRESHOLD = 0.2;

function handleWheel(e) {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        
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

console.log('📊 chart-loader.js загружен (ФИКСАЦИЯ ПРАВОГО КРАЯ)');
