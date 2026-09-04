// ============================================================
//  ОТРИСОВКА ИНТЕРФЕЙСА (С ДНЕВНОЙ СТАТИСТИКОЙ)
// ============================================================

function render() {
    // Проверяем смену дня
    if (typeof resetDailyStats === 'function') {
        resetDailyStats();
    }
    
    const s = STATE.stats;
    const daily = STATE.dailyStats;
    const winRate = s.total ? Math.round((s.wins / s.total) * 100) : 0;
    const dailyWinRate = daily.total ? Math.round((daily.wins / daily.total) * 100) : 0;
    const profit = Math.round(s.profit * 100) / 100;
    const dailyProfit = Math.round(daily.profit * 100) / 100;

    // Баланс и котировки
    document.getElementById('balanceDisplay').textContent = Math.round(STATE.balance) + ' ₽';
    document.getElementById('rtsQuote').textContent = `RTS: ${STATE.quotes.RTS.price ? STATE.quotes.RTS.price.toFixed(2) : '--'}`;
    document.getElementById('siQuote').textContent = `Si: ${STATE.quotes.Si.price ? STATE.quotes.Si.price.toFixed(2) : '--'}`;

    // ОБЩАЯ СТАТИСТИКА
    document.getElementById('totalTrades').textContent = s.total;
    document.getElementById('winRate').textContent = winRate + '%';
    document.getElementById('totalProfit').textContent = (profit > 0 ? '+' : '') + profit + ' ₽';
    document.getElementById('totalProfit').className = 'value ' + (profit >= 0 ? 'green' : 'red');

    // ДНЕВНАЯ СТАТИСТИКА
    const dailyEl = document.getElementById('dailyStats');
    if (dailyEl) {
        dailyEl.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:4px;">
                <div class="stat-item" style="background:#0f172a;padding:4px 8px;border-radius:4px;text-align:center;">
                    <div style="font-size:14px;font-weight:bold;color:#e2e8f0;">${daily.total}</div>
                    <div style="font-size:9px;color:#94a3b8;">Сделок (сегодня)</div>
                </div>
                <div class="stat-item" style="background:#0f172a;padding:4px 8px;border-radius:4px;text-align:center;">
                    <div style="font-size:14px;font-weight:bold;color:${dailyWinRate >= 50 ? '#22c55e' : '#ef4444'};">${dailyWinRate}%</div>
                    <div style="font-size:9px;color:#94a3b8;">Win Rate (сегодня)</div>
                </div>
                <div class="stat-item" style="background:#0f172a;padding:4px 8px;border-radius:4px;text-align:center;">
                    <div style="font-size:14px;font-weight:bold;color:${dailyProfit >= 0 ? '#22c55e' : '#ef4444'};">${(dailyProfit > 0 ? '+' : '') + dailyProfit} ₽</div>
                    <div style="font-size:9px;color:#94a3b8;">P&L (сегодня)</div>
                </div>
            </div>
        `;
    }

    // Кнопки стратегий
    const rtsBtn = document.getElementById('rtsBtn');
    const siBtn = document.getElementById('siBtn');
    rtsBtn.textContent = (STATE.strategies.RTS ? '⏹' : '▶') + ' RTS';
    rtsBtn.className = 'strategy-btn ' + (STATE.strategies.RTS ? 'active' : 'inactive');
    siBtn.textContent = (STATE.strategies.Si ? '⏹' : '▶') + ' Si';
    siBtn.className = 'strategy-btn ' + (STATE.strategies.Si ? 'active' : 'inactive');
    document.getElementById('strategyStatus').textContent = 
        (STATE.strategies.RTS || STATE.strategies.Si) ? '🟢 Активны' : '⏸ Остановлены';

    // Открытые позиции
    renderOpenPositions();

    // Закрытые сделки (только за сегодня)
    renderClosedTrades();

    // Текущая цена
    const inst = STATE.currentInstrument || 'RTS';
    const quote = STATE.quotes[inst];
    if (quote && quote.price > 0) {
        document.getElementById('currentPrice').textContent = quote.price.toFixed(2);
        const change = quote.change || 0;
        const changeEl = document.getElementById('priceChange');
        changeEl.textContent = (change > 0 ? '+' : '') + change.toFixed(2) + '%';
        changeEl.className = 'change ' + (change >= 0 ? 'positive' : 'negative');
    } else {
        document.getElementById('currentPrice').textContent = '--';
        document.getElementById('priceChange').textContent = '--';
        document.getElementById('priceChange').className = 'change';
    }

    // График
    if (typeof safeDrawCandleChart === 'function') {
        safeDrawCandleChart();
    } else if (typeof drawCandleChart === 'function') {
        drawCandleChart();
    }
}

// ============================================================
//  ОТРИСОВКА ОТКРЫТЫХ ПОЗИЦИЙ
// ============================================================

function renderOpenPositions() {
    const container = document.getElementById('openPositionsBody');
    if (!container) return;

    const positions = STATE.positions;
    const hasPositions = Object.values(positions).some(p => p !== null);

    if (!hasPositions) {
        container.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#475569;padding:10px 0;">Нет открытых позиций</td></tr>';
        return;
    }

    let html = '';
    for (const [instrument, pos] of Object.entries(positions)) {
        if (!pos) continue;

        const currentPrice = STATE.quotes[instrument]?.price || pos.entry;
        const profit = pos.side === 'buy' 
            ? currentPrice - pos.entry 
            : pos.entry - currentPrice;
        const profitStr = (profit > 0 ? '+' : '') + profit.toFixed(2);
        const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
        const sideLabel = pos.side === 'buy' ? 'LONG' : 'SHORT';
        const sideClass = pos.side === 'buy' ? 'buy' : 'sell';

        const openTime = pos.openTime ? new Date(pos.openTime).toLocaleTimeString() : '--:--:--';

        html += `
            <tr>
                <td>${openTime}</td>
                <td>${instrument}</td>
                <td><span class="badge ${sideClass}">${sideLabel}</span></td>
                <td>${pos.entry.toFixed(2)}</td>
                <td>${currentPrice.toFixed(2)}</td>
                <td style="text-align:right;font-weight:bold;" class="${profitClass}">${profitStr}</td>
            </tr>
        `;
    }

    container.innerHTML = html;
}

// ============================================================
//  ОТРИСОВКА ЗАКРЫТЫХ СДЕЛОК (ТОЛЬКО ЗА СЕГОДНЯ)
// ============================================================

function renderClosedTrades() {
    const tbody = document.getElementById('tradesBody');
    if (!tbody) return;

    // Берем только закрытые сделки за сегодня
    const today = new Date().toDateString();
    const closedTrades = STATE.trades.filter(t => 
        t.profit !== undefined && 
        t.profit !== null && 
        typeof t.profit === 'number' &&
        t.side !== 'ВХОД LONG' && 
        t.side !== 'ВХОД SHORT' &&
        new Date(t.timestamp).toDateString() === today
    );

    if (closedTrades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#475569;padding:10px 0;">Нет закрытых сделок за сегодня</td></tr>';
        return;
    }

    const trades = closedTrades.slice(-15).reverse();
    
    tbody.innerHTML = trades.map(t => `
        <tr>
            <td>${t.timeStr || new Date(t.timestamp).toLocaleTimeString()}</td>
            <td>${t.instrument}</td>
            <td><span class="badge ${t.side === 'buy' ? 'buy' : 'sell'}">${t.side === 'buy' ? 'Покуп' : 'Продаж'}</span></td>
            <td>${t.price.toFixed(2)}</td>
            <td style="text-align:right;font-weight:bold;" class="${t.profit >= 0 ? 'profit-positive' : 'profit-negative'}">${t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}</td>
        </tr>
    `).join('');
}

// ============================================================
//  УПРАВЛЕНИЕ СТРАТЕГИЯМИ
// ============================================================

function toggleStrategy(instrument) {
    STATE.strategies[instrument] = !STATE.strategies[instrument];
    render();
}

// ============================================================
//  ЭКСПОРТ В EXCEL (ТОЛЬКО ЗА СЕГОДНЯ)
// ============================================================

async function exportToExcel() {
    try {
        if (typeof XLSX === 'undefined') {
            await loadScript('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js');
        }

        const today = new Date().toDateString();
        const closedTrades = STATE.trades.filter(t => 
            t.profit !== undefined && 
            t.profit !== null && 
            typeof t.profit === 'number' &&
            t.side !== 'ВХОД LONG' && 
            t.side !== 'ВХОД SHORT' &&
            new Date(t.timestamp).toDateString() === today
        );

        const s = STATE.stats;
        const daily = STATE.dailyStats;
        const winRate = s.total ? Math.round((s.wins / s.total) * 100) : 0;
        const dailyWinRate = daily.total ? Math.round((daily.wins / daily.total) * 100) : 0;
        const profit = Math.round(s.profit * 100) / 100;
        const dailyProfit = Math.round(daily.profit * 100) / 100;
        const total = s.total || 0;

        const statsData = [
            ['ПОКАЗАТЕЛЬ', 'ЗНАЧЕНИЕ'],
            ['Дата отчёта', new Date().toLocaleString()],
            ['Инструмент', STATE.currentInstrument || 'RTS/Si'],
            ['Начальный баланс', 100000],
            ['Текущий баланс', Math.round(STATE.balance)],
            ['', ''],
            ['=== ОБЩАЯ СТАТИСТИКА ===', ''],
            ['Общий профит', profit],
            ['Всего сделок (закрытых)', total],
            ['Прибыльных сделок', s.wins],
            ['Убыточных сделок', s.losses],
            ['Win Rate (%)', winRate],
            ['Средний профит', total > 0 ? (s.wins > 0 ? (s.profit / s.wins).toFixed(2) : 0) : 0],
            ['Средний убыток', total > 0 ? (s.losses > 0 ? (Math.abs(s.profit) / s.losses).toFixed(2) : 0) : 0],
            ['Профит-фактор', total > 0 ? (s.wins / (s.losses || 1)).toFixed(2) : 0],
            ['', ''],
            ['=== ДНЕВНАЯ СТАТИСТИКА ===', ''],
            ['Дата', today],
            ['P&L за сегодня', dailyProfit],
            ['Сделок за сегодня', daily.total],
            ['Win Rate за сегодня', dailyWinRate + '%'],
        ];

        const tradesData = [
            ['№', 'Время', 'Инструмент', 'Направление', 'Цена', 'P&L (₽)']
        ];
        closedTrades.forEach((t, i) => {
            tradesData.push([
                i + 1,
                t.timeStr || new Date(t.timestamp).toLocaleTimeString(),
                t.instrument || 'RTS',
                t.side === 'buy' ? 'Покупка' : 'Продажа',
                t.price || '--',
                t.profit || 0
            ]);
        });

        const strategyData = [
            ['ПАРАМЕТР', 'RTS', 'Si'],
            ['Тип стратегии', 'Импульсный пробой', 'Отскок от уровней'],
            ['Тейк-профит', '120 пунктов', '70 пунктов'],
            ['Стоп-лосс', '45 пунктов', '25 пунктов'],
            ['Активна', STATE.strategies.RTS ? '✅' : '❌', STATE.strategies.Si ? '✅' : '❌'],
        ];

        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.aoa_to_sheet(statsData);
        const ws2 = XLSX.utils.aoa_to_sheet(tradesData);
        const ws3 = XLSX.utils.aoa_to_sheet(strategyData);

        ws1['!cols'] = [{ wch: 30 }, { wch: 20 }];
        ws2['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
        ws3['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 20 }];

        XLSX.utils.book_append_sheet(wb, ws1, 'Статистика');
        XLSX.utils.book_append_sheet(wb, ws2, 'Закрытые сделки');
        XLSX.utils.book_append_sheet(wb, ws3, 'Стратегии');

        const filename = `trading_report_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        console.log(`✅ Отчёт сохранён: ${filename} (${closedTrades.length} сделок за сегодня)`);
        
    } catch (e) {
        console.error('❌ Ошибка экспорта:', e);
        alert('Ошибка экспорта. Проверьте интернет и попробуйте снова.');
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ============================================================
//  ЭКСПОРТ
// ============================================================

window.render = render;
window.renderOpenPositions = renderOpenPositions;
window.renderClosedTrades = renderClosedTrades;
window.toggleStrategy = toggleStrategy;
window.exportToExcel = exportToExcel;

console.log('📋 ui.js загружен (с дневной статистикой)');
