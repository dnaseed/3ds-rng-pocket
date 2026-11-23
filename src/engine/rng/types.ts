export type TinyState = [number, number, number, number];

export interface IRng32 {
  next(): void;
  nextU32(): number;
  reseed(seed: number): void;
}

export interface IRng64 extends IRng32 {
  nextU64Parts(): [lo: number, hi: number];
  nextU64BigInt(): bigint;
}
