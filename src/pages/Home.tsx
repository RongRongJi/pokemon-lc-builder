import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { calculateStats, optimizeSpread } from '../utils/calc';
import { NATURES } from '../data/natures';
import { SmogonSet } from '../data/smogon-sets';
import { getAbilityNameCN } from '../data/abilities';
import { getItemNameCN } from '../data/items';
import { getMoveNameCN } from '../data/moves';
import { Stats } from '../types';

const STAT_KEYS: (keyof Stats)[] = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'spd'];

// 精灵/道具图标 URL（使用 Vite BASE_URL，适配 GitHub Pages 子路径）
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
function getPokemonSprite(enName: string): string {
  return `${BASE}/sprites/pokemon/${enName.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;
}
function getItemSprite(itemName: string): string {
  const normalized = itemName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${BASE}/sprites/items/${normalized}.png`;
}

// 技能字符串解析：处理 "Move [Type]" 格式和 "Move1 / Move2" 多选形式
function formatMove(zh: boolean, moveStr: string): string {
  if (!zh) return moveStr;
  return moveStr.split(' / ').map(part => {
    const trimmed = part.trim();
    const bracketMatch = trimmed.match(/^(.+?)\s*\[(.+)\]$/);
    if (bracketMatch) {
      return `${getMoveNameCN(bracketMatch[1].trim())} [${bracketMatch[2].trim()}]`;
    }
    return getMoveNameCN(trimmed);
  }).join(' / ');
}

function displayAbility(zh: boolean, ability: string): string {
  if (!ability || ability === '-') return '-';
  return zh ? getAbilityNameCN(ability) : ability;
}

function displayItem(zh: boolean, item: string): string {
  if (!item || item === '-') return '-';
  return zh ? getItemNameCN(item) : item;
}

function displayNatureCN(natureEn: string): string {
  const n = NATURES.find(n => n.name.en.toLowerCase() === natureEn.toLowerCase());
  return n ? n.name.cn : natureEn;
}

const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A878', fire: '#F08030', water: '#6890F0', grass: '#78C850',
  electric: '#F8D030', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
  ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
  rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
  steel: '#B8B8D0', fairy: '#EE99AC'
};

