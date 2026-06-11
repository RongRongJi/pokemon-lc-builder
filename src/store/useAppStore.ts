import { create } from 'zustand';
import { Pokemon, Nature, Stats, TeamMember } from '../types';
import { POKEMON } from '../data/pokemon';
import { NATURES } from '../data/natures';
import { 
  calculateStats, 
  getDefaultNature, 
  searchPokemon,
  generateOptimalSpread,
  getPresetForPokemon,
  findNatureByName,
  Preset,
  calculateMaxPossibleStat,
  calculateMinIVsForPokemon
} from '../utils/calc';
import { smogonSets, SmogonSet } from '../data/smogon-sets';

interface AppState {
  allPokemon: Pokemon[];
  selectedPokemon: Pokemon | null;
  team: TeamMember[];
  searchQuery: string;
  searchResults: Pokemon[];
  selectedNature: Nature;
  selectedAbility: string;
  selectedItem: string;
  selectedMoves: string[];
  ivs: Stats;
  evs: Stats;
  level: number;
  selectedPreset: Preset | null;
  
  setSearchQuery: (query: string) => void;
  selectPokemon: (pokemon: Pokemon | null) => void;
  setNature: (nature: Nature) => void;
  setAbility: (ability: string) => void;
  setItem: (item: string) => void;
  addMove: (move: string) => void;
  removeMove: (move: string) => void;
  setMoves: (moves: string[]) => void;
  setIVs: (ivs: Partial<Stats>) => void;
  setEVs: (evs: Partial<Stats>) => void;
  addToTeam: () => void;
  removeFromTeam: (index: number) => void;
  calculateOptimal: () => void;
  applyPreset: (preset: Preset) => void;
  loadPresetsForCurrentPokemon: () => Preset[];
  getSmogonSetsForCurrentPokemon: () => SmogonSet[];
  applySmogonSet: (smogonSet: SmogonSet) => void;
}

const defaultIVs: Stats = { hp: 31, atk: 31, def: 31, spAtk: 31, spDef: 31, spd: 31 };
const defaultEVs: Stats = { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0 };

export const useAppStore = create<AppState>((set, get) => ({
  allPokemon: POKEMON,
  selectedPokemon: null,
  team: [],
  searchQuery: '',
  searchResults: [],
  selectedNature: getDefaultNature(),
  selectedAbility: '',
  selectedItem: '',
  selectedMoves: [],
  ivs: defaultIVs,
  evs: defaultEVs,
  level: 5,
  selectedPreset: null,
  
  setSearchQuery: (query) => {
    const results = searchPokemon(query, get().allPokemon);
    set({ searchQuery: query, searchResults: results });
  },
  
  selectPokemon: (pokemon) => {
    if (pokemon) {
      const defaultNature = getDefaultNature();
      set({
        selectedPokemon: pokemon,
        selectedNature: defaultNature,
        selectedAbility: pokemon.abilities[0] || '',
        selectedItem: '',
        selectedMoves: [],
        ivs: defaultIVs,
        evs: defaultEVs,
        selectedPreset: null
      });
    } else {
      set({
        selectedPokemon: null,
        selectedNature: getDefaultNature(),
        selectedAbility: '',
        selectedItem: '',
        selectedMoves: [],
        selectedPreset: null
      });
    }
  },
  
  setNature: (nature) => set({ selectedNature: nature }),
  
  setAbility: (ability) => set({ selectedAbility: ability }),
  
  setItem: (item) => set({ selectedItem: item }),
  
  addMove: (move) => {
    const moves = get().selectedMoves;
    if (moves.length < 4 && !moves.includes(move)) {
      set({ selectedMoves: [...moves, move] });
    }
  },
  
  removeMove: (move) => {
    set({ selectedMoves: get().selectedMoves.filter(m => m !== move) });
  },

  setMoves: (moves) => set({ selectedMoves: moves }),
  
  setIVs: (ivs) => set(state => ({ ivs: { ...state.ivs, ...ivs } })),
  
  setEVs: (evs) => set(state => ({ evs: { ...state.evs, ...evs } })),
  
  addToTeam: () => {
    const { selectedPokemon, selectedNature, selectedAbility, selectedItem, selectedMoves, ivs, evs, level, team } = get();
    if (!selectedPokemon || team.length >= 6) return;
    
    const teamMember: TeamMember = {
      pokemon: selectedPokemon,
      nature: selectedNature,
      ability: selectedAbility,
      item: selectedItem,
      moves: [...selectedMoves],
      ivs: { ...ivs },
      evs: { ...evs },
      level
    };
    
    set({ team: [...team, teamMember] });
  },
  
  removeFromTeam: (index) => {
    const team = [...get().team];
    team.splice(index, 1);
    set({ team });
  },
  
  calculateOptimal: () => {
    const { selectedPokemon, selectedNature, level } = get();
    if (!selectedPokemon) return;
    
    const { ivs, evs } = generateOptimalSpread(selectedPokemon, selectedNature, level);
    set({ ivs, evs });
  },
  
  applyPreset: (preset) => {
    const { selectedPokemon } = get();
    if (!selectedPokemon) return;
    
    const nature = findNatureByName(preset.natureName);
    const { ivs, evs } = generateOptimalSpread(selectedPokemon, nature, 5, preset.evPriority);
    
    set({
      selectedNature: nature,
      selectedAbility: preset.ability,
      selectedMoves: preset.moves,
      ivs,
      evs,
      selectedPreset: preset
    });
  },
  
  loadPresetsForCurrentPokemon: () => {
    const { selectedPokemon } = get();
    if (!selectedPokemon) return [];
    
    return getPresetForPokemon(selectedPokemon.name.en);
  },

  getSmogonSetsForCurrentPokemon: () => {
    const { selectedPokemon } = get();
    if (!selectedPokemon) return [];
    
    return smogonSets.filter(
      set => set.pokemonName.en.toLowerCase() === selectedPokemon.name.en.toLowerCase()
    );
  },

  applySmogonSet: (smogonSet) => {
    const { selectedPokemon } = get();
    if (!selectedPokemon) return;

    const nature = findNatureByName(smogonSet.nature);

    // 使用需求4的算法：从31递减计算最小IV
    const calculatedIvs = calculateMinIVsForPokemon(
      selectedPokemon,
      nature,
      smogonSet.evs,
      smogonSet.level
    );

    // 如果配置中指定了特定的 IV，则使用配置中的值
    if (smogonSet.ivs) {
      Object.entries(smogonSet.ivs).forEach(([stat, value]) => {
        if (value !== undefined) {
          calculatedIvs[stat as keyof Stats] = value;
        }
      });
    }

    set({
      selectedNature: nature,
      selectedAbility: smogonSet.ability,
      selectedItem: smogonSet.item,
      selectedMoves: [...smogonSet.moves],
      ivs: calculatedIvs,
      evs: { ...smogonSet.evs },
      selectedPreset: null
    });
  }
}));
