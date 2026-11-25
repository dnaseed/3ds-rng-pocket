import atlas from './pokeReaderGlyphs.json';
import { verifyOrFixSeedWithSfmt, type RankedChar } from './sfmtVerify';

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RngNccResult {
  seed: string;
  verified: boolean;
  exact: boolean;
  corrected: boolean;
  matchedNibbles: number;
  frame: string;
  seedCrop: Region;
  frameCrop?: Region;
}

export interface DaycareNccResult {
  egg3: string;
  egg2: string;
  egg1: string;
  egg0: string;
  quality: number;
  uncertain: Record<'egg3' | 'egg2' | 'egg1' | 'egg0', number[]>;
  crops: Record<'egg3' | 'egg2' | 'egg1' | 'egg0', Region>;
}

const HEX = '0123456789ABCDEF';
const DIGITS = '0123456789';

function centered(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const shifted = values.map((v) => v - mean);
  const norm = Math.sqrt(shifted.reduce((sum, v) => sum + v * v, 0));
  return shifted.map((v) => v / (norm || 1));
}

const templates = Object.entries(atlas).flatMap(([glyph, variants]) =>
  variants.map((value) => ({
    glyph,
    pixels: centered([...value].map((c) => Number.parseInt(c, 16))),
  })),
);

/** Recognize one monospace cell using 8x8 NCC against PokeReader glyph templates. */
export function recognizeCellRanked(
  image: ImageData,
  region: Region,
  alphabet: string,
): RankedChar[] {
  const scores = new Map<string, number>();
  for (const dx of [0, -0.09, 0.09]) {
    for (const dy of [0, -0.11, 0.11]) {
      const pixels: number[] = [];
      for (let j = 0; j < 8; j++) {
        for (let i = 0; i < 8; i++) {
          const x = Math.floor(region.x + region.width * ((i + 0.5) / 8 + dx));
          const y = Math.floor(region.y + region.height * ((j + 0.5) / 8 + dy));
          if (x < 0 || x >= image.width || y < 0 || y >= image.height) {
            return [{ glyph: '?', score: 0 }];
          }
          const k = (y * image.width + x) * 4;
          pixels.push(
            0.299 * image.data[k]! + 0.587 * image.data[k + 1]! + 0.114 * image.data[k + 2]!,
          );
        }
      }
      const cell = centered(pixels);
      for (const template of templates) {
        if (!alphabet.includes(template.glyph)) continue;
        const score = template.pixels.reduce((sum, v, idx) => sum + v * cell[idx]!, 0);
        scores.set(template.glyph, Math.max(scores.get(template.glyph) ?? -1, score));
      }
    }
  }
  if (scores.size === 0) return [{ glyph: '?', score: 0 }];
  return [...scores]
    .map(([glyph, score]) => ({ glyph, score }))
    .sort((a, b) => b.score - a.score);
}

function makeBox(
  origin: Region,
  pitch: number,
  lineHeight: number,
  column: number,
  line: number,
  count: number,
  slope = 0,
): Region {
  return {
    x: origin.x + column * pitch - line * lineHeight * slope,
    y: origin.y + line * lineHeight + column * pitch * slope,
    width: count * pitch,
    height: origin.height,
  };
}

