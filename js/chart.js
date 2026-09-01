// ============================================================
//  ГРАФИК (ОТРИСОВКА, ЗУМ, ДРАГ)
// ============================================================

let chartState = {
    isDragging: false,
    dragStartX: 0,
    dragStartOffset: 0,
};

function getOptimalCandleCount() {
    const container = document.getElementById('chart-container');
    if (!container) return 60;
    const width = container.getBoundingClientRect().width;
    return Math.max(20, Math.floor(width / 10));
}

function aggregateCandles(minuteCandles, targetInterval) {
    if (!minuteCandles || minuteCandles.length === 0) return [];
    const result = [];
    const step = targetInterval;
    for (let i = 0; i < minuteCandles.length; i += step) {
        const group = minuteCandles.slice(i, i + step);
        if (group.length === 0) continue;
        result.push({
            time: group[0].time,
            open: group[0].open,
            high: Math.max(...group.map(c => c.high)),
            low: Math.min(...group.map(c => c.low)),
            close: group[group.length - 1].close,
        });
    }
    return result;
}

function drawCandleChart() {
    const canvas = document.getElementById('candleChart');
    if (!canvas) return;
    
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    const W = rect.width;
    const H = rect.height;
    const pad = { top: 20, bottom: 25, left: 55, right: 20 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);
    
    const inst = STATE.currentInstrument || 'RTS';
    let candles = STATE.candles[inst] || [];
    if (candles.length === 0) {
        ctx.fillStyle = '#475569';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Загрузка данных...', W/2, H/2);
        return;
    }

    // ========== 1. РАСЧЁТ КОЛИЧЕСТВА ВИДИМЫХ СВЕЧЕЙ ==========
    const baseCandles = getOptimalCandleCount();
    let visibleCandles = Math.floor(baseCandles / STATE.zoomLevel);
    visibleCandles = Math.max(10, Math.min(candles.length, visibleCandles));
    
    // ========== 2. РАСЧЁТ ИНДЕКСОВ С УЧЁТОМ OFFSET ==========
    let startIdx = Math.max(0, candles.length - visibleCandles - STATE.offset);
    let endIdx = Math.min(candles.length, startIdx + visibleCandles);
    
    if (endIdx - startIdx < visibleCandles) {
        startIdx = Math.max(0, candles.length - visibleCandles);
        endIdx = candles.length;
    }
    
    const visible = candles.slice(startIdx, endIdx);
    STATE.visibleCandles = visible;
    
    if (visible.length < 2) {
        ctx.fillStyle = '#475569';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Недостаточно данных', W/2, H/2);
        return;
    }

    // ========== 3. РАСЧЁТ ДИАПАЗОНА ЦЕН ==========
    let min = Infinity, max = -Infinity;
    visible.forEach(c => {
        if (c.low < min) min = c.low;
        if (c.high > max) max = c.high;
    });
    
    const range = max - min || 1;
    
    // ⚠️ МИНИМАЛЬНЫЙ ДИАПАЗОН ДЛЯ ВЫСОТЫ СВЕЧЕЙ
    // Если диапазон слишком маленький, растягиваем его
    const minRange = inst === 'RTS' ? 50 : 0.5;  // RTS: минимум 50 пунктов, Si: минимум 0.5 пункта
    const finalRange = Math.max(range, minRange);
    
    // Центр графика
    const center = (max + min) / 2;
    const halfRange = finalRange * 0.6;
    
    let priceMin = center - halfRange;
    let priceMax = center + halfRange;
    
    // ========== 4. ВЕРТИКАЛЬНЫЙ ЗУМ (с сохранением центра) ==========
    const verticalZoom = STATE.verticalZoom || 1;
    const zoomedRange = (priceMax - priceMin) / verticalZoom;
    priceMin = center - zoomedRange / 2;
    priceMax = center + zoomedRange / 2;
    
    const padding = (priceMax - priceMin) * 0.05;
    priceMin -= padding;
    priceMax += padding;

    // ========== 5. СЕТКА ==========
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
        const y = pad.top + (i / 4) * chartH;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(W - pad.right, y);
        ctx.stroke();
        
        const price = priceMax - (i / 4) * (priceMax - priceMin);
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(price.toFixed(2), pad.left - 5, y + 3);
    }

    // ========== 6. РАСЧЁТ ШИРИНЫ СВЕЧЕЙ ==========
    let candleWidth = (chartW / visible.length) * 0.75;
    candleWidth = Math.max(4, Math.min(20, candleWidth));
    const gap = Math.max(0.5, (chartW / visible.length) - candleWidth);
    
    // ========== 7. РИСОВАНИЕ СВЕЧЕЙ ==========
    visible.forEach((c, i) => {
        const x = pad.left + (i / visible.length) * chartW + gap/2;
        const yHigh = pad.top + chartH - ((c.high - priceMin) / (priceMax - priceMin)) * chartH;
        const yLow = pad.top + chartH - ((c.low - priceMin) / (priceMax - priceMin)) * chartH;
        const yOpen = pad.top + chartH - ((c.open - priceMin) / (priceMax - priceMin)) * chartH;
        const yClose = pad.top + chartH - ((c.close - priceMin) / (priceMax - priceMin)) * chartH;
        
        const isGreen = c.close >= c.open;
        ctx.fillStyle = isGreen ? '#22c55e' : '#ef4444';
        ctx.strokeStyle = isGreen ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 1;
        
        // Тень
        ctx.beginPath();
        ctx.moveTo(x + candleWidth/2, yHigh);
        ctx.lineTo(x + candleWidth/2, yLow);
        ctx.stroke();
        
        // Тело
        const bodyY = Math.min(yOpen, yClose);
        const bodyH = Math.max(Math.abs(yClose - yOpen), 1);
        ctx.fillRect(x, bodyY, candleWidth, bodyH);
    });

    // ========== 8. МЕТКИ СДЕЛОК ==========
    STATE.trades.forEach(t => {
        if (t.instrument !== inst) return;
        
        const tTime = new Date(t.timestamp).getTime();
        let candleIdx = -1;
        let minDiff = Infinity;
        
        visible.forEach((c, i) => {
            const diff = Math.abs(c.time - tTime);
            if (diff < minDiff) {
                minDiff = diff;
                candleIdx = i;
            }
        });
        
        if (candleIdx === -1 || minDiff > 60000 * STATE.interval) return;
        
        const c = visible[candleIdx];
        const x = pad.left + (candleIdx / visible.length) * chartW + candleWidth/2;
        const y = pad.top + chartH - ((c.close - priceMin) / (priceMax - priceMin)) * chartH;
        
        ctx.fillStyle = t.side === 'buy' ? '#22c55e' : '#ef4444';
        ctx.beginPath();
        if (t.side === 'buy') {
            ctx.moveTo(x, y - 14);
            ctx.lineTo(x - 7, y - 4);
            ctx.lineTo(x + 7, y - 4);
        } else {
            ctx.moveTo(x, y + 14);
            ctx.lineTo(x - 7, y + 4);
            ctx.lineTo(x + 7, y + 4);
        }
        ctx.closePath();
        ctx.fill();
    });

    // ========== 9. ПОСЛЕДНЯЯ ЦЕНА ==========
    if (visible.length > 0) {
        const last = visible[visible.length-1];
        const lastY = pad.top + chartH - ((last.close - priceMin) / (priceMax - priceMin)) * chartH;
        ctx.fillStyle = '#22c55e';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(last.close.toFixed(2), pad.left + chartW - 60, lastY - 8);
    }

    // ========== 10. ВРЕМЕНА ==========
    ctx.fillStyle = '#64748b';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    
    const step = Math.max(1, Math.floor(visible.length / 8));
    for (let i = 0; i < visible.length; i += step) {
        const x = pad.left + (i / visible.length) * chartW + candleWidth/2;
        const t = new Date(visible[i].time);
        const label = t.getHours() + ':' + String(t.getMinutes()).padStart(2, '0');
        ctx.fillText(label, x, H - 5);
    }
    
    document.getElementById('candleCount').textContent = visible.length;
    document.getElementById('timeframeLabel').textContent = 
        STATE.interval < 60 ? STATE.interval + 'м' : (STATE.interval/60) + 'ч';
}

