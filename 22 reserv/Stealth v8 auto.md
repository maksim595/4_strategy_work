// ═══════════════════════════════════════════════════════
// A v8 — визуализация с автообновлением + хелперы
// ═══════════════════════════════════════════════════════
window.runStealthAv8 = async function(opts) {
    opts = opts || {};
    var minRR = opts.minRR !== undefined ? opts.minRR : 1.5;
    var minRange = opts.minRange !== undefined ? opts.minRange : 1.5;
    var sessionFilter = opts.sessionFilter !== false;
    var sessionStartH = opts.sessionStartH !== undefined ? opts.sessionStartH : 14;
    var sessionStartM = opts.sessionStartM !== undefined ? opts.sessionStartM : 30;
    var sessionEndH = opts.sessionEndH !== undefined ? opts.sessionEndH : 20;
    var slBufferPct = opts.slBufferPct !== undefined ? opts.slBufferPct : 0.5;
    var showRejected = opts.showRejected !== false;
    var notifyTelegram = opts.notifyTelegram === true;
    var silent = opts.silent === true;

    if (!silent) {
        console.log('══════ 🚀 STEALTH A v8 (фильтры + автообновление) ══════');
        console.log('  minRR=' + minRR + ' | minRange=' + minRange + '% | session=' + sessionFilter);
    }

    // ═══════ 0. ВСТРОЕННЫЕ ХЕЛПЕРЫ ═══════
    window.showLevels = function(idx, side, entry, stop, tp1, tp2) {
        if (!lwcCandleSeries) return;
        if (!window.__levelLines) window.__levelLines = [];
        window.__levelLines.forEach(function(l){ try { lwcCandleSeries.removePriceLine(l); } catch(e){} });
        window.__levelLines = [];
        var lines = [
            { price: stop,  color: '#ef4444', title: side.toUpperCase() + ' SL',    lineStyle: 2, lineWidth: 1, axisLabelVisible: true },
            { price: entry, color: '#f59e0b', title: side.toUpperCase() + ' Entry', lineStyle: 0, lineWidth: 1, axisLabelVisible: true },
            { price: tp1,   color: '#10b981', title: side.toUpperCase() + ' TP1',   lineStyle: 2, lineWidth: 1, axisLabelVisible: true },
            { price: tp2,   color: '#0891b2', title: side.toUpperCase() + ' TP2',   lineStyle: 2, lineWidth: 1, axisLabelVisible: true }
        ];
        lines.forEach(function(l){
            try { window.__levelLines.push(lwcCandleSeries.createPriceLine(l)); } catch(e){}
        });
        addLog('📏 Уровни ' + side.toUpperCase() + ' #' + idx + ' показаны', 'info');
    };

    // ═══════ ОЧИСТКА ═══════
    if (typeof cleanChart === 'function') { try { cleanChart(); } catch(e) {} }
    // ── Очистка линий уровней ──
    if (window.__levelLines) {
        window.__levelLines.forEach(function(l){ try { lwcCandleSeries.removePriceLine(l); } catch(e){} });
        window.__levelLines = [];
    }

    if (selectedTimeframe !== '15m') {
        var tfSel = $('timeframeSelect');
        if (tfSel) { tfSel.value = '15m'; tfSel.dispatchEvent(new Event('change')); }
        await new Promise(function(r){ setTimeout(r, 3500); });
    }
    if (typeof chartBars === 'undefined' || chartBars.length < 100) {
        addLog('⚠️ Недостаточно данных', 'error');
        return null;
    }

    // ═══════ PINE (линии) ═══════
    P(`
yesterdayHigh = request.security(syminfo.tickerid, "D", high[0])
yesterdayLow  = request.security(syminfo.tickerid, "D", low[0])
localMaxRaw = ta.pivothigh(high, 20, 20)
localMinRaw = ta.pivotlow(low, 20, 20)
var float localMaxD = na
var float localMinD = na
if not na(localMaxRaw)
    localMaxD := localMaxRaw
if not na(localMinRaw)
    localMinD := localMinRaw
plot(yesterdayHigh, "Yesterday High", color.blue, 2)
plot(yesterdayLow,  "Yesterday Low",  color.blue, 2)
plot(localMaxD,     "Local Max",      color.red,  1, plot.style_linebr)
plot(localMinD,     "Local Min",      color.red,  1, plot.style_linebr)
`, {title: 'Stealth v8 lines', overlay: true});

    // Volume
    await new Promise(function(r){ setTimeout(r, 200); });
    try {
        if (!window.__stealthVolSeries) {
            var pane1 = lwcChart.panes().length > 1 ? 1 : 1;
            var vs = lwcChart.addSeries(LightweightCharts.HistogramSeries, { priceFormat: { type: 'volume' }, color: '#26a69a' }, pane1);
            vs.setData(chartBars.map(function(b) { return { time: b.time, value: b.volume || 0, color: b.close >= b.open ? '#26a69a' : '#ef5350' }; }));
            window.__stealthVolSeries = vs;
        }
    } catch(e) {}

    // ═══════ СИГНАЛЫ + ФИЛЬТРЫ ═══════
    await new Promise(function(r){ setTimeout(r, 300); });
    var signalSrc = `//@version=6
indicator("diag", overlay=true)
yHigh = request.security(syminfo.tickerid, "D", high[0])
yLow  = request.security(syminfo.tickerid, "D", low[0])
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
shortSig = touchUpper and red3 and lowerCloseS and volGrowS and noLowBreak

touchLower  = low <= yLow and close > yLow
green3      = close > open and close[1] > open[1] and close[2] > open[2]
higherClose = close[2] > close[3]
volGrowL    = volume[2] > volume[3]
noHighBreak = high < yHigh
longSig = touchLower and green3 and higherClose and volGrowL and noHighBreak

// ═══════ SL / TP (как в backtestStealthC) ═══════
slBuf = 0.5 / 100
// SHORT
stopS = yHigh * (1 + slBuf)
tp1S_localMin = not na(localMinD) and localMinD < close * 0.99 ? localMinD : na
tp1S_yLow     = yLow < close * 0.99 ? yLow : na
tp1S_fallback = close * 0.95
tp1S_temp     = not na(tp1S_localMin) ? tp1S_localMin : (not na(tp1S_yLow) ? tp1S_yLow : tp1S_fallback)
tp1S          = tp1S_temp < close * 0.95 ? close * 0.95 : tp1S_temp
tp2S          = yLow
// LONG
stopL = yLow * (1 - slBuf)
tp1L_localMax = not na(localMaxD) and localMaxD > close * 1.01 ? localMaxD : na
tp1L_yHigh    = yHigh > close * 1.01 ? yHigh : na
tp1L_fallback = close * 1.05
tp1L_temp     = not na(tp1L_localMax) ? tp1L_localMax : (not na(tp1L_yHigh) ? tp1L_yHigh : tp1L_fallback)
tp1L          = tp1L_temp > close * 1.05 ? close * 1.05 : tp1L_temp
tp2L          = yHigh

// ═══════ ВИЗУАЛИЗАЦИЯ ═══════
plotshape(shortSig, "SHORT", shape.labeldown, location.abovebar, color.red, size=size.normal, text="SHORT")
plotshape(shortSig, "S-SL", shape.xcross, location.abovebar, color.red, size=size.tiny, text="SL=" + str.tostring(stopS, "#.##"))
plotshape(shortSig, "S-TP1", shape.circle, location.abovebar, color.lime, size=size.tiny, text="TP1=" + str.tostring(tp1S, "#.##"))
plotshape(shortSig, "S-TP2", shape.circle, location.abovebar, color.aqua, size=size.tiny, text="TP2=" + str.tostring(tp2S, "#.##"))

plotshape(longSig, "LONG", shape.labelup, location.belowbar, color.green, size=size.normal, text="LONG")
plotshape(longSig, "L-SL", shape.xcross, location.belowbar, color.red, size=size.tiny, text="SL=" + str.tostring(stopL, "#.##"))
plotshape(longSig, "L-TP1", shape.circle, location.belowbar, color.lime, size=size.tiny, text="TP1=" + str.tostring(tp1L, "#.##"))
plotshape(longSig, "L-TP2", shape.circle, location.belowbar, color.aqua, size=size.tiny, text="TP2=" + str.tostring(tp2L, "#.##"))

plot(yHigh, "yHigh", color.blue)
plot(yLow,  "yLow",  color.blue)
plot(localMaxD, "localMax", color.red)
plot(localMinD, "localMin", color.red)`;

    var tr = ResinBridge.transpile(signalSrc);
    if (!tr.ok) { addLog('❌ Pine: ' + tr.errors.join('; '), 'error'); return null; }

    var run = ResinBridge.run(tr, {
        time: chartBars.map(function(b){ return b.time * 1000; }),
        open: chartBars.map(function(b){ return b.open; }),
        high: chartBars.map(function(b){ return b.high; }),
        low:  chartBars.map(function(b){ return b.low; }),
        close:chartBars.map(function(b){ return b.close; }),
        volume:chartBars.map(function(b){ return b.volume || 0; })
    });

    var condShort = run.viz.shapes[0].condition;
    var condLong  = run.viz.shapes[1].condition;
    var yHighArr = run.plots.find(function(p){ return p.title === 'yHigh'; }).values;
    var yLowArr  = run.plots.find(function(p){ return p.title === 'yLow'; }).values;
    var lmaxArr  = run.plots.find(function(p){ return p.title === 'localMax'; }).values;
    var lminArr  = run.plots.find(function(p){ return p.title === 'localMin'; }).values;

    // ═══════ ПРИМЕНЕНИЕ ФИЛЬТРОВ ═══════
    var passedShort = [], passedLong = [], rejected = [];
    var stats = { range: 0, session: 0, rr: 0, invalid: 0 };

    function checkSignal(side, idx) {
        var bar = chartBars[idx];
        var yH = yHighArr[idx], yL = yLowArr[idx];
        if (isNaN(yH) || isNaN(yL) || yL <= 0) { stats.invalid++; return { pass: false, reason: 'invalid' }; }

        var rangeWidth = (yH - yL) / yL * 100;
        if (rangeWidth < minRange) { stats.range++; return { pass: false, reason: 'range(' + rangeWidth.toFixed(1) + '%)' }; }

        if (sessionFilter) {
            var d = new Date(bar.time * 1000);
            var hMSK = (d.getUTCHours() + 3) % 24;
            var mMSK = d.getUTCMinutes();
            var tMin = hMSK * 60 + mMSK;
            if (tMin < sessionStartH * 60 + sessionStartM || tMin >= sessionEndH * 60) {
                stats.session++;
                return { pass: false, reason: 'session(' + hMSK + ':' + String(mMSK).padStart(2,'0') + ')' };
            }
        }

        var entry = bar.close;
        var stop, tp1;
        var lmax = lmaxArr[idx], lmin = lminArr[idx];

        if (side === 'short') {
            stop = yH * (1 + slBufferPct / 100);
            if (!isNaN(lmin) && lmin < entry * 0.99) tp1 = lmin;
            else if (yL < entry * 0.99) tp1 = yL;
            else tp1 = entry * 0.95;
            if (tp1 < entry * 0.95) tp1 = entry * 0.95;
        } else {
            stop = yL * (1 - slBufferPct / 100);
            if (!isNaN(lmax) && lmax > entry * 1.01) tp1 = lmax;
            else if (yH > entry * 1.01) tp1 = yH;
            else tp1 = entry * 1.05;
            if (tp1 > entry * 1.05) tp1 = entry * 1.05;
        }

        var valid = !isNaN(stop) && !isNaN(tp1);
        if (side === 'short') valid = valid && stop > entry && tp1 < entry;
        else valid = valid && stop < entry && tp1 > entry;
        if (!valid) { stats.invalid++; return { pass: false, reason: 'invalid' }; }

        var rr = side === 'short' ? (entry - tp1) / (stop - entry) : (tp1 - entry) / (entry - stop);
        if (rr < minRR) { stats.rr++; return { pass: false, reason: 'RR(' + rr.toFixed(1) + ')' }; }

        return { pass: true, entry: entry, stop: stop, tp1: tp1, rr: rr };
    }

    for (var i = 0; i < condShort.length; i++) {
        if (!condShort[i]) continue;
        var r = checkSignal('short', i);
        if (r.pass) passedShort.push({ idx: i, entry: r.entry, stop: r.stop, tp1: r.tp1, rr: r.rr });
        else rejected.push({ idx: i, side: 'short', reason: r.reason });
    }
    for (var i = 0; i < condLong.length; i++) {
        if (!condLong[i]) continue;
        var r = checkSignal('long', i);
        if (r.pass) passedLong.push({ idx: i, entry: r.entry, stop: r.stop, tp1: r.tp1, rr: r.rr });
        else rejected.push({ idx: i, side: 'long', reason: r.reason });
    }

    if (!silent) {
        console.log('  Прошли фильтры: 🔴 SHORT=' + passedShort.length + ' | 🟢 LONG=' + passedLong.length);
        console.log('  Отсеяно: range=' + stats.range + ' session=' + stats.session + ' RR=' + stats.rr + ' invalid=' + stats.invalid);
    }

    // ═══════ МАРКЕРЫ ═══════
    if (!lwcMarkersHandle) lwcMarkersHandle = LightweightCharts.createSeriesMarkers(lwcCandleSeries, []);
    var markers = [];
    passedShort.forEach(function(s){
        markers.push({ time: chartBars[s.idx].time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'S ' + s.rr.toFixed(1) });
    });
    passedLong.forEach(function(s){
        markers.push({ time: chartBars[s.idx].time, position: 'belowBar', color: '#10b981', shape: 'arrowUp', text: 'L ' + s.rr.toFixed(1) });
    });
    if (showRejected) {
        rejected.forEach(function(s){
            markers.push({
                time: chartBars[s.idx].time,
                position: s.side === 'short' ? 'aboveBar' : 'belowBar',
                color: '#94a3b8', shape: 'square', text: '✕ ' + s.reason
            });
        });
    }
    markers.sort(function(a,b){ return a.time - b.time; });
    lwcMarkersHandle.setMarkers(markers);

    // ═══════ УРОВНИ НА ПОСЛЕДНЕМ ПРОШЕДШЕМ ═══════
    var allPassed = passedShort.map(function(s){ return { idx: s.idx, side: 'short', entry: s.entry, stop: s.stop, tp1: s.tp1, tp2: s.tp2 }; })
        .concat(passedLong.map(function(s){ return { idx: s.idx, side: 'long', entry: s.entry, stop: s.stop, tp1: s.tp1, tp2: s.tp2 }; }));
    allPassed.sort(function(a,b){ return b.idx - a.idx; });

    if (allPassed.length > 0) {
        var last = allPassed[0];
        if (typeof showLevels === 'function') {
            showLevels(last.idx, last.side, last.entry, last.stop, last.tp1, last.tp2);
        } else {
            if (window.__levelLines) window.__levelLines.forEach(function(l){ try { lwcCandleSeries.removePriceLine(l); } catch(e){} });
            window.__levelLines = [];
            var lines = [
                { price: last.stop, color: '#ef4444', title: last.side.toUpperCase() + ' SL', lineStyle: 2, lineWidth: 1 },
                { price: last.entry, color: '#f59e0b', title: last.side.toUpperCase() + ' Entry', lineStyle: 0, lineWidth: 1 },
                { price: last.tp1, color: '#10b981', title: last.side.toUpperCase() + ' TP1', lineStyle: 2, lineWidth: 1 },
                { price: last.tp2, color: '#0891b2', title: last.side.toUpperCase() + ' TP2', lineStyle: 2, lineWidth: 1 }
            ];
            lines.forEach(function(l){ try { window.__levelLines.push(lwcCandleSeries.createPriceLine(l)); } catch(e){} });
        }
        lwcChart.timeScale().setVisibleLogicalRange({ from: Math.max(0, last.idx - 100), to: Math.min(chartBars.length - 1, last.idx + 30) });
        if (!silent) addLog('📉 Последний ' + last.side.toUpperCase() + ' @ ' + last.entry.toFixed(2) + ' | SL=' + last.stop.toFixed(2) + ' | TP1=' + last.tp1.toFixed(2) + ' | TP2=' + last.tp2.toFixed(2), 'signal');
    } else {
        lwcChart.timeScale().fitContent();
        if (!silent) addLog('ℹ️ Нет сигналов, прошедших фильтры', 'info');
    }

    // ═══════ TELEGRAM (опционально) ═══════
    if (notifyTelegram && allPassed.length > 0) {
        var last = allPassed[0];
        var msg = '🔔 Stealth A v8\n' + currentInstrument + ' ' + selectedTimeframe + '\n' + 
                  last.side.toUpperCase() + ' @ ' + last.entry.toFixed(2) + '\n' +
                  'SL: ' + last.stop.toFixed(2) + '\nTP1: ' + last.tp1.toFixed(2);
        try { sendTgMessage(msg); } catch(e) {}
    }

    if (!silent) {
        addLog('📊 A v8: SHORT=' + passedShort.length + ' LONG=' + passedLong.length + ' (отсеяно: range=' + stats.range + ' session=' + stats.session + ' RR=' + stats.rr + ')', 'pine');
        console.log('══════ ✅ A v8 ЗАВЕРШЁН ══════');
    }

    return { passedShort: passedShort, passedLong: passedLong, rejected: rejected, stats: stats };
};

