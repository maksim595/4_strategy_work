// ═══════ pine_best_symbol.js — авто-переход на лучший ═══════
(async function() {
    console.log('══════ 🚀 PINE_BEST_SYMBOL ══════');
    
    if (typeof stealthB8 === 'undefined') {
        alert('❌ B v8 не загружен');
        return;
    }

    var res = await stealthB8.scan({
        minRR: 1.5,
        minRange: 1.5,
        sessionFilter: true,
        slBufferPct: 0.5,
        autoSwitch: true
    });

    if (res && res.results.length > 0) {
        var best = res.results[0];
        console.log('🏆 Лучший: ' + best.symbol + ' RR=' + best.rr.toFixed(2));
        alert('🏆 Лучший: ' + best.symbol + ' ' + best.side.toUpperCase() + ' RR=' + best.rr.toFixed(2));
    } else {
        alert('ℹ️ Сигналов не найдено');
    }
})();