function setupChartControls() {
    const canvas = document.getElementById('candleChart');
    if (!canvas) return;
    
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            // Вертикальный зум
            const delta = e.deltaY > 0 ? -0.15 : 0.15;
            const newZoom = (STATE.verticalZoom || 1) + delta;
            STATE.verticalZoom = Math.max(0.2, Math.min(10, newZoom));
            drawCandleChart();
        } else {
            // Горизонтальный зум
            const delta = e.deltaY > 0 ? -0.15 : 0.15;
            const newZoom = STATE.zoomLevel + delta;
            STATE.zoomLevel = Math.max(0.1, Math.min(10, newZoom));
            drawCandleChart();
        }
    }, { passive: false });
    
    canvas.addEventListener('mousedown', (e) => {
        chartState.isDragging = true;
        chartState.dragStartX = e.clientX;
        chartState.dragStartOffset = STATE.offset;
        canvas.style.cursor = 'grabbing';
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!chartState.isDragging) return;
        const dx = e.clientX - chartState.dragStartX;
        const dragOffset = Math.round(dx / 2);
        STATE.offset = Math.max(0, chartState.dragStartOffset - dragOffset);
        drawCandleChart();
    });
    
    window.addEventListener('mouseup', () => {
        if (chartState.isDragging) {
            chartState.isDragging = false;
            canvas.style.cursor = 'grab';
        }
    });
    
    document.querySelectorAll('#timeframeControls button[data-interval]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#timeframeControls button[data-interval]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            STATE.interval = parseInt(btn.dataset.interval);
            STATE.zoomLevel = 1;
            STATE.verticalZoom = 1;
            STATE.offset = 0;
            
            const inst = STATE.currentInstrument || 'RTS';
            const minuteCandles = STATE.minuteCandles[inst] || [];
            if (minuteCandles.length > 0) {
                if (STATE.interval === 1) {
                    STATE.candles[inst] = minuteCandles;
                } else {
                    STATE.candles[inst] = aggregateCandles(minuteCandles, STATE.interval);
                }
                if (STATE.candles[inst].length > STATE.maxCandles) {
                    STATE.candles[inst] = STATE.candles[inst].slice(-STATE.maxCandles);
                }
            }
            drawCandleChart();
        });
    });
    
    document.getElementById('zoomInV').addEventListener('click', () => {
        STATE.verticalZoom = Math.min(10, (STATE.verticalZoom || 1) + 0.25);
        drawCandleChart();
    });
    document.getElementById('zoomOutV').addEventListener('click', () => {
        STATE.verticalZoom = Math.max(0.2, (STATE.verticalZoom || 1) - 0.25);
        drawCandleChart();
    });
    document.getElementById('zoomResetV').addEventListener('click', () => {
        STATE.verticalZoom = 1;
        drawCandleChart();
    });
}

