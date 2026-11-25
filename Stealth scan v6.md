// ═══════════════════════════════════════════════════════
// ВАРИАНТ B v6 — СКАНЕР 43 МОНЕТ (синхрон с A v5 / C v10)
// ═══════════════════════════════════════════════════════
window.scanStealthB = async function(opts) {
    opts = opts || {};
    var verbose = opts.verbose !== false;
    var autoSwitch = opts.autoSwitch === true;
    var minRR = opts.minRR || 0;
    var maxSymbols = opts.maxSymbols || 43;
    var pauseMs = opts.pauseMs || 100;
    
    console.log('══════════════════════════════════════════════════');
    console.log('🌐 STEALTH B v6 — СКАНЕР (синхрон с A v5)');
    console.log('══════════════════════════════════════════════════');
    console.log('  Опции:', JSON.stringify(opts));
    console.log('');
    
    // ═══════════ 0. ОЧИСТКА ГРАФИКА ═══════════
    if (typeof cleanChart === 'function') {
        try { cleanChart(); } catch(e) { console.warn('cleanChart:', e); }
    } else {
        if (lwcMarkersHandle) { try { lwcMarkersHandle.setMarkers([]); } catch(e){} }
        if (typeof pineVizHandle !== 'undefined' && pineVizHandle) {
            try { pineVizHandle.remove(); } catch(e){}
            pineVizHandle = null;
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
    }
    
    // ═══════════ 1. VOLUME НА ТЕКУЩЕМ СИМВОЛЕ ═══════════
    if (typeof chartBars !== 'undefined' && chartBars.length > 0) {
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
            }
        } catch(e) {}
    }
    
    // ═══════════ 2. СПИСОК СИМВОЛОВ ═══════════
    var symbols = [
        'BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','BNBUSDT','DOGEUSDT','ADAUSDT','TRXUSDT',
        'AVAXUSDT','SHIBUSDT','LTCUSDT','TONUSDT','SUIUSDT','HBARUSDT','NEARUSDT','APTUSDT',
        'OPUSDT','IMXUSDT','INJUSDT','ATOMUSDT','SEIUSDT','RENDERUSDT','FILUSDT','SANDUSDT',
        'MANAUSDT','PEPEUSDT','AAVEUSDT','MKRUSDT','ARBUSDT','FTMUSDT','CHZUSDT','AXSUSDT',
        'ONEUSDT','ENJUSDT','ICPUSDT','THETAUSDT','ALGOUSDT','RUNEUSDT','DOTUSDT','CRVUSDT',
        'KSMUSDT','APEUSDT','RDNTUSDT'
    ].slice(0, maxSymbols);
    
    console.log('📋 Сканирую ' + symbols.length + ' монет (синхрон с A v5)...');
    addLog('🌐 Сканер B v6: ' + symbols.length + ' монет', 'info');
    
    // ═══════════ 3. ФУНКЦИЯ АНАЛИЗА ОДНОГО СИМВОЛА ═══════════
    async function analyzeSymbol(sym) {
        try {
            // 1d × 15 (для pivot 5/5) + 15m × 5 (для сигнала)
            var [r1d, r15m] = await Promise.all([
                fetch('https://api.binance.com/api/v3/klines?symbol=' + sym + '&interval=1d&limit=15').then(function(r){ return r.json(); }),
                fetch('https://api.binance.com/api/v3/klines?symbol=' + sym + '&interval=15m&limit=5').then(function(r){ return r.json(); })
            ]);
            
            if (!Array.isArray(r1d) || r1d.length < 15) {
                return { symbol: sym, error: '1d history < 15' };
            }
            if (!Array.isArray(r15m) || r15m.length < 5) {
                return { symbol: sym, error: '15m history < 5' };
            }
            
            // ===== 4 ЛИНИИ =====
            var yBar = r1d[r1d.length - 2];
            var yHigh = parseFloat(yBar[2]);
            var yLow  = parseFloat(yBar[3]);
            
            // Pivot 5/5 на 1d-барах
            var days = r1d.map(function(k) { return { h: parseFloat(k[2]), l: parseFloat(k[3]) }; });
            var L = 5, R = 5;
            var pivotsHigh = [], pivotsLow = [];
            for (var d = L; d < days.length - R; d++) {
                var isMax = true, isMin = true;
                for (var j = d - L; j <= d + R; j++) {
                    if (j === d) continue;
                    if (days[j].h >= days[d].h) isMax = false;
                    if (days[j].l <= days[d].l) isMin = false;
                }
                if (isMax) pivotsHigh.push({ dayIdx: d, price: days[d].h });
                if (isMin) pivotsLow.push({ dayIdx: d, price: days[d].l });
            }
            var yesterdayIdx = days.length - 2;
            var localMaxPivot = null, localMinPivot = null;
            for (var p = pivotsHigh.length - 1; p >= 0; p--) {
                if (pivotsHigh[p].dayIdx < yesterdayIdx) { localMaxPivot = pivotsHigh[p].price; break; }
            }
            for (var p2 = pivotsLow.length - 1; p2 >= 0; p2--) {
                if (pivotsLow[p2].dayIdx < yesterdayIdx) { localMinPivot = pivotsLow[p2].price; break; }
            }
            
            // ===== 15m БАРЫ (синхрон с A v5) =====
            // r15m[0..3] = 4 последних ЗАКРЫТЫХ бара
            //   b0 = самый старый (close[3] в Pine)
            //   b1 = 3-я свеча (close[2] в Pine)
            //   b2 = 2-я (close[1])
            //   b3 = последний закрытый (close[0] в Pine) — на нём ищем сигнал
            // r15m[4] = текущий незакрытый (игнорируем)
            var bars = r15m.slice(0, 4).map(function(k) {
                return {
                    o: parseFloat(k[1]), h: parseFloat(k[2]), l: parseFloat(k[3]),
                    c: parseFloat(k[4]), v: parseFloat(k[5]),
                    time: parseInt(k[0]),
                    closeTime: parseInt(k[6])
                };
            });
            var b0 = bars[0], b1 = bars[1], b2 = bars[2], b3 = bars[3];
            
            // ===== УСЛОВИЯ SHORT (синхрон с A v5 Pine) =====
            // Pine:   close=b3, close[1]=b2, close[2]=b1, close[3]=b0
            // Pine:   volume[2]=b1.v, volume[3]=b0.v
            var touchUpper  = b3.h >= yHigh && b3.c < yHigh;
            var red3        = b1.c < b1.o && b2.c < b2.o && b3.c < b3.o;
            var lowerCloseS = b1.c < b0.c;             // close[2] < close[3]
            var volGrowS    = b1.v > b0.v;             // volume[2] > volume[3]
            var noLowBreak  = b3.l > yLow;
            var shortSignal = touchUpper && red3 && lowerCloseS && volGrowS && noLowBreak;
            
            // ===== УСЛОВИЯ LONG (синхрон с A v5 Pine) =====
            var touchLower  = b3.l <= yLow && b3.c > yLow;
            var green3      = b1.c > b1.o && b2.c > b2.o && b3.c > b3.o;
            var higherClose = b1.c > b0.c;
            var volGrowL    = b1.v > b0.v;
            var noHighBreak = b3.h < yHigh;
            var longSignal  = touchLower && green3 && higherClose && volGrowL && noHighBreak;
            
            if (!shortSignal && !longSignal) {
                return { symbol: sym, signal: false };
            }
            
            // ===== SL / TP (по C v10) =====
            var entry = b3.c;   // ← синхрон с A v5 (последний закрытый бар)
            var stop, tp1, tp2, tp3, rr, side;
            
            if (shortSignal) {
                side = 'short';
                stop = yHigh * 1.001;
                
                // TP1: localMin если НИЖЕ entry*0.99, иначе yLow если ниже, иначе entry*0.95
                if (localMinPivot !== null && localMinPivot < entry * 0.99) {
                    tp1 = localMinPivot;
                } else if (yLow < entry * 0.99) {
                    tp1 = yLow;
                } else {
                    tp1 = entry * 0.95;
                }
                if (tp1 < entry * 0.95) tp1 = entry * 0.95;
                
                tp2 = yLow;
                tp3 = entry * 0.94;
            } else {
                side = 'long';
                stop = yLow * 0.999;
                
                // TP1: localMax если ВЫШЕ entry*1.01, иначе yHigh если выше, иначе entry*1.05
                if (localMaxPivot !== null && localMaxPivot > entry * 1.01) {
                    tp1 = localMaxPivot;
                } else if (yHigh > entry * 1.01) {
                    tp1 = yHigh;
                } else {
                    tp1 = entry * 1.05;
                }
                if (tp1 > entry * 1.05) tp1 = entry * 1.05;
                
                tp2 = yHigh;
                tp3 = entry * 1.06;
            }
            
            // R:R (по TP1)
            rr = side === 'short'
                ? (entry - tp1) / (stop - entry)
                : (tp1 - entry) / (entry - stop);
            
            return {
                symbol: sym,
                signal: true,
                side: side,
                entry: entry,
                stop: stop,
                tp1: tp1,
                tp2: tp2,
                tp3: tp3,
                rr: rr,
                signalTime: new Date(b3.time).toISOString(),
                yHigh: yHigh,
                yLow: yLow,
                localMax: localMaxPivot,
                localMin: localMinPivot,
                volGrow: volGrowS || volGrowL
            };
        } catch (e) {
            return { symbol: sym, error: e.message };
        }
    }
    
    // ═══════════ 4. ПРОХОД ПО СИМВОЛАМ ═══════════
    var results = [];
    var errors = [];
    var startedAt = Date.now();
    
    for (var i = 0; i < symbols.length; i++) {
        var sym = symbols[i];
        var r = await analyzeSymbol(sym);
        
        if (r.error) {
            errors.push(r);
            if (verbose) console.warn('⚠️ ' + sym + ': ' + r.error);
        } else if (r.signal) {
            results.push(r);
            var icon = r.side === 'short' ? '🔴' : '🟢';
            console.log(icon + ' ' + sym + ' ' + r.side.toUpperCase() +
                ' | entry=' + r.entry.toFixed(4) +
                ' | stop=' + r.stop.toFixed(4) +
                ' | TP1=' + r.tp1.toFixed(4) +
                ' | RR=' + r.rr.toFixed(2));
        } else if (verbose) {
            console.log('  · ' + sym + ' — нет сигнала');
        }
        
        if ((i + 1) % 10 === 0) {
            addLog('🌐 Сканер: ' + (i + 1) + '/' + symbols.length, 'info');
        }
        
        if (pauseMs > 0 && i < symbols.length - 1) {
            await new Promise(function(res){ setTimeout(res, pauseMs); });
        }
    }
    
    // ═══════════ 5. СОРТИРОВКА + ФИЛЬТР ═══════════
    results = results.filter(function(r) { return r.rr >= minRR; });
    results.sort(function(a, b) { return b.rr - a.rr; });
    
    var elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    
    // ═══════════ 6. ВЫВОД В КОНСОЛЬ ═══════════
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 РЕЗУЛЬТАТЫ B v6 (за ' + elapsed + 'с, ' + symbols.length + ' монет):');
    console.log('  Найдено сигналов: ' + results.length + ' | Ошибок: ' + errors.length);
    
    if (results.length === 0) {
        console.log('  ❌ Сигналов не найдено. Попробуйте позже (шаблон редкий).');
    } else {
        console.log('\n  🏆 ТОП-' + Math.min(results.length, 10) + ' по R:R:');
        results.slice(0, 10).forEach(function(r, idx) {
            var rank = (idx + 1).toString().padStart(2, ' ');
            console.log('  ' + rank + '. ' + (r.side === 'short' ? '🔴' : '🟢') + ' ' + r.symbol.padEnd(12) +
                ' | R:R=' + r.rr.toFixed(2) +
                ' | Entry=' + r.entry.toFixed(4) +
                ' | Stop=' + r.stop.toFixed(4));
        });
        
        console.log('\n  💾 Полные данные → window.__lastScanResults');
        window.__lastScanResults = results;
        
        console.log('\n  💡 Для перехода к сигналу:');
        console.log('     scanSwitchToSymbol(' + JSON.stringify(results[0].symbol) + ')');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // ═══════════ 7. UI-ЛОГИ ═══════════
    if (results.length > 0) {
        addLog('🏆 Сканер v6: ' + results.length + ' сигналов. Топ: ' + results[0].symbol + ' R:R=' + results[0].rr.toFixed(2), 'signal');
        if (autoSwitch && results.length > 0) {
            addLog('🎯 Автопереход на ' + results[0].symbol, 'info');
            scanSwitchToSymbol(results[0].symbol);
        }
    } else {
        addLog('ℹ️ Сканер v6: сигналов нет', 'info');
    }
    
    // ═══════════ 8. СВОДКА ═══════════
    var summary = {
        scanned: symbols.length,
        signals: results.length,
        errors: errors.length,
        elapsed: parseFloat(elapsed),
        top: results.slice(0, 5).map(function(r) {
            return { symbol: r.symbol, side: r.side, rr: r.rr, entry: r.entry };
        })
    };
    console.log('📊 Итого:', JSON.stringify(summary));
    
    return results;
};

