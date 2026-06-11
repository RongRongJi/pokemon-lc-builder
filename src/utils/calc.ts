import { Stats, Pokemon, Nature, TeamMember } from '../types';
import { NATURES } from '../data/natures';

const STAT_KEYS = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'spd'] as const;

export function calculateHP(base: number, iv: number, ev: number, level: number = 5): number {
    return Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + level + 10;
}

export function calculateStatWithoutNature(
    base: number,
    iv: number,
    ev: number,
    level: number = 5
): number {
    return Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5;
}

export function calculateStat(
    base: number,
    iv: number,
    ev: number,
    level: number = 5,
    natureBoost: number = 1.0
): number {
    const baseValue = calculateStatWithoutNature(base, iv, ev, level);
    return Math.floor(baseValue * natureBoost);
}

export function calculateStats(
    baseStats: Stats,
    ivs: Stats,
    evs: Stats,
    nature: Nature,
    level: number = 5
): Stats {
    const stats: Partial<Stats> = {};
    
    stats.hp = calculateHP(baseStats.hp, ivs.hp, evs.hp, level);
    
    for (const stat of STAT_KEYS.slice(1)) {
        let natureMod = 1.0;
        if (nature.plus === stat) natureMod = 1.1;
        else if (nature.minus === stat) natureMod = 0.9;
        stats[stat] = calculateStat(baseStats[stat], ivs[stat], evs[stat], level, natureMod);
    }
    
    return stats as Stats;
}

export function calculateMaxPossibleStat(
    base: number,
    statType: 'hp' | 'other',
    natureBoost: number = 1.0,
    level: number = 5
): { maxValue: number; requiredEV: number; minIV: number } {
    let maxValue = 0;
    let bestEV = 0;
    let bestIV = 31;
    
    // 第一步：找到最大可能的stat值
    for (let ev = 0; ev <= 252; ev += 4) {
        for (let iv = 0; iv <= 31; iv++) {
            let value;
            if (statType === 'hp') {
                value = calculateHP(base, iv, ev, level);
            } else {
                value = calculateStat(base, iv, ev, level, natureBoost);
            }
            
            if (value > maxValue) {
                maxValue = value;
            }
        }
    }
    
    // 第二步：在能达到maxValue的前提下，找最小的IV
    let minIV = 31;
    for (let iv = 0; iv <= 31; iv++) {
        for (let ev = 0; ev <= 252; ev += 4) {
            let value;
            if (statType === 'hp') {
                value = calculateHP(base, iv, ev, level);
            } else {
                value = calculateStat(base, iv, ev, level, natureBoost);
            }
            
            if (value === maxValue && iv < minIV) {
                minIV = iv;
                bestEV = ev;
            }
        }
    }
    
    bestIV = minIV;
    
    // 第三步：在确定了IV的前提下，找最小的EV
    for (let ev = 0; ev <= bestEV; ev += 4) {
        let value;
        if (statType === 'hp') {
            value = calculateHP(base, bestIV, ev, level);
        } else {
            value = calculateStat(base, bestIV, ev, level, natureBoost);
        }
        
        if (value === maxValue) {
            bestEV = ev;
            break;
        }
    }
    
    return { maxValue, requiredEV: bestEV, minIV: bestIV };
}

export function findMinIVForMaxStat(
    base: number,
    statType: 'hp' | 'other',
    natureBoost: number = 1.0,
    level: number = 5
): number {
    const result = calculateMaxPossibleStat(base, statType, natureBoost, level);
    return result.minIV;
}

export function getMinEVForMaxStat(
    base: number,
    iv: number,
    statType: 'hp' | 'other',
    natureBoost: number = 1.0,
    level: number = 5
): number {
    const maxResult = calculateMaxPossibleStat(base, statType, natureBoost, level);
    let minEV = 252;
    
    for (let ev = 0; ev <= 252; ev += 4) {
        let value;
        if (statType === 'hp') {
            value = calculateHP(base, iv, ev, level);
        } else {
            value = calculateStat(base, iv, ev, level, natureBoost);
        }
        
        if (value === maxResult.maxValue && ev < minEV) {
            minEV = ev;
        }
    }
    
    return minEV;
}

