import { modU64 } from '../math/uint';
import type { RngPool } from '../core/rngPool';

/**
 * Exact port of Pk3DSRNGTool.Core.RNGPool.StationaryDelay7().
 * Covers all SM & USUM stationary/legendary/UB/gift DelayTypes.
 */
export function stationaryDelay7(pool: RngPool): void {
  switch (pool.delayType) {
    case 1:
    case 2: {
      // SuMo Sol/Luna
      const cryDelay = pool.delayType === 1 ? 78 : 75;
      pool.timeElapse7(pool.delayTime - cryDelay - 20);
      if (pool.modelNumber === 7) pool.rearrange([0, 1, 2, 5, 6]);
      pool.timeElapse7(19);
      pool.cry(3);
      pool.timeElapse7(cryDelay);
      break;
    }
    case 3: {
      // SuMo Exeggutor
      pool.timeElapse7(3);
      pool.changeModelNumber(2);
      pool.splittedDelay(pool.delayTime - 3, pool.delayTime - 45);
      break;
    }
    case 4: {
      // Ultra Space Wormhole Legendaries (even delay)
      pool.advance(2); // Step
      pool.timeElapse7(pool.delayTime - 2);
      pool.modelNumber = 1;
      pool.timeElapse7(2);
      break;
    }
    case 5: {
      // SuMo Starter
      pool.timeElapse7(pool.delayTime - 2);
      pool.remainFrame[1] = 0;
      pool.remainFrame[3] = 0;
      pool.remainFrame[4] = 0;
      pool.remainFrame[5] = 0;
      pool.timeElapse7(2);
      break;
    }
    case 6: {
      // Ultra Space Wormhole Legendaries (odd delay)
      pool.advance(2); // Step
      pool.timeElapse7(pool.delayTime - 27);
      pool.advance(1); // 0x44911C % 120
      pool.timeElapse7(25);
      pool.modelNumber = 1;
      pool.timeElapse7(2);
      break;
    }
    case 9: {
      // US Solgaleo
      pool.timeElapse7(pool.delayTime - 77);
      pool.cry(8);
      pool.timeElapse7(76);
      break;
    }
    case 10: {
      // UM Lunala
      pool.timeElapse7(pool.delayTime - 74);
      if (pool.modelNumber === 9) pool.rearrange([0, 1, 2, 6, 7, 8]);
      pool.splittedDelay(74, 73);
      break;
    }

    // Rebattle UB
    case 11: // Nihilego
    case 21: // First Encounter Nihilego (goto case 11)
      pool.splittedDelay(pool.delayTime, 36);
      break;
    case 12: // US Buzzwole Rebattle
      pool.splittedDelay(pool.delayTime, 51);
      break;
    case 13: // UM Pheromosa Rebattle
    case 23: // First Encounter Pheromosa (goto case 13)
      pool.timeElapse7(29);
      pool.changeModelNumber(3);
      pool.timeElapse7(pool.delayTime - 64);
      pool.cry(2);
      pool.timeElapse7(34);
      break;
    case 14: // Xurkitree Rebattle
      pool.timeElapse7(11);
      pool.changeModelNumber(2);
      pool.splittedDelay(pool.delayTime - 11, 35);
      break;
    case 15: // UM Celesteela Rebattle
      pool.splittedDelay(pool.delayTime, 50);
      break;
    case 16: // US Kartana Rebattle
      pool.splittedDelay(pool.delayTime, 43);
      break;
    case 17: // Guzzlord Rebattle
      pool.splittedDelay(pool.delayTime, 40);
      break;

    // First Encounter UB
    case 22: // Buzzwole
      pool.advance(2); // Step
      pool.timeElapse7(pool.delayTime - 376);
      pool.changeModelNumber(1);
      pool.timeElapse7(214);
      pool.changeModelNumber(2);
      pool.splittedDelay(162, 51);
      break;
    case 24: // Xurkitree
      pool.timeElapse7(pool.delayTime - 412);
      pool.changeModelNumber(2);
      pool.timeElapse7(42);
      pool.changeModelNumber(1);
      pool.timeElapse7(93);
      pool.changeModelNumber(2);
      pool.splittedDelay(277, 35);
      break;
    case 25: // Celesteela
      pool.timeElapse7(66);
      pool.changeModelNumber(1);
      pool.timeElapse7(34);
      pool.changeModelNumber(2);
      pool.timeElapse7(165);
      pool.changeModelNumber(1);
      pool.timeElapse7(77);
      pool.changeModelNumber(2);
      pool.splittedDelay(pool.delayTime - 342, 50);
      break;
    case 26: // Kartana
      pool.timeElapse7(77);
      pool.changeModelNumber(1);
      pool.timeElapse7(34);
      pool.changeModelNumber(2);
      pool.timeElapse7(91);
      pool.changeModelNumber(3);
      pool.timeElapse7(61);
      pool.changeModelNumber(2);
      pool.timeElapse7(369);
      pool.changeModelNumber(4);
      pool.remainFrame[3] = pool.remainFrame[2]!;
      pool.remainFrame[2] = 0; // Swap 3 and 4
      pool.timeElapse7(71);
      pool.changeModelNumber(2);
      pool.splittedDelay(pool.delayTime - 703, 43);
      break;
    case 27: // Guzzlord
      pool.timeElapse7(196);
      pool.changeModelNumber(1);
      pool.timeElapse7(101);
      pool.changeModelNumber(2);
      pool.splittedDelay(pool.delayTime - 297, 40);
      break;

    default:
      pool.normalDelay7();
      break;
  }
}

/**
 * Exact port of Pk3DSRNGTool.Core.RNGPool.WildDelay7().
 */
export function wildDelay7(pool: RngPool): void {
  switch (pool.delayType) {
    case 1: // Simple encounter
      pool.normalDelay7();
      break;
    case 2: {
      // Fishing CFWless
      const [lo, hi] = pool.getRand64Parts();
      const fishingDelay = modU64(lo, hi, 60) + pool.fsetting.basedelay;
      pool.advance(1);
      pool.timeElapse7(fishingDelay);
      const [bLo, bHi] = pool.getRand64Parts();
      pool.isPokemon = pool.fsetting.suctioncups || modU64(bLo, bHi, 100) < 50;
      pool.timeElapse7(pool.fsetting.platdelay);
      pool.normalDelay7();
      break;
    }
    case 3: // Step
      pool.advance(2);
      pool.normalDelay7();
      if (pool.wildCry) pool.advance(1);
      break;
    case 4: // Menu
      pool.timeElapse7(2);
      pool.advance(2); // fidget
      pool.timeElapse7(pool.delayTime - 2);
      if (pool.wildCry) pool.advance(1);
      break;
    default: // Honey
      pool.normalDelay7(); // Enter the bag
      pool.resetModelStatus();
      if (pool.ultraWild) pool.advance(1);
      if (pool.raining) pool.advance(2);
      pool.timeElapse7(1); // Blink process also occurs when loading map
      pool.advance(pool.preHoneyCorrection - pool.modelNumber);
      pool.timeElapse7(pool.honeyDelay);
      break;
  }
}
