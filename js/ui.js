// ============================================================
//  ОТРИСОВКА ИНТЕРФЕЙСА
// ============================================================

function render() {
    const s = STATE.stats;
    const winRate = s.total ? Math.round((s.wins / s.total) * 100) : 0;
    const profit = Math.round(s.profit * 100) / 100;

    document.getElementById('balanceDisplay').textContent = Math.round(STATE.balance) + ' ₽';
    document.getElementById('rtsQuote').textContent = `RTS: ${STATE.quotes.RTS.price ? STATE.quotes.RTS.price.toFixed(2) : '--'}`;
    document.getElementById('siQuote').textContent = `Si: ${STATE.quotes.Si.price ? STATE.quotes.Si.price.toFixed(2) : '--'}`;

    document.getElementById('totalTrades').textContent = s.total;
    document.getElementById('winRate').textContent = winRate + '%';
    document.getElementById('totalProfit').textContent = (profit > 0 ? '+' : '') + profit + ' ₽';
    document.getElementById('totalProfit').className = 'value ' + (profit >= 0 ? 'green' : 'red');

    const rtsBtn = document.getElementById('rtsBtn');
    const siBtn = document.getElementById('siBtn');
    rtsBtn.textContent = (STATE.strategies.RTS ? '⏹' : '▶') + ' RTS';
    rtsBtn.className = 'strategy-btn ' + (STATE.strategies.RTS ? 'active' : 'inactive');
    siBtn.textContent = (STATE.strategies.Si ? '⏹' : '▶') + ' Si';
    siBtn.className = 'strategy-btn ' + (STATE.strategies.Si ? 'active' : 'inactive');
    document.getElementById('strategyStatus').textContent = 
        (STATE.strategies.RTS || STATE.strategies.Si) ? '🟢 Активны' : '⏸ Остановлены';

    const tbody = document.getElementById('tradesBody');
    const trades = STATE.trades.slice(-15).reverse();
    if (trades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#475569;padding:10px 0;">Нет сделок</td></tr>';
    } else {
        tbody.innerHTML = trades.map(t => `
            <tr>
                <td>${t.timeStr}</td>
                <td>${t.instrument}</td>
                <td><span class="badge ${t.side === 'buy' ? 'buy' : 'sell'}">${t.side === 'buy' ? 'Покуп' : 'Продаж'}</span></td>
                <td>${t.price.toFixed(2)}</td>
                <td style="text-align:right;font-weight:bold;" class="${t.profit >= 0 ? 'profit-positive' : 'profit-negative'}">${t.profit >= 0 ? '+' : ''}${t.profit}</td>
            </tr>
        `).join('');
    }
    
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
    
    drawCandleChart();
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

        const s = STATE.stats;
        const winRate = s.total ? Math.round((s.wins / s.total) * 100) : 0;
        const profit = Math.round(s.profit * 100) / 100;
        const total = s.total || 0;

        const statsData = [
            ['ПОКАЗАТЕЛЬ', 'ЗНАЧЕНИЕ'],
            ['Дата отчёта', new Date().toLocaleString()],
            ['Инструмент', STATE.currentInstrument || 'RTS/Si'],
            ['Начальный баланс', 100000],
            ['Текущий баланс', Math.round(STATE.balance)],
            ['Общий профит', profit],
            ['Всего сделок', total],
            ['Прибыльных сделок', s.wins],
            ['Убыточных сделок', s.losses],
            ['Win Rate (%)', winRate],
            ['Средний профит', total > 0 ? (s.wins > 0 ? (s.profit / s.wins).toFixed(2) : 0) : 0],
            ['Средний убыток', total > 0 ? (s.losses > 0 ? (Math.abs(s.profit) / s.losses).toFixed(2) : 0) : 0],
            ['Профит-фактор', total > 0 ? (s.wins / (s.losses || 1)).toFixed(2) : 0],
        ];

        const tradesData = [
            ['№', 'Время', 'Инструмент', 'Направление', 'Цена', 'P&L (₽)']
        ];
        STATE.trades.forEach((t, i) => {
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

        ws1['!cols'] = [{ wch: 25 }, { wch: 20 }];
        ws2['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
        ws3['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 20 }];

        XLSX.utils.book_append_sheet(wb, ws1, 'Статистика');
        XLSX.utils.book_append_sheet(wb, ws2, 'Сделки');
        XLSX.utils.book_append_sheet(wb, ws3, 'Стратегии');

        const filename = `trading_report_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        console.log(`✅ Отчёт сохранён: ${filename}`);
        
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

// Экспортируем
window.render = render;
window.toggleStrategy = toggleStrategy;
window.exportToExcel = exportToExcel;