// 需求4：从31递减的最小IV计算算法
export function calculateMinIVFromHighToLow(
    base: number,
    ev: number,
    statType: 'hp' | 'other',
    natureBoost: number = 1.0,
    level: number = 5
): number {
    // 先计算IV=31时的属性值
    const valueAt31 = statType === 'hp' 
        ? calculateHP(base, 31, ev, level)
        : calculateStat(base, 31, ev, level, natureBoost);
    
    // 从30开始递减，直到属性值发生变化
    for (let iv = 30; iv >= 0; iv--) {
        const currentValue = statType === 'hp'
            ? calculateHP(base, iv, ev, level)
            : calculateStat(base, iv, ev, level, natureBoost);
        
        // 如果属性值发生变化，返回上一个IV值
        if (currentValue !== valueAt31) {
            return iv + 1;
        }
    }
    
    // 如果到IV=0属性值都没变，返回0
    return 0;
}

// 应用新算法计算所有属性的最小IV
export function calculateMinIVsForPokemon(
    pokemon: Pokemon,
    nature: Nature,
    evs: Stats,
    level: number = 5
): Stats {
    const ivs: Stats = { hp: 31, atk: 31, def: 31, spAtk: 31, spDef: 31, spd: 31 };
    
    for (const stat of STAT_KEYS) {
        let natureBoost = 1.0;
        if (stat !== 'hp') {
            if (nature.plus === stat) natureBoost = 1.1;
            else if (nature.minus === stat) natureBoost = 0.9;
        }
        
        const statType = stat === 'hp' ? 'hp' : 'other';
        ivs[stat] = calculateMinIVFromHighToLow(
            pokemon.baseStats[stat],
            evs[stat],
            statType,
            natureBoost,
            level
        );
    }
    
    return ivs;
}

// 优化后的完整算法：
// Step 1: 以「IV=31 + baseEvs」计算目标属性值
// Step 2: 贪心分配剩余 EV：每次分配到能最大程度降低 IV 的属性（优先减少 IV=31 和 30）
// Step 3: 无法再降低 IV 后，将剩余 EV 分配到已有努力值的属性上凑满508
// Step 4: 对每个属性做最终 IV 递减到最小能保持目标属性值的 IV
export function optimizeSpread(
  pokemon: Pokemon,
  nature: Nature,
  level: number = 5,
  baseEvs: Stats
): { ivs: Stats; evs: Stats } {
  const STAT_KEYS_LOCAL = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'spd'] as const;
  const evs: Stats = { ...baseEvs };
  const ivs: Stats = { hp: 31, atk: 31, def: 31, spAtk: 31, spDef: 31, spd: 31 };

  // 计算目标属性值（以 IV=31 + 原始 EV 得到的结果）
  const targetStats: Partial<Stats> = {};
  for (const stat of STAT_KEYS_LOCAL) {
    const natureBoost = stat === 'hp' ? 1.0 : (nature.plus === stat ? 1.1 : (nature.minus === stat ? 0.9 : 1.0));
    targetStats[stat] = stat === 'hp'
      ? calculateHP(pokemon.baseStats[stat], 31, evs[stat], level)
      : calculateStat(pokemon.baseStats[stat], 31, evs[stat], level, natureBoost);
  }

  // 给定某属性在某个 EV/IV 配置下是否保持目标值的最小 IV
  const getMinIV = (
    stat: keyof Stats, testEV: number): number => {
      const natureBoost = stat === 'hp' ? 1.0 : (nature.plus === stat ? 1.1 : (nature.minus === stat ? 0.9 : 1.0));
      const target = targetStats[stat]!;
      let minIV = 31;
      for (let iv = 31; iv >= 0; iv--) {
        const v = stat === 'hp'
          ? calculateHP(pokemon.baseStats[stat], iv, testEV, level)
          : calculateStat(pokemon.baseStats[stat], iv, testEV, level, natureBoost);
        if (v === target) {
          minIV = iv;
        } else {
          break;
        }
      }
      return minIV;
    };

  // Step 2: 贪心分配剩余 EV（每次+4到能最大程度降低 IV 的属性）
  let total = Object.values(evs).reduce((a, b) => a + b, 0);
  let iterCount = 0;
  while (total < 508 && iterCount < 500) {
    iterCount++;
    let bestStat: keyof Stats | null = null;
    let bestIVReduction = 0;

    for (const stat of STAT_KEYS_LOCAL) {
      if (evs[stat] >= 252) continue;
      if (total + 4 > 508) continue;

      const newEV = evs[stat] + 4;
      const minIVWithNewEV = getMinIV(stat, newEV);
      const reduction = ivs[stat] - minIVWithNewEV;

      // 优先降低 31 和 30 的优先级更高
      let score = reduction;
      if (ivs[stat] === 31 || ivs[stat] === 30) score += 0.5;
      // 尽量让 IV 值高的属性有额外加分
      score += ivs[stat] * 0.01;

      if (reduction > 0 && score > 0 && (bestStat === null || score > bestIVReduction)) {
        bestStat = stat;
        bestIVReduction = score;
      }
    }

    if (bestStat === null) break;

    evs[bestStat] += 4;
    total += 4;
    ivs[bestStat] = getMinIV(bestStat, evs[bestStat]);
  }

  // Step 3: 剩余 EV 分配到已有努力值的属性上凑满 508（仅在属性值不变的前提下
  if (total < 508) {
    const statsWithEVs = STAT_KEYS_LOCAL.filter(s => evs[s] > 0);
    if (statsWithEVs.length > 0) {
      let changed = true;
      let safety = 0;
      while (total < 508 && changed && safety < 500) {
        changed = false;
        safety++;
        for (const stat of statsWithEVs) {
          if (evs[stat] >= 252) continue;
          if (total + 4 > 508) continue;
          const newEV = evs[stat] + 4;
          // 检查加 4 EV 后属性值不变
          const natureBoost = stat === 'hp' ? 1.0 : (nature.plus === stat ? 1.1 : (nature.minus === stat ? 0.9 : 1.0));
          const v = stat === 'hp'
            ? calculateHP(pokemon.baseStats[stat], ivs[stat], newEV, level)
            : calculateStat(pokemon.baseStats[stat], ivs[stat], newEV, level, natureBoost);
          if (v === targetStats[stat]) {
            evs[stat] = newEV;
            total += 4;
            changed = true;
          }
        }
      }
    }
  }

  // Step 4: 最终的 IV 递减（保险性的完整递减到最小能保持目标值的 IV）
  for (const stat of STAT_KEYS_LOCAL) {
    ivs[stat] = getMinIV(stat, evs[stat]);
  }

  return { ivs, evs };
}

