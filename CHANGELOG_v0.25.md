# 📋 Changelog: v0.24 → v0.25

## Резюме изменений

**Версия:** 0.25  
**Дата:** 2026-10-26  
**Файл:** `my_strategy_025.html`

---

## ✅ Часть 1: lightweight-charts v5 вместо TradingView виджета

### Что изменено

| Было | Стало |
|------|-------|
| TradingView виджет (`tradingview-widget.com`) | lightweight-charts v5 (`unpkg.com`) |
| `loadTradingView()` | `initLightweightChart()` |
| Виджет создавался отдельно | График рисуется из `realTimeBars` |
| Зависимость от внешнего виджета | Полностью автономная отрисовка |

### Новые функции

```javascript
// Инициализация графика
initLightweightChart()

// Отрисовка/обновление свечей
updateChartFromBars()

// Установка высоты (вызывается из слайдера)
setChartHeight(px)
```

### Технические детали

- **CDN:** `https://unpkg.com/lightweight-charts@5/dist/lightweight-charts.standalone.production.js`
- **Переменные:** `lwcChart`, `lwcCandleSeries`, `lwcResizeObserver`
- **ResizeObserver:** Автоматически подстраивает ширину под контейнер
- **fitContent():** Вызывается только при инициализации и смене ТФ/инструмента (не при каждом баре)

### Изменения в `boot()`

**Было:**
```javascript
loadTradingView();
initHeightControl();
seedInitialBars();
await loadHistoryBars();
```

**Стало:**
```javascript
initHeightControl();
seedInitialBars();
await loadHistoryBars();
initLightweightChart();  // После загрузки баров
```

### Изменения в `subscribeToTimeframe()`

**Добавлено после `processStrategyOnNewBar()`:**
```javascript
processStrategyOnNewBar(realTimeBars.length-1,kline.T);
updateChartFromBars();  // ← Добавлено
updateFractalMarkers();  // ← Добавлено (Часть 2)
```

### Изменения в `changeTimeframe()`

**Добавлена очистка графика:**
```javascript
realTimeBars=[];
lastProcessedCandleTime=null;
if(lwcCandleSeries) lwcCandleSeries.setData([]);           // ← Добавлено
if(lwcMarkersHandle) lwcMarkersHandle.setMarkers([]);       // ← Добавлено
if(lwcChart) lwcChart.timeScale().fitContent();             // ← Добавлено
```

### Изменения в `changeInstrument()`

**Добавлена очистка графика:**
```javascript
subscribeToTimeframe(selectedTimeframe,ns);
if(lwcCandleSeries)lwcCandleSeries.setData([]);             // ← Добавлено
if(lwcMarkersHandle)lwcMarkersHandle.setMarkers([]);        // ← Добавлено
if(lwcChart)lwcChart.timeScale().fitContent();              // ← Добавлено
```

---

## ✅ Часть 2: Маркеры фракталов на графике + лог при смене L

### Лог при смене L

**Добавлен обработчик:**
```javascript
$('fractalPeriod')?.addEventListener('change', function() {
    var newL = parseInt(this.value) || 2;
    if (newL < 1) newL = 1;
    if (newL > 5) newL = 5;
    this.value = newL;
    addLog('Фрактал L=' + newL + ' (' + (newL * 2 + 1) + '-барное окно)', 'settings');
    updateFractalMarkers();  // ← Обновление маркеров
});
```

**Формат лога:** `Фрактал L=3 (7-барное окно)`

### Маркеры фракталов

**Новая функция:**
```javascript
updateFractalMarkers()
```

**Как работает:**
1. Проходит по всем барам `realTimeBars`
2. Для каждого центра проверяет, является ли он фракталом (аналогично `detectFractalSignalRaw`)
3. Создаёт маркеры:
   - **Long:** зелёная стрелка ▼ под баром, текст `L(2)`
   - **Short:** красная стрелка ▲ над баром, текст `S(2)`
4. Применяет маркеры через `lwcMarkersHandle.setMarkers(markers)`

**API lightweight-charts v5:**
- Используется `LightweightCharts.createSeriesMarkers(series, [])`
- **Не** `setMarkers()` (это v4 API)
- Возвращается `lwcMarkersHandle` — primitive для управления маркерами

**Ограничение производительности:**
⚠️ В lightweight-charts v5 известна проблема с производительностью `createSeriesMarkers` даже при пустом списке. Если график начнёт тормозить при скролле — можно закомментировать вызовы `updateFractalMarkers()`.

### Переменные

```javascript
let lwcMarkersHandle = null;  // primitive для маркеров (v5)
```

---

## ✅ Часть 3: Pine Script мост (Resin)

### Подключение библиотек

**В `<head>` добавлено:**
```html
<script src="resin-bundle.js"></script>
```

### Функция `loadPineScript()`

```javascript
async function loadPineScript(pineSource)
```

**Как работает:**
1. **Компиляция:** `ResinBridge.transpile(pineSource)`
2. **Подготовка баров:** Конвертация `realTimeBars` в формат Resin (time в секундах)
3. **Очистка:** `pineVizHandle.remove()` предыдущего рендера
4. **Выполнение:** `ResinBridge.run(result, bars)`
5. **Наложение:** `ResinBridge.applyResinViz(lwcChart, runResult, bars, { mainSeries: false })`

