import { BERRY_PILES } from '../../data/miscGen7';
import { ModelStatus } from '../core/modelStatus';
import { RngPool } from '../core/rngPool';
import type { GameVersionId } from '../core/types';
import { modU64, toHex64 } from '../math/uint';
import { SFMT } from '../rng/sfmt';
import { getBattleTreeTrainer } from './battleTree';
import { getFestivalFacility, type FestivalFacility } from './festivalPlaza';
import { getPokerusStrain } from './pokerus7';

export type MiscSettings =
  | { kind: 'pokerus' }
  | { kind: 'festival'; game: GameVersionId; rank: number; filters: Partial<FestivalFacility> }
  | { kind: 'battleTree'; game: GameVersionId; streak: number; trainerId?: number }
  | { kind: 'rotoLoto'; target?: number }
  | { kind: 'berries'; location: number; target?: string };

export interface MiscSearchRequest {
  seed: number;
  startIndex: number;
  endIndex: number;
  npcCount: number;
  delayFrames: number;
  settings: MiscSettings;
}

export type MiscResult =
  | { kind: 'pokerus'; strain: number }
  | ({ kind: 'festival' } & FestivalFacility)
  | { kind: 'battleTree'; trainerId: number }
  | { kind: 'rotoLoto'; roll: number }
  | { kind: 'berries'; roll: number; berry: string };

export interface MiscRow {
  index: number;
  actualIndex: number;
  randomNumber: string;
  result: MiscResult;
}

export interface MiscSearchOutput {
  rows: MiscRow[];
  truncated: boolean;
}

const MAX_ROWS = 5000;

function generate(pool: RngPool, headLo: number, settings: MiscSettings): MiscResult | undefined {
  switch (settings.kind) {
    case 'pokerus': {
      const strain = getPokerusStrain(pool);
      if (strain > 0) return { kind: 'pokerus', strain };
      break;
    }
    case 'festival': {
      const result = getFestivalFacility(headLo, settings.game, settings.rank);
      const { stars, facility, npc, color } = settings.filters;
      if ((stars === undefined || stars === result.stars) &&
          (facility === undefined || facility === result.facility) &&
          (npc === undefined || npc === result.npc) &&
          (color === undefined || color === result.color)) {
        return { kind: 'festival', ...result };
      }
      break;
    }
    case 'battleTree': {
      const [lo, hi] = pool.getRand64Parts();
      const trainerId = getBattleTreeTrainer(lo, hi, settings.game, settings.streak);
      if (settings.trainerId === undefined || settings.trainerId === trainerId) {
        return { kind: 'battleTree', trainerId };
      }
      break;
    }
    case 'rotoLoto': {
      const [lo, hi] = pool.getRand64Parts();
      const roll = modU64(lo, hi, 11);
      if (settings.target === undefined || settings.target === roll) return { kind: 'rotoLoto', roll };
      break;
    }
    case 'berries': {
      const [lo, hi] = pool.getRand64Parts();
      const roll = modU64(lo, hi, 6);
      const berry = BERRY_PILES[settings.location]!.berries[roll]!;
      if (settings.target === undefined || settings.target === berry) return { kind: 'berries', roll, berry };
      break;
    }
  }
}

/** Misc RNG Tool's Gen 7 SFMT (64-bit) search. Indices are inclusive. */
export function searchMisc7(
  { seed, startIndex, endIndex, npcCount, delayFrames, settings }: MiscSearchRequest,
  onProgress?: (percent: number) => void,
): MiscSearchOutput {
  const sfmt = new SFMT(seed);
  sfmt.advance(startIndex);
  const modelNumber = npcCount + 1;
  const model = new ModelStatus(modelNumber, sfmt);
  const beforeAdvance = new ModelStatus(modelNumber, sfmt);
  const delay = Math.trunc(delayFrames / 2);
  const pool = new RngPool();
  pool.createBuffer64(sfmt, Math.max(5000, modelNumber * delay + 64));
  const rows: MiscRow[] = [];
  const length = endIndex - startIndex + 1;

  let index = startIndex;
  while (index <= endIndex) {
    let advances = model.nextState();
    while (advances === 0) advances = model.nextState();
    for (; advances > 0 && index <= endIndex; advances--, index++) {
      const [lo, hi] = pool.getCurrent64Parts();
      pool.rewind(0);
      pool.copyStatus(beforeAdvance);
      pool.timeElapse7(delay);
      if (settings.kind === 'battleTree') {
        pool.modelNumber = 2;
        pool.resetModelStatus();
        pool.timeElapse7(2);
      }
      const actualIndex = index + pool.index;
      const result = generate(pool, lo, settings);
      if (result) {
        if (rows.length === MAX_ROWS) return { rows, truncated: true };
        rows.push({ index, actualIndex, randomNumber: toHex64(lo, hi), result });
      }
      pool.addNext64(sfmt);
      if ((index - startIndex) % 1024 === 0) {
        onProgress?.(Math.floor((index - startIndex) * 100 / length));
      }
    }
    model.copyTo(beforeAdvance);
  }
  onProgress?.(100);
  return { rows, truncated: false };
}
