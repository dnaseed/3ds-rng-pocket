import { modU64 } from '../math/uint';
import { SFMT } from '../rng/sfmt';

export interface QrMatch {
  lastClockFrame: number;
  currentFrameAfterQuit: number;
}

/**
 * Exact port of Gen7MainRNGTool.QRSearch (100% offline).
 * Searches SFMT frames [min..max] for the matching sequence of clock readings (0..16).
 */
export function searchQrFrames(
  seed: number,
  clocks: readonly number[],
  min: number,
  max: number,
): QrMatch[] {
  const length = clocks.length;
  if (length < 2 || min > max) return [];

  const sfmt = new SFMT(seed);
  sfmt.advance(min);

  const tempList = new Int32Array(length);
  for (let i = 0; i < length; i++) {
    const [lo, hi] = sfmt.nextU64Parts();
    tempList[i] = modU64(lo, hi, 17);
  }

  const matches: QrMatch[] = [];
  let head = 0;
  for (let i = min; i <= max; i++) {
    let j = 0;
    for (; j < length; j++) {
      if (tempList[(j + head) % length] !== clocks[j]) {
        break;
      }
    }
    if (j === length) {
      matches.push({
        lastClockFrame: i + length - 1,
        currentFrameAfterQuit: i + length + 1,
      });
    }
    const [lo, hi] = sfmt.nextU64Parts();
    tempList[head++] = modU64(lo, hi, 17);
    if (head === length) head = 0;
  }

  return matches;
}
