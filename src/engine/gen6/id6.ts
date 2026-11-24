import { MAX_FRAME } from '../core/pokemonMath';
import type { IdResult6 } from '../core/types';
import { TinyMT } from '../rng/tinymt';
import type { TinyState } from '../rng/types';

export function isTinyState6(value: unknown): value is TinyState {
  return Array.isArray(value) && value.length === 4 &&
    Array.from(value).every((word: unknown) =>
      typeof word === 'number' && Number.isInteger(word) && word >= 0 && word <= 0xffffffff) &&
    ((value[0] & 0x7fffffff) !== 0 || value[1] !== 0 || value[2] !== 0 || value[3] !== 0);
}

export function* searchId6(state: TinyState, minFrame: number, maxFrame: number): Generator<IdResult6> {
  if (!isTinyState6(state)) throw new RangeError('Invalid Gen 6 TinyMT state');
  if (!Number.isInteger(minFrame) || !Number.isInteger(maxFrame) ||
      minFrame < 0 || maxFrame < minFrame || maxFrame > MAX_FRAME) {
    throw new RangeError('Invalid Gen 6 ID frame range');
  }
  const rng = new TinyMT(state);
  for (let i = 0; i < minFrame; i++) rng.next();

  for (let frame = minFrame; frame <= maxFrame; frame++) {
    const before = rng.getState();
    const rand = rng.nextU32();
    const tid = rand & 0xffff;
    const sid = rand >>> 16;
    const xor = tid ^ sid;
    yield { frame, state: before, rand, tid, sid, tsv: xor >>> 4, trv: xor & 0xf };
  }
}
