import { describe, expect, it } from 'vitest';
import { TinyMT } from '../../src/engine/rng/tinymt';
import { formatEggSeedStr, parseEggSeedStr } from '../../src/engine/math/uint';

// Official RFC 8682 / TinyMT32 check32.out.txt test vector for tinymt32_init(1)
const RFC8682_SEED_1_FIRST_50 = [
  2545341989, 981918433, 3715302833, 2387538352, 3591001365,
  3820442102, 2114400566, 2196103051, 2783359912, 764534509,
  643179475, 1822416315, 881558334, 4207026366, 3690273640,
  3240535687, 2921447122, 3984931427, 4092394160, 44209675,
  2188315343, 2908663843, 1834519336, 3774670961, 3019990707,
  4065554902, 1239765502, 4035716197, 3412127188, 552822483,
  161364450, 353727785, 140085994, 149132008, 2547770827,
  4064042525, 4078297538, 2057335507, 622384752, 2041665899,
  2193913817, 1080849512, 33160901, 662956935, 642999063,
  3384709977, 1723175122, 3866752252, 521822317, 2292524454,
];

describe('TinyMT32 PRNG', () => {
  it('matches all 50 official RFC 8682 check32.out.txt outputs for seed 1', () => {
    const tiny = new TinyMT(1);
    const out: number[] = [];
    for (let i = 0; i < 50; i++) {
      out.push(tiny.nextU32());
    }
    expect(out).toEqual(RFC8682_SEED_1_FIRST_50);
  });

  it('handles zero-state periodCertification -> TINY and preserves 32-bit unsigned domain', () => {
    const tiny = new TinyMT([0x80000000, 0, 0, 0]);
    tiny.init(0);
    for (let i = 0; i < 100; i++) {
      const v = tiny.nextU32();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('round-trips Egg Seed hex formatting (St3,St2,St1,St0) and cloning', () => {
    const tiny = new TinyMT(0x12345678);
    const hex = tiny.getStateHex();
    const parsed = parseEggSeedStr(hex);
    expect(parsed).not.toBeNull();
    expect(formatEggSeedStr(parsed!)).toBe(hex);

    const tinyFromState = new TinyMT(parsed!);
    const cloned = tiny.clone();
    for (let i = 0; i < 30; i++) {
      const a = tiny.nextU32();
      expect(tinyFromState.nextU32()).toBe(a);
      expect(cloned.nextU32()).toBe(a);
    }
  });
});
