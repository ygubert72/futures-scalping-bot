// ============================================================
//  ОТРИСОВКА ИНТЕРФЕЙСА (С ПРОФЕССИОНАЛЬНЫМИ ДАННЫМИ)
// ============================================================

function render() {
    resetDailyStats();
    
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

    // Общая статистика
    document.getElementById('totalTrades').textContent = s.total;
    document.getElementById('winRate').textContent = winRate + '%';
    document.getElementById('winRate').className = 'value ' + (winRate >= 40 ? 'green' : 'red');
    document.getElementById('totalProfit').textContent = (profit > 0 ? '+' : '') + profit + ' ₽';
    document.getElementById('totalProfit').className = 'value ' + (profit >= 0 ? 'green' : 'red');

    // Дневная статистика
    const dailyEl = document.getElementById('dailyStats');
    if (dailyEl) {
        const drawdown = daily.maxDrawdown || 0;
        dailyEl.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;margin-top:4px;">
                <div class="stat-item" style="background:#0f172a;padding:4px 8px;border-radius:4px;text-align:center;">
                    <div style="font-size:14px;font-weight:bold;color:#e2e8f0;">${daily.total}</div>
                    <div style="font-size:9px;color:#94a3b8;">Сделок</div>
                </div>
                <div class="stat-item" style="background:#0f172a;padding:4px 8px;border-radius:4px;text-align:center;">
                    <div style="font-size:14px;font-weight:bold;color:${dailyWinRate >= 40 ? '#22c55e' : '#ef4444'};">${dailyWinRate}%</div>
                    <div style="font-size:9px;color:#94a3b8;">Win Rate</div>
                </div>
                <div class="stat-item" style="background:#0f172a;padding:4px 8px;border-radius:4px;text-align:center;">
                    <div style="font-size:14px;font-weight:bold;color:${dailyProfit >= 0 ? '#22c55e' : '#ef4444'};">${(dailyProfit > 0 ? '+' : '') + dailyProfit} ₽</div>
                    <div style="font-size:9px;color:#94a3b8;">P&L</div>
                </div>
                <div class="stat-item" style="background:#0f172a;padding:4px 8px;border-radius:4px;text-align:center;">
                    <div style="font-size:14px;font-weight:bold;color:${drawdown < 5 ? '#22c55e' : '#ef4444'};">${drawdown.toFixed(1)}%</div>
                    <div style="font-size:9px;color:#94a3b8;">Просадка</div>
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
    
    const statusEl = document.getElementById('strategyStatus');
    if (STATE.strategies.RTS || STATE.strategies.Si) {
        const config = window.PROFESSIONAL_CONFIG || {};
        statusEl.textContent = `🟢 Активны (макс. ${config.maxDailyTrades || 8} сделок/день)`;
        statusEl.style.color = '#22c55e';
    } else {
        statusEl.textContent = '⏸ Остановлены';
        statusEl.style.color = '#94a3b8';
    }

    // Открытые позиции
    renderOpenPositions();

    // Закрытые сделки (за сегодня)
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
    }

    // График
    if (typeof safeDrawCandleChart === 'function') {
        safeDrawCandleChart();
    }
}

function renderOpenPositions() {
    const container = document.getElementById('openPositionsBody');
    if (!container) return;

    const positions = STATE.positions;
    const hasPositions = Object.values(positions).some(p => p !== null);

    if (!hasPositions) {
        container.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#475569;padding:10px 0;">Нет открытых позиций</td></tr>';
        return;
    }

    let html = '';
    for (const [instrument, pos] of Object.entries(positions)) {
        if (!pos) continue;

        const currentPrice = STATE.quotes[instrument]?.price || pos.entry;
        const profit = pos.side === 'buy' 
            ? (currentPrice - pos.entry) * pos.quantity
            : (pos.entry - currentPrice) * pos.quantity;
        const profitStr = (profit > 0 ? '+' : '') + profit.toFixed(2);
        const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
        const sideLabel = pos.side === 'buy' ? 'LONG' : 'SHORT';
        const sideClass = pos.side === 'buy' ? 'buy' : 'sell';

        html += `
            <tr>
                <td>${new Date(pos.openTime).toLocaleTimeString()}</td>
                <td>${instrument}</td>
                <td><span class="badge ${sideClass}">${sideLabel}</span></td>
                <td>${pos.quantity}x</td>
                <td>${pos.entry.toFixed(2)}</td>
                <td>${currentPrice.toFixed(2)}</td>
                <td style="text-align:right;font-weight:bold;" class="${profitClass}">${profitStr}</td>
            </tr>
        `;
    }

    container.innerHTML = html;
}

