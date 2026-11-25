// ═══════════════════════════════════════════════════════
// B v8 — сканер 43 монет с автообновлением + хелперы
// ═══════════════════════════════════════════════════════
window.scanStealthBv8 = async function(opts) {
    opts = opts || {};
    var minRR = opts.minRR !== undefined ? opts.minRR : 1.5;
    var minRange = opts.minRange !== undefined ? opts.minRange : 1.5;
    var sessionFilter = opts.sessionFilter !== false;
    var sessionStartH = opts.sessionStartH !== undefined ? opts.sessionStartH : 14;
    var sessionStartM = opts.sessionStartM !== undefined ? opts.sessionStartM : 30;
    var sessionEndH = opts.sessionEndH !== undefined ? opts.sessionEndH : 20;
    var slBufferPct = opts.slBufferPct !== undefined ? opts.slBufferPct : 0.5;
    var verbose = opts.verbose !== false;
    var autoSwitch = opts.autoSwitch === true;
    var maxSymbols = opts.maxSymbols || 43;
    var notifyTelegram = opts.notifyTelegram === true;
    var silent = opts.silent === true;

    if (!silent) {
        console.log('══════ 🌐 STEALTH B v8 — СКАНЕР (авто + хелперы) ══════');
        console.log('  Фильтры: minRR=' + minRR + ' | minRange=' + minRange + '% | session=' + sessionFilter);
    }

    var symbols = opts.symbols || [
        'BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','BNBUSDT','DOGEUSDT','ADAUSDT','TRXUSDT',
        'AVAXUSDT','SHIBUSDT','LTCUSDT','TONUSDT','SUIUSDT','HBARUSDT','NEARUSDT','APTUSDT',
        'OPUSDT','IMXUSDT','INJUSDT','ATOMUSDT','SEIUSDT','RENDERUSDT','FILUSDT','SANDUSDT',
        'MANAUSDT','PEPEUSDT','AAVEUSDT','MKRUSDT','ARBUSDT','FTMUSDT','CHZUSDT','AXSUSDT',
        'ONEUSDT','ENJUSDT','ICPUSDT','THETAUSDT','ALGOUSDT','RUNEUSDT','DOTUSDT','CRVUSDT',
        'KSMUSDT','APEUSDT','RDNTUSDT'
    ].slice(0, maxSymbols);

    if (!silent) {
        console.log('📋 Сканирую ' + symbols.length + ' монет...');
        addLog('🌐 B v8: ' + symbols.length + ' монет', 'info');
    }

    async function analyzeSymbol(sym) {
        try {
            var [r1d, r15m] = await Promise.all([
                fetch('https://api.binance.com/api/v3/klines?symbol=' + sym + '&interval=1d&limit=15').then(function(r){ return r.json(); }),
                fetch('https://api.binance.com/api/v3/klines?symbol=' + sym + '&interval=15m&limit=5').then(function(r){ return r.json(); })
            ]);
            if (!Array.isArray(r1d) || r1d.length < 15) return { symbol: sym, error: '1d<15' };
            if (!Array.isArray(r15m) || r15m.length < 5) return { symbol: sym, error: '15m<5' };

            var yBar = r1d[r1d.length - 2];
            var yHigh = parseFloat(yBar[2]);
            var yLow  = parseFloat(yBar[3]);

            var days = r1d.map(function(k) { return { h: parseFloat(k[2]), l: parseFloat(k[3]) }; });
            var pivH = [], pivL = [];
            for (var d = 5; d < days.length - 5; d++) {
                var isMax = true, isMin = true;
                for (var j = d - 5; j <= d + 5; j++) {
                    if (j === d) continue;
                    if (days[j].h >= days[d].h) isMax = false;
                    if (days[j].l <= days[d].l) isMin = false;
                }
                if (isMax) pivH.push({ d: d, p: days[d].h });
                if (isMin) pivL.push({ d: d, p: days[d].l });
            }
            var yIdx = days.length - 2;
            var lmax = null, lmin = null;
            for (var p = pivH.length - 1; p >= 0; p--) if (pivH[p].d < yIdx) { lmax = pivH[p].p; break; }
            for (var p = pivL.length - 1; p >= 0; p--) if (pivL[p].d < yIdx) { lmin = pivL[p].p; break; }

            var bars = r15m.slice(0, 4).map(function(k) {
                return { o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], time: +k[0] };
            });
            var b0 = bars[0], b1 = bars[1], b2 = bars[2], b3 = bars[3];

            var touchUpper = b3.h >= yHigh && b3.c < yHigh;
            var red3 = b1.c < b1.o && b2.c < b2.o && b3.c < b3.o;
            var lowerCloseS = b1.c < b0.c;
            var volGrowS = b1.v > b0.v;
            var noLowBreak = b3.l > yLow;
            var shortSig = touchUpper && red3 && lowerCloseS && volGrowS && noLowBreak;

            var touchLower = b3.l <= yLow && b3.c > yLow;
            var green3 = b1.c > b1.o && b2.c > b2.o && b3.c > b3.o;
            var higherClose = b1.c > b0.c;
            var volGrowL = b1.v > b0.v;
            var noHighBreak = b3.h < yHigh;
            var longSig = touchLower && green3 && higherClose && volGrowL && noHighBreak;

            if (!shortSig && !longSig) return { symbol: sym, signal: false };

            var side = shortSig ? 'short' : 'long';
            var entry = b3.c;
            var rangeWidth = (yHigh - yLow) / yLow * 100;

            if (rangeWidth < minRange) return { symbol: sym, signal: true, filtered: true, side: side, reason: 'range(' + rangeWidth.toFixed(1) + '%)' };

            if (sessionFilter) {
                var d = new Date(b3.time);
                var hMSK = (d.getUTCHours() + 3) % 24;
                var mMSK = d.getUTCMinutes();
                var tMin = hMSK * 60 + mMSK;
                if (tMin < sessionStartH * 60 + sessionStartM || tMin >= sessionEndH * 60) {
                    return { symbol: sym, signal: true, filtered: true, side: side, reason: 'session(' + hMSK + ':' + String(mMSK).padStart(2,'0') + ')' };
                }
            }

            var stop, tp1, tp2, tp3, rr;
            if (side === 'short') {
                stop = yHigh * (1 + slBufferPct / 100);
                if (lmin !== null && lmin < entry * 0.99) tp1 = lmin;
                else if (yLow < entry * 0.99) tp1 = yLow;
                else tp1 = entry * 0.95;
                if (tp1 < entry * 0.95) tp1 = entry * 0.95;
                tp2 = yLow;
                tp3 = entry * 0.94;
                rr = (entry - tp1) / (stop - entry);
            } else {
                stop = yLow * (1 - slBufferPct / 100);
                if (lmax !== null && lmax > entry * 1.01) tp1 = lmax;
                else if (yHigh > entry * 1.01) tp1 = yHigh;
                else tp1 = entry * 1.05;
                if (tp1 > entry * 1.05) tp1 = entry * 1.05;
                tp2 = yHigh;
                tp3 = entry * 1.06;
                rr = (tp1 - entry) / (entry - stop);
            }

            var valid = !isNaN(stop) && !isNaN(tp1);
            if (side === 'short') valid = valid && stop > entry && tp1 < entry;
            else valid = valid && stop < entry && tp1 > entry;
            if (!valid) return { symbol: sym, signal: true, filtered: true, side: side, reason: 'invalid' };

            if (rr < minRR) return { symbol: sym, signal: true, filtered: true, side: side, reason: 'RR(' + rr.toFixed(1) + ')' };

            return {
                symbol: sym, signal: true, filtered: false,
                side: side, entry: entry, stop: stop, tp1: tp1, tp2: tp2, tp3: tp3,
                rr: rr, range: rangeWidth,
                signalTime: new Date(b3.time).toISOString(),
                yHigh: yHigh, yLow: yLow, localMax: lmax, localMin: lmin
            };
        } catch (e) {
            return { symbol: sym, error: e.message };
        }
    }

    var results = [];
    var filtered = [];
    var errors = [];
    var stats = { range: 0, session: 0, rr: 0, invalid: 0 };
    var startedAt = Date.now();

    for (var i = 0; i < symbols.length; i++) {
        var sym = symbols[i];
        var r = await analyzeSymbol(sym);

        if (r.error) {
            errors.push(r);
            if (verbose) console.warn('⚠️ ' + sym + ': ' + r.error);
        } else if (r.filtered) {
            filtered.push(r);
            if (r.reason.startsWith('range')) stats.range++;
            else if (r.reason.startsWith('session')) stats.session++;
            else if (r.reason.startsWith('RR')) stats.rr++;
            else stats.invalid++;
            if (verbose) console.log('⚪ ' + sym + ' ' + r.side.toUpperCase() + ' — ' + r.reason);
        } else if (r.signal) {
            results.push(r);
            if (verbose || !silent) {
                console.log((r.side === 'short' ? '🔴' : '🟢') + ' ' + sym + ' ' + r.side.toUpperCase() + ' | entry=' + r.entry.toFixed(4) + ' | RR=' + r.rr.toFixed(2) + ' | range=' + r.range.toFixed(1) + '%');
            }
        }

        if (!silent && (i + 1) % 10 === 0) addLog('🌐 Сканер: ' + (i + 1) + '/' + symbols.length, 'info');
        if (opts.pauseMs !== 0) await new Promise(function(res){ setTimeout(res, 100); });
    }

    var elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

    if (!silent) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 B v8 (' + elapsed + 'с):');
        console.log('  Прошли фильтры: ' + results.length);
        console.log('  Отсеяно: ' + filtered.length + ' (range=' + stats.range + ', session=' + stats.session + ', RR=' + stats.rr + ', invalid=' + stats.invalid + ')');
        console.log('  Ошибок: ' + errors.length);

        if (results.length > 0) {
            results.sort(function(a,b){ return b.rr - a.rr; });
            console.log('\n  🏆 ТОП-' + Math.min(results.length, 10) + ':');
            results.slice(0, 10).forEach(function(r, idx) {
                console.log('  ' + (idx + 1) + '. ' + (r.side === 'short' ? '🔴' : '🟢') + ' ' + r.symbol.padEnd(12) + ' | RR=' + r.rr.toFixed(2) + ' | Entry=' + r.entry.toFixed(4) + ' | range=' + r.range.toFixed(1) + '%');
            });
        } else {
            console.log('\n  ❌ Нет сигналов');
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    // Telegram
    if (notifyTelegram && results.length > 0) {
        var top = results.slice(0, 3);
        var msg = '🔔 Stealth B v8: ' + results.length + ' сигналов\n\n' + 
            top.map(function(r){ return r.symbol + ' ' + r.side.toUpperCase() + ' RR=' + r.rr.toFixed(2) + '\nEntry=' + r.entry.toFixed(4); }).join('\n\n');
        try { sendTgMessage(msg); } catch(e) {}
    }

    // Auto-switch
    if (autoSwitch && results.length > 0) {
        window.scanSwitchToSymbol(results[0].symbol);
    }

    if (!silent) {
        if (results.length > 0) {
            addLog('🏆 B v8: ' + results.length + ' сигналов (отсеяно: ' + filtered.length + ')', 'signal');
        } else {
            addLog('ℹ️ B v8: сигналов нет (отсеяно: ' + filtered.length + ')', 'info');
        }
    }

    return { results: results, filtered: filtered, stats: stats, errors: errors, elapsed: parseFloat(elapsed) };
};

