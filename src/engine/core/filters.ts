import { getHiddenPowerValue, getStats } from './pokemonMath';
import type { AnyResult7, IdFilterOptions, IdResult6, IdResult7, RngFilterOptions, RngResultBase } from './types';
import { formatEggSeedStr, toHex64 } from '../math/uint';

export function createDefaultRngFilter(): RngFilterOptions {
  return {
    skip: false,
    shinyOnly: false,
    squareShinyOnly: false,
    ivLow: [0, 0, 0, 0, 0, 0],
    ivUp: [31, 31, 31, 31, 31, 31],
    perfectIvValue: 31,
    perfectIvCount: 0,
    byStats: false,
    baseStats: null,
    targetStats: null,
    natures: new Array<boolean>(25).fill(false),
    hpTypes: new Array<boolean>(16).fill(false),
    ability: 0,
    gender: 0,
    level: 0,
    slots: new Array<boolean>(11).fill(false), // index 1..10 match 1-based Wild7 slots
    specialOnly: false,
    ball: 0,
    natureInheritance: 0,
    safeOnly: false,
    blinkOnly: false,
  };
}

export function checkRngFilter(
  filter: RngFilterOptions,
  result: AnyResult7 | (RngResultBase & { kind: 'stationary' }),
  isPokemon = true,
): boolean {
  if (!isPokemon) return false;

  const hp = getHiddenPowerValue(result.ivs);
  result.hiddenPower = hp;

  if (filter.skip) {
    if (filter.byStats && filter.baseStats) {
      result.stats = getStats(result.ivs, result.nature, result.level, filter.baseStats);
    }
    return true;
  }

  if (result.kind === 'egg') {
    if (filter.ball !== 0 && filter.ball !== result.ball) {
      return false;
    }
    if (filter.natureInheritance !== 0) {
      const inh = result.beInheritParents === true ? 1 : 2;
      if (inh !== filter.natureInheritance) return false;
    }
  }

  if (filter.shinyOnly) {
    if (!result.shiny) return false;
    if (filter.squareShinyOnly && !result.squareShiny) return false;
  }

  if (filter.byStats && filter.baseStats && filter.targetStats) {
    result.stats = getStats(result.ivs, result.nature, result.level, filter.baseStats);
    for (let i = 0; i < 6; i++) {
      const target = filter.targetStats[i] ?? 0;
      if (target !== 0 && target !== result.stats[i]) {
        return false;
      }
    }
  } else {
    let perfectCount = 0;
    for (let i = 0; i < 6; i++) {
      const iv = result.ivs[i]!;
      if (iv < filter.ivLow[i]! || iv > filter.ivUp[i]!) {
        return false;
      }
      if (iv >= filter.perfectIvValue) {
        perfectCount++;
      }
    }
    if (perfectCount < filter.perfectIvCount) {
      return false;
    }
  }

  if (filter.hpTypes.some(Boolean) && !filter.hpTypes[hp]) {
    return false;
  }

  if (filter.natures.some(Boolean) && !filter.natures[result.nature]) {
    return false;
  }

  if (filter.gender !== 0 && filter.gender !== result.gender) {
    return false;
  }

  if (filter.ability !== 0 && filter.ability !== result.ability) {
    return false;
  }

  if (result.kind === 'wild') {
    if (filter.level !== 0 && filter.level !== result.level) {
      return false;
    }
    if (filter.specialOnly && !result.isSpecial) {
      return false;
    }
    if (filter.slots.some(Boolean) && !filter.slots[result.slot]) {
      return false;
    }
  }

  return true;
}

export class CompiledIdFilter {
  private readonly opts: IdFilterOptions;
  private readonly tsvSet: Set<number>;
  private readonly fullIdSet: Set<number>;
  private readonly idPatterns: RegExp[];
  private readonly randPatterns: RegExp[];

  constructor(opts: IdFilterOptions) {
    this.opts = opts;
    this.tsvSet = new Set<number>();
    this.fullIdSet = new Set<number>();
    this.idPatterns = [];
    this.randPatterns = [];

    for (const raw of opts.tsvList) {
      const val = Number.parseInt(raw.trim(), 10);
      if (Number.isInteger(val) && val >= 0 && val < 4096) {
        this.tsvSet.add(val);
      }
    }

    if (opts.idType === 2) {
      for (const line of opts.idList) {
        let input = line.replace(/\s+/g, '');
        const commentIdx = input.lastIndexOf('//');
        if (commentIdx > 0) input = input.slice(0, commentIdx);
        if (!input) continue;
        if (input.includes('/')) {
          const [tStr, sStr] = input.split('/');
          const tid = Number.parseInt(tStr ?? '', 10);
          const sid = Number.parseInt(sStr ?? '', 10);
          if (Number.isInteger(tid) && Number.isInteger(sid) && tid >= 0 && sid >= 0) {
            this.fullIdSet.add(((sid << 16) | tid) >>> 0);
          }
        } else if (/^[0-9a-fA-F]{1,8}$/.test(input)) {
          this.fullIdSet.add(Number.parseInt(input, 16) >>> 0);
        }
      }
    } else if (opts.regex) {
      for (const pat of opts.idList) {
        if (pat.length > 0) {
          try {
            this.idPatterns.push(new RegExp(pat));
          } catch {
            // ignore invalid regex
          }
        }
      }
    }

    if (opts.regex) {
      for (const pat of opts.randList) {
        if (pat.length > 0) {
          try {
            this.randPatterns.push(new RegExp(pat));
          } catch {
            // ignore invalid regex
          }
        }
      }
    }
  }

  public check(id: IdResult6 | IdResult7): boolean {
    if (this.opts.skip) return true;

    if (this.opts.idList.some((s) => s.trim().length > 0)) {
      if (!this.checkId(id)) return false;
    }

    if (this.opts.tsvList.some((s) => s.trim().length > 0)) {
      if (!this.tsvSet.has(id.tsv)) return false;
    }

    if (this.opts.randList.some((s) => s.trim().length > 0)) {
      const randStr = 'state' in id ? formatEggSeedStr(id.state) : toHex64(id.randLo, id.randHi);
      if (this.opts.regex) {
        if (!this.randPatterns.some((re) => re.test(randStr))) return false;
      } else {
        const matched = this.opts.randList.some(
          (pat) => pat.length > 0 && randStr.includes(pat.toUpperCase()),
        );
        if (!matched) return false;
      }
    }

    return true;
  }

  private checkId(id: IdResult6 | IdResult7): boolean {
    if (this.opts.idType === 2) {
      const fullId = (((id.sid & 0xffff) << 16) | (id.tid & 0xffff)) >>> 0;
      return this.fullIdSet.has(fullId);
    }

    let str = '';
    if (this.opts.idType === 0) str = String(id.tid).padStart(5, '0');
    else if (this.opts.idType === 1) str = String(id.sid).padStart(5, '0');
    else if ('g7tid' in id) str = String(id.g7tid).padStart(6, '0');
    else return false;

    if (this.opts.regex) {
      return this.idPatterns.some((re) => re.test(str));
    }
    return this.opts.idList.some((pat) => pat.length > 0 && str.includes(pat));
  }
}
