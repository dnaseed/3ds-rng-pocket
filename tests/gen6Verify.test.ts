import { describe, expect, it } from 'vitest';
import { verifyOrFixSeedWithMt, verifyOrFixTinyMt } from '../src/services/gen6Verify';
import { parseOverlay6WithStates } from '../src/services/overlayParser';
import { buildConfusionRanked } from '../src/services/sfmtVerify';

describe('gen6Verify', () => {
  it('verifies exact MT19937 seed and frame against real ORAS values', () => {
    for (const [adv, curr] of [
      [636, 'E1A6EA76'],
      [944, '8489DD11'],
      [2693, '8ADD5A30'],
    ] as const) {
      const res = verifyOrFixSeedWithMt(buildConfusionRanked('BFD5C269'), curr, adv);
      expect(res.verified).toBe(true);
      expect(res.exact).toBe(true);
      expect(res.corrected).toBe(false);
      expect(res.seed).toBe('BFD5C269');
      expect(res.frame).toBe(String(adv));
      expect(res.matchedNibbles).toBe(8);
    }
  });

  it('auto-corrects 8<->B and 0<->D confusion in MT seed', () => {
    const res = verifyOrFixSeedWithMt(buildConfusionRanked('8FD5C269'), 'E1A6EA76', 636);
    expect(res.verified).toBe(true);
    expect(res.exact).toBe(true);
    expect(res.corrected).toBe(true);
    expect(res.seed).toBe('BFD5C269');
  });

  it('recovers exact TinyMT state even with 8<->B confusion and missing Advances', () => {
    const tiny = verifyOrFixTinyMt(
      buildConfusionRanked('AD317180'), // 0->8 confusion in Tiny u32 seed
      ['E70D76F1', '56D2B5D9', '2DF7BD8E', 'FE51994C'],
      ['DD70BFCA', 'EE79358E', '1B379D8E', '5667232D'],
      [], // simulate obstructed Advances: 3
    );
    expect(tiny).not.toBeNull();
    expect(tiny!.verified).toBe(true);
    expect(tiny!.exact).toBe(true);
    expect(tiny!.tinyAdvances).toBe(3);
    expect([tiny!.tiny3, tiny!.tiny2, tiny!.tiny1, tiny!.tiny0]).toEqual([
      'DD70BFCA',
      'EE79358E',
      '1B379D8E',
      '5667232D',
    ]);
  });

  it('parses Gen 6 RNG full view, compact view, and Daycare view', () => {
    const full = parseOverlay6WithStates(`
      Unlock X+Y
      Init seed: BFD5C269
      Curr state: E1A6EA76
      MT Advances: 636
      Tiny u32 seed: AD3171B0
      Advances: 3
      TinyMT seed:
      [3]E70D76F1 [2]56D2B5D9
      [1]2DF7BD8E [0]FE51994C
      TinyMT state:
      [3]DD70BFCA [2]EE79358E
      [1]1B379D8E [0]5667232D
    `);
    expect(full.fields.seed).toBe('BFD5C269');
    expect(full.currState).toBe('E1A6EA76');
    expect(full.fields.frame).toBe('636');
    expect(full.tinyU32).toBe('AD3171B0');
    expect(full.tinyAdvances).toBe('3');
    expect(full.fields.tiny3).toBe('DD70BFCA');
    expect(full.fields.tiny0).toBe('5667232D');

    const compact = parseOverlay6WithStates(`
      Init seed: BFD5C269
      Curr state: 8ADD5A30
      MT Advances: 2693
      Save var: 12A4155F
    `);
    expect(compact.fields).toEqual({ seed: 'BFD5C269', frame: '2693' });
    expect(compact.currState).toBe('8ADD5A30');

    const daycare = parseOverlay6WithStates(`
      Egg Ready: false
      Par1: None
      Par2: None
      Egg[1]: 9E966527
      Egg[0]: 5061C1D0
      Masuda Method: false
    `);
    expect(daycare.fields).toEqual({ egg1: '9E966527', egg0: '5061C1D0' });
  });
});
