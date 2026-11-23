import { modU64 } from '../math/uint';
import type { IdResult7 } from '../core/types';

/**
 * Exact TypeScript port of Pk3DSRNGTool.ID7.
 */
export function makeId7(frame: number, lo: number, hi: number): IdResult7 {
  const tmp = lo >>> 0;
  const tid = tmp & 0xffff;
  const sid = (tmp >>> 16) & 0xffff;
  const tsv = ((tid ^ sid) >>> 4) & 0xfff;
  const trv = (tid ^ sid) & 0xf;
  const g7tid = tmp % 1_000_000;
  const clock = modU64(lo, hi, 17);

  return {
    frame,
    tid,
    sid,
    tsv,
    trv,
    g7tid,
    clock,
    randLo: lo >>> 0,
    randHi: hi >>> 0,
  };
}
