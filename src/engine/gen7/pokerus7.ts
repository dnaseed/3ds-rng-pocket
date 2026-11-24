import type { RngPool } from '../core/rngPool';

export function getPokerusStrain(pool: RngPool): number {
  const [roll] = pool.getRand64Parts();
  const low = roll & 0xffff;
  if (low !== 0x4000 && low !== 0x8000 && low !== 0xc000) return 0;

  pool.advance(1); // Advance past the slot roll.
  let strain: number;
  do {
    [strain] = pool.getRand64Parts();
    strain &= 0xff;
  } while ((strain & 7) === 0);
  return (strain & 0xf0) === 0 ? strain : strain & 7;
}
