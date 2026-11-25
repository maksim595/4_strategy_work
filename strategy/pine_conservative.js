// ═══════ pine_conservative.js — minRR=2.5, minRange=2.0% ═══════
(async function() {
    console.log('══════ 🛡️ PINE_CONSERVATIVE ══════');
    
    if (typeof stealthV8 === 'undefined' || typeof stealthB8 === 'undefined') {
        alert('❌ Скрипты A v8 / B v8 не загружены');
        return;
    }

    var settings = {
        minRR: 2.5,
        minRange: 2.0,
        sessionFilter: true,
        slBufferPct: 0.7,
        notifyTelegram: false,
        showRejected: true
    };

    await stealthV8.refresh(settings);
    stealthB8.start(settings);

    alert('🛡️ Консервативный профиль запущен\nminRR=2.5, minRange=2.0%');
    console.log('✅ Консервативный профиль активен');
})();