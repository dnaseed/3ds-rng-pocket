import { SFMT } from '../rng/sfmt';
import { modU64 } from '../math/uint';
import { ModelStatus } from './modelStatus';

export const REORDER1 = [1, 2, 5, 3, 4] as const;
export const REORDER2 = [0, 1, 2, 4, 5, 3] as const;

export const MAX_FRAME = 1_000_000_000;

/**
 * Translate genderratio in PersonalTable to RNGSetting format.
 * Exact port of FuncUtil.getGenderRatio.
 */
export function getGenderRatio(genderratio: number): number {
  switch (genderratio) {
    case 0x1f:
    case 0x3f:
    case 0x7f:
    case 0xbf:
    case 0xe1:
      return genderratio - 1;
    case 0x00:
      return 1;
    case 0xfe:
      return 2;
    default:
      return 0; // 0xFF
  }
}

export function isRandomGender(genderratio: number): boolean {
  return 0x0f < genderratio && genderratio < 0xef;
}

export function getPSV(pid: number): number {
  const u = pid >>> 0;
  return (((u >>> 16) ^ (u & 0xffff)) >>> 4) & 0xfff;
}

export function getPRV(pid: number): number {
  const u = pid >>> 0;
  return ((u >>> 16) ^ (u & 0xffff)) & 0xf;
}

export function getTSV(rn: number): number {
  return getPSV(rn);
}

export function getHiddenPowerValue(ivs: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    sum += ((ivs[i] ?? 0) & 1) << REORDER2[i]!;
  }
  return Math.trunc((15 * sum) / 63);
}

export function natureAdjustment(stats: number[], nature: number): void {
  const inc = REORDER1[Math.trunc(nature / 5)]!;
  const dec = REORDER1[nature % 5]!;
  if (inc === dec) return;
  stats[inc] = Math.trunc(1.1 * stats[inc]!);
  stats[dec] = Math.trunc(0.9 * stats[dec]!);
}

export function getStats(
  ivs: readonly number[],
  nature: number,
  lv: number,
  bs: readonly number[],
): [number, number, number, number, number, number] {
  const stats = [0, 0, 0, 0, 0, 0];
  stats[0] = Math.trunc(((bs[0]! * 2 + ivs[0]!) * lv) / 100) + lv + 10;
  for (let i = 1; i < 6; i++) {
    stats[i] = Math.trunc(((bs[i]! * 2 + ivs[i]!) * lv) / 100) + 5;
  }
  natureAdjustment(stats, nature);
  return stats as [number, number, number, number, number, number];
}

/**
 * Port of FuncUtil.getstartingframe.
 * method: 0=Stationary, 1=Event, 2=Wild, 3=Egg, 4=ID.
 * version index in 3DSRNGTool: 5=Sun, 6=Moon, 7=US, 8=UM.
 */
export function getStartingFrame(isUltra: boolean, method: number): number {
  if (method === 3) return 0; // Egg
  if (!isUltra) return method === 4 ? 1012 : 418;
  return method === 4 ? 1132 : 478;
}

/**
 * Exact port of FuncUtil.CalcFrame (numerical frame/time estimation for result display).
 * Returns [startFrames30fps, durationFrames30fps].
 */
export function calcFrame(
  seed: number,
  min: number,
  max: number,
  modelNumber: number,
  fidget = false,
  raining = false,
): [number, number] {
  if (min > max) {
    const rev = calcFrame(seed, max, min, modelNumber, fidget, raining);
    return [-rev[0], -rev[1]];
  }

  const sfmt = new SFMT(seed);
  sfmt.advance(min);

  const totalFrame: [number, number] = [0, 0];
  let frameadvance = 0;
  let frametime = 0;
  let timer: 0 | 1 = 0;
  let fidgetCnt = -1;
  const fidgetCd = 452;

  const status = new ModelStatus(modelNumber, sfmt);
  status.raining = raining;

  for (let i = min; i <= max; ) {
    if (fidget) {
      const limit = Math.trunc(frametime / fidgetCd);
      for (; fidgetCnt < limit; fidgetCnt++) {
        i += status.frameshift(2);
      }
    }
    do {
      frameadvance = status.nextState();
      totalFrame[timer]++;
    } while (frameadvance === 0);
    i += frameadvance;
    if (i === max) {
      timer = 1;
    }
    if (i <= max) {
      frametime = totalFrame[0];
    }
  }
  totalFrame[0] = frametime;
  return totalFrame;
}

export function convertToTimeStr(sec: number): string {
  const neg = sec < 0 ? '-' : '';
  const abs = Math.abs(sec);
  if (abs < 60) {
    return `${neg}${abs.toFixed(3)}s`;
  }
  let mins = Math.floor(abs / 60);
  const remSec = abs - 60 * mins;
  if (mins < 60) {
    return `${neg}${mins}m ${remSec.toFixed(3).padStart(6, '0')}s`;
  }
  const hours = Math.floor(mins / 60);
  mins -= 60 * hours;
  return `${neg}${hours}h ${String(mins).padStart(2, '0')}m ${remSec.toFixed(1).padStart(4, '0')}s`;
}

export function getClockFromU64(lo: number, hi: number): number {
  return modU64(lo, hi, 17);
}
