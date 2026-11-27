import { MAX_FRAME } from '../engine/core/pokemonMath';
import { toHex32 } from '../engine/math/uint';
import { MT19937 } from '../engine/rng/mt19937';
import { TinyMT } from '../engine/rng/tinymt';
import type { RankedChar } from './sfmtVerify';

export interface MtVerifyResult {
  seed: string;
  frame: string;
  verified: boolean;
  exact: boolean;
  corrected: boolean;
  matchedNibbles: number;
}

export interface TinyVerifyResult {
  verified: boolean;
  exact: boolean;
  tiny3: string;
  tiny2: string;
  tiny1: string;
  tiny0: string;
  tinyAdvances: number;
  matchedSeedNibbles: number;
  matchedStateNibbles: number;
}

function countNibbles8(a: string, b: string): number {
  let matches = 0;
  for (let i = 0; i < 8; i++) {
    if (a[i] === b[i]) matches++;
  }
  return matches;
}

function countNibbles32(
  actual: readonly [string, string, string, string],
  observed: readonly [string, string, string, string],
): number {
  let matches = 0;
  for (let w = 0; w < 4; w++) {
    matches += countNibbles8(actual[w]!, observed[w]!);
  }
  return matches;
}

function* bestFirstCandidates(ranked: RankedChar[][], maxCandidates: number): Generator<string> {
  if (ranked.length !== 8 || ranked.some((c) => c.length === 0)) return;
  const opts = ranked.map((col) => col.slice(0, 4));
  const initialIndices = [0, 0, 0, 0, 0, 0, 0, 0];
  const queue: { penalty: number; indices: number[] }[] = [{ penalty: 0, indices: initialIndices }];
  const visited = new Set<string>([initialIndices.join(',')]);
  let yielded = 0;

  while (queue.length > 0 && yielded < maxCandidates) {
    let minIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i]!.penalty < queue[minIdx]!.penalty) minIdx = i;
    }
    const current = queue[minIdx]!;
    queue[minIdx] = queue[queue.length - 1]!;
    queue.pop();

    yielded++;
    yield current.indices.map((idx, pos) => opts[pos]![idx]!.glyph).join('');

    for (let pos = 0; pos < 8; pos++) {
      const nextOpt = current.indices[pos]! + 1;
      if (nextOpt >= opts[pos]!.length) continue;
      const nextIndices = current.indices.slice();
      nextIndices[pos] = nextOpt;
      const key = nextIndices.join(',');
      if (visited.has(key)) continue;
      visited.add(key);
      const delta = opts[pos]![current.indices[pos]!]!.score - opts[pos]![nextOpt]!.score;
      queue.push({
        penalty: current.penalty + Math.max(0.001, delta),
        indices: nextIndices,
      });
    }
  }
}

/**
 * Verify or auto-correct an 8-hex Gen 6 MT19937 Initial Seed against Curr state & MT Advances.
 */
export function verifyOrFixSeedWithMt(
  seedRanked: RankedChar[][],
  currStateHex: string,
  advances: number,
  advCandidates?: readonly number[],
  maxCandidates = 512,
  maxMs = 120,
): MtVerifyResult {
  const top1Seed = seedRanked.map((c) => c[0]?.glyph ?? '0').join('');
  const targetState = currStateHex.trim().toUpperCase();
  const maxAdv = Math.min(MAX_FRAME, 50000);

  const uniqueAdvs = Array.from(
    new Set(
      [advances, ...(advCandidates ?? [])].filter(
        (a) => Number.isInteger(a) && a >= 0 && a <= maxAdv,
      ),
    ),
  ).sort((a, b) => a - b);

  if (
    seedRanked.length !== 8 ||
    seedRanked.some((c) => c.length === 0) ||
    !/^[0-9A-F]{8}$/.test(targetState) ||
    uniqueAdvs.length === 0
  ) {
    return {
      seed: top1Seed,
      frame: Number.isInteger(advances) && advances >= 0 ? String(advances) : '',
      verified: false,
      exact: false,
      corrected: false,
      matchedNibbles: 0,
    };
  }

  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const startMs = nowMs();

  let bestSeed = top1Seed;
  let bestFrame = String(uniqueAdvs[0]!);
  let bestNibbles = -1;
  let secondBestNibbles = -1;
  let evaluated = 0;

  for (const candidate of bestFirstCandidates(seedRanked, maxCandidates)) {
    if (evaluated > 0 && (evaluated & 7) === 0 && nowMs() - startMs >= maxMs) break;

    const seedNum = Number.parseInt(candidate, 16) >>> 0;
    const mt = new MT19937(seedNum);
    let curAdv = 0;
    let candBest = -1;
    let candBestAdv = uniqueAdvs[0]!;

    for (const adv of uniqueAdvs) {
      if (adv > curAdv) {
        mt.advance(adv - curAdv);
        curAdv = adv;
      }
      const expected = toHex32(mt.currentStateWord());
      const nibbles = countNibbles8(expected, targetState);
      if (nibbles > candBest) {
        candBest = nibbles;
        candBestAdv = adv;
      }
      if (candBest === 8) break;
    }

    evaluated++;

    if (candBest > bestNibbles) {
      if (bestNibbles >= 0) secondBestNibbles = Math.max(secondBestNibbles, bestNibbles);
      bestNibbles = candBest;
      bestSeed = candidate;
      bestFrame = String(candBestAdv);
    } else if (candidate !== bestSeed) {
      secondBestNibbles = Math.max(secondBestNibbles, candBest);
    }

    if (bestNibbles === 8) break;
  }

  const exact = bestNibbles === 8;
  const verified =
    exact || (bestNibbles >= 6 && bestNibbles - Math.max(0, secondBestNibbles) >= 2);

  if (verified) {
    return {
      seed: bestSeed,
      frame: bestFrame,
      verified: true,
      exact,
      corrected: bestSeed !== top1Seed,
      matchedNibbles: bestNibbles,
    };
  }

  return {
    seed: top1Seed,
    frame: Number.isInteger(advances) && advances >= 0 ? String(advances) : '',
    verified: false,
    exact: false,
    corrected: false,
    matchedNibbles: Math.max(0, bestNibbles),
  };
}

