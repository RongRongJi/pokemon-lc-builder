// 爬取 Smogon LC 配置 - 并发版本
const fs = require('fs');
const https = require('https');

const POKEMON_LIST_FILE = 'src/data/spider.txt';
const OUTPUT_SET_FILE = 'src/data/smogon-sets.ts';
const ITEM_SPRITES_DIR = 'src/assets/sprites/items';
const CONCURRENCY = 20;
const REQUEST_TIMEOUT = 10000;

if (!fs.existsSync(ITEM_SPRITES_DIR)) fs.mkdirSync(ITEM_SPRITES_DIR, { recursive: true });

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search,
      method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: REQUEST_TIMEOUT,
    };
    const req = https.get(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const ru = res.headers.location.startsWith('http') ? res.headers.location
          : `${urlObj.protocol}//${urlObj.hostname}${res.headers.location}`;
        resolve(httpsGet(ru)); return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Timeout')));
  });
}

function httpsDownload(url, dest) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search,
      method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: REQUEST_TIMEOUT,
    };
    const req = https.get(options, (res) => {
      if (res.statusCode === 404) { reject(new Error('404')); return; }
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const ru = res.headers.location.startsWith('http') ? res.headers.location
          : `${urlObj.protocol}//${urlObj.hostname}${res.headers.location}`;
        resolve(httpsDownload(ru, dest)); return;
      }
      const f = fs.createWriteStream(dest);
      res.pipe(f);
      f.on('finish', () => f.close(() => resolve(true)));
      f.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Timeout')));
  });
}

// 关键修复：dexSettings JSON 可能很大，正则要用非贪婪且正确的括号匹配
function extractDexSettings(html) {
  // 查找 'dexSettings = ' 之后的 JSON
  const start = html.indexOf('dexSettings = ');
  if (start < 0) return null;
  const jsonStart = start + 'dexSettings = '.length;
  // 找到匹配的大括号闭合
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;
  for (let i = jsonStart; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === stringChar) inString = false;
      continue;
    }
    if (c === '"' || c === "'") { inString = true; stringChar = c; continue; }
    if (c === '{') depth++;
    if (c === '}') { depth--; if (depth === 0) { return html.substring(jsonStart, i + 1); } }
  }
  return null;
}

function parseSmogonPage(html, pokemonName, gen) {
  const sets = [];
  const jsonStr = extractDexSettings(html);
  if (!jsonStr) return sets;
  let data;
  try { data = JSON.parse(jsonStr); } catch(e) { return sets; }
  if (!data.injectRpcs || !Array.isArray(data.injectRpcs)) return sets;

  for (const rpc of data.injectRpcs) {
    try {
      const req = JSON.parse(rpc[0]);
      if (Array.isArray(req) && req[0] === 'dump-pokemon') {
        const resp = rpc[1];
        if (!resp || !resp.strategies || !Array.isArray(resp.strategies)) continue;
        for (const strategy of resp.strategies) {
          if (!strategy.movesets || !Array.isArray(strategy.movesets)) continue;
          for (const rawSet of strategy.movesets) {
            const set = {
              pokemonName: { en: pokemonName, cn: pokemonName },
              setName: `[${gen.toUpperCase()}] ${rawSet.name || 'Set'}`,
              description: (rawSet.description || '').replace(/<[^>]+>/g, '').trim(),
              item: (rawSet.items && rawSet.items[0]) || '-',
              ability: (rawSet.abilities && rawSet.abilities[0]) || '-',
              nature: (rawSet.natures && rawSet.natures[0]) || 'Hardy',
              level: (rawSet.levels && rawSet.levels[0]) || 5,
              ivs: normalizeIVs(rawSet.ivconfigs),
              evs: normalizeEVs(rawSet.evconfigs),
              moves: flattenMoves(rawSet.moveslots),
            };
            sets.push(set);
          }
        }
      }
    } catch(e) { /* skip */ }
  }
  return sets;
}

function normalizeEVs(configs) {
  const zero = { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0 };
  if (!configs || !Array.isArray(configs) || configs.length === 0) return zero;
  const c = configs[0];
  return {
    hp: Number(c.hp || 0), atk: Number(c.atk || 0), def: Number(c.def || 0),
    spAtk: Number(c.spa || 0), spDef: Number(c.spd || 0), spd: Number(c.spe || 0),
  };
}

function normalizeIVs(configs) {
  if (!configs || !Array.isArray(configs) || configs.length === 0) return undefined;
  const c = configs[0];
  const ivs = {
    hp: Number(c.hp || 31), atk: Number(c.atk || 31), def: Number(c.def || 31),
    spAtk: Number(c.spa || 31), spDef: Number(c.spd || 31), spd: Number(c.spe || 31),
  };
  const allMax = ivs.hp === 31 && ivs.atk === 31 && ivs.def === 31
    && ivs.spAtk === 31 && ivs.spDef === 31 && ivs.spd === 31;
  return allMax ? undefined : ivs;
}

