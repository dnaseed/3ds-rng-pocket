import personalRaw from './generated/personal_usum.json';
import wildRaw from './generated/wild_usum.json';

export interface PersonalEntry {
  /** Normalized order: [HP, ATK, DEF, SPA, SPD, SPE] */
  readonly stats: readonly [number, number, number, number, number, number];
  readonly types: readonly [number, number];
  readonly catchRate: number;
  readonly gender: number;
  readonly eggGroups: readonly [number, number];
  readonly abilities: readonly [number, number, number];
  readonly callRate: number;
  readonly formStatsIndex: number;
  readonly formeCount: number;
}

const PERSONAL_TABLE = personalRaw as unknown as readonly PersonalEntry[];

const ALOLAN_FORMS = new Set<number>(wildRaw.alolanForms);
const BABY_MONS = new Set<number>(wildRaw.babyMons);
const ALOLAN_DEX_SM = new Set<number>(wildRaw.alolanDexSM);
const ALOLAN_DEX_USUM = new Set<number>(wildRaw.alolanDexUSUM);

export function getFormeIndex(species: number, forme: number): number {
  const safeSpecies = species >= 0 && species < PERSONAL_TABLE.length ? species : 0;
  const base = PERSONAL_TABLE[safeSpecies] ?? PERSONAL_TABLE[0]!;
  if (forme <= 0 || base.formStatsIndex <= 0 || forme > base.formeCount) {
    return safeSpecies;
  }
  return base.formStatsIndex + forme - 1;
}

export function getFormeEntry(species: number, forme = 0): PersonalEntry {
  const idx = getFormeIndex(species, forme);
  return PERSONAL_TABLE[idx] ?? PERSONAL_TABLE[0]!;
}

export function getAbilities(species: number, forme = 0): readonly [number, number, number] {
  return getFormeEntry(species, forme).abilities;
}

export function getPersonalTableLength(): number {
  return PERSONAL_TABLE.length;
}

export function isAlolanForm(species: number): boolean {
  return ALOLAN_FORMS.has(species);
}

export function isBabyMon(species: number): boolean {
  return BABY_MONS.has(species);
}

export function isUndiscoveredEggGroup3IV(species: number, forme = 0): boolean {
  const entry = getFormeEntry(species, forme);
  return entry.eggGroups[0] === 0x0f && !BABY_MONS.has(species);
}

export function inAlolanDex(species: number, isUltra = true): boolean {
  return (
    species > 721 ||
    ALOLAN_FORMS.has(species) ||
    ALOLAN_DEX_SM.has(species) ||
    (isUltra && ALOLAN_DEX_USUM.has(species))
  );
}