**Параметр `{ mainSeries: false }`:** Не дублировать свечи (свои свечи уже нарисованы в `lwcCandleSeries`)

### Использование из консоли (F12)

```javascript
loadPineScript(`//@version=6
indicator("SMA20", overlay=true)
plot(ta.sma(close, 20), color=color.blue, linewidth=2)`)
```

### Поддерживаемые Pine-функции

| ✅ Работает | ❌ Не работает |
|------------|---------------|
| `plot` (line, stepline, histogram, columns, area) | `bgcolor` |
| `plotshape` (≈ 4 глифа) | `fill` |
| `plotchar` | `label.*`, `line.*`, `box.*`, `table.*` |
| `plotcandle`, `plotbar` | |
| `barcolor`, `hline` | |

### Переменные

```javascript
let pineVizHandle = null;  // { remove } — для очистки предыдущего рендера
```

### Логирование

Добавлен тип лога `'pine'` с цветом `#ec4899` (розовый):
- `❌ resin-bundle.js не загружен`
- `❌ Ошибка компиляции Pine: ...`
- `❌ Pine не скомпилирован: ...`
- `❌ Недостаточно данных для Pine`
- `✅ Pine-скрипт наложен (N баров)`
- `❌ Ошибка рендера Pine: ...`

---

## 📁 Новые файлы

| Файл | Описание |
|------|----------|
| `my_strategy_025.html` | Основная версия v0.25 со всеми изменениями |
| `resin-bundle.js` | Pine Script мост (заглушка или сборка) |
| `PINE_SCRIPT_BUILD.md` | Инструкция по сборке Pine Script моста |
| `CHANGELOG_v0.25.md` | Этот файл |

---

## 🔧 Изменения в структуре кода

### Удалено
```javascript
let tvWidgetInstance = null, tvWidgetReady = false;
// → Оставлено только tvWidgetReady = false (не используется)
```

### Добавлено
```javascript
// Часть 1
let lwcChart = null;
let lwcCandleSeries = null;
let lwcResizeObserver = null;

// Часть 2
let lwcMarkersHandle = null;

// Часть 3
let pineVizHandle = null;
```

### Изменено
```javascript
// Было
function loadTradingView(){ ... }

// Стало
function initLightweightChart(){ ... }
function updateChartFromBars(){ ... }
function setChartHeight(px){ ... }
function updateFractalMarkers(){ ... }
function loadPineScript(pineSource){ ... }
```

### Изменено в `initHeightControl()`

**Было:**
```javascript
function initHeightControl(){
    var sl=$('chartHeightSlider'), hs=$('heightValue'), tc=$('tvWidgetContainer');
    if(sl)sl.addEventListener('input',function(e){
        if(hs)hs.innerText=e.target.value+'px';
        if(tc)tc.style.height=e.target.value+'px'
    })
}
```

**Стало:**
```javascript
function initHeightControl(){
    var sl = $('chartHeightSlider'), hs = $('heightValue');
    if (!sl) return;
    sl.addEventListener('input', function(e) {
        if (hs) hs.innerText = e.target.value + 'px';
        setChartHeight(e.target.value);  // ← Вызов новой функции
    });
}
```

---

## 🧪 Проверка после установки

### 1. График работает

Откройте `my_strategy_025.html` → убедитесь, что:
- ✅ Свечи отображаются
- ✅ Можно менять высоту слайдером
- ✅ Нет ошибок в консоли (F12)

### 2. Маркеры фракталов

В консоли (F12):
```javascript
typeof window.updateFractalMarkers  // "function"
typeof window.lwcMarkersHandle      // "object" (после инициализации)
```

Измените L в настройках (1-5) → проверьте лог:
```
Фрактал L=3 (7-барное окно)
```

### 3. Pine Script (после сборки)

В консоли (F12):
```javascript
typeof window.loadPineScript  // "function"
typeof ResinBridge.transpile  // "function"
```

Загрузите SMA20 (см. выше) → проверьте лог:
```
✅ Pine-скрипт наложен (N баров)
```

---

## ⚠️ Известные проблемы

| Проблема | Статус |
|----------|--------|
| `createSeriesMarkers` тормозит при скролле | ⚠️ Известная проблема lightweight-charts v5. Можно отключить `updateFractalMarkers()` |
| Pine `bgcolor`, `fill`, `label.*` не работают | ❌ Ограничение lightweight-charts (не Resin) |
| CDN `unpkg.com` может быть заблокирован | ⚠️ Альтернатива: `cdn.jsdelivr.net` |

---

## 📚 Ссылки

- **РЕКОМЕНДАЦИИ_ПО_РЕДАКТИРОВАНИЮ.md** — Правила безопасного редактирования
- **PINE_SCRIPT_BUILD.md** — Инструкция по сборке Pine Script моста
- **my_strategy_024.html.bak** — Резервная копия оригинальной версии

---

**Готово к использованию!** 🎉
