window.runStealthAv7 = async function(opts) {
    opts = opts || {};
    var minRR = opts.minRR !== undefined ? opts.minRR : 1.5;
    var minRange = opts.minRange !== undefined ? opts.minRange : 1.5;
    var sessionFilter = opts.sessionFilter !== false;
    var sessionStartH = opts.sessionStartH !== undefined ? opts.sessionStartH : 14;
    var sessionStartM = opts.sessionStartM !== undefined ? opts.sessionStartM : 30;
    var sessionEndH = opts.sessionEndH !== undefined ? opts.sessionEndH : 20;
    var slBufferPct = opts.slBufferPct !== undefined ? opts.slBufferPct : 0.5;

    console.log('══════ 🚀 STEALTH A v7 (фильтры) ══════');
    console.log('  minRR=' + minRR + ' | minRange=' + minRange + '% | session=' + sessionFilter);
    console.log('');

    // ═══════ ОЧИСТКА ═══════
    if (typeof cleanChart === 'function') { try { cleanChart(); } catch(e) {} }

    if (selectedTimeframe !== '15m') {
        var tfSel = $('timeframeSelect');
        if (tfSel) { tfSel.value = '15m'; tfSel.dispatchEvent(new Event('change')); }
        await new Promise(function(r){ setTimeout(r, 3500); });
    }
    if (typeof chartBars === 'undefined' || chartBars.length < 100) {
        addLog('⚠️ Недостаточно данных', 'error');
        return;
    }
    console.log('  Данные: ' + chartBars.length + ' баров | ' + currentInstrument + ' 15m');

    // ═══════ PINE (линии + сигналы) ═══════
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

touchUpper  = high >= yesterdayHigh and close < yesterdayHigh
red3        = close < open and close[1] < open[1] and close[2] < open[2]
lowerCloseS = close[2] < close[3]
volGrowS    = volume[2] > volume[3]
noLowBreak  = low > yesterdayLow
shortSignal = touchUpper and red3 and lowerCloseS and volGrowS and noLowBreak

touchLower  = low <= yesterdayLow and close > yesterdayLow
green3      = close > open and close[1] > open[1] and close[2] > open[2]
higherClose = close[2] > close[3]
volGrowL    = volume[2] > volume[3]
noHighBreak = high < yesterdayHigh
longSignal  = touchLower and green3 and higherClose and volGrowL and noHighBreak

plot(yesterdayHigh, "Yesterday High", color.blue, 2)
plot(yesterdayLow,  "Yesterday Low",  color.blue, 2)
plot(localMaxD,     "Local Max",      color.red,  1, plot.style_linebr)
plot(localMinD,     "Local Min",      color.red,  1, plot.style_linebr)
`, {title: 'Stealth v7 lines', overlay: true});

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
higherClose = close[2] < close[3]
volGrowL    = volume[2] > volume[3]
noHighBreak = high < yHigh
longSig = touchLower and green3 and higherClose and volGrowL and noHighBreak

plotshape(shortSig, "SHORT", shape.labeldown, location.abovebar, color.red)
plotshape(longSig,  "LONG",  shape.labelup,   location.belowbar, color.green)
plot(yHigh, "yHigh", color.blue)
plot(yLow,  "yLow",  color.blue)
plot(localMaxD, "localMax", color.red)
plot(localMinD, "localMin", color.red)`;

    var tr = ResinBridge.transpile(signalSrc);
    if (!tr.ok) { addLog('❌ Pine: ' + tr.errors.join('; '), 'error'); return; }

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

    console.log('  Прошли фильтры: 🔴 SHORT=' + passedShort.length + ' | 🟢 LONG=' + passedLong.length);
    console.log('  Отсеяно: range=' + stats.range + ' session=' + stats.session + ' RR=' + stats.rr + ' invalid=' + stats.invalid);
    addLog('📊 A v7: SHORT=' + passedShort.length + ' LONG=' + passedLong.length + ' (отсеяно: range=' + stats.range + ' session=' + stats.session + ' RR=' + stats.rr + ')', 'pine');

    // ═══════ МАРКЕРЫ ═══════
    if (!lwcMarkersHandle) lwcMarkersHandle = LightweightCharts.createSeriesMarkers(lwcCandleSeries, []);
    var markers = [];
    passedShort.forEach(function(s){
        markers.push({ time: chartBars[s.idx].time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'S ' + s.rr.toFixed(1) });
    });
    passedLong.forEach(function(s){
        markers.push({ time: chartBars[s.idx].time, position: 'belowBar', color: '#10b981', shape: 'arrowUp', text: 'L ' + s.rr.toFixed(1) });
    });
    rejected.forEach(function(s){
        markers.push({
            time: chartBars[s.idx].time,
            position: s.side === 'short' ? 'aboveBar' : 'belowBar',
            color: '#94a3b8',
            shape: 'square',
            text: '✕ ' + s.reason
        });
    });
    markers.sort(function(a,b){ return a.time - b.time; });
    lwcMarkersHandle.setMarkers(markers);

    // ═══════ УРОВНИ НА ПОСЛЕДНЕМ ПРОШЕДШЕМ ═══════
    var allPassed = passedShort.map(function(s){ return { idx: s.idx, side: 'short', entry: s.entry, stop: s.stop, tp1: s.tp1 }; })
        .concat(passedLong.map(function(s){ return { idx: s.idx, side: 'long', entry: s.entry, stop: s.stop, tp1: s.tp1 }; }));
    allPassed.sort(function(a,b){ return b.idx - a.idx; });

    if (allPassed.length > 0) {
        var last = allPassed[0];
        if (window.__levelLines) window.__levelLines.forEach(function(l){ try { lwcCandleSeries.removePriceLine(l); } catch(e){} });
        window.__levelLines = [];
        var lines = [
            { price: last.stop, color: '#ef4444', title: last.side.toUpperCase() + ' SL', lineStyle: 2, lineWidth: 1 },
            { price: last.entry, color: '#f59e0b', title: last.side.toUpperCase() + ' Entry', lineStyle: 0, lineWidth: 1 },
            { price: last.tp1, color: '#10b981', title: last.side.toUpperCase() + ' TP1', lineStyle: 2, lineWidth: 1 }
        ];
        lines.forEach(function(l){ try { window.__levelLines.push(lwcCandleSeries.createPriceLine(l)); } catch(e){} });
        lwcChart.timeScale().setVisibleLogicalRange({ from: Math.max(0, last.idx - 100), to: Math.min(chartBars.length - 1, last.idx + 30) });
        addLog('📉 Последний ' + last.side.toUpperCase() + ' @ ' + last.entry.toFixed(2) + ' | SL=' + last.stop.toFixed(2) + ' | TP1=' + last.tp1.toFixed(2), 'signal');
    } else {
        lwcChart.timeScale().fitContent();
        addLog('ℹ️ Нет сигналов, прошедших фильтры', 'info');
    }

    console.log('══════ ✅ A v7 ЗАВЕРШЁН ══════');
};

window.runStealthAv7();
console.log('✅ A v7 загружен: window.runStealthAv7()');