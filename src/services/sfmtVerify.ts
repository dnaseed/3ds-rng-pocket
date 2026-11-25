import { toHex32 } from '../engine/math/uint';
import { SFMT } from '../engine/rng/sfmt';

export interface RankedChar {
  glyph: string;
  score: number;
}

export interface SfmtVerifyResult {
  seed: string;
  verified: boolean;
  exact: boolean;
  corrected: boolean;
  matchedNibbles: number;
}

const CONFUSIONS: Record<string, string> = {
  '0': 'DBE586',
  '1': '7',
  '2': 'Z', // filtered to hex below
  '3': '8B5',
  '4': 'A',
  '5': '806B',
  '6': 'E805B',
  '7': '1',
  '8': 'B5630',
  '9': '860',
  A: '48',
  B: '806E5',
  C: '0E',
  D: '0B8',
  E: '60B8F',
  F: 'E',
};

const HEX_SET = new Set([...'0123456789ABCDEF']);

/** Build ranked hex candidates per character from a noisy 8-char OCR seed. */
export function buildConfusionRanked(hex8: string): RankedChar[][] {
  const clean = hex8.trim().toUpperCase();
  return [...clean].map((ch) => {
    const primary = HEX_SET.has(ch) ? ch : '0';
    const seen = new Set<string>([primary]);
    const list: RankedChar[] = [{ glyph: primary, score: 1.0 }];
    const alts = CONFUSIONS[ch] ?? '';
    let score = 0.88;
    for (const alt of alts) {
      if (!HEX_SET.has(alt) || seen.has(alt)) continue;
      seen.add(alt);
      list.push({ glyph: alt, score });
      score = Math.max(0.5, score - 0.03);
    }
    return list;
  });
}

function countMatchingNibbles(lo: number, hi: number, s1: string, s0: string): number {
  const a = toHex32(lo);
  const b = toHex32(hi);
  let matches = 0;
  for (let i = 0; i < 8; i++) {
    if (a[i] === s1[i]) matches++;
    if (b[i] === s0[i]) matches++;
  }
  return matches;
}

/**
 * Verify or auto-correct an 8-hex Initial Seed using PokeReader's displayed
 * State[1] (lo), State[0] (hi), and Advances via SFMT.
 */
export function verifyOrFixSeedWithSfmt(
  rankedSeed: RankedChar[][],
  state1Hex: string,
  state0Hex: string,
  advances: number,
  maxCandidates = 512,
  maxMs = 120,
): SfmtVerifyResult {
  const top1Seed = rankedSeed.map((c) => c[0]?.glyph ?? '0').join('');
  const s1 = state1Hex.trim().toUpperCase();
  const s0 = state0Hex.trim().toUpperCase();

  if (
    rankedSeed.length !== 8 ||
    rankedSeed.some((c) => c.length === 0) ||
    !Number.isInteger(advances) ||
    advances < 0 ||
    advances > 50000 ||
    !/^[0-9A-F]{8}$/.test(s1) ||
    !/^[0-9A-F]{8}$/.test(s0)
  ) {
    return { seed: top1Seed, verified: false, exact: false, corrected: false, matchedNibbles: 0 };
  }

  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const startMs = nowMs();

  const opts = rankedSeed.map((col) => col.slice(0, 4));
  const initialIndices = [0, 0, 0, 0, 0, 0, 0, 0];
  const queue: { penalty: number; indices: number[] }[] = [{ penalty: 0, indices: initialIndices }];
  const visited = new Set<string>([initialIndices.join(',')]);

  let bestSeed = top1Seed;
  let bestNibbles = -1;
  let secondBestNibbles = -1;
  let evaluated = 0;

  while (queue.length > 0 && evaluated < maxCandidates) {
    if (evaluated > 0 && (evaluated & 7) === 0 && nowMs() - startMs >= maxMs) break;

    // Pop lowest-penalty state (small queue <= ~2k items).
    let minIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i]!.penalty < queue[minIdx]!.penalty) minIdx = i;
    }
    const current = queue[minIdx]!;
    queue[minIdx] = queue[queue.length - 1]!;
    queue.pop();

    const candidate = current.indices.map((idx, pos) => opts[pos]![idx]!.glyph).join('');
    const seedNum = Number.parseInt(candidate, 16) >>> 0;
    const rng = new SFMT(seedNum);
    rng.advance(advances);
    const [lo, hi] = rng.nextU64Parts();
    const nibbles = countMatchingNibbles(lo, hi, s1, s0);
    evaluated++;

    if (nibbles > bestNibbles) {
      if (bestNibbles >= 0) secondBestNibbles = Math.max(secondBestNibbles, bestNibbles);
      bestNibbles = nibbles;
      bestSeed = candidate;
    } else if (candidate !== bestSeed) {
      secondBestNibbles = Math.max(secondBestNibbles, nibbles);
    }

    if (bestNibbles === 16) break;

    for (let pos = 0; pos < 8; pos++) {
      const nextOpt = current.indices[pos]! + 1;
      if (nextOpt >= opts[pos]!.length) continue;
      const nextIndices = current.indices.slice();
      nextIndices[pos] = nextOpt;
      const key = nextIndices.join(',');
      if (visited.has(key)) continue;
      visited.add(key);
      const delta =
        (opts[pos]![current.indices[pos]!]!.score - opts[pos]![nextOpt]!.score);
      queue.push({
        penalty: current.penalty + Math.max(0.001, delta),
        indices: nextIndices,
      });
    }
  }

  const exact = bestNibbles === 16;
  const verified =
    exact || (bestNibbles >= 13 && bestNibbles - Math.max(0, secondBestNibbles) >= 3);
  if (verified) {
    return {
      seed: bestSeed,
      verified: true,
      exact,
      corrected: bestSeed !== top1Seed,
      matchedNibbles: bestNibbles,
    };
  }
  return {
    seed: top1Seed,
    verified: false,
    exact: false,
    corrected: false,
    matchedNibbles: Math.max(0, bestNibbles),
  };
}