function makeRowCropBox(
  origin: Region,
  pitch: number,
  lineHeight: number,
  column: number,
  line: number,
  count: number,
  slope: number,
): Region {
  const first = makeBox(origin, pitch, lineHeight, column, line, 1, slope);
  const last = makeBox(origin, pitch, lineHeight, column + Math.max(0, count - 1), line, 1, slope);
  const minX = Math.min(first.x, last.x);
  const maxX = Math.max(first.x + first.width, last.x + last.width);
  const minY = Math.min(first.y, last.y);
  const maxY = Math.max(first.y + first.height, last.y + last.height);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function checkAnchor(
  image: ImageData,
  origin: Region,
  pitch: number,
  lineHeight: number,
  label: string,
  column: number,
  slope = 0,
  minCell = 0.25,
  minMean = 0.5,
): boolean {
  const scores = [...label].map(
    (glyph, i) =>
      recognizeCellRanked(image, makeBox(origin, pitch, lineHeight, column + i, 0, 1, slope), glyph)[0]!
        .score,
  );
  return scores.every((s) => s > minCell) && scores.reduce((a, b) => a + b, 0) / scores.length > minMean;
}

function fitOrigin(
  image: ImageData,
  initial: Region,
  label: string,
  labelCol: number,
): { origin: Region; pitch: number; lineHeight: number; slope: number; quality: number } {
  const nominal = initial.width / 8;
  let best = -Infinity;
  let fit = { origin: initial, pitch: nominal };
  for (const scale of [1, 0.96, 1.04, 0.92, 1.08]) {
    const pitch = nominal * scale;
    const h = initial.height * scale;
    const lh = pitch * 1.48;
    for (const dx of [0, -0.2, 0.2, -0.4, 0.4]) {
      for (const dy of [0, -0.2, 0.2, -0.4, 0.4]) {
        const origin = {
          x: initial.x + dx * nominal,
          y: initial.y + dy * nominal,
          width: 8 * pitch,
          height: h,
        };
        const labelScore =
          [...label].reduce(
            (sum, g, i) =>
              sum + recognizeCellRanked(image, makeBox(origin, pitch, lh, labelCol + i, 0, 1), g)[0]!.score,
            0,
          ) / label.length;
        const inkScore =
          Array.from({ length: 8 }, (_, i) =>
            recognizeCellRanked(image, makeBox(origin, pitch, lh, i, 0, 1), HEX)[0]!.score,
          ).reduce((a, b) => a + b, 0) / 8;
        const quality = labelScore + inkScore * 0.75;
        if (quality > best) {
          best = quality;
          fit = { origin, pitch };
        }
      }
    }
  }

  // Refine row tilt (slope) for handheld camera angle.
  const pitch = fit.pitch;
  const lh = pitch * 1.48;
  let bestSlope = 0;
  let bestSlopeOrigin = fit.origin;
  let bestSlopeQuality = -Infinity;
  for (const slope of [-0.1, -0.075, -0.05, -0.025, 0, 0.025, 0.05, 0.075, 0.1]) {
    for (const dy of [-0.15, 0, 0.15]) {
      const origin = { ...fit.origin, y: fit.origin.y + dy * pitch };
      const labelScore =
        [...label].reduce(
          (sum, g, i) =>
            sum +
            recognizeCellRanked(image, makeBox(origin, pitch, lh, labelCol + i, 0, 1, slope), g)[0]!
              .score,
          0,
        ) / label.length;
      const inkScore =
        Array.from({ length: 8 }, (_, i) =>
          recognizeCellRanked(image, makeBox(origin, pitch, lh, i, 0, 1, slope), HEX)[0]!.score,
        ).reduce((a, b) => a + b, 0) / 8;
      const quality = labelScore + inkScore * 0.75 - 0.05 * Math.abs(slope);
      if (quality > bestSlopeQuality) {
        bestSlopeQuality = quality;
        bestSlope = slope;
        bestSlopeOrigin = origin;
      }
    }
  }

  let bestVScale = 1;
  let bestVOrigin = bestSlopeOrigin;
  let bestVQuality = -Infinity;
  for (const vScale of [0.76, 0.88, 1.0, 1.12]) {
    const testLh = lh * vScale;
    for (const dy of [-0.15, 0, 0.15]) {
      const testOrigin = {
        ...bestSlopeOrigin,
        y: bestSlopeOrigin.y + dy * pitch,
        height: bestSlopeOrigin.height * vScale,
      };
      const labelScore =
        [...label].reduce(
          (sum, g, i) =>
            sum +
            recognizeCellRanked(
              image,
              makeBox(testOrigin, pitch, testLh, labelCol + i, 0, 1, bestSlope),
              g,
            )[0]!.score,
          0,
        ) / label.length;
      let rowsScore = 0;
      for (const lineIdx of [0, 1, 2]) {
        for (let i = 0; i < 8; i++) {
          rowsScore += recognizeCellRanked(
            image,
            makeBox(testOrigin, pitch, testLh, i, lineIdx, 1, bestSlope),
            HEX,
          )[0]!.score;
        }
      }
      const vQuality =
        labelScore * 0.6 + rowsScore / 24 - 0.08 * Math.abs(1 - vScale) - 0.02 * Math.abs(dy);
      if (vQuality > bestVQuality) {
        bestVQuality = vQuality;
        bestVScale = vScale;
        bestVOrigin = testOrigin;
      }
    }
  }

  return {
    origin: bestVOrigin,
    pitch,
    lineHeight: lh * bestVScale,
    slope: bestSlope,
    quality: bestSlopeQuality,
  };
}

function refitRow(
  image: ImageData,
  origin: Region,
  pitch: number,
  lineHeight: number,
  column: number,
  line: number,
  count: number,
  alphabet: string,
  variable: boolean,
  slope = 0,
): { ranked: RankedChar[][]; text: string; region: Region } {
  let best = -Infinity;
  let bestOrigin = origin;
  const sampleCount = variable ? 1 : count;
  for (const dx of [0, -0.18, 0.18, -0.36, 0.36]) {
    for (const dy of [0, -0.18, 0.18, -0.36, 0.36]) {
      const candidateOrigin = {
        ...origin,
        x: origin.x + dx * pitch,
        y: origin.y + dy * pitch,
      };
      let quality = 0;
      for (let i = 0; i < sampleCount; i++) {
        quality += recognizeCellRanked(
          image,
          makeBox(candidateOrigin, pitch, lineHeight, column + i, line, 1, slope),
          alphabet,
        )[0]!.score;
      }
      quality = quality / sampleCount - 0.025 * (Math.abs(dx) + Math.abs(dy));
      if (quality > best) {
        best = quality;
        bestOrigin = candidateOrigin;
      }
    }
  }

  const ranked: RankedChar[][] = [];
  let text = '';
  for (let i = 0; i < count; i++) {
    const r = recognizeCellRanked(
      image,
      makeBox(bestOrigin, pitch, lineHeight, column + i, line, 1, slope),
      alphabet,
    );
    if (variable && r[0]!.score < 0.6) break;
    ranked.push(r);
    text += r[0]!.score < 0.34 ? '?' : r[0]!.glyph;
  }
  return {
    ranked,
    text,
    region: makeRowCropBox(bestOrigin, pitch, lineHeight, column, line, count, slope),
  };
}

/** Read PokeReader RNG view starting from an estimated Seed value bounding box. */
export function readRngFromAnchor(image: ImageData, seedValueRegion: Region): RngNccResult | null {
  const { origin, pitch, lineHeight, slope } = fitOrigin(image, seedValueRegion, 'Seed:', -10);
  if (!checkAnchor(image, origin, pitch, lineHeight, 'Seed:', -10, slope)) return null;

  const seedRow = refitRow(image, origin, pitch, lineHeight, 0, 0, 8, HEX, false, slope);
  const state1Row = refitRow(image, origin, pitch, lineHeight, 0, 1, 8, HEX, false, slope);
  const state0Row = refitRow(image, origin, pitch, lineHeight, 0, 2, 8, HEX, false, slope);
  const advRow = refitRow(image, origin, pitch, lineHeight, 0, 3, 8, DIGITS, true, slope);

  let frame = advRow.text;
  const advNum = /^\d+$/.test(frame) ? Number(frame) : -1;
  let verify = verifyOrFixSeedWithSfmt(seedRow.ranked, state1Row.text, state0Row.text, advNum);

  const shouldTryCommon =
    !frame ||
    '478'.startsWith(frame) ||
    '418'.startsWith(frame) ||
    Math.abs(advNum - 478) <= 10 ||
    Math.abs(advNum - 418) <= 10;

  if (!verify.verified && shouldTryCommon) {
    for (const fallbackAdv of [478, 418]) {
      const probe = verifyOrFixSeedWithSfmt(
        seedRow.ranked,
        state1Row.text,
        state0Row.text,
        fallbackAdv,
      );
      if (probe.verified) {
        verify = probe;
        frame = String(fallbackAdv);
        break;
      }
    }
  }

  return {
    seed: verify.seed,
    verified: verify.verified,
    exact: verify.exact,
    corrected: verify.corrected,
    matchedNibbles: verify.matchedNibbles,
    frame,
    seedCrop: seedRow.region,
    frameCrop: advRow.region,
  };
}

function uncertainIndices(ranked: RankedChar[][]): number[] {
  const out: number[] = [];
  for (let i = 0; i < ranked.length; i++) {
    const col = ranked[i]!;
    const top = col[0]?.score ?? 0;
    const second = col[1]?.score ?? 0;
    if (top < 0.72 || top - second < 0.08) out.push(i);
  }
  return out;
}

/** Read PokeReader Daycare view starting from an estimated Egg[3] value bounding box. */
export function readDaycareFromAnchor(
  image: ImageData,
  egg3ValueRegion: Region,
): DaycareNccResult | null {
  const { origin, pitch, lineHeight, slope, quality } = fitOrigin(
    image,
    egg3ValueRegion,
    'Egg[3]:',
    -8,
  );
  if (!checkAnchor(image, origin, pitch, lineHeight, 'Egg[3]:', -8, slope, 0.22, 0.45)) {
    return null;
  }

  const e3 = refitRow(image, origin, pitch, lineHeight, 0, 0, 8, HEX, false, slope);
  const e2 = refitRow(image, origin, pitch, lineHeight, 0, 1, 8, HEX, false, slope);
  const e1 = refitRow(image, origin, pitch, lineHeight, 0, 2, 8, HEX, false, slope);
  const e0 = refitRow(image, origin, pitch, lineHeight, 0, 3, 8, HEX, false, slope);

  const avgScore =
    [e3, e2, e1, e0]
      .flatMap((r) => r.ranked.map((c) => c[0]!.score))
      .reduce((a, b) => a + b, 0) / 32;
  if (avgScore < 0.48) return null;

  return {
    egg3: e3.text,
    egg2: e2.text,
    egg1: e1.text,
    egg0: e0.text,
    quality: quality + avgScore,
    uncertain: {
      egg3: uncertainIndices(e3.ranked),
      egg2: uncertainIndices(e2.ranked),
      egg1: uncertainIndices(e1.ranked),
      egg0: uncertainIndices(e0.ranked),
    },
    crops: {
      egg3: e3.region,
      egg2: e2.region,
      egg1: e1.region,
      egg0: e0.region,
    },
  };
}
