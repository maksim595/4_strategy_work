# 📋 Полный список консольных команд для актуальных скриптов

**Актуальные версии:**
- **A v6** — `window.runStealthAv6` (визуализация)				await runStealthAv6()
- **B v6** — `window.scanStealthB` (сканер 43 монет)			await scanStealthB()
- **C v10** — `window.backtestStealthC` (бэктест)				await backtestStealthC()
- ** !!!   Сначала загрузить C v10, потом Long v2   !!! **		await backtestMultiSymbolLong()	
- **C v11** — `window.backtestStealthC` (бэктест с доп. фильтрами)
- **Long-бэктест v2** — `window.backtestMultiSymbolLong` (30+ дней с пагинацией)
- **Long-бэктест v2 (C v11)**
- **Мульти-бэктест v10** — `window.backtestMultiSymbolV10` (10-24 символа, 10 дней)
- **Гибрид** — `window.hybridTop10` (топ-10 × 4 SL)

---

- **C v11** — `window.backtestStealthC` (бэктест с доп. фильтрами)

## 🎯 Как использовать
** 1. Стандартный запуск (все фильтры)
await backtestStealthC();

** 2. Сравнить с v10 (без фильтров)
await backtestStealthC({ minRR: 0, minRange: 0, sessionFilter: false });

** 3. Постепенно включать фильтры
//Только_R:R
await backtestStealthC({ minRange: 0, sessionFilter: false });

//R:R+range
await backtestStealthC({ sessionFilter: false });

** 4. Мульти-символьный с фильтрами
//В_backtestMultiSymbolLong (Long v2) уже используется backtestStealthC — фильтры применятся автоматически:

await backtestMultiSymbolLong({ slBufferPct: 0.5 });   // v11 внутри с фильтрами

** Сравнить с v10 на тех же 10 символах:
//v10_(без_фильтров) — PF ~1.01
//v11_(с_фильтрами) — ожидаем PF 1.5-2.0

---

- **Long-бэктест v2 (C v11)**
  ** Стандартный запуск
//slBufferPct — это буфер стоп-лосса в процентах от линии (yesterdayHigh / yesterdayLow).
await backtestMultiSymbolLong({ slBufferPct: 0.5 })  

//1.v10_(без_фильтров) — эталон PF ~1.01
await backtestMultiSymbolLong({ minRR: 0, minRange: 0, sessionFilter: false });

//2.v11_(с_фильтрами) — ожидаем PF 1.5–2.0
await backtestMultiSymbolLong({ minRR: 1.5, minRange: 1.5, sessionFilter: true });


** 📊 Резюме: что выбрать
//Стандартный_запуск	
await backtestStealthC();

//Мульти-символьный	
await backtestMultiSymbolLong({ slBufferPct: 0.5 });

//Сравнить_с_v10	
await backtestStealthC({ minRR: 0, minRange: 0, sessionFilter: false });

//Шире_SL	
await backtestStealthC({ slBufferPct: 1.0 });

//Уже_SL	
await backtestStealthC({ slBufferPct: 0.3 });

//Строже_R:R	
await backtestStealthC({ minRR: 2.0 });

//Без_session_(тест,как_в_v10)	
await backtestStealthC({ sessionFilter: false });

//60_дней	
await backtestMultiSymbolLong({ barsLimit: 6000 });

---

** A_v7_(визуализация с фильтрами)
//_Стандартный
runStealthAv7();

//_Без_фильтров_(сравнить_с_A_v6)
runStealthAv7({ minRR: 0, minRange: 0, sessionFilter: false });

//_Строже_R:R
runStealthAv7({ minRR: 2.0 });

---

** B_v7_(сканер с фильтрами)
//_Стандартный
await scanStealthBv7();

//_Без_фильтров_(сравнить_с_B_v6)
await scanStealthBv7({ minRR: 0, minRange: 0, sessionFilter: false });

//_Только_первые_10
await scanStealthBv7({ maxSymbols: 10 });

//_Автопереход_на_лучший
await scanStealthBv7({ autoSwitch: true });

//_Детали_найденного
scanShowDetailv7('AVAXUSDT');

//_Отсеянные
scanShowFilteredv7();

//_Экспорт
scanExportJSONv7();

---
** A_v8_auto (визуализация с фильтрами + автообновление)

## 🎯 Полный сценарий работы

