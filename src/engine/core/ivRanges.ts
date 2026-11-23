import { getStats } from './pokemonMath';
import type { RngFilterOptions } from './types';

export type IvRanges = Pick<RngFilterOptions, 'ivLow' | 'ivUp'>;

/** Invert the zero-EV stat calculation in display order: HP, Atk, Def, SpA, SpD, Spe. */
export function getIvRanges(
  baseStats: readonly number[],
  level: number,
  nature: number,
  observed: readonly number[],
  characteristic?: { stat: number; remainder: number },
): IvRanges | null {
  if (!Number.isInteger(level) || level < 1 || level > 100 ||
      !Number.isInteger(nature) || nature < 0 || nature > 24 ||
      ![baseStats, observed].every(values =>
        values.length === 6 && values.every(value => Number.isInteger(value) && value > 0))) {
    return null;
  }

  const ivLow: IvRanges['ivLow'] = [32, 32, 32, 32, 32, 32];
  const ivUp: IvRanges['ivUp'] = [-1, -1, -1, -1, -1, -1];
  // Each displayed stat depends only on its own IV, so 32 spreads cover all six axes.
  for (let iv = 0; iv <= 31; iv++) {
    const stats = getStats([iv, iv, iv, iv, iv, iv], nature, level, baseStats);
    if (baseStats[0] === 1) stats[0] = 1; // Shedinja always has one HP.
    for (let i = 0; i < 6; i++) {
      if (stats[i] !== observed[i]) continue;
      ivLow[i] = Math.min(ivLow[i]!, iv);
      ivUp[i] = iv;
    }
  }
  if (ivUp.includes(-1)) return null;
  if (characteristic) {
    const { stat, remainder } = characteristic;
    if (!Number.isInteger(stat) || stat < 0 || stat >= 6 ||
        !Number.isInteger(remainder) || remainder < 0 || remainder > 4) return null;
    // Any tied maximum can supply the characteristic with an unknown EC.
    // The all-zero spread is exceptional: Gen 7 always reports the HP characteristic.
    const minHighest = Math.max(...ivLow, stat === 0 ? 0 : 1);
    const possible = [];
    for (let iv = minHighest; iv <= ivUp[stat]!; iv++) {
      if (iv % 5 === remainder) possible.push(iv);
    }
    if (possible.length === 0) return null;
    ivLow[stat] = possible[0]!;
    const maxHighest = possible[possible.length - 1]!;
    for (let i = 0; i < 6; i++) ivUp[i] = Math.min(ivUp[i]!, maxHighest);
  }
  return { ivLow, ivUp };
}
