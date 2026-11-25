# 🧪 Библиотека Pine-скриптов для консоли — полный набор

Отличная цель — фактически вы строите **свой мини-TradingView**. Ниже — готовая «библиотека» скриптов под ваш `my_strategy_025.html` (с уже внедрёнными `chartBars` + фиксом `b.time*1000`). Всё запускается из консоли (F12), без правок HTML.

---

## 📦 Как пользоваться библиотекой

1. Загрузите страницу, дождитесь `chartBars.length > 100` (проверка: `chartBars.length` в консоли).
2. Скопируйте нужный блок в консоль → Enter.
3. Индикатор нарисуется поверх свечей. Повторный вызов другого скрипта **заменит** предыдущий (это by design — `pineVizHandle.remove()`).

> ⚠️ **Один активный Pine-оверлей за раз.** Если нужны несколько индикаторов одновременно — объедините `plot()`-ы в один `indicator()` (примеры ниже).

---

## 🎨 Хелпер: обёртка для чистоты

Вставьте один раз в консоль — создаст глобальные `P` и `CLR`:

```javascript
// === ХЕЛПЕР (вставить один раз за сессию) ===
window.P = function(source, opts) {
    opts = opts || {};
    var title = opts.title || 'Pine';
    var overlay = opts.overlay !== false ? 'true' : 'false';
    var w = opts.width || 2;
    loadPineScript('//@version=6\nindicator("' + title + '", overlay=' + overlay + ')\n' + source);
};
window.CLR = function() {
    if (window.pineVizHandle && typeof pineVizHandle.remove === 'function') {
        try { pineVizHandle.remove(); } catch(e) {}
        pineVizHandle = null;
        addLog('🧹 Pine-оверлей снят', 'pine');
    }
};
console.log('✅ Хелперы P() и CLR() готовы');
```

Теперь `P('plot(...)')` — одна строка на индикатор.

---

## 📚 БИБЛИОТЕКА

### 1. SMA (3 периода — классика)

```javascript
P(`
plot(ta.sma(close, 20),  color=color.blue,   linewidth=2, title="SMA20")
plot(ta.sma(close, 50),  color=color.orange, linewidth=2, title="SMA50")
plot(ta.sma(close, 200), color=color.red,    linewidth=3, title="SMA200")
`, {title: 'SMA 3x', overlay: true});
```

### 2. EMA-крест (9/21 — популярный сигнал)

```javascript
P(`
ema9  = ta.ema(close, 9)
ema21 = ta.ema(close, 21)
plot(ema9,  color=color.aqua,   linewidth=2, title="EMA9")
plot(ema21, color=color.yellow, linewidth=2, title="EMA21")
// Отметки пересечений:
plotshape(ta.crossover(ema9, ema21),  style=shape.triangleup,   location=location.belowbar, color=color.green, size=size.small)
plotshape(ta.crossunder(ema9, ema21), style=shape.triangledown, location=location.abovebar, color=color.red,   size=size.small)
`, {title: 'EMA 9/21', overlay: true});
```

### 3. Bollinger Bands (20, 2σ)

```javascript
P(`
[middle, upper, lower] = ta.bb(close, 20, 2)
plot(middle, color=color.gray,  linewidth=1, title="BB middle")
plot(upper,  color=color.blue,  linewidth=2, title="BB upper")
plot(lower,  color=color.blue,  linewidth=2, title="BB lower")
`, {title: 'Bollinger', overlay: true});
```

### 4. VWAP (внутридневной)

```javascript
P(`
plot(ta.vwap, color=color.purple, linewidth=2, title="VWAP")
`, {title: 'VWAP', overlay: true});
```

### 5. Parabolic SAR

```javascript
P(`
sar = ta.sar(0.02, 0.02, 0.2)
plot(sar, color=close > sar ? color.green : color.red, linewidth=2, style=plot.style_circles, title="SAR")
`, {title: 'SAR', overlay: true});
```

