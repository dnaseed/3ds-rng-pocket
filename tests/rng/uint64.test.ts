import { describe, expect, it } from 'vitest';
import { add32, imul32, modU64, modU64BigInt, parseHex32, toHex64, u32 } from '../../src/engine/math/uint';
import { SFMT } from '../../src/engine/rng/sfmt';

describe('Unsigned 32-bit and 64-bit arithmetic parity', () => {
  it('matches BigInt 64-bit modulo across 100,000 SFMT outputs for all Gen 7 divisors', () => {
    const divisors = [3, 6, 17, 25, 60, 90, 100, 252];
    const sfmt = new SFMT(0x89abcdef);
    for (let i = 0; i < 100_000; i++) {
      const [lo, hi] = sfmt.nextU64Parts();
      for (const m of divisors) {
        expect(modU64(lo, hi, m)).toBe(modU64BigInt(lo, hi, m));
      }
    }
  }, 20_000);

  it('matches BigInt 64-bit modulo on extreme 64-bit boundary pairs', () => {
    const pairs: [number, number][] = [
      [0, 0],
      [0xffffffff, 0],
      [0, 1],
      [0, 0x80000000],
      [0xffffffff, 0x7fffffff],
      [0xffffffff, 0xffffffff],
      [0x80000000, 0x80000000],
      [0x12345678, 0x9abcdef0],
    ];
    const divisors = [3, 6, 17, 25, 60, 90, 100, 252, 1000000];
    for (const [lo, hi] of pairs) {
      for (const m of divisors) {
        expect(modU64(lo, hi, m)).toBe(modU64BigInt(lo, hi, m));
      }
    }
  });

  it('handles 32-bit unsigned overflow identically to C# uint', () => {
    expect(imul32(1812433253, 0xffffffff)).toBe(
      Number((1812433253n * 0xffffffffn) & 0xffffffffn),
    );
    expect(add32(0xffffffff, 5)).toBe(4);
    expect(u32(-1)).toBe(0xffffffff);
    expect(toHex64(0x00abcdef, 0x12340000)).toBe('1234000000ABCDEF');
    expect(parseHex32('deadbeef')).toBe(0xdeadbeef);
    expect(parseHex32('zzzz')).toBeNull();
  });
});