// ═══════════ ХЕЛПЕР: ПЕРЕХОД НА СИМВОЛ ═══════════
window.scanSwitchToSymbol = function(symbol) {
    if (!symbol) return;
    var sym = symbol.toUpperCase().replace('/', '');
    addLog('🔀 Переключение на ' + sym, 'info');
    var inp = document.getElementById('instrumentInput');
    var btn = document.getElementById('changeInstrumentBtn');
    if (inp && btn) {
        inp.value = sym;
        btn.click();
    } else {
        addLog('❌ Не найдены поля переключения', 'error');
    }
};

// ═══════════ ХЕЛПЕР: ДЕТАЛИ СИМВОЛА ═══════════
window.scanShowDetail = function(symbol) {
    if (!window.__lastScanResults) {
        console.log('❌ Нет результатов. Сначала запустите scanStealthB()');
        return null;
    }
    var r = window.__lastScanResults.find(function(x) { return x.symbol === symbol; });
    if (!r) {
        console.log('❌ Символ ' + symbol + ' не в результатах');
        return null;
    }
    console.log('══════ 🔍 ' + symbol + ' ══════');
    console.log('  Side:', r.side.toUpperCase());
    console.log('  Entry:', r.entry.toFixed(4));
    console.log('  Stop:', r.stop.toFixed(4));
    console.log('  TP1:', r.tp1.toFixed(4), '(' + ((r.tp1 - r.entry) / r.entry * 100).toFixed(2) + '%)');
    console.log('  TP2:', r.tp2.toFixed(4), '(' + ((r.tp2 - r.entry) / r.entry * 100).toFixed(2) + '%)');
    console.log('  TP3:', r.tp3.toFixed(4), '(' + ((r.tp3 - r.entry) / r.entry * 100).toFixed(2) + '%)');
    console.log('  R:R:', r.rr.toFixed(2));
    console.log('  Yesterday High:', r.yHigh.toFixed(4));
    console.log('  Yesterday Low:', r.yLow.toFixed(4));
    console.log('  Local Max:', r.localMax ? r.localMax.toFixed(4) : 'na');
    console.log('  Local Min:', r.localMin ? r.localMin.toFixed(4) : 'na');
    console.log('  Signal Time:', r.signalTime);
    console.log('═══════════════════════════════════════');
    return r;
};

