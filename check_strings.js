const fs = require('fs');
const html = fs.readFileSync('my_strategy_025.html', 'utf8');
const start = html.indexOf('<script>', html.indexOf('</script>') + 10) + 8;
const end = html.lastIndexOf('</script>');
const js = html.substring(start, end);

// Проверка на незавершённые строки
let inString = false, stringChar = null, lineNum = 0;
const lines = js.split('\n');
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let j = 0; j < line.length; j++) {
        let c = line[j];
        if ((c === '"' || c === "'") && line[j-1] !== '\\') {
            if (!inString) {
                inString = true;
                stringChar = c;
            } else if (c === stringChar) {
                inString = false;
                stringChar = null;
            }
        }
    }
    if (inString && !line.trim().endsWith('\\')) {
        console.log(`Строка ${i+1}: незавершённая строка`);
    }
}
console.log(`Проверено ${lines.length} строк`);
if (inString) {
    console.log(`❌ Файл обрывается внутри строки (${stringChar})`);
} else {
    console.log('✅ Все строки завершены');
}
