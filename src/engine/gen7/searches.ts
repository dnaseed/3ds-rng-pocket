import { getBlinkFlagList } from '../core/blinkFlags';
import { checkRngFilter, CompiledIdFilter } from '../core/filters';
import { ModelStatus } from '../core/modelStatus';
import { calcFrame, getHiddenPowerValue, getStartingFrame } from '../core/pokemonMath';
import { type Generator7, RngPool } from '../core/rngPool';
import type {
  EggResult7,
  FishingSetting,
  FrameRow,
  IdFilterOptions,
  IdResult7,
  Result7,
  RngFilterOptions,
  SearchMode,
  WildResult7,
} from '../core/types';
import { modU64 } from '../math/uint';
import { SFMT } from '../rng/sfmt';
import { TinyMT } from '../rng/tinymt';
import type { TinyState } from '../rng/types';
import { Egg7, type Egg7Config } from './egg7';
import { calcEggShortestPath } from './eggPath';
import { Event7, type Event7Config } from './event7';
import { makeId7 } from './id7';
import { MainEggRng, Stationary7, type Stationary7Config } from './stationary7';
import { Wild7, type Wild7Config } from './wild7';

export const DEFAULT_MAX_RESULTS = 5000;

export interface ProgressContext {
  onProgress?: (percent: number) => void;
  shouldAbort?: () => boolean;
}

export interface MainSearchParams {
  seed: number;
  isUltra: boolean;
  startFrame: number;
  endFrame: number;
  targetFrame: number;
  npcCount: number;
  raining: boolean;
  considerDelay: boolean;
  delayFrames: number; // UI Timedelay.Value (converted via trunc(delay/2) + 2)
  mode: SearchMode;
  timeSpanSec: number;
  isBoy: boolean;
  fidgetTimeline: boolean;
  xMenu: boolean;
  jumpFrame: number;
  leapType?: 0 | 1 | 2; // 0=Event/WC7, 1=MenuMethod, 2=Dialogue
  leapDelayMinSec?: number;
  leapDelayMaxSec?: number;
  leapView?: 'timeline' | 'spread';
  filter: RngFilterOptions;
  maxResults?: number;
}

export interface StationarySearchRequest extends MainSearchParams {
  kind: 'stationary';
  config: Stationary7Config;
}

export interface EventSearchRequest extends MainSearchParams {
  kind: 'event';
  config: Event7Config;
}

export interface WildSearchRequest extends MainSearchParams {
  kind: 'wild';
  config: Wild7Config;
  wildDelayType: number; // RNGPool.DelayType (0=Honey, 1=Simple, 2=Fishing, 3=Step, 4=Menu)
  wildCry: boolean;
  preHoneyCorrection: number;
  fishingSetting?: FishingSetting;
  fishyTimeline?: boolean;
  fishyOverview?: boolean;
  specialSlotStr?: string;
}

export interface MainEggSearchRequest extends MainSearchParams {
  kind: 'mainEgg';
  eggSeed: TinyState;
  eggConfig: Egg7Config;
  considerOtherTsv: boolean;
  otherTsvs: readonly number[];
}

export type MainGen7SearchRequest =
  | StationarySearchRequest
  | EventSearchRequest
  | WildSearchRequest
  | MainEggSearchRequest;

export interface EggSearchRequest {
  kind: 'egg';
  mode: 'frame' | 'list' | 'shortestPath';
  eggSeed: TinyState;
  config: Egg7Config;
  startFrame: number;
  endFrame: number;
  eggMin: number;
  eggMax: number;
  targetFrame: number;
  shinyRemind: boolean;
  filter: RngFilterOptions;
  maxResults?: number;
}

export interface IdSearchRequest {
  kind: 'id';
  seed: number;
  isUltra: boolean;
  startFrame: number;
  endFrame: number;
  clockCorrection: number;
  filter: IdFilterOptions;
  maxResults?: number;
}

export interface MainSearchOutput {
  rows: FrameRow[];
  standardTime: number;
  truncated: boolean;
  leapInfo?: {
    frame0: number;
    targetFrame: number;
    hitCount: number;
  };
}

export interface EggSearchOutput {
  rows: FrameRow[];
  truncated: boolean;
  instruction?: {
    acceptedEggs: number;
    rejectedSteps: number;
    isShortestPath: boolean;
    reachable: boolean;
  };
}

