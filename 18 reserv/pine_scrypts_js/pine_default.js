// ═══════ pine_default.js — ETH 1H, L=5, объём Вкл ═══════
// Дефолтный профиль для автоматической загрузки при старте
(async function() {
    console.log('══════ 📊 PINE_DEFAULT (ETH 1H, L=5) ══════');
    
    if (typeof stealthV8 === 'undefined' || typeof stealthB8 === 'undefined') {
        console.error('❌ A v8 / B v8 не загружены. Проверьте my_strategy_025.html');
        alert('❌ Скрипты A v8 / B v8 не найдены. Перезагрузите страницу.');
        return;
    }

    // Фрактал L=5
    var fp = document.getElementById('fractalPeriod');
    if (fp) fp.value = 5;
    if (typeof fractalPeriod !== 'undefined') fractalPeriod = 5;

    var settings = {
        minRR: 1.5,
        minRange: 1.5,
        sessionFilter: true,
        slBufferPct: 0.5,
        notifyTelegram: false,
        showRejected: true
    };

    // Визуализация A v8
    await stealthV8.refresh(settings);

    // Сканер B v8 (авто, каждые 15m)
    stealthB8.start(settings);

    console.log('✅ PINE_DEFAULT активен: ETH 1H, L=5, объём Вкл');
})();