window.scanSwitchToSymbol = function(symbol) {
    if (!symbol) return;
    var sym = symbol.toUpperCase().replace('/', '');
    addLog('🔀 Переключение на ' + sym, 'info');
    var inp = document.getElementById('instrumentInput');
    var btn = document.getElementById('changeInstrumentBtn');
    if (inp && btn) { inp.value = sym; btn.click(); }
};

// ═══════════════════════════════════════════════════════
// ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════════
window.stealthB8 = {
    _autoInterval: null,
    _lastBarTime: 0,
    _scanCount: 0,
    _totalSignals: 0,
    _lastScanTime: null,
    _lastResults: null,
    _lastFiltered: null,
    _filters: {
        minRR: 1.5,
        minRange: 1.5,
        sessionFilter: true,
        sessionStartH: 14, sessionStartM: 30,
        sessionEndH: 20,
        slBufferPct: 0.5,
        maxSymbols: 43,
        autoSwitch: false,
        notifyTelegram: false
    },

    // Ручной запуск
    async scan() {
        var res = await scanStealthBv8(Object.assign({}, this._filters, { silent: false }));
        this._lastResults = res.results;
        this._lastFiltered = res.filtered;
        this._lastScanTime = new Date();
        window.__lastScanResults = res.results;
        window.__lastScanFiltered = res.filtered;
        return res;
    },

    // Старт автоскана
    start(opts) {
        if (opts) Object.assign(this._filters, opts);
        if (this._autoInterval) {
            console.log('⚠️ Автоскан уже запущен. Остановите: stealthB8.stop()');
            return;
        }

        var self = this;
        this._lastBarTime = 0;

        // Первый скан
        this.scan().then(function(res) {
            if (res) {
                self._lastBarTime = chartBars && chartBars.length > 0 
                    ? chartBars[chartBars.length - 1].time 
                    : Math.floor(Date.now() / 1000);
            }
        });

        // Раз в минуту — проверяем, появилась ли новая 15m-свеча
        this._autoInterval = setInterval(async function() {
            var lastBarTime;
            if (chartBars && chartBars.length > 0) {
                lastBarTime = chartBars[chartBars.length - 1].time;
            } else {
                // Если chartBars пуст — проверяем по времени (15m границы)
                var now = Math.floor(Date.now() / 1000);
                lastBarTime = Math.floor(now / 900) * 900;   // 15m границы
            }

            if (lastBarTime !== self._lastBarTime) {
                self._lastBarTime = lastBarTime;
                self._scanCount++;
                console.log('🔄 Автоскан #' + self._scanCount + ' (' + new Date().toLocaleTimeString('ru-RU') + ')');
                var res = await scanStealthBv8(Object.assign({}, self._filters, { silent: true }));
                if (res) {
                    self._lastResults = res.results;
                    self._lastFiltered = res.filtered;
                    self._lastScanTime = new Date();
                    window.__lastScanResults = res.results;
                    window.__lastScanFiltered = res.filtered;
                    if (res.results.length > 0) {
                        self._totalSignals += res.results.length;
                        addLog('🎯 B v8 авто: найдено ' + res.results.length + ' сигналов (топ: ' + res.results[0].symbol + ' RR=' + res.results[0].rr.toFixed(2) + ')', 'signal');
                    }
                }
            }
        }, 60000);

        addLog('🔄 B v8 автоскан запущен (проверка раз в минуту)', 'info');
        console.log('✅ Автоскан запущен.');
        console.log('   Фильтры: ' + JSON.stringify(this._filters));
        console.log('   Остановить: stealthB8.stop()');
        console.log('   Статус: stealthB8.status()');
    },

    stop() {
        if (this._autoInterval) {
            clearInterval(this._autoInterval);
            this._autoInterval = null;
            console.log('⏹️ Автоскан остановлен');
            addLog('⏹️ B v8 автоскан остановлен', 'info');
        } else {
            console.log('ℹ️ Автоскан не запущен');
        }
    },

    status() {
        var running = this._autoInterval !== null;
        var lastTime = this._lastScanTime 
            ? this._lastScanTime.toLocaleString('ru-RU') 
            : '—';

        console.log('══════ 📊 B v8 СТАТУС ══════');
        console.log('  Автоскан: ' + (running ? '✅ ЗАПУЩЕН' : '⏹️ остановлен'));
        console.log('  Сканов: ' + this._scanCount + ' | Всего сигналов: ' + this._totalSignals);
        console.log('  Последний скан: ' + lastTime);
        console.log('  Последние результаты: ' + (this._lastResults ? this._lastResults.length : 0) + ' прошедших, ' + (this._lastFiltered ? this._lastFiltered.length : 0) + ' отсеянных');
        console.log('  ─── Фильтры ───');
        console.log('    minRR=' + this._filters.minRR + ' | minRange=' + this._filters.minRange + '%');
        console.log('    session=' + this._filters.sessionFilter + ' (' + this._filters.sessionStartH + ':' + 
                    String(this._filters.sessionStartM).padStart(2,'0') + '–' + this._filters.sessionEndH + ':00 МСК)');
        console.log('    maxSymbols=' + this._filters.maxSymbols + ' | autoSwitch=' + this._filters.autoSwitch + ' | notifyTelegram=' + this._filters.notifyTelegram);
        console.log('══════════════════════════════');

        return {
            running: running,
            scans: this._scanCount,
            totalSignals: this._totalSignals,
            lastScan: lastTime,
            lastResults: this._lastResults,
            lastFiltered: this._lastFiltered,
            filters: Object.assign({}, this._filters)
        };
    },

    async setFilters(opts) {
        if (!opts) return;
        Object.assign(this._filters, opts);
        console.log('✅ Фильтры обновлены:', JSON.stringify(this._filters));
        addLog('⚙️ B v8 фильтры обновлены', 'settings');
        // Пере-скан сразу
        return await this.scan();
    },

    setSymbols(symbols) {
        if (!Array.isArray(symbols) || symbols.length === 0) {
            console.log('⚠️ Передайте массив символов, например ["BTCUSDT", "ETHUSDT"]');
            return;
        }
        this._filters.symbols = symbols;
        this._filters.maxSymbols = symbols.length;
        console.log('✅ Символы обновлены: ' + symbols.length + ' монет');
    },

    showDetail(symbol) {
        if (!this._lastResults) { console.log('❌ Нет результатов. Запустите scan()'); return null; }
        var r = this._lastResults.find(function(x){ return x.symbol === symbol; });
        if (!r) { console.log('❌ ' + symbol + ' не в результатах'); return null; }
        console.log('══════ 🔍 ' + symbol + ' ══════');
        console.log('  Side:', r.side.toUpperCase());
        console.log('  Entry:', r.entry.toFixed(4));
        console.log('  Stop:', r.stop.toFixed(4));
        console.log('  TP1:', r.tp1.toFixed(4));
        console.log('  R:R:', r.rr.toFixed(2));
        console.log('  Range:', r.range.toFixed(2) + '%');
        console.log('  Yesterday: H=' + r.yHigh.toFixed(4) + ' / L=' + r.yLow.toFixed(4));
        console.log('════════════════════════════════');
        return r;
    },

    showFiltered() {
        if (!this._lastFiltered) { console.log('❌ Нет результатов'); return; }
        console.log('⚪ ОТСЕЯННЫЕ (' + this._lastFiltered.length + '):');
        this._lastFiltered.forEach(function(r){
            console.log('  ' + r.symbol.padEnd(12) + ' ' + r.side.toUpperCase() + ' — ' + r.reason);
        });
    },

    exportJSON() {
        var data = {
            timestamp: new Date().toISOString(),
            scans: this._scanCount,
            totalSignals: this._totalSignals,
            lastScan: this._lastScanTime ? this._lastScanTime.toISOString() : null,
            filters: this._filters,
            passed: this._lastResults || [],
            filtered: this._lastFiltered || []
        };
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'stealth_b8_scan_' + Date.now() + '.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        console.log('💾 Экспорт (' + (this._lastResults?.length || 0) + ' прошедших)');
    }
};

// ═══════ ПОДСКАЗКИ ═══════
console.log('✅ B v8 загружен.');
console.log('');
console.log('   📊 Ручной скан:');
console.log('     await stealthB8.scan()');
console.log('');
console.log('   🔄 Автоскан (каждые 15m):');
console.log('     stealthB8.start()');
console.log('     stealthB8.stop()');
console.log('     stealthB8.status()');
console.log('');
console.log('   ⚙️ Настройки:');
console.log('     stealthB8.setFilters({ minRR: 2.0 })');
console.log('     stealthB8.setFilters({ notifyTelegram: true, autoSwitch: true })');
console.log('     stealthB8.setSymbols(["BTCUSDT","ETHUSDT","SOLUSDT"])');
console.log('');
console.log('   🔍 Просмотр:');
console.log('     stealthB8.showDetail("AVAXUSDT")');
console.log('     stealthB8.showFiltered()');
console.log('');
console.log('   💾 Экспорт:');
console.log('     stealthB8.exportJSON()');