// 爬取 Smogon LC 配置 + 下载道具图标
// 精灵图标已下载，只需爬取配置数据 + 下载道具图标
const fs = require('fs');
const https = require('https');

const POKEMON_LIST_FILE = 'src/data/spider.txt';
const OUTPUT_SET_FILE = 'src/data/smogon-sets.ts';
const ITEM_SPRITES_DIR = 'src/assets/sprites/items';
const POKEMON_SPRITES_DIR = 'src/assets/sprites/pokemon';

// 确保目录存在
if (!fs.existsSync(ITEM_SPRITES_DIR)) fs.mkdirSync(ITEM_SPRITES_DIR, { recursive: true });

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 30000,
    };
    const req = https.get(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${urlObj.protocol}//${urlObj.hostname}${res.headers.location}`;
        resolve(httpsGet(redirectUrl));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Timeout: ' + url)));
  });
}

function httpsDownload(url, destPath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 30000,
    };
    const req = https.get(options, (res) => {
      if (res.statusCode === 404) { reject(new Error('404: ' + url)); return; }
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${urlObj.protocol}//${urlObj.hostname}${res.headers.location}`;
        resolve(httpsDownload(redirectUrl, destPath));
        return;
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(true)));
      file.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Timeout: ' + url)));
  });
}

function parseSmogonPage(html, pokemonName, gen) {
  const sets = [];
  const dexMatch = html.match(/dexSettings\s*=\s*(\{[\s\S]+?\})\s*;?\s*<\/script>/);
  if (!dexMatch) return sets;

  let data;
  try { data = JSON.parse(dexMatch[1]); } catch(e) { return sets; }
  if (!data.injectRpcs || !Array.isArray(data.injectRpcs)) return sets;

  // 查找 dump-pokemon RPC
  for (const rpc of data.injectRpcs) {
    try {
      const req = JSON.parse(rpc[0]);
      if (Array.isArray(req) && req[0] === 'dump-pokemon') {
        const resp = rpc[1];
        if (!resp || !resp.strategies) continue;
        if (!Array.isArray(resp.strategies)) continue;

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
    } catch(e) { /* skip bad RPC */ }
  }

  return sets;
}

function normalizeEVs(configs) {
  const zero = { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0 };
  if (!configs || !Array.isArray(configs) || configs.length === 0) return zero;
  const c = configs[0];
  return {
    hp: Number(c.hp || 0),
    atk: Number(c.atk || 0),
    def: Number(c.def || 0),
    spAtk: Number(c.spa || 0),
    spDef: Number(c.spd || 0),
    spd: Number(c.spe || 0),
  };
}

function normalizeIVs(configs) {
  if (!configs || !Array.isArray(configs) || configs.length === 0) return undefined;
  const c = configs[0];
  const ivs = {
    hp: Number(c.hp || 31),
    atk: Number(c.atk || 31),
    def: Number(c.def || 31),
    spAtk: Number(c.spa || 31),
    spDef: Number(c.spd || 31),
    spd: Number(c.spe || 31),
  };
  // 如果全是 31 则返回 undefined（节省空间）
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
      const name = m.type ? `${m.move} [${m.type}]` : m.move;
      result.push(name);
    } else {
      // 多个选项：用 / 分隔
      const options = slot.map(m => m.type ? `${m.move} [${m.type}]` : m.move);
      result.push(options.slice(0, 3).join(' / '));
    }
    if (result.length >= 4) break;
  }
  return result;
}

async function main() {
  const pokemonList = fs.readFileSync(POKEMON_LIST_FILE, 'utf-8')
    .split('\n').map(s => s.trim()).filter(Boolean);

  const gens = ['bw', 'xy', 'sm'];
  const allSets = [];
  const items = new Set();

  console.log(`开始爬取 ${pokemonList.length} 个精灵 x ${gens.length} 代配置...`);
  let processed = 0;
  let setsCount = 0;

  for (const pokemon of pokemonList) {
    for (const gen of gens) {
      try {
        const url = `https://www.smogon.com/dex/${gen}/pokemon/${pokemon.toLowerCase()}/lc/`;
        const html = await httpsGet(url);
        if (!html || html.length < 1000) continue;

        const sets = parseSmogonPage(html, pokemon, gen);
        for (const s of sets) {
          allSets.push(s);
          if (s.item && s.item !== '-') items.add(s.item);
          setsCount++;
        }
      } catch(e) {
        // 忽略单个错误
      }
    }
    processed++;
    if (processed % 10 === 0 || processed === pokemonList.length) {
      console.log(`  进度: ${processed}/${pokemonList.length}, 已获取 ${setsCount} 条配置`);
    }
  }

  console.log(`\n配置爬取完成，共 ${allSets.length} 条。开始下载道具图标 (${items.size} 个)...`);

  // 下载道具图标
  let itemOk = 0;
  let itemFail = 0;
  for (const itemName of items) {
    const normalized = itemName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const itemPath = `${ITEM_SPRITES_DIR}/${normalized}.png`;
    if (fs.existsSync(itemPath)) { itemOk++; continue; }

    try {
      await httpsDownload(
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${normalized}.png`,
        itemPath
      );
      itemOk++;
    } catch(e) {
      try {
        // 备用：pokemondb
        await httpsDownload(
          `https://img.pokemondb.net/sprites/items/${normalized}.png`,
          itemPath
        );
        itemOk++;
      } catch(e2) {
        itemFail++;
      }
    }
  }
  console.log(`道具图标: ${itemOk} 成功 / ${itemFail} 失败`);

  // ============ 生成 smogon-sets.ts ============
  // 从现有文件加载中文名
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

  // 只保留有技能的配置
  const validSets = allSets.filter(s => s.moves.length > 0);

  const tsContent =
`// Smogon LC 配置数据 - 自动生成
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
  console.log(`精灵图标: ${pokemonList.length} (已存在于 ${POKEMON_SPRITES_DIR}/)`);
  console.log(`配置条目: ${validSets.length} 条`);
  console.log(`道具图标: ${itemOk}/${items.size} 个 (${ITEM_SPRITES_DIR}/)`);
  console.log(`输出文件: ${OUTPUT_SET_FILE}`);
}

main().catch(e => {
  console.error('ERROR:', e);
  process.exit(1);
});