window.switchInstrument = async function(instrument) {
    STATE.currentInstrument = instrument;
    STATE.zoomLevel = 1;
    STATE.verticalZoom = 1;
    STATE.offset = 0;
    
    document.getElementById('instRTS').className = 'inst-btn' + (instrument === 'RTS' ? ' active' : '');
    document.getElementById('instSi').className = 'inst-btn' + (instrument === 'Si' ? ' active' : '');
    document.getElementById('chartTitle').textContent = '📈 ГРАФИК ' + instrument;
    
    if (STATE.minuteCandles[instrument].length === 0) {
        await loadMinuteCandles(instrument);
    }
    const minuteCandles = STATE.minuteCandles[instrument] || [];
    if (minuteCandles.length > 0) {
        if (STATE.interval === 1) {
            STATE.candles[instrument] = minuteCandles;
        } else {
            STATE.candles[instrument] = aggregateCandles(minuteCandles, STATE.interval);
        }
        if (STATE.candles[instrument].length > STATE.maxCandles) {
            STATE.candles[instrument] = STATE.candles[instrument].slice(-STATE.maxCandles);
        }
    }
    drawCandleChart();
};

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
        if (STATE.interval === 1) {
            STATE.candles[instrument] = minuteCandles;
        } else {
            STATE.candles[instrument] = aggregateCandles(minuteCandles, STATE.interval);
        }
        if (STATE.candles[instrument].length > STATE.maxCandles) {
            STATE.candles[instrument] = STATE.candles[instrument].slice(-STATE.maxCandles);
        }
    }
    drawCandleChart();
}
