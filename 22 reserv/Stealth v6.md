window.runStealthAv6 = async function() {
    console.log('══════ 🚀 STEALTH A v6 СТАРТ ══════');
    
    // ═══════════ 0. ВСТРОЕННЫЕ ХЕЛПЕРЫ ═══════════
    window.showSignals = function(shortIdx, longIdx) {
        if (!lwcCandleSeries) { addLog('❌ Нет свечной серии', 'error'); return; }
        if (!lwcMarkersHandle) {
            lwcMarkersHandle = LightweightCharts.createSeriesMarkers(lwcCandleSeries, []);
        }
        var markers = [];
        (shortIdx || []).forEach(function(idx) {
            if (!chartBars[idx]) return;
            markers.push({ time: chartBars[idx].time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'S' });
        });
        (longIdx || []).forEach(function(idx) {
            if (!chartBars[idx]) return;
            markers.push({ time: chartBars[idx].time, position: 'belowBar', color: '#10b981', shape: 'arrowUp', text: 'L' });
        });
        markers.sort(function(a, b) { return a.time - b.time; });
        lwcMarkersHandle.setMarkers(markers);
        addLog('🎯 Показано ' + (shortIdx || []).length + ' SHORT + ' + (longIdx || []).length + ' LONG', 'info');
    };
    
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
    
    // ═══════════ 1. ОЧИСТКА ═══════════
    if (typeof cleanChart === 'function') {
        try { cleanChart(); } catch(e) { console.warn('cleanChart:', e); }
    } else {
        if (lwcMarkersHandle) { try { lwcMarkersHandle.setMarkers([]); } catch(e){} }
        if (typeof pineVizHandle !== 'undefined' && pineVizHandle) { try { pineVizHandle.remove(); } catch(e){} pineVizHandle = null; }
        // ── Очистка линий уровней ──
        if (window.__levelLines) {
            window.__levelLines.forEach(function(l){ try { lwcCandleSeries.removePriceLine(l); } catch(e){} });
            window.__levelLines = [];
        }
        try {
            var panes = lwcChart.panes();
            for (var pi = panes.length - 1; pi >= 0; pi--) {
                var series = panes[pi].getSeries();
                for (var si = series.length - 1; si >= 0; si--) {
                    if (series[si] === lwcCandleSeries) continue;
                    try { lwcChart.removeSeries(series[si]); } catch(e){}
                }
                if (pi > 0 && panes[pi].getSeries().length === 0) {
                    try { lwcChart.removePane(pi); } catch(e){}
                }
            }
        } catch(e) {}
        window.__stealthVolSeries = null;
        addLog('🧹 График очищен (fallback)', 'info');
    }
    
    // ═══════════ 2. ТФ 15m ═══════════
    if (selectedTimeframe !== '15m') {
        addLog('⚠️ Переключаем на 15m (шаблонный ТФ)...', 'info');
        var tfSel = $('timeframeSelect');
        if (tfSel) { tfSel.value = '15m'; tfSel.dispatchEvent(new Event('change')); }
        await new Promise(function(r){ setTimeout(r, 3500); });
    }
    if (typeof chartBars === 'undefined' || chartBars.length < 100) {
        addLog('⚠️ Недостаточно данных: ' + (chartBars?.length || 0), 'error');
        return;
    }
    console.log('  Данные: ' + chartBars.length + ' баров | ' + currentInstrument + ' 15m');
    
    // ═══════════ 3. PINE-СКРИПТ (4 линии + правильные TP1) ═══════════
    P(`
// ==================== 4 ЛИНИИ ====================
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

// ==================== СИГНАЛЫ (синхрон с B v6 / C v10) ====================
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

// ==================== SL / TP (по C v10) ====================
slBuf = 0.5 / 100

// SHORT
stopS = yesterdayHigh * (1 + slBuf)
entryShort = close
tp1S_localMin = not na(localMinD) and localMinD < entryShort * 0.99 ? localMinD : na
tp1S_yLow     = yesterdayLow < entryShort * 0.99 ? yesterdayLow : na
tp1S_fallback = entryShort * 0.95
tp1S_temp     = not na(tp1S_localMin) ? tp1S_localMin : (not na(tp1S_yLow) ? tp1S_yLow : tp1S_fallback)
tp1S          = tp1S_temp < entryShort * 0.95 ? entryShort * 0.95 : tp1S_temp
tp2S          = yesterdayLow

// LONG
stopL = yesterdayLow * (1 - slBuf)
entryLong = close
tp1L_localMax = not na(localMaxD) and localMaxD > entryLong * 1.01 ? localMaxD : na
tp1L_yHigh    = yesterdayHigh > entryLong * 1.01 ? yesterdayHigh : na
tp1L_fallback = entryLong * 1.05
tp1L_temp     = not na(tp1L_localMax) ? tp1L_localMax : (not na(tp1L_yHigh) ? tp1L_yHigh : tp1L_fallback)
tp1L          = tp1L_temp > entryLong * 1.05 ? entryLong * 1.05 : tp1L_temp
tp2L          = yesterdayHigh

// ==================== ВИЗУАЛИЗАЦИЯ ====================
plot(yesterdayHigh, "Yesterday High", color.blue, 2)
plot(yesterdayLow,  "Yesterday Low",  color.blue, 2)
plot(localMaxD,     "Local Max",      color.red,  1, plot.style_linebr)
plot(localMinD,     "Local Min",      color.red,  1, plot.style_linebr)

plotshape(shortSignal, "SHORT",  shape.labeldown, location.abovebar, color.red,   size=size.normal, text="SHORT")
plotshape(shortSignal, "S-SL",   shape.xcross,    location.abovebar, color.red,   size=size.tiny,   text="SL="  + str.tostring(stopS, "#.##"))
plotshape(shortSignal, "S-TP1",  shape.circle,    location.abovebar, color.lime,  size=size.tiny,   text="TP1=" + str.tostring(tp1S,  "#.##"))
plotshape(shortSignal, "S-TP2",  shape.circle,    location.abovebar, color.aqua,  size=size.tiny,   text="TP2=" + str.tostring(tp2S,  "#.##"))

plotshape(longSignal,  "LONG",   shape.labelup,   location.belowbar, color.green, size=size.normal, text="LONG")
plotshape(longSignal,  "L-SL",   shape.xcross,    location.belowbar, color.red,   size=size.tiny,   text="SL="  + str.tostring(stopL, "#.##"))
plotshape(longSignal,  "L-TP1",  shape.circle,    location.belowbar, color.lime,  size=size.tiny,   text="TP1=" + str.tostring(tp1L,  "#.##"))
plotshape(longSignal,  "L-TP2",  shape.circle,    location.belowbar, color.aqua,  size=size.tiny,   text="TP2=" + str.tostring(tp2L,  "#.##"))
`, {title: 'Stealth v6 (Long+Short + TP-fix)', overlay: true});
    
    // ═══════════ 4. VOLUME-ПАНЕЛЬ ═══════════
    await new Promise(function(r){ setTimeout(r, 200); });
    try {
        if (!window.__stealthVolSeries) {
            var pane1 = lwcChart.panes().length > 1 ? 1 : 1;
            var volSeries = lwcChart.addSeries(LightweightCharts.HistogramSeries, {
                priceFormat: { type: 'volume' }, color: '#26a69a'
            }, pane1);
            volSeries.setData(chartBars.map(function(b) {
                return { time: b.time, value: b.volume || 0, color: b.close >= b.open ? '#26a69a' : '#ef5350' };
            }));
            window.__stealthVolSeries = volSeries;
            addLog('📊 Volume-панель (' + chartBars.length + ' баров)', 'info');
        }
    } catch(e) { console.warn('volume:', e); }
    
    // ═══════════ 5. ПОИСК СИГНАЛОВ + МАРКЕРЫ ═══════════
    await new Promise(function(r){ setTimeout(r, 300); });
    try {
        var signalSrc = `//@version=6
indicator("stealth v6 diag", overlay=true)
yHigh = request.security(syminfo.tickerid, "D", high[0])
yLow  = request.security(syminfo.tickerid, "D", low[0])
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
plotshape(longSig,  "LONG",  shape.labelup,   location.belowbar, color.green)`;
        
        var tr = ResinBridge.transpile(signalSrc);
        if (!tr.ok) { addLog('❌ Pine diag: ' + tr.errors.join('; '), 'error'); return; }
        
        var runDiag = ResinBridge.run(tr, {
            time: chartBars.map(function(b){ return b.time * 1000; }),
            open: chartBars.map(function(b){ return b.open; }),
            high: chartBars.map(function(b){ return b.high; }),
            low:  chartBars.map(function(b){ return b.low; }),
            close:chartBars.map(function(b){ return b.close; }),
            volume:chartBars.map(function(b){ return b.volume || 0; })
        });
        
        if (!runDiag.viz.shapes || runDiag.viz.shapes.length < 2) {
            addLog('❌ Нет shapes в Pine-результате', 'error');
            return;
        }
        
        var shortIdx = [], longIdx = [];
        var condShort = runDiag.viz.shapes[0].condition;
        var condLong  = runDiag.viz.shapes[1].condition;
        for (var i = 0; i < condShort.length; i++) if (condShort[i]) shortIdx.push(i);
        for (var i = 0; i < condLong.length; i++)  if (condLong[i])  longIdx.push(i);
        
        showSignals(shortIdx, longIdx);
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 STEALTH A v6:');
        console.log('  🔴 SHORT: ' + shortIdx.length + ' | 🟢 LONG: ' + longIdx.length);
        if (shortIdx.length > 0) {
            console.log('  Последние SHORT:');
            shortIdx.slice(-5).forEach(function(idx){
                var b = chartBars[idx];
                console.log('    S bar#' + idx + ' | ' + new Date(b.time*1000).toLocaleString() + ' | close=' + b.close.toFixed(2));
            });
        }
        if (longIdx.length > 0) {
            console.log('  Последние LONG:');
            longIdx.slice(-5).forEach(function(idx){
                var b = chartBars[idx];
                console.log('    L bar#' + idx + ' | ' + new Date(b.time*1000).toLocaleString() + ' | close=' + b.close.toFixed(2));
            });
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // ═══════════ 6. АВТОПРОКРУТКА + УРОВНИ ═══════════
        var lastSignalIdx = -1;
        var lastSide = null;
        if (shortIdx.length > 0) {
            var lastShort = shortIdx[shortIdx.length - 1];
            if (lastShort > lastSignalIdx) { lastSignalIdx = lastShort; lastSide = 'short'; }
        }
        if (longIdx.length > 0) {
            var lastLong = longIdx[longIdx.length - 1];
            if (lastLong > lastSignalIdx) { lastSignalIdx = lastLong; lastSide = 'long'; }
        }
        
        if (lastSignalIdx >= 0) {
            var fromIdx = Math.max(0, lastSignalIdx - 100);
            var toIdx   = Math.min(chartBars.length - 1, lastSignalIdx + 30);
            lwcChart.timeScale().setVisibleLogicalRange({ from: fromIdx, to: toIdx });
            
            var b = chartBars[lastSignalIdx];
            var yHigh = NaN, yLow = NaN, localMax = NaN, localMin = NaN;
            try {
                var linesSrc = `//@version=6
indicator("yl", overlay=true)
yH = request.security(syminfo.tickerid, "D", high[0])
yL = request.security(syminfo.tickerid, "D", low[0])
localMaxRaw = ta.pivothigh(high, 20, 20)
localMinRaw = ta.pivotlow(low, 20, 20)
var float localMaxD = na
var float localMinD = na
if not na(localMaxRaw)
    localMaxD := localMaxRaw
if not na(localMinRaw)
    localMinD := localMinRaw
plot(yH, "yH", color.blue)
plot(yL, "yL", color.blue)
plot(localMaxD, "localMaxD", color.red)
plot(localMinD, "localMinD", color.red)`;
                var trL = ResinBridge.transpile(linesSrc);
                var runL = ResinBridge.run(trL, {
                    time: chartBars.map(function(x){ return x.time * 1000; }),
                    open: chartBars.map(function(x){ return x.open; }),
                    high: chartBars.map(function(x){ return x.high; }),
                    low:  chartBars.map(function(x){ return x.low; }),
                    close:chartBars.map(function(x){ return x.close; }),
                    volume:chartBars.map(function(x){ return x.volume || 0; })
                });
                yHigh   = runL.plots.find(function(p){ return p.title === 'yH'; }).values[lastSignalIdx];
                yLow    = runL.plots.find(function(p){ return p.title === 'yL'; }).values[lastSignalIdx];
                localMax = runL.plots.find(function(p){ return p.title === 'localMaxD'; }).values[lastSignalIdx];
                localMin = runL.plots.find(function(p){ return p.title === 'localMinD'; }).values[lastSignalIdx];
            } catch(e) { console.warn('restore levels:', e); }
            
            var slBuf = 0.005;
            var stop, tp1, tp2;
            
            if (lastSide === 'short') {
                stop = yHigh * (1 + slBuf);
                if (!isNaN(localMin) && localMin < b.close * 0.99) {
                    tp1 = localMin;
                } else if (!isNaN(yLow) && yLow < b.close * 0.99) {
                    tp1 = yLow;
                } else {
                    tp1 = b.close * 0.95;
                }
                if (tp1 < b.close * 0.95) tp1 = b.close * 0.95;
                tp2 = yLow;
                showLevels(lastSignalIdx, 'short', b.close, stop, tp1, tp2);
                addLog('📉 SHORT @ ' + b.close.toFixed(2) + ' | SL=' + stop.toFixed(2) + ' | TP1=' + tp1.toFixed(2) + ' | TP2=' + tp2.toFixed(2), 'signal');
            } else {
                stop = yLow * (1 - slBuf);
                if (!isNaN(localMax) && localMax > b.close * 1.01) {
                    tp1 = localMax;
                } else if (!isNaN(yHigh) && yHigh > b.close * 1.01) {
                    tp1 = yHigh;
                } else {
                    tp1 = b.close * 1.05;
                }
                if (tp1 > b.close * 1.05) tp1 = b.close * 1.05;
                tp2 = yHigh;
                showLevels(lastSignalIdx, 'long', b.close, stop, tp1, tp2);
                addLog('📈 LONG @ ' + b.close.toFixed(2) + ' | SL=' + stop.toFixed(2) + ' | TP1=' + tp1.toFixed(2) + ' | TP2=' + tp2.toFixed(2), 'signal');
            }
            
            console.log('🎯 Прокрутка к bar#' + lastSignalIdx + ' (' + lastSide.toUpperCase() + ')');
        } else {
            lwcChart.timeScale().fitContent();
            addLog('ℹ️ Сигналов нет (шаблон редкий). Весь график.', 'info');
            console.log('ℹ️ Сигналов нет — показан весь график');
        }
        
        addLog('✅ A v6: ' + shortIdx.length + ' SHORT + ' + longIdx.length + ' LONG | 4 линии + volume', 'pine');
        console.log('══════ ✅ STEALTH A v6 ЗАВЕРШЁН ══════');
        
    } catch(e) {
        console.error('FATAL:', e);
        addLog('❌ Ошибка A v6: ' + e.message, 'error');
    }
};

// ═══════════ АВТО-ЗАПУСК + ПОДСКАЗКИ ═══════════
console.log('✅ A v6: зарегистрирован (window.runStealthAv6) — можно вызывать повторно');
window.runStealthAv6();