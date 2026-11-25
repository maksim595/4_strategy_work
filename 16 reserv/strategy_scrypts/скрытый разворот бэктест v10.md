window.backtestStealthC = async function(opts) {
    opts = opts || {};
    var riskPct = opts.riskPct !== undefined ? opts.riskPct : 0.5;
    var startDeposit = opts.startDeposit || 10000;
    var holdBarsMax = opts.holdBarsMax || 100;   // safety fallback только
    var tpMode = opts.tpMode || 'tp1';
    var slBufferPct = opts.slBufferPct || 0.5;   // 0.5% — «чуть выше/ниже линии»
    var sideFilter = opts.sideFilter || null;
    var quiet = opts.quiet === true;
    
    console.log('══════ 📉 STEALTH C v10 — БЭКТЕСТ (внутридневной) ══════');
    console.log('  risk=' + riskPct + '% | SLbuf=' + slBufferPct + '% | tpMode=' + tpMode + (sideFilter ? ' | side=' + sideFilter : ''));
    console.log('  Таймаут: конец дня UTC входа (fallback ' + holdBarsMax + ' баров)');
    
    if (typeof cleanChart === 'function') { try { cleanChart(); } catch(e) {} }
    
    if (selectedTimeframe !== '15m') {
        addLog('⚠️ Переключаем на 15m...', 'info');
        var tfSel = $('timeframeSelect');
        if (tfSel) { tfSel.value = '15m'; tfSel.dispatchEvent(new Event('change')); }
        await new Promise(function(r){ setTimeout(r, 3500); });
    }
    if (typeof chartBars === 'undefined' || chartBars.length < 100) {
        addLog('⚠️ Мало данных: ' + (chartBars?.length||0), 'error');
        return null;
    }
    console.log('  Данные: ' + chartBars.length + ' баров | ' + currentInstrument + ' 15m');
    
    // ===== PINE (синхрон с A v5) =====
    var signalSrc = `//@version=6
indicator("stealth v10", overlay=true)
yHigh = request.security(syminfo.tickerid, "D", high[1])
yLow  = request.security(syminfo.tickerid, "D", low[1])

localMaxRaw = ta.pivothigh(high, 20, 20)
localMinRaw = ta.pivotlow(low, 20, 20)
var float localMaxD = na
var float localMinD = na
if not na(localMaxRaw)
    localMaxD := localMaxRaw
if not na(localMinRaw)
    localMinD := localMinRaw

touchUpper  = high >= yHigh and close < yHigh
red3        = close < open and close[1] < open[1] and close[2] < open[2]
lowerCloseS = close[2] < close[3]
volGrowS    = volume[2] > volume[3]
noLowBreak  = low > yLow
shortSig    = touchUpper and red3 and lowerCloseS and volGrowS and noLowBreak

touchLower  = low <= yLow and close > yLow
green3      = close > open and close[1] > open[1] and close[2] > open[2]
higherClose = close[2] > close[3]
volGrowL    = volume[2] > volume[3]
noHighBreak = high < yHigh
longSig     = touchLower and green3 and higherClose and volGrowL and noHighBreak

plotshape(shortSig, "SHORT", shape.labeldown, location.abovebar, color.red)
plotshape(longSig,  "LONG",  shape.labelup,   location.belowbar, color.green)
plot(yHigh, "yHigh", color.blue, 1, plot.style_linebr)
plot(yLow,  "yLow",  color.blue, 1, plot.style_linebr)
plot(localMaxD, "localMax", color.red, 1, plot.style_linebr)
plot(localMinD, "localMin", color.red, 1, plot.style_linebr)`;
    
    var tr = ResinBridge.transpile(signalSrc);
    if (!tr.ok) { addLog('❌ Pine: ' + tr.errors.join('; '), 'error'); return null; }
    
    var barsObj = {
        time: chartBars.map(function(b){ return b.time * 1000; }),
        open: chartBars.map(function(b){ return b.open; }),
        high: chartBars.map(function(b){ return b.high; }),
        low:  chartBars.map(function(b){ return b.low; }),
        close:chartBars.map(function(b){ return b.close; }),
        volume:chartBars.map(function(b){ return b.volume || 0; })
    };
    
    var run = ResinBridge.run(tr, barsObj);
    if (!run.viz.shapes || run.viz.shapes.length < 2) {
        addLog('❌ Нет shapes', 'error');
        return null;
    }
    
    var condShort = run.viz.shapes[0].condition;
    var condLong  = run.viz.shapes[1].condition;
    var yHighArr  = run.plots.find(function(p){ return p.title === 'yHigh'; }).values;
    var yLowArr   = run.plots.find(function(p){ return p.title === 'yLow'; }).values;
    var lmaxArr   = run.plots.find(function(p){ return p.title === 'localMax'; }).values;
    var lminArr   = run.plots.find(function(p){ return p.title === 'localMin'; }).values;
    
    var cntShort = condShort.filter(Boolean).length;
    var cntLong  = condLong.filter(Boolean).length;
    console.log('  Сигналов: 🔴 SHORT=' + cntShort + ' | 🟢 LONG=' + cntLong);
    
    // ===== БЭКТЕСТ =====
    var deposit = startDeposit;
    var trades = [];
    var active = null;
    var eqCurve = [startDeposit];
    var wins = 0, losses = 0, breakeven = 0;
    var skipped = 0;
    
    for (var i = 4; i < chartBars.length; i++) {
        var bar = chartBars[i];
        
        // ─── ЗАКРЫТИЕ АКТИВНОЙ СДЕЛКИ ───
        if (active) {
            var closed = null;
            if (active.side === 'short') {
                if (bar.high >= active.stop) closed = { exit: active.stop, reason: 'SL' };
                else if (bar.low <= active.tp1) {
                    if (tpMode === 'tp3' && bar.low <= active.tp3) closed = { exit: active.tp3, reason: 'TP3' };
                    else if (tpMode === 'tp2' && bar.low <= active.tp2) closed = { exit: active.tp2, reason: 'TP2' };
                    else closed = { exit: active.tp1, reason: 'TP1' };
                }
            } else {
                if (bar.low <= active.stop) closed = { exit: active.stop, reason: 'SL' };
                else if (bar.high >= active.tp1) {
                    if (tpMode === 'tp3' && bar.high >= active.tp3) closed = { exit: active.tp3, reason: 'TP3' };
                    else if (tpMode === 'tp2' && bar.high >= active.tp2) closed = { exit: active.tp2, reason: 'TP2' };
                    else closed = { exit: active.tp1, reason: 'TP1' };
                }
            }
            
            // 🔧 НОВОЕ: внутридневной таймаут (конец дня UTC входа)
            if (!closed) {
                var entryDate = new Date(chartBars[active.idx].time * 1000);
                var entryDayEnd = Date.UTC(entryDate.getUTCFullYear(), entryDate.getUTCMonth(), entryDate.getUTCDate() + 1, 0, 0, 0) / 1000;
                if (bar.time >= entryDayEnd) {
                    closed = { exit: bar.close, reason: 'END_OF_DAY' };
                } else if ((i - active.idx) >= holdBarsMax) {
                    closed = { exit: bar.close, reason: 'TIMEOUT' };
                }
            }
            
            if (closed) {
                var pnlUSD = active.size * (closed.exit - active.entry) * (active.side === 'short' ? -1 : 1);
                deposit += pnlUSD;
                if (pnlUSD > 0.01) wins++; else if (pnlUSD < -0.01) losses++; else breakeven++;
                var pnlPct = active.side === 'short' ? (active.entry - closed.exit) / active.entry * 100 : (closed.exit - active.entry) / active.entry * 100;
                trades.push({
                    id: trades.length + 1, side: active.side, entryIdx: active.idx, exitIdx: i,
                    entry: active.entry, exit: closed.exit, stop: active.stop,
                    tp1: active.tp1, tp2: active.tp2, tp3: active.tp3,
                    size: active.size, pnl: pnlUSD, pnlPct: pnlPct, reason: closed.reason,
                    duration: i - active.idx,
                    entryTime: new Date(chartBars[active.idx].time*1000).toISOString(),
                    exitTime: new Date(bar.time*1000).toISOString()
                });
                if (!quiet) console.log((pnlUSD>0?'✅':'❌') + ' #' + trades.length + ' ' + active.side.toUpperCase() + ' | ' + active.entry.toFixed(4) + '→' + closed.exit.toFixed(4) + ' | ' + (pnlUSD>=0?'+':'') + pnlUSD.toFixed(2) + '$ (' + pnlPct.toFixed(2) + '%) | ' + closed.reason);
                active = null;
                eqCurve.push(deposit);
            }
        }
        
        // ─── ОТКРЫТИЕ НОВОЙ СДЕЛКИ ───
        if (!active) {
            var side = null;
            if (condShort[i] && (!sideFilter || sideFilter === 'short')) side = 'short';
            else if (condLong[i] && (!sideFilter || sideFilter === 'long')) side = 'long';
            
            if (side) {
                var entry = bar.close;
                var stop, tp1, tp2, tp3;
                var yH = yHighArr[i], yL = yLowArr[i];
                var lmax = lmaxArr[i], lmin = lminArr[i];
                
                if (side === 'short') {
                    stop = !isNaN(yH) ? yH * (1 + slBufferPct / 100) : entry * (1 + slBufferPct / 100);
                    if (stop <= entry) stop = entry * 1.01;
                    
                    if (!isNaN(lmin) && lmin < entry * 0.99) {
                        tp1 = lmin;
                    } else if (!isNaN(yL) && yL < entry * 0.99) {
                        tp1 = yL;
                    } else {
                        tp1 = entry * 0.95;
                    }
                    if (tp1 < entry * 0.95) tp1 = entry * 0.95;
                    
                    var tp2Cand = [];
                    if (!isNaN(yL) && yL < tp1) tp2Cand.push(yL);
                    if (!isNaN(lmin) && lmin < tp1) tp2Cand.push(lmin);
                    tp2 = tp2Cand.length > 0 ? Math.max.apply(null, tp2Cand) : entry * 0.94;
                    if (tp2 >= tp1) tp2 = entry * 0.94;
                    
                    tp3 = entry * 0.94;
                } else {
                    stop = !isNaN(yL) ? yL * (1 - slBufferPct / 100) : entry * (1 - slBufferPct / 100);
                    if (stop >= entry) stop = entry * 0.99;
                    
                    if (!isNaN(lmax) && lmax > entry * 1.01) {
                        tp1 = lmax;
                    } else if (!isNaN(yH) && yH > entry * 1.01) {
                        tp1 = yH;
                    } else {
                        tp1 = entry * 1.05;
                    }
                    if (tp1 > entry * 1.05) tp1 = entry * 1.05;
                    
                    var tp2CandL = [];
                    if (!isNaN(yH) && yH > tp1) tp2CandL.push(yH);
                    if (!isNaN(lmax) && lmax > tp1) tp2CandL.push(lmax);
                    tp2 = tp2CandL.length > 0 ? Math.min.apply(null, tp2CandL) : entry * 1.06;
                    if (tp2 <= tp1) tp2 = entry * 1.06;
                    
                    tp3 = entry * 1.06;
                }
                
                var valid = !isNaN(stop) && !isNaN(tp1) && !isNaN(tp2) && !isNaN(tp3);
                if (side === 'short') valid = valid && stop > entry && tp1 < entry;
                else valid = valid && stop < entry && tp1 > entry;
                
                if (!valid) {
                    skipped++;
                    if (!quiet) console.warn('⚠️ Skip ' + side + ' bar#' + i + ' | stop=' + stop.toFixed(2) + ' tp1=' + tp1.toFixed(2));
                } else {
                    var riskUSD = deposit * (riskPct / 100);
                    active = { idx: i, side: side, entry: entry, stop: stop, tp1: tp1, tp2: tp2, tp3: tp3, size: riskUSD / Math.abs(entry - stop) };
                    if (!quiet) console.log('📥 OPEN ' + side.toUpperCase() + ' #bar' + i + ' | entry=' + entry.toFixed(4) + ' | SL=' + stop.toFixed(4) + ' | TP1=' + tp1.toFixed(4) + ' | TP2=' + tp2.toFixed(4));
                }
            }
        }
    }
    
    // ===== МЕТРИКИ =====
    var netPnl = deposit - startDeposit;
    var winrate = trades.length > 0 ? (wins / trades.length * 100) : 0;
    var grossWin = trades.filter(function(t){ return t.pnl > 0; }).reduce(function(s, t){ return s + t.pnl; }, 0);
    var grossLoss = Math.abs(trades.filter(function(t){ return t.pnl < 0; }).reduce(function(s, t){ return s + t.pnl; }, 0));
    var pf = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0);
    var peak = startDeposit, maxDD = 0;
    eqCurve.forEach(function(v){ if (v>peak) peak=v; var dd=peak-v; if(dd>maxDD) maxDD=dd; });
    var rs = trades.map(function(t){ var r = Math.abs(t.entry - t.stop) * t.size; return r>0 ? t.pnl/r : 0; });
    var avgR = rs.length > 0 ? rs.reduce(function(a,b){return a+b;},0)/rs.length : 0;
    var avgDur = trades.length > 0 ? trades.reduce(function(s,t){return s+t.duration;},0)/trades.length : 0;
    
    // Статистика по reason
    var byReason = { SL: 0, TP1: 0, TP2: 0, TP3: 0, END_OF_DAY: 0, TIMEOUT: 0 };
    trades.forEach(function(t){ byReason[t.reason] = (byReason[t.reason]||0) + 1; });
    
    // ===== ВЫВОД =====
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 РЕЗУЛЬТАТЫ v10 (внутридневной)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Сигналов: 🔴 SHORT=' + cntShort + ' | 🟢 LONG=' + cntLong);
    console.log('  Сделок: ' + trades.length + ' (пропущено: ' + skipped + ')');
    console.log('    ✅ W:' + wins + ' ❌ L:' + losses + ' ⚪ BE:' + breakeven + ' | Winrate: ' + winrate.toFixed(1) + '%');
    console.log('  ─────────────────────────────────');
    console.log('  Выходы: SL=' + byReason.SL + ' TP1=' + byReason.TP1 + ' TP2=' + byReason.TP2 + ' TP3=' + byReason.TP3 + ' END_OF_DAY=' + byReason.END_OF_DAY + ' TIMEOUT=' + byReason.TIMEOUT);
    console.log('  ─────────────────────────────────');
    console.log('  Депозит: ' + startDeposit.toFixed(2) + ' → ' + deposit.toFixed(2));
    console.log('  P&L: ' + (netPnl>=0?'+':'') + netPnl.toFixed(2) + '$ (' + (netPnl/startDeposit*100).toFixed(2) + '%)');
    console.log('  Max DD: ' + maxDD.toFixed(2) + '$ | PF: ' + (pf===Infinity?'∞':pf.toFixed(2)) + ' | Avg R: ' + avgR.toFixed(2) + ' | Avg dur: ' + avgDur.toFixed(0) + ' баров');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Лучшие/худшие
    if (trades.length > 0) {
        var best = trades.slice().sort(function(a,b){ return b.pnl - a.pnl; }).slice(0, 3);
        var worst = trades.slice().sort(function(a,b){ return a.pnl - b.pnl; }).slice(0, 3);
        console.log('🏆 Лучшие 3:');
        best.forEach(function(t){ console.log('  ' + t.side.toUpperCase() + ' ' + (t.pnl>=0?'+':'') + t.pnl.toFixed(2) + '$ (' + t.pnlPct.toFixed(2) + '%) | ' + t.reason); });
        console.log('💀 Худшие 3:');
        worst.forEach(function(t){ console.log('  ' + t.side.toUpperCase() + ' ' + (t.pnl>=0?'+':'') + t.pnl.toFixed(2) + '$ (' + t.pnlPct.toFixed(2) + '%) | ' + t.reason); });
    }
    
    // 🔍 Диагностика исполнения SL/TP
    if (trades.length > 0) {
        console.log('\n🔍 Проверка SL/TP исполнения (MaxH/MinL vs levels):');
        trades.forEach(function(t) {
            var maxH = -Infinity, minL = Infinity;
            for (var i = t.entryIdx; i <= t.exitIdx; i++) {
                if (chartBars[i].high > maxH) maxH = chartBars[i].high;
                if (chartBars[i].low < minL) minL = chartBars[i].low;
            }
            var slHit = (t.side === 'short' && maxH >= t.stop) || (t.side === 'long' && minL <= t.stop);
            var tpHit = (t.side === 'short' && minL <= t.tp1) || (t.side === 'long' && maxH >= t.tp1);
            var slMargin = t.side === 'short' ? (t.stop - maxH) : (minL - t.stop);
            var tpMargin = t.side === 'short' ? (minL - t.tp1) : (t.tp1 - maxH);
            console.log('  #' + t.id + ' ' + t.side.toUpperCase() + ' | ' + t.reason +
                ' | MaxH=' + maxH.toFixed(2) + ' MinL=' + minL.toFixed(2) +
                ' | SL:' + (slHit ? '✅' : '✗ (' + slMargin.toFixed(2) + ' далеко)') +
                ' TP1:' + (tpHit ? '✅' : '✗ (' + tpMargin.toFixed(2) + ' далеко)'));
        });
    }
    
    // Маркеры
    if (lwcCandleSeries) {
        if (!lwcMarkersHandle) lwcMarkersHandle = LightweightCharts.createSeriesMarkers(lwcCandleSeries, []);
        var markers = [];
        trades.forEach(function(t) {
            markers.push({ time: chartBars[t.entryIdx].time, position: t.side==='short'?'aboveBar':'belowBar', color: t.side==='short'?'#ef4444':'#10b981', shape: t.side==='short'?'arrowDown':'arrowUp', text: (t.side==='short'?'S':'L')+' #'+t.id });
            var exitText = t.reason === 'END_OF_DAY' ? 'EOD' : (t.reason === 'TIMEOUT' ? 'TIME' : (t.pnl>=0?'TP':'SL'));
            markers.push({ time: chartBars[t.exitIdx].time, position: t.side==='short'?'belowBar':'aboveBar', color: t.pnl>=0?'#22c55e':'#dc2626', shape: 'circle', text: exitText });
        });
        markers.sort(function(a,b){return a.time-b.time;});
        lwcMarkersHandle.setMarkers(markers);
    }
    
    // Автопрокрутка
    if (trades.length > 0) {
        lwcChart.timeScale().setVisibleLogicalRange({
            from: Math.max(0, trades[0].entryIdx - 20),
            to: Math.min(chartBars.length - 1, trades[trades.length - 1].exitIdx + 20)
        });
    } else {
        lwcChart.timeScale().fitContent();
    }
    
    // Volume
    try {
        if (!window.__stealthVolSeries) {
            var pane1 = lwcChart.panes().length > 1 ? 1 : 1;
            var volSeries = lwcChart.addSeries(LightweightCharts.HistogramSeries, { priceFormat: { type: 'volume' }, color: '#26a69a' }, pane1);
            volSeries.setData(chartBars.map(function(b) { return { time: b.time, value: b.volume || 0, color: b.close >= b.open ? '#26a69a' : '#ef5350' }; }));
            window.__stealthVolSeries = volSeries;
        }
    } catch(e) {}
    
    var result = {
        instrument: currentInstrument, timeframe: selectedTimeframe, bars: chartBars.length,
        config: { riskPct: riskPct, slBufferPct: slBufferPct, tpMode: tpMode, holdBarsMax: holdBarsMax, sideFilter: sideFilter },
        signals: { short: cntShort, long: cntLong },
        trades: trades,
        metrics: { total: trades.length, wins: wins, losses: losses, breakeven: breakeven, winrate: winrate, netPnl: netPnl, netPnlPct: netPnl/startDeposit*100, maxDD: maxDD, pf: pf, avgR: avgR, avgDur: avgDur, skipped: skipped, byReason: byReason },
        eqCurve: eqCurve
    };
    window.__lastBacktestC = result;
    addLog('📊 v10: SHORT=' + cntShort + ' LONG=' + cntLong + ' → ' + trades.length + ' сделок, WR ' + winrate.toFixed(1) + '%, P&L ' + (netPnl>=0?'+':'') + netPnl.toFixed(2) + '$', 'trade');
    console.log('💾 → window.__lastBacktestC');
    console.log('   backtestStealthC.showTrade(1) | showTrades(20) | exportJSON()');
    console.log('══════ ✅ v10 ЗАВЕРШЁН ══════\n');
    return result;
};