### 6. Supertrend (7, 3)

```javascript
P(`
[st, dir] = ta.supertrend(3, 7)
plot(st, color=dir < 0 ? color.green : color.red, linewidth=2, title="Supertrend")
`, {title: 'Supertrend', overlay: true});
```

### 7. Keltner Channels (EMA20 + ATR20)

```javascript
P(`
[basis, upper, lower] = ta.kc(close, 20, 2)
plot(basis, color=color.gray,  linewidth=1, title="KC basis")
plot(upper, color=color.orange,linewidth=2, title="KC upper")
plot(lower, color=color.orange,linewidth=2, title="KC lower")
`, {title: 'Keltner', overlay: true});
```

### 8. Donchian (highest/lowest 20)

```javascript
P(`
hi = ta.highest(high, 20)
lo = ta.lowest(low,  20)
plot(hi, color=color.fuchsia, linewidth=2, title="Donchian Hi")
plot(lo, color=color.fuchsia, linewidth=2, title="Donchian Lo")
`, {title: 'Donchian', overlay: true});
```

### 9. Williams Fractals (ваш родной)

```javascript
P(`
// Williams Fractals L=2
hh = ta.pivothigh(high, 2, 2)
ll = ta.pivotlow(low,  2, 2)
plotshape(not na(hh), style=shape.triangledown, location=location.abovebar, color=color.red,   size=size.small, offset=-2, title="Fractal High")
plotshape(not na(ll), style=shape.triangleup,   location=location.belowbar, color=color.green, size=size.small, offset=-2, title="Fractal Low")
`, {title: 'Williams Fractals', overlay: true});
```

### 10. Multi-indicator Combo (SMA + BB + RSI-сигнал)

```javascript
P(`
// Три индикатора на одном графике
plot(ta.sma(close, 50),  color=color.orange, linewidth=2, title="SMA50")
plot(ta.sma(close, 200), color=color.red,    linewidth=2, title="SMA200")

[bbMid, bbUp, bbLo] = ta.bb(close, 20, 2)
plot(bbUp, color=color.blue, linewidth=1, title="BB upper")
plot(bbLo, color=color.blue, linewidth=1, title="BB lower")

// RSI<30 → зелёный ромб снизу, RSI>70 → красный сверху
rsi = ta.rsi(close, 14)
plotshape(rsi < 30, style=shape.diamond, location=location.belowbar, color=color.lime, size=size.small, title="RSI<30")
plotshape(rsi > 70, style=shape.diamond, location=location.abovebar, color=color.orange, size=size.small, title="RSI>70")
`, {title: 'Combo', overlay: true});
```

---

## ⚡ Готовые СТРАТЕГИИ (с маркерами входов/выходов)

> **Важно:** `ResinBridge` не эмулирует `strategy.entry/exit` (нет бэктестера), но **сигналы входов/выходов отображаются как `plotshape`** — визуально это работает как полноценная «рабочая стратегия» на графике.

### Стратегия 1: SMA-крест + фильтр по RSI

```javascript
P(`
ema9  = ta.ema(close, 9)
ema21 = ta.ema(close, 21)
rsi   = ta.rsi(close, 14)

plot(ema9,  color=color.aqua,   linewidth=2, title="EMA9")
plot(ema21, color=color.yellow, linewidth=2, title="EMA21")

longSignal  = ta.crossover(ema9, ema21)  and rsi > 50
shortSignal = ta.crossunder(ema9, ema21) and rsi < 50

plotshape(longSignal,  style=shape.labelup,   location=location.belowbar, color=color.green, text="LONG",  size=size.small)
plotshape(shortSignal, style=shape.labeldown, location=location.abovebar, color=color.red,   text="SHORT", size=size.small)
`, {title: 'Strategy: EMA+RSI', overlay: true});
```

### Стратегия 2: Williams Fractals + Bollinger (реверс-от-границы)

