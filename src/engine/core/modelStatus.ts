import { modU64 } from '../math/uint';
import { SFMT } from '../rng/sfmt';

const DELAY_M = [407, 412] as const;
const DELAY_F = [402, 407] as const;

/**
 * Exact TypeScript port of Pk3DSRNGTool.ModelStatus.
 * Simulates Gen 7 NPC blink cooldowns, rain advances, and protagonist fidgeting.
 */
export class ModelStatus {
  private readonly sfmt: SFMT;
  private cnt = 0;

  public modelNumber: number;
  public remainFrame: Int32Array;
  public phase = false;

  public isBoy = false;
  public fidgetCd = -1; // -1 to ignore fidget
  public raining = false;

  constructor(n: number, st: SFMT) {
    this.sfmt = new SFMT(st);
    this.modelNumber = n;
    this.remainFrame = new Int32Array(n);
  }

  private getRand(): [number, number] {
    this.cnt++;
    return this.sfmt.nextU64Parts();
  }

  public nextState(): number {
    this.cnt = 0;
    if (this.fidgetCd > 0 && --this.fidgetCd === 0) {
      this.fidgetCd = this.fidget();
    }

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
          const [lo, hi] = this.getRand();
          this.remainFrame[i] = modU64(lo, hi, 3) === 0 ? 36 : 30;
        }
        continue;
      }
      const [lo] = this.getRand();
      if ((lo & 0x7f) === 0) {
        this.remainFrame[i] = -5;
      }
    }

    if (this.raining) {
      this.phase = !this.phase;
      if (this.phase) {
        this.cnt += this.frameshift(2);
      }
    }

    return this.cnt;
  }

  private fidget(): number {
    const [lo1, hi1] = this.getRand();
    const delay1 = modU64(lo1, hi1, 90);
    const [lo2] = this.getRand();
    const delay2 = this.isBoy ? DELAY_M[lo2 & 1]! : DELAY_F[lo2 & 1]!;
    return delay1 + delay2;
  }

  public frameshift(n: number): number {
    for (let i = 0; i < n; i++) {
      this.sfmt.next();
    }
    return n;
  }

  public copyTo(st: ModelStatus): void {
    st.remainFrame = new Int32Array(this.remainFrame);
    st.phase = this.phase;
  }

  public clone(): ModelStatus {
    const st = new ModelStatus(this.modelNumber, this.sfmt);
    this.copyTo(st);
    st.raining = this.raining;
    st.fidgetCd = this.fidgetCd;
    st.isBoy = this.isBoy;
    return st;
  }
}
