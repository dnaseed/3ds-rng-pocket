import { imul32 } from '../math/uint';

const STATE_SIZE = 624;
const PERIOD_OFFSET = 397;

export class MT19937 {
  private readonly state = new Uint32Array(STATE_SIZE);
  private index = 0;

  constructor(seed: number | readonly number[]) {
    if (typeof seed === 'number') {
      this.initSeed(seed);
    } else {
      this.initKey(seed);
    }
  }

  reseed(seed: number): void {
    this.index = 0;
    this.initSeed(seed);
  }

  private initSeed(seed: number): void {
    this.state[0] = seed;
    for (let i = 1; i < STATE_SIZE; i++) {
      const previous = this.state[i - 1]!;
      this.state[i] = imul32(1812433253, previous ^ (previous >>> 30)) + i;
    }
  }

  private initKey(key: readonly number[]): void {
    if (key.length === 0) throw new RangeError('MT19937 key must contain at least one word');
    this.initSeed(19650218);

    let i = 1;
    let j = 0;
    for (let count = Math.max(STATE_SIZE, key.length); count > 0; count--) {
      const previous = this.state[i - 1]!;
      const mixed = (this.state[i]! ^ imul32(previous ^ (previous >>> 30), 1664525)) >>> 0;
      this.state[i] = mixed + key[j]! + j;
      i = this.nextKeyIndex(i);
      j = (j + 1) % key.length;
    }
    for (let count = STATE_SIZE - 1; count > 0; count--) {
      const previous = this.state[i - 1]!;
      this.state[i] = (this.state[i]! ^ imul32(previous ^ (previous >>> 30), 1566083941)) - i;
      i = this.nextKeyIndex(i);
    }
    this.state[0] = 0x80000000;
  }

  private nextKeyIndex(index: number): number {
    if (index < STATE_SIZE - 1) return index + 1;
    this.state[0] = this.state[STATE_SIZE - 1]!;
    return 1;
  }

  private twistWord(): number {
    const current = this.index;
    const next = (current + 1) % STATE_SIZE;
    const source = (current + PERIOD_OFFSET) % STATE_SIZE;
    const joined = (this.state[current]! & 0x80000000) | (this.state[next]! & 0x7fffffff);
    const word = (this.state[source]! ^ (joined >>> 1) ^ ((joined & 1) ? 0x9908b0df : 0)) >>> 0;
    this.state[current] = word;
    this.index = next;
    return word;
  }

  nextU32(): number {
    let word = this.twistWord();
    word ^= word >>> 11;
    word ^= (word << 7) & 0x9d2c5680;
    word ^= (word << 15) & 0xefc60000;
    return (word ^ (word >>> 18)) >>> 0;
  }

  advance(count: number): void {
    if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Invalid MT19937 advance');
    for (let i = 0; i < count; i++) this.twistWord();
  }

  /** Untwisted word shown as State in 3DSRNGTool. */
  currentStateWord(): number {
    return this.state[this.index]!;
  }
}
