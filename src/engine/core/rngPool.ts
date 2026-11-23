import { modU64 } from '../math/uint';
import { SFMT } from '../rng/sfmt';
import { TinyMT } from '../rng/tinymt';
import type { TinyState } from '../rng/types';
import { ModelStatus } from './modelStatus';
import type { FishingSetting } from './types';

export interface Generator7 {
  delay(pool: RngPool): void;
  generate(pool: RngPool): unknown;
}

/**
 * Instantiable, side-effect-free TypeScript port of Pk3DSRNGTool.Core.RNGPool (Gen 7).
 * Uses dual Uint32Arrays (lo, hi) for 64-bit SFMT frames and Uint32Array for 32-bit TinyMT frames.
 */
export class RngPool {
  private randList = new Uint32Array(0);
  private randListLo = new Uint32Array(0);
  private randListHi = new Uint32Array(0);
  private rngStates: TinyState[] = [];

  private tail = 0;
  private bufferSize = 0;
  private pointer = 0;

  public considerDelay = false;
  public delayTime = 0;

  // Gen 7 time keeping
  public raining = false;
  public phase = false;
  public modelNumber = 1;
  public remainFrame = new Int32Array(1);

  public delayType = 0;
  public preHoneyCorrection = 1;
  public honeyDelay = 63; // USUM: 63, SM: 93
  public ultraWild = true;

  public fsetting: FishingSetting = {
    basedelay: 78,
    suctioncups: false,
    platdelay: 14,
    pkmdelay: 0,
  };
  public wildCry = false;
  public isPokemon = true;

  private oldTail = 0;
  private remainFrameBak = new Int32Array(0);
  private phaseBak = false;

  private get head(): number {
    return this.tail === this.bufferSize - 1 ? 0 : this.tail + 1;
  }

  public get index(): number {
    let i = this.pointer - this.tail;
    if (i < 0) i += this.bufferSize;
    return i;
  }

  private set index(val: number) {
    this.pointer = this.tail + val;
    if (this.pointer >= this.bufferSize) {
      this.pointer -= this.bufferSize;
    }
  }

  public rewind(idx: number): void {
    this.index = idx;
  }

  public advance(d: number): void {
    this.pointer += d;
    if (this.pointer >= this.bufferSize) {
      this.pointer -= this.bufferSize;
    }
  }

  public rewindPointerToTail(): void {
    this.pointer = this.tail;
  }

  public getRand32(): number {
    this.pointer++;
    if (this.pointer >= this.bufferSize) this.pointer = 0;
    return this.randList[this.pointer]!;
  }

  public getRand64Parts(): [lo: number, hi: number] {
    this.pointer++;
    if (this.pointer >= this.bufferSize) this.pointer = 0;
    return [this.randListLo[this.pointer]!, this.randListHi[this.pointer]!];
  }

  public getCurrent32(): number {
    return this.randList[this.head]!;
  }

  public getCurrentState(): TinyState {
    return this.rngStates[this.head]!;
  }

  public getCurrent64Parts(): [lo: number, hi: number] {
    const h = this.head;
    return [this.randListLo[h]!, this.randListHi[h]!];
  }

  public getSavePoint64Parts(): [lo: number, hi: number] {
    const idx = this.oldTail === this.bufferSize - 1 ? 0 : this.oldTail + 1;
    return [this.randListLo[idx]!, this.randListHi[idx]!];
  }

  public createBuffer64(rng: SFMT, bufferSize = 5000): void {
    this.bufferSize = bufferSize;
    this.tail = bufferSize - 1;
    this.randListLo = new Uint32Array(bufferSize);
    this.randListHi = new Uint32Array(bufferSize);
    for (let i = 0; i < bufferSize; i++) {
      const [lo, hi] = rng.nextU64Parts();
      this.randListLo[i] = lo;
      this.randListHi[i] = hi;
    }
  }

  public createBuffer32(rng: TinyMT, bufferSize = 5000): void {
    this.bufferSize = bufferSize;
    this.tail = bufferSize - 1;
    this.randList = new Uint32Array(bufferSize);
    this.rngStates = new Array<TinyState>(bufferSize);
    for (let i = 0; i < bufferSize; i++) {
      this.rngStates[i] = rng.getState();
      this.randList[i] = rng.nextU32();
    }
  }

  public addNext64(rng: SFMT): void {
    const h = this.head;
    const [lo, hi] = rng.nextU64Parts();
    this.randListLo[h] = lo;
    this.randListHi[h] = hi;
    if (++this.tail === this.bufferSize) this.tail = 0;
  }

