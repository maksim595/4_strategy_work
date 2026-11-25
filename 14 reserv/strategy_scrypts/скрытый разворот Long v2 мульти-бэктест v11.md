// ═══════════════════════════════════════════════════════
// ХЕЛПЕР: пагинация Binance klines (макс 1000/запрос)
// ═══════════════════════════════════════════════════════
async function fetchKlinesPaginated(symbol, interval, totalBars) {
    var all = [];
    var endTime = null;
    var guard = 0;
    while (all.length < totalBars && guard < 20) {
        guard++;
        var need = Math.min(1000, totalBars - all.length);
        var url = 'https://api.binance.com/api/v3/klines?symbol=' + symbol +
                  '&interval=' + interval + '&limit=' + need;
        if (endTime !== null) url += '&endTime=' + endTime;
        var batch = await fetch(url).then(function(r){ return r.json(); });
        if (!Array.isArray(batch) || batch.length === 0) break;
        all = batch.concat(all);
        endTime = parseInt(batch[0][0]) - 1;
        if (batch.length < need) break;
        await new Promise(function(r){ setTimeout(r, 100); });
    }
    return all.slice(-totalBars);
}

// ═══════════════════════════════════════════════════════
// LONG v2 — мульти-символьный бэктест (30+ дней)
// ═══════════════════════════════════════════════════════
window.backtestMultiSymbolLong = async function(opts) {
    opts = opts || {};
    var symbols = opts.symbols || ['AVAXUSDT','BNBUSDT','SEIUSDT','OPUSDT','ETHUSDT','SOLUSDT','TONUSDT','SUIUSDT','NEARUSDT','ATOMUSDT'];
    var slBufferPct = opts.slBufferPct !== undefined ? opts.slBufferPct : 0.5;
    var tpMode = opts.tpMode || 'tp1';
    var barsLimit = opts.barsLimit || 3000;
    var riskPct = opts.riskPct !== undefined ? opts.riskPct : 0.5;

    // 🆕 Фильтры v11 (прокидываются в backtestStealthC)
    var minRR = opts.minRR !== undefined ? opts.minRR : 1.5;
    var minRange = opts.minRange !== undefined ? opts.minRange : 1.5;
    var sessionFilter = opts.sessionFilter !== false;
    var partialExits = opts.partialExits === true;
    var exitOn3Against = opts.exitOn3Against === true;

    var savedChartBars = chartBars;
    var savedInstrument = currentInstrument;
    var savedTimeframe = selectedTimeframe;
    var allResults = [];
    var allTrades = [];
    var errors = [];

    console.log('══════════════════════════════════════════════════');
    console.log('📊 ДЛИННЫЙ МУЛЬТИ-БЭКТЕСТ v2 (пагинация + v11-фильтры)');
    console.log('══════════════════════════════════════════════════');
    console.log('  Символов: ' + symbols.length);
    console.log('  Баров на символ: ' + barsLimit + ' (≈ ' + (barsLimit * 15 / 60 / 24).toFixed(1) + ' дней)');
    console.log('  Параметры: SL=' + slBufferPct + '% | tpMode=' + tpMode + ' | risk=' + riskPct + '%');
    console.log('  Фильтры: minRR=' + minRR + ' | minRange=' + minRange + '% | session=' + sessionFilter);
    console.log('  Опции: partialExits=' + partialExits + ' | exitOn3Against=' + exitOn3Against);
    console.log('');

    if (selectedTimeframe !== '15m') {
        var tfSel = document.getElementById('timeframeSelect');
        if (tfSel) { tfSel.value = '15m'; tfSel.dispatchEvent(new Event('change')); }
        await new Promise(function(r){ setTimeout(r, 3000); });
    }

    for (var i = 0; i < symbols.length; i++) {
        var sym = symbols[i];
        console.log('━━━ ' + (i+1) + '/' + symbols.length + ': ' + sym + ' ━━━');

        try {
            var rawBars = await fetchKlinesPaginated(sym, '15m', barsLimit);
            if (!rawBars || rawBars.length < 500) {
                console.log('  ⚠️ Мало данных: ' + (rawBars?.length || 0));
                errors.push({ symbol: sym, error: 'low data: ' + (rawBars?.length || 0) });
                continue;
            }

            var firstTime = parseInt(rawBars[0][0]);
            var lastTime = parseInt(rawBars[rawBars.length-1][0]);
            var daysActual = ((lastTime - firstTime) / 86400000).toFixed(1);
            console.log('  Загружено: ' + rawBars.length + ' баров (' + daysActual + ' дней)');

            currentInstrument = sym;
            chartBars = rawBars.map(function(k){
                return { time: Math.floor(parseInt(k[0])/1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] };
            });

            // 🆕 Вызов v11 (с фильтрами)
            var res = await backtestStealthC({
                riskPct: riskPct,
                slBufferPct: slBufferPct,
                tpMode: tpMode,
                minRR: minRR,
                minRange: minRange,
                sessionFilter: sessionFilter,
                partialExits: partialExits,
                exitOn3Against: exitOn3Against,
                quiet: true
            });

            if (res && res.trades.length > 0) {
                console.log('  ' + sym + ' | ' + res.signals.short + 'S+' + res.signals.long + 'L → ' + res.trades.length + ' сделок | WR=' + res.metrics.winrate.toFixed(1) + '% | P&L=' + (res.metrics.netPnl>=0?'+':'') + res.metrics.netPnl.toFixed(2) + '$ | PF=' + (res.metrics.pf===Infinity?'∞':res.metrics.pf.toFixed(2)));
                console.log('    Фильтры: range=' + res.filterStats.skippedRange + ' session=' + res.filterStats.skippedSession + ' R:R=' + res.filterStats.skippedRR + ' → открыто=' + res.filterStats.opened);
                allResults.push({ symbol: sym, bars: rawBars.length, days: parseFloat(daysActual), signals: res.signals, metrics: res.metrics, filterStats: res.filterStats, trades: res.trades });
                res.trades.forEach(function(t){ allTrades.push(Object.assign({}, t, { symbol: sym })); });
            } else if (res) {
                console.log('  ' + sym + ' | ' + res.signals.short + 'S+' + res.signals.long + 'L → 0 сделок');
                console.log('    Фильтры: range=' + res.filterStats.skippedRange + ' session=' + res.filterStats.skippedSession + ' R:R=' + res.filterStats.skippedRR);
            }
        } catch (e) {
            console.log('  ⚠️ Ошибка: ' + e.message);
            errors.push({ symbol: sym, error: e.message });
        }

        await new Promise(function(r){ setTimeout(r, 200); });
    }

    chartBars = savedChartBars;
    currentInstrument = savedInstrument;
    selectedTimeframe = savedTimeframe;

    // ═══════ ИТОГИ ═══════
    var totalTrades = allTrades.length;
    var totalWins = allTrades.filter(function(t){ return t.pnl > 0; }).length;
    var totalLosses = allTrades.filter(function(t){ return t.pnl < 0; }).length;
    var totalBE = allTrades.filter(function(t){ return Math.abs(t.pnl) < 0.01; }).length;
    var totalWinPnl = allTrades.filter(function(t){ return t.pnl > 0; }).reduce(function(s, t){ return s + t.pnl; }, 0);
    var totalLossPnl = Math.abs(allTrades.filter(function(t){ return t.pnl < 0; }).reduce(function(s, t){ return s + t.pnl; }, 0));
    var totalPnl = totalWinPnl - totalLossPnl;
    var pf = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : (totalWinPnl > 0 ? Infinity : 0);

    var byReason = { SL: 0, TP1: 0, TP2: 0, TP3: 0, END_OF_DAY: 0, TIMEOUT: 0, '3_AGAINST': 0 };
    allTrades.forEach(function(t){ byReason[t.reason] = (byReason[t.reason]||0) + 1; });

    var winSymbols = allResults.filter(function(r){ return r.metrics.netPnl > 0; }).length;
    var lossSymbols = allResults.filter(function(r){ return r.metrics.netPnl < 0; }).length;
    var neutralSymbols = allResults.filter(function(r){ return r.metrics.netPnl === 0; }).length;

    var avgWin = totalWins > 0 ? totalWinPnl / totalWins : 0;
    var avgLoss = totalLosses > 0 ? totalLossPnl / totalLosses : 0;
    var rr_avg = avgLoss > 0 ? avgWin / avgLoss : Infinity;
    var expectancy = totalTrades > 0 ? totalPnl / totalTrades : 0;

    var eq = [10000];
    allTrades.forEach(function(t){ eq.push(eq[eq.length-1] + t.pnl); });
    var peak = eq[0], maxDD = 0, maxDDPct = 0;
    eq.forEach(function(v){ if (v > peak) peak = v; var dd = peak - v; var ddPct = (dd / peak) * 100; if (dd > maxDD) { maxDD = dd; maxDDPct = ddPct; } });

    var totalFilterStats = { range: 0, session: 0, rr: 0, invalid: 0 };
    allResults.forEach(function(r) {
        if (r.filterStats) {
            totalFilterStats.range += r.filterStats.skippedRange;
            totalFilterStats.session += r.filterStats.skippedSession;
            totalFilterStats.rr += r.filterStats.skippedRR;
            totalFilterStats.invalid += r.filterStats.skippedInvalid;
        }
    });

    console.log('\n══════════════════════════════════════════════════');
    console.log('📊 ИТОГО (' + symbols.length + ' символов, ~' + barsLimit + ' баров):');
    console.log('══════════════════════════════════════════════════');
    console.log('  Символов с данными: ' + allResults.length + ' / ' + symbols.length);
    console.log('  Символов с прибылью: ' + winSymbols + ' | с убытком: ' + lossSymbols + ' | нейтральных: ' + neutralSymbols);
    console.log('  ─────────────────────────────────────────────────');
    console.log('  ФИЛЬТРЫ (суммарно):');
    console.log('    Отсеяно range=' + totalFilterStats.range + ' | session=' + totalFilterStats.session + ' | R:R=' + totalFilterStats.rr + ' | invalid=' + totalFilterStats.invalid);
    console.log('  ─────────────────────────────────────────────────');
    console.log('  ВСЕГО СДЕЛОК: ' + totalTrades);
    console.log('    ✅ W: ' + totalWins + ' | ❌ L: ' + totalLosses + ' | ⚪ BE: ' + totalBE);
    console.log('    Winrate: ' + (totalTrades > 0 ? (totalWins/totalTrades*100).toFixed(1) : 0) + '%');
    console.log('  ─────────────────────────────────────────────────');
    console.log('  Выходы: SL=' + byReason.SL + ' TP1=' + byReason.TP1 + ' TP2=' + byReason.TP2 + ' TP3=' + byReason.TP3 + ' END_OF_DAY=' + byReason.END_OF_DAY + ' TIMEOUT=' + byReason.TIMEOUT + (exitOn3Against ? ' 3_AGAINST=' + byReason['3_AGAINST'] : ''));
    console.log('  ─────────────────────────────────────────────────');
    console.log('  Общий P&L: ' + (totalPnl>=0?'+':'') + totalPnl.toFixed(2) + '$');
    console.log('  Profit Factor: ' + (pf===Infinity?'∞':pf.toFixed(2)));
    console.log('  ─────────────────────────────────────────────────');
    console.log('  avgWin: ' + avgWin.toFixed(2) + '$ | avgLoss: ' + (-avgLoss).toFixed(2) + '$ | R:R = 1:' + (rr_avg===Infinity?'∞':rr_avg.toFixed(2)));
    console.log('  Expectancy: ' + (expectancy>=0?'+':'') + expectancy.toFixed(2) + '$ на сделку');
    console.log('  Max Drawdown: ' + maxDD.toFixed(2) + '$ (' + maxDDPct.toFixed(2) + '%)');
    console.log('══════════════════════════════════════════════════\n');

    var sorted = allResults.slice().sort(function(a,b){ return b.metrics.netPnl - a.metrics.netPnl; });
    console.log('🏆 ТОП-5:');
    sorted.slice(0, 5).forEach(function(r){
        console.log('  ' + r.symbol.padEnd(12) + ' | ' + r.metrics.total + ' сделок | WR ' + r.metrics.winrate.toFixed(1) + '% | P&L ' + (r.metrics.netPnl>=0?'+':'') + r.metrics.netPnl.toFixed(2) + '$ | PF ' + (r.metrics.pf===Infinity?'∞':r.metrics.pf.toFixed(2)));
    });
    console.log('💀 ХУДШИЕ-5:');
    sorted.slice(-5).reverse().forEach(function(r){
        console.log('  ' + r.symbol.padEnd(12) + ' | ' + r.metrics.total + ' сделок | WR ' + r.metrics.winrate.toFixed(1) + '% | P&L ' + (r.metrics.netPnl>=0?'+':'') + r.metrics.netPnl.toFixed(2) + '$ | PF ' + (r.metrics.pf===Infinity?'∞':r.metrics.pf.toFixed(2)));
    });

    if (errors.length > 0) {
        console.log('\n⚠️ Ошибки (' + errors.length + '):');
        errors.forEach(function(e){ console.log('  ' + e.symbol + ': ' + e.error); });
    }

    var result = {
        symbols: symbols,
        config: {
            riskPct: riskPct, slBufferPct: slBufferPct, tpMode: tpMode, barsLimit: barsLimit,
            minRR: minRR, minRange: minRange, sessionFilter: sessionFilter,
            partialExits: partialExits, exitOn3Against: exitOn3Against
        },
        perSymbol: allResults,
        allTrades: allTrades,
        errors: errors,
        filterStats: totalFilterStats,
        totals: {
            symbolsWithData: allResults.length,
            trades: totalTrades, wins: totalWins, losses: totalLosses, breakeven: totalBE,
            winrate: totalTrades > 0 ? (totalWins/totalTrades*100) : 0,
            winPnl: totalWinPnl, lossPnl: totalLossPnl, netPnl: totalPnl, pf: pf,
            byReason: byReason,
            winSymbols: winSymbols, lossSymbols: lossSymbols, neutralSymbols: neutralSymbols,
            avgWin: avgWin, avgLoss: avgLoss, rr: rr_avg,
            expectancy: expectancy, maxDD: maxDD, maxDDPct: maxDDPct
        }
    };
    window.__longBacktest = result;
    addLog('📊 Long v2 (v11): ' + totalTrades + ' сделок | WR ' + (totalTrades>0?(totalWins/totalTrades*100).toFixed(1):0) + '% | P&L ' + (totalPnl>=0?'+':'') + totalPnl.toFixed(2) + '$ | PF ' + (pf===Infinity?'∞':pf.toFixed(2)), 'trade');

    console.log('💾 → window.__longBacktest');
    console.log('   Экспорт: backtestMultiSymbolLong.exportJSON()');
    console.log('══════ ✅ ДЛИННЫЙ БЭКТЕСТ v2 ЗАВЕРШЁН ══════\n');

    return result;
};

