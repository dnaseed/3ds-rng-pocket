import { getGenderRatio, getPRV, getPSV, isRandomGender } from '../core/pokemonMath';
import type { RngPool } from '../core/rngPool';
import type { EggResult7 } from '../core/types';

export interface Egg7Config {
  species?: number;
  forme?: number;
  tsv: number;
  trv: number;
  maleIvs: [number, number, number, number, number, number];
  femaleIvs: [number, number, number, number, number, number];
  maleItem: number; // 0=None, 1=Everstone, 2=DestinyKnot, 3..8=PowerItems
  femaleItem: number;
  inheritAbility: number; // 0=Ab1, 1=Ab2, 2=HA
  genderRatioRaw: number; // 0xFF, 0x7F, 0x1F, 0x3F, 0xBF, 0xE1, 0x00, 0xFE
  shinyCharm: boolean;
  masuda: boolean;
  nidoType: boolean;
  homogeneous: boolean;
  femaleIsDitto: boolean;
  considerOtherTsv: boolean;
  otherTsvs: readonly number[];
}

export function getRandomAbility(ability: number, value: number): number {
  switch (ability) {
    case 0:
      return value < 0x50 ? 1 : 2;
    case 1:
      return value < 0x14 ? 1 : 2;
    case 2:
      if (value < 0x14) return 1;
      if (value < 0x28) return 2;
      return 3;
    default:
      return 0;
  }
}

/**
 * Exact TypeScript port of Pk3DSRNGTool.Egg7 + EggRNG.
 */
export class Egg7 {
  public readonly species: number;
  public readonly forme: number;
  public readonly tsv: number;
  public readonly trv: number;
  public readonly maleIvs: readonly number[];
  public readonly femaleIvs: readonly number[];
  public readonly maleItem: number;
  public readonly femaleItem: number;
  public readonly inheritAbility: number;
  public readonly nidoType: boolean;
  public readonly homogeneous: boolean;
  public readonly femaleIsDitto: boolean;
  public readonly considerOtherTsv: boolean;
  public readonly otherTsvs: readonly number[];

  private readonly everstone: boolean;
  private readonly bothEverstone: boolean;
  private readonly destinyKnot: boolean;
  private readonly power: boolean;
  private readonly bothPower: boolean;
  private readonly mPower: number;
  private readonly fPower: number;
  private readonly pidRerollCount: number;
  private readonly inheritIvsCnt: number;
  private readonly gender: number;
  private readonly randomGender: boolean;

  constructor(cfg: Egg7Config) {
    this.species = cfg.species ?? 0;
    this.forme = cfg.forme ?? 0;
    this.tsv = cfg.tsv;
    this.trv = cfg.trv;
    this.maleIvs = cfg.maleIvs;
    this.femaleIvs = cfg.femaleIvs;
    this.maleItem = cfg.maleItem;
    this.femaleItem = cfg.femaleItem;
    this.inheritAbility = cfg.inheritAbility;
    this.nidoType = cfg.nidoType;
    this.homogeneous = cfg.homogeneous;
    this.femaleIsDitto = cfg.femaleIsDitto;
    this.considerOtherTsv = cfg.considerOtherTsv && (cfg.shinyCharm || cfg.masuda);
    this.otherTsvs = cfg.otherTsvs;

    this.everstone = this.maleItem === 1 || this.femaleItem === 1;
    this.bothEverstone = this.maleItem === 1 && this.femaleItem === 1;
    this.destinyKnot = this.maleItem === 2 || this.femaleItem === 2;
    this.power = this.maleItem > 2 || this.femaleItem > 2;
    this.bothPower = this.maleItem > 2 && this.femaleItem > 2;
    this.mPower = this.maleItem - 3;
    this.fPower = this.femaleItem - 3;

    let reroll = 0;
    if (cfg.shinyCharm) reroll += 2;
    if (cfg.masuda) reroll += 6;
    this.pidRerollCount = reroll;

    this.inheritIvsCnt = this.destinyKnot ? 5 : 3;
    this.gender = getGenderRatio(cfg.genderRatioRaw);
    this.randomGender = isRandomGender(cfg.genderRatioRaw);
  }

  public generate(pool: RngPool): EggResult7 {
    const randNum = pool.getCurrent32();
    const status = [...pool.getCurrentState()] as [number, number, number, number];

    // Gender
    let gender: number;
    if (this.nidoType) {
      gender = (pool.getRand32() & 1) + 1;
    } else if (this.randomGender) {
      gender = (pool.getRand32() % 252) >= this.gender ? 1 : 2;
    } else {
      gender = this.gender;
    }

    // Nature
    const nature = pool.getRand32() % 25;

    // Everstone
    let beInheritParents: boolean | null = null;
    if (this.bothEverstone) {
      beInheritParents = (pool.getRand32() & 1) === 0;
    } else if (this.everstone) {
      beInheritParents = this.maleItem === 1;
    }

    // Ability
    const ability = getRandomAbility(this.inheritAbility, pool.getRand32() % 100);

    // Inherit IVs array (null = random, true = male, false = female)
    const inheritMaleIv: (boolean | null)[] = [null, null, null, null, null, null];

    // Power Item
    if (this.bothPower) {
      if ((pool.getRand32() & 1) === 0) {
        inheritMaleIv[this.mPower] = true;
      } else {
        inheritMaleIv[this.fPower] = false;
      }
    } else if (this.power) {
      if (this.maleItem > 2) {
        inheritMaleIv[this.mPower] = true;
      } else {
        inheritMaleIv[this.fPower] = false;
      }
    }

    // Inherit IVs
    let tmp: number;
    for (let i = this.power ? 1 : 0; i < this.inheritIvsCnt; i++) {
      do {
        tmp = pool.getRand32() % 6;
      } while (inheritMaleIv[tmp] !== null);
      inheritMaleIv[tmp] = (pool.getRand32() & 1) === 0;
    }

    // IVs
    const ivs: [number, number, number, number, number, number] = [-1, -1, -1, -1, -1, -1];
    for (let j = 0; j < 6; j++) {
      let val = pool.getRand32() & 0x1f;
      if (inheritMaleIv[j] !== null) {
        val = inheritMaleIv[j] === true ? this.maleIvs[j]! : this.femaleIvs[j]!;
      }
      ivs[j] = val;
    }

    // Encryption Constant
    const ec = pool.getRand32();

    // PID (only rolled when pidRerollCount > 0, i.e. Masuda or Shiny Charm)
    let pid = 0;
    let shiny = false;
    let squareShiny = false;
    for (let i = this.pidRerollCount; i > 0; i--) {
      pid = pool.getRand32();
      if (getPSV(pid) === this.tsv) {
        shiny = true;
        squareShiny = getPRV(pid) === this.trv;
        break;
      }
    }

    const psv = getPSV(pid);
    if (this.considerOtherTsv && this.otherTsvs.includes(psv)) {
      shiny = true;
    }

    // Ball
    const ball =
      (this.homogeneous && pool.getRand32() % 100 >= 50) || this.femaleIsDitto ? 1 : 2;

    // Egg adopt & Egg clear
    pool.advance(2);

    const framesUsed = pool.index;

    return {
      kind: 'egg',
      species: this.species,
      forme: this.forme,
      level: 1,
      ability,
      nature,
      gender,
      ivs,
      pid,
      ec,
      psv,
      prv: getPRV(pid),
      hiddenPower: 0,
      shiny,
      squareShiny,
      synchronize: false,
      randNum,
      eggSeed: 0,
      status,
      framesUsed,
      beInheritParents,
      inheritMaleIv,
      ball,
    };
  }
}
