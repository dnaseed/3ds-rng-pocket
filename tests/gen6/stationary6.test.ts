import { describe, expect, it } from 'vitest';
import { createI18n } from '../../src/data/i18n';
import { searchStationary6, type Stationary6SearchRequest } from '../../src/engine/gen6/stationary6';
import { toHex32 } from '../../src/engine/math/uint';

const i18n = createI18n('en');
const search = {
  seed: 0x35b19af2, minFrame: 0, maxFrame: 9, targetFrame: 5000, shinyCharm: false, tsv: 0, trv: 0,
};

// Transcribed from 3DSRNGTool v1.0.6. All four tables share Rand# and State.
const rngColumns = [
  '0CF8CF91 35B19AF2', '94C0CAD4 8F9BA37B', 'C37D31F7 77323FBF', 'F135FE55 D121D3F9',
  '4C5AA5D0 E09F6BA6', 'C8F0A8A4 7D03C51E', '655A6D94 CED35C41', '49A5492E 1390B811',
  '219470C9 5F10B7BD', '3205778B CA101935',
];

// HP Atk Def SpA SpD Spe Nature HPType PSV PRV Ability PID EC.
const cases: {
  preset: Stationary6SearchRequest['preset'];
  delay: number;
  species: number;
  level: number;
  rows: string[];
}[] = [
  {
    preset: 'xy-mewtwo', delay: 0, species: 150, level: 70,
    rows: [
      '31 1 5 31 5 31 Lonely Dark 3104 2 1 054DC74F 9D3F6149',
      '31 31 2 27 27 31 Adamant Dragon 0217 2 1 A665ABF7 054DC74F',
      '31 31 2 27 27 31 Adamant Dragon 3150 9 1 1ADFDE36 A665ABF7',
      '31 31 27 4 8 31 Quirky Ground 2803 7 1 FEDF51E8 1ADFDE36',
      '31 31 27 4 8 31 Quirky Ground 2798 9 1 0938A7D1 FEDF51E8',
      '31 31 27 4 8 31 Quirky Ground 0051 7 1 292E2A19 0938A7D1',
      '31 31 31 28 1 31 Calm Electric 0383 A 1 2F5F38A5 292E2A19',
      '31 31 31 28 1 31 Calm Electric 2365 5 1 12EA813F 2F5F38A5',
      '31 31 31 28 1 31 Calm Electric 1452 A 1 DD998753 12EA813F',
      '31 31 28 1 26 31 Timid Ghost 1942 5 1 DA3CA359 DD998753',
    ],
  },
  {
    preset: 'xy-mewtwo', delay: 2, species: 150, level: 70,
    rows: [
      '31 31 2 27 27 31 Adamant Dragon 3150 9 1 1ADFDE36 A665ABF7',
      '31 31 27 4 8 31 Quirky Ground 2803 7 1 FEDF51E8 1ADFDE36',
      '31 31 27 4 8 31 Quirky Ground 2798 9 1 0938A7D1 FEDF51E8',
      '31 31 27 4 8 31 Quirky Ground 0051 7 1 292E2A19 0938A7D1',
      '31 31 31 28 1 31 Calm Electric 0383 A 1 2F5F38A5 292E2A19',
      '31 31 31 28 1 31 Calm Electric 2365 5 1 12EA813F 2F5F38A5',
      '31 31 31 28 1 31 Calm Electric 1452 A 1 DD998753 12EA813F',
      '31 31 28 1 26 31 Timid Ghost 1942 5 1 DA3CA359 DD998753',
      '31 31 26 12 31 31 Timid Grass 3923 5 1 262AD31F DA3CA359',
      '31 12 31 13 31 31 Jolly Dragon 3302 C 1 42DB8CB7 262AD31F',
    ],
  },
  {
    preset: 'oras-regirock', delay: 0, species: 377, level: 40,
    rows: [
      '31 1 5 31 5 31 Gentle Dark 3104 2 1 054DC74F 9D3F6149',
      '31 31 2 27 27 31 Docile Dragon 0217 2 1 A665ABF7 054DC74F',
      '31 31 2 27 27 31 Docile Dragon 3150 9 1 1ADFDE36 A665ABF7',
      '31 31 27 4 8 31 Sassy Ground 2803 7 2 FEDF51E8 1ADFDE36',
      '31 31 27 4 8 31 Sassy Ground 2798 9 2 0938A7D1 FEDF51E8',
      '31 31 27 4 8 31 Sassy Ground 0051 7 2 292E2A19 0938A7D1',
      '31 31 31 28 1 31 Timid Electric 0383 A 2 2F5F38A5 292E2A19',
      '31 31 31 28 1 31 Timid Electric 2365 5 2 12EA813F 2F5F38A5',
      '31 31 31 28 1 31 Timid Electric 1452 A 2 DD998753 12EA813F',
      '31 31 28 1 26 31 Quirky Ghost 1942 5 1 DA3CA359 DD998753',
    ],
  },
  {
    preset: 'oras-regirock', delay: 158, species: 377, level: 40,
    rows: [
      '9 31 31 31 2 10 Modest Bug 1846 7 1 575D243A 1B4F13AB',
      '9 31 31 31 2 10 Modest Bug 3910 A 1 609194FB 575D243A',
      '9 31 31 31 2 10 Modest Bug 0119 2 1 5C835BF1 609194FB',
      '9 31 31 31 2 10 Modest Bug 2168 B 1 8F3F08B4 5C835BF1',
      '31 31 10 31 14 19 Sassy Ghost 2122 B 2 5F8ADB21 8F3F08B4',
      '31 31 31 19 16 28 Hasty Bug 0995 D 1 990BA736 5F8ADB21',
      '31 31 31 19 16 28 Hasty Bug 2548 2 1 4CB4D3F6 990BA736',
      '31 31 31 19 16 28 Hasty Bug 1811 2 1 49063834 4CB4D3F6',
      '16 31 31 31 28 10 Naughty Bug 0450 9 1 1466084F 49063834',
      '10 14 31 31 6 31 Naive Ghost 3086 B 2 503390D8 1466084F',
    ],
  },
];

