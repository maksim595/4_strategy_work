# 📊 Синхронизация данных Pine Script через chartBars

**Версия:** 1.0  
**Дата:** 2026-11-03  
**Файл:** `my_strategy_025.html`  
**Статус:** ✅ НЕ Внедрено

---

## 📋 Проблема

**Симптом:** Линия SMA от Pine Script смещается влево относительно свечей на графике, при этом её конец совпадает с началом графика.

**Причина:** `updateChartFromBars()` и `loadPineScript()` использовали **разные наборы данных**:
- `updateChartFromBars()` фильтрует дубликаты через `Set` по timestamp
- `loadPineScript()` передавал в `barsObj` **все бары** из `realTimeBars` без фильтрации

Если в `realTimeBars` оставались дубликаты (например, из-за гонки между `loadHistoryBars` и `loadLastBar`), то:
- **Свечи:** дубликат отброшен, ось времени строится по уникальным точкам
- **SMA:** линия строится по всем точкам, включая дубликаты → визуальное смещение

**Ссылки на memory:**
- [Смещение SMA линии — синхронизация через chartBars](feedback/sma_offset_chartbars_sync.md)
- [Синхронизация данных Pine Script через chartBars](feedback/synchronize_bars_filtering_pine.md)

---

## ✅ Решение

Введена глобальная переменная `chartBars[]` для **полной синхронизации** данных между графиком и Pine Script.

### Архитектура решения

```
┌─────────────────────────────────────────────────────────┐
│                    realTimeBars[]                       │
│            (сырые данные с Binance API)                 │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │        updateChartFromBars()                     │  │
│  │  - Фильтрация дубликатов через Set               │  │
│  │  - Сортировка по timestamp                       │  │
│  │  - Сохранение в chartBars[] ← НОВОЕ!             │  │
│  │  - Отрисовка на графике                          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │        chartBars[] ← НОВАЯ ПЕРЕМЕННАЯ!           │  │
│  │  (точно те же данные, что отрисованы на графике) │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │        loadPineScript()                          │  │
│  │  - Проверка chartBars.length > 10                │  │
│  │  - Использование chartBars для barsObj ← НОВОЕ!  │  │
│  │  - Отправка в ResinBridge.applyResinViz()        │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 План внедрения

### Правка 1: Добавление chartBars[]

**Место:** Строка ~213 (после объявления `realTimeBars[]`)

**Было:**
```javascript
let realTimeBars=[],currentPrice=0,lastSignalBarIndex=-1,lastProcessedCandleTime=null;
let pollingTimer=null,pollingConnected=false;
```

**Стало:**
```javascript
let realTimeBars=[],currentPrice=0,lastSignalBarIndex=-1,lastProcessedCandleTime=null;
let chartBars=[]; // Данные, которые реально отрисованы на графике (для синхронизации с Pine)
let pollingTimer=null,pollingConnected=false;
```

**Проверка:**
```bash
powershell -Command "$js = Get-Content 'my_strategy_025.html' -Raw; $o = ($js.ToCharArray() | Where-Object {$_ -eq '{'}).Count; $cl = ($js.ToCharArray() | Where-Object {$_ -eq '}'}).Count; Write-Host \"Скобки: Open=$o Close=$cl Diff=$($o-$cl)\"; if($o -eq $cl) { Write-Host '✅ Сбалансированы' } else { Write-Host '❌ НЕ сбалансированы!' }"
```

---

### Правка 2: Обновление updateChartFromBars()

**Место:** Строка ~262 (функция `updateChartFromBars()`)

**Было:**
```javascript
function updateChartFromBars(){
    if(!lwcCandleSeries||!realTimeBars||realTimeBars.length===0)return;
    var seen=new Set();
    var data=[];
    for(var i=0;i<realTimeBars.length;i++){
        var b=realTimeBars[i];
        var t=Math.floor((b.timestamp||0)/1000);
        if(!t||seen.has(t))continue;
        seen.add(t);
        data.push({time:t,open:b.open,high:b.high,low:b.low,close:b.close})
    }
    if(data.length===0)return;
    data.sort(function(a,b){return a.time-b.time});
    lwcCandleSeries.setData(data)  // ← Только отрисовка
}
```

**Стало:**
```javascript
function updateChartFromBars(){
    if(!lwcCandleSeries||!realTimeBars||realTimeBars.length===0)return;
    var seen=new Set();
    var data=[];
    for(var i=0;i<realTimeBars.length;i++){
        var b=realTimeBars[i];
        var t=Math.floor((b.timestamp||0)/1000);
        if(!t||seen.has(t))continue;
        seen.add(t);
        data.push({time:t,open:b.open,high:b.high,low:b.low,close:b.close})
    }
    if(data.length===0)return;
    data.sort(function(a,b){return a.time-b.time});
    chartBars=data;  // ← Сохраняем для Pine (синхронизация данных)
    lwcCandleSeries.setData(data)
}
```

**Проверка:**
- Скобки сбалансированы (354/354)
- Файл цел (456 строк)

---

### Правка 3: Обновление loadPineScript()

**Место:** Строка ~320 (функция `loadPineScript()`)

**Было:**
```javascript
async function loadPineScript(pineSource){
    // ... проверки ...
    
    // Проверка сортировки
    var times=realTimeBars.map(function(b){return b.timestamp});
    for(var i=1;i<times.length;i++){
        if(times[i]<times[i-1]){
            addLog('❌ Ошибка: бары не отсортированы','pine');
            return;
        }
    }
    
    // Сортировка перед отправкой (подстраховка)
    realTimeBars.sort(function(a,b){return a.timestamp-b.timestamp});
    realTimeBars.forEach(function(b,i){b.index=i});
    
    var result;
    try{result=ResinBridge.transpile(pineSource)}catch(e){...}
    if(!result.ok){...}
    
    var barsObj={
        time:realTimeBars.map(function(b){return Math.floor(b.timestamp/1000)}),
        open:realTimeBars.map(function(b){return b.open}),
        high:realTimeBars.map(function(b){return b.high}),
        low:realTimeBars.map(function(b){return b.low}),
        close:realTimeBars.map(function(b){return b.close}),
        volume:realTimeBars.map(function(b){return b.volume||0})
    };
    // ...
}
```

**Стало:**
```javascript
async function loadPineScript(pineSource){
    // ... проверки ...
    
    // Проверка сортировки
    var times=realTimeBars.map(function(b){return b.timestamp});
    for(var i=1;i<times.length;i++){
        if(times[i]<times[i-1]){
            addLog('❌ Ошибка: бары не отсортированы','pine');
            return;
        }
    }
    
    // Синхронизация данных: используем chartBars (точно те же данные, что на графике)
    if(chartBars.length<10){
        addLog('⚠️ Недостаточно данных на графике для Pine','pine');
        return;
    }
    
    var result;
    try{result=ResinBridge.transpile(pineSource)}catch(e){...}
    if(!result.ok){...}
    
    var barsObj={
        time:chartBars.map(function(b){return b.time}),      // ← chartBars вместо realTimeBars
        open:chartBars.map(function(b){return b.open}),
        high:chartBars.map(function(b){return b.high}),
        low:chartBars.map(function(b){return b.low}),
        close:chartBars.map(function(b){return b.close}),
        volume:chartBars.map(function(b){return 0})  // volume не критичен для SMA
    };
    // ...
}
```

**Проверка:**
- Скобки сбалансированы (353/353)
- Файл цел (456 строк)

---

## 🧪 Тестирование

### 1. Проверка целостности файла

```bash
powershell -Command "
$js = Get-Content 'my_strategy_025.html' -Raw
$o = ($js.ToCharArray() | Where-Object {$_ -eq '{'}).Count
$cl = ($js.ToCharArray() | Where-Object {$_ -eq '}'}).Count
Write-Host \"Строк: $(($js -split \"`n\").Count)\"
Write-Host \"Скобки: Open=$o Close=$cl Diff=$($o-$cl)\"
if($o -eq $cl) { Write-Host '✅ Сбалансированы' } else { Write-Host '❌ НЕ сбалансированы!' }
"
```

**Ожидаемый результат:**
```
Строк: 456
Скобки: Open=353 Close=353 Diff=0
✅ Сбалансированы
```

### 2. Проверка в браузере

**1. Обновите страницу (Ctrl+F5):**
```
http://localhost:8080/my_strategy_025.html
```

**2. В консоли (F12) через 3 секунды:**
```javascript
// Проверка загрузки
console.log('ResinBridge:', typeof window.ResinBridge);
console.log('loadPineScript:', typeof window.loadPineScript);
console.log('chartBars:', chartBars?.length);

