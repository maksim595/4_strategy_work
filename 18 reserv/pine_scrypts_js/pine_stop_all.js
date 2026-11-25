// ═══════ pine_stop_all.js — остановить все скрипты ═══════
(function() {
    console.log('══════ ⏹️ PINE_STOP_ALL ══════');
    
    if (typeof stealthV8 !== 'undefined') try { stealthV8.stop(); } catch(e) {}
    if (typeof stealthB8 !== 'undefined') try { stealthB8.stop(); } catch(e) {}
    if (typeof clearChartToBars === 'function') clearChartToBars();

    alert('⏹️ Все скрипты остановлены');
    console.log('✅ Все скрипты остановлены');
})();