//1.Загрузить_A_v8 (вставить скрипт в консоль)

//2.Запустить_автообновление с Telegram-уведомлениями
stealthV8.start({ notifyTelegram: true });

//3.Ждать... (можно свернуть браузер)
//Каждые_15_минут — проверка новая свеча → перерисовка
//При_сигнале → уведомление в Telegram + лог

//4.Проверить статус
stealthV8.status();

//5.Через_час — проверить, сколько сигналов было
stealthV8.status().signals;

//6.Остановить
stealthV8.stop();

---
** B_v8_auto — сканер 43 монет с автообновлением + хелперы

## 🎯 Полный сценарий

//1.Загрузить_B_v8 (вставить скрипт в консоль)

//2.Запустить_автоскан с Telegram и автопереключением
stealthB8.start({ 
    notifyTelegram: true,
    autoSwitch: false,   // true = переключит бота на лучший символ
    minRR: 1.5,
    minRange: 1.5
});

//3.Ждать... (можно свернуть браузер)
//Каждые_15_минут — скан 43 монет

//4.Проверить_через_час
stealthB8.status();

//5.Посмотреть_найденные
stealthB8.showDetail('AVAXUSDT');
stealthB8.showFiltered();

//6.Экспорт
stealthB8.exportJSON();

//7.Остановить
stealthB8.stop();

## 📋 Итог: A v8 + B v8 = полный автомат

A v8	Визуализация текущего символа	Каждые 15m
B v8	Сканер 43 монет	Каждые 15m

## Комбинация:

//Установить_один_раз — работает всё
stealthV8.start({ notifyTelegram: true });   // A v8 (текущий символ)
stealthB8.start({ notifyTelegram: true });   // B v8 (43 монеты)

//_Через_час:
stealthV8.status();
stealthB8.status();

//Остановить:
stealthV8.stop();
stealthB8.stop();

//Оба_работают_независимо:
A v8 — рисует на графике для текущего символа.
B v8 — сканирует 43 монеты в фоне.

Не мешают друг другу.
Telegram — уведомления от обоих.

Теперь у вас полный автомат:
B v8 находит сигналы по 43 монетам.
A v8 показывает разметку текущего символа.

Telegram — уведомления при появлении.
Всё работает само — раз в 15m.

---

## 🎯 A v6 — визуализация (разметка + сигналы)

### Запуск

| Команда | Что делает |
|---|---|
| `await runStealthAv6()` | Очистить + нарисовать: 4 линии, метки SHORT/LONG, SL/Entry/TP1/TP2 на последнем сигнале, Volume, автопрокрутка |
| `runStealthAv6()` | То же, но без ожидания (не рекомендуется) |

### Внутренние хелперы (вызывать после A v6)

| Команда | Что делает |
|---|---|
| `showSignals([927, 644], [])` | Показать маркеры SHORT на барах 927, 644 |
| `showSignals([], [100, 200])` | Показать маркеры LONG на барах 100, 200 |
| `showLevels(927, 'short', entry, stop, tp1, tp2)` | Нарисовать горизонтальные линии для сделки #927 |

### Примеры

```javascript
// Перерисовать разметку
await runStealthAv6();

// Перерисовать для другого ТФ (сменить ТФ → запустить)
// В UI: ТФ = 1h → await runStealthAv6()

// Перерисовать для другого символа
// В UI: ввести SOLUSDT → OK → await runStealthAv6()

// Убрать всю разметку
cleanChart();
```

### Ограничения A v6

- Работает **только на текущем символе** (из UI).
- Показывает **последний сигнал** (не все).
- **Обязательно** переключает на **15m** автоматически.

---

## 🌐 B v6 — сканер 43 монет

### Основные команды

| Команда | Что делает |
|---|---|
| `await scanStealthB()` | Сканировать 43 монеты, показать сигналы SHORT/LONG |
| `await scanStealthB({ verbose: false })` | Без лога каждого символа (быстрее) |
| `await scanStealthB({ minRR: 1.5 })` | Только R:R ≥ 1.5 |
| `await scanStealthB({ autoSwitch: true })` | Автопереход на лучший символ |
| `await scanStealthB({ maxSymbols: 10 })` | Только первые 10 монет |
| `await scanStealthB({ pauseMs: 50 })` | Пауза 50ms между запросами (быстрее, риск rate limit) |