// ===== ХЕЛПЕРЫ =====
window.backtestStealthC.showTrade = function(id) {
    if (!window.__lastBacktestC) { console.log('❌ Нет бэктеста'); return; }
    var t = window.__lastBacktestC.trades.find(function(x){ return x.id === id; });
    if (!t) { console.log('❌ Сделка #' + id + ' не найдена'); return; }
    console.log('══════ 🔍 Сделка #' + t.id + ' ══════');
    console.log('  Side:', t.side.toUpperCase());
    console.log('  Entry:', t.entry.toFixed(4), '| Time:', t.entryTime, '| bar#' + t.entryIdx);
    console.log('  Exit: ', t.exit.toFixed(4),  '| Time:', t.exitTime,  '| bar#' + t.exitIdx);
    console.log('  Stop: ', t.stop.toFixed(4));
    console.log('  TP1:  ', t.tp1.toFixed(4), '| TP2:', t.tp2.toFixed(4), '| TP3:', t.tp3.toFixed(4));
    console.log('  Size: ', t.size.toFixed(4));
    console.log('  P&L:  ', (t.pnl>=0?'+':'') + t.pnl.toFixed(2) + '$ (' + t.pnlPct.toFixed(2) + '%)');
    console.log('  Reason:', t.reason, '| Duration:', t.duration, 'баров');
    // Диагностика
    var maxH = -Infinity, minL = Infinity;
    for (var i = t.entryIdx; i <= t.exitIdx; i++) {
        if (chartBars[i].high > maxH) maxH = chartBars[i].high;
        if (chartBars[i].low < minL) minL = chartBars[i].low;
    }
    console.log('  MaxHigh:', maxH.toFixed(4), '| MinLow:', minL.toFixed(4));
    console.log('════════════════════════════════');
};