/**
 * Verify and recover the exact Gen 6 TinyMT [S3, S2, S1, S0] state from Tiny u32 seed,
 * TinyMT seed, and TinyMT state (tolerating obstructed digits in Advances or state words).
 */
export function verifyOrFixTinyMt(
  tinyU32Ranked: RankedChar[][],
  obsSeedHexes: readonly [string, string, string, string],
  obsStateHexes: readonly [string, string, string, string],
  tinyAdvCandidates?: readonly number[],
  maxCandidates = 512,
  maxMs = 120,
): TinyVerifyResult | null {
  const normSeed = obsSeedHexes.map((s) => s.trim().toUpperCase()) as [
    string,
    string,
    string,
    string,
  ];
  const normState = obsStateHexes.map((s) => s.trim().toUpperCase()) as [
    string,
    string,
    string,
    string,
  ];

  if (
    tinyU32Ranked.length !== 8 ||
    tinyU32Ranked.some((c) => c.length === 0) ||
    normSeed.some((s) => !/^[0-9A-F]{8}$/.test(s)) ||
    normState.some((s) => !/^[0-9A-F]{8}$/.test(s))
  ) {
    return null;
  }

  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const startMs = nowMs();
  const seedBudgetMs = maxMs * 0.6;

  let bestU32 = '';
  let bestSeedNibbles = -1;
  let secondBestSeedNibbles = -1;
  let evaluated = 0;

  for (const candidate of bestFirstCandidates(tinyU32Ranked, maxCandidates)) {
    if (evaluated > 0 && (evaluated & 7) === 0 && nowMs() - startMs >= seedBudgetMs) break;

    const u32Num = Number.parseInt(candidate, 16) >>> 0;
    const parts = new TinyMT(u32Num).getStateHex().split(',') as [string, string, string, string];
    const nibbles = countNibbles32(parts, normSeed);
    evaluated++;

    if (nibbles > bestSeedNibbles) {
      if (bestSeedNibbles >= 0) secondBestSeedNibbles = Math.max(secondBestSeedNibbles, bestSeedNibbles);
      bestSeedNibbles = nibbles;
      bestU32 = candidate;
    } else if (candidate !== bestU32) {
      secondBestSeedNibbles = Math.max(secondBestSeedNibbles, nibbles);
    }

    if (bestSeedNibbles === 32) break;
  }

  const seedTrusted =
    bestSeedNibbles >= 28 ||
    (bestSeedNibbles >= 22 && bestSeedNibbles - Math.max(0, secondBestSeedNibbles) >= 4);
  if (!seedTrusted || !bestU32) return null;

  const extraAdvs = (tinyAdvCandidates ?? []).filter(
    (a) => Number.isInteger(a) && a > 64 && a <= 2000,
  );
  const maxScan = Math.max(64, ...extraAdvs);
  const probeSet = new Set<number>(extraAdvs);
  for (let i = 0; i <= 64; i++) probeSet.add(i);

  const tiny = new TinyMT(Number.parseInt(bestU32, 16) >>> 0);
  let bestAdv = 0;
  let bestStateNibbles = -1;
  let secondBestStateNibbles = -1;
  let bestParts: [string, string, string, string] = ['00000000', '00000000', '00000000', '00000000'];

  for (let adv = 0; adv <= maxScan; adv++) {
    if ((adv & 31) === 0 && nowMs() - startMs >= maxMs) break;
    if (probeSet.has(adv)) {
      const parts = tiny.getStateHex().split(',') as [string, string, string, string];
      const nibbles = countNibbles32(parts, normState);
      if (nibbles > bestStateNibbles) {
        if (bestStateNibbles >= 0) {
          secondBestStateNibbles = Math.max(secondBestStateNibbles, bestStateNibbles);
        }
        bestStateNibbles = nibbles;
        bestAdv = adv;
        bestParts = parts;
      } else {
        secondBestStateNibbles = Math.max(secondBestStateNibbles, nibbles);
      }
      if (bestStateNibbles === 32) break;
    }
    if (adv < maxScan) tiny.nextState();
  }

  const stateTrusted =
    bestStateNibbles >= 28 ||
    (bestStateNibbles >= 20 && bestStateNibbles - Math.max(0, secondBestStateNibbles) >= 5);
  if (!stateTrusted) return null;

  const exact = bestSeedNibbles >= 26 && bestStateNibbles === 32;

  return {
    verified: true,
    exact,
    tiny3: bestParts[0],
    tiny2: bestParts[1],
    tiny1: bestParts[2],
    tiny0: bestParts[3],
    tinyAdvances: bestAdv,
    matchedSeedNibbles: bestSeedNibbles,
    matchedStateNibbles: bestStateNibbles,
  };
}
