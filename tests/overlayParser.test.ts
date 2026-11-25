import { describe, expect, it } from 'vitest';
import { parseOverlay, parseOverlayWithStates } from '../src/services/overlayParser';
import { parseEggSeedStr } from '../src/engine/math/uint';

describe('overlay parser', () => {
  it('reads RNG seed and frame while ignoring trainer and NPC lines', () => {
    expect(
      parseOverlay(
        'Unlock X+Y\nSeed: 42FD750A\nState[1]: DBABE468\nAdvances: 478\nGen7TID: 711306\nTSV: 1712, TRV: 2\nNPC count: 0',
      ),
    ).toEqual({
      seed: '42FD750A',
      frame: '478',
    });
  });

  it('extracts State[1] and State[0] for SFMT fallback verification', () => {
    const parsed = parseOverlayWithStates(
      'Seed: A8ED069B\nState[1]: 260E6886\nState[0]: 6913053B\nAdvances: 478',
    );
    expect(parsed.fields).toEqual({ seed: 'A8ED069B', frame: '478' });
    expect(parsed.state1).toBe('260E6886');
    expect(parsed.state0).toBe('6913053B');
  });

  it('handles noisy State[1]/State[0] labels from OCR', () => {
    const parsed = parseOverlayWithStates(
      'Seed: 42FD750A\nStatel1): 38BC45B3\nStatel@l: @E4 70103\nAdvances: 482',
    );
    expect(parsed.state1).toBe('38BC45B3');
    expect(parsed.state0).toBe('0E470103');
  });

  it('maps indexed Daycare words independent of line order', () => {
    const f = parseOverlay(
      'Egg Ready: false\nEgg ( 2 ): EA1BAB19\nEgg[0]: 71DD47DC\nEgg [3]: O6AS9238\nEgg[l]: bad\nEgg[1]: O42EOCB9',
    );
    expect(parseEggSeedStr([f.egg3, f.egg2, f.egg1, f.egg0].join(','))).toEqual([
      0x71dd47dc, 0x042e0cb9, 0xea1bab19, 0x06a59238,
    ]);
  });

  it.each(['Init Seed', 'Initial Seed', 'Seed'])(
    'reads %s and corrects numeric substitutions',
    (label) => {
      expect(parseOverlay(label + ':\nOIlSABCD\nCurrent Frame: lO5')).toEqual({
        seed: '0115ABCD',
        frame: '105',
      });
    },
  );

  it.each(['Curr Frame', 'MT Frame'])('accepts %s', (label) => {
    expect(parseOverlay(label + ': 0')).toEqual({ frame: '0' });
  });

  it('ignores menu and out-of-range or truncated seed fields', () => {
    expect(
      parseOverlay(
        'RNG\n> Daycare\nWild\nVer 0.7.4-fade01\nSeed: 12345\nGen7TID: 711306\nTSV: 1712, TRV: 2',
      ),
    ).toEqual({});
  });

  it('recovers damaged Daycare labels inside the parent and charm boundaries', () => {
    const block =
      'Par2: None\nEssf3)\n06A59238\nEsst@1>\nEA1BAB19\nEsat1i:\n042E0CB9\nEsot@1:\n71DD47DC';
    expect(parseOverlay(block + '\nShiny Charm: false')).toEqual({
      egg3: '06A59238',
      egg2: 'EA1BAB19',
      egg1: '042E0CB9',
      egg0: '71DD47DC',
    });
    expect(parseOverlay(block)).toEqual({});
    expect(
      parseOverlay(block.replace('EA1BAB19', 'EA1BAB119') + '\nMasuda Method: false'),
    ).toEqual({ egg3: '06A59238', egg1: '042E0CB9', egg0: '71DD47DC' });
  });
});
