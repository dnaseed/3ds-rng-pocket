import { describe, expect, it } from 'vitest';
import { aroundTargetRange6, isWildCalibrationCompatible6 } from '../../src/pages/gen6/searchOptions6';

describe('Gen 6 encounter inputs', () => {
  it('clamps both ends of the Around Target window', () => {
    expect(aroundTargetRange6(0)).toEqual({ minFrame: 0, maxFrame: 100 });
    expect(aroundTargetRange6(500)).toEqual({ minFrame: 400, maxFrame: 600 });
    expect(aroundTargetRange6(1_000_000_000)).toEqual({ minFrame: 999_999_900, maxFrame: 1_000_000_000 });
  });

  it('requires the Wild method and game family to match the calibration', () => {
    const fishing = { method: 'fishing', oras: false } as const;
    expect(isWildCalibrationCompatible6(fishing, 'Fishing', false)).toBe(true);
    expect(isWildCalibrationCompatible6(fishing, 'Fishing', true)).toBe(false);
    expect(isWildCalibrationCompatible6(fishing, 'FriendSafari', false)).toBe(false);
    expect(isWildCalibrationCompatible6({ method: 'instant', oras: false }, 'Fishing', false)).toBe(false);
    expect(isWildCalibrationCompatible6({ method: 'instant', oras: true }, 'DexNav', true)).toBe(true);
    expect(isWildCalibrationCompatible6({ method: 'normal', oras: false }, 'Trap', false)).toBe(true);
  });
});
