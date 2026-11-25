// ═══════ pine_only_a.js — только A v8 ═══════
(async function() {
    console.log('══════ 📊 PINE_ONLY_A ══════');
    
    if (typeof stealthV8 === 'undefined') {
        alert('❌ A v8 не загружен');
        return;
    }

    // Остановить B v8, если был
    if (typeof stealthB8 !== 'undefined') try { stealthB8.stop(); } catch(e) {}

    await stealthV8.refresh({
        minRR: 1.5,
        minRange: 1.5,
        sessionFilter: true,
        slBufferPct: 0.5,
        showRejected: true
    });

    alert('📊 A v8: визуализация активна');
    console.log('✅ A v8 активен');
})();