### Хелперы (после сканирования)

| Команда | Что делает |
|---|---|
| `scanShowDetail('SOLUSDT')` | Детали символа (entry, stop, TP1/TP2/TP3, R:R, даты) |
| `scanSwitchToSymbol('SOLUSDT')` | Переключить бота на символ |
| `scanExportJSON()` | Экспорт всех результатов в JSON |
| `window.__lastScanResults` | Массив всех найденных сигналов |

### Примеры

```javascript
// Стандартное сканирование
var results = await scanStealthB();

// Только качественные сигналы
await scanStealthB({ minRR: 1.5 });

// С автопереходом на лучший
await scanStealthB({ minRR: 1.2, autoSwitch: true });

// Детали найденного
scanShowDetail('ETHUSDT');

// Переключиться на ETHUSDT → запустить A v6
scanSwitchToSymbol('ETHUSDT');
await new Promise(r => setTimeout(r, 5000));
await runStealthAv6();

// Экспорт
scanExportJSON();
```

### Ограничения B v6

- Работает **по Binance REST** (не по текущему боту).
- **Не рисует на графике** (только список в консоли).
- Для визуализации найденного — `scanSwitchToSymbol` + `runStealthAv6`.

---

## 📉 C v10 — бэктест (один символ, 30 дней)

### Основные команды

| Команда | Что делает |
|---|---|
| `await backtestStealthC()` | Бэктест на текущем символе (30 дней, дефолтные параметры) |
| `await backtestStealthC({ slBufferPct: 0.5 })` | SL 0.5% |
| `await backtestStealthC({ slBufferPct: 1.0 })` | SL 1.0% (шире) |
| `await backtestStealthC({ tpMode: 'tp1' })` | Цель = TP1 (по умолчанию) |
| `await backtestStealthC({ tpMode: 'tp2' })` | Цель = TP2 |
| `await backtestStealthC({ tpMode: 'tp3' })` | Цель = TP3 |
| `await backtestStealthC({ riskPct: 1.0 })` | Риск 1% на сделку |
| `await backtestStealthC({ sideFilter: 'short' })` | Только SHORT |
| `await backtestStealthC({ sideFilter: 'long' })` | Только LONG |
| `await backtestStealthC({ holdBarsMax: 50 })` | Максимум 50 баров (fallback) |
| `await backtestStealthC({ startDeposit: 50000 })` | Начальный депозит 50000$ |

### Хелперы (после бэктеста)

| Команда | Что делает |
|---|---|
| `backtestStealthC.showTrade(1)` | Детали сделки #1 (Entry, Exit, SL, TP, P&L, MaxHigh/MinLow) |
| `backtestStealthC.showTrades(20)` | Таблица последних 20 сделок |
| `backtestStealthC.exportJSON()` | Экспорт всех сделок в JSON |
| `window.__lastBacktestC` | Объект: `{ signals, trades, metrics, eqCurve }` |
| `window.__lastBacktestC.metrics` | Все метрики (winrate, PF, DD, byReason) |
| `window.__lastBacktestC.trades` | Массив сделок |
| `window.__lastBacktestC.eqCurve` | Эквити-кривая (для графика) |

### Примеры

```javascript
// Стандартный бэктест
await backtestStealthC();

// С узким стопом
await backtestStealthC({ slBufferPct: 0.3 });

// Только SHORT с TP2
await backtestStealthC({ sideFilter: 'short', tpMode: 'tp2' });

// Детали лучшей сделки
backtestStealthC.showTrade(1);

// Таблица всех сделок
backtestStealthC.showTrades(50);

// Сравнение результатов
var r1 = await backtestStealthC({ slBufferPct: 0.3 });
console.log('SL 0.3%: PF=' + r1.metrics.pf);
var r2 = await backtestStealthC({ slBufferPct: 0.7 });
console.log('SL 0.7%: PF=' + r2.metrics.pf);

// Экспорт
backtestStealthC.exportJSON();
```

### Ограничения C v10

- **Не рисует линии** (только маркеры сделок).
- **Не показывает текущий сигнал** (только сделки за период).
- Работает на **одном символе** (текущем).

---

## 📊 Long-бэктест v2 — 30+ дней с пагинацией

### Основные команды

