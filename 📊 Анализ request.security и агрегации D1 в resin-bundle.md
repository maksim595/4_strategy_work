Отлично! Теперь у меня полная картина. Давайте создам сводный отчёт:
📊 Анализ request.security и агрегации D1 в resin-bundle.js
Найдённые функции
Функция	Строки	Назначение
build()	~18607	Диспетчер — выбирает buildByTime или buildByCount
buildByTime()	~18647	Агрегация баров по временным периодам (D/W/M)
periodForTime()	~18625	Определение периода для timestamp
accumulate()	~18614	Накопление OHLCV в текущий период
deriveTimeClose()	~18636	Вычисление time_close как time_open[next]
🔍 Ключевая проблема: UTC vs MSK
Функция periodForTime() (строка ~18625):
function periodForTime(tSec, tf, tfSeconds) {
    if (tf === "D" || tf === "1D") {
      const d2 = new Date(tSec * 1e3);
      return d2.getUTCFullYear() * 1e4 + (d2.getUTCMonth() + 1) * 100 + d2.getUTCDate();  // ← UTC!
    }
    // ...
}
Проблема:
Binance API отдаёт closeTime в UTC
periodForTime() использует getUTCDate() для определения границ дня
Код в HTML использует mskOffset = 3*3600*1000 и передаёт бары с UTC timestamp'ами
Результат:
Бар с closeTime = 2026-11-17 00:00:00 UTC → это 17 ноября в UTC
Но для MSK (UTC+3) это 17 ноября 03:00 — уже следующий день
aggregateBars() режет бары по UTC-границам, а не по MSK-границам
📉 Почему [0] = вчера, а не сегодня
Функция buildByTime() (строка ~18647):
function buildByTime(open, high, low, close, volume, time2, tf) {
    const n = close.length;
    const tfSeconds = parseTfMinutes(tf) * 60;
    const barMap = new Int32Array(n);
    const bars = { open: [], high: [], low: [], close: [], volume: [], timeOpen: [] };
    let currentPeriod = null;
    
    for (let i = 0; i < n; i++) {
      const tMs = i < time2.length ? time2[i] : 0;
      const period = periodForTime(tMs / 1e3, tf, tfSeconds);  // ← UTC период
      const isNewPeriod = period !== currentPeriod;
      if (isNewPeriod) currentPeriod = period;
      
      accumulate(bars, isNewPeriod, open[i], high[i], low[i], close[i], volume[i], tMs);
      barMap[i] = bars.open.length - 1;  // ← мапит исходный бар → агрегированный
    }
    
    // ...
    return {
      barMap,
      open: Float64Array.from(bars.open),   // ← [0] = самый старый день
      high: Float64Array.from(bars.high),
      low: Float64Array.from(bars.low),
      close: Float64Array.from(bars.close),
      volume: Float64Array.from(bars.volume),
      timeOpen,
      timeClose: deriveTimeClose(timeOpen)
    };
}
Что происходит:
Цикл по всем барам от i=0 (старый) до i=n-1 (новый)
accumulate() создаёт новый агрегированный бар при смене периода
bars.open.length - 1 — индекс последнего созданного бара
Результат: bars.open[0] = первый (старый) день, bars.open[last] = последний (текущий) день
НО: request.security возвращает скалярное значение для текущего бара через lookahead:
// resolveHtfIndex (строка ~18557)
function resolveHtfIndex(cache, idx, gaps, lookahead) {
    const rawHtfIdx = cache.barMap[idx];
    let htfIdx;
    if (lookahead) {
      htfIdx = rawHtfIdx;  // ← текущий HTF бар
    } else {
      if (rawHtfIdx <= 0) return -1;
      htfIdx = rawHtfIdx - 1;  // ← ПРЕДЫДУЩИЙ закрытый HTF бар
    }
    // ...
    return htfIdx;
}
По умолчанию lookahead=false → возвращается предыдущий закрытый день (rawHtfIdx - 1).
✅ Решение
Вариант 1: Использовать lookahead=true в request.security
// Было (возвращает вчерашний день):
yesterdayHigh = request.security(syminfo.tickerid, "D", high[1])

// Стало (возвращает текущий незакрытый день):
yesterdayHigh = request.security(syminfo.tickerid, "D", high[1], lookahead=barmerge.lookahead_on)
Вариант 2: Изменить логику на MSK-границы
Требуется модификация periodForTime():
function periodForTime(tSec, tf, tfSeconds) {
    if (tf === "D" || tf === "1D") {
      // ← ДОБАВИТЬ смещение MSK
      const d2 = new Date((tSec + 3*3600) * 1e3);  // +3 часа для MSK
      return d2.getUTCFullYear() * 1e4 + (d2.getUTCMonth() + 1) * 100 + d2.getUTCDate();
    }
    // ...
}
НО: Это требует пересборки resin-bundle.js из исходников @nullarch/resin.
📋 Выводы
[0] = вчера — это корректное поведение при lookahead=false (по умолчанию)
UTC-границы — зашито в periodForTime() через getUTCDate()
Для получения текущего дня используйте lookahead=barmerge.lookahead_on
Для MSK-границ требуется пересборка resin-bundle.js с патчем
