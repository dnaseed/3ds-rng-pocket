import { TinyMT } from '../rng/tinymt';
import { isUltraVersion, type GameVersionId } from '../core/types';

const STAR_CHANCES = [
  [100, 0, 0, 0], [75, 19, 6, 0], [75, 17, 8, 0], [75, 15, 10, 0],
  [50, 38, 12, 0], [50, 36, 14, 0], [50, 34, 16, 0], [50, 32, 18, 0],
  [40, 35, 20, 5], [30, 40, 22, 7], [25, 40, 24, 0], [20, 35, 31, 11],
  [15, 30, 38, 13], [10, 25, 45, 15], [10, 20, 47, 17], [10, 15, 49, 19],
  [10, 15, 46, 21], [10, 15, 43, 23], [10, 15, 40, 25],
];

// v1.0.6 tests Ver == 1 && Ver == 3, so it uses these pools for all versions.
const FACILITY_POOLS = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 21, 23, 24, 25, 27, 29, 31, 33],
  [3, 4, 5, 7, 9, 10, 14, 16, 17, 33],
  [0, 1, 2, 9, 10, 11, 12, 14, 16, 19, 21, 23, 25, 27, 29, 31, 33],
  [3, 4, 5, 7, 14, 16, 17],
  [0, 1, 2, 11, 14, 16, 19, 21, 23, 24, 25, 27, 29, 31],
];

export interface FestivalFacility {
  stars: number;
  facility: number;
  npc: number;
  color: number;
}

export function getFestivalFacility(seed: number, game: GameVersionId, rank: number): FestivalFacility {
  const tiny = new TinyMT(seed);
  let roll = tiny.nextU32() % 100;
  let stars = 1;
  for (const chance of STAR_CHANCES[rank]!) {
    roll -= chance;
    if (roll < 0) break;
    stars++;
  }
  const pool = FACILITY_POOLS[stars - 1]!;
  const length = !isUltraVersion(game) && stars <= 3 ? pool.length - 1 : pool.length;
  const facility = pool[tiny.nextU32() % length]!;
  const npc = tiny.nextU32() % 12;
  const colorRoll = tiny.nextU32() % 100;
  const color = colorRoll < 5 ? 3 : colorRoll < 20 ? 2 : colorRoll < 50 ? 1 : 0;
  return { stars, facility, npc, color };
}