function renderClosedTrades() {
    const tbody = document.getElementById('tradesBody');
    if (!tbody) return;

    const today = new Date().toDateString();
    const closedTrades = STATE.trades.filter(t => 
        typeof t.profit === 'number' &&
        new Date(t.timestamp).toDateString() === today
    );

    if (closedTrades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#475569;padding:10px 0;">Нет сделок за сегодня</td></tr>';
        return;
    }

    const trades = closedTrades.slice(-20).reverse();
    tbody.innerHTML = trades.map(t => `
        <tr>
            <td>${t.timeStr}</td>
            <td>${t.instrument}</td>
            <td><span class="badge ${t.side === 'buy' ? 'buy' : 'sell'}">${t.side === 'buy' ? 'Покуп' : 'Продаж'}</span></td>
            <td>${t.quantity || 1}x</td>
            <td>${t.entryPrice?.toFixed(2) || t.price.toFixed(2)}</td>
            <td style="text-align:right;font-weight:bold;" class="${t.profit >= 0 ? 'profit-positive' : 'profit-negative'}">${t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}</td>
        </tr>
    `).join('');
}

function toggleStrategy(instrument) {
    STATE.strategies[instrument] = !STATE.strategies[instrument];
    render();
}

async function exportToExcel() {
    try {
        if (typeof XLSX === 'undefined') {
            await loadScript('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js');
        }

        const today = new Date().toDateString();
        const closedTrades = STATE.trades.filter(t => 
            typeof t.profit === 'number' &&
            new Date(t.timestamp).toDateString() === today
        );

        const s = STATE.stats;
        const daily = STATE.dailyStats;
        const winRate = s.total ? Math.round((s.wins / s.total) * 100) : 0;
        const dailyWinRate = daily.total ? Math.round((daily.wins / daily.total) * 100) : 0;

        const statsData = [
            ['ПОКАЗАТЕЛЬ', 'ЗНАЧЕНИЕ'],
            ['Дата отчёта', new Date().toLocaleString()],
            ['Начальный баланс', 100000],
            ['Текущий баланс', Math.round(STATE.balance)],
            ['', ''],
            ['=== ОБЩАЯ СТАТИСТИКА ===', ''],
            ['Общий профит', Math.round(s.profit * 100) / 100],
            ['Всего сделок', s.total],
            ['Прибыльных', s.wins],
            ['Убыточных', s.losses],
            ['Win Rate (%)', winRate],
            ['Профит-фактор', s.total > 0 ? ((s.wins / (s.losses || 1)) * (s.total > 0 ? 1 : 0)).toFixed(2) : 0],
            ['', ''],
            ['=== ДНЕВНАЯ СТАТИСТИКА ===', ''],
            ['Дата', today],
            ['P&L за сегодня', Math.round(daily.profit * 100) / 100],
            ['Сделок за сегодня', daily.total],
            ['Win Rate за сегодня', dailyWinRate + '%'],
            ['Макс. просадка', (daily.maxDrawdown || 0).toFixed(1) + '%']
        ];

        const tradesData = [
            ['№', 'Время', 'Инструмент', 'Направление', 'Кол-во', 'Цена входа', 'Цена выхода', 'P&L']
        ];
        closedTrades.forEach((t, i) => {
            tradesData.push([
                i + 1,
                t.timeStr,
                t.instrument,
                t.side === 'buy' ? 'Покупка' : 'Продажа',
                t.quantity || 1,
                t.entryPrice?.toFixed(2) || t.price.toFixed(2),
                t.price.toFixed(2),
                t.profit.toFixed(2)
            ]);
        });

        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.aoa_to_sheet(statsData);
        const ws2 = XLSX.utils.aoa_to_sheet(tradesData);
        ws1['!cols'] = [{ wch: 30 }, { wch: 20 }];
        ws2['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'Статистика');
        XLSX.utils.book_append_sheet(wb, ws2, 'Сделки');
        const filename = `trading_report_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(wb, filename);
        console.log(`✅ Отчёт сохранён: ${filename}`);
    } catch (e) {
        console.error('❌ Ошибка экспорта:', e);
        alert('Ошибка экспорта. Проверьте интернет.');
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

window.render = render;
window.toggleStrategy = toggleStrategy;
window.exportToExcel = exportToExcel;

console.log('📋 ui.js загружен (ПРОФЕССИОНАЛЬНАЯ ВЕРСИЯ)');