// ═══════════ ХЕЛПЕР: ЭКСПОРТ В JSON ═══════════
window.scanExportJSON = function() {
    if (!window.__lastScanResults) {
        console.log('❌ Нет результатов');
        return;
    }
    var json = JSON.stringify(window.__lastScanResults, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'stealth_scan_v6_' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('💾 Экспорт в JSON', 'info');
    console.log('💾 Скачан файл с результатами');
};

// ═══════════ ФИНАЛЬНЫЕ ПОДСКАЗКИ ═══════════
console.log('✅ Вариант B v6 загружен (синхрон с A v5 / C v10).');
console.log('');
console.log('   📌 Изменения от B v5:');
console.log('     • bars → b0..b3 (4 закрытых бара, сигнал на b3)');
console.log('     • red3/volGrow/lowerCloseS — синхрон с Pine close[1..3]');
console.log('     • TP1 по C v10 (localMin только если ниже entry для SHORT)');
console.log('     • entry = b3.c (синхрон с A v5)');
console.log('');
console.log('   Запуск: await scanStealthB()');
console.log('   С фильтрами: await scanStealthB({ minRR: 1.5, autoSwitch: true })');
console.log('   Только первые 10: await scanStealthB({ maxSymbols: 10 })');
console.log('');
console.log('   Хелперы:');
console.log('     scanShowDetail("BTCUSDT")   — детали символа');
console.log('   ');
console.log('     scanExportJSON()            — экспорт всех результатов');
console.log('     scanSwitchToSymbol("BTCUSDT") — переход на символ');