window.backtestMultiSymbolLong.exportJSON = function() {
    if (!window.__longBacktest) { console.log('❌ Нет результатов'); return; }
    var blob = new Blob([JSON.stringify(window.__longBacktest, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'stealth_long_v2_' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log('💾 Скачан файл');
};

window.backtestMultiSymbolLong.check = async function() {
    console.log('══ Проверка лимитов Binance ══');
    var r1000 = await fetch('https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=15m&limit=1000').then(function(r){ return r.json(); });
    console.log('limit=1000 → ' + r1000.length);
    var paginated = await fetchKlinesPaginated('ETHUSDT', '15m', 3000);
    console.log('fetchKlinesPaginated(3000) → ' + paginated.length);
    var span = (parseInt(paginated[paginated.length-1][0]) - parseInt(paginated[0][0])) / 86400000;
    console.log('Период: ' + span.toFixed(1) + ' дней');
};

console.log('✅ Long v2 загружен (с v11-фильтрами внутри).');
console.log('');
console.log('   Запуск (по умолчанию): await backtestMultiSymbolLong({ slBufferPct: 0.5 })');
console.log('   С фильтрами v11: await backtestMultiSymbolLong({ slBufferPct: 0.5, minRR: 1.5, minRange: 1.5, sessionFilter: true })');
console.log('   Без фильтров (сравнить с v10): await backtestMultiSymbolLong({ minRR: 0, minRange: 0, sessionFilter: false })');
console.log('');
console.log('   Проверка лимитов: await backtestMultiSymbolLong.check()');
console.log('   Экспорт: backtestMultiSymbolLong.exportJSON()');