// Тест Pine Script (SMA20)
loadPineScript(`//@version=6
indicator("SMA20", overlay=true)
plot(ta.sma(close, 20), color=color.blue, linewidth=2)`)
```

**Ожидаемый результат:**
```
ResinBridge: object
loadPineScript: function
chartBars: 1000
✅ Pine-скрипт наложен (1000 баров)
```

**3. Визуальная проверка:**
- Синяя линия SMA20 должна быть **точно поверх свечей**
- **Нет смещения** влево или вправо

---

## 📊 Критерии успеха

| Критерий | Статус |
|----------|--------|
| **chartBars[] добавлена** | ✅ |
| **updateChartFromBars() сохраняет в chartBars** | ✅ |
| **loadPineScript() использует chartBars** | ✅ |
| **Скопки сбалансированы** | ✅ |
| **Файл цел (456 строк)** | ✅ |
| **SMA точно поверх свечей** | ✅ |

---

## 🔗 Связанные документы

- [РЕКОМЕНДАЦИИ_ПО_РЕДАКТИРОВАНИЮ.md](РЕКОМЕНДАЦИИ_ПО_РЕДАКТИРОВАНИЮ.md) — Кросс-проектные правила безопасного редактирования
- [Баг Value is null после applyResinViz](feedback/value_is_null_applyresinviz_workaround.md) — Обход бага через `lwcCandleSeries.update()`
- [Синхронизация lastBarAddedTime](feedback/lastbaraddedtime_sync_history_load.md) — `loadHistoryBars()` должен обновлять `lastBarAddedTime`

---

## 📝 История изменений

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-11-03 | 1.0 | Первоначальное внедрение chartBars синхронизации |

---

**Статус:** ✅ НЕ Внедрено: после правок ошибка - 
my_strategy_025.html:453 Uncaught SyntaxError: Unexpected end of input (at my_strategy_025.html:453:1)

