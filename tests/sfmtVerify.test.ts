import { describe, expect, it } from 'vitest';
import glyphs from '../src/services/pokeReaderGlyphs.json';
import { readDaycareFromAnchor, readRngFromAnchor } from '../src/services/pokeReaderNcc';
import { buildConfusionRanked, verifyOrFixSeedWithSfmt } from '../src/services/sfmtVerify';

function overlayFixture(lines: [number, number, string][], slope = 0) {
  const width = 224;
  const height = 128;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  for (const [x, y, text] of lines) {
    [...text].forEach((character, column) => {
      const cell = glyphs[character as keyof typeof glyphs][0]!;
      const yShift = Math.round(x * slope + column * 8 * slope);
      for (let pixel = 0; pixel < 64; pixel++) {
        const py = y + yShift + Math.floor(pixel / 8);
        const px = x + column * 8 + (pixel % 8);
        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        const offset = (py * width + px) * 4;
        data.fill(Number.parseInt(cell[pixel]!, 16) * 17, offset, offset + 3);
      }
    });
  }
  return { width, height, data } as ImageData;
}

describe('SFMT verification & auto-correction', () => {
  it('verifies exact PokeReader vectors 42FD750A @ 478 and A8ED069B @ 478', () => {
    const r1 = verifyOrFixSeedWithSfmt(buildConfusionRanked('42FD750A'), 'DBABE468', '6BDEC797', 478);
    expect(r1).toEqual({
      seed: '42FD750A',
      verified: true,
      exact: true,
      corrected: false,
      matchedNibbles: 16,
    });

    const r2 = verifyOrFixSeedWithSfmt(buildConfusionRanked('A8ED069B'), '260E6886', '6913053B', 478);
    expect(r2).toEqual({
      seed: 'A8ED069B',
      verified: true,
      exact: true,
      corrected: false,
      matchedNibbles: 16,
    });
  });

  it('distinguishes probable (14/16) matches from exact (16/16) matches', () => {
    const partial = verifyOrFixSeedWithSfmt(
      buildConfusionRanked('42FD750A'),
      'DBABE4FF',
      '6BDEC797',
      478,
    );
    expect(partial.verified).toBe(true);
    expect(partial.exact).toBe(false);
    expect(partial.matchedNibbles).toBe(14);
  });

  it('respects time budget on high-advance inconsistent states', () => {
    const t0 = Date.now();
    const res = verifyOrFixSeedWithSfmt(
      buildConfusionRanked('42FD750A'),
      '11111111',
      '22222222',
      45000,
      1024,
      15,
    );
    expect(Date.now() - t0).toBeLessThan(200);
    expect(res.verified).toBe(false);
    expect(res.exact).toBe(false);
  });

  it.each(['A5EDEE9B', 'ABEDBE9B', 'ABED569B'])(
    'auto-corrects noisy Tesseract seed %s back to A8ED069B',
    (noisy) => {
      const res = verifyOrFixSeedWithSfmt(
        buildConfusionRanked(noisy),
        '260E6886',
        '6913053B',
        478,
        1024,
      );
      expect(res.seed).toBe('A8ED069B');
      expect(res.verified).toBe(true);
      expect(res.corrected).toBe(true);
      expect(res.matchedNibbles).toBe(16);
    },
  );

  it('rejects false positives when State is wrong or advances is out of range', () => {
    const wrongState = verifyOrFixSeedWithSfmt(
      buildConfusionRanked('42FD750A'),
      '11111111',
      '22222222',
      478,
    );
    expect(wrongState.verified).toBe(false);
    expect(wrongState.corrected).toBe(false);

    const outOfRange = verifyOrFixSeedWithSfmt(
      buildConfusionRanked('42FD750A'),
      'DBABE468',
      '6BDEC797',
      50001,
    );
    expect(outOfRange.verified).toBe(false);
  });
});

