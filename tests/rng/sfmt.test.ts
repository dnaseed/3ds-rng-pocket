import { describe, expect, it } from 'vitest';
import { SFMT, SFMT_N, SFMT_N32 } from '../../src/engine/rng/sfmt';

// Official Saito & Matsumoto SFMT.19937.out.txt (init_gen_rand(1234), 32-bit outputs)
const OFFICIAL_1234_FIRST_30 = [
  3440181298, 1564997079, 1510669302, 2930277156, 1452439940,
  3796268453, 423124208, 2143818589, 3827219408, 2987036003,
  2674978610, 1536842514, 2027035537, 2534897563, 1686527725,
  545368292, 1489013321, 1370534252, 4231012796, 3994803019,
  1764869045, 824597505, 862581900, 2469764249, 812862514,
  359318673, 116957936, 3367389672, 2327178354, 1898245200,
];

// Indices 620..629 from SFMT.19937.out.txt (crosses N32 = 624 refill boundary)
const OFFICIAL_1234_620_TO_629 = [
  727244906, 4255738067, 1214133513, 2570786021, 3899704621,
  1633861986, 1636979509, 1438500431, 58463278, 2823485629,
];

/**
 * Independent 128-bit BigInt reference implementation of SFMT-19937
 * to cross-verify all 32-bit lane bit-shifts and overflows.
 */
class SfmtBigIntOracle {
  private readonly state = new Array<bigint>(SFMT_N).fill(0n);
  private idx = SFMT_N32;

  constructor(seed: number) {
    const words = new Array<bigint>(SFMT_N32);
    words[0] = BigInt(seed >>> 0);
    for (let i = 1; i < SFMT_N32; i++) {
      const prev = words[i - 1]!;
      words[i] = (1812433253n * (prev ^ (prev >> 30n)) + BigInt(i)) & 0xffffffffn;
    }
    const parity = [1n, 0n, 0n, 0x13c9e684n];
    let inner = 0n;
    for (let i = 0; i < 4; i++) inner ^= words[i]! & parity[i]!;
    for (let s = 16n; s > 0n; s >>= 1n) inner ^= inner >> s;
    if ((inner & 1n) === 0n) {
      outer: for (let i = 0; i < 4; i++) {
        let w = 1n;
        for (let j = 0; j < 32; j++) {
          if ((w & parity[i]!) !== 0n) {
            words[i] = (words[i]! ^ w) & 0xffffffffn;
            break outer;
          }
          w <<= 1n;
        }
      }
    }
    for (let i = 0; i < SFMT_N; i++) {
      this.state[i] =
        words[4 * i]! |
        (words[4 * i + 1]! << 32n) |
        (words[4 * i + 2]! << 64n) |
        (words[4 * i + 3]! << 96n);
    }
  }

  private static readonly MASK128 = (1n << 128n) - 1n;
  private static readonly MSK128 =
    0xdfffffefn | (0xddfecb7fn << 32n) | (0xbffaffffn << 64n) | (0xbffffff6n << 96n);

  private refill(): void {
    const p = this.state;
    let r1 = p[SFMT_N - 2]!;
    let r2 = p[SFMT_N - 1]!;
    for (let i = 0; i < SFMT_N - 122; i++) {
      p[i] = SfmtBigIntOracle.doRecursion(p[i]!, p[i + 122]!, r1, r2);
      r1 = r2;
      r2 = p[i]!;
    }
    for (let i = SFMT_N - 122; i < SFMT_N; i++) {
      p[i] = SfmtBigIntOracle.doRecursion(p[i]!, p[i + 122 - SFMT_N]!, r1, r2);
      r1 = r2;
      r2 = p[i]!;
    }
  }

  private static doRecursion(a: bigint, b: bigint, c: bigint, d: bigint): bigint {
    const x = (a << 8n) & SfmtBigIntOracle.MASK128;
    const y = c >> 8n;
    // Per-32-bit-lane right shift 11 + & MSK
    let bShift = 0n;
    for (let lane = 0n; lane < 4n; lane++) {
      const word = (b >> (lane * 32n)) & 0xffffffffn;
      bShift |= (word >> 11n) << (lane * 32n);
    }
    // Per-32-bit-lane left shift 18
    let dShift = 0n;
    for (let lane = 0n; lane < 4n; lane++) {
      const word = (d >> (lane * 32n)) & 0xffffffffn;
      dShift |= ((word << 18n) & 0xffffffffn) << (lane * 32n);
    }
    return a ^ x ^ (bShift & SfmtBigIntOracle.MSK128) ^ y ^ dShift;
  }

  public nextU32(): number {
    if (this.idx >= SFMT_N32) {
      this.refill();
      this.idx = 0;
    }
    const lane = BigInt(this.idx & 3);
    const word = (this.state[this.idx >> 2]! >> (lane * 32n)) & 0xffffffffn;
    this.idx++;
    return Number(word);
  }
}

describe('SFMT-19937 PRNG', () => {
  it('matches official Saito & Matsumoto SFMT.19937.out.txt for seed 1234', () => {
    const sfmt = new SFMT(1234);
    const actualFirst30: number[] = [];
    for (let i = 0; i < 30; i++) {
      actualFirst30.push(sfmt.nextU32());
    }
    expect(actualFirst30).toEqual(OFFICIAL_1234_FIRST_30);

    for (let i = 30; i < 620; i++) {
      sfmt.nextU32();
    }
    const actualBoundary: number[] = [];
    for (let i = 620; i < 630; i++) {
      actualBoundary.push(sfmt.nextU32());
    }
    expect(actualBoundary).toEqual(OFFICIAL_1234_620_TO_629);
  });

  it('matches independent 128-bit BigInt SFMT oracle across critical edge seeds', () => {
    const seeds = [0x00000000, 0x00000001, 0x12345678, 0x80000000, 0xdeadbeef, 0xffffffff];
    for (const seed of seeds) {
      const sfmt = new SFMT(seed);
      const oracle = new SfmtBigIntOracle(seed);
      for (let i = 0; i < 2000; i++) {
        expect(sfmt.nextU32()).toBe(oracle.nextU32());
      }
    }
  });

  it('produces identical 64-bit lo/hi parts, BigInt values, clone(), and advance()', () => {
    const a = new SFMT(0xdeadbeef);
    a.advance(478); // USUM starting frame
    const b = a.clone();

    for (let i = 0; i < 100; i++) {
      const [lo, hi] = a.nextU64Parts();
      const big = b.nextU64BigInt();
      expect((BigInt(hi) << 32n) | BigInt(lo)).toBe(big);
    }
  });
});
