import { describe, expect, it } from 'vitest';
import { BERRY_PILES, ROTO_POWERS } from '../../src/data/miscGen7';
import { searchMisc7, type MiscSettings } from '../../src/engine/gen7/misc7';

// Captured in the v1.0.6 executable. Starting Index 478, Max Results 4, Ultra Sun.
const input = { seed: 0x35b19af2, startIndex: 478, endIndex: 482, npcCount: 0 };
const run = (settings: MiscSettings, delayFrames = 0) => searchMisc7({ ...input, settings, delayFrames }).rows;

describe('Misc RNG Gen 7 against 3DS RNG Tool v1.0.6', () => {
  it('matches Festival Plaza facilities and the five-star filter', () => {
    const settings = { kind: 'festival', game: 'US', rank: 18, filters: {} } as const;
    expect(run(settings).map(({ result }) => result)).toEqual([
      { kind: 'festival', facility: 4, stars: 4, npc: 0, color: 0 },
      { kind: 'festival', facility: 14, stars: 3, npc: 8, color: 0 },
      { kind: 'festival', facility: 29, stars: 3, npc: 10, color: 1 },
      { kind: 'festival', facility: 31, stars: 5, npc: 8, color: 1 },
      { kind: 'festival', facility: 0, stars: 5, npc: 6, color: 1 },
    ]);
    expect(run({ ...settings, filters: { stars: 5 } }).map(({ index }) => index)).toEqual([481, 482]);
  });

  it('matches Battle Tree normal and special trainer rolls and trainer ID filtering', () => {
    const settings = { kind: 'battleTree', game: 'US', streak: 9 } as const;
    const trainer = ({ result }: ReturnType<typeof run>[number]) => result.kind === 'battleTree' ? result.trainerId : -1;
    expect(run(settings).map(trainer)).toEqual([44, 21, 6, 30, 38]);
    expect(run({ ...settings, streak: 10 }).map(trainer)).toEqual([194, 192, 197, 205, 197]);
    expect(run({ ...settings, streak: 10, trainerId: 197 }).map(({ index }) => index)).toEqual([480, 482]);
  });

  it.each([
    ['S', [4, 10, 21, 31, 0], [196, 201, 197, 195, 199]],
    ['M', [4, 10, 21, 31, 0], [196, 202, 198, 195, 200]],
    ['UM', [4, 14, 29, 31, 0], [194, 192, 198, 205, 198]],
  ] as const)('matches Festival Plaza and Battle Tree on %s', (game, facilities, specialTrainers) => {
    const festival = run({ kind: 'festival', game, rank: 18, filters: {} });
    expect(festival.map(({ index, result }) => result.kind === 'festival'
      ? [index, result.facility, result.stars, result.npc, result.color] : null)).toEqual([
      [478, facilities[0], 4, 0, 0], [479, facilities[1], 3, 8, 0], [480, facilities[2], 3, 10, 1],
      [481, facilities[3], 5, 8, 1], [482, facilities[4], 5, 6, 1],
    ]);
    for (const [streak, trainerIds] of [[9, [44, 21, 6, 30, 38]], [10, specialTrainers]] as const) {
      expect(run({ kind: 'battleTree', game, streak }).map(({ index, result }) => result.kind === 'battleTree'
        ? [index, result.trainerId] : null)).toEqual(trainerIds.map((id, i) => [478 + i, id]));
    }
  });

  it('matches Roto Loto and berry rolls with the appropriate delays', () => {
    expect(run({ kind: 'rotoLoto' }).map(({ result }) => result)).toEqual([
      { kind: 'rotoLoto', roll: 9 }, { kind: 'rotoLoto', roll: 8 }, { kind: 'rotoLoto', roll: 0 },
      { kind: 'rotoLoto', roll: 4 }, { kind: 'rotoLoto', roll: 2 },
    ]);
    expect(ROTO_POWERS).toEqual(['Boost', 'Hatch', 'Bargain', 'Prize Money', 'Exp. Points', 'Friendship',
      'Encounter', 'Stealth', 'HP Restore', 'PP Restore', 'Catch']);
    expect(BERRY_PILES[1].berries).toEqual(['Chesto', 'Chesto', 'Oran', 'Persim', 'Leppa', 'Leppa']);
    expect(BERRY_PILES[1].first).toBe('Sitrus');
    const berries = { kind: 'berries', location: 1 } as const;
    expect(run(berries, 8).map(({ actualIndex, result }) => [actualIndex, result])).toEqual([
      [482, { kind: 'berries', roll: 0, berry: 'Chesto' }], [483, { kind: 'berries', roll: 1, berry: 'Chesto' }],
      [484, { kind: 'berries', roll: 2, berry: 'Oran' }], [485, { kind: 'berries', roll: 4, berry: 'Leppa' }],
      [486, { kind: 'berries', roll: 0, berry: 'Chesto' }],
    ]);
    expect(run({ ...berries, target: 'Chesto' }, 8).map(({ index }) => index)).toEqual([478, 479, 482]);
  });

  it('marks a result limit only when an additional match exists', () => {
    const settings = { kind: 'rotoLoto' } as const;
    const scan = (endIndex: number) => searchMisc7({ ...input, settings, startIndex: 0, endIndex, delayFrames: 0 });
    expect(scan(4999).truncated).toBe(false);
    expect(scan(5000)).toMatchObject({ truncated: true });
    expect(scan(5000).rows).toHaveLength(5000);
  });
});
