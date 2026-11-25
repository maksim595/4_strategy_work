// ═══════ ПРОВЕРКА НАСТРОЕК SL/TP ═══════
// Скопируйте в консоль (F12)

console.log('═══ 🔧 ПРОВЕРКА SL/TP НАСТРОЕК ═══');
console.log('slConfig:', slConfig);
console.log('tpConfig:', tpConfig);
console.log('');
console.log('slConfig.value:', slConfig?.value);
console.log('slConfig.unit:', slConfig?.unit);
console.log('tpConfig.value:', tpConfig?.value);
console.log('tpConfig.unit:', tpConfig?.unit);
console.log('');
console.log('UI slValue:', document.getElementById('slValue')?.value);
console.log('UI slUnit:', document.getElementById('slUnit')?.value);
console.log('UI tpValue:', document.getElementById('tpValue')?.value);
console.log('UI tpUnit:', document.getElementById('tpUnit')?.value);
console.log('');
console.log('═══ 📊 РАСЧЁТ ═══');

var entryPrice = chartBars[chartBars.length - 1].close;
var slPct = (slConfig && slConfig.value != null) ? parseFloat(slConfig.value) / 100 : 0.01;
var tpPct = (tpConfig && tpConfig.value != null) ? parseFloat(tpConfig.value) / 100 : 0;

console.log('entryPrice:', entryPrice);
console.log('slPct:', slPct, '(' + (slPct * 100) + '%)');
console.log('tpPct:', tpPct, (tpPct > 0 ? '(' + (tpPct * 100) + '%)' : '—'));
console.log('');
console.log('SL цена:', entryPrice * (1 - slPct));
console.log('TP цена:', tpPct > 0 ? entryPrice * (1 + tpPct) : '—');
console.log('═══ 🔧 КОНЕЦ ═══');
