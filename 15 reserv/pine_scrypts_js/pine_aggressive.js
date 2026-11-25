// ═══════ pine_aggressive.js — minRR=1.0, minRange=1.0% ═══════
(async function() {
    console.log('══════ 🔥 PINE_AGGRESSIVE ══════');
    
    if (typeof stealthV8 === 'undefined' || typeof stealthB8 === 'undefined') {
        alert('❌ Скрипты A v8 / B v8 не загружены');
        return;
    }

    var settings = {
        minRR: 1.0,
        minRange: 1.0,
        sessionFilter: true,
        slBufferPct: 0.3,
        notifyTelegram: true,
        showRejected: false
    };

    await stealthV8.refresh(settings);
    stealthB8.start(settings);

    alert('🔥 Агрессивный профиль запущен\nminRR=1.0, minRange=1.0%, Telegram=Вкл');
    console.log('✅ Агрессивный профиль активен');
})();