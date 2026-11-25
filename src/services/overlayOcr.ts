import workerPath from 'tesseract.js/dist/worker.min.js?url';
import corePath from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url';
import modelPath from '../../scripts/ocr/eng.traineddata.gz?url';
import { parseOverlayWithStates, type OverlayFields } from './overlayParser';
import {
  readDaycareFromAnchor,
  readRngFromAnchor,
  type Region,
  type RngNccResult,
} from './pokeReaderNcc';
import { buildConfusionRanked, verifyOrFixSeedWithSfmt } from './sfmtVerify';

export type VerifyLevel = 'exact' | 'probable' | 'none';

export interface ScanPhotoResult {
  fields: OverlayFields;
  verified: boolean;
  verifyLevel: VerifyLevel;
  matchedNibbles: number;
  uncertain: Partial<Record<'egg3' | 'egg2' | 'egg1' | 'egg0', number[]>>;
  crops: Partial<Record<keyof OverlayFields, string>>;
  previewUrl: string;
  raw: string;
}

/**
 * Warm Workbox runtime cache (`pocket-ocr-v1`) for OCR assets without spawning a
 * WASM worker in memory while the user is taking a photo.
 */
export async function ensureOcrCached(): Promise<void> {
  const urls = [workerPath, corePath, modelPath].map(
    (p) => new URL(p, document.baseURI).href,
  );
  await Promise.all(
    urls.map(async (href) => {
      const res = await fetch(href);
      if (!res.ok) throw new Error('OCR asset unavailable');
      await res.arrayBuffer();
    }),
  );
}

