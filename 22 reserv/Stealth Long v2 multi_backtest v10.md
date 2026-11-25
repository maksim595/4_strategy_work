// !!!   Сначала загрузить C v10, потом Long v2   !!!
// ═══════════════════════════════════════════════════════
// ХЕЛПЕР: пагинация Binance klines (макс 1000/запрос)
// ═══════════════════════════════════════════════════════
async function fetchKlinesPaginated(symbol, interval, totalBars) {
    var all = [];
    var endTime = null;   // первый запрос — без endTime (получаем последние)
    var guard = 0;
    while (all.length < totalBars && guard < 20) {
        guard++;
        var need = Math.min(1000, totalBars - all.length);
        var url = 'https://api.binance.com/api/v3/klines?symbol=' + symbol +
                  '&interval=' + interval + '&limit=' + need;
        if (endTime !== null) url += '&endTime=' + endTime;
        
        var batch = await fetch(url).then(function(r){ return r.json(); });
        if (!Array.isArray(batch) || batch.length === 0) break;
        
        // batch идёт от старых к новым. Конкатенируем ПЕРЕД all (batch раньше по времени).
        all = batch.concat(all);
        
        // Следующий запрос — до первого бара текущего батча
        endTime = parseInt(batch[0][0]) - 1;
        
        // Если вернулось меньше, чем просили — история кончилась
        if (batch.length < need) break;
        
        // Rate limit
        await new Promise(function(r){ setTimeout(r, 100); });
    }
    // Берём ровно totalBars последних
    return all.slice(-totalBars);
}