// ═══════════════════════════════════════════════════════
// ХЕЛПЕРЫ (удобное управление)
// ═══════════════════════════════════════════════════════
window.stealthV8 = {
    // Настройки автообновления
    _autoInterval: null,
    _lastBarTime: 0,
    _renderCount: 0,
    _signalCount: 0,
    _filters: {
        minRR: 1.5,
        minRange: 1.5,
        sessionFilter: true,
        sessionStartH: 14, sessionStartM: 30,
        sessionEndH: 20,
        slBufferPct: 0.5,
        showRejected: true,
        notifyTelegram: false
    },

    // ═══════ РУЧНОЙ ЗАПУСК ═══════
    async refresh() {
        return await runStealthAv8(Object.assign({}, this._filters, { silent: false }));
    },

    // ═══════ СТАРТ АВТООБНОВЛЕНИЯ ═══════
    start(opts) {
        if (opts) Object.assign(this._filters, opts);
        if (this._autoInterval) {
            console.log('⚠️ Автообновление уже запущено. Остановите: stealthV8.stop()');
            return;
        }

        var self = this;
        this._lastBarTime = 0;

        // Первая отрисовка
        this.refresh().then(function(res) {
            if (res) {
                self._lastBarTime = chartBars[chartBars.length - 1]?.time || 0;
            }
        });

        // Проверка раз в минуту — есть ли новая 15m-свеча?
        this._autoInterval = setInterval(async function() {
            if (!Array.isArray(chartBars) || chartBars.length < 2) return;

            var lastBarTime = chartBars[chartBars.length - 1].time;
            if (lastBarTime !== self._lastBarTime) {
                // Новая свеча появилась — перерисовываем
                self._lastBarTime = lastBarTime;
                self._renderCount++;
                console.log('🔄 Автообновление #' + self._renderCount + ' — новая свеча ' + new Date(lastBarTime * 1000).toLocaleString());
                var res = await runStealthAv8(Object.assign({}, self._filters, { silent: true }));
                if (res && (res.passedShort.length + res.passedLong.length) > 0) {
                    self._signalCount += res.passedShort.length + res.passedLong.length;
                    addLog('🎯 A v8 авто: найдено ' + (res.passedShort.length + res.passedLong.length) + ' сигналов', 'signal');
                }
            }
        }, 60000);

        addLog('🔄 A v8 автообновление запущено (проверка раз в минуту)', 'info');
        console.log('✅ Автообновление запущено.');
        console.log('   Фильтры: ' + JSON.stringify(this._filters));
        console.log('   Остановить: stealthV8.stop()');
        console.log('   Статус: stealthV8.status()');
    },

    // ═══════ СТОП АВТООБНОВЛЕНИЯ ═══════
    stop() {
        if (this._autoInterval) {
            clearInterval(this._autoInterval);
            this._autoInterval = null;
            console.log('⏹️ Автообновление остановлено');
            addLog('⏹️ A v8 автообновление остановлено', 'info');
        } else {
            console.log('ℹ️ Автообновление не запущено');
        }
    },

    // ═══════ СТАТУС ═══════
    status() {
        var running = this._autoInterval !== null;
        var lastBar = chartBars && chartBars.length > 0 
            ? new Date(chartBars[chartBars.length - 1].time * 1000).toLocaleString()
            : '—';
        var lastBarAgo = chartBars && chartBars.length > 0
            ? Math.round((Date.now() - chartBars[chartBars.length - 1].time * 1000) / 60000) + ' мин назад'
            : '—';

        console.log('══════ 📊 A v8 СТАТУС ══════');
        console.log('  Автообновление: ' + (running ? '✅ ЗАПУЩЕНО' : '⏹️ остановлено'));
        console.log('  Символ: ' + currentInstrument + ' | ТФ: ' + selectedTimeframe);
        console.log('  Последняя свеча: ' + lastBar + ' (' + lastBarAgo + ')');
        console.log('  Обновлений: ' + this._renderCount + ' | Найдено сигналов: ' + this._signalCount);
        console.log('  ─── Фильтры ───');
        console.log('    minRR=' + this._filters.minRR + ' | minRange=' + this._filters.minRange + '%');
        console.log('    session=' + this._filters.sessionFilter + ' (' + this._filters.sessionStartH + ':' + 
                    String(this._filters.sessionStartM).padStart(2,'0') + '–' + this._filters.sessionEndH + ':00 МСК)');
        console.log('    slBufferPct=' + this._filters.slBufferPct + '% | showRejected=' + this._filters.showRejected);
        console.log('══════════════════════════════');

        return {
            running: running,
            symbol: currentInstrument,
            timeframe: selectedTimeframe,
            lastBar: lastBar,
            renders: this._renderCount,
            signals: this._signalCount,
            filters: Object.assign({}, this._filters)
        };
    },

    // ═══════ ИЗМЕНИТЬ ФИЛЬТРЫ ═══════
    setFilters(opts) {
        if (!opts) return;
        Object.assign(this._filters, opts);
        console.log('✅ Фильтры обновлены:', JSON.stringify(this._filters));
        addLog('⚙️ A v8 фильтры обновлены', 'settings');
        
        // Перерисовать сразу
        return this.refresh();
    },

    // ═══════ ЭКСПОРТ ═══════
    exportJSON() {
        if (!window.__lastBacktestC && !window.__lastScanResults) {
            console.log('⚠️ Нет сохранённых результатов');
        }
        var data = {
            timestamp: new Date().toISOString(),
            symbol: currentInstrument,
            timeframe: selectedTimeframe,
            filters: Object.assign({}, this._filters),
            stats: {
                renders: this._renderCount,
                signals: this._signalCount
            }
        };
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'stealth_v8_config_' + Date.now() + '.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        console.log('💾 Экспорт конфигурации');
    }
};

// ═══════ ПОДСКАЗКИ ═══════
console.log('✅ A v8 загружен.');
console.log('');
console.log('   📊 Ручной запуск:');
console.log('     await stealthV8.refresh()');
console.log('');
console.log('   🔄 Автообновление (каждые 15m):');
console.log('     stealthV8.start()');
console.log('     stealthV8.stop()');
console.log('     stealthV8.status()');
console.log('');
console.log('   ⚙️ Изменить фильтры:');
console.log('     stealthV8.setFilters({ minRR: 2.0, minRange: 2.0 })');
console.log('     stealthV8.setFilters({ sessionFilter: false })');
console.log('     stealthV8.setFilters({ notifyTelegram: true })');
console.log('');
console.log('   💾 Экспорт:');
console.log('     stealthV8.exportJSON()');