window.backtestStealthC.showTrades = function(limit) {
    if (!window.__lastBacktestC) { console.log('❌ Нет бэктеста'); return; }
    limit = limit || 20;
    console.log('══════ 📋 СДЕЛКИ (последние ' + limit + ') ══════');
    console.log('#   | Side  | Entry       | Exit        | P&L       | %     | Reason');
    console.log('────┼───────┼─────────────┼─────────────┼───────────┼───────┼────────');
    window.__lastBacktestC.trades.slice(-limit).forEach(function(t) {
        console.log(String(t.id).padEnd(3) + ' | ' + t.side.toUpperCase().padEnd(5) + ' | ' + t.entry.toFixed(4).padStart(11) + ' | ' + t.exit.toFixed(4).padStart(11) + ' | ' + ((t.pnl>=0?'+':'')+t.pnl.toFixed(2)+'$').padStart(9) + ' | ' + ((t.pnlPct>=0?'+':'')+t.pnlPct.toFixed(2)+'%').padStart(5) + ' | ' + t.reason);
    });
    console.log('══════════════════════════════════════════════════════');
};

window.backtestStealthC.exportJSON = function() {
    if (!window.__lastBacktestC) { console.log('❌ Нет бэктеста'); return; }
    var blob = new Blob([JSON.stringify(window.__lastBacktestC, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'stealth_v10_' + currentInstrument + '_' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log('💾 Скачан файл');
};

// ===== ПОДСКАЗКИ =====
console.log('✅ Вариант C v10 загружен.');
console.log('   📌 Отличия от v9:');
console.log('     • Таймаут = END_OF_DAY (конец дня UTC входа) вместо 100 баров');
console.log('     • SL по умолчанию 0.5% (было 2.0%) — ближе к шаблону');
console.log('     • Диагностика исполнения SL/TP в конце');
console.log('');
console.log('   Запуск: await backtestStealthC()');
console.log('   Примеры:');
console.log('     await backtestStealthC({ slBufferPct: 1.0 })   — SL шире');
console.log('     await backtestStealthC({ tpMode: "tp2" })      — TP2 как цель');
console.log('     await backtestStealthC({ sideFilter: "short" }) — только SHORT');
console.log('');
console.log('   Хелперы: backtestStealthC.showTrade(1) | showTrades(20) | exportJSON()');