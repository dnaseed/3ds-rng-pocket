import { MAX_FRAME } from '../core/pokemonMath';
import { MT19937 } from '../rng/mt19937';
import type { Search6Output } from './searches';

export interface FrameRange6 { seed: number; minFrame: number; maxFrame: number }

/** Reuses generated MT words across overlapping lookahead windows. */
export class FramePool6 {
  private readonly rng: MT19937;
  private words: number[] = [];
  private states: number[] = [];
  private head = 0;
  private position = 0;
  constructor(seed: number, start: number) {
    this.rng = new MT19937(seed);
    this.rng.advance(start);
  }
  next() {
    const index = this.position++;
    while (this.words.length <= index) {
      this.states.push(this.rng.currentStateWord());
      this.words.push(this.rng.nextU32());
    }
    return this.words[index]!;
  }
  get state() { return this.states[this.head]!; }
  begin(offset: number) { this.position = this.head + offset; }
  skip(n: number) { this.position += n; }
  roll(n: number) { return Math.floor(this.next() * n / 0x100000000); }
  advance() {
    if (++this.head === 1024) {
      this.words.splice(0, this.head); this.states.splice(0, this.head);
      this.head = 0;
    }
  }
}

export function collectFrames6<Row>(q: FrameRange6, generate: (pool: FramePool6, frame: number, rand: number) => Row | null,
  progress?: (percent: number) => void): Search6Output<Row> {
  if (!Number.isInteger(q.minFrame) || !Number.isInteger(q.maxFrame) || q.minFrame < 0 || q.minFrame > q.maxFrame ||
    q.maxFrame > MAX_FRAME || !Number.isInteger(q.seed) || q.seed < 0 || q.seed > 0xffffffff) throw new RangeError('Invalid MT range');
  const pool = new FramePool6(q.seed, q.minFrame);
  const rows: Row[] = [];
  for (let frame = q.minFrame; frame <= q.maxFrame; frame++, pool.advance()) {
    pool.begin(0);
    const rand = pool.next();
    const row = generate(pool, frame, rand);
    if (row !== null) {
      if (rows.length === 5000) return { rows, truncated: true };
      rows.push(row);
    }
    if ((frame-q.minFrame)%256 === 0) progress?.(Math.floor(100*(frame-q.minFrame)/(q.maxFrame-q.minFrame+1)));
  }
  return { rows, truncated: false };
}
