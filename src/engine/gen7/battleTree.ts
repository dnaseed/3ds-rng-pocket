import { isMoonVersion, isUltraVersion, type GameVersionId } from '../core/types';
import { modU64 } from '../math/uint';

const SUN_SPECIAL = [197, 201, 199, 192, 194, 195, 196, 205, 193];
const MOON_SPECIAL = [198, 202, 200, 192, 194, 195, 196, 205, 193];

export function getBattleTreeTrainer(lo: number, hi: number, game: GameVersionId, streak: number): number {
  if (streak % 10 === 0) {
    const ultra = isUltraVersion(game);
    const slot = Math.floor(modU64(lo, hi, ultra ? 114 : 100) / 14);
    const trainers = isMoonVersion(game) ? MOON_SPECIAL : SUN_SPECIAL;
    // The last slot is Anabel in SM. USUM also has a slot for Kukui.
    return !ultra && slot === 7 ? 193 : trainers[slot]!;
  }
  if (streak <= 10) return modU64(lo, hi, 50);
  if (streak <= 50) return Math.floor((streak - 1) / 10) * 20 + 10 + modU64(lo, hi, 40);
  return 90 + modU64(lo, hi, 100);
}
