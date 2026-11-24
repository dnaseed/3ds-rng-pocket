import { TinyMT } from '../rng/tinymt';
import type { TinyState } from '../rng/types';
import { MAX_FRAME } from '../core/pokemonMath';
import { isTinyState6 } from './id6';

export type TimelineMethod6 = 'instant' | 'cutscene' | 'horde' | 'safari' | 'radar' | 'fishing' | 'smash' | 'shadow' | 'normal' | 'id' | 'weather';
export interface TinyCall6 { frame: number; type: number }
export interface Timeline6Request {
  state: TinyState;
  calls: TinyCall6[];
  method: TimelineMethod6;
  maxFrame: number;
  split: boolean;
  delay: number;
  cry: number | null;
  party: number;
  oras: boolean;
  slots: number;
  rate: number;
  chain: number;
  boost: boolean;
}

export const scale6 = (word: number, bound: number) => Math.floor(word * bound / 0x100000000);
export const flute6 = (roll: number) => roll < 40 ? 1 : roll < 70 ? 2 : roll < 90 ? 3 : 4;
export function slot6(roll: number, weights: readonly number[]) {
  let i = 0;
  for (; i < weights.length - 1; i++) {
    roll -= weights[i]!;
    if (roll < 0) break;
  }
  return i + 1;
}
export const timelineMethods6 = ['instant','cutscene','horde','safari','radar','fishing','smash','shadow','normal','id','weather'] as const;

export function isCalibration6(value: unknown): value is Timeline6Request {
  if (!value || typeof value !== 'object') return false;
  const q = value as Partial<Timeline6Request>;
  const integer = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
  return isTinyState6(q.state) && !!q.method && timelineMethods6.includes(q.method) &&
    Array.isArray(q.calls) && q.calls.length >= 1 && q.calls.length <= 4 &&
    q.calls.every((call, i, calls) => call && integer(call.frame, calls[i-1]?.frame ?? 0, MAX_FRAME) && [0,1,3,4,5,6,7].includes(call.type)) &&
    integer(q.maxFrame, q.calls[0]!.frame, MAX_FRAME) && integer(q.delay, 0, 4000) &&
    (q.cry === null || integer(q.cry, 0, 4000)) && integer(q.party, 1, 6) && integer(q.slots, 2, 3) &&
    integer(q.rate, 0, 100) && integer(q.chain, 0, 999) &&
    typeof q.split === 'boolean' && typeof q.oras === 'boolean' && typeof q.boost === 'boolean';
}

export const normalSlots6 = [10,10,10,10,10,10,10,10,10,5,4,1];
export const fishingSlots6 = [60,35,5];
export const smashSlots6 = [50,30,15,4,1];
export function item6(roll: number, compoundEyes = false) {
  const thresholds = compoundEyes ? [60,80,85] : [50,55,56];
  const index = thresholds.findIndex(t => roll < t);
  return index < 0 ? 3 : index;
}

export class TinyClock6 {
  rng: TinyMT;
  index = 0;
  constructor(state: TinyState, public calls: TinyCall6[], public frame: number) {
    this.rng = new TinyMT(state);
    this.calls = [...calls];
    this.sort();
  }
  private sort() { this.calls.sort((a,b) => b.frame - a.frame || a.type - b.type); }
  clone() {
    const copy = new TinyClock6(this.rng.getState(), [], this.frame);
    copy.calls = [...this.calls]; // Includes the immediate, unsorted follow-up of a blink.
    copy.index = this.index;
    return copy;
  }
  next() { this.index++; return this.rng.nextU32(); }
  roll(bound: number) { return scale6(this.next(), bound); }
  skip(count: number) { for (let i = 0; i < count; i++) this.next(); }
  advanceCall() {
    const word = this.next();
    const call = this.calls.pop();
    if (!call) return word;
    this.frame = call.frame;
    let type = call.type;
    let delay: number;
    switch (type) {
      case 0:
        this.calls.push({ frame: this.frame, type: word > 0x55555555 ? 1 : 2 });
        return word;
      case 1: type = 0; delay = scale6(word,60) * 2 + 124; break;
      case 2: type = 1; delay = word > 0x55555555 ? 12 : 20; break;
      case 3: delay = scale6(word,90) * 2 + 780; break;
      case 4: delay = word % 3 === 0 ? 360 : 180; break;
      case 5: delay = 542 - scale6(word,180) * 2; break;
      case 6: delay = 16; break;
      case 7: delay = scale6(word,10) * 30 + 60; break;
      default: throw new RangeError('Invalid TinyMT call');
    }
    this.calls.push({ frame: this.frame + delay, type });
    this.sort();
    return word;
  }
  elapse(frames: number) {
    const target = this.frame + frames;
    while (this.calls.length && this.calls[this.calls.length - 1]!.frame < target) this.advanceCall();
    this.frame = target;
  }
}

export function delayedTiny6(source: TinyClock6, frame: number, q: Timeline6Request) {
  const clock = source.clone();
  clock.frame = frame;
  clock.calls = clock.calls.filter(call => call.type !== 3);
  switch (q.method) {
    case 'fishing':
      clock.elapse(q.delay); clock.skip(3 * q.party); clock.elapse(132);
      clock.elapse(clock.roll(7) * 30 + 60);
      break;
    case 'smash':
      clock.elapse(16); clock.skip(3); clock.elapse(q.delay - 228); clock.next(); clock.elapse(212);
      break;
    case 'weather':
      clock.elapse(146); clock.next();
      if (q.delay === 324) { clock.elapse(118); clock.next(); clock.elapse(60); }
      else clock.elapse(180);
      clock.skip(3 * q.party); clock.elapse(124);
      break;
    default:
      if (q.cry !== null) { clock.elapse(q.cry); clock.next(); clock.elapse(q.delay - q.cry); }
      else clock.elapse(q.delay);
  }
  return clock;
}

export function horde6(state: TinyState, party: number, oras: boolean) {
  const rng = new TinyMT(state);
  const roll = (n: number) => scale6(rng.nextU32(), n);
  for (let i = 0; i < 3 * party + (oras ? 15 : 27); i++) rng.next();
  const lead = roll(100);
  const slot = slot6(roll(100), fishingSlots6);
  const ha = roll(100) < 20 ? roll(5) + 1 : 0;
  const flutes = Array.from({ length: 5 }, () => oras ? flute6(roll(100)) : 0);
  rng.next();
  const items = Array.from({ length: 5 }, () => roll(100));
  return { lead, slot, ha, flutes, items };
}

export function radar6(state: TinyState, party: number, chain: number, boost: boolean) {
  const rng = new TinyMT(state);
  const roll = (n: number) => scale6(rng.nextU32(), n);
  for (let i = 0; i < 3 * party; i++) rng.next();
  const music = roll(100);
  const patches = [];
  for (let i = 0; i < 5; i++) {
    const ring = i < 4 ? i : roll(3);
    const direction = roll(4);
    const location = roll(ring * 2 + 3);
    const x = direction < 2 ? 3-ring+location : direction === 2 ? 3-ring : 5+ring;
    const y = direction >= 2 ? 3-ring+location : direction === 0 ? 3-ring : 5+ring;
    let kind = i === 4 ? 'X' : 'B';
    if (i < 4 && roll(100) < [23,43,63,83][i]!) {
      rng.next();
      const chance = (boost && music >= 50) || chain >= 40 ? 100 : 8100 - chain * 200;
      kind = rng.nextU32() * chance <= 0xffffffff ? 'S' : 'G';
    }
    patches.push({ ring, x, y, kind });
  }
  return { music: music < 2 ? 'A' : music > 49 ? 'M' : '-', patches };
}

export interface TimelineRow6 {
  frame: number; end: number; index: number; hit: number; rand: number; state: TinyState;
  sync: boolean; slot?: number; encounter?: number; item?: number; flute?: number;
  horde?: ReturnType<typeof horde6>; radar?: ReturnType<typeof radar6>;
}

function mark(q: Timeline6Request, source: TinyClock6, hit: TinyClock6, frame: number, end: number, rand: number) {
  const state = source.rng.getState();
  const row: TimelineRow6 = { frame, end, index: source.index, hit: hit.index, rand, state, sync: false };
  if (q.method === 'horde') {
    row.horde = horde6(state, q.party, q.oras);
    row.slot = row.horde.slot;
    row.sync = row.horde.lead < 50;
    return row;
  }
  if (q.method === 'cutscene') hit.skip(3 * q.party);
  if (q.method === 'smash') row.encounter = hit.roll(3);
  row.sync = hit.next() < 0x80000000;
  if (['instant','cutscene','weather','id'].includes(q.method)) return row;
  if (['normal','fishing','safari'].includes(q.method)) row.encounter = hit.roll(100);
  // TinyTimeline.MarkEncounter uses slot tables 49 and 50 for Safari.
  const weights = q.method === 'safari' ? (q.slots === 2 ? [50,50] : [55,40,5]) :
    q.method === 'fishing' ? fishingSlots6 : q.method === 'smash' ? smashSlots6 : normalSlots6;
  row.slot = slot6(hit.roll(100), weights);
  if (q.oras) row.flute = flute6(hit.roll(100));
  hit.next();
  row.item = item6(hit.roll(100));
  if (q.method === 'radar') row.radar = radar6(state, q.party, q.chain, q.boost);
  return row;
}

/** A raw span covers (previous, next] with hittable MT frames two apart. */
export function* timeline6(q: Timeline6Request): Generator<TimelineRow6> {
  const start = q.calls[0]?.frame;
  if (!isTinyState6(q.state) || start === undefined || q.calls.length > 4 ||
      q.calls.some((c,i) => !Number.isInteger(c.frame) || c.frame < (q.calls[i-1]?.frame ?? 0) ||
        ![0,1,3,4,5,6,7].includes(c.type)) ||
      !Number.isInteger(q.maxFrame) || q.maxFrame < start || q.maxFrame > MAX_FRAME) throw new RangeError('Invalid TinyMT calibration');
  const clock = new TinyClock6(q.state, q.calls, start - 2);
  while (clock.frame <= q.maxFrame) {
    const source = clock.clone();
    const rand = clock.advanceCall();
    if (!q.split) {
      yield mark(q, source, source.clone(), source.frame + 2, clock.frame, rand);
      continue;
    }
    const first = Math.max(start + 2, source.frame + 2);
    if (first > q.maxFrame || first > clock.frame) continue;
    let begin = first;
    let hit = delayedTiny6(source, begin, q);
    for (let f = first + 2; f <= clock.frame; f += 2) {
      const next = delayedTiny6(source, f, q);
      if (next.index === hit.index) continue;
      yield mark(q, source, hit, begin, f - 2, rand);
      begin = f;
      hit = next;
      if (begin > q.maxFrame) break;
    }
    if (begin <= q.maxFrame) yield mark(q, source, hit, begin, clock.frame, rand);
  }
}