export interface IdSearchOutput {
  rows: IdResult7[];
  truncated: boolean;
}

function setupGen7Pool(
  req: MainGen7SearchRequest,
  sfmt: SFMT,
): { pool: RngPool; generator: Generator7; standardTime: number } {
  const pool = new RngPool();
  const modelNumber = req.npcCount + 1;

  pool.modelNumber = modelNumber;
  pool.delayTime = Math.trunc(req.delayFrames / 2) + 2;
  pool.raining = req.raining;
  pool.honeyDelay = req.isUltra ? 63 : 93;
  pool.ultraWild = req.isUltra && req.kind === 'wild';
  pool.considerDelay = req.considerDelay;

  let bufferSize = 150;
  let generator: Generator7;

  if (req.kind === 'stationary') {
    const st7 = new Stationary7(req.config);
    if (req.mode === 'aroundTarget') {
      // Pass 1 of Around Target always uses null AssumeSynced (MainForm_Core.cs:328, 357-358)
      st7.assumeSynced = null;
    }
    pool.delayType = st7.delayType;
    if (pool.delayType === 4 && (req.delayFrames & 1) === 1) {
      pool.delayType = 6;
    }
    if (st7.delayType > 0) {
      bufferSize += 3 * pool.delayTime;
    }
    if (st7.isPelago) {
      bufferSize += 256;
    }
    generator = st7;
  } else if (req.kind === 'event') {
    generator = new Event7(req.config);
  } else if (req.kind === 'wild') {
    pool.delayType =
      req.mode === 'timeline' && req.fishyTimeline ? 1 : req.wildDelayType;
    pool.wildCry = req.wildCry;
    pool.preHoneyCorrection = req.preHoneyCorrection;
    if (req.fishingSetting) {
      pool.fsetting = req.fishingSetting;
    }
    bufferSize += modelNumber * 500;
    generator = new Wild7(req.config);
  } else {
    // mainEgg
    if (req.eggSeed.every((v) => v === 0)) {
      throw new Error('Egg Seed non valido (tutti zeri). Inserisci uno stato TinyMT valido.');
    }
    const tinyPool = new RngPool();
    tinyPool.createBuffer32(new TinyMT(req.eggSeed), 100);
    const firstEgg = tinyPool.generateEgg7((p) => new Egg7(req.eggConfig).generate(p));
    generator = new MainEggRng({
      tsv: req.eggConfig.tsv,
      trv: req.eggConfig.trv,
      considerOtherTsv: req.considerOtherTsv,
      otherTsvs: req.otherTsvs,
      egg: firstEgg,
    });
  }

  if (req.mode === 'timelineLeap') {
    bufferSize += modelNumber * 20;
  }

  if (req.considerDelay) {
    bufferSize += modelNumber * pool.delayTime;
  }

  const minForCalc =
    req.mode === 'aroundTarget' && req.targetFrame - 100 < req.startFrame
      ? req.targetFrame - 100
      : req.startFrame;
  const standardTime =
    calcFrame(
      req.seed,
      minForCalc,
      req.targetFrame,
      modelNumber,
      req.fidgetTimeline,
      req.raining,
    )[0] * 2;

  pool.createBuffer64(sfmt, Math.max(bufferSize, 5000));
  return { pool, generator, standardTime };
}

export function runMainGen7Search(
  req: MainGen7SearchRequest,
  ctx: ProgressContext = {},
): MainSearchOutput {
  // Match MainForm_Core.cs:204: clamp Frame_min to getStartingFrame before any Gen 7 search mode
  const method = req.kind === 'event' ? 1 : req.kind === 'wild' ? 2 : 0;
  const minStart = getStartingFrame(req.isUltra, method);
  const clampedReq: MainGen7SearchRequest =
    req.startFrame < minStart ? { ...req, startFrame: minStart } : req;

  if (clampedReq.kind === 'wild' && clampedReq.mode === 'timeline' && clampedReq.fishyTimeline) {
    return searchFishyTimeline7(clampedReq, ctx);
  }
  switch (clampedReq.mode) {
    case 'timeline':
      return search7Timeline(clampedReq, ctx);
    case 'timelineLeap':
      return search7TimelineLeap(clampedReq, ctx);
    case 'aroundTarget':
      return search7AroundTarget(clampedReq, ctx);
    default:
      return search7Normal(clampedReq, ctx);
  }
}