describe('PokeReader NCC anchor readers', () => {
  const guide = { x: 96, y: 12, width: 64, height: 8 };

  it('reads and SFMT-verifies synthetic RNG overlay', () => {
    const image = overlayFixture([
      [16, 12, 'Seed:'],
      [96, 12, '42FD750A'],
      [96, 24, 'DBABE468'],
      [96, 36, '6BDEC797'],
      [96, 48, '478'],
    ]);
    const res = readRngFromAnchor(image, guide);
    expect(res).not.toBeNull();
    expect(res!.seed).toBe('42FD750A');
    expect(res!.verified).toBe(true);
    expect(res!.frame).toBe('478');
  });

  it('reads synthetic Daycare overlay in display order', () => {
    const image = overlayFixture([
      [32, 12, 'Egg[3]:'],
      [96, 12, '06A59238'],
      [96, 24, 'EA1BAB19'],
      [96, 36, '042E0CB9'],
      [96, 48, '71DD47DC'],
    ]);
    const res = readDaycareFromAnchor(image, guide);
    expect(res).toMatchObject({
      egg3: '06A59238',
      egg2: 'EA1BAB19',
      egg1: '042E0CB9',
      egg0: '71DD47DC',
    });
  });

  it('compensates tilted RNG overlay (slope = 0.06) and verifies via SFMT', () => {
    const slope = 0.06;
    const image = overlayFixture(
      [
        [16, 12, 'Seed:'],
        [96, 12, '42FD750A'],
        [96, 24, 'DBABE468'],
        [96, 36, '6BDEC797'],
        [96, 48, '478'],
      ],
      slope,
    );
    const res = readRngFromAnchor(image, {
      x: 96,
      y: 12 + Math.round(96 * slope),
      width: 64,
      height: 8,
    });
    expect(res).not.toBeNull();
    expect(res!.seed).toBe('42FD750A');
    expect(res!.verified).toBe(true);
    expect(res!.frame).toBe('478');
  });

  it('recovers truncated Advances prefix (47 -> 478) via SFMT verification', () => {
    const image = overlayFixture([
      [16, 12, 'Seed:'],
      [96, 12, '42FD750A'],
      [96, 24, 'DBABE468'],
      [96, 36, '6BDEC797'],
      [96, 48, '47'],
    ]);
    const res = readRngFromAnchor(image, guide);
    expect(res).not.toBeNull();
    expect(res!.seed).toBe('42FD750A');
    expect(res!.verified).toBe(true);
    expect(res!.frame).toBe('478');
  });

  it('adapts to vertical foreshortening (vScale = 0.8) and verifies via SFMT', () => {
    const pitch = 16;
    const vScale = 0.8;
    const lineStep = Math.round(pitch * 1.48 * vScale);
    const width = 340;
    const height = 160;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    const lines: [number, number, string][] = [
      [16, 20, 'Seed:'],
      [176, 20, '42FD750A'],
      [176, 20 + lineStep, 'DBABE468'],
      [176, 20 + 2 * lineStep, '6BDEC797'],
      [176, 20 + 3 * lineStep, '478'],
    ];
    for (const [x, y, text] of lines) {
      [...text].forEach((character, column) => {
        const cell = glyphs[character as keyof typeof glyphs][0]!;
        const outH = Math.max(1, Math.round(pitch * vScale));
        for (let oy = 0; oy < outH; oy++) {
          const sy = Math.min(7, Math.floor((oy * 8) / outH));
          for (let ox = 0; ox < pitch; ox++) {
            const sx = Math.min(7, Math.floor((ox * 8) / pitch));
            const offset = ((y + oy) * width + x + column * pitch + ox) * 4;
            data.fill(Number.parseInt(cell[sy * 8 + sx]!, 16) * 17, offset, offset + 3);
          }
        }
      });
    }
    const image = { width, height, data } as ImageData;
    const res = readRngFromAnchor(image, { x: 176, y: 20, width: 8 * pitch, height: pitch });
    expect(res).not.toBeNull();
    expect(res!.seed).toBe('42FD750A');
    expect(res!.verified).toBe(true);
    expect(res!.exact).toBe(true);
    expect(res!.frame).toBe('478');
    expect(res!.frameCrop).toBeDefined();
  });

  it('exposes per-word Daycare uncertain positions', () => {
    const image = overlayFixture([
      [32, 12, 'Egg[3]:'],
      [96, 12, '06A59238'],
      [96, 24, 'EA1BAB19'],
      [96, 36, '042E0CB9'],
      [96, 48, '71DD47DC'],
    ]);
    const res = readDaycareFromAnchor(image, guide);
    expect(res).not.toBeNull();
    expect(res!.uncertain.egg3).toEqual([]);
  });
});