describe('Stationary Gen 6', () => {
  it.each(cases)('matches 3DSRNGTool for $preset with $delay frames of delay', scenario => {
    const { preset, delay, species, level, rows: expected } = scenario;
    const rows = [...searchStationary6({ ...search, preset, considerDelay: delay > 0 })];
    expect(rows).toHaveLength(expected.length);
    for (const [frame, row] of rows.entries()) {
      expect(row).toMatchObject({
        frame, shift: frame - 5000, elapsedFrames: frame, species, level, forme: 0, delay,
        gender: 0, shiny: false, squareShiny: false, synchronize: false,
      });
      expect([toHex32(row.rand), toHex32(row.state)].join(' ')).toBe(rngColumns[frame]);
      expect([
        ...row.ivs, i18n.getNatureName(row.nature), i18n.getHpTypeName(row.hiddenPower),
        String(row.psv).padStart(4, '0'), row.prv.toString(16).toUpperCase(),
        row.ability, toHex32(row.pid), toHex32(row.ec),
      ].join(' ')).toBe(expected[frame]);
    }
  });

  it('starts at a nonzero frame and preserves lookahead after discarding consumed words', () => {
    const request = { ...search, preset: 'oras-regirock' as const, considerDelay: true, maxFrame: 1028 };
    const all = [...searchStationary6(request)];
    const tail = [...searchStationary6({ ...request, minFrame: 1022 })];
    expect(tail).toEqual(all.slice(1022).map(row => ({ ...row, elapsedFrames: row.elapsedFrames - 1022 })));
  });

  it('keeps a matching shiny PID for Regirock and flips the locked PID for Mewtwo', () => {
    const request = { ...search, tsv: 3104, trv: 2, maxFrame: 0, considerDelay: false };
    const [regirock] = searchStationary6({ ...request, preset: 'oras-regirock' });
    const [mewtwo] = searchStationary6({ ...request, preset: 'xy-mewtwo' });
    expect(regirock).toMatchObject({ pid: 0x054dc74f, shiny: true, squareShiny: true });
    expect(mewtwo).toMatchObject({ pid: 0x154dc74f, shiny: false, squareShiny: false });
  });
});
