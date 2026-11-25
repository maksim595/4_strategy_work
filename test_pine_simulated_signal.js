// ═══════ ТЕСТ PINE-СИГНАЛОВ С СИМУЛЯЦИЕЙ ═══════
// Скопируйте этот код в консоль браузера (F12)
// Создаёт ИСКУССТВЕННЫЙ BUY-сигнал на последнем баре

(function testPineWithSimulatedSignal() {
    console.log('═══ 🧪 ТЕСТ PINE-СИГНАЛОВ С СИМУЛЯЦИЕЙ ═══');
    
    // 1. Проверка базовых переменных
    if (!botActive) {
        console.log('❌ Бот НЕ запущен! Нажмите ▶ ЗАПУСТИТЬ БОТА');
        return;
    }
    if (!strategyFlags.pineSignalsEnabled) {
        console.log('❌ Чекбокс Pine-сигналы ВЫКЛЮЧЕН! Включите ✅ Pine-сигналы');
        return;
    }
    if (!window.__pineCurrentSource) {
        console.log('❌ Pine-скрипт НЕ загружен! Загрузите через 📊 Мини-TradingView');
        return;
    }
    
    console.log('✅ Все проверки пройдены');
    console.log('   botActive:', botActive);
    console.log('   pineSignalsEnabled:', strategyFlags.pineSignalsEnabled);
    console.log('   Pine-скрипт:', window.__pineCurrentSource.length, 'симв.');
    
    // 2. Создаём искусственный сигнал
    var testBarIndex = chartBars.length - 1;
    var currentPrice = chartBars[testBarIndex].close;
    
    console.log('═══ 📊 СИМУЛЯЦИЯ СИГНАЛА ═══');
    console.log('testBarIndex:', testBarIndex);
    console.log('currentPrice:', currentPrice);
    
    // 3. Временно модифицируем processPineSignalsOnNewBar для принудительного сигнала
    var originalFunc = processPineSignalsOnNewBar;
    
    processPineSignalsOnNewBar = function(barIndex) {
        console.log('🔧 processPineSignalsOnNewBar вызвана с barIndex:', barIndex);
        
        // Принудительно создаём сигнал
        if (barIndex === testBarIndex) {
            console.log('🟢 СИМУЛЯЦИЯ: BUY сигнал на баре', barIndex);
            
            var entryPrice = chartBars[barIndex].close;
            var size = getBaseRiskAmount() / entryPrice;
            var slPct = (slConfig && slConfig.value != null) ? parseFloat(slConfig.value) / 100 : 0.01;
            var tpPct = (tpConfig && tpConfig.value != null) ? parseFloat(tpConfig.value) / 100 : 0;
            var sl = entryPrice * (1 - slPct);
            var tp = tpPct > 0 ? entryPrice * (1 + tpPct) : NaN;
            
            console.log('📊 Параметры позиции:');
            console.log('   - entryPrice:', entryPrice);
            console.log('   - size:', size);
            console.log('   - SL:', sl);
            console.log('   - TP:', tp > 0 ? tp : '—');
            console.log('   - multiMode:', multiModeConfig.mode);
            console.log('   - hasAnyPosition:', hasAnyPosition());
            
            // Открываем позицию
            if (multiModeConfig.mode === 'off') {
                if (!hasAnyPosition()) {
                    console.log('✅ ОТКРЫВАЮ LONG позицию...');
                    openPosition('long', entryPrice, barIndex, false, size);
                    console.log('✅ ПОЗИЦИЯ ОТКРЫТА!');
                } else {
                    console.log('⚠️ УЖЕ ЕСТЬ ПОЗИЦИЯ — пропускаю');
                }
            } else {
                console.log('✅ Вызываю handleSignal (multiMode=' + multiModeConfig.mode + ')');
                handleSignal({type: 'long', priceLevel: entryPrice}, barIndex);
                console.log('✅ handleSignal вызван!');
            }
            
            return; // Выходим — не вызываем оригинальную функцию
        }
        
        // Для остальных баров — оригинальная функция
        return originalFunc.apply(this, arguments);
    };
    
    // 4. Запускаем тест
    console.log('🚀 ЗАПУСК ТЕСТА...');
    processPineSignalsOnNewBar(testBarIndex);
    
    // 5. Проверяем результат
    setTimeout(function() {
        console.log('═══ 📋 РЕЗУЛЬТАТЫ ═══');
        console.log('positions.length:', positions.length);
        if (positions.length > 0) {
            console.log('✅ ПОЗИЦИЯ ОТКРЫТА!');
            console.log('   side:', positions[0].side);
            console.log('   entryPrice:', positions[0].entryPrice);
            console.log('   size:', positions[0].size);
            console.log('   sl:', positions[0].sl);
            console.log('   tp:', positions[0].tp);
        } else {
            console.log('❌ ПОЗИЦИЯ НЕ ОТКРЫТА');
            console.log('   Проверьте логи выше — какая была причина?');
        }
        console.log('═══ 🧪 КОНЕЦ ТЕСТА ═══');
    }, 500);
})();