export async function loadOcr(progress: (value: number) => void) {
  const { createWorker, OEM, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: new URL(workerPath, document.baseURI).href,
    corePath: new URL(corePath, document.baseURI).href,
    langPath: new URL('.', new URL(modelPath, document.baseURI)).href,
    workerBlobURL: false,
    logger: (m) => {
      if (m.status === 'recognizing text') {
        progress(Math.round(m.progress * 100));
      }
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    return worker;
  } catch (e) {
    await worker.terminate();
    throw e;
  }
}

export async function scanPhoto(
  worker: Awaited<ReturnType<typeof loadOcr>>,
  url: string,
): Promise<ScanPhotoResult> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const { PSM } = await import('tesseract.js');

  const rawScale = Math.min(1, 1500 / Math.max(image.width, image.height));
  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = Math.max(1, Math.round(image.width * rawScale));
  rawCanvas.height = Math.max(1, Math.round(image.height * rawScale));
  const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true })!;
  rawCtx.drawImage(image, 0, 0, rawCanvas.width, rawCanvas.height);
  const rawImage = rawCtx.getImageData(0, 0, rawCanvas.width, rawCanvas.height);

  // Build a lightweight JPEG preview so the 12 MP camera Blob can be released immediately.
  const previewScale = Math.min(1, 900 / Math.max(rawCanvas.width, rawCanvas.height));
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = Math.max(1, Math.round(rawCanvas.width * previewScale));
  previewCanvas.height = Math.max(1, Math.round(rawCanvas.height * previewScale));
  previewCanvas
    .getContext('2d')!
    .drawImage(rawCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
  const previewUrl = previewCanvas.toDataURL('image/jpeg', 0.8);
  previewCanvas.width = 0;
  previewCanvas.height = 0;

  function cropDataUrl(region: Region): string {
    const padX = Math.max(2, region.width * 0.08);
    const padY = Math.max(2, region.height * 0.25);
    const sx = Math.max(0, Math.floor(region.x - padX));
    const sy = Math.max(0, Math.floor(region.y - padY));
    const sw = Math.min(rawCanvas.width - sx, Math.ceil(region.width + 2 * padX));
    const sh = Math.min(rawCanvas.height - sy, Math.ceil(region.height + 2 * padY));
    if (sw <= 0 || sh <= 0) return '';
    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    out.getContext('2d')!.drawImage(rawCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
    const dataUrl = out.toDataURL('image/png');
    out.width = 0;
    out.height = 0;
    return dataUrl;
  }

  const fields: OverlayFields = {};
  const crops: ScanPhotoResult['crops'] = {};
  let uncertain: ScanPhotoResult['uncertain'] = {};
  const texts: string[] = [];
  let state1: string | undefined;
  let state0: string | undefined;
  let verified = false;
  let verifyLevel: VerifyLevel = 'none';
  let matchedNibbles = 0;
  let bestNccRng: RngNccResult | null = null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  try {
    for (const pass of ['smooth', 'focused', 'full', 'adaptive'] as const) {
      const focused = pass === 'focused' || pass === 'adaptive';
      const srcW = image.width * (focused ? 0.58 : 1);
      const srcH = image.height * (focused ? 0.58 : 1);
      const stretch = focused ? 1.45 : 1;
      const scale = 1500 / Math.max(srcW, srcH * stretch);
      canvas.width = Math.round(srcW * scale);
      canvas.height = Math.round(srcH * scale * stretch);
      ctx.filter = focused
        ? 'blur(0.6px)'
        : pass === 'smooth'
          ? 'blur(0.25px)'
          : 'none';
      if (focused) {
        ctx.drawImage(image, 0, 0, srcW, srcH, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      }
      ctx.filter = 'none';

      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const ink = new Uint8Array(canvas.width * canvas.height);
      const histogram = new Uint32Array(256);
      for (let p = 0; p < ink.length; p++) {
        const i = p * 4;
        ink[p] = Math.min(frame.data[i]!, frame.data[i + 1]!, frame.data[i + 2]!);
        histogram[ink[p]!]!++;
      }
      let threshold = 0;
      let total = 0;
      while (threshold < 255 && (total += histogram[threshold]!) < ink.length * 0.88) {
        threshold++;
      }
      for (let p = 0; p < ink.length; p++) {
        let cutoff = focused
          ? Math.max(160, Math.min(205, threshold))
          : pass === 'full'
            ? 185
            : Math.max(173, Math.min(195, threshold));
        if (pass === 'adaptive') {
          const x = p % canvas.width;
          const y = Math.floor(p / canvas.width);
          let sum = 0;
          for (const dy of [-12, 0, 12]) {
            for (const dx of [-12, 0, 12]) {
              sum +=
                ink[
                  Math.max(0, Math.min(canvas.height - 1, y + dy)) * canvas.width +
                    Math.max(0, Math.min(canvas.width - 1, x + dx))
                ]!;
            }
          }
          cutoff = sum / 9 + 28;
        }
        const v = 128 + (cutoff - ink[p]!) * 5;
        frame.data[p * 4] = frame.data[p * 4 + 1] = frame.data[p * 4 + 2] = v;
      }
      ctx.putImageData(frame, 0, 0);

      await worker.setParameters({
        tessedit_pageseg_mode: pass === 'adaptive' ? PSM.SINGLE_BLOCK : PSM.SPARSE_TEXT,
      });
      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      texts.push(data.text);

      const parsed = parseOverlayWithStates(data.text);
      for (const key of Object.keys(parsed.fields) as (keyof OverlayFields)[]) {
        fields[key] ??= parsed.fields[key];
      }
      state1 ??= parsed.state1;
      state0 ??= parsed.state0;

      const toRawX = (px: number) =>
        (px * (srcW * rawCanvas.width)) / (canvas.width * image.width);
      const toRawY = (py: number) =>
        (py * (srcH * rawCanvas.height)) / (canvas.height * image.height);
      const toRawBox = (b: { x0: number; y0: number; x1: number; y1: number }) => ({
        x: toRawX(b.x0),
        y: toRawY(b.y0),
        width: toRawX(b.x1 - b.x0),
        height: toRawY(b.y1 - b.y0),
      });

      const words =
        data.blocks?.flatMap((b) =>
          b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
        ) ?? [];

      // 1. Try hybrid NCC RNG localization from Seed / State[1] / Advances labels.
      const rngGuesses: Region[] = [];
      const seedLabel = words.find((w) => /^seed[:;!]?$/i.test(w.text));
      if (seedLabel) {
        const box = toRawBox(seedLabel.bbox);
        const pitch = box.width / (/[:;!]/.test(seedLabel.text) ? 4.65 : 3.95);
        rngGuesses.push({
          x: box.x + 10 * pitch,
          y: box.y - 0.05 * pitch,
          width: 8 * pitch,
          height: pitch * 1.05,
        });
      }
      const state1Label = words.find((w) =>
        /^stat[eot][\[({tf]?[1ilI][\]})]?[:;]?$/i.test(w.text),
      );
      if (state1Label) {
        const box = toRawBox(state1Label.bbox);
        const pitch = box.width / 8.3;
        const line = pitch * 1.48;
        rngGuesses.push({
          x: box.x + 10 * pitch,
          y: box.y - line,
          width: 8 * pitch,
          height: pitch * 1.05,
        });
      }
      const advLabel = words.find((w) => /^advances[:;]?$/i.test(w.text));
      if (advLabel) {
        const box = toRawBox(advLabel.bbox);
        const pitch = box.width / 8.3;
        const line = pitch * 1.48;
        rngGuesses.push({
          x: box.x + 10 * pitch,
          y: box.y - 3 * line,
          width: 8 * pitch,
          height: pitch * 1.05,
        });
      }

      for (const guess of rngGuesses) {
        const ncc = readRngFromAnchor(rawImage, guess);
        if (!ncc) continue;
        if (ncc.verified) {
          fields.seed = ncc.seed;
          if (/^\d+$/.test(ncc.frame)) fields.frame = ncc.frame;
          crops.seed = cropDataUrl(ncc.seedCrop);
          if (ncc.frameCrop) crops.frame = cropDataUrl(ncc.frameCrop);
          verified = true;
          verifyLevel = ncc.exact ? 'exact' : 'probable';
          matchedNibbles = ncc.matchedNibbles;
          bestNccRng = ncc;
          break;
        }
        if (!bestNccRng) bestNccRng = ncc;
      }
      if (verified) break;

      // 2. Try hybrid NCC Daycare localization without requiring all 3 anchors simultaneously.
      const isMenuText = />\s*Daycare/i.test(data.text) || /Ver\s+0\./i.test(data.text);
      const hasDaycareSignal =
        !isMenuText &&
        /(?:Par[12elt]|Ready|Shin[y g]|Masuda|Egg\s*[\[(]?[0-3])/i.test(data.text);

      if (hasDaycareSignal) {
        const daycareGuesses: Region[] = [];
        for (const w of words) {
          const m = /^(?:egg|ess|esa|esg|es[oa])[\[(\{ft]*([0-3])/i.exec(w.text);
          if (!m) continue;
          const idx = Number(m[1]);
          const box = toRawBox(w.bbox);
          const pitch = box.width / 6.5;
          if (pitch < 3) continue;
          const line = pitch * 1.52;
          daycareGuesses.push({
            x: box.x + 8 * pitch,
            y: box.y - (3 - idx) * line,
            width: 8 * pitch,
            height: pitch * 1.05,
          });
        }

        const heading = words.find((w) => /^unlock$/i.test(w.text));
        const parent1 = words.find((w) => /^Par[1ilt][:;]?$/i.test(w.text));
        const parent2 = words.find((w) => /^Par[2ez][:;]?$/i.test(w.text));

        let hBox = heading ? toRawBox(heading.bbox) : null;
        const p1Box = parent1 ? toRawBox(parent1.bbox) : null;
        const p2Box = parent2 ? toRawBox(parent2.bbox) : null;

        if (!hBox && p1Box && p2Box) {
          const step = p2Box.y - p1Box.y;
          if (step > 4) {
            hBox = {
              x: p1Box.x,
              y: p1Box.y - 3 * step,
              width: p1Box.width * 1.25,
              height: p1Box.height,
            };
          }
        }

        const refParent = p1Box ?? p2Box;
        if (hBox && refParent) {
          const div = p1Box ? 3 : 4;
          const pitchFromHeading = hBox.width / 5.85;
          const lineFromSpacing = (refParent.y - hBox.y) / div;
          const pitch =
            Math.abs(lineFromSpacing / 1.5 - pitchFromHeading) / pitchFromHeading < 0.18
              ? (pitchFromHeading + lineFromSpacing / 1.5) / 2
              : pitchFromHeading;
          const line = pitch * 1.52;
          if (pitch > 3 && Math.abs(refParent.x - hBox.x) < pitch * 1.8) {
            for (const rowOffset of [5.55, 5.75, 5.95]) {
              daycareGuesses.push({
                x: hBox.x + 7.85 * pitch,
                y: hBox.y + rowOffset * line,
                width: 8 * pitch,
                height: pitch * 1.05,
              });
            }
          }
        }

        const shiny = words.find((w) => /^(?:shin[y g]|masuda)/i.test(w.text));
        const topBound = p1Box?.y ?? p2Box?.y ?? (hBox ? hBox.y + hBox.height * 3 : 0);
        const bottomBound = shiny ? toRawBox(shiny.bbox).y : rawCanvas.height;
        if (topBound > 0) {
          for (const w of words) {
            const clean = w.text.replace(/[^0-9A-Za-z@]/g, '');
            if (clean.length < 7 || clean.length > 9) continue;
            const wb = toRawBox(w.bbox);
            if (wb.y <= topBound || wb.y >= bottomBound) continue;
            const wp = wb.width / clean.length;
            if (wp < 3) continue;
            const wl = wp * 1.52;
            for (const idxFromTop of [0, 1, 2, 3]) {
              daycareGuesses.push({
                x: wb.x,
                y: wb.y - idxFromTop * wl,
                width: 8 * wp,
                height: wp * 1.05,
              });
            }
          }
        }

        let bestDaycare: ReturnType<typeof readDaycareFromAnchor> = null;
        for (const guess of daycareGuesses) {
          const dc = readDaycareFromAnchor(rawImage, guess);
          if (!dc) continue;
          if (!bestDaycare || dc.quality > bestDaycare.quality) {
            bestDaycare = dc;
          }
        }
        if (bestDaycare) {
          const allValid = [
            bestDaycare.egg3,
            bestDaycare.egg2,
            bestDaycare.egg1,
            bestDaycare.egg0,
          ].every((w) => /^[0-9A-F]{8}$/.test(w));
          if (allValid) {
            fields.egg3 = bestDaycare.egg3;
            fields.egg2 = bestDaycare.egg2;
            fields.egg1 = bestDaycare.egg1;
            fields.egg0 = bestDaycare.egg0;
            uncertain = bestDaycare.uncertain;
            crops.egg3 = cropDataUrl(bestDaycare.crops.egg3);
            crops.egg2 = cropDataUrl(bestDaycare.crops.egg2);
            crops.egg1 = cropDataUrl(bestDaycare.crops.egg1);
            crops.egg0 = cropDataUrl(bestDaycare.crops.egg0);
            break;
          }
        }
      }
      if (fields.egg0 && fields.egg1 && fields.egg2 && fields.egg3) break;
    }

    if (!verified) {
      if (bestNccRng) {
        if (/^[0-9A-F]{8}$/.test(bestNccRng.seed)) {
          fields.seed = bestNccRng.seed;
        }
        if (/^\d+$/.test(bestNccRng.frame)) {
          fields.frame ??= bestNccRng.frame;
        }
        crops.seed ??= cropDataUrl(bestNccRng.seedCrop);
        if (bestNccRng.frameCrop) crops.frame ??= cropDataUrl(bestNccRng.frameCrop);
      }

      if (fields.seed && /^[0-9A-F]{8}$/.test(fields.seed) && state1 && state0) {
        const advStr = fields.frame ?? '';
        const adv = /^\d+$/.test(advStr) ? Number(advStr) : -1;
        const candidates: number[] = [];
        if (adv >= 0) candidates.push(adv);
        if (adv < 0 || '478'.startsWith(advStr) || '418'.startsWith(advStr)) {
          if (!candidates.includes(478)) candidates.push(478);
          if (!candidates.includes(418)) candidates.push(418);
        }
        for (const probeAdv of candidates) {
          const res = verifyOrFixSeedWithSfmt(
            buildConfusionRanked(fields.seed),
            state1,
            state0,
            probeAdv,
            1024,
          );
          if (res.verified) {
            fields.seed = res.seed;
            fields.frame = String(probeAdv);
            verified = true;
            verifyLevel = res.exact ? 'exact' : 'probable';
            matchedNibbles = res.matchedNibbles;
            break;
          }
        }
      }
    }

    return {
      fields,
      verified,
      verifyLevel,
      matchedNibbles,
      uncertain,
      crops,
      previewUrl,
      raw: texts.join('\n——\n'),
    };
  } finally {
    rawCanvas.width = 0;
    rawCanvas.height = 0;
    canvas.width = 0;
    canvas.height = 0;
  }
}
