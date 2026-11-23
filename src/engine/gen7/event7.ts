import { getFormeEntry } from '../../data/personalTable';
import { getGenderRatio, getPRV, getPSV, isRandomGender } from '../core/pokemonMath';
import type { Generator7, RngPool } from '../core/rngPool';
import type { Result7 } from '../core/types';
import { modU64 } from '../math/uint';

export interface Event7Config {
  species: number;
  forme: number;
  level: number;
  ivs: [number, number, number, number, number, number]; // -1 = random, 0..31 = locked
  ivsCount: number;
  yourId: boolean;
  isEgg: boolean;
  noDex: boolean;
  pidType: 0 | 1 | 2 | 3; // 0=Random, 1=NonShiny, 2=Shiny, 3=Specified
  abilityLocked: boolean;
  natureLocked: boolean;
  genderLocked: boolean;
  otherInfo: boolean; // Force Square Shiny PID when pidType === 2
  tid: number;
  sid: number;
  ec: number;
  pid: number;
  ability: number; // when !abilityLocked: 0 = 1/2, 1 = 1/2/H; when locked: 1/2/3 (or 0-indexed + 1)
  nature: number;
  gender: number; // 0='-', 1='♂', 2='♀' when genderLocked
}

export class Event7 implements Generator7 {
  public readonly species: number;
  public readonly forme: number;
  public readonly level: number;
  public readonly ivs: readonly number[];
  public readonly ivsCount: number;
  public readonly yourId: boolean;
  public readonly isEgg: boolean;
  public readonly noDex: boolean;
  public readonly pidType: number;
  public readonly abilityLocked: boolean;
  public readonly natureLocked: boolean;
  public readonly genderLocked: boolean;
  public readonly otherInfo: boolean;
  public readonly tid: number;
  public readonly sid: number;
  public readonly tsv: number;
  public readonly trv: number;
  public readonly ec: number;
  public readonly pid: number;
  public readonly ability: number;
  public readonly nature: number;
  public readonly gender: number;

  constructor(cfg: Event7Config) {
    this.species = cfg.species;
    this.forme = cfg.forme;
    this.level = cfg.level;
    this.ivs = [...cfg.ivs];
    this.ivsCount = cfg.ivsCount;
    this.yourId = cfg.yourId;
    this.isEgg = cfg.isEgg;
    this.noDex = cfg.noDex;
    this.pidType = cfg.pidType;
    this.abilityLocked = cfg.abilityLocked;
    this.natureLocked = cfg.natureLocked;
    this.otherInfo = cfg.otherInfo;
    this.tid = cfg.tid;
    this.sid = cfg.sid;
    this.tsv = ((cfg.tid ^ cfg.sid) >>> 4) & 0xfff;
    this.trv = (cfg.tid ^ cfg.sid) & 0xf;
    this.ec = cfg.ec >>> 0;
    this.pid = cfg.pid >>> 0;
    this.ability = cfg.ability;
    this.nature = cfg.nature;

    // EventRNG.GetGenderSetting()
    const info = getFormeEntry(cfg.species, cfg.forme);
    this.gender = cfg.genderLocked ? cfg.gender : getGenderRatio(info.gender);
    this.genderLocked = cfg.genderLocked || !isRandomGender(info.gender);
  }

  public delay(pool: RngPool): void {
    pool.timeElapse7(2);
    if (this.noDex || (this.yourId && !this.isEgg)) {
      this.generate(pool);
    }
    pool.timeElapse7(pool.delayTime - 2);
  }

  public generate(pool: RngPool): Result7 {
    const [randLo, randHi] = pool.getCurrent64Parts();
    const frameDelayUsed = pool.index;

    const ec = this.ec > 0 ? this.ec : pool.getRand64Parts()[0];

    let pid = 0;
    let shiny = false;
    let squareShiny = false;
    switch (this.pidType) {
      case 0: // Random PID
        pid = pool.getRand64Parts()[0];
        if (getPSV(pid) === this.tsv) {
          shiny = true;
          squareShiny = true;
        }
        break;
      case 1: // Random NonShiny
        pid = pool.getRand64Parts()[0];
        if (getPSV(pid) === this.tsv) {
          pid = (pid ^ 0x10000000) >>> 0;
        }
        break;
      case 2: // Random Shiny
        pid = pool.getRand64Parts()[0];
        shiny = true;
        squareShiny = true;
        if (this.otherInfo) {
          const low16 = pid & 0xffff;
          pid = (((this.tid ^ this.sid ^ low16) << 16) + low16) >>> 0;
        }
        break;
      case 3: // Specified
        pid = this.pid;
        if (getPSV(pid) === this.tsv) {
          shiny = true;
          squareShiny = true;
        }
        break;
    }

    const ivs: [number, number, number, number, number, number] = [
      this.ivs[0]!,
      this.ivs[1]!,
      this.ivs[2]!,
      this.ivs[3]!,
      this.ivs[4]!,
      this.ivs[5]!,
    ];
    const emptySlots = ivs.filter((v) => v < 0).length;
    const effectiveIvsCount = Math.min(Math.max(0, this.ivsCount), emptySlots);
    for (let i = effectiveIvsCount; i > 0; ) {
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

    let ability: number;
    if (this.abilityLocked) {
      ability = this.ability;
    } else if (this.ability === 0) {
      ability = (pool.getRand64Parts()[0] & 1) + 1;
    } else {
      const [lo, hi] = pool.getRand64Parts();
      ability = modU64(lo, hi, 3) + 1;
    }

    let nature: number;
    if (this.natureLocked) {
      nature = this.nature;
    } else {
      const [lo, hi] = pool.getRand64Parts();
      nature = modU64(lo, hi, 25);
    }

    let gender: number;
    if (this.genderLocked) {
      gender = this.gender;
    } else {
      const [lo, hi] = pool.getRand64Parts();
      gender = modU64(lo, hi, 252) >= this.gender ? 1 : 2;
    }

    return {
      kind: 'event',
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
      synchronize: false,
      randLo,
      randHi,
      frameDelayUsed,
    };
  }
}