function search7TimelineLeap(
  req: MainGen7SearchRequest,
  ctx: ProgressContext,
): MainSearchOutput {
  const start = Math.max(0, req.startFrame);
  const target = Math.max(start, req.targetFrame);
  const modelNumber = req.npcCount + 1;
  const maxResults = req.maxResults ?? DEFAULT_MAX_RESULTS;
  const leapType = req.leapType ?? (req.kind === 'event' ? 0 : 2);
  const delayMinSec = req.leapDelayMinSec ?? (leapType === 1 ? 1 : 10);
  const delayMaxSec = req.leapDelayMaxSec ?? (leapType === 1 ? 3 : 100);
  const leapView = req.leapView ?? 'timeline';

  const totalDelay = calcFrame(req.seed, start, target, modelNumber)[0];
  const minDelay = Math.round(delayMinSec * 30);
  const maxDelay = Math.round(delayMaxSec * 30);
  const startTime = totalDelay - maxDelay;
  const endTime = totalDelay - minDelay;

  const sfmt = new SFMT(req.seed);
  for (let i = 0; i < start; i++) {
    sfmt.next();
  }
  const status = new ModelStatus(modelNumber, sfmt);
  status.isBoy = req.isBoy;

  let frame = start;
  for (let i = 0; i < startTime; i++) {
    frame += status.nextState();
  }
  for (let i = start; i < frame; i++) {
    sfmt.next();
  }

  const { pool, generator } = setupGen7Pool(req, sfmt);

  const frameList: number[] = [];
  const statusList: ModelStatus[] = [];
  const timeList: number[] = [];
  let bak2: ModelStatus | null = null;
  let bakFrame2 = 0;

  const loopStart = Math.max(0, startTime);
  const loopSpan = Math.max(1, endTime - loopStart);

  for (let i = loopStart; i < endTime; i++) {
    if (ctx.shouldAbort?.()) break;
    if ((i - loopStart) % 256 === 0) {
      ctx.onProgress?.(Math.min(70, Math.round(((i - loopStart) / loopSpan) * 70)));
    }

    let tmpFrame = frame;
    const stmp = status.clone();

    switch (leapType) {
      case 0: {
        // WC7 / Event
        for (let j = 0; j < 19; j++) {
          tmpFrame += stmp.nextState();
        }
        pool.rewind(tmpFrame - frame);
        pool.copyStatus(stmp);
        generator.generate(pool);
        const adv = pool.index - (tmpFrame - frame);
        tmpFrame += stmp.frameshift(adv);
        tmpFrame += stmp.nextState();
        break;
      }
      case 1: {
        // Menu
        stmp.fidgetCd = 3;
        break;
      }
      case 2: {
        // Dialogue
        tmpFrame += stmp.nextState();
        tmpFrame += stmp.nextState();
        tmpFrame += stmp.frameshift(1);
        tmpFrame += stmp.nextState();
        break;
      }
    }

    const bak1 = stmp.clone();
    const bakFrame1 = tmpFrame;

    while (tmpFrame < target) {
      tmpFrame += stmp.nextState();
    }
    if (tmpFrame === target) {
      frameList.push(frame);
      timeList.push(i);
      bak2 = bak1.clone();
      bakFrame2 = bakFrame1;
      statusList.push(stmp.clone());
    }

    const frameAdvance = status.nextState();
    frame += frameAdvance;
    for (let j = 0; j < frameAdvance; j++) {
      pool.addNext64(sfmt);
    }
  }

  if (frameList.length === 0 || !bak2) {
    ctx.onProgress?.(100);
    return { rows: [], standardTime: 0, truncated: false };
  }

  const frame0 = frameList[frameList.length - 1]!;
  const rows: FrameRow[] = [];
  let truncated = false;
  let standardTime = 0;

  if (leapView === 'timeline') {
    // Search7_TimelineLeap1: new timeline from bakFrame2
    const sfmt2 = new SFMT(req.seed);
    for (let i = 0; i < bakFrame2; i++) {
      sfmt2.next();
    }
    const { pool: pool2, generator: gen2 } = setupGen7Pool(req, sfmt2);
    let curFrame = bakFrame2;

    for (let i = 0; i <= maxDelay; i++) {
      if (ctx.shouldAbort?.()) break;
      const startF = curFrame;
      pool2.copyStatus(bak2);
      pool2.isPokemon = true;
      const result = pool2.generate7<Result7 | WildResult7>(gen2);
      const isPokemon = pool2.isPokemon;
      const jumpFlag = bak2.fidgetCd === 1 ? 1 : 0;
      const adv = bak2.nextState();
      curFrame += adv;
      for (let j = 0; j < adv; j++) {
        pool2.addNext64(sfmt2);
      }
      if (startF <= target && target < curFrame) {
        standardTime = i * 2;
      }
      if (!checkRngFilter(req.filter, result, isPokemon)) continue;
      rows.push({
        frame: startF,
        realtime: i * 2,
        shift: 0, // recomputed below after standardTime is finalized
        blink: jumpFlag,
        frame0,
        result,
      });
      if (rows.length >= maxResults) {
        truncated = true;
        break;
      }
    }
    for (const row of rows) {
      row.shift = row.realtime - standardTime;
    }
  } else {
    // Search7_TimelineLeap2: spread of all Frame1 jumps landing on target
    const sfmt2 = new SFMT(req.seed);
    for (let i = 0; i < target; i++) {
      sfmt2.next();
    }
    const { pool: pool2, generator: gen2 } = setupGen7Pool(req, sfmt2);
    standardTime = timeList[timeList.length - 1]! * 2;

    for (let i = 0; i < frameList.length; i++) {
      pool2.copyStatus(statusList[i]!);
      pool2.isPokemon = true;
      const result = pool2.generate7<Result7 | WildResult7>(gen2);
      if (!checkRngFilter(req.filter, result, pool2.isPokemon)) continue;
      const rt = timeList[i]! * 2;
      rows.push({
        frame: target,
        realtime: rt,
        shift: rt - standardTime,
        blink: 0,
        frame0: frameList[i]!,
        result,
      });
      if (rows.length >= maxResults) {
        truncated = true;
        break;
      }
    }
  }

  ctx.onProgress?.(100);
  return {
    rows,
    standardTime,
    truncated,
    leapInfo: {
      frame0,
      targetFrame: target,
      hitCount: frameList.length,
    },
  };
}

