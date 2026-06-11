export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  spd: number;
}

export interface PokemonName {
  cn: string;
  en: string;
  jp?: string;
}

export interface Pokemon {
  id: number;
  name: PokemonName;
  baseStats: Stats;
  types: string[];
  abilities: string[];
}

export interface Nature {
  name: PokemonName;
  plus: keyof Stats | null;
  minus: keyof Stats | null;
}

export interface TeamMember {
  pokemon: Pokemon;
  nature: Nature;
  ability: string;
  moves: string[];
  ivs: Stats;
  evs: Stats;
  level: number;
  item: string;
}

export interface CalculatedStats {
  stats: Stats;
  ivs: Stats;
  evs: Stats;
  nature: Nature;
}
