import { describe, expect, it } from 'vitest';
import { getBlinkFlagList } from '../../src/engine/core/blinkFlags';
import { ModelStatus } from '../../src/engine/core/modelStatus';
import {
  calcFrame,
  getHiddenPowerValue,
  getStartingFrame,
  getStats,
} from '../../src/engine/core/pokemonMath';
import { RngPool } from '../../src/engine/core/rngPool';
import { calcEggShortestPath } from '../../src/engine/gen7/eggPath';
import { calcMagikarpSeed } from '../../src/engine/gen7/magikarpCalc';
import { searchQrFrames } from '../../src/engine/gen7/qrSearch';
import { modU64 } from '../../src/engine/math/uint';
import { SFMT } from '../../src/engine/rng/sfmt';
import { TinyMT } from '../../src/engine/rng/tinymt';

describe('Gen 7 Core Utilities & Math', () => {
  it('recovers exact 127-bit TinyMT state via calcMagikarpSeed (GF(2) inverse)', () => {
    const seeds = [0x00000001, 0x12345678, 0xaabbccdd, 0xffffffff];
    for (const seed of seeds) {
      const rng = new TinyMT(seed);
      let bits = '';
      for (let i = 0; i < 127; i++) {
        bits += String(rng.nextU32() & 1);
      }
      const recovered = calcMagikarpSeed(bits);
      const verify = new TinyMT(recovered.state);
      let reconstructed = String(verify.temper() & 1);
      for (let i = 1; i < 127; i++) {
        reconstructed += String(verify.nextU32() & 1);
      }
      expect(reconstructed).toBe(bits);
    }
  });

  it('computes optimal shortest Accept/Reject path in calcEggShortestPath', () => {
    const adv = [20, 21, 18, 22, 19, 20, 21, 18, 20, 22, 19, 20, 21, 18, 20, 22, 19, 20, 21, 18, 20, 22, 19, 20, 21, 18, 20, 22, 19, 20, 21];
    const path = calcEggShortestPath(adv);
    expect(path[0]).toBe(0);
    expect(path[path.length - 1]).toBe(adv.length - 1);

    // Every transition i -> next must either be +1 (reject) or +adv[i] (accept)
    for (let i = 0; i < path.length - 1; i++) {
      const cur = path[i]!;
      const next = path[i + 1]!;
      expect(next === cur + 1 || next === cur + adv[cur]!).toBe(true);
    }

    // Verify DP optimality against BFS shortest path
    const dist = new Array<number>(adv.length).fill(Infinity);
    dist[0] = 0;
    const queue = [0];
    while (queue.length > 0) {
      const u = queue.shift()!;
      const d = dist[u]!;
      for (const v of [u + 1, u + adv[u]!]) {
        if (v < adv.length && d + 1 < dist[v]!) {
          dist[v] = d + 1;
          queue.push(v);
        }
      }
    }
    expect(path.length - 1).toBe(dist[adv.length - 1]);
  });

  it('computes USUM starting frames, Hidden Power types, and Nature-adjusted Stats accurately', () => {
    expect(getStartingFrame(true, 0)).toBe(478);
    expect(getStartingFrame(true, 4)).toBe(1132);
    expect(getStartingFrame(true, 3)).toBe(0);
    expect(getStartingFrame(false, 0)).toBe(418);
    expect(getStartingFrame(false, 4)).toBe(1012);

    // HP Fighting=0 .. Dark=15 (Text_Types order without Normal/Fairy: 0=Fighting..15=Dark)
    expect(getHiddenPowerValue([31, 31, 31, 31, 31, 31])).toBe(15); // Dark
    expect(getHiddenPowerValue([31, 0, 31, 30, 31, 30])).toBe(8); // Fire
    expect(getHiddenPowerValue([31, 0, 30, 31, 31, 31])).toBe(13); // Ice
    expect(getHiddenPowerValue([30, 30, 30, 30, 30, 30])).toBe(0); // Fighting

    // Garchomp Lv 60, Jolly (+Spe/-SpA = nature 13), 6x31 IVs, BS [108, 130, 95, 80, 85, 102]
    const stats = getStats([31, 31, 31, 31, 31, 31], 13, 60, [108, 130, 95, 80, 85, 102]);
    // HP = ((108*2+31)*60)/100 + 60 + 10 = 148 + 70 = 218
    // Atk = ((130*2+31)*60)/100 + 5 = 174 + 5 = 179
    // Def = ((95*2+31)*60)/100 + 5 = 132 + 5 = 137
    // SpA = ((80*2+31)*60)/100 + 5 = 114 + 5 = 119 -> *0.9 = floor(107.1) = 107
    // SpD = ((85*2+31)*60)/100 + 5 = 120 + 5 = 125
    // Spe = ((102*2+31)*60)/100 + 5 = 141 + 5 = 146 -> *1.1 = trunc(160.6) = 160
    expect(stats).toEqual([218, 179, 137, 107, 125, 160]);
  });

  it('maintains ModelStatus, BlinkFlags, and CalcFrame determinism and symmetry', () => {
    const seed = 0x12345678;
    const sfmt = new SFMT(seed);
    sfmt.advance(478);

    const ms1 = new ModelStatus(4, sfmt);
    ms1.raining = true;
    ms1.isBoy = true;
    ms1.fidgetCd = 1;
    const ms2 = ms1.clone();
    for (let i = 0; i < 40; i++) {
      expect(ms1.nextState()).toBe(ms2.nextState());
    }

    const flags1 = getBlinkFlagList(478, 550, new SFMT(seed), 1);
    const flags4 = getBlinkFlagList(478, 550, new SFMT(seed), 4);
    expect(flags1.some((f) => f === 30 || f === 36)).toBe(true);
    expect(flags4.some((f) => f === 1 || f === 2)).toBe(true);

    const fwd = calcFrame(seed, 478, 1500, 2, false, false);
    const rev = calcFrame(seed, 1500, 478, 2, false, false);
    expect(fwd[0]).toBeGreaterThan(0);
    expect(rev[0]).toBe(-fwd[0]);
  });

  it('finds exact QR clock sequences offline with searchQrFrames', () => {
    const seed = 0xdeadbeef;
    const sfmt = new SFMT(seed);
    sfmt.advance(600);
    const seq: number[] = [];
    for (let i = 0; i < 6; i++) {
      const [lo, hi] = sfmt.nextU64Parts();
      seq.push(modU64(lo, hi, 17));
    }
    const matches = searchQrFrames(seed, seq, 478, 1000);
    expect(matches.some((m) => m.lastClockFrame === 605 && m.currentFrameAfterQuit === 607)).toBe(
      true,
    );
  });

  it('supports isolated RngPool buffers and save/load rewind', () => {
    const pool = new RngPool();
    const sfmt = new SFMT(0x11223344);
    pool.createBuffer64(sfmt, 128);
    pool.modelNumber = 2;
    pool.resetModelStatus();
    pool.save();
    const [pLo, pHi] = pool.getSavePoint64Parts();
    pool.timeElapse7(5);
    pool.saveStatus();
    const savedRem = new Int32Array(pool.remainFrame);
    pool.timeElapse7(3);
    pool.loadStatus();
    expect(pool.remainFrame).toEqual(savedRem);
    pool.load();
    expect(pool.getCurrent64Parts()).toEqual([pLo, pHi]);
  });
});