| Команда | Что делает |
|---|---|
| `await backtestMultiSymbolLong()` | 10 топ-символов, 3000 баров (30 дней) |
| `await backtestMultiSymbolLong({ barsLimit: 6000 })` | 60 дней истории |
| `await backtestMultiSymbolLong({ symbols: ['BTCUSDT','ETHUSDT'] })` | Свои символы |
| `await backtestMultiSymbolLong({ slBufferPct: 0.5 })` | SL 0.5% |
| `await backtestMultiSymbolLong({ tpMode: 'tp2' })` | TP2 |
| `await backtestMultiSymbolLong({ barsLimit: 1000 })` | Только 10 дней (быстро) |

### Хелперы

| Команда | Что делает |
|---|---|
| `await backtestMultiSymbolLong.check()` | **Проверка лимитов Binance** (проверить пагинацию) |
| `backtestMultiSymbolLong.exportJSON()` | Экспорт в JSON |
| `window.__longBacktest` | Результаты: `{ perSymbol, allTrades, totals }` |
| `window.__longBacktest.totals` | Общие метрики |
| `window.__longBacktest.perSymbol` | По каждому символу |
| `window.__longBacktest.allTrades` | Все сделки (с `symbol` полем) |

### Примеры

```javascript
// 1. Проверка пагинации
await backtestMultiSymbolLong.check();

// 2. 30-дневный тест
await backtestMultiSymbolLong();

// 3. 60-дневный тест
await backtestMultiSymbolLong({ barsLimit: 6000 });

// 4. Свои символы
await backtestMultiSymbolLong({
    symbols: ['AVAXUSDT','BNBUSDT','SEIUSDT','OPUSDT','ETHUSDT'],
    barsLimit: 3000
});

// 5. Экспорт
backtestMultiSymbolLong.exportJSON();
```

### Ограничения Long-бэктеста

- **10 символов** по умолчанию (можно переопределить).
- **Каждый символ** → отдельный `backtestStealthC` (30 дней).
- **Не рисует на графике** (только консоль + маркеры последнего символа).

---

## 🌐 Мульти-бэктест v10 — 10-24 символа, 10 дней

### Основные команды

| Команда | Что делает |
|---|---|
| `await backtestMultiSymbolV10()` | 24 символа, 1000 баров (10 дней) |
| `await backtestMultiSymbolV10({ slBufferPct: 0.5 })` | SL 0.5% |
| `await backtestMultiSymbolV10({ tpMode: 'tp2' })` | TP2 |
| `await backtestMultiSymbolV10({ symbols: ['BTCUSDT'] })` | Свои символы |

### Хелперы

| Команда | Что делает |
|---|---|
| `backtestMultiSymbolV10.exportJSON()` | Экспорт в JSON |
| `window.__multiBacktestV10` | Результаты (та же структура, что Long) |

### Ограничения

- **10 дней** (1000 баров) — в отличие от Long (30 дней).
- Может быть **избыточен** с Long-бэктестом.

---

## 🎯 Гибрид — топ-10 × 4 SL

### Основные команды

| Команда | Что делает |
|---|---|
| `await hybridTop10()` | 10 символов × 4 SL (0.3, 0.5, 0.7, 1.0) + сводная таблица |

### Результаты

| Команда | Что делает |
|---|---|
| `window.__hybridResults` | Массив результатов по SL (trades, winrate, pnl, pf, avgR) |

### Пример

```javascript
await hybridTop10();
// Смотрим таблицу: какой SL лучший
```

---

## 🧹 Очистка (универсальная)

| Команда | Что делает |
|---|---|
| `cleanChart()` | Очистить график (маркеры + Pine-оверлей + все серии, кроме свечей) |
| `CLR()` | Убрать **только Pine-оверлей** (`pineVizHandle`) |
| `lwcChart.timeScale().fitContent()` | Показать весь график |
| `lwcChart.timeScale().setVisibleLogicalRange({from: 800, to: 950})` | Прокрутить к конкретным барам |

---

## 🧪 Проверка состояния (диагностика)

