// ═══════ pine_test.js — все фильтры ОТКЛЮЧЕНЫ ═══════
(async function() {
    console.log('══════ 🧪 PINE_TEST (без фильтров) ══════');
    
    if (typeof stealthV8 === 'undefined' || typeof stealthB8 === 'undefined') {
        alert('❌ Скрипты A v8 / B v8 не загружены');
        return;
    }

    var settings = {
        minRR: 0,
        minRange: 0,
        sessionFilter: false,
        slBufferPct: 0.5,
        notifyTelegram: false,
        showRejected: true
    };

    await stealthV8.refresh(settings);
    stealthB8.start(settings);

    alert('🧪 Тестовый профиль запущен\nВсе фильтры ОТКЛЮЧЕНЫ');
    console.log('✅ Тестовый профиль активен');
})();