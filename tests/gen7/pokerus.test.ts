import { describe, expect, it } from 'vitest';
import { searchMisc7, type MiscSearchRequest } from '../../src/engine/gen7/misc7';

const request: MiscSearchRequest = {
  seed: 0x35b19af2, startIndex: 0, endIndex: 5000, npcCount: 0, delayFrames: 0, settings: { kind: 'pokerus' },
};

describe('Pokérus Gen 7', () => {
  // Golden rows read in 3DS RNG Tool v1.0.6, Misc → Pokerus, G7 SFMT (64bit).
  it('matches the index, strain and random number without delay', () => {
    expect(searchMisc7(request).rows).toEqual([
      { index: 4220, actualIndex: 4220, result: { kind: 'pokerus', strain: 2 }, randomNumber: 'C83B541B83BF4000' },
    ]);
  });

  it('matches with two NPCs and eight frames of delay', () => {
    expect(searchMisc7({ ...request, npcCount: 2, delayFrames: 8 }).rows).toEqual([
      { index: 4208, actualIndex: 4220, result: { kind: 'pokerus', strain: 2 }, randomNumber: 'F021DC7F1B35BC3C' },
    ]);
  });

  it('includes the last index and returns no infections immediately before it', () => {
    expect(searchMisc7({ ...request, startIndex: 4219, endIndex: 4220 }).rows.map(row => row.index)).toEqual([4220]);
    expect(searchMisc7({ ...request, startIndex: 4219, endIndex: 4219 }).rows).toEqual([]);
  });
});
