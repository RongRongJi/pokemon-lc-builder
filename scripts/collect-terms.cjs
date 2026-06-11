const fs = require('fs');

const pokemonContent = fs.readFileSync('src/data/pokemon.ts', 'utf-8');
const abilityMatches = pokemonContent.match(/abilities:\s*\[([^\]]+)\]/g) || [];
const abilities = new Set();
abilityMatches.forEach(m => {
  const names = m.match(/'([^']+)'/g) || [];
  names.forEach(n => abilities.add(n.replace(/'/g, '')));
});

const setsContent = fs.readFileSync('src/data/smogon-sets.ts', 'utf-8');
const smogonAbilityMatches = setsContent.match(/ability:\s*"([^"]+)"/g) || [];
smogonAbilityMatches.forEach(m => {
  const name = m.match(/"([^"]+)"/);
  if (name) abilities.add(name[1]);
});

const items = new Set();
const itemMatches = setsContent.match(/item:\s*"([^"]+)"/g) || [];
itemMatches.forEach(m => {
  const name = m.match(/"([^"]+)"/);
  if (name) items.add(name[1]);
});

const moves = new Set();
const moveBlockMatches = setsContent.match(/moves:\s*\[([\s\S]*?)\]/g) || [];
moveBlockMatches.forEach(block => {
  const quoted = block.match(/"([^"]+)"/g) || [];
  quoted.forEach(q => {
    const moveStr = q.replace(/"/g, '');
    moveStr.split('/').forEach(part => {
      part.split(',').forEach(p => {
        const clean = p.trim();
        if (clean && clean.length > 1) moves.add(clean);
      });
    });
  });
});

console.log('=== ABILITIES (' + abilities.size + ') ===');
console.log(Array.from(abilities).sort().join('\n'));
console.log('');
console.log('=== ITEMS (' + items.size + ') ===');
console.log(Array.from(items).sort().join('\n'));
console.log('');
console.log('=== MOVES (' + moves.size + ') ===');
console.log(Array.from(moves).sort().join('\n'));

fs.writeFileSync(
  'scripts/_terms.json',
  JSON.stringify(
    {
      abilities: Array.from(abilities).sort(),
      items: Array.from(items).sort(),
      moves: Array.from(moves).sort()
    },
    null, 2
  )
);
console.log('\n[OK] 已保存到 scripts/_terms.json');