// ═══════════════════════════════════════════════════════
// 30-ДНЕВНЫЙ МУЛЬТИ-БЭКТЕСТ (правильная пагинация)
// ═══════════════════════════════════════════════════════
window.backtestMultiSymbolLong = async function(opts) {
    opts = opts || {};
    var symbols = opts.symbols || ['AVAXUSDT','BNBUSDT','SEIUSDT','OPUSDT','ETHUSDT','SOLUSDT','TONUSDT','SUIUSDT','NEARUSDT','ATOMUSDT'];
    var slBufferPct = opts.slBufferPct !== undefined ? opts.slBufferPct : 0.3;
    var tpMode = opts.tpMode || 'tp1';
    var barsLimit = opts.barsLimit || 3000;   // 3000 баров 15m ≈ 31 день
    var riskPct = opts.riskPct !== undefined ? opts.riskPct : 0.5;
    
    var savedChartBars = chartBars;
    var savedInstrument = currentInstrument;
    var savedTimeframe = selectedTimeframe;
    var allResults = [];
    var allTrades = [];
    var errors = [];
    
    console.log('══════════════════════════════════════════════════');
    console.log('📊 ДЛИННЫЙ МУЛЬТИ-БЭКТЕСТ (v2, пагинация)');
    console.log('══════════════════════════════════════════════════');
    console.log('  Символов: ' + symbols.length);
    console.log('  Баров на символ: ' + barsLimit + ' (≈ ' + (barsLimit * 15 / 60 / 24).toFixed(1) + ' дней)');
    console.log('  Параметры: SL=' + slBufferPct + '% | tpMode=' + tpMode + ' | risk=' + riskPct + '%');
    console.log('');
    
    // Переключаемся на 15m (для консистентности — хотя chartBars подменяется)
    if (selectedTimeframe !== '15m') {
        var tfSel = document.getElementById('timeframeSelect');
        if (tfSel) { tfSel.value = '15m'; tfSel.dispatchEvent(new Event('change')); }
        await new Promise(function(r){ setTimeout(r, 3000); });
    }
    
    for (var i = 0; i < symbols.length; i++) {
        var sym = symbols[i];
        console.log('━━━ ' + (i+1) + '/' + symbols.length + ': ' + sym + ' ━━━');
        addLog('📊 ' + sym + ' (' + (i+1) + '/' + symbols.length + ')...', 'info');

        try {
            // 🆕 ПРАВИЛЬНАЯ загрузка через пагинацию
            var rawBars = await fetchKlinesPaginated(sym, '15m', barsLimit);

            if (!rawBars || rawBars.length < 500) {
                console.log('  ⚠️ Мало данных: ' + (rawBars?.length || 0) + ' баров');
                addLog('⚠️ ' + sym + ': мало данных (' + (rawBars?.length || 0) + ')', 'error');
                errors.push({ symbol: sym, error: 'low data: ' + (rawBars?.length || 0) });
                continue;
            }

            // Показываем реальный период
            var firstTime = parseInt(rawBars[0][0]);
            var lastTime = parseInt(rawBars[rawBars.length-1][0]);
            var daysActual = ((lastTime - firstTime) / 86400000).toFixed(1);
            console.log('  Загружено: ' + rawBars.length + ' баров (' + daysActual + ' дней)');
            console.log('    От: ' + new Date(firstTime).toISOString().slice(0, 16));
            console.log('    До: ' + new Date(lastTime).toISOString().slice(0, 16));
            addLog('✅ ' + sym + ': ' + rawBars.length + ' баров (' + daysActual + ' дней)', 'info');
            
            // Подмена chartBars
            currentInstrument = sym;
            chartBars = rawBars.map(function(k){
                return { time: Math.floor(parseInt(k[0])/1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] };
            });
            
            // Запуск бэктеста
            var res = await backtestStealthC({
                riskPct: riskPct,
                slBufferPct: slBufferPct,
                tpMode: tpMode,
                quiet: true
            });
            
            if (res && res.trades.length > 0) {
                console.log('  → ' + res.signals.short + 'S+' + res.signals.long + 'L | ' + res.trades.length + ' сделок | WR ' + res.metrics.winrate.toFixed(1) + '% | P&L ' + (res.metrics.netPnl>=0?'+':'') + res.metrics.netPnl.toFixed(2) + '$ | PF ' + (res.metrics.pf===Infinity?'∞':res.metrics.pf.toFixed(2)));
                addLog('📊 ' + sym + ': ' + res.trades.length + ' сделок | WR=' + res.metrics.winrate.toFixed(1) + '% | P&L=' + (res.metrics.netPnl>=0?'+':'') + res.metrics.netPnl.toFixed(2) + '$', 'trade');
                allResults.push({ symbol: sym, bars: rawBars.length, days: parseFloat(daysActual), signals: res.signals, metrics: res.metrics, trades: res.trades });
                res.trades.forEach(function(t){ allTrades.push(Object.assign({}, t, { symbol: sym })); });
            } else if (res) {
                console.log('  → ' + res.signals.short + 'S+' + res.signals.long + 'L | 0 сделок');
                addLog('ℹ️ ' + sym + ': 0 сделок', 'info');
            }
        } catch (e) {
            console.log('  ⚠️ Ошибка: ' + e.message);
            addLog('❌ ' + sym + ': ' + e.message, 'error');
            errors.push({ symbol: sym, error: e.message });
        }
        
        await new Promise(function(r){ setTimeout(r, 200); });
    }
    
    // Восстанавливаем
    chartBars = savedChartBars;
    currentInstrument = savedInstrument;
    selectedTimeframe = savedTimeframe;
    
    // ═══════════ ИТОГИ ═══════════
    var totalTrades = allTrades.length;
    var totalWins = allTrades.filter(function(t){ return t.pnl > 0; }).length;
    var totalLosses = allTrades.filter(function(t){ return t.pnl < 0; }).length;
    var totalBE = allTrades.filter(function(t){ return Math.abs(t.pnl) < 0.01; }).length;
    var totalWinPnl = allTrades.filter(function(t){ return t.pnl > 0; }).reduce(function(s, t){ return s + t.pnl; }, 0);
    var totalLossPnl = Math.abs(allTrades.filter(function(t){ return t.pnl < 0; }).reduce(function(s, t){ return s + t.pnl; }, 0));
    var totalPnl = totalWinPnl - totalLossPnl;
    var pf = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : (totalWinPnl > 0 ? Infinity : 0);
    
    var byReason = { SL: 0, TP1: 0, TP2: 0, TP3: 0, END_OF_DAY: 0, TIMEOUT: 0 };
    allTrades.forEach(function(t){ byReason[t.reason] = (byReason[t.reason]||0) + 1; });
    
    var winSymbols = allResults.filter(function(r){ return r.metrics.netPnl > 0; }).length;
    var lossSymbols = allResults.filter(function(r){ return r.metrics.netPnl < 0; }).length;
    
    // R:R и expectancy
    var avgWin = totalWins > 0 ? totalWinPnl / totalWins : 0;
    var avgLoss = totalLosses > 0 ? totalLossPnl / totalLosses : 0;
    var rr = avgLoss > 0 ? avgWin / avgLoss : Infinity;
    var expectancy = totalTrades > 0 ? totalPnl / totalTrades : 0;
    
    // Max Drawdown (по эквити)
    var eq = [10000];
    allTrades.forEach(function(t){ eq.push(eq[eq.length-1] + t.pnl); });
    var peak = eq[0], maxDD = 0, maxDDPct = 0;
    eq.forEach(function(v){ if (v > peak) peak = v; var dd = peak - v; var ddPct = (dd / peak) * 100; if (dd > maxDD) { maxDD = dd; maxDDPct = ddPct; } });
    
    // Итоги
    console.log('\n══════════════════════════════════════════════════');
    console.log('📊 ИТОГО (' + symbols.length + ' символов, ~' + barsLimit + ' баров):');
    console.log('══════════════════════════════════════════════════');
    console.log('  Символов с данными: ' + allResults.length + ' / ' + symbols.length);
    console.log('  Символов с прибылью: ' + winSymbols + ' | с убытком: ' + lossSymbols);
    console.log('  ─────────────────────────────────────────────────');
    console.log('  ВСЕГО СДЕЛОК: ' + totalTrades);
    console.log('    ✅ W: ' + totalWins + ' | ❌ L: ' + totalLosses + ' | ⚪ BE: ' + totalBE);
    console.log('    Winrate: ' + (totalTrades > 0 ? (totalWins/totalTrades*100).toFixed(1) : 0) + '%');
    console.log('  ─────────────────────────────────────────────────');
    console.log('  Выходы: SL=' + byReason.SL + ' TP1=' + byReason.TP1 + ' TP2=' + byReason.TP2 + ' TP3=' + byReason.TP3 + ' END_OF_DAY=' + byReason.END_OF_DAY + ' TIMEOUT=' + byReason.TIMEOUT);
    console.log('  ─────────────────────────────────────────────────');
    console.log('  Общий P&L: ' + (totalPnl>=0?'+':'') + totalPnl.toFixed(2) + '$');
    console.log('  Profit Factor: ' + (pf===Infinity?'∞':pf.toFixed(2)));
    console.log('  ─────────────────────────────────────────────────');
    console.log('  avgWin: ' + avgWin.toFixed(2) + '$ | avgLoss: ' + (-avgLoss).toFixed(2) + '$ | R:R = 1:' + (rr===Infinity?'∞':rr.toFixed(2)));
    console.log('  Expectancy: ' + (expectancy>=0?'+':'') + expectancy.toFixed(2) + '$ на сделку');
    console.log('  Max Drawdown: ' + maxDD.toFixed(2) + '$ (' + maxDDPct.toFixed(2) + '%)');
    console.log('══════════════════════════════════════════════════\n');
    
    // Топ / худшие
    var sorted = allResults.slice().sort(function(a,b){ return b.metrics.netPnl - a.metrics.netPnl; });
    console.log('🏆 ТОП-5:');
    sorted.slice(0, 5).forEach(function(r){
        console.log('  ' + r.symbol.padEnd(12) + ' | ' + r.metrics.total + ' сделок | WR ' + r.metrics.winrate.toFixed(1) + '% | P&L ' + (r.metrics.netPnl>=0?'+':'') + r.metrics.netPnl.toFixed(2) + '$ | PF ' + (r.metrics.pf===Infinity?'∞':r.metrics.pf.toFixed(2)));
    });
    console.log('💀 ХУДШИЕ-5:');
    sorted.slice(-5).reverse().forEach(function(r){
        console.log('  ' + r.symbol.padEnd(12) + ' | ' + r.metrics.total + ' сделок | WR ' + r.metrics.winrate.toFixed(1) + '% | P&L ' + (r.metrics.netPnl>=0?'+':'') + r.metrics.netPnl.toFixed(2) + '$ | PF ' + (r.metrics.pf===Infinity?'∞':r.metrics.pf.toFixed(2)));
    });
    
    // Ошибки
    if (errors.length > 0) {
        console.log('\n⚠️ Ошибки (' + errors.length + '):');
        errors.forEach(function(e){ console.log('  ' + e.symbol + ': ' + e.error); });
    }
    
    var result = {
        symbols: symbols,
        config: { riskPct: riskPct, slBufferPct: slBufferPct, tpMode: tpMode, barsLimit: barsLimit },
        perSymbol: allResults,
        allTrades: allTrades,
        errors: errors,
        totals: {
            symbolsWithData: allResults.length,
            trades: totalTrades,
            wins: totalWins,
            losses: totalLosses,
            breakeven: totalBE,
            winrate: totalTrades > 0 ? (totalWins/totalTrades*100) : 0,
            winPnl: totalWinPnl,
            lossPnl: totalLossPnl,
            netPnl: totalPnl,
            pf: pf,
            byReason: byReason,
            winSymbols: winSymbols,
            lossSymbols: lossSymbols,
            avgWin: avgWin,
            avgLoss: avgLoss,
            rr: rr,
            expectancy: expectancy,
            maxDD: maxDD,
            maxDDPct: maxDDPct
        }
    };
    window.__longBacktest = result;
    addLog('📊 Long-бэктест: ' + totalTrades + ' сделок | WR ' + (totalTrades>0?(totalWins/totalTrades*100).toFixed(1):0) + '% | P&L ' + (totalPnl>=0?'+':'') + totalPnl.toFixed(2) + '$ | PF ' + (pf===Infinity?'∞':pf.toFixed(2)) + ' | DD ' + maxDDPct.toFixed(1) + '%', 'trade');
    
    console.log('💾 → window.__longBacktest');
    console.log('   Экспорт: backtestMultiSymbolLong.exportJSON()');
    console.log('══════ ✅ ДЛИННЫЙ БЭКТЕСТ ЗАВЕРШЁН ══════\n');
    
    // ── Отобразить линии ENTRY/SL/TP1/TP2 для последней сделки последнего символа ──
    if (allResults.length > 0) {
        var lastResult = allResults[allResults.length - 1];
        if (lastResult.trades && lastResult.trades.length > 0) {
            var lastTrade = lastResult.trades[lastResult.trades.length - 1];
            if (typeof showLevels === 'function') {
                console.log('📏 Уровни последнего ' + lastTrade.side.toUpperCase() + ' ' + lastResult.symbol + ': ENTRY=' + lastTrade.entry.toFixed(2) + ' | SL=' + lastTrade.stop.toFixed(2) + ' | TP1=' + lastTrade.tp1.toFixed(2) + ' | TP2=' + lastTrade.tp2.toFixed(2));
                showLevels(lastTrade.entryIdx, lastTrade.side, lastTrade.entry, lastTrade.stop, lastTrade.tp1, lastTrade.tp2);
            }
        }
    }
    
    // ── Переключиться на ЛУЧШИЙ инструмент и показать ЛУЧШУЮ сделку ──
    if (allResults.length > 0) {
        var bestResult = allResults.slice().sort(function(a,b){ return b.metrics.netPnl - a.metrics.netPnl; })[0];
        if (bestResult && bestResult.trades && bestResult.trades.length > 0) {
            var bestTrade = bestResult.trades.slice().sort(function(a,b){ return b.pnl - a.pnl; })[0];
            console.log('🏆 ЛУЧШИЙ: ' + bestResult.symbol + ' | ' + bestTrade.side.toUpperCase() + ' | P&L=' + (bestTrade.pnl>=0?'+':'') + bestTrade.pnl.toFixed(2) + '$');
            addLog('🏆 Лучший: ' + bestResult.symbol + ' | ' + bestTrade.side.toUpperCase() + ' | P&L=' + (bestTrade.pnl>=0?'+':'') + bestTrade.pnl.toFixed(2) + '$', 'trade');
            // Переключить инструмент
            if (typeof window.scanSwitchToSymbol === 'function') {
                window.scanSwitchToSymbol(bestResult.symbol);
            }
            // Показать лучшую сделку через showLevels (через 4 сек — после загрузки баров)
            if (typeof window.showLevels === 'function') {
                setTimeout(function(){
                    // Проверить, что chartBars обновлены для нового инструмента
                    if (typeof chartBars !== 'undefined' && chartBars && chartBars.length > 100) {
                        window.showLevels(bestTrade.entryIdx, bestTrade.side, bestTrade.entry, bestTrade.stop, bestTrade.tp1, bestTrade.tp2);
                        // Масштабировать график по временной И ценовой шкале
                        if (typeof lwcChart !== 'undefined' && lwcChart) {
                            lwcChart.timeScale().fitContent();
                            // Принудительное обновление ценовой шкалы
                            setTimeout(function(){
                                lwcChart.priceScale('right').applyOptions({ autoScale: true });
                            }, 500);
                        }
                        addLog('📏 Уровни лучшей сделки ' + bestResult.symbol + ' показаны', 'info');
                    } else {
                        addLog('⚠️ chartBars не загружены для ' + bestResult.symbol + ' — линии не показаны', 'error');
                    }
                }, 4000);
            }
        }
    }

    return result;
};

