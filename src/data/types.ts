export interface StationaryTemplate {
  species: number;
  forme: number;
  level: number;
  delay: number;
  delayType: number;
  npc: number;
  shinyLocked: boolean;
  gift: boolean;
  egg: boolean;
  raining: boolean;
  totem: boolean;
  ultraWormhole: boolean;
  isPelago: boolean;
  unstable: boolean;
  conceptual: boolean;
  syncable: boolean;
  alwaysSync: boolean;
  iv3: boolean;
  otTsv: number | null;
  version: 'Gen7' | 'US' | 'UM' | 'S' | 'M';
  nature: number;
  ability: number;
  gender: number;
  ivs: number[] | null;
}

export interface StationaryCategory {
  text: string;
  list: StationaryTemplate[];
}

export interface WildAreaUsum {
  location: number;
  idx: number;
  locationIdx: number;
  mark: string;
  correction: number;
  npc: number;
  levelMin: number;
  levelMax: number;
  lvldiff: number;
  reverse: boolean;
  raining: boolean;
  species: number[];
  isSeparator?: boolean;
}

export interface FishingAreaUsum {
  location: number;
  idx: number;
  locationIdx: number;
  mark: string;
  npc: number;
  longdelay: boolean;
  lapras: boolean;
  levelMin: number;
  levelMax: number;
  slotType: number;
  species: number[];
}

export interface MiscAreaUsum {
  location: number;
  idx: number;
  locationIdx: number;
  mark: string;
  npc: number;
  delayType1: number;
  delayType2: number;
  delay1: number;
  delay2: number;
  slotType: number;
  levelMin: number;
  levelMax: number;
  cry: boolean;
  species: number[];
}

export interface CrabrawlerAreaUsum {
  location: number;
  idx: number;
  locationIdx: number;
  mark: string;
  npc: number;
  levelMin: number;
  scriptedLevel: number;
  raining: boolean;
}

export interface WildTemplateItem {
  species: number;
  level: number;
  delay: number;
  conceptual: boolean;
  rate: number[] | null;
  location: number[] | null;
  version: 'Gen7' | 'US' | 'UM' | 'S' | 'M';
}

export interface WildCategory {
  text: string;
  list: WildTemplateItem[];
}