```javascript
P(`
[bbMid, bbUp, bbLo] = ta.bb(close, 20, 2)
plot(bbUp, color=color.gray, linewidth=1, title="BB upper")
plot(bbLo, color=color.gray, linewidth=1, title="BB lower")

// LONG: fractal low ниже нижней BB (перепроданность)
ll = ta.pivotlow(low, 2, 2)
// SHORT: fractal high выше верхней BB (перекупленность)
hh = ta.pivothigh(high, 2, 2)

longSignal  = not na(ll) and ll < bbLo
shortSignal = not na(hh) and hh > bbUp

plotshape(longSignal,  style=shape.triangleup,   location=location.belowbar, color=color.green, text="L", size=size.small, offset=-2)
plotshape(shortSignal, style=shape.triangledown, location=location.abovebar, color=color.red,   text="S", size=size.small, offset=-2)
`, {title: 'Strategy: Fractal+BB', overlay: true});
```

### Стратегия 3: Supertrend (простой тренд-следование)

```javascript
P(`
[st, dir] = ta.supertrend(3, 7)
plot(st, color=dir < 0 ? color.green : color.red, linewidth=3, title="Supertrend")

// dir меняется с +1 на -1 = LONG, с -1 на +1 = SHORT
longSignal  = dir < 0 and dir[1] > 0
shortSignal = dir > 0 and dir[1] < 0

plotshape(longSignal,  style=shape.labelup,   location=location.belowbar, color=color.green, text="LONG",  size=size.normal)
plotshape(shortSignal, style=shape.labeldown, location=location.abovebar, color=color.red,   text="SHORT", size=size.normal)
`, {title: 'Strategy: Supertrend', overlay: true});
```

### Стратегия 4: Triple-confirm (SMA + RSI + Volume)

```javascript
P(`
sma50  = ta.sma(close, 50)
sma200 = ta.sma(close, 200)
rsi    = ta.rsi(close, 14)
volMa  = ta.sma(volume, 20)

plot(sma50,  color=color.orange, linewidth=2, title="SMA50")
plot(sma200, color=color.red,    linewidth=2, title="SMA200")

// LONG: цена>SMA50>SMA200 + RSI растёт + объём > MA20
trendUp    = close > sma50 and sma50 > sma200
rsiRising  = rsi > 50 and rsi > rsi[1]
volSpike   = volume > volMa * 1.5

longSignal  = trendUp and rsiRising and volSpike

// SHORT: обратное
trendDown   = close < sma50 and sma50 < sma200
rsiFalling  = rsi < 50 and rsi < rsi[1]
shortSignal = trendDown and rsiFalling and volSpike

plotshape(longSignal,  style=shape.labelup,   location=location.belowbar, color=color.lime, text="BUY",  size=size.normal)
plotshape(shortSignal, style=shape.labeldown, location=location.abovebar, color=color.red,  text="SELL", size=size.normal)
`, {title: 'Strategy: Triple', overlay: true});
```

---

## 🧠 Что реально поддерживает `@nullarch/resin@0.2.2`

Судя по бандлу, доступно **много**:

| Категория | Функции |
|---|---|
| **TA — тренд** | `sma`, `ema`, `wma`, `rma`, `hma`, `dema`, `vwma`, `alma`, `linreg`, `swma` |
| **TA — импульс** | `rsi`, `cmo`, `cci`, `mfi`, `roc`, `mom`, `change`, `tsi`, `rci`, `ao`, `cog` |
| **TA — волатильность** | `atr`, `tr`, `bb`, `bbw`, `kc`, `kcw`, `stdev`, `variance`, `dev`, `range` |
| **TA — объём** | `obv`, `accdist`, `pvt`, `wad`, `nvi`, `pvi`, `wvad`, `iii` |
| **TA — свечи** | `pivothigh`, `pivotlow`, `highest`, `lowest`, `highestbars`, `lowestbars`, `median`, `mode`, `percentrank` |
| **TA — каналы** | `stoch`, `wpr`, `dmi`, `supertrend`, `sar`, `kc`, `vwap`, `pivot_point_levels` |
| **TA — пересечения** | `crossover`, `crossunder`, `cross`, `rising`, `falling` |
| **TA — много-выход** | `macd` (3), `bb` (3), `kc` (3), `kcw`, `dmi` (3), `supertrend` (2), `vwap` (1-3), `pivot_point_levels` (11) |
| **Viz** | `plot`, `plotshape`, `plotchar`, `plotarrow`, `plotcandle`, `plotbar`, `bgcolor`, `barcolor`, `hline`, `fill` |
| **Цвета/стили** | `color.*` (17 имён), `plot.style_*` (10), `shape.*` (12), `location.*` (5), `size.*` (6) |

