import { describe, expect, it } from 'vitest';
import { MT19937 } from '../../src/engine/rng/mt19937';

// NumPy RandomState MT19937 uint32 vectors, with zero-based indices around the block boundary.
const indices = [0, 1, 2, 3, 4, 622, 623, 624, 625, 629];
const vectors = [
  {
    name: 'scalar seed',
    seed: 5489,
    values: [3499211612, 581869302, 3890346734, 3586334585, 545404204, 2227348307, 4020325887, 4178893912, 610818241, 2030369078],
  },
  {
    name: 'canonical array seed',
    seed: [0x123, 0x234, 0x345, 0x456],
    values: [1067595299, 955945823, 477289528, 4107218783, 4228976476, 853571438, 144400272, 3768408841, 782634401, 14249488],
  },
  {
    name: 'two-word egg-style key',
    seed: [0x35b19af2, 0xffffffff],
    values: [1228391419, 2862084007, 2980073130, 4048273119, 2739527894, 2256972125, 548114121, 3458649636, 3434726918, 232053013],
  },
];

describe('MT19937', () => {
  it.each(vectors)('matches the independent $name vector', ({ seed, values }) => {
    const rng = new MT19937(seed);
    const outputs = Array.from({ length: 630 }, () => rng.nextU32());
    expect(indices.map(index => outputs[index])).toEqual(values);
  });

  it.each(vectors)('advances across a block for a $name', ({ seed, values }) => {
    const rng = new MT19937(seed);
    rng.advance(623);
    expect(rng.nextU32()).toBe(values[6]);
    expect(rng.nextU32()).toBe(values[7]);
  });
});