function search7Normal(req: MainGen7SearchRequest, ctx: ProgressContext): MainSearchOutput {
  const method = req.kind === 'stationary' || req.kind === 'mainEgg' ? 0 : req.kind === 'event' ? 1 : 2;
  const min = Math.max(req.startFrame, getStartingFrame(req.isUltra, method));
  const max = req.endFrame;
  const maxResults = req.maxResults ?? DEFAULT_MAX_RESULTS;
  if (min > max) {
    return { rows: [], standardTime: 0, truncated: false };
  }

  const sfmt = new SFMT(req.seed);
  const modelNumber = req.npcCount + 1;
  const blinkFlags = getBlinkFlagList(min, max, sfmt, modelNumber);
  sfmt.advance(min);

  const status = new ModelStatus(modelNumber, sfmt);
  const stmp = new ModelStatus(modelNumber, sfmt);
  status.raining = req.raining;
  stmp.raining = req.raining;

  const { pool, generator, standardTime } = setupGen7Pool(req, sfmt);
  const rows: FrameRow[] = [];
  const totalSpan = Math.max(1, max - min);

  let frameadvance = 0;
  let realtime = 0;
  let frametime = 0;
  let lastReport = 0;

  for (let i = min; i <= max; ) {
    if (ctx.shouldAbort?.()) break;

    do {
      frameadvance = status.nextState();
      realtime++;
    } while (frameadvance === 0);

    do {
      pool.copyStatus(stmp);
      pool.isPokemon = true;
      const result = pool.generate7<Result7 | WildResult7>(generator);
      const isPokemon = pool.isPokemon;

      pool.addNext64(sfmt);
      frameadvance--;
      i++;
      if (i > max + 1) continue;

      const blink = blinkFlags[i - min - 1] ?? 0;
      if (req.filter.blinkOnly && blink < 4) continue;
      if (req.filter.safeOnly && blink >= 2) continue;
      if (!checkRngFilter(req.filter, result, isPokemon)) continue;

      const rt = frametime * 2;
      rows.push({
        frame: i - 1,
        realtime: rt,
        shift: rt - standardTime,
        blink,
        specialSlotStr: req.kind === 'wild' ? req.specialSlotStr : undefined,
        result,
      });
    } while (frameadvance > 0);

    if (rows.length > maxResults) {
      return { rows, standardTime, truncated: true };
    }

    status.copyTo(stmp);
    frametime = realtime;

    if (ctx.onProgress && i - lastReport >= 2000) {
      lastReport = i;
      ctx.onProgress(Math.min(99, Math.round(((i - min) / totalSpan) * 100)));
    }
  }

  ctx.onProgress?.(100);
  return { rows, standardTime, truncated: false };
}

