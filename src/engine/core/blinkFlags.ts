import { modU64 } from '../math/uint';
import { SFMT } from '../rng/sfmt';

/**
 * Exact TypeScript port of FuncUtil.getblinkflaglist, MarkNoNPCFlag, MarkMultipleNPCFlag.
 * Pure function (allocates and returns Uint8Array instead of mutating static global).
 */
export function getBlinkFlagList(
  min: number,
  max: number,
  sfmt: SFMT,
  modelNumber = 1,
): Uint8Array {
  const len = Math.max(0, max - min + 2);
  const flags = new Uint8Array(len);
  const st = new SFMT(sfmt);
  if (modelNumber === 1) {
    markNoNpcFlag(flags, st, min, max);
  } else {
    markMultipleNpcFlag(flags, st, min, max, modelNumber);
  }
  return flags;
}

function markNoNpcFlag(flags: Uint8Array, st: SFMT, min: number, max: number): void {
  let blinkFlag = 0;
  for (let i = 0; i < min - 2; i++) {
    st.next();
  }
  if (min < 2) {
    for (let i = 0; i < min; i++) {
      st.next();
    }
  } else {
    const [lo1] = st.nextU64Parts();
    if ((lo1 & 0x7f) === 0) {
      const [lo2, hi2] = st.nextU64Parts();
      flags[0] = modU64(lo2, hi2, 3) === 0 ? 36 : 30;
    } else {
      const [lo3] = st.nextU64Parts();
      if ((lo3 & 0x7f) === 0) {
        blinkFlag = 1;
      }
    }
  }

  for (let i = min; i <= max; i++) {
    const [lo, hi] = st.nextU64Parts();
    if (blinkFlag === 1) {
      flags[i - min] = 5;
      flags[++i - min] = modU64(lo, hi, 3) === 0 ? 36 : 30;
      blinkFlag = 0;
      st.next();
    }
    if ((lo & 0x7f) === 0) {
      blinkFlag = 1;
      flags[i - min] = 1;
    }
  }
}

function markMultipleNpcFlag(
  flags: Uint8Array,
  st: SFMT,
  min: number,
  max: number,
  modelNumber: number,
): void {
  const modelN = modelNumber;
  let blinkFlag = 0;
  const unsafe0 = 35 * (modelN - 1);
  const unsafe1 = 41 * (modelN - 1);
  const startMin = Math.max(min - unsafe1, 418);

  for (let i = 0; i < startMin; i++) {
    st.next();
  }

  const bufLen = (modelN - 1) * 5 + 2;
  const loBuf = new Uint32Array(bufLen);
  const hiBuf = new Uint32Array(bufLen);
  for (let i = 0; i < bufLen; i++) {
    const [lo, hi] = st.nextU64Parts();
    loBuf[i] = lo;
    hiBuf[i] = hi;
  }

  let head = 0;
  for (let i = startMin; i <= max; i++) {
    const lo0 = loBuf[head]!;
    if ((lo0 & 0x7f) === 0) {
      if (i >= min) {
        flags[i - min] = blinkFlag === 0 ? 1 : 3;
      }
      blinkFlag = blinkFlag === 0 ? (checkAfter(loBuf, hiBuf, head, bufLen) ? unsafe1 : unsafe0) : unsafe1;
    } else if (blinkFlag > 0) {
      blinkFlag--;
      if (i >= min) {
        flags[i - min] = 2;
      }
    }

    // RemoveAt(0) + Add(nextU64) via circular head advance
    const [nLo, nHi] = st.nextU64Parts();
    loBuf[head] = nLo;
    hiBuf[head] = nHi;
    head++;
    if (head === bufLen) head = 0;
  }
}

function checkAfter(
  loBuf: Uint32Array,
  hiBuf: Uint32Array,
  head: number,
  bufLen: number,
): boolean {
  // Check elements 1 .. bufLen - 2 (Skip(1).Take(Count - 2))
  for (let offset = 1; offset < bufLen - 1; offset++) {
    const idx = (head + offset) % bufLen;
    if ((loBuf[idx]! & 0x7f) === 0) {
      return true;
    }
  }
  // Check Last() % 3 == 0
  const lastIdx = (head + bufLen - 1) % bufLen;
  return modU64(loBuf[lastIdx]!, hiBuf[lastIdx]!, 3) === 0;
}
