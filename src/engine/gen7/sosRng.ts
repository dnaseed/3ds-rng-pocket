import { SFMT } from '../rng/sfmt';

export function getWeatherSlot(tmp: number): number {
  if (tmp < 1) return 8; // 1% (W1)
  if (tmp <= 10) return 9; // 10% (W2)
  return 0;
}

/**
 * Exact TypeScript port of Pk3DSRNGTool.SOSRNG.
 * Gen 7 SOS allies advance a dedicated 32-bit SFMT sequence synced to the SOS RNG Seed/Frame.
 */
export class SosRngBuffer {
  public readonly buffer: Uint32Array;
  private index = 0;

  public readonly weather: boolean;
  public readonly pidBonus: number;
  public readonly haRate: number;
  public readonly flawlessCount: number;

  constructor(seed: number, frame: number, chainLength: number, weather: boolean) {
    this.weather = weather;
    const cl = Math.max(0, Math.trunc(chainLength));
    this.pidBonus = Math.min(12, Math.trunc((cl - 1) / 10) * 4);
    this.flawlessCount =
      cl > 10 ? Math.min(4, Math.trunc(cl / 10) + 1) : Math.trunc(cl / 5);
    this.haRate = Math.min(15, Math.trunc(cl / 10) * 5);

    const sfmt = new SFMT(seed);
    for (let i = 0; i < frame; i++) {
      sfmt.nextU32();
    }
    this.buffer = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      this.buffer[i] = sfmt.nextU32();
    }
  }

  public reset(): void {
    this.index = 0;
  }

  public advance(n: number): void {
    this.index = (this.index + n) & 0xff;
  }

  public getRand(): number {
    return this.buffer[this.index++] ?? 0;
  }

  public postGeneration(
    ivs: [number, number, number, number, number, number],
    ability: number,
  ): number {
    while (ivs.filter((v) => v === 31).length < this.flawlessCount) {
      ivs[this.getRand() % 6] = 31;
    }
    if (this.getRand() % 100 < this.haRate) {
      return 3;
    }
    return ability;
  }
}
