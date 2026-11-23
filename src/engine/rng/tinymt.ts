import { formatEggSeedStr } from '../math/uint';
import type { IRng32, TinyState } from './types';

const MAT1 = 0x8f7011ee;
const MAT2 = 0xfc78ff1f;
const TMAT = 0x3793fdff;

const MIN_LOOP = 8;
const PRE_LOOP = 8;

const TINYMT32_MASK = 0x7fffffff;
const TINYMT32_SH0 = 1;
const TINYMT32_SH1 = 10;
const TINYMT32_SH8 = 8;

/**
 * Exact bit-for-bit TypeScript port of Pk3DSRNGTool.RNG.TinyMT.
 */
export class TinyMT implements IRng32 {
  public readonly status: Uint32Array;

  constructor(seedOrState: number | readonly number[] | Uint32Array | TinyMT) {
    this.status = new Uint32Array(4);
    if (seedOrState instanceof TinyMT) {
      this.status.set(seedOrState.status);
    } else if (typeof seedOrState === 'number') {
      this.init(seedOrState);
    } else {
      for (let i = 0; i < 4; i++) {
        this.status[i] = (seedOrState[i] ?? 0) >>> 0;
      }
    }
  }

  public clone(): TinyMT {
    return new TinyMT(this);
  }

  public reseed(seed: number): void {
    this.init(seed);
  }

  public init(seed: number): void {
    const st = this.status;
    st[0] = seed >>> 0;
    st[1] = MAT1;
    st[2] = MAT2;
    st[3] = TMAT;

    for (let i = 1; i < MIN_LOOP; i++) {
      const prev = st[(i - 1) & 3]!;
      const val = (i + Math.imul(1812433253, (prev ^ (prev >>> 30)) >>> 0)) >>> 0;
      st[i & 3] = (st[i & 3]! ^ val) >>> 0;
    }

    this.periodCertification();

    for (let i = 0; i < PRE_LOOP; i++) {
      this.nextState();
    }
  }

  private periodCertification(): void {
    const st = this.status;
    if ((st[0]! & TINYMT32_MASK) === 0 && st[1] === 0 && st[2] === 0 && st[3] === 0) {
      st[0] = 0x54; // 'T'
      st[1] = 0x49; // 'I'
      st[2] = 0x4e; // 'N'
      st[3] = 0x59; // 'Y'
    }
  }

  public nextState(): void {
    const st = this.status;
    let y = st[3]!;
    let x = ((st[0]! & TINYMT32_MASK) ^ st[1]! ^ st[2]!) >>> 0;
    x = (x ^ (x << TINYMT32_SH0)) >>> 0;
    y = (y ^ (y >>> TINYMT32_SH0) ^ x) >>> 0;
    st[0] = st[1]!;
    st[1] = st[2]!;
    st[2] = (x ^ (y << TINYMT32_SH1)) >>> 0;
    st[3] = y;

    if ((y & 1) === 1) {
      st[1] = (st[1]! ^ MAT1) >>> 0;
      st[2] = (st[2]! ^ MAT2) >>> 0;
    }
  }

  public temper(): number {
    const st = this.status;
    let t0 = st[3]!;
    const t1 = (st[0]! + (st[2]! >>> TINYMT32_SH8)) >>> 0;
    t0 = (t0 ^ t1) >>> 0;
    if ((t1 & 1) === 1) {
      t0 = (t0 ^ TMAT) >>> 0;
    }
    return t0 >>> 0;
  }

  public next(): void {
    this.nextState();
  }

  public nextU32(): number {
    this.nextState();
    return this.temper();
  }

  public getState(): TinyState {
    return [this.status[0]!, this.status[1]!, this.status[2]!, this.status[3]!];
  }

  public getStateHex(): string {
    return formatEggSeedStr(this.getState());
  }
}
