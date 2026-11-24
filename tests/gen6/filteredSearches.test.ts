import { describe, expect, it } from 'vitest';
import { createDefaultRngFilter } from '../../src/engine/core/filters';
import { searchEgg6, type Egg6Request } from '../../src/engine/gen6/egg6';
import { searchEvent6, type Event6Request } from '../../src/engine/gen6/event6';

const range = { seed: 0x35b19af2, minFrame: 0, maxFrame: 5200, delay: 0 };
const egg: Egg6Request = {
  ...range, male: [1, 2, 3, 4, 5, 6], female: [7, 8, 9, 10, 11, 12],
  maleItem: 0, femaleItem: 0, ability: 0, ratio: 127, nido: false,
  masuda: false, charm: false, accept: true, tsv: 0, trv: 0, otherTSVs: [],
};
const event: Event6Request = {
  ...range, trainerTSV: 0, oras: false,
  card: {
    species: 25, forme: 0, level: 50, abilityLocked: false, ability: 0,
    natureLocked: false, nature: 0, genderLocked: false, gender: 0,
    ivsCount: 0, ivs: [-1, -1, -1, -1, -1, -1], tid: 0, sid: 0,
    pidType: 0, pid: 0, ec: 0, isEgg: false, yourId: true, otherInfo: true,
  },
};

describe('Gen 6 filtering before the result cap', () => {
  it('finds an Egg match past the first 5,000 frames', () => {
    const [match] = searchEgg6({ ...egg, minFrame: 5200 }).rows;
    expect(match).toBeDefined();
    const filter = createDefaultRngFilter();
    filter.ivLow = [...match!.ivs] as typeof filter.ivLow;
    filter.ivUp = [...filter.ivLow];
    filter.natures[match!.nature] = true;
    const output = searchEgg6({ ...egg, filter });
    expect(output).toEqual({ rows: [match], truncated: false });
    const baseline = searchEgg6(egg);
    expect(baseline).toMatchObject({ truncated: true });
    expect(baseline.rows).toHaveLength(5000);
    expect(searchEgg6({ ...egg, filter: createDefaultRngFilter() })).toEqual(baseline);
    expect(searchEgg6({ ...egg, filter: { ...filter, skip: true } })).toEqual(baseline);
  });

  it('finds an Event match past the first 5,000 frames', () => {
    const [match] = searchEvent6({ ...event, minFrame: 5200 }).rows;
    expect(match).toBeDefined();
    const filter = { ...createDefaultRngFilter(), ivLow: match!.ivs, ivUp: match!.ivs };
    const output = searchEvent6({ ...event, filter });
    expect(output).toEqual({ rows: [match], truncated: false });
    const baseline = searchEvent6(event);
    expect(baseline).toMatchObject({ truncated: true });
    expect(baseline.rows).toHaveLength(5000);
    expect(searchEvent6({ ...event, filter: createDefaultRngFilter() })).toEqual(baseline);
    expect(searchEvent6({ ...event, filter: { ...filter, skip: true } })).toEqual(baseline);
  });
});
