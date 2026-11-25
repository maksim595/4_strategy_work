# 📦 Инструкция по сборке Pine Script моста для v0.25

## Быстрый старт

### Вариант 1: Заглушка (работает сразу)

Файл `resin-bundle.js` уже содержит заглушку. Вы можете:
1. Открыть `my_strategy_025.html` в браузере
2. График будет работать на **lightweight-charts v5**
3. Маркеры фракталов будут отображаться
4. Pine Script **не работает** — будет сообщение в логе

---

### Вариант 2: Полная сборка (требуется Node.js)

#### 1. Установка зависимостей

```bash
cd C:\Users\user\Desktop\ИнтерАкты\trade_projects (2)\4_strategy_work
npm install @nullarch/resin @nullarch/resin-lightweight-charts lightweight-charts@5 --save
```

**⏱ Время установки:** 2-5 минут (зависит от скорости интернета)

**Если установка завершается ошибкой или таймаутом:**
- Проверьте подключение к интернету
- Попробуйте установить по одной:
  ```bash
  npm install lightweight-charts@5 --save
  npm install @nullarch/resin --save
  npm install @nullarch/resin-lightweight-charts --save
  ```

#### 2. Проверка установки

```bash
npm list --depth=0
```

Должно показать:
```
├── @nullarch/resin@x.x.x
├── @nullarch/resin-lightweight-charts@x.x.x
└── lightweight-charts@5.x.x
```

#### 3. Создание entry.js

Файл `entry.js` уже создан в папке проекта:

```javascript
import { transpile, run } from '@nullarch/resin';
import { applyResinViz } from '@nullarch/resin-lightweight-charts';

window.ResinBridge = { transpile, run, applyResinViz };
```

#### 4. Сборка bundle

**Установите esbuild (если не установлен):**
```bash
npm install esbuild --save-dev
```

**Запустите сборку:**
```bash
npx esbuild entry.js --bundle --format=iife --outfile=resin-bundle.js
```

**Или добавьте скрипт в `package.json`:**
```json
"scripts": {
  "build:resin": "esbuild entry.js --bundle --format=iife --outfile=resin-bundle.js"
}
```

```bash
npm run build:resin
```

#### 5. Проверка

Откройте `my_strategy_025.html` в браузере и в консоли (F12) введите:

```javascript
typeof ResinBridge.transpile  // Должно вернуть "function"
```

---

## 🧪 Тестирование Pine Script

После сборки в консоли браузера (F12) введите:

```javascript
loadPineScript(`//@version=6
indicator("SMA20", overlay=true)
plot(ta.sma(close, 20), color=color.blue, linewidth=2)`)
```

**Ожидаемый результат:**
- ✅ В логе бота: `✅ Pine-скрипт наложен (N баров)`
- ✅ На графике появится синяя линия SMA20

**Другие тесты:**

```javascript
// RSI
loadPineScript(`//@version=6
indicator("RSI", overlay=false)
plot(ta.rsi(close, 14), color=color.purple)`)

// MACD
loadPineScript(`//@version=6
indicator("MACD")
[macd, signal, hist] = ta.macd(close, 12, 26, 9)
plot(macd, color=color.blue)
plot(signal, color=color.orange)
plot(hist, color=color.red, style=plot.style_histogram)`)

// Bollinger Bands (overlay)
loadPineScript(`//@version=6
indicator("BB", overlay=true)
[middle, upper, lower] = ta.bb(close, 20, 2.0)
plot(upper, color=color.red)
plot(middle, color=color.blue)
plot(lower, color=color.green)`)
```

---

## 📊 Поддерживаемые Pine-функции

| ✅ Работает | ❌ Не работает |
|------------|---------------|
| `plot` (line, stepline, histogram, columns, area) | `bgcolor` |
| `plotshape` (≈ 4 глифа lightweight-charts) | `fill` |
| `plotchar` | `label.*`, `line.*`, `box.*`, `table.*` |
| `plotcandle`, `plotbar` | |
| `barcolor`, `hline` (константная цена) | |
| Индикаторы: `ta.sma`, `ta.ema`, `ta.rsi`, `ta.macd`, `ta.bb` | |

**Ограничение:** Это не баг интеграции — ограничение самого lightweight-charts (нет per-bar фона, fill, рисованных объектов).

---

## 🔧 Настройка CDN (альтернатива сборке)

Если хотите избежать сборки, замените в `my_strategy_025.html` строку:

```html
<script src="resin-bundle.js"></script>
```

На CDN-версии (если они доступны):

```html
<script src="https://unpkg.com/@nullarch/resin/dist/resin.umd.js"></script>
<script src="https://unpkg.com/@nullarch/resin-lightweight-charts/dist/resin-lightweight-charts.umd.js"></script>
```

**Внимание:** На момент написания инструкции эти CDN могут быть недоступны. Проверьте:
- https://unpkg.com/@nullarch/resin/
- https://www.npmjs.com/package/@nullarch/resin

---

## 🐛 Диагностика проблем

| Симптом | Решение |
|---------|---------|
| `npm install` завершается таймаутом | Проверьте интернет, попробуйте установить по одной библиотеке |
| `❌ resin-bundle.js не загружен` | Файл отсутствует — запустите сборку или используйте заглушку |
| `❌ Ошибка компиляции Pine` | Проверьте версию Pine (`//@version=5` или `//@version=6`) |
| `❌ Недостаточно данных для Pine` | Загрузите исторические бары (подождите WS-подключение) |
| `❌ Ошибка рендера Pine` | Скорее всего, используется неподдерживаемая функция (`bgcolor`, `fill`) |
| График тормозит при скролле | ⚠️ Известная проблема v5 `createSeriesMarkers` — закомментируйте вызов `updateFractalMarkers()` |

---

## 📁 Структура файлов

```
4_strategy_work/
├── my_strategy_024.html         # Оригинальная версия (v0.24)
├── my_strategy_024.html.bak     # Резервная копия
├── my_strategy_025.html         # Новая версия с lightweight-charts + Pine
├── resin-bundle.js              # Pine Script мост (собирается или заглушка)
├── entry.js                     # Точка входа для esbuild
├── package.json                 # Зависимости npm
└── PINE_SCRIPT_BUILD.md         # Этот файл
```

---

## 📚 Ссылки

- **lightweight-charts v5:** https://github.com/tradingview/lightweight-charts
- **Resin (Pine Script runtime):** https://www.npmjs.com/package/@nullarch/resin
- **Resin + lightweight-charts:** https://www.npmjs.com/package/@nullarch/resin-lightweight-charts
- **esbuild:** https://esbuild.github.io/

---

**Версия инструкции:** 1.1  
**Дата:** 2026-10-26  
**Проект:** 4bin_bot3 v0.25

**Примечание:** Установка npm может занять 2-5 минут в зависимости от скорости интернета. Если установка прерывается по таймауту — попробуйте установить библиотеки по одной.
