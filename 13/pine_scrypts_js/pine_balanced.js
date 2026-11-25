// ═══════ pine_balanced.js — minRR=1.5, minRange=1.5% ═══════
(async function() {
    console.log('══════ ⚖️ PINE_BALANCED ══════');
    
    if (typeof stealthV8 === 'undefined' || typeof stealthB8 === 'undefined') {
        alert('❌ Скрипты A v8 / B v8 не загружены');
        return;
    }

    var settings = {
        minRR: 1.5,
        minRange: 1.5,
        sessionFilter: true,
        slBufferPct: 0.5,
        notifyTelegram: false,
        showRejected: true
    };

    await stealthV8.refresh(settings);
    stealthB8.start(settings);

    alert('⚖️ Сбалансированный профиль запущен\nminRR=1.5, minRange=1.5%');
    console.log('✅ Сбалансированный профиль активен');
})();