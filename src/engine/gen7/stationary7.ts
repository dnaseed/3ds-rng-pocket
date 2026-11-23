import type { StationaryTemplate } from '../../data/types';
import { isUndiscoveredEggGroup3IV } from '../../data/personalTable';
import { getGenderRatio, getPRV, getPSV, isRandomGender } from '../core/pokemonMath';
import type { Generator7, RngPool } from '../core/rngPool';
import type { EggResult7, MainEggResult7, Result7 } from '../core/types';
import { modU64 } from '../math/uint';
import { stationaryDelay7 } from './delays';

export interface Stationary7Config {
  species: number;
  forme: number;
  level: number;
  tsv: number;
  trv: number;
  shinyCharm: boolean;
  synchroStat: number; // 0..24, or 255 for none
  assumeSynced: boolean | null;
  isForcedShiny: boolean;
  pelagoShift: number;
  // Conceptual / custom overrides (used when template is conceptual)
  alwaysSync: boolean;
  iv3: boolean;
  isShinyLocked: boolean;
  ability: number; // 0 = random 1/2, 1/2/3 = locked
  genderSetting: number; // 0xFF/0x00/0xFE -> 0/1/2 or ratio-1
  randomGender: boolean;
  // Optional template
  template?: StationaryTemplate | null;
}

export class Stationary7 implements Generator7 {
  public species = 0;
  public forme = 0;
  public level = 50;
  public tsv = 0;
  public trv = 0;
  public shinyCharm = false;
  public synchroStat = 255;
  public assumeSynced: boolean | null = null;
  public isForcedShiny = false;
  public pelagoShift = 0;

  public alwaysSync = false;
  public iv3 = false;
  public isShinyLocked = false;
  public ability = 0;
  public gender = 0;
  public randomGender = false;
  public ivs: number[] = [-1, -1, -1, -1, -1, -1];

  public fateful = false;
  public isPelago = false;
  public trade = false;
  public postNatureLock = false;
  public delayType = 0;

  private perfectIvCount = 0;
  private pidRollCount = 1;

  constructor(cfg: Stationary7Config) {
    this.tsv = cfg.tsv;
    this.trv = cfg.trv;
    this.level = cfg.level;
    this.shinyCharm = cfg.shinyCharm;
    this.synchroStat = cfg.synchroStat;
    this.assumeSynced = cfg.assumeSynced;
    this.isForcedShiny = cfg.isForcedShiny;
    this.pelagoShift = cfg.pelagoShift;

    const tmpl = cfg.template;
    if (tmpl && !tmpl.conceptual) {
      this.useTemplate(tmpl);
    } else {
      this.species = cfg.species;
      this.forme = cfg.forme;
      this.alwaysSync = cfg.alwaysSync;
      this.iv3 = cfg.iv3;
      this.isShinyLocked = cfg.isShinyLocked;
      this.ability = cfg.ability;
      this.gender = getGenderRatio(cfg.genderSetting);
      this.randomGender = isRandomGender(cfg.genderSetting);
      this.ivs = [-1, -1, -1, -1, -1, -1];
      this.setValue();
    }
  }

  private setValue(): void {
    this.perfectIvCount = this.iv3 ? 3 : 0;
    this.pidRollCount = this.shinyCharm && !this.isShinyLocked && !this.alwaysSync ? 3 : 1;
  }

