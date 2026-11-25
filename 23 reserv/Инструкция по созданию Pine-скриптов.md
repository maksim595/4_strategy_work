Инструкция по созданию Pine-скриптов, которые **запускаются в бэктесте** и **отображают BUY/SELL** в Фрактальном боте v0.25.

### 🔑 Ключевое правило: `indicator`, а не `strategy`

Ваш бот не исполняет торговый движок Resin напрямую. Он читает визуализацию (`viz`), которую возвращает `ResinBridge.run()`. Поэтому скрипты должны быть объявлены как `indicator()`, а сигналы передаваться через `plotshape`. `strategy()` в вашем боте не даст ни бэктеста, ни отрисовки.

### 📝 Обязательный шаблон скрипта

Каждый рабочий скрипт должен следовать этой структуре. Без любого из элементов сигналы либо не появятся, либо «упадут» на нулевую линию.

```pine
//@version=6
indicator("Название стратегии", overlay=true)

// 1. Вычисление условий входа (булевы серии)
buySignal = ...   // ваша логика
sellSignal = ...  // ваша логика

// 2. «Якорь» для адаптера — даёт ценовую привязку (обязательно!)
plot(buySignal ? low : na, "BuyAnchor", color=color.new(color.green, 100), display=display.none)
plot(sellSignal ? high : na, "SellAnchor", color=color.new(color.red, 100), display=display.none)

// 3. Маркеры BUY/SELL (рабочая комбинация)
plotshape(buySignal, "BUY", shape.labelup, location.belowbar, color=color.green, text="BUY", size=size.small)
plotshape(sellSignal, "SELL", shape.labeldown, location.abovebar, color=color.red, text="SELL", size=size.small)
```

### ⚠️ Почему «якорь» обязателен

В документации `resin-lightweight-charts` указано, что `plotshape` рендерится **приблизительно** (`⚠️ approx.`): 12 форм Pine преобразуются в 4 глифа lightweight-charts . Без `plot`-«якоря» адаптер не всегда может определить ценовую координату для маркера, и тот либо исчезает, либо привязывается к нулю. Именно добавление `plot(... ? low : na)` в DMI+ADX исправило ситуацию.

### 🚫 Чего избегать

**Не используйте `location.absolute`.** Хотя в lightweight-charts 5.0.4 появилась возможность позиционировать маркеры по цене (`atPriceTop`/`atPriceBottom`/`atPriceMiddle`) , **адаптер Resin её не использует**. Он остаётся на уровне четырёх базовых глифов и относительного позиционирования. Эксперименты с `location.absolute` приведут к исчезновению маркеров.

**Не используйте `strategy()`.** Resin поддерживает движок стратегий , но ваш бот не читает его статистику. Только `indicator()` + `plotshape` даёт результат в вашей текущей архитектуре.

**Не используйте `bgcolor` и `fill`.** Адаптер их не поддерживает .

**Не получайте значения из кортежей через точку.** `ta.dmi()` возвращает три значения, и обращение `ta.dmi().plusDI` вызовет ошибку компиляции. Используйте деструктуризацию: `[diPlus, diMinus, adxVal] = ta.dmi(14, 14)`.

### 📋 Чек-лист перед добавлением в `manifest.json`

- [ ] Объявление: `indicator(..., overlay=true)`
- [ ] Условия входа — булевы серии (`ta.crossover`, `close > upper` и т.д.)
- [ ] Есть `plot`-«якорь» с `display=display.none` для buy и sell
- [ ] `plotshape` использует `shape.labelup`/`shape.labeldown`
- [ ] `location` — `belowbar`/`abovebar` (не `absolute`)
- [ ] Нет `strategy.*`, `bgcolor`, `fill`
- [ ] Нет `.plusDI`/`.adx` после функций, возвращающих кортежи

### 📌 Про отступы маркеров

Вертикальный отступ (`location.absolute` + `syminfo.mintick`) в вашей связке **не работает** — адаптер Resin не поддерживает позиционирование по цене, несмотря на то что сам lightweight-charts это умеет . Единственный стабильный вариант — маркеры, прижатые к high/low бара. Если отступ критичен, это потребует правки JavaScript-кода бота (отрисовка маркеров вручную через `createSeriesMarkers` с явным `price`), но не Pine-скрипта.

Эта инструкция основана на подтверждённом рабочем паттерне и официальной документации Resin.