export default function Home() {
  const { t, i18n } = useTranslation();
  const isZH = i18n.language.startsWith('zh');
  const [copied, setCopied] = useState(false);
  const [smogonSets, setSmogonSets] = useState<SmogonSet[]>([]);
  const [moveInputs, setMoveInputs] = useState(['', '', '', '']);
  const {
    selectedPokemon, team, searchQuery, searchResults, selectedNature,
    selectedAbility, selectedItem, selectedMoves, ivs, evs,
    setSearchQuery, selectPokemon, setNature, setAbility, setItem,
    setIVs, setEVs, setMoves, addToTeam, removeFromTeam,
    getSmogonSetsForCurrentPokemon, applySmogonSet, level
  } = useAppStore();

  const statLabel = (key: keyof Stats) => t(`common.${key}`);

  useEffect(() => {
    setSmogonSets(selectedPokemon ? getSmogonSetsForCurrentPokemon() : []);
  }, [selectedPokemon]);

  useEffect(() => {
    setMoveInputs(selectedMoves.concat(['', '', '', '']).slice(0, 4));
  }, [selectedMoves]);

  const handleMoveInputChange = (index: number, value: string) => {
    const newInputs = [...moveInputs];
    newInputs[index] = value;
    setMoveInputs(newInputs);
  };

  const currentStats = selectedPokemon
    ? calculateStats(selectedPokemon.baseStats, ivs, evs, selectedNature, level)
    : null;

  const handleCopyPokePaste = () => {
    const teamForPaste = team.map(member => {
      const { ivs: mIvs, evs: mEvs } = optimizeSpread(
        member.pokemon,
        member.nature,
        member.level,
        member.evs
      );
      return { ...member, ivs: mIvs, evs: mEvs };
    });
    const paste = teamForPaste.map(member => {
      const { pokemon, nature, ability, moves, ivs: mIvs, evs: mEvs, level: mLvl } = member;
      let p = `${pokemon.name.en} @ Eviolite\n`;
      p += `Ability: ${ability}\n`;
      p += `Level: ${mLvl}\n`;
      p += `Nature: ${nature.name.en}\n`;
      p += `IVs: ${mIvs.hp} HP / ${mIvs.atk} Atk / ${mIvs.def} Def / ${mIvs.spAtk} SpA / ${mIvs.spDef} SpD / ${mIvs.spd} Spe\n`;
      p += `EVs: ${mEvs.hp} HP / ${mEvs.atk} Atk / ${mEvs.def} Def / ${mEvs.spAtk} SpA / ${mEvs.spDef} SpD / ${mEvs.spd} Spe\n`;
      for (let i = 0; i < Math.min(moves.length, 4); i++) p += `- ${moves[i]}\n`;
      return p;
    }).join('\n');

    const doCopy = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
          await navigator.clipboard.writeText(paste);
          return;
        }
      } catch (err) {
        // 继续 fallback
      }

      // fallback: textarea + execCommand (兼容移动端/WebView)
      const ta = document.createElement('textarea');
      ta.value = paste;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '0';
      ta.style.top = '0';
      ta.style.opacity = '0';
      ta.style.width = '1px';
      ta.style.height = '1px';
      ta.style.padding = '0';
      ta.style.border = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, paste.length);
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        ok = false;
      }
      document.body.removeChild(ta);
      if (!ok) {
        alert('浏览器不允许自动复制，请长按/手动选中以下文本复制：\n\n' + paste);
      }
    };

    doCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplySmogonSet = (smogonSet: SmogonSet) => {
    const { selectedPokemon } = useAppStore.getState();
    if (!selectedPokemon) return;
    const nature = NATURES.find(n => n.name.en.toLowerCase() === smogonSet.nature.toLowerCase()) || NATURES[0];
    const { ivs: optIvs, evs: optEvs } = optimizeSpread(
      selectedPokemon,
      nature,
      smogonSet.level,
      smogonSet.evs
    );
    useAppStore.setState({
      selectedNature: nature,
      selectedAbility: smogonSet.ability,
      selectedItem: smogonSet.item,
      selectedMoves: [...smogonSet.moves],
      ivs: optIvs,
      evs: optEvs,
      selectedPreset: null
    });
  };

  const totalEVs = Object.values(evs).reduce((a, b) => a + b, 0);
  const totalIVs = Object.values(ivs).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 overflow-x-hidden">
      <div className="max-w-3xl mx-auto px-3 py-4 pb-8 min-w-0">
        <header className="text-center mb-4">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => i18n.changeLanguage(isZH ? 'en' : 'zh-CN')}
              className="px-3 py-2 bg-white/15 hover:bg-white/25 border border-white/30 rounded-xl text-white text-sm font-medium transition-all"
            >
              🌐 {isZH ? 'EN' : '中文'}
            </button>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 drop-shadow-lg">
            {t('app.title')}
          </h1>
          <p className="text-blue-200 text-sm">{t('app.subtitle')}</p>
        </header>

        <div className="space-y-4 min-w-0">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/20 min-w-0 overflow-hidden">
            <h2 className="text-lg font-semibold text-white mb-3">{t('common.search')}</h2>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.searchPlaceholder')}
              className="w-full px-4 py-3 text-base rounded-xl bg-white/20 text-white placeholder-white/60 border border-white/30 focus:border-blue-400 focus:outline-none transition-all"
            />
            {searchResults.length > 0 && (
              <div className="mt-3 grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                {searchResults.map(pokemon => (
                  <button
                    key={pokemon.id}
                    onClick={() => selectPokemon(pokemon)}
                    className={`p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                      selectedPokemon?.id === pokemon.id
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <img
                      src={getPokemonSprite(pokemon.name.en)}
                      alt=""
                      className="w-12 h-12 object-contain flex-shrink-0 image-pixel"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-base">{isZH ? pokemon.name.cn : pokemon.name.en}</div>
                      <div className="text-xs opacity-75">{isZH ? pokemon.name.en : pokemon.name.cn}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedPokemon && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/20 space-y-5 min-w-0 overflow-hidden">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <img
                    src={getPokemonSprite(selectedPokemon.name.en)}
                    alt=""
                    className="w-20 h-20 object-contain flex-shrink-0 bg-white/10 rounded-xl"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-white">
                      {isZH ? selectedPokemon.name.cn : selectedPokemon.name.en}
                    </h2>
                    <p className="text-blue-200 text-sm">
                      {isZH ? selectedPokemon.name.en : selectedPokemon.name.cn}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedPokemon.types.map(type => (
                        <span key={type}
                          className="px-2 py-1 rounded-full text-white text-xs font-medium"
                          style={{ backgroundColor: TYPE_COLORS[type] || '#666' }}
                        >
                          {type.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={() => selectPokemon(null)} className="text-white/60 hover:text-white text-xl ml-3 px-2">
                  ✕
                </button>
              </div>

              {smogonSets.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-white font-semibold text-base">{t('common.officialSets')}</h3>
                  <div className="space-y-2">
                    {smogonSets.map((set, idx) => (
                      <div key={idx} className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-yellow-300 font-bold">{set.setName}</h4>
                            <p className="text-xs text-white/70 truncate">{set.description}</p>
                          </div>
                          <button
                            onClick={() => handleApplySmogonSet(set)}
                            className="px-3 py-1.5 ml-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white text-xs font-bold rounded-lg shadow-lg transition-all whitespace-nowrap"
                          >
                            {t('common.apply')}
                          </button>
                        </div>
                        <div className="text-xs text-white/80 space-y-2">
                          <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
                            <span>{t('common.nature')}: <span className="text-white font-medium">{isZH ? displayNatureCN(set.nature) : set.nature}</span></span>
                            <span>{t('common.ability')}: <span className="text-white font-medium">{displayAbility(isZH, set.ability)}</span></span>
                            <span className="flex items-center gap-1">
                              {set.item && set.item !== '-' && (
                                <img
                                  src={getItemSprite(set.item)}
                                  alt=""
                                  className="w-4 h-4 object-contain"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              )}
                              {t('common.item')}: <span className="text-white font-medium">{displayItem(isZH, set.item)}</span>
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span>{t('common.evSpread')}: </span>
                            {Object.entries(set.evs).filter(([_, v]) => v > 0).map(([stat, value]) => (
                              <span key={stat} className="text-white font-medium">{statLabel(stat as keyof Stats)} {value}</span>
                            ))}
                          </div>
                          <div>
                            {t('common.moves')}:{' '}
                            <span className="text-white font-medium">
                              {set.moves.map(m => formatMove(isZH, m)).join(', ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-white font-medium mb-2 block text-sm">{t('common.nature')}</label>
                  <select
                    value={selectedNature.name.en}
                    onChange={(e) => setNature(NATURES.find(n => n.name.en === e.target.value) || NATURES[0])}
                    className="w-full px-4 py-3 text-base rounded-xl bg-gray-800 text-white border border-white/30 focus:border-blue-400 focus:outline-none"
                    style={{ colorScheme: 'dark' }}
                  >
                    {NATURES.map(nature => (
                      <option key={nature.name.en} value={nature.name.en} style={{ backgroundColor: '#1f2937', color: 'white' }}>
                        {isZH ? nature.name.cn : nature.name.en} ({nature.name.en})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-white font-medium mb-2 block text-sm">{t('common.ability')}</label>
                  <select
                    value={selectedAbility}
                    onChange={(e) => setAbility(e.target.value)}
                    className="w-full px-4 py-3 text-base rounded-xl bg-gray-800 text-white border border-white/30 focus:border-blue-400 focus:outline-none"
                    style={{ colorScheme: 'dark' }}
                  >
                    {selectedPokemon.abilities.map(ability => (
                      <option key={ability} value={ability} style={{ backgroundColor: '#1f2937', color: 'white' }}>
                        {isZH ? getAbilityNameCN(ability) : ability}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {currentStats && (
                <div>
                  <h3 className="text-white font-semibold mb-3 text-base">{t('common.calculationResult')} (Lv.{level})</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {STAT_KEYS.map(key => (
                      <div key={key} className="bg-white/10 rounded-xl p-3 text-center">
                        <div className="text-white/70 text-xs mb-1">{statLabel(key)}</div>
                        <div className="text-xl font-bold text-white">{currentStats[key]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-white font-semibold mb-3 text-base">{t('common.individualValues')}
                  <span className="text-white/50 text-xs ml-2">Σ {totalIVs}/186</span>
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {STAT_KEYS.map(key => (
                    <div key={key} className="min-w-0 overflow-hidden">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-white/70 text-xs">{statLabel(key)}</label>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="range" min="0" max="31" value={ivs[key]}
                          onChange={(e) => setIVs({ [key]: parseInt(e.target.value) })}
                          className="flex-1 h-2 min-w-0 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
                        />
                        <input
                          type="number" min="0" max="31" value={ivs[key]}
                          onChange={(e) => setIVs({ [key]: Math.min(31, Math.max(0, parseInt(e.target.value) || 0)) })}
                          className="w-12 px-1 py-1.5 text-sm rounded-lg bg-white/20 text-white border border-white/30 text-center min-w-0"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-3 text-base">{t('common.effortValues')}
                  <span className="text-white/50 text-xs ml-2">Σ {totalEVs}/508</span>
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {STAT_KEYS.map(key => (
                    <div key={key} className="min-w-0 overflow-hidden">
                      <label className="text-white/70 text-xs mb-1 block">{statLabel(key)}</label>
                      <input
                        type="number" min="0" max="252" step="4" value={evs[key]}
                        onChange={(e) => setEVs({ [key]: Math.min(252, Math.max(0, parseInt(e.target.value) || 0)) })}
                        className="w-full px-3 py-2 text-base rounded-lg bg-white/20 text-white border border-white/30 text-center min-w-0"
                      />
                    </div>
                  ))}
                </div>
                {totalEVs > 508 && (
                  <div className="mt-2 text-red-400 text-xs">
                    ⚠️ EV 总和超过 508（当前 {totalEVs}）
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-white font-semibold mb-3 text-base">{t('common.item')}</h3>
                <input
                  type="text" value={selectedItem}
                  onChange={(e) => setItem(e.target.value)}
                  placeholder={t('common.enterItem')}
                  className="w-full px-4 py-3 text-base rounded-xl bg-white/20 text-white placeholder-white/60 border border-white/30 focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div>
                <h3 className="text-white font-semibold mb-3 text-base">{t('common.moves')} (4)</h3>
                <div className="grid grid-cols-1 gap-2">
                  {moveInputs.map((move, index) => (
                    <input
                      key={index} type="text" value={move}
                      onChange={(e) => handleMoveInputChange(index, e.target.value)}
                      placeholder={t('common.moveSlot', { index: index + 1 })}
                      className="px-4 py-3 text-base rounded-xl bg-white/20 text-white placeholder-white/60 border border-white/30 focus:border-blue-400 focus:outline-none"
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  // 先同步用户已修改的技能到 store，然后加入队伍
                  const finalMoves = moveInputs.filter(m => m && m.trim().length > 0);
                  setMoves(finalMoves);
                  addToTeam();
                }}
                disabled={team.length >= 6}
                className="w-full py-4 text-base bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg transition-all active:scale-[0.98]"
              >
                {t('common.addToTeam')} ({team.length}/6)
              </button>
            </div>
          )}

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/20 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">{t('common.myTeam')}</h2>
              {team.length > 0 && (
                <button
                  onClick={handleCopyPokePaste}
                  className="px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg text-sm font-medium transition-all"
                >
                  {copied ? t('common.copied') : t('common.copyPokePaste')}
                </button>
              )}
            </div>
            {team.length === 0 ? (
              <p className="text-white/60 text-center py-6">{t('common.emptyTeam')}</p>
            ) : (
              <div className="space-y-2">
                {team.map((member, index) => (
                  <div key={index} className="bg-white/10 rounded-xl p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <img
                          src={getPokemonSprite(member.pokemon.name.en)}
                          alt=""
                          className="w-12 h-12 object-contain flex-shrink-0 bg-white/10 rounded-lg"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white text-base truncate">
                            {isZH ? member.pokemon.name.cn : member.pokemon.name.en}
                          </div>
                          <div className="text-white/70 text-xs">
                            {isZH ? member.nature.name.cn : member.nature.name.en}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromTeam(index)}
                        className="text-red-400 hover:text-red-300 text-xl ml-2 px-2"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-2 text-xs space-y-1 break-all">
                      <div className="text-white/70">{t('common.ability')}: <span className="text-white/90">{displayAbility(isZH, member.ability)}</span></div>
                      <div className="text-white/70">
                        {member.item && member.item !== '-' && (
                          <img
                            src={getItemSprite(member.item)}
                            alt=""
                            className="inline-block w-4 h-4 object-contain align-middle mr-1"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        {t('common.item')}: <span className="text-white/90">{displayItem(isZH, member.item)}</span>
                      </div>
                      <div className="text-white/60">IV: {Object.values(member.ivs).join('/')}</div>
                      <div className="text-white/60">EV: {Object.values(member.evs).join('/')}</div>
                      <div className="text-white/70">{t('common.moves')}: <span className="text-white/90">{member.moves.map(m => formatMove(isZH, m)).join(', ')}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/20 min-w-0 overflow-hidden">
            <h3 className="text-white font-semibold mb-3 text-base">{t('common.instructions')}</h3>
            <ul className="text-white/70 text-sm space-y-2">
              {(() => {
                const list = t('common.instructions_list', { returnObjects: true });
                const arr = Array.isArray(list) ? list as string[] : [String(list)];
                return arr.map((line, i) => <li key={i}>• {line}</li>);
              })()}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