// 保留旧函数以保持兼容性
export function generateOptimalSpread(
    pokemon: Pokemon,
    nature: Nature,
    level: number = 5,
    priority: ('hp' | 'atk' | 'def' | 'spAtk' | 'spDef' | 'spd')[] = ['atk', 'spd', 'hp', 'def', 'spAtk', 'spDef']
): { ivs: Stats; evs: Stats } {
    const ivs: Stats = { hp: 31, atk: 31, def: 31, spAtk: 31, spDef: 31, spd: 31 };
    const evs: Stats = { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0 };
    let totalEVs = 0;
    
    // 首先计算所有属性的最佳IV
    for (const stat of STAT_KEYS) {
        let natureBoost = 1.0;
        if (stat !== 'hp') {
            if (nature.plus === stat) natureBoost = 1.1;
            else if (nature.minus === stat) natureBoost = 0.9;
        }
        
        const statType = stat === 'hp' ? 'hp' : 'other';
        ivs[stat] = findMinIVForMaxStat(pokemon.baseStats[stat], statType, natureBoost, level);
    }
    
    // 按优先级分配EV，确保总和不超过508
    for (const stat of priority) {
        if (totalEVs >= 508) break;
        
        let natureBoost = 1.0;
        if (stat !== 'hp') {
            if (nature.plus === stat) natureBoost = 1.1;
            else if (nature.minus === stat) natureBoost = 0.9;
        }
        
        const statType = stat === 'hp' ? 'hp' : 'other';
        const requiredEV = getMinEVForMaxStat(pokemon.baseStats[stat], ivs[stat], statType, natureBoost, level);
        const availableEV = 508 - totalEVs;
        const assignEV = Math.min(requiredEV, availableEV, 252);
        
        // 确保EV是4的倍数
        evs[stat] = Math.floor(assignEV / 4) * 4;
        totalEVs += evs[stat];
    }
    
    return { ivs, evs };
}

export interface Preset {
    name: string;
    description: string;
    natureName: string;
    ability: string;
    moves: string[];
    evPriority: ('hp' | 'atk' | 'def' | 'spAtk' | 'spDef' | 'spd')[];
}