| Команда | Что делает |
|---|---|
| `fullDiagnostic()` | **7-причинная диагностика** сигналов (проверено) |
| `backtestMultiSymbolLong.check()` | Проверка лимитов Binance (пагинация) |
| `typeof chartBars !== 'undefined' && chartBars.length` | Сколько баров загружено |
| `lwcChart.panes().length` | Сколько панелей на графике (1 = только свечи, 2+ = volume) |
| `lwcChart.panes()[0].getSeries().length` | Сколько серий в pane 0 (свечи + линии) |
| `typeof window.__lastBacktestC !== 'undefined'` | Есть ли результаты C v10 |
| `typeof window.__longBacktest !== 'undefined'` | Есть ли результаты Long-бэктеста |
| `typeof window.__lastScanResults !== 'undefined'` | Есть ли результаты B v6 |

---

## 🔧 Дополнительно: свойства и объекты

| Объект | Что содержит |
|---|---|
| `window.__lastBacktestC` | Результат **последнего** C v10 |
| `window.__lastBacktestC.metrics` | `{ total, wins, losses, winrate, netPnl, netPnlPct, maxDD, pf, avgR, avgDur, skipped, byReason }` |
| `window.__lastBacktestC.trades` | Массив сделок |
| `window.__lastBacktestC.eqCurve` | Эквити-кривая |
| `window.__longBacktest` | Результат **последнего** Long-бэктеста |
| `window.__longBacktest.totals` | Общие метрики (те же поля + `expectancy`, `rr`) |
| `window.__lastScanResults` | Массив найденных B v6 сигналов |
| `window.__multiBacktestV10` | Результат **последнего** мульти-бэктеста |
| `window.__hybridResults` | Результаты **последнего** `hybridTop10()` |

---

## 🎯 Рабочие сценарии (типичные комбинации)

### Сценарий 1: Торговля сегодня

```javascript
// 1. Сканировать рынок
await scanStealthB({ minRR: 1.2 });

// 2. Найти лучший → переключиться
scanSwitchToSymbol('AVAXUSDT');
await new Promise(r => setTimeout(r, 5000));

// 3. Визуализировать
await runStealthAv6();

// 4. Смотреть на график → принимать решение вручную
```

### Сценарий 2: Проверить стратегию

```javascript
// 1. Быстрый тест на 10 днях
await backtestMultiSymbolV10();

// 2. Длинный тест на 30 днях
await backtestMultiSymbolLong();

// 3. Найти оптимальный SL
await hybridTop10();

// 4. Экспорт
backtestMultiSymbolLong.exportJSON();
```

### Сценарий 3: Быстрая проверка одного символа

```javascript
// 1. Текущий символ
await backtestStealthC();

// 2. С другим SL
await backtestStealthC({ slBufferPct: 0.7 });

// 3. Посмотреть последние 20 сделок
backtestStealthC.showTrades(20);
```

### Сценарий 4: Диагностика проблемы

```javascript
// 1. Проверить данные
console.log('chartBars:', chartBars.length);
console.log('symbol:', currentInstrument);
console.log('timeframe:', selectedTimeframe);

// 2. Полная диагностика
fullDiagnostic();

// 3. Проверить лимиты
await backtestMultiSymbolLong.check();

// 4. Проверить график
console.log('panes:', lwcChart.panes().length);
console.log('series:', lwcChart.panes()[0].getSeries().length);
```

---

## 📋 Итоговый список

| # | Скрипт | Основная команда | Хелперы |
|---|---|---|---|
| **A v6** | визуализация | `runStealthAv6()` | `showSignals()`, `showLevels()` |
| **B v6** | сканер 43 монет | `scanStealthB()` | `scanShowDetail()`, `scanSwitchToSymbol()`, `scanExportJSON()` |
| **C v10** | бэктест (30 дней) | `backtestStealthC()` | `showTrade()`, `showTrades()`, `exportJSON()` |
| **Long v2** | бэктест (30+ дней) | `backtestMultiSymbolLong()` | `check()`, `exportJSON()` |
| **Multi v10** | бэктест (10 дней) | `backtestMultiSymbolV10()` | `exportJSON()` |
| **Гибрид** | топ-10 × 4 SL | `hybridTop10()` | — |
| **Очистка** | универсально | `cleanChart()` / `CLR()` | — |
| **Диагностика** | универсально | `fullDiagnostic()` | — |

**Все команды сохраняются в `window`** — вызываются **после** загрузки соответствующего скрипта.

**Готов принять следующий пункт.** Если хотите — могу сделать **шпаргалку в виде `console.log` при загрузке** (чтобы все команды отображались в консоли автоматически).