function flattenMoves(moveslots) {
  if (!moveslots || !Array.isArray(moveslots)) return [];
  const result = [];
  for (const slot of moveslots) {
    if (!Array.isArray(slot) || slot.length === 0) continue;
    if (slot.length === 1) {
      const m = slot[0];
      result.push(m.type ? `${m.move} [${m.type}]` : m.move);
    } else {
      const opts = slot.map(m => m.type ? `${m.move} [${m.type}]` : m.move);
      result.push(opts.slice(0, 3).join(' / '));
    }
    if (result.length >= 4) break;
  }
  return result;
}

async function runTasks(tasks, concurrency) {
  const results = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const myIdx = idx++;
      try { results[myIdx] = await tasks[myIdx](); }
      catch(e) { results[myIdx] = { error: e.message }; }
    }
  }
  const workers = [];
  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const pokemonList = fs.readFileSync(POKEMON_LIST_FILE, 'utf-8')
    .split('\n').map(s => s.trim()).filter(Boolean);
  const gens = ['bw', 'xy', 'sm'];

  console.log(`准备爬取 ${pokemonList.length} 个精灵 x ${gens.length} 代 = ${pokemonList.length * gens.length} 个页面...`);

  // ============ 并发爬取配置 ============
  const tasks = [];
  for (const pokemon of pokemonList) {
    for (const gen of gens) {
      const name = pokemon;
      const g = gen;
      tasks.push(async () => {
        const url = `https://www.smogon.com/dex/${g}/pokemon/${name.toLowerCase()}/lc/`;
        const html = await httpsGet(url);
        if (!html || html.length < 1000) return [];
        return parseSmogonPage(html, name, g);
      });
    }
  }

  console.log(`开始并发请求 (并发度: ${CONCURRENCY})...`);
  const startTime = Date.now();
  const results = await runTasks(tasks, CONCURRENCY);

  const allSets = [];
  const items = new Set();
  for (const r of results) {
    if (Array.isArray(r)) {
      for (const s of r) {
        allSets.push(s);
        if (s.item && s.item !== '-') items.add(s.item);
      }
    }
  }
  console.log(`\n配置爬取完成: ${allSets.length} 条, 耗时 ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`发现 ${items.size} 种道具`);

  // ============ 并发下载道具图标 ============
  const itemArray = Array.from(items);
  const itemTasks = itemArray.map(itemName => async () => {
    const normalized = itemName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const itemPath = `${ITEM_SPRITES_DIR}/${normalized}.png`;
    if (fs.existsSync(itemPath)) return { ok: true, name: itemName };
    try {
      await httpsDownload(
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${normalized}.png`,
        itemPath
      );
      return { ok: true, name: itemName };
    } catch(e) {
      try {
        await httpsDownload(
          `https://img.pokemondb.net/sprites/items/${normalized}.png`,
          itemPath
        );
        return { ok: true, name: itemName };
      } catch(e2) {
        return { ok: false, name: itemName };
      }
    }
  });

  console.log(`下载道具图标...`);
  const itemResults = await runTasks(itemTasks, CONCURRENCY);
  const itemOk = itemResults.filter(r => r && r.ok).length;
  const itemFail = itemResults.filter(r => r && !r.ok).length;
  console.log(`道具图标: ${itemOk} 成功 / ${itemFail} 失败`);

  // ============ 生成 smogon-sets.ts ============
  let existingCNMap = {};
  try {
    const existingContent = fs.readFileSync(OUTPUT_SET_FILE, 'utf-8');
    const matches = existingContent.match(/pokemonName:\s*\{\s*en:\s*"([^"]+)",\s*cn:\s*"([^"]+)"/g);
    if (matches) {
      for (const m of matches) {
        const mm = m.match(/en:\s*"([^"]+)",\s*cn:\s*"([^"]+)"/);
        if (mm) existingCNMap[mm[1]] = mm[2];
      }
    }
  } catch(e) { /* ok */ }

  for (const s of allSets) {
    if (existingCNMap[s.pokemonName.en]) {
      s.pokemonName.cn = existingCNMap[s.pokemonName.en];
    }
  }

  const validSets = allSets.filter(s => s.moves.length > 0);

  const tsContent =
`// Smogon LC 配置数据 - 自动生成 (${new Date().toISOString().split('T')[0]})
// 包含 BW/XY/SM 三代配置

export interface SmogonSet {
  pokemonName: {
    en: string;
    cn: string;
  };
  setName: string;
  description: string;
  item: string;
  ability: string;
  nature: string;
  level: number;
  ivs?: {
    hp: number;
    atk: number;
    def: number;
    spAtk: number;
    spDef: number;
    spd: number;
  };
  evs: {
    hp: number;
    atk: number;
    def: number;
    spAtk: number;
    spDef: number;
    spd: number;
  };
  moves: string[];
}

export const smogonSets: SmogonSet[] = ${JSON.stringify(validSets, null, 2)};
`;

  fs.writeFileSync(OUTPUT_SET_FILE, tsContent, 'utf-8');

  console.log(`\n============ 完成 ============`);
  console.log(`输出文件: ${OUTPUT_SET_FILE}`);
  console.log(`配置条目: ${validSets.length} 条`);
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