**НЕ поддерживается** (проверено в `LIMITATIONS` внутри кода):
- Полный `strategy.*` API (нет эмулятора бэктеста, кроме `risk.*`/свойств чтения — часть реализована, но не как «стратегия»).
- `request.security` — есть, но с ограничениями (TF должен быть compile-time const).
- UDT/`type`/`method`/`enum` — реализованы частично (сложные UDF-методы).
- `array.*`, `map.*`, `matrix.*` — полностью.

---

## 🎯 Мои рекомендации по архитектуре вашей «мини-TradingView»

Учитывая вашу цель (аналог Pine → индикаторы + стратегии):

1. **Пишите отдельные `.pine` файлы** в папке (например, `indicators/sma3.pine`, `strategies/ema_cross.pine`) и подгружайте их через `fetch()` + `loadPineScript()`. Это избавит от экранирования бэктиков.

   ```javascript
   fetch('indicators/sma3.pine').then(r => r.text()).then(src => loadPineScript(src));
   ```

2. **Добавьте список индикаторов в UI** (select) → по выбору — `fetch` соответствующего `.pine`. Тогда вы получите полноценный **свой TradingView** без правок бандла.

3. **Хранилище пользовательских скриптов** — `localStorage` (сохранять последний выбранный `.pine` и его содержимое).

4. **Параметры через `input.*`** — в Pine есть `input.int/float/bool/source`. В `resin` они поддержаны (см. `INPUT_PARAM_NAMES` в бандле). Можно строить `loadPineScript(src, {inputs: {length: 50}})` — **однако** в текущей версии `ResinBridge.run` не передаёт `inputs` (нужно дописать ~5 строк в `loadPineScript`, чтобы прокидовать `runResult = ResinBridge.run(result, barsObj, {inputs})`). Скажите — подготовлю патч.

5. **Бэктест-эмулятор** — самая интересная часть. `resin` **не эмулирует** `strategy.entry/exit` в смысле сделок, но раз вы уже **имеете** движок `openPosition`/`checkExitConditions` в `my_strategy_025.html` — можно писать Pine-скрипты, которые генерируют сигналы (`plotshape` с `text="BUY"`), а затем **парсить `viz.shapes`** из `runResult.viz` и подавать в ваш виртуальный движок. Это даст **настоящий бэктест на Pine-сигналах**.

---

## 📋 Накопленный список изменений

| # | Файл | Статус |
|---|---|---|
| 1 | `my_strategy_025.html` | ✅ chartBars sync |
| 2 | `my_strategy_025.html` | ✅ фикс `b.time*1000` для Pine |
| 3 | **Консоль** | **Библиотека скриптов (готово к использованию)** |
| 4 (возможный следующий) | `my_strategy_025.html` | UI-выбор индикатора + `fetch` `.pine`-файлов + `inputs` |
| 5 (возможный следующий) | `my_strategy_025.html` | Парсинг `viz.shapes` → виртуальные сделки (backtest) |

**Готов принять следующий пункт.** Если интересно — могу развернуть пункт 4 или 5 в полноценный план с готовыми блоками.