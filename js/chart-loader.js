// ============================================================
//  ГРАФИК (lightweight-charts) — ИСПРАВЛЕННАЯ ВЕРСИЯ
// ============================================================

let chartInstance = null;
let candlestickSeries = null;
let priceScaleRef = null;

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
                // ВАЖНО: scaleMargins для центрирования
                scaleMargins: {
                    top: 0.08,   // Отступ сверху (8%)
                    bottom: 0.08, // Отступ снизу (8%)
                },
                autoScale: true,
            },
            // ВАЖНО: включить авто-масштабирование
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

        // Сохраняем ссылку на priceScale
        priceScaleRef = chartInstance.priceScale();
        
        // Добавляем серию свечей
        candlestickSeries = chartInstance.addCandlestickSeries({
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
            // ВАЖНО: настройка ширины свечей
            priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
            },
        });

        // --- ОБРАБОТЧИК РЕСАЙЗА ---
        const resizeObserver = new ResizeObserver(() => {
            if (chartInstance && container) {
                const w = container.clientWidth || 600;
                const h = container.clientHeight || 500;
                chartInstance.applyOptions({
                    width: w,
                    height: h,
                });
                // Авто-масштабирование после ресайза
                if (candlestickSeries) {
                    chartInstance.timeScale().fitContent();
                }
            }
        });
        resizeObserver.observe(container);
        window._resizeObserver = resizeObserver;
        
        console.log('✅ График создан с центрированием');
    }

    // --- ОБНОВЛЕНИЕ ДАННЫХ ---
    if (candlestickSeries) {
        candlestickSeries.setData(data);
        // ВАЖНО: авто-масштабирование для нормального отображения свечей
        chartInstance.timeScale().fitContent();
        
        // Принудительно обновляем priceScale для центрирования
        if (priceScaleRef) {
            priceScaleRef.applyOptions({
                scaleMargins: {
                    top: 0.08,
                    bottom: 0.08,
                },
            });
        }
    }

    // Обновляем информацию
    document.getElementById('candleCount').textContent = data.length;
    document.getElementById('timeframeLabel').textContent =
        STATE.interval < 60 ? STATE.interval + 'м' : (STATE.interval / 60) + 'ч';
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

// Функция для центрирования графика
function centerChart() {
    if (chartInstance && candlestickSeries) {
        chartInstance.timeScale().fitContent();
        if (priceScaleRef) {
            priceScaleRef.applyOptions({
                scaleMargins: {
                    top: 0.08,
                    bottom: 0.08,
                },
            });
        }
    }
}

// Вертикальный зум с центрированием
function zoomVertical(factor) {
    if (!chartInstance || !priceScaleRef) return;
    
    // Получаем текущие маржи
    const currentMargins = priceScaleRef.options().scaleMargins || { top: 0.08, bottom: 0.08 };
    
    // Меняем маржи для центрирования
    const newTop = Math.max(0.01, Math.min(0.4, currentMargins.top * factor));
    const newBottom = Math.max(0.01, Math.min(0.4, currentMargins.bottom * factor));
    
    priceScaleRef.applyOptions({
        scaleMargins: {
            top: newTop,
            bottom: newBottom,
        },
    });
}

// Горизонтальный зум
function zoomHorizontal(factor) {
    if (!chartInstance) return;
    const timeScale = chartInstance.timeScale();
    const currentRange = timeScale.getVisibleRange();
    if (!currentRange) return;
    
    const from = currentRange.from;
    const to = currentRange.to;
    const mid = (from + to) / 2;
    const halfRange = (to - from) / 2 * factor;
    
    timeScale.setVisibleRange({
        from: mid - halfRange,
        to: mid + halfRange,
    });
}

// Сброс всех масштабов
function resetZoom() {
    if (!chartInstance) return;
    if (priceScaleRef) {
        priceScaleRef.applyOptions({
            scaleMargins: {
                top: 0.08,
                bottom: 0.08,
            },
        });
    }
    chartInstance.timeScale().fitContent();
}

// ===== ЗАГРУЗКА ДАННЫХ =====

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

// ===== ПЕРЕКЛЮЧЕНИЕ ИНСТРУМЕНТА =====

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

// ===== ОБНОВЛЕНИЕ ТАЙМФРЕЙМА =====

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

// ===== НАСТРОЙКА УПРАВЛЕНИЯ =====

function setupChartControls() {
    // Кнопки таймфрейма
    document.querySelectorAll('#timeframeControls button[data-interval]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#timeframeControls button[data-interval]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            updateTimeframe(parseInt(this.dataset.interval));
        });
    });
    
    // Вертикальный зум с центрированием
    document.getElementById('zoomInV')?.addEventListener('click', () => {
        zoomVertical(0.7); // Уменьшаем маржи -> увеличиваем масштаб
    });
    document.getElementById('zoomOutV')?.addEventListener('click', () => {
        zoomVertical(1.3); // Увеличиваем маржи -> уменьшаем масштаб
    });
    document.getElementById('zoomResetV')?.addEventListener('click', resetZoom);
    
    // Обработчик колесика мыши для горизонтального зума
    const container = document.getElementById('chart-container');
    if (container) {
        container.addEventListener('wheel', (e) => {
            // Если зажат Ctrl - вертикальный зум
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const factor = e.deltaY > 0 ? 1.3 : 0.7;
                zoomVertical(factor);
            } else {
                // Горизонтальный зум через timeScale работает автоматически
                // Но мы можем добавить дополнительную логику
                const timeScale = chartInstance?.timeScale();
                if (timeScale) {
                    // Предотвращаем слишком сильный зум
                    const range = timeScale.getVisibleRange();
                    if (range) {
                        const width = range.to - range.from;
                        if (width < 60) {
                            // Если слишком маленький интервал, центрируем
                            setTimeout(centerChart, 100);
                        }
                    }
                }
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
        centerBtn.onclick = centerChart;
        controls.appendChild(centerBtn);
    }
    
    console.log('✅ Управление графиком настроено (с центрированием)');
}

// Экспортируем функции
window.drawCandleChart = drawCandleChart;
window.loadMinuteCandles = loadMinuteCandles;
window.setupChartControls = setupChartControls;
window.updateTimeframe = updateTimeframe;
window.centerChart = centerChart;
window.zoomVertical = zoomVertical;
window.zoomHorizontal = zoomHorizontal;
window.resetZoom = resetZoom;

console.log('📊 chart-loader.js загружен (исправленная версия)');
