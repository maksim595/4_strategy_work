const fs = require('fs');
const html = fs.readFileSync('my_strategy_025.html', 'utf8');
const start = html.indexOf('<script>', html.indexOf('</script>') + 10) + 8;
const end = html.lastIndexOf('</script>');
const js = html.substring(start, end);

let open = 0, close = 0, line = 0;
const lines = js.split('\n');
for (let i = 0; i < lines.length; i++) {
    for (let c of lines[i]) {
        if (c === '{') open++;
        if (c === '}') close++;
    }
    if (open - close < 0) {
        console.log(`Строка ${i+1}: избыточная } (open=${open}, close=${close})`);
    }
}
console.log(`Всего строк: ${lines.length}`);
console.log(`Открыто: ${open}, Закрыто: ${close}, Разница: ${open - close}`);
if (open !== close) {
    console.log('❌ Скобки НЕ сбалансированы!');
} else {
    console.log('✅ Скобки сбалансированы');
}