  private useTemplate(pm: StationaryTemplate): void {
    this.species = pm.species;
    this.forme = pm.forme;
    if (pm.level > 0) this.level = pm.level;

    this.alwaysSync = pm.alwaysSync;
    const baseIv3 = isUndiscoveredEggGroup3IV(pm.species, pm.forme) && !pm.egg;
    this.iv3 = baseIv3 || pm.iv3;
    this.isShinyLocked = pm.shinyLocked;
    this.ability = pm.ability > 3 ? 3 : pm.ability;
    this.ivs = pm.ivs ? [...pm.ivs] : [-1, -1, -1, -1, -1, -1];

    // Effective gender ratio from Pokemon.GenderRatio
    const rawGender =
      pm.gender > 0 ? (2 - 2 * pm.gender) & 0xff : getGenderRatioRaw(pm.species, pm.forme);
    this.gender = getGenderRatio(rawGender);
    this.randomGender = isRandomGender(rawGender);

    if (pm.nature < 25) {
      this.synchroStat = pm.nature;
    }

    this.setValue();

    // Stationary7.UseTemplate overrides
    if (pm.species === 132 && pm.nature < 25) {
      // Ditto Five
      this.postNatureLock = true;
      this.alwaysSync = false;
      this.pidRollCount = this.shinyCharm ? 3 : 1;
    }

    if (this.ability === 0 && !this.alwaysSync) {
      this.ability = 1;
    }
    if (pm.ability === 0xff) {
      this.ability = 0;
    }
    if (pm.isPelago) {
      this.isPelago = true;
    }
    if (pm.otTsv !== null) {
      this.tsv = pm.otTsv;
      this.trade = !pm.gift;
      this.fateful = pm.gift;
    }
    if (pm.iv3) {
      this.perfectIvCount = 3;
    }
    this.delayType = pm.delayType;
  }

  public delay(pool: RngPool): void {
    stationaryDelay7(pool);
  }

  private blinkProcess(pool: RngPool): boolean {
    if (this.assumeSynced !== null) {
      return this.assumeSynced;
    }
    const [lo, hi] = pool.getRand64Parts();
    const sync = modU64(lo, hi, 100) >= 50;
    pool.timeElapse7(3);
    return sync || this.postNatureLock;
  }

  public generate(pool: RngPool): Result7 {
    const [randLo, randHi] = pool.getCurrent64Parts();
    const frameDelayUsed = pool.index;

    if (this.trade) {
      return this.generateTrade(pool, randLo, randHi, frameDelayUsed);
    }

    let synchronize: boolean;
    if (this.alwaysSync) {
      synchronize = true;
    } else {
      synchronize = this.blinkProcess(pool);
      pool.advance(60);
    }

    // Encryption Constant
    let ec: number;
    if (this.isPelago) {
      pool.advance(60 + this.pelagoShift);
      ec = pool.getRand64Parts()[0];
      pool.advance(1); // Random TID
    } else {
      ec = pool.getRand64Parts()[0];
    }

    // PID
    let pid = 0;
    let shiny = false;
    let squareShiny = false;
    for (let i = this.pidRollCount; i > 0; i--) {
      pid = pool.getRand64Parts()[0];
      const psv = getPSV(pid);
      if (psv === this.tsv) {
        if (this.isShinyLocked) {
          pid = (pid ^ 0x10000000) >>> 0;
        } else {
          shiny = true;
          squareShiny = this.fateful || getPRV(pid) === this.trv;
        }
        break;
      } else if (this.isForcedShiny) {
        shiny = true;
        squareShiny = true;
        const low16 = pid & 0xffff;
        pid = (((((this.tsv << 4) + this.trv) ^ low16) << 16) + low16) >>> 0;
      }
    }

    // IVs
    const ivs: [number, number, number, number, number, number] = [
      this.ivs[0]!,
      this.ivs[1]!,
      this.ivs[2]!,
      this.ivs[3]!,
      this.ivs[4]!,
      this.ivs[5]!,
    ];
    for (let i = this.perfectIvCount; i > 0; ) {
      const [lo, hi] = pool.getRand64Parts();
      const tmp = modU64(lo, hi, 6);
      if (ivs[tmp]! < 0) {
        i--;
        ivs[tmp] = 31;
      }
    }
    for (let i = 0; i < 6; i++) {
      if (ivs[i]! < 0) {
        ivs[i] = pool.getRand64Parts()[0] & 0x1f;
      }
    }

    // Ability
    const ability = this.ability > 0 ? this.ability : (pool.getRand64Parts()[0] & 1) + 1;

    // Nature
    let nature: number;
    if (synchronize && this.synchroStat < 25) {
      nature = this.synchroStat;
    } else {
      const [lo, hi] = pool.getRand64Parts();
      nature = modU64(lo, hi, 25);
    }

    // Gender
    let gender: number;
    if (this.randomGender) {
      const [lo, hi] = pool.getRand64Parts();
      gender = modU64(lo, hi, 252) >= this.gender ? 1 : 2;
    } else {
      gender = this.gender;
    }

    return {
      kind: 'stationary',
      species: this.species,
      forme: this.forme,
      level: this.level,
      ability,
      nature,
      gender,
      ivs,
      pid,
      ec,
      psv: getPSV(pid),
      prv: getPRV(pid),
      hiddenPower: 0,
      shiny,
      squareShiny,
      synchronize,
      randLo,
      randHi,
      frameDelayUsed,
    };
  }