// Smogon LC Gen 5 常见配置
export const PRESETS: Record<string, Preset[]> = {
    // Gen 1
    bulbasaur: [
        {
            name: 'Physical Attacker',
            description: 'Smogon LC标准配置',
            natureName: 'Adamant',
            ability: 'Overgrow',
            moves: ['Vine Whip', 'Leech Seed', 'Razor Leaf', 'Tackle'],
            evPriority: ['atk', 'spd', 'hp', 'def', 'spAtk', 'spDef']
        }
    ],
    charmander: [
        {
            name: 'Fire Attacker',
            description: 'Smogon LC标准配置',
            natureName: 'Timid',
            ability: 'Blaze',
            moves: ['Ember', 'Dragon Rage', 'Smokescreen', 'Scratch'],
            evPriority: ['spAtk', 'spd', 'hp', 'def', 'spDef', 'atk']
        }
    ],
    squirtle: [
        {
            name: 'Bulky Water',
            description: 'Smogon LC标准配置',
            natureName: 'Bold',
            ability: 'Torrent',
            moves: ['Water Gun', 'Withdraw', 'Bubble', 'Rapid Spin'],
            evPriority: ['hp', 'def', 'spDef', 'spAtk', 'spd', 'atk']
        }
    ],
    // Gen 2-5 宝可梦预设配置（简化版本）
    pichu: [
        {
            name: 'Fast Electric',
            description: 'Smogon LC标准配置',
            natureName: 'Timid',
            ability: 'Static',
            moves: ['Thunder Shock', 'Volt Tackle', 'Thunder Wave', 'Quick Attack'],
            evPriority: ['spd', 'spAtk', 'hp', 'def', 'spDef', 'atk']
        }
    ],
    teddiursa: [
        {
            name: 'Physical Sweeper',
            description: 'Smogon LC标准配置',
            natureName: 'Jolly',
            ability: 'Guts',
            moves: ['Earthquake', 'Crunch', 'Ice Punch', 'Facade'],
            evPriority: ['atk', 'spd', 'hp', 'def', 'spAtk', 'spDef']
        }
    ],
    bagon: [
        {
            name: 'Dragon Dancer',
            description: 'Smogon LC标准配置',
            natureName: 'Adamant',
            ability: 'Rock Head',
            moves: ['Dragon Dance', 'Dragon Rage', 'Bite', 'Headbutt'],
            evPriority: ['atk', 'spd', 'hp', 'def', 'spAtk', 'spDef']
        }
    ],
    mienfoo: [
        {
            name: 'Regenerator',
            description: 'Smogon LC标准配置',
            natureName: 'Jolly',
            ability: 'Regenerator',
            moves: ['High Jump Kick', 'Drain Punch', 'U-turn', 'Fake Out'],
            evPriority: ['atk', 'spd', 'hp', 'def', 'spAtk', 'spDef']
        }
    ],
    bronzor: [
        {
            name: 'Defensive Lead',
            description: 'Smogon LC标准配置',
            natureName: 'Impish',
            ability: 'Levitate',
            moves: ['Stealth Rock', 'Gyro Ball', 'Earthquake', 'Toxic'],
            evPriority: ['hp', 'def', 'spDef', 'atk', 'spAtk', 'spd']
        }
    ],
    scraggy: [
        {
            name: 'Dragon Dancer',
            description: 'Smogon LC标准配置',
            natureName: 'Jolly',
            ability: 'Moxie',
            moves: ['Dragon Dance', 'Crunch', 'Drain Punch', 'Ice Punch'],
            evPriority: ['atk', 'spd', 'hp', 'def', 'spAtk', 'spDef']
        }
    ],
    shellder: [
        {
            name: 'Shell Smash',
            description: 'Smogon LC标准配置',
            natureName: 'Jolly',
            ability: 'Skill Link',
            moves: ['Shell Smash', 'Rock Blast', 'Icicle Spear', 'Surf'],
            evPriority: ['atk', 'spd', 'hp', 'def', 'spAtk', 'spDef']
        }
    ],
    munchlax: [
        {
            name: 'Bulky Normal',
            description: 'Smogon LC标准配置',
            natureName: 'Adamant',
            ability: 'Thick Fat',
            moves: ['Curse', 'Return', 'Earthquake', 'Fire Punch'],
            evPriority: ['hp', 'atk', 'def', 'spDef', 'spAtk', 'spd']
        }
    ],
    foongus: [
        {
            name: 'Bulky Support',
            description: 'Smogon LC标准配置',
            natureName: 'Bold',
            ability: 'Regenerator',
            moves: ['Spore', 'Giga Drain', 'Sludge Bomb', 'Clear Smog'],
            evPriority: ['hp', 'def', 'spDef', 'spAtk', 'spd', 'atk']
        }
    ],
    murkrow: [
        {
            name: 'Priority Attacker',
            description: 'Smogon LC标准配置',
            natureName: 'Jolly',
            ability: 'Prankster',
            moves: ['Night Shade', 'Sucker Punch', 'U-turn', 'Taunt'],
            evPriority: ['atk', 'spd', 'hp', 'def', 'spAtk', 'spDef']
        }
    ],
    misdreavus: [
        {
            name: 'Ghost Support',
            description: 'Smogon LC标准配置',
            natureName: 'Timid',
            ability: 'Levitate',
            moves: ['Will-O-Wisp', 'Shadow Ball', 'Hidden Power', 'Pain Split'],
            evPriority: ['spd', 'spAtk', 'hp', 'def', 'spDef', 'atk']
        }
    ],
    nidoranm: [
        {
            name: 'Poison Attacker',
            description: 'Smogon LC标准配置',
            natureName: 'Adamant',
            ability: 'Poison Point',
            moves: ['Poison Sting', 'Horn Attack', 'Double Kick', 'Leer'],
            evPriority: ['atk', 'spd', 'hp', 'def', 'spAtk', 'spDef']
        }
    ],
    geodude: [
        {
            name: 'Rock Type',
            description: 'Smogon LC标准配置',
            natureName: 'Adamant',
            ability: 'Sturdy',
            moves: ['Rock Throw', 'Tackle', 'Defense Curl', 'Sandstorm'],
            evPriority: ['atk', 'hp', 'def', 'spd', 'spAtk', 'spDef']
        }
    ],
    magnemite: [
        {
            name: 'Steel Electric',
            description: 'Smogon LC标准配置',
            natureName: 'Modest',
            ability: 'Sturdy',
            moves: ['Thunder Shock', 'Sonicboom', 'Flash Cannon', 'Thunder Wave'],
            evPriority: ['spAtk', 'spd', 'hp', 'def', 'spDef', 'atk']
        }
    ],
    gastly: [
        {
            name: 'Fast Ghost',
            description: 'Smogon LC标准配置',
            natureName: 'Timid',
            ability: 'Levitate',
            moves: ['Hex', 'Will-O-Wisp', 'Sludge Bomb', 'Shadow Ball'],
            evPriority: ['spd', 'spAtk', 'hp', 'def', 'spDef', 'atk']
        }
    ],
    drifloon: [
        {
            name: 'Flying Ghost',
            description: 'Smogon LC标准配置',
            natureName: 'Jolly',
            ability: 'Unburden',
            moves: ['Acrobatics', 'Shadow Sneak', 'Will-O-Wisp', 'Memento'],
            evPriority: ['atk', 'spd', 'hp', 'def', 'spAtk', 'spDef']
        }
    ]
};

