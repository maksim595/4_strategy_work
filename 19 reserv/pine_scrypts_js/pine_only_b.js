// ═══════ pine_only_b.js — только B v8 ═══════
(async function() {
    console.log('══════ 🌐 PINE_ONLY_B ══════');
    
    if (typeof stealthB8 === 'undefined') {
        alert('❌ B v8 не загружен');
        return;
    }

    // Остановить A v8, если был
    if (typeof stealthV8 !== 'undefined') try { stealthV8.stop(); } catch(e) {}

    stealthB8.start({
        minRR: 1.5,
        minRange: 1.5,
        sessionFilter: true,
        slBufferPct: 0.5,
        notifyTelegram: true
    });

    alert('🌐 B v8: автоскан активен (Telegram=Вкл)');
    console.log('✅ B v8 активен');
})();