function search7AroundTarget(req: MainGen7SearchRequest, ctx: ProgressContext): MainSearchOutput {
  const sfmt = new SFMT(req.seed);
  const modelNumber = req.npcCount + 1;
  const target = req.targetFrame;
  const min = Math.max(0, target - 100);
  const max = target + 100;
  const start = Math.min(req.startFrame, min);

  const blinkFlags = getBlinkFlagList(min, max, sfmt, modelNumber);

  let i = 0;
  for (; i < start; i++) {
    sfmt.next();
  }

  const status = new ModelStatus(modelNumber, sfmt);
  const stmp = new ModelStatus(modelNumber, sfmt);
  status.raining = req.raining;
  stmp.raining = req.raining;

  const { pool, generator, standardTime } = setupGen7Pool(req, sfmt);
  const collected: FrameRow[] = [];

  let frameadvance = 0;
  let realtime = 0;
  let frametime = 0;

  for (; i <= max; ) {
    if (ctx.shouldAbort?.()) break;
    while (frameadvance === 0) {
      frameadvance = status.nextState();
      realtime++;
    }
    for (; frameadvance > 0; frameadvance--, i++) {
      if (min <= i && i <= max) {
        pool.copyStatus(stmp);
        pool.isPokemon = true;
        const result = pool.generate7<Result7 | WildResult7>(generator);
        const blink = blinkFlags[i - min] ?? 0;
        const rt = frametime * 2;
        collected.push({
          frame: i,
          realtime: rt,
          shift: rt - standardTime,
          blink,
          specialSlotStr: req.kind === 'wild' ? req.specialSlotStr : undefined,
          result,
        });
      }
      pool.addNext64(sfmt);
    }
    status.copyTo(stmp);
    frametime = realtime;
  }

  // Second pass: EC matching for Stationary / Event / Wild (not MainEgg)
  if (req.kind !== 'mainEgg' && collected.length > 0) {
    collected.sort((a, b) => {
      const aD = (a.result as Result7 | WildResult7).frameDelayUsed;
      const bD = (b.result as Result7 | WildResult7).frameDelayUsed;
      return a.frame + aD - (b.frame + bD);
    });

    const ecSet = new Set<number>();
    for (const f of collected) ecSet.add(f.result.ec);
    const ecLast = collected[collected.length - 1]!.result.ec;

    const sfmt2 = new SFMT(req.seed);
    const first = collected[0]!;
    const starting = first.frame + (first.result as Result7 | WildResult7).frameDelayUsed;
    sfmt2.advance(starting);

    const pool2 = new RngPool();
    pool2.createBuffer64(sfmt2, 5000);
    pool2.considerDelay = false;

    if (generator instanceof Stationary7) {
      const syncNat = generator.synchroStat;
      generator.assumeSynced = syncNat < 25 ? (req.filter.natures[syncNat] ?? false) : false;
    }

    let ec = -1;
    let nFrame = -1;
    let curTime = 0;
    let randLo = 0;
    let randHi = 0;
    let safety = 0;

    do {
      if (ctx.shouldAbort?.() || ++safety > 50_000) break;
      pool2.modelNumber = modelNumber;
      pool2.resetModelStatus();
      pool2.isPokemon = true;
      const result = pool2.generate7<Result7 | WildResult7>(generator);
      ec = result.ec;
      pool2.addNext64(sfmt2);

      if (ecSet.has(ec)) {
        // LastOrDefault matching EC
        for (let k = collected.length - 1; k >= 0; k--) {
          const item = collected[k]!;
          if (item.result.ec === ec) {
            nFrame = item.frame;
            curTime = item.realtime;
            const r = item.result as Result7 | WildResult7;
            randLo = r.randLo;
            randHi = r.randHi;
            break;
          }
        }
        continue;
      } else if (nFrame > -1) {
        result.randLo = randLo;
        result.randHi = randHi;
        collected.push({
          frame: nFrame,
          realtime: curTime,
          shift: curTime - standardTime,
          blink: 4, // "<?>"
          specialSlotStr: req.kind === 'wild' ? req.specialSlotStr : undefined,
          result,
        });
      }
    } while (ec !== ecLast);
  }

  const rows = collected
    .filter((f) => checkRngFilter(req.filter, f.result, true))
    .sort((a, b) => a.frame - b.frame);

  ctx.onProgress?.(100);
  return { rows, standardTime, truncated: false };
}

function search7Timeline(req: MainGen7SearchRequest, ctx: ProgressContext): MainSearchOutput {
  const sfmt = new SFMT(req.seed);
  const modelNumber = req.npcCount + 1;
  const startFrame = req.startFrame;
  const targetFrame = req.targetFrame;
  const maxResults = req.maxResults ?? DEFAULT_MAX_RESULTS;

  const firstBlink = getBlinkFlagList(startFrame, startFrame, sfmt, modelNumber);
  sfmt.advance(startFrame);

  const status = new ModelStatus(modelNumber, sfmt);
  status.isBoy = req.isBoy;
  status.raining = req.raining;

  const { pool, generator, standardTime: defaultStd } = setupGen7Pool(req, sfmt);
  let standardTime = defaultStd;

  const totalTime = req.timeSpanSec * 30;
  let frame = startFrame;
  let firstJumpFrame =
    req.jumpFrame >= startFrame && (req.fidgetTimeline || req.xMenu)
      ? req.jumpFrame
      : Number.MAX_SAFE_INTEGER;

  const rows: FrameRow[] = [];
  let truncated = false;
  let lastReport = 0;

  for (let i = 0; i <= totalTime; i++) {
    if (ctx.shouldAbort?.()) break;
    const currentFrame = frame;

    pool.copyStatus(status);
    pool.isPokemon = true;
    const result = pool.generate7<Result7 | WildResult7>(generator);
    const isPokemon = pool.isPokemon;

    if (frame >= firstJumpFrame) {
      status.fidgetCd = req.xMenu ? 3 : 1;
      firstJumpFrame = Number.MAX_SAFE_INTEGER;
    }
    const jumpFlag = status.fidgetCd === 1 ? 1 : 0;

    const frameadvance = status.nextState();
    frame += frameadvance;
    for (let j = 0; j < frameadvance; j++) {
      pool.addNext64(sfmt);
    }

    if (currentFrame <= targetFrame && targetFrame < frame) {
      standardTime = i * 2;
    }

    if (checkRngFilter(req.filter, result, isPokemon)) {
      rows.push({
        frame: currentFrame,
        realtime: i * 2,
        shift: 0,
        blink: jumpFlag,
        specialSlotStr: req.kind === 'wild' ? req.specialSlotStr : undefined,
        result,
      });
      if (rows.length > maxResults) {
        truncated = true;
        break;
      }
    }

    if (ctx.onProgress && i - lastReport >= 1000) {
      lastReport = i;
      ctx.onProgress(Math.min(99, Math.round((i / Math.max(1, totalTime)) * 100)));
    }
  }

  for (const r of rows) {
    r.shift = r.realtime - standardTime;
  }
  if (rows.length > 0 && rows[0]!.frame === startFrame) {
    rows[0]!.blink = firstBlink[0] ?? 0;
  }

  ctx.onProgress?.(100);
  return { rows, standardTime, truncated };
}