export function getPresetForPokemon(pokemonName: string): Preset[] {
    const name = pokemonName.toLowerCase();
    if (PRESETS[name]) return PRESETS[name];
    
    for (const key of Object.keys(PRESETS)) {
        if (name.includes(key) || key.includes(name)) {
            return PRESETS[key];
        }
    }
    
    return [];
}

export function generatePokePaste(member: TeamMember): string {
    const { pokemon, nature, ability, moves, ivs, evs, level } = member;
    
    let paste = `${pokemon.name.en} @ Eviolite\n`;
    paste += `Ability: ${ability}\n`;
    paste += `Level: ${level}\n`;
    paste += `Nature: ${nature.name.en}\n`;
    
    const ivLine = `IVs: ${ivs.hp} HP / ${ivs.atk} Atk / ${ivs.def} Def / ${ivs.spAtk} SpA / ${ivs.spDef} SpD / ${ivs.spd} Spe`;
    paste += `${ivLine}\n`;
    
    const evLine = `EVs: ${evs.hp} HP / ${evs.atk} Atk / ${evs.def} Def / ${evs.spAtk} SpA / ${evs.spDef} SpD / ${evs.spd} Spe`;
    paste += `${evLine}\n`;
    
    for (let i = 0; i < Math.min(moves.length, 4); i++) {
        paste += `- ${moves[i]}\n`;
    }
    
    return paste;
}

export function searchPokemon(query: string, pokemonList: Pokemon[]): Pokemon[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return [];
    
    return pokemonList.filter(p => 
        p.name.cn.includes(lowerQuery) || 
        p.name.en.toLowerCase().includes(lowerQuery)
    );
}

export function getDefaultNature(): Nature {
    return NATURES.find(n => n.name.en === 'Hardy') || NATURES[0];
}

export function findNatureByName(name: string): Nature {
    const lowerName = name.toLowerCase();
    return NATURES.find(n => 
        n.name.cn.includes(lowerName) || 
        n.name.en.toLowerCase().includes(lowerName)
    ) || getDefaultNature();
}