  private generateTrade(
    pool: RngPool,
    randLo: number,
    randHi: number,
    frameDelayUsed: number,
  ): Result7 {
    const ivs: [number, number, number, number, number, number] = [
      this.ivs[0]!,
      this.ivs[1]!,
      this.ivs[2]!,
      this.ivs[3]!,
      this.ivs[4]!,
      this.ivs[5]!,
    ];
    for (let i = 0; i < 6; i++) {
      if (ivs[i]! < 0) {
        ivs[i] = pool.getRand64Parts()[0] & 0x1f;
      }
    }

    const ec = pool.getRand64Parts()[0];
    let pid = pool.getRand64Parts()[0];
    if (getPSV(pid) === this.tsv) {
      pid = (pid ^ 0x10000000) >>> 0;
    }

    return {
      kind: 'stationary',
      species: this.species,
      forme: this.forme,
      level: this.level,
      ability: this.ability,
      nature: this.synchroStat,
      gender: this.gender,
      ivs,
      pid,
      ec,
      psv: getPSV(pid),
      prv: getPRV(pid),
      hiddenPower: 0,
      shiny: false,
      squareShiny: false,
      synchronize: false,
      randLo,
      randHi,
      frameDelayUsed,
    };
  }
}

export class MainEggRng implements Generator7 {
  public readonly tsv: number;
  public readonly trv: number;
  public readonly considerOtherTsv: boolean;
  public readonly otherTsvs: readonly number[];
  public readonly egg: EggResult7;

  constructor(opts: {
    tsv: number;
    trv: number;
    considerOtherTsv: boolean;
    otherTsvs: readonly number[];
    egg: EggResult7;
  }) {
    this.tsv = opts.tsv;
    this.trv = opts.trv;
    this.considerOtherTsv = opts.considerOtherTsv;
    this.otherTsvs = opts.otherTsvs;
    this.egg = opts.egg;
  }

  public delay(pool: RngPool): void {
    pool.normalDelay7();
  }

  public generate(pool: RngPool): MainEggResult7 {
    const [randLo, randHi] = pool.getCurrent64Parts();
    const frameDelayUsed = pool.index;
    const pid = pool.getRand64Parts()[0];
    const psv = getPSV(pid);
    const shiny = psv === this.tsv || (this.considerOtherTsv && this.otherTsvs.includes(psv));
    const squareShiny = psv === this.tsv && getPRV(pid) === this.trv;

    return {
      kind: 'mainEgg',
      species: this.egg.species,
      forme: this.egg.forme,
      level: 1,
      ability: this.egg.ability,
      nature: this.egg.nature,
      gender: this.egg.gender,
      ivs: [...this.egg.ivs],
      pid,
      ec: this.egg.ec,
      psv,
      prv: getPRV(pid),
      hiddenPower: 0,
      shiny,
      squareShiny,
      synchronize: false,
      randLo,
      randHi,
      frameDelayUsed,
      ball: this.egg.ball,
      inheritMaleIv: [...this.egg.inheritMaleIv],
    };
  }
}

import { getFormeEntry } from '../../data/personalTable';

function getGenderRatioRaw(species: number, forme: number): number {
  return getFormeEntry(species, forme).gender;
}
