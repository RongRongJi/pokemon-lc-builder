// 爬取 Smogon LC 配置并下载精灵/道具图标
// 用法：node scripts/scrape-smogon.cjs
const fs = require('fs');
const https = require('https');
const http = require('http');

const POKEMON_LIST_FILE = 'src/data/spider.txt';
const OUTPUT_SET_FILE = 'src/data/smogon-sets.ts';
const SPRITES_DIR = 'src/assets/sprites';
const ITEM_SPRITES_DIR = 'src/assets/sprites/items';
const POKEMON_SPRITES_DIR = 'src/assets/sprites/pokemon';

// ============ 工具函数：HTTPS 请求 ============
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...headers,
      },
      timeout: 30000,
    };
    const req = https.get(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // 处理重定向
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${urlObj.protocol}//${urlObj.hostname}${res.headers.location}`;
        resolve(httpsGet(redirectUrl, headers));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('Timeout: ' + url)); });
  });
}

function httpsDownload(url, destPath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 30000,
    };
    const req = https.get(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${urlObj.protocol}//${urlObj.hostname}${res.headers.location}`;
        resolve(httpsDownload(redirectUrl, destPath));
        return;
      }
      if (res.statusCode === 404) {
        reject(new Error('404 Not Found: ' + url));
        return;
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(true)));
      file.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('Timeout: ' + url)); });
  });
}

