import type { IRng64 } from './types';

const MEXP = 19937;
const POS1 = 122;
const SL1 = 18;
const SR1 = 11;
const MSK1 = 0xdfffffef;
const MSK2 = 0xddfecb7f;
const MSK3 = 0xbffaffff;
const MSK4 = 0xbffffff6;
const PARITY = new Uint32Array([1, 0, 0, 0x13c9e684]);

export const SFMT_N = Math.floor(MEXP / 128) + 1; // 156
export const SFMT_N32 = 4 * SFMT_N; // 624

/**
 * Exact bit-for-bit TypeScript port of Pk3DSRNGTool.RNG.SFMT (SFMT-19937).
 */
export class SFMT implements IRng64 {
  public readonly sfmt: Uint32Array;
  public idx: number;

  constructor(seedOrSource: number | SFMT) {
    this.sfmt = new Uint32Array(SFMT_N32);
    if (seedOrSource instanceof SFMT) {
      this.sfmt.set(seedOrSource.sfmt);
      this.idx = seedOrSource.idx;
    } else {
      this.idx = SFMT_N32;
      this.initGenRand(seedOrSource);
    }
  }

  public clone(): SFMT {
    return new SFMT(this);
  }

  public reseed(seed: number): void {
    this.initGenRand(seed);
  }

  public initGenRand(seed: number): void {
    const p = this.sfmt;
    p[0] = seed >>> 0;
    for (let i = 1; i < SFMT_N32; i++) {
      const prev = p[i - 1]!;
      p[i] = (Math.imul(1812433253, (prev ^ (prev >>> 30)) >>> 0) + i) >>> 0;
    }
    this.periodCertification();
    this.idx = SFMT_N32;
  }

  private periodCertification(): void {
    const p = this.sfmt;
    let inner = 0;
    for (let i = 0; i < 4; i++) {
      inner = (inner ^ (p[i]! & PARITY[i]!)) >>> 0;
    }
    for (let i = 16; i > 0; i >>>= 1) {
      inner = (inner ^ (inner >>> i)) >>> 0;
    }
    inner &= 1;
    if (inner === 1) return;

    for (let i = 0; i < 4; i++) {
      let work = 1;
      const parity = PARITY[i]!;
      for (let j = 0; j < 32; j++) {
        if ((work & parity) !== 0) {
          p[i] = (p[i]! ^ work) >>> 0;
          return;
        }
        work = (work << 1) >>> 0;
      }
    }
  }

  private genRandAll19937(): void {
    const p = this.sfmt;
    let a = 0;
    let b = POS1 * 4;
    let c = (SFMT_N - 2) * 4;
    let d = (SFMT_N - 1) * 4;

    do {
      p[a + 3] =
        p[a + 3]! ^
        (p[a + 3]! << 8) ^
        (p[a + 2]! >>> 24) ^
        (p[c + 3]! >>> 8) ^
        ((p[b + 3]! >>> SR1) & MSK4) ^
        (p[d + 3]! << SL1);
      p[a + 2] =
        p[a + 2]! ^
        (p[a + 2]! << 8) ^
        (p[a + 1]! >>> 24) ^
        (p[c + 3]! << 24) ^
        (p[c + 2]! >>> 8) ^
        ((p[b + 2]! >>> SR1) & MSK3) ^
        (p[d + 2]! << SL1);
      p[a + 1] =
        p[a + 1]! ^
        (p[a + 1]! << 8) ^
        (p[a]! >>> 24) ^
        (p[c + 2]! << 24) ^
        (p[c + 1]! >>> 8) ^
        ((p[b + 1]! >>> SR1) & MSK2) ^
        (p[d + 1]! << SL1);
      p[a] =
        p[a]! ^
        (p[a]! << 8) ^
        (p[c + 1]! << 24) ^
        (p[c]! >>> 8) ^
        ((p[b]! >>> SR1) & MSK1) ^
        (p[d]! << SL1);
      c = d;
      d = a;
      a += 4;
      b += 4;
      if (b >= SFMT_N32) b = 0;
    } while (a < SFMT_N32);
  }

  public nextU32(): number {
    if (this.idx >= SFMT_N32) {
      this.genRandAll19937();
      this.idx = 0;
    }
    return this.sfmt[this.idx++]!;
  }

  public nextU64Parts(): [lo: number, hi: number] {
    const lo = this.nextU32();
    const hi = this.nextU32();
    return [lo, hi];
  }

  public nextU64BigInt(): bigint {
    const lo = this.nextU32();
    const hi = this.nextU32();
    return (BigInt(hi) << 32n) | BigInt(lo);
  }

  public next(): void {
    this.nextU32();
    this.nextU32();
  }

  public advance(frames: number): void {
    for (let i = 0; i < frames; i++) {
      this.next();
    }
  }
}
