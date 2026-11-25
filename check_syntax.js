const fs = require('fs');
const html = fs.readFileSync('my_strategy_025.html', 'utf8');
const start = html.indexOf('<script>', html.indexOf('</script>') + 10) + 8;
const end = html.lastIndexOf('</script>');
const js = html.substring(start, end);
fs.writeFileSync('temp_check.js', js, 'utf8');
console.log(`Извлечено ${js.length} символов, ${js.split('\n').length} строк`);
