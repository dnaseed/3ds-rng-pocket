import type { WildMethod6 } from '../../data/wild6Catalog';
import { MAX_FRAME } from '../../engine/core/pokemonMath';
import type { Timeline6Request, TimelineMethod6 } from '../../engine/gen6/tinyTimeline';

export function aroundTargetRange6(target: number) {
  return { minFrame: Math.max(0, target - 100), maxFrame: Math.min(MAX_FRAME, target + 100) };
}

const wildCalibrationMethods: Record<WildMethod6, TimelineMethod6> = {
  Normal: 'normal', Fishing: 'fishing', FriendSafari: 'safari', Horde: 'horde',
  RockSmash: 'smash', CaveShadow: 'shadow', Trap: 'normal', PokeRadar: 'radar',
  DexNav: 'instant',
};

export function wildCalibrationMethod6(method: WildMethod6): TimelineMethod6 {
  return wildCalibrationMethods[method];
}

export function isWildCalibrationCompatible6(calibration: Pick<Timeline6Request, 'oras' | 'method'>, method: WildMethod6, oras: boolean) {
  return calibration.oras === oras && calibration.method === wildCalibrationMethod6(method);
}