// ============ 从 Smogon 页面提取配置 ============
function parseSmogonSets(html, pokemonName, gen) {
  const sets = [];

  // Smogon 将配置数据放在 script 标签中，通常是 dexSettings 或 JSON 数据
  // 尝试多种方式提取
  let rawSets = null;

  // 方式1: 查找 dexSettings.injectRundown 中的 JSON 数据
  const injectMatch = html.match(/dexSettings\.injectRundown\("([^"]*)",\s*"([^"]*)",\s*(\{[\s\S]*?\})\s*\);/);
  if (injectMatch) {
    try {
      const dataStr = injectMatch[3];
      // dataStr 可能是一个 JS 对象字面量，非严格 JSON，尝试 eval
      const data = eval('(' + dataStr + ')');
      if (data && Array.isArray(data.sets)) {
        rawSets = data.sets;
      }
    } catch (e) { /* skip */ }
  }

  // 方式2: 从脚本标签中查找包含 "moveset" 的 JSON
  if (!rawSets) {
    const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
    if (scriptMatch) {
      for (const s of scriptMatch) {
        if (s.includes('sets') && s.includes('moves')) {
          try {
            const jsonMatch = s.match(/(\{[\s\S]*\"sets\"[\s\S]*\})/);
            if (jsonMatch) {
              const data = JSON.parse(jsonMatch[1]);
              if (data.sets && Array.isArray(data.sets)) {
                rawSets = data.sets;
                break;
              }
            }
          } catch (e) { /* skip */ }
        }
      }
    }
  }

  // 方式3: 解析 HTML 中的配置面板（传统 Smogon 格式）
  if (!rawSets || rawSets.length === 0) {
    const articleMatch = html.match(/<article[^>]*class="[^"]*set[^"]*"[^>]*>[\s\S]*?<\/article>/gi)
      || html.match(/<div[^>]*class="[^"]*set[^"]*"[^>]*>[\s\S]*?<\/div>/gi);
    if (articleMatch) {
      for (const art of articleMatch) {
        const set = parseHtmlSet(art);
        if (set) sets.push(set);
      }
    }
  }

  if (rawSets && rawSets.length > 0) {
    for (const raw of rawSets) {
      const set = {
        pokemonName: { en: pokemonName, cn: pokemonName },
        setName: `[${gen.toUpperCase()}] ${raw.name || raw.title || 'Set'}`,
        description: raw.description || raw.notes || '',
        item: raw.item || (raw.items && raw.items[0]) || '-',
        ability: raw.ability || (raw.abilities && raw.abilities[0]) || '-',
        nature: raw.nature || (raw.natures && raw.natures[0]) || 'Hardy',
        level: 5,
        evs: normalizeEVS(raw.evs || raw.evspreads),
        moves: flattenMoves(raw.moves || raw.movesets),
      };
      sets.push(set);
    }
  }

  return sets;
}

function parseHtmlSet(html) {
  try {
    const nameMatch = html.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i)
      || html.match(/<div[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/div>/i);
    const name = nameMatch ? nameMatch[1].trim() : 'Set';

    const itemMatch = html.match(/item[^<]*<[^>]*>([^<]+)</i) || html.match(/Item:?\s*([^\n<]+)/i);
    const abilityMatch = html.match(/ability[^<]*<[^>]*>([^<]+)</i) || html.match(/Ability:?\s*([^\n<]+)/i);
    const natureMatch = html.match(/nature[^<]*<[^>]*>([^<]+)</i) || html.match(/Nature:?\s*([^\n<]+)/i);

    return {
      pokemonName: '',
      setName: name,
      description: '',
      item: itemMatch ? itemMatch[1].trim() : '-',
      ability: abilityMatch ? abilityMatch[1].trim() : '-',
      nature: natureMatch ? natureMatch[1].trim() : 'Hardy',
      level: 5,
      evs: { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0 },
      moves: [],
    };
  } catch (e) {
    return null;
  }
}

function normalizeEVS(raw) {
  const defaultEVs = { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0 };
  if (!raw) return defaultEVs;
  if (Array.isArray(raw)) {
    // [{ hp: 252, ... }] 或 [252, 0, 0, ...]
    if (typeof raw[0] === 'object') {
      const obj = raw[0];
      return {
        hp: Number(obj.hp || obj.HP || 0),
        atk: Number(obj.atk || obj.Atk || obj.ATK || 0),
        def: Number(obj.def || obj.Def || obj.DEF || 0),
        spAtk: Number(obj.spAtk || obj.SpA || obj.SpecialAttack || obj.spA || 0),
        spDef: Number(obj.spDef || obj.SpD || obj.SpecialDefense || obj.spD || 0),
        spd: Number(obj.spd || obj.Spe || obj.SPD || obj.speed || 0),
      };
    }
  }
  if (typeof raw === 'object') {
    return {
      hp: Number(raw.hp || raw.HP || 0),
      atk: Number(raw.atk || raw.Atk || raw.ATK || 0),
      def: Number(raw.def || raw.Def || raw.DEF || 0),
      spAtk: Number(raw.spAtk || raw.SpA || raw.spA || 0),
      spDef: Number(raw.spDef || raw.SpD || raw.spD || 0),
      spd: Number(raw.spd || raw.Spe || raw.speed || 0),
    };
  }
  return defaultEVs;
}

function flattenMoves(raw) {
  if (!raw) return [];
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw.slice(0, 4);
  if (Array.isArray(raw) && Array.isArray(raw[0])) {
    // [[a, b], [c]] => "a/b" / "c" 形式
    const result = [];
    for (const group of raw) {
      if (Array.isArray(group)) {
        if (group.length === 1) result.push(String(group[0]));
        else if (group.length > 1) result.push(group.slice(0, 3).join('/'));
      } else if (typeof group === 'string') {
        result.push(group);
      }
    }
    return result.slice(0, 4);
  }
  if (Array.isArray(raw) && typeof raw[0] === 'object') {
    return raw.slice(0, 4).map(m => Array.isArray(m.moves) ? m.moves.join('/') : String(m.name || m.move || ''));
  }
  return [];
}

// ============ 精灵名称处理 ============
function spriteName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ============ 主流程 ============
async function main() {
  // 创建目录
  if (!fs.existsSync(SPRITES_DIR)) fs.mkdirSync(SPRITES_DIR, { recursive: true });
  if (!fs.existsSync(POKEMON_SPRITES_DIR)) fs.mkdirSync(POKEMON_SPRITES_DIR, { recursive: true });
  if (!fs.existsSync(ITEM_SPRITES_DIR)) fs.mkdirSync(ITEM_SPRITES_DIR, { recursive: true });

  // 读取精灵列表
  const pokemonList = fs.readFileSync(POKEMON_LIST_FILE, 'utf-8')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  console.log(`[1/3] 共 ${pokemonList.length} 个精灵，开始下载图标...`);
  const gens = ['bw', 'xy', 'sm'];
  const allSets = [];

  // 下载精灵图标
  let spriteOk = 0;
  let spriteFail = 0;
  for (const pokemon of pokemonList) {
    const spritePath = `${POKEMON_SPRITES_DIR}/${spriteName(pokemon)}.png`;
    if (fs.existsSync(spritePath)) { spriteOk++; continue; }

    try {
      await httpsDownload(
        `https://play.pokemonshowdown.com/sprites/gen5/${spriteName(pokemon)}.png`,
        spritePath
      );
      spriteOk++;
    } catch (e) {
      try {
        // 备用：PokeAPI
        await httpsDownload(
          `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${spriteName(pokemon)}.png`,
          spritePath
        );
        spriteOk++;
      } catch (e2) {
        spriteFail++;
        console.log(`  ✗ ${pokemon} 图标下载失败`);
      }
    }
    process.stdout.write(`  进度: ${spriteOk + spriteFail}/${pokemonList.length}\r`);
  }
  console.log(`\n  精灵图标: 成功 ${spriteOk} / 失败 ${spriteFail}`);

  console.log(`\n[2/3] 爬取 Smogon 配置 (${gens.join(', ')})...`);
  let setsCount = 0;
  let skipCount = 0;

  for (const pokemon of pokemonList) {
    for (const gen of gens) {
      try {
        const url = `https://www.smogon.com/dex/${gen}/pokemon/${pokemon.toLowerCase()}/lc/`;
        const html = await httpsGet(url);

        if (!html || html.length < 1000 || html.includes('not found') || html.includes('Page Not Found')) {
          skipCount++;
          continue;
        }

        const sets = parseSmogonSets(html, pokemon, gen);
        if (sets.length > 0) {
          for (const s of sets) {
            // 从精灵数据中获取中文名（如果有）
            allSets.push(s);
            setsCount++;
          }
        }
      } catch (e) {
        skipCount++;
      }
    }
    process.stdout.write(`  已获取 ${allSets.length} 条配置...\r`);
  }
  console.log(`\n  配置总数: ${allSets.length}，跳过 ${skipCount} 个请求`);

  // 收集所有道具名称并下载图标
  console.log(`\n[3/3] 下载道具图标...`);
  const items = new Set();
  for (const s of allSets) {
    if (s.item && s.item !== '-' && s.item.length < 50) items.add(s.item);
  }

  let itemOk = 0;
  let itemFail = 0;
  for (const itemName of items) {
    const normalized = itemName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const itemPath = `${ITEM_SPRITES_DIR}/${normalized}.png`;
    if (fs.existsSync(itemPath)) { itemOk++; continue; }

    try {
      await httpsDownload(
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${normalized}.png`,
        itemPath
      );
      itemOk++;
    } catch (e) {
      try {
        // 备用下载
        await httpsDownload(
          `https://img.pokemondb.net/sprites/items/${normalized}.png`,
          itemPath
        );
        itemOk++;
      } catch (e2) {
        itemFail++;
      }
    }
  }
  console.log(`  道具图标: 成功 ${itemOk} / 失败 ${itemFail}`);

  // ============ 生成 smogon-sets.ts ============
  // 读取现有的 smogon-sets.ts 以保留原有精灵中文名映射
  let existingCNMap = {};
  try {
    const existingContent = fs.readFileSync(OUTPUT_SET_FILE, 'utf-8');
    const existingNameMatches = existingContent.match(/pokemonName:\s*\{\s*en:\s*"([^"]+)",\s*cn:\s*"([^"]+)"/g);
    if (existingNameMatches) {
      for (const m of existingNameMatches) {
        const match = m.match(/en:\s*"([^"]+)",\s*cn:\s*"([^"]+)"/);
        if (match) existingCNMap[match[1]] = match[2];
      }
    }
  } catch (e) { /* 文件不存在则使用空映射 */ }

  // 修复精灵中文名
  for (const s of allSets) {
    if (existingCNMap[s.pokemonName.en]) {
      s.pokemonName.cn = existingCNMap[s.pokemonName.en];
    }
  }

  // 只保留有实际数据的条目
  const validSets = allSets.filter(s => s.moves.length > 0);

  // 生成 TS 代码
  const tsContent =
`import { Stats } from '../types';

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
  ivs?: Partial<Stats>;
  evs: Stats;
  moves: string[];
}

export const smogonSets: SmogonSet[] = ${JSON.stringify(validSets, null, 2)};
`;

  fs.writeFileSync(OUTPUT_SET_FILE, tsContent, 'utf-8');

  console.log(`\n============ 完成 ============`);
  console.log(`精灵图标: ${spriteOk}/${pokemonList.length} 成功`);
  console.log(`配置条目: ${validSets.length} 条`);
  console.log(`道具图标: ${itemOk} 个`);
  console.log(`输出文件: ${OUTPUT_SET_FILE}`);
  console.log(`精灵图标目录: ${POKEMON_SPRITES_DIR}`);
  console.log(`道具图标目录: ${ITEM_SPRITES_DIR}`);
}

main().catch(e => {
  console.error('ERROR:', e);
  process.exit(1);
});