  public addNext32(rng: TinyMT): void {
    const h = this.head;
    this.rngStates[h] = rng.getState();
    this.randList[h] = rng.nextU32();
    if (++this.tail === this.bufferSize) this.tail = 0;
  }

  public resetModelStatus(): void {
    this.remainFrame = new Int32Array(this.modelNumber);
    this.phase = false;
  }

  public copyStatus(st: ModelStatus): void {
    this.modelNumber = st.modelNumber;
    this.remainFrame = new Int32Array(st.remainFrame);
    this.phase = st.phase;
  }

  public timeElapse7(n: number): void {
    for (let totalFrame = 0; totalFrame < n; totalFrame++) {
      for (let i = 0; i < this.modelNumber; i++) {
        const rem = this.remainFrame[i]!;
        if (rem > 1) {
          this.remainFrame[i] = rem - 1;
          continue;
        }
        if (rem < 0) {
          const nextRem = rem + 1;
          this.remainFrame[i] = nextRem;
          if (nextRem === 0) {
            const [lo, hi] = this.getRand64Parts();
            this.remainFrame[i] = modU64(lo, hi, 3) === 0 ? 36 : 30;
          }
          continue;
        }
        const [lo] = this.getRand64Parts();
        if ((lo & 0x7f) === 0) {
          this.remainFrame[i] = -5;
        }
      }
      if (this.raining) {
        this.phase = !this.phase;
        if (this.phase) {
          this.advance(2);
        }
      }
    }
  }

  public rearrange(npcMap: readonly number[]): void {
    this.modelNumber = npcMap.length;
    const next = new Int32Array(this.remainFrame.length);
    for (let i = 0; i < this.remainFrame.length; i++) {
      next[i] = this.remainFrame[i]!;
    }
    for (let i = 0; i < this.modelNumber; i++) {
      next[i] = this.remainFrame[npcMap[i]!]!;
    }
    this.remainFrame = next;
  }

  public changeModelNumber(n: number): void {
    if (n === this.modelNumber) return;
    this.modelNumber = n;
    if (n > this.remainFrame.length) {
      const tmp = new Int32Array(n);
      tmp.set(this.remainFrame);
      this.remainFrame = tmp;
    }
  }

  public cry(idx: number): void {
    for (let i = 0; i < this.modelNumber; i++) {
      if (i === idx) {
        this.advance(1);
      }
      const rem = this.remainFrame[i]!;
      if (rem > 1) {
        this.remainFrame[i] = rem - 1;
        continue;
      }
      if (rem < 0) {
        const nextRem = rem + 1;
        this.remainFrame[i] = nextRem;
        if (nextRem === 0) {
          const [lo, hi] = this.getRand64Parts();
          this.remainFrame[i] = modU64(lo, hi, 3) === 0 ? 36 : 30;
        }
        continue;
      }
      const [lo] = this.getRand64Parts();
      if ((lo & 0x7f) === 0) {
        this.remainFrame[i] = -5;
      }
    }
    if (idx >= this.modelNumber) {
      this.advance(1);
    }
  }

  public normalDelay7(): void {
    this.timeElapse7(this.delayTime);
  }

  public splittedDelay(totalDelay: number, cryDelay: number): void {
    this.timeElapse7(totalDelay - cryDelay);
    this.advance(1);
    this.timeElapse7(cryDelay);
  }

  public save(): void {
    this.oldTail = this.tail;
  }

  public load(): void {
    this.tail = this.oldTail;
  }

  public saveStatus(): void {
    if (this.remainFrameBak.length !== this.modelNumber) {
      this.remainFrameBak = new Int32Array(this.modelNumber);
    }
    for (let i = 0; i < this.modelNumber; i++) {
      this.remainFrameBak[i] = this.remainFrame[i]!;
    }
    this.phaseBak = this.phase;
    this.tail = this.pointer;
  }

  public loadStatus(): void {
    for (let i = 0; i < this.modelNumber; i++) {
      this.remainFrame[i] = this.remainFrameBak[i]!;
    }
    this.phase = this.phaseBak;
    this.index = 0;
  }

  public generate7<T>(gen: Generator7): T {
    this.pointer = this.tail;
    if (this.considerDelay) {
      gen.delay(this);
    } else {
      this.resetModelStatus();
    }
    return gen.generate(this) as T;
  }

  public generateEgg7<T>(gen: { generate(pool: RngPool): T } | ((pool: RngPool) => T)): T {
    this.pointer = this.tail;
    return typeof gen === 'function' ? gen(this) : gen.generate(this);
  }
}
