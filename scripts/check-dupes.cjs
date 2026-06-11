const fs = require('fs');
const content = fs.readFileSync('src/data/moves.ts', 'utf-8');
const lines = content.split('\n');
const keys = {};
lines.forEach((line, i) => {
  const m = line.match(/^\s*"([^"]+)"\s*:/);
  if (m) {
    const k = m[1];
    if (keys[k]) console.log('Duplicate:', k, 'at line', i + 1);
    keys[k] = true;
  }
});
console.log('Done. Total keys:', Object.keys(keys).length);