function searchFishyTimeline7(req: WildSearchRequest, ctx: ProgressContext): MainSearchOutput {
  const sfmt = new SFMT(req.seed);
  const modelNumber = req.npcCount + 1;
  const startFrame = req.startFrame;
  const maxResults = req.maxResults ?? DEFAULT_MAX_RESULTS;

  sfmt.advance(startFrame);

  const status = new ModelStatus(modelNumber, sfmt);
  status.raining = req.raining;

  const { pool, generator, standardTime } = setupGen7Pool(req, sfmt);
  const totalTime = req.timeSpanSec * 30;
  const fsetting = pool.fsetting;
  let frameInput1 = startFrame;
  let timeWindow = 2;

  const rows: FrameRow[] = [];
  let lastReport = 0;

  for (let i = 0; i <= totalTime; i++) {
    if (ctx.shouldAbort?.()) break;

    pool.save();
    pool.rewind(0);
    pool.copyStatus(status);

    const [fLo, fHi] = pool.getRand64Parts();
    const fishingDelay = modU64(fLo, fHi, 60) + fsetting.basedelay;

    if (req.fishyOverview) {
      pool.advance(1);
    } else {
      const [wLo, wHi] = pool.getRand64Parts();
      timeWindow = modU64(wLo, wHi, 15) + fsetting.platdelay + 14;
    }

    pool.timeElapse7(fishingDelay);

    const [bLo, bHi] = pool.getRand64Parts();
    if (fsetting.suctioncups || modU64(bLo, bHi, 100) < 50) {
      pool.timeElapse7(1);
      let frameInput2 = pool.index + frameInput1;
      pool.saveStatus();

      for (let j = 2; j <= timeWindow; j++) {
        pool.loadStatus();
        pool.timeElapse7(1);
        frameInput2 += pool.index;
        pool.saveStatus();
        pool.delayTime = fsetting.pkmdelay + Math.max(0, fsetting.platdelay - j);

        pool.isPokemon = true;
        const result = pool.generate7<WildResult7>(generator);
        if (!checkRngFilter(req.filter, result, pool.isPokemon)) continue;

        if (req.fishyOverview) {
          const [sLo, sHi] = pool.getSavePoint64Parts();
          result.randLo = sLo;
          result.randHi = sHi;
        }
        result.frameDelayUsed += frameInput2 - frameInput1;

        const rt = (i + j + fishingDelay) * 2;
        rows.push({
          frame: frameInput2,
          frame0: frameInput1,
          realtime: rt,
          shift: rt - standardTime,
          blink: 0,
          specialSlotStr: req.specialSlotStr,
          result,
        });
      }
    }

    pool.load();
    if (rows.length > maxResults) {
      return { rows, standardTime, truncated: true };
    }

    const frameadvance = status.nextState();
    frameInput1 += frameadvance;
    for (let j = 0; j < frameadvance; j++) {
      pool.addNext64(sfmt);
    }

    if (ctx.onProgress && i - lastReport >= 500) {
      lastReport = i;
      ctx.onProgress(Math.min(99, Math.round((i / Math.max(1, totalTime)) * 100)));
    }
  }

  ctx.onProgress?.(100);
  return { rows, standardTime, truncated: false };
}

