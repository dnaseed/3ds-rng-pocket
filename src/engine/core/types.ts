import type { TinyState } from '../rng/types';

export type GameVersionId = 'US' | 'UM' | 'S' | 'M';
export type GameVersion6 = 'X' | 'Y' | 'OR' | 'AS';

export function isGen6GameVersion(value: unknown): value is GameVersion6 {
  return value === 'X' || value === 'Y' || value === 'OR' || value === 'AS';
}

export function isUltraVersion(v: GameVersionId): boolean {
  return v === 'US' || v === 'UM';
}

export function isMoonVersion(v: GameVersionId): boolean {
  return v === 'UM' || v === 'M';
}

export type SearchMode = 'normal' | 'timeline' | 'aroundTarget' | 'timelineLeap';

export type BlinkFlag = number; // 0 = Safe '-', 1 = Blink '★', 2 = Unsafe '?', 3 = '? ★', 4 = '<?>', 5/30/36

export interface FishingSetting {
  basedelay: number;
  suctioncups: boolean;
  platdelay: number;
  pkmdelay: number;
}

export interface RngResultBase {
  species: number;
  forme: number;
  level: number;
  ability: number; // 1, 2, or 3 (HA)
  nature: number; // 0..24
  gender: number; // 0 = '-', 1 = '♂', 2 = '♀'
  ivs: [number, number, number, number, number, number];
  stats?: [number, number, number, number, number, number];
  pid: number; // uint32
  ec: number; // uint32
  psv: number;
  prv: number;
  hiddenPower: number; // 0..15
  shiny: boolean;
  squareShiny: boolean;
  synchronize: boolean;
}

export interface Result7 extends RngResultBase {
  kind: 'stationary' | 'event' | 'mainEgg';
  randLo: number;
  randHi: number;
  frameDelayUsed: number;
}

export interface WildResult7 extends RngResultBase {
  kind: 'wild';
  randLo: number;
  randHi: number;
  frameDelayUsed: number;
  slot: number;
  specialVal: number | null;
  isSpecial: boolean;
  item: number; // 0 = 50%, 1 = 5%, 2 = 1%, 3 = None
}

export interface EggResult7 extends RngResultBase {
  kind: 'egg';
  randNum: number; // uint32
  eggSeed: number;
  status: TinyState;
  framesUsed: number;
  beInheritParents: boolean | null; // true = male, false = female, null = none
  inheritMaleIv: (boolean | null)[]; // length 6
  ball: number; // 1 = Male, 2 = Female
}

export interface MainEggResult7 extends Result7 {
  ball: number;
  inheritMaleIv: (boolean | null)[];
}

export type AnyResult7 = Result7 | WildResult7 | EggResult7 | MainEggResult7;

export interface FrameRow {
  frame: number;
  realtime: number; // in 60fps frames (i.e. i * 2)
  shift: number; // realtime - standard
  blink: number;
  eggNum?: number;
  frame0?: number;
  acceptReject?: 'accept' | 'reject';
  specialSlotStr?: string;
  result: AnyResult7;
}

export interface IdResult7 {
  frame: number;
  tid: number;
  sid: number;
  tsv: number;
  trv: number;
  g7tid: number;
  clock: number; // 0..16
  randLo: number;
  randHi: number;
}

export interface RngFilterOptions {
  skip: boolean;
  shinyOnly: boolean;
  squareShinyOnly: boolean;
  ivLow: [number, number, number, number, number, number];
  ivUp: [number, number, number, number, number, number];
  perfectIvValue: number; // default 31
  perfectIvCount: number; // 0..6
  byStats: boolean;
  baseStats: [number, number, number, number, number, number] | null;
  targetStats: [number, number, number, number, number, number] | null; // 0 = wildcard
  natures: boolean[]; // length 25, all false = any
  hpTypes: boolean[]; // length 16, all false = any
  ability: number; // 0 = any, 1, 2, 3
  gender: number; // 0 = any, 1 = M, 2 = F
  level: number; // 0 = any
  slots: boolean[]; // all false = any
  specialOnly: boolean;
  ball: number; // 0 = any, 1 = M, 2 = F
  natureInheritance: number; // 0 = any, 1 = M, 2 = F
  safeOnly?: boolean;
  blinkOnly?: boolean;
}

export type IdFilterType = 0 | 1 | 2 | 3; // 0=TID, 1=SID, 2=FullID, 3=G7TID

export interface IdResult6 {
  frame: number;
  state: TinyState; // S0 through S3, before drawing this frame
  rand: number;
  tid: number;
  sid: number;
  tsv: number;
  trv: number;
}

export interface IdFilterOptions {
  skip: boolean;
  idType: IdFilterType;
  regex: boolean;
  idList: string[];
  tsvList: string[];
  randList: string[];
}
