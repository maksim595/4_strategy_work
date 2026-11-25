# JSON Check (Проверка JSON профилей)

**Когда использовать:** КАЖДОЕ изменение `saveProfile()` / `loadProfile()` — добавление новых настроек, кнопок UI, функций (таймер, фильтры, профиль).

**Цель:** Предотвратить потерю настроек — все новые поля должны сохраняться и загружаться корректно.

---

## Пошаговая инструкция

### 0. ПРОВЕРКА конфликтности
- [ ] Если добавляется новое поле → проверить, нет ли уже существующего поля с таким же именем
- [ ] Если добавляется функция → проверить уникальность имени (`grep_search` по `function name`)
- [ ] Убедиться, что новое поле НЕ пересекается с существующей логикой

### 1. ПЕРЕД добавлением нового поля
- [ ] Найти `saveProfile()` (`grep_search` по `function saveProfile`)
- [ ] Найти `loadProfile()` (`grep_search` по `function loadProfile`)
- [ ] Прочитать обе функции (limit=50-100)

### 2. ДОБАВЛЕНИЕ поля в `saveProfile()`
- [ ] Добавить поле в объект `p = {...}`
- [ ] Проверить вложенность (если поле в `settings: {...}`)
- [ ] Убедиться, что поле НЕ `undefined` (добавить `|| default`)

### 3. ДОБАВЛЕНИЕ поля в `loadProfile()`
- [ ] Добавить загрузку из `p.settings.поле` или `p.поле`
- [ ] Добавить проверку `if (p.settings.поле !== undefined)`
- [ ] Установить значение по умолчанию `|| default`

### 4. ПРОВЕРКА всех полей
```javascript
// Шаблон проверки
console.log('=== saveProfile ===');
console.log('p.settings:', JSON.stringify(p.settings, null, 2));

console.log('=== loadProfile ===');
console.log('trailingEnabled:', trailingEnabled);
console.log('p.settings.trailingEnabled:', p.settings.trailingEnabled);
```

### 5. ТЕСТирование
- [ ] Сохранить профиль (кнопка «💾 Сохранить профиль»)
- [ ] Открыть JSON файл → проверить наличие нового поля
- [ ] Изменить поле в JSON → загрузить профиль (кнопка «📥 Загрузить профиль»)
- [ ] Проверить в консоли: поле загрузилось корректно

---

## Правила пользователя

1. **Все новые настройки** → добавить в `saveProfile()` И `loadProfile()`
2. **Значения по умолчанию** — всегда указывать (`|| true`, `|| 0`, `|| 'default'`)
3. **Вложенность** — если поле в `settings: {...}`, то загружать из `p.settings.поле`
4. **Проверка `undefined`** — НЕ использовать напрямую `p.settings.поле`, только с проверкой
5. **JSON валидность** — после `JSON.stringify()` проверить в консоли
6. **Проверка конфликтности** — новые поля НЕ должны пересекаться с существующими (имена, логика)

---

## Хорошие примеры

### ✅ Пример 1: Добавление `trailingEnabled` (2026-11-17)

**Задача:** Добавить переключатель трейлинга в профиль

**Действия:**
1. `saveProfile()`:
   ```javascript
   settings: {
       trailingEnabled: trailingEnabled,  // ← НОВОЕ
       multiMode: multiModeConfig,
       // ...
   }
   ```
2. `loadProfile()`:
   ```javascript
   trailingEnabled = p.settings.trailingEnabled !== undefined 
       ? !!p.settings.trailingEnabled 
       : true;  // ← По умолчанию true
   if ($('trailingToggle')) $('trailingToggle').value = trailingEnabled ? 'true' : 'false';
   ```
3. Тест:
   - Сохранён профиль → в JSON есть `"trailingEnabled": true`
   - Загружен профиль → переключатель установлен в «Вкл»

**Результат:** Настройка сохраняется и загружается корректно.

---

### ✅ Пример 2: Добавление `__longBacktestRunner` (2026-11-17)

**Задача:** Добавить явный экспорт функции для панели запуска

**Действия:**
1. В конец файла (после `backtestMultiSymbolLong`):
   ```javascript
   window.__longBacktestRunner = function(opts) {
       return backtestMultiSymbolLong(opts);
   };
   ```
2. В `updateScriptLaunchPanel()`:
   ```javascript
   var builtInFunctions = [
       { name: '__longBacktestRunner', label: '📈 Long v2 multi-backtest', isNamespace: false },
       // ...
   ];
   ```
3. В обработчик:
   ```javascript
   if (fnName === '__longBacktestRunner') {
       var params = collectScriptParams(fnName);
       var result = window.backtestMultiSymbolLong(params);
   }
   ```

**Результат:** Функция отображается в панели запуска, параметры сохраняются.

---

## Плохой пример

### ❌ Пример: Потеря настройки `trailingEnabled` (2026-11-17)

**Задача:** Добавить переключатель трейлинга

**Что сделано НЕПРАВИЛЬНО:**
1. ❌ Добавлено в `saveProfile()`: `trailingEnabled: trailingEnabled`
2. ❌ НЕ добавлено в `loadProfile()` → значение НЕ загружается
3. ❌ НЕ проверено значение по умолчанию → `undefined`
4. ❌ Тест НЕ проведён → пользователь обнаружил после загрузки профиля

**Симптом:** После загрузки профиля переключатель в «Выкл» вместо «Вкл»

**Причина:** `loadProfile()` НЕ загружает `p.settings.trailingEnabled`

**Как исправить:**
- ВСЕГДА добавлять в ОБЕ функции (`saveProfile()` И `loadProfile()`)
- Проверять `!== undefined` перед использованием
- Указывать значение по умолчанию (`|| true`)
- Тестировать: сохранить → открыть JSON → загрузить → проверить UI

---

## Шаблоны

### Шаблон `saveProfile()`
```javascript
function saveProfile() {
    var p = {
        name: 'profile_' + Date.now(),
        settings: {
            trailingEnabled: trailingEnabled,  // ← НОВОЕ
            multiMode: multiModeConfig,
            // ...
        },
        state: { /* ... */ }
    };
    // Сохранение...
}
```

### Шаблон `loadProfile()`
```javascript
function loadProfile(file) {
    var r = new FileReader();
    r.onload = function(e) {
        var p = JSON.parse(e.target.result);
        
        if (p.settings) {
            trailingEnabled = p.settings.trailingEnabled !== undefined 
                ? !!p.settings.trailingEnabled 
                : true;  // ← По умолчанию true
            
            if ($('trailingToggle')) {
                $('trailingToggle').value = trailingEnabled ? 'true' : 'false';
            }
        }
    };
    r.readAsText(file);
}
```

### Шаблон теста в консоли
```javascript
// После saveProfile()
console.log('JSON:', JSON.stringify(p.settings, null, 2));
// Ожидается: { "trailingEnabled": true, ... }

// После loadProfile()
console.log('trailingEnabled:', trailingEnabled);
// Ожидается: true
console.log('UI:', $('trailingToggle').value);
// Ожидается: 'true'
```

---

## CHANGELOG.md

| Дата | Изменение | Причина |
|---|---|---|
| 2026-11-23 | Добавлено: проверка конфликтности | Чтобы новые поля не пересекались с существующими |
| 2026-11-23 | Создан навык | Инцидент с потерей `trailingEnabled` при загрузке профиля |