export function runEgg7Search(
  req: EggSearchRequest,
  ctx: ProgressContext = {},
): EggSearchOutput {
  if (req.eggSeed.every((v) => v === 0)) {
    throw new Error('Egg Seed non valido (tutti zeri). Inserisci uno stato TinyMT valido.');
  }
  const rng = new TinyMT(req.eggSeed);
  const eggGen = new Egg7(req.config);
  const pool = new RngPool();
  const maxResults = req.maxResults ?? DEFAULT_MAX_RESULTS;

  if (req.mode === 'list') {
    const min = Math.max(0, req.eggMin - 1);
    const max = Math.max(min, req.eggMax - 1);
    const target = req.targetFrame;

    for (let i = 0; i < min; i++) rng.next();
    pool.createBuffer32(rng, 100);

    const rows: FrameRow[] = [];
    let frame = 0;
    let gotTarget = false;
    let acceptedEggs = 0;
    let rejectedSteps = 0;

    for (let i = 0; i <= max; i++) {
      if (ctx.shouldAbort?.()) break;
      const result = pool.generateEgg7<EggResult7>((p) => eggGen.generate(p));
      const advance = result.framesUsed;

      if (!gotTarget && frame <= target && target < frame + advance) {
        acceptedEggs = i;
        rejectedSteps = target - frame;
        gotTarget = true;
      }

      frame += advance;
      for (let j = advance; j > 0; j--) {
        pool.addNext32(rng);
      }

      if (i < min || !checkRngFilter(req.filter, result, true)) continue;
      rows.push({
        frame: frame - advance,
        eggNum: i + 1,
        realtime: -1,
        shift: 0,
        blink: 0,
        result,
      });
      if (rows.length > maxResults) {
        return {
          rows,
          truncated: true,
          instruction: {
            acceptedEggs,
            rejectedSteps,
            isShortestPath: false,
            reachable: gotTarget,
          },
        };
      }
    }

    ctx.onProgress?.(100);
    return {
      rows,
      truncated: false,
      instruction: {
        acceptedEggs,
        rejectedSteps,
        isShortestPath: false,
        reachable: gotTarget,
      },
    };
  }

  if (req.mode === 'shortestPath') {
    const max = Math.max(0, req.targetFrame);
    pool.createBuffer32(rng, 100);
    const allResults: EggResult7[] = [];

    for (let i = 0; i <= max; i++) {
      if (ctx.shouldAbort?.()) break;
      allResults.push(pool.generateEgg7<EggResult7>((p) => eggGen.generate(p)));
      pool.addNext32(rng);
    }

    const advList = allResults.map((e) => e.framesUsed);
    const path = calcEggShortestPath(advList);
    const rows: FrameRow[] = [];
    let rejectCount = 0;

    for (let i = 0; i < path.length; i++) {
      const index = path[i]!;
      const result = allResults[index]!;
      result.hiddenPower = getHiddenPowerValue(result.ivs);
      const isAccept = i === path.length - 1 || path[i + 1]! - index > 1;
      if (!isAccept) rejectCount++;
      rows.push({
        frame: index,
        eggNum: i + 1,
        realtime: -1,
        shift: 0,
        blink: 0,
        acceptReject: isAccept ? 'accept' : 'reject',
        result,
      });
    }

    ctx.onProgress?.(100);
    return {
      rows,
      truncated: false,
      instruction: {
        acceptedEggs: path.length - rejectCount - 1,
        rejectedSteps: rejectCount,
        isShortestPath: true,
        reachable: true,
      },
    };
  }

  // Frame Range mode
  const min = req.startFrame;
  const max = req.endFrame;
  if (min > max) return { rows: [], truncated: false };

  for (let i = 0; i < min; i++) rng.next();
  pool.createBuffer32(rng, 100);

  const otherTsvSet = new Set(req.config.otherTsvs);
  const checkRandomNumber = (rn: number) => {
    const sv = (((rn >>> 16) ^ (rn & 0xffff)) >>> 4) & 0xfff;
    return sv === req.config.tsv || (req.config.considerOtherTsv && otherTsvSet.has(sv));
  };

  const rows: FrameRow[] = [];
  const total = Math.max(1, max - min);
  let lastReport = 0;

  for (let i = min; i <= max; i++) {
    if (ctx.shouldAbort?.()) break;
    const result = pool.generateEgg7<EggResult7>((p) => eggGen.generate(p));
    pool.addNext32(rng);

    const passed =
      checkRngFilter(req.filter, result, true) ||
      (req.shinyRemind && checkRandomNumber(result.randNum));
    if (!passed) continue;

    rows.push({
      frame: i,
      realtime: -1,
      shift: 0,
      blink: 0,
      result,
    });
    if (rows.length > maxResults) {
      return { rows, truncated: true };
    }
    if (ctx.onProgress && i - lastReport >= 5000) {
      lastReport = i;
      ctx.onProgress(Math.min(99, Math.round(((i - min) / total) * 100)));
    }
  }

  ctx.onProgress?.(100);
  return { rows, truncated: false };
}

export function runId7Search(
  req: IdSearchRequest,
  ctx: ProgressContext = {},
): IdSearchOutput {
  const min = Math.max(req.startFrame, getStartingFrame(req.isUltra, 4));
  const max = req.endFrame;
  const maxResults = req.maxResults ?? DEFAULT_MAX_RESULTS;
  if (min > max) return { rows: [], truncated: false };

  const rng = new SFMT(req.seed);
  rng.advance(min);

  const compiledFilter = new CompiledIdFilter(req.filter);
  const rows: IdResult7[] = [];
  const total = Math.max(1, max - min);
  let lastReport = 0;

  for (let i = min; i <= max; i++) {
    if (ctx.shouldAbort?.()) break;
    const [lo, hi] = rng.nextU64Parts();
    const id = makeId7(i, lo, hi);
    id.clock = (id.clock + req.clockCorrection) % 17;

    if (compiledFilter.check(id)) {
      rows.push(id);
      if (rows.length > maxResults) {
        return { rows, truncated: true };
      }
    }

    if (ctx.onProgress && i - lastReport >= 10000) {
      lastReport = i;
      ctx.onProgress(Math.min(99, Math.round(((i - min) / total) * 100)));
    }
  }

  ctx.onProgress?.(100);
  return { rows, truncated: false };
}