// ═══════════ ХЕЛПЕРЫ ═══════════
window.backtestMultiSymbolLong.exportJSON = function() {
    if (!window.__longBacktest) { console.log('❌ Нет результатов'); return; }
    var blob = new Blob([JSON.stringify(window.__longBacktest, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'stealth_long_' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log('💾 Скачан файл');
};

window.backtestMultiSymbolLong.check = async function() {
    // Проверка: сколько баров реально отдаст Binance для limit=3000
    console.log('══ Проверка лимитов Binance ══');
    var r1000 = await fetch('https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=15m&limit=1000').then(r => r.json());
    console.log('limit=1000 → получено: ' + r1000.length);
    var r3000 = await fetch('https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=15m&limit=3000').then(r => r.json());
    console.log('limit=3000 → получено: ' + r3000.length + ' ← Binance ограничивает 1000');
    var paginated = await fetchKlinesPaginated('ETHUSDT', '15m', 3000);
    console.log('fetchKlinesPaginated(3000) → получено: ' + paginated.length + ' ✅');
    var span = (parseInt(paginated[paginated.length-1][0]) - parseInt(paginated[0][0])) / 86400000;
    console.log('Период: ' + span.toFixed(1) + ' дней');
};

console.log('✅ Длинный мульти-бэктест v2 загружен (с пагинацией).');
console.log('');
console.log('   🆕 Проверка лимитов: await backtestMultiSymbolLong.check()');
console.log('   Запуск (30 дней): await backtestMultiSymbolLong()');
console.log('   Параметры: await backtestMultiSymbolLong({ barsLimit: 6000, slBufferPct: 0.5 })');
console.log('   Экспорт: backtestMultiSymbolLong.exportJSON()');

// ── Явный вызов для автодетекта в панели запуска ──
window.__longBacktestRunner = backtestMultiSymbolLong;