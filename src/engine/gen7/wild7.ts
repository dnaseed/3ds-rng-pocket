import wildData from '../../data/generated/wild_usum.json';
import { getFormeEntry, isBabyMon } from '../../data/personalTable';
import { getGenderRatio, getPRV, getPSV, isRandomGender } from '../core/pokemonMath';
import type { Generator7, RngPool } from '../core/rngPool';
import type { WildResult7 } from '../core/types';
import { modU64 } from '../math/uint';
import { wildDelay7 } from './delays';
import { getWeatherSlot, SosRngBuffer } from './sosRng';

const TYPE_ELECTRIC = 12;
const TYPE_STEEL = 8;

export const SLOT_DISTRIBUTIONS: readonly (readonly number[])[] = wildData.slotDistributions;

export function getFluteBoost(rand100: number): number {
  if (rand100 < 40) return 1;
  if (rand100 < 70) return 2;
  if (rand100 < 90) return 3;
  return 4;
}

export function getHeldItem(rand: number, compoundEye = false): number {
  if (rand < (compoundEye ? 60 : 50)) return 0; // 50%
  if (rand < (compoundEye ? 80 : 55)) return 1; // 5%
  return 3; // None
}

export interface Wild7Config {
  tsv: number;
  trv: number;
  shinyCharm: boolean;
  synchroStat: number; // 0..24 or 255
  lead: number; // 0=None, 1=Sync, 2=CuteCharmM, 3=CuteCharmF, 4=Static, 5=MagnetPull, 6=CompoundEyes, 7=SuctionCups, 8=Pressure/Hustle/Vital, 9=BlackFlute, 10=WhiteFlute
  levelMin: number;
  levelMax: number;
  specialLevel: number;
  specialEnctr: number;
  ub: boolean;
  fishing: boolean;
  crabrawler: boolean;
  modifiedLevel?: number;
  delayType: number; // InlineDelay type (MiscEncounter7.DelayType2)
  delayTime: number; // InlineDelay duration (Delay2 / 2)
  specForm: number[];
  slotSplitter: readonly number[];
  hookedItemSlot?: [number, number];
  sos?: boolean;
  sosSeed?: number;
  sosFrame?: number;
  sosChainLength?: number;
  sosWeather?: boolean;
}

export class Wild7 implements Generator7 {
  public tsv: number;
  public trv: number;
  public shinyCharm: boolean;
  public synchroStat: number;

  public staticLead = false;
  public magnetLead = false;
  public staticMagnetSlot: number[] = [];
  public nStaticMagnetSlot = 0;
  public cuteCharmGender = 0;
  public modifiedLevel = 0;
  public flute = 0;
  public fluteBoost = 0;

  public slotSplitter: readonly number[];
  public specForm: number[];
  public hookedItemSlot: [number, number];

  public specialEnctr: number;
  public levelMin: number;
  public levelMax: number;
  public specialLevel: number;
  public compoundEye: boolean;
  public ub: boolean;
  public fishing: boolean;
  public sos: boolean;
  public crabrawler: boolean;

  private sosRng: SosRngBuffer | null = null;

  public delayType: number;
  public delayTime: number;

  private genderRatio: number[] = [];
  private randomGender: boolean[] = [];
  private iv3: boolean[] = [];

  private slot = 0;
  private isSpecial = false;
  private synchroPass = false;
  private cuteCharmPass = false;
  private staticMagnetPass = false;
  private levelModifierPass = false;

  constructor(cfg: Wild7Config) {
    this.tsv = cfg.tsv;
    this.trv = cfg.trv;
    this.shinyCharm = cfg.shinyCharm;
    this.synchroStat = cfg.synchroStat;

    switch (cfg.lead) {
      case 2: // CuteCharm M -> forces opposite gender? Wait: LeadAbilityList[2] = CuteCharm M => CuteCharmGender = 1? Check MainForm.cs:1474!
        // MainForm.cs:1474: case Lead.CuteCharmF: CuteCharmGender = 1; case Lead.CuteCharmM: CuteCharmGender = 2;
        // Lead enum: 0=None, 1=Sync, 2=CuteCharmM, 3=CuteCharmF! Wait: check Lead.cs!
        this.cuteCharmGender = 2;
        break;
      case 3:
        this.cuteCharmGender = 1;
        break;
      case 4:
        this.staticLead = true;
        break;
      case 5:
        this.magnetLead = true;
        break;
      case 8:
        this.modifiedLevel = 101;
        break;
      case 9:
        this.flute = 1;
        break;
      case 10:
        this.flute = -1;
        break;
    }

    if (cfg.modifiedLevel !== undefined && cfg.modifiedLevel > 0) {
      this.modifiedLevel = cfg.modifiedLevel;
    }

    this.levelMin = cfg.levelMin;
    this.levelMax = cfg.levelMax;
    this.specialLevel = cfg.specialLevel;
    this.specialEnctr = cfg.specialEnctr;
    this.ub = cfg.ub;
    this.fishing = cfg.fishing;
    this.sos = Boolean(cfg.sos);
    this.crabrawler = cfg.crabrawler;
    this.compoundEye = cfg.lead === 6;
    this.delayType = cfg.delayType;
    this.delayTime = cfg.delayTime;
    this.specForm = [...cfg.specForm];
    this.slotSplitter = cfg.slotSplitter;
    this.hookedItemSlot = cfg.hookedItemSlot ?? [50, 80];

    if (this.sos) {
      this.sosRng = new SosRngBuffer(
        cfg.sosSeed ?? 0,
        cfg.sosFrame ?? 0,
        cfg.sosChainLength ?? 0,
        Boolean(cfg.sosWeather),
      );
    }

    this.markSlots();
  }

  private get isMinior(): boolean {
    return this.specForm[this.slot] === 774;
  }

  private get isUb(): boolean {
    return this.ub && this.isSpecial;
  }

  private get isShinyLocked(): boolean {
    return this.isUb && (this.specForm[0] ?? 0) <= 800;
  }

  private get normalSlot(): boolean {
    return !this.isSpecial || this.fishing;
  }

  private get perfectIvCount(): number {
    return this.iv3[this.slot] ? 3 : 0;
  }

  private get pidRollCount(): number {
    return (
      (this.shinyCharm && !this.isShinyLocked ? 3 : 1) +
      (this.sos && this.sosRng ? this.sosRng.pidBonus : 0)
    );
  }

  public markSlots(): void {
    const len = this.specForm.length;
    this.iv3 = new Array<boolean>(len).fill(false);
    this.randomGender = new Array<boolean>(len).fill(false);
    this.genderRatio = new Array<number>(len).fill(0);
    const smSlot: number[] = [];

    for (let i = 0; i < len; i++) {
      const sf = this.specForm[i] ?? 0;
      if (sf === 0) continue;
      const species = sf & 0x7ff;
      const forme = sf >>> 11;
      const info = getFormeEntry(species, forme);
      this.iv3[i] = info.eggGroups[0] === 0x0f && !isBabyMon(species);
      this.genderRatio[i] = getGenderRatio(info.gender);
      this.randomGender[i] = isRandomGender(info.gender);
      if (
        (this.staticLead && info.types.includes(TYPE_ELECTRIC)) ||
        (this.magnetLead && info.types.includes(TYPE_STEEL))
      ) {
        smSlot.push(i);
      }
    }

    this.staticMagnetSlot = smSlot;
    this.nStaticMagnetSlot = smSlot.length;
    if (this.nStaticMagnetSlot === 0) {
      this.staticLead = false;
      this.magnetLead = false;
    }
    if (this.modifiedLevel === 101) {
      this.modifiedLevel = this.levelMax;
    }
    if (this.ub && len > 0) {
      this.iv3[0] = true;
    }
  }

  private checkLeadAbility(rand100: number): void {
    this.synchroPass = rand100 >= 50;
    this.cuteCharmPass = this.cuteCharmGender > 0 && rand100 < 67;
    this.staticMagnetPass = (this.staticLead || this.magnetLead) && rand100 >= 50;
    this.levelModifierPass = this.modifiedLevel !== 0 && rand100 >= 50;
  }

  private getSlot(rand: number): number {
    let rem = rand;
    for (let i = 1; i < this.slotSplitter.length; i++) {
      rem -= this.slotSplitter[i - 1]!;
      if (rem < 0) {
        this.slot = i;
        return i;
      }
    }
    this.slot = this.slotSplitter.length;
    return this.slot;
  }

  private getSmSlot(lo: number, hi: number): number {
    this.slot = this.staticMagnetSlot[modU64(lo, hi, this.nStaticMagnetSlot)]!;
    return this.slot;
  }

  private getSmSlot32(rand32: number): number {
    this.slot = this.staticMagnetSlot[(rand32 >>> 0) % this.nStaticMagnetSlot]!;
    return this.slot;
  }

  private getHookedItemSlot(val: number | null): number {
    if (val === null) return 0;
    if (val < this.hookedItemSlot[0]) return 1;
    if (val < this.hookedItemSlot[1]) return 2;
    return 3;
  }

  private modifyLevel(currentLevel: number): number {
    let lv = this.levelModifierPass ? this.modifiedLevel : currentLevel;
    const boost = this.flute * this.fluteBoost;
    if (boost === 0) return lv;
    lv += boost;
    if (lv > 100) return 100;
    if (lv < 1) return 1;
    return lv;
  }

  private inlineDelay(pool: RngPool): void {
    if (this.delayType === 1) {
      pool.timeElapse7(this.delayTime - 2);
      pool.modelNumber--;
      pool.timeElapse7(2);
    } else {
      pool.timeElapse7(this.delayTime);
    }
  }

  public delay(pool: RngPool): void {
    wildDelay7(pool);
  }

  public generate(pool: RngPool): WildResult7 {
    const [randLo, randHi] = pool.getCurrent64Parts();
    const frameDelayUsed = pool.index;

    let level = this.specialLevel;
    let specialVal: number | null = null;
    this.isSpecial = false;
    let forme = 0;

    if (this.fishing) {
      const [lo, hi] = pool.getRand64Parts();
      this.isSpecial = modU64(lo, hi, 100) >= this.specialEnctr;
      pool.timeElapse7(12);
      if (this.isSpecial) {
        const mark = pool.index;
        pool.timeElapse7(34);
        const [iLo, iHi] = pool.getRand64Parts();
        specialVal = modU64(iLo, iHi, 100);
        pool.rewind(mark);
      }
    } else if (this.specialEnctr > 0) {
      const [lo, hi] = pool.getRand64Parts();
      this.isSpecial = modU64(lo, hi, 100) < this.specialEnctr;
    }

    if (this.sos && this.sosRng) {
      this.sosRng.reset();
      this.sosRng.advance(2); // Call Rate Check
      this.checkLeadAbility(this.sosRng.getRand() % 100);
      const wSlot = this.sosRng.weather ? getWeatherSlot(this.sosRng.getRand() % 100) : 0;
      if (this.sosRng.weather && wSlot > 7) {
        this.slot = wSlot;
        this.isSpecial = true;
      } else if (this.staticMagnetPass) {
        this.getSmSlot32(this.sosRng.getRand());
      } else {
        this.getSlot(this.sosRng.getRand() % 100);
      }
      level = (this.sosRng.getRand() % (this.levelMax - this.levelMin + 1)) + this.levelMin;
      this.fluteBoost = getFluteBoost(this.sosRng.getRand() % 100);
      level = this.modifyLevel(level);
    } else if (this.crabrawler) {
      const [lo, hi] = pool.getRand64Parts();
      this.checkLeadAbility(modU64(lo, hi, 100));
      this.slot = 1;
      level = this.modifiedLevel;
    } else if (this.normalSlot) {
      const [lLo, lHi] = pool.getRand64Parts();
      this.checkLeadAbility(modU64(lLo, lHi, 100));

      const [sLo, sHi] = pool.getRand64Parts();
      if (this.staticMagnetPass) {
        this.getSmSlot(sLo, sHi);
      } else {
        this.getSlot(modU64(sLo, sHi, 100));
      }

      const [lvLo, lvHi] = pool.getRand64Parts();
      level = modU64(lvLo, lvHi, this.levelMax - this.levelMin + 1) + this.levelMin;

      const [fLo, fHi] = pool.getRand64Parts();
      this.fluteBoost = getFluteBoost(modU64(fLo, fHi, 100));
      level = this.modifyLevel(level);

      if (this.isMinior) {
        const [mLo, mHi] = pool.getRand64Parts();
        forme = modU64(mLo, mHi, 7);
      }
    } else {
      // UB or QR Island Scan
      this.slot = 0;
      pool.timeElapse7(7);
      const [lo, hi] = pool.getRand64Parts();
      this.checkLeadAbility(modU64(lo, hi, 100));
      pool.timeElapse7(3);
    }

    const species = (this.specForm[this.slot] ?? 0) & 0x7ff;

    if (this.delayTime > 0) {
      this.inlineDelay(pool);
    }

    if (!this.sos) {
      pool.advance(60);
    }

    // EC
    const ec = pool.getRand64Parts()[0];

    // PID
    let pid = 0;
    let shiny = false;
    let squareShiny = false;
    for (let i = this.pidRollCount; i > 0; i--) {
      pid = pool.getRand64Parts()[0];
      if (getPSV(pid) === this.tsv) {
        if (this.isShinyLocked) {
          pid = (pid ^ 0x10000000) >>> 0;
        } else {
          shiny = true;
          squareShiny = getPRV(pid) === this.trv;
        }
        break;
      }
    }

    // IVs (note Wild7.cs starts with 0s, sets PerfectIVCount slots to 31, then fills 0s)
    const ivs: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
    for (let i = this.perfectIvCount; i > 0; ) {
      const [lo, hi] = pool.getRand64Parts();
      const tmp = modU64(lo, hi, 6);
      if (ivs[tmp] === 0) {
        i--;
        ivs[tmp] = 31;
      }
    }
    for (let i = 0; i < 6; i++) {
      if (ivs[i] === 0) {
        ivs[i] = pool.getRand64Parts()[0] & 0x1f;
      }
    }

    // Ability
    let ability = this.isUb ? 1 : (pool.getRand64Parts()[0] & 1) + 1;

    // Nature
    const synchronize = this.synchroPass;
    let nature: number;
    if (synchronize && this.synchroStat < 25) {
      nature = this.synchroStat;
    } else {
      const [nLo, nHi] = pool.getRand64Parts();
      nature = modU64(nLo, nHi, 25);
    }

    // Gender
    const slotGender = this.genderRatio[this.slot] ?? 0;
    let gender: number;
    if (this.randomGender[this.slot]) {
      if (this.cuteCharmPass) {
        gender = this.cuteCharmGender;
      } else {
        const [gLo, gHi] = pool.getRand64Parts();
        gender = modU64(gLo, gHi, 252) >= slotGender ? 1 : 2;
      }
    } else {
      gender = slotGender;
    }

    // Held Item
    let itemRand = 100;
    if (this.sos && this.sosRng) {
      itemRand = this.sosRng.getRand() % 100;
    } else if (this.normalSlot) {
      const [itLo, itHi] = pool.getRand64Parts();
      itemRand = modU64(itLo, itHi, 100);
    }
    const item = getHeldItem(itemRand, this.compoundEye);

    let finalSlot = this.slot;
    if (this.fishing && this.isSpecial) {
      finalSlot = this.getHookedItemSlot(specialVal);
    } else if (this.sos && this.sosRng) {
      ability = this.sosRng.postGeneration(ivs, ability);
    }

    return {
      kind: 'wild',
      species,
      forme,
      level,
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
      slot: finalSlot,
      specialVal,
      isSpecial: this.isSpecial,
      item,
    };
  }
}
