// ═══════ ТЕСТ PINE-СИГНАЛОВ В КОНСОЛИ ═══════
// Скопируйте этот код в консоль браузера (F12)

(function testPineSignals() {
    console.log('═══ 🧪 ТЕСТ PINE-СИГНАЛОВ ═══');
    
    // 1. Проверка базовых переменных
    console.log('1. Базовые переменные:');
    console.log('   - botActive:', typeof botActive !== 'undefined' ? botActive : '❌ НЕ НАЙДЕНА');
    console.log('   - strategyFlags.pineSignalsEnabled:', typeof strategyFlags !== 'undefined' ? strategyFlags.pineSignalsEnabled : '❌ НЕ НАЙДЕНА');
    console.log('   - window.__pineCurrentSource:', window.__pineCurrentSource ? '✅ Загружен (' + window.__pineCurrentSource.length + ' симв.)' : '❌ НЕ ЗАГРУЖЕН');
    console.log('   - chartBars.length:', chartBars?.length || '❌ ПУСТОЙ');
    console.log('   - ResinBridge:', typeof ResinBridge !== 'undefined' ? '✅ OK' : '❌ НЕ НАЙДЕН');
    
    // 2. Проверка мульти-режима
    console.log('2. Мульти-режим:');
    console.log('   - multiModeConfig.mode:', multiModeConfig?.mode || '❌ НЕ НАЙДЕНА');
    console.log('   - hasAnyPosition():', typeof hasAnyPosition === 'function' ? hasAnyPosition() : '❌ ФУНКЦИЯ НЕ НАЙДЕНА');
    
    // 3. Тестовый сигнал
    console.log('3. Тестовый сигнал:');
    var testBarIndex = chartBars.length - 1;
    console.log('   - testBarIndex:', testBarIndex);
    console.log('   - currentPrice:', chartBars[testBarIndex]?.close);
    
    // 4. Проверка processPineSignalsOnNewBar
    console.log('4. Функция processPineSignalsOnNewBar:', typeof processPineSignalsOnNewBar === 'function' ? '✅ СУЩЕСТВУЕТ' : '❌ НЕ НАЙДЕНА');
    
    // 5. Запуск теста (если всё OK)
    if (botActive && strategyFlags.pineSignalsEnabled && window.__pineCurrentSource && chartBars.length > 0) {
        console.log('5. 🚀 ЗАПУСК ТЕСТА...');
        console.log('   Откройте консоль и посмотрите вывод диагностики Pine shapes');
        processPineSignalsOnNewBar(testBarIndex);
    } else {
        console.log('5. ⚠️ ТЕСТ НЕ ЗАПУЩЕН — исправьте ошибки выше');
        console.log('   Проверьте:');
        console.log('   - Бот запущен? (кнопка ▶ ЗАПУСТИТЬ БОТА)');
        console.log('   - Чекбокс ✅ Pine-сигналы включен?');
        console.log('   - Pine-скрипт загружен? (кнопка ▶ Загрузить в панели 📊 Мини-TradingView)');
    }
    
    console.log('═══ 🧪 КОНЕЦ ТЕСТА ═══');
})();
