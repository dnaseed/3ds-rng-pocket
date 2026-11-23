import { describe, expect, it } from 'vitest';
import stationarySmData from '../../src/data/generated/stationary_sm.json';
import stationaryData from '../../src/data/generated/stationary_usum.json';
import wildSmData from '../../src/data/generated/wild_sm.json';
import wildData from '../../src/data/generated/wild_usum.json';
import type { StationaryCategory } from '../../src/data/types';
import { createDefaultRngFilter } from '../../src/engine/core/filters';
import type { WildResult7 } from '../../src/engine/core/types';
import {
  runEgg7Search,
  runId7Search,
  runMainGen7Search,
} from '../../src/engine/gen7/searches';
import { SLOT_DISTRIBUTIONS } from '../../src/engine/gen7/wild7';
import { TinyMT } from '../../src/engine/rng/tinymt';

const STATIONARY_CATS = stationaryData as StationaryCategory[];

describe('Gen 7 Search Flows Integration', () => {
  it('executes Stationary7 Normal, Timeline (with fidget), and AroundTarget (EC matching)', () => {
    const mewtwo = STATIONARY_CATS.find((c) => c.text === 'Kanto Legendary')!.list[3]!;
    const filter = createDefaultRngFilter();
    filter.skip = true;

    const normal = runMainGen7Search({
      kind: 'stationary',
      seed: 0x12345678,
      isUltra: true,
      startFrame: 478,
      endFrame: 900,
      targetFrame: 700,
      npcCount: mewtwo.npc,
      raining: false,
      considerDelay: true,
      delayFrames: mewtwo.delay,
      mode: 'normal',
      timeSpanSec: 30,
      isBoy: true,
      fidgetTimeline: false,
      xMenu: false,
      jumpFrame: 0,
      filter,
      config: {
        species: mewtwo.species,
        forme: mewtwo.forme,
        level: mewtwo.level,
        tsv: 1234,
        trv: 5,
        shinyCharm: true,
        synchroStat: 10,
        assumeSynced: null,
        isForcedShiny: false,
        pelagoShift: 0,
        alwaysSync: false,
        iv3: true,
        isShinyLocked: false,
        ability: 0,
        genderSetting: 0xff,
        randomGender: false,
        template: mewtwo,
      },
    });
    expect(normal.rows.length).toBeGreaterThan(200);

    const timeline = runMainGen7Search({
      kind: 'stationary',
      seed: 0x12345678,
      isUltra: true,
      startFrame: 478,
      endFrame: 900,
      targetFrame: 700,
      npcCount: mewtwo.npc,
      raining: false,
      considerDelay: true,
      delayFrames: mewtwo.delay,
      mode: 'timeline',
      timeSpanSec: 20,
      isBoy: true,
      fidgetTimeline: true,
      xMenu: false,
      jumpFrame: 500,
      filter,
      config: {
        species: mewtwo.species,
        forme: mewtwo.forme,
        level: mewtwo.level,
        tsv: 1234,
        trv: 5,
        shinyCharm: true,
        synchroStat: 10,
        assumeSynced: null,
        isForcedShiny: false,
        pelagoShift: 0,
        alwaysSync: false,
        iv3: true,
        isShinyLocked: false,
        ability: 0,
        genderSetting: 0xff,
        randomGender: false,
        template: mewtwo,
      },
    });
    expect(timeline.rows.length).toBe(20 * 30 + 1);
    expect(timeline.rows.some((r) => r.blink === 1)).toBe(true); // fidget jump triggered

    const around = runMainGen7Search({
      kind: 'stationary',
      seed: 0x12345678,
      isUltra: true,
      startFrame: 478,
      endFrame: 900,
      targetFrame: 700,
      npcCount: mewtwo.npc,
      raining: false,
      considerDelay: true,
      delayFrames: mewtwo.delay,
      mode: 'aroundTarget',
      timeSpanSec: 20,
      isBoy: true,
      fidgetTimeline: false,
      xMenu: false,
      jumpFrame: 0,
      filter,
      config: {
        species: mewtwo.species,
        forme: mewtwo.forme,
        level: mewtwo.level,
        tsv: 1234,
        trv: 5,
        shinyCharm: true,
        synchroStat: 10,
        assumeSynced: null,
        isForcedShiny: false,
        pelagoShift: 0,
        alwaysSync: false,
        iv3: true,
        isShinyLocked: false,
        ability: 0,
        genderSetting: 0xff,
        randomGender: false,
        template: mewtwo,
      },
    });
    expect(around.rows.some((r) => r.blink === 4)).toBe(true); // <?> hidden frames from EC match
  });

  it('executes Wild FishyTimeline with Save/Load and TimeWindow', () => {
    const fishArea = wildData.fishingAreas[0]!;
    const filter = createDefaultRngFilter();
    filter.skip = true;

    const fishy = runMainGen7Search({
      kind: 'wild',
      seed: 0x87654321,
      isUltra: true,
      startFrame: 478,
      endFrame: 2000,
      targetFrame: 700,
      npcCount: fishArea.npc,
      raining: false,
      considerDelay: true,
      delayFrames: fishArea.lapras ? 0 : -2,
      mode: 'timeline',
      timeSpanSec: 3,
      isBoy: true,
      fidgetTimeline: false,
      xMenu: false,
      jumpFrame: 0,
      filter,
      wildDelayType: 1,
      wildCry: false,
      preHoneyCorrection: 1,
      fishingSetting: {
        basedelay: fishArea.longdelay ? 89 : 78,
        suctioncups: false,
        platdelay: 14,
        pkmdelay: 1,
      },
      fishyTimeline: true,
      fishyOverview: false,
      config: {
        tsv: 1234,
        trv: 1,
        shinyCharm: false,
        synchroStat: 10,
        lead: 0,
        levelMin: fishArea.levelMin,
        levelMax: fishArea.levelMax,
        specialLevel: 0,
        specialEnctr: 50,
        ub: false,
        fishing: true,
        crabrawler: false,
        delayType: 0,
        delayTime: 0,
        specForm: [0, ...fishArea.species],
        slotSplitter: SLOT_DISTRIBUTIONS[fishArea.slotType]!,
        hookedItemSlot: [50, 80],
      },
    });
    expect(fishy.rows.length).toBeGreaterThan(10);
    expect(fishy.rows[0]!.frame0).toBeGreaterThanOrEqual(478);
    expect((fishy.rows[0]!.result as WildResult7).kind).toBe('wild');
  });

  it('executes Egg7 Frame, List, and Shortest Path (reaching exact target frame)', () => {
    const tiny = new TinyMT(0x24681357);
    const eggSeed = tiny.getState();
    const filter = createDefaultRngFilter();
    filter.skip = true;

    const eggConfig = {
      tsv: 1000,
      trv: 4,
      maleIvs: [31, 31, 31, 31, 31, 31] as [number, number, number, number, number, number],
      femaleIvs: [31, 0, 31, 31, 31, 31] as [number, number, number, number, number, number],
      maleItem: 2,
      femaleItem: 1,
      inheritAbility: 0,
      genderRatioRaw: 0x7f,
      shinyCharm: true,
      masuda: true,
      nidoType: false,
      homogeneous: true,
      femaleIsDitto: false,
      considerOtherTsv: false,
      otherTsvs: [],
    };

    const shortest = runEgg7Search({
      kind: 'egg',
      mode: 'shortestPath',
      eggSeed,
      config: eggConfig,
      startFrame: 0,
      endFrame: 200,
      eggMin: 1,
      eggMax: 50,
      targetFrame: 120,
      shinyRemind: false,
      filter,
    });

    expect(shortest.rows[0]!.frame).toBe(0);
    expect(shortest.rows[shortest.rows.length - 1]!.frame).toBe(120);
    expect(shortest.instruction?.isShortestPath).toBe(true);

    // Frame range check: the final target frame in frame mode has identical IVs/Nature/PID
    const frameSearch = runEgg7Search({
      kind: 'egg',
      mode: 'frame',
      eggSeed,
      config: eggConfig,
      startFrame: 120,
      endFrame: 120,
      eggMin: 1,
      eggMax: 10,
      targetFrame: 120,
      shinyRemind: false,
      filter,
    });
    expect(frameSearch.rows.length).toBe(1);
    expect(frameSearch.rows[0]!.result.pid).toBe(
      shortest.rows[shortest.rows.length - 1]!.result.pid,
    );
  });

  it('executes ID7 search with TSV and G7TID filtering', () => {
    const allIds = runId7Search({
      kind: 'id',
      seed: 0x11223344,
      isUltra: true,
      startFrame: 1132,
      endFrame: 1500,
      clockCorrection: 3,
      filter: {
        skip: true,
        idType: 3,
        regex: false,
        idList: [],
        tsvList: [],
        randList: [],
      },
    });
    expect(allIds.rows.length).toBe(1500 - 1132 + 1);

    const sampleTsv = allIds.rows[10]!.tsv;
    const filtered = runId7Search({
      kind: 'id',
      seed: 0x11223344,
      isUltra: true,
      startFrame: 1132,
      endFrame: 1500,
      clockCorrection: 3,
      filter: {
        skip: false,
        idType: 3,
        regex: false,
        idList: [],
        tsvList: [String(sampleTsv)],
        randList: [],
      },
    });
    expect(filtered.rows.length).toBeGreaterThanOrEqual(1);
    expect(filtered.rows.every((r) => r.tsv === sampleTsv)).toBe(true);
  });

  it('executes Stationary7 Timeline Leap across a broad delay window', () => {
    const mewtwo = STATIONARY_CATS.find((c) => c.text === 'Kanto Legendary')!.list[3]!;
    const filter = createDefaultRngFilter();
    filter.skip = true;

    const normal = runMainGen7Search({
      kind: 'stationary',
      seed: 0x12345678,
      isUltra: true,
      startFrame: 478,
      endFrame: 2500,
      targetFrame: 2000,
      npcCount: mewtwo.npc,
      raining: false,
      considerDelay: true,
      delayFrames: mewtwo.delay,
      mode: 'normal',
      timeSpanSec: 30,
      isBoy: true,
      fidgetTimeline: false,
      xMenu: false,
      jumpFrame: 0,
      filter,
      config: {
        species: mewtwo.species,
        forme: mewtwo.forme,
        level: mewtwo.level,
        tsv: 1234,
        trv: 5,
        shinyCharm: false,
        synchroStat: 10,
        assumeSynced: null,
        isForcedShiny: false,
        pelagoShift: 0,
        alwaysSync: false,
        iv3: true,
        isShinyLocked: false,
        ability: 0,
        genderSetting: 0xff,
        randomGender: false,
        template: mewtwo,
      },
    });
    expect(normal.rows.length).toBeGreaterThan(0);

    const leap = runMainGen7Search({
      kind: 'stationary',
      seed: 0x12345678,
      isUltra: true,
      startFrame: 478,
      endFrame: 2500,
      targetFrame: 2000,
      npcCount: mewtwo.npc,
      raining: false,
      considerDelay: true,
      delayFrames: mewtwo.delay,
      mode: 'timelineLeap',
      timeSpanSec: 30,
      isBoy: true,
      fidgetTimeline: true,
      xMenu: true,
      jumpFrame: 0,
      leapType: 1,
      leapDelayMinSec: 0,
      leapDelayMaxSec: 40,
      leapView: 'spread',
      filter,
      config: {
        species: mewtwo.species,
        forme: mewtwo.forme,
        level: mewtwo.level,
        tsv: 1234,
        trv: 5,
        shinyCharm: false,
        synchroStat: 10,
        assumeSynced: null,
        isForcedShiny: false,
        pelagoShift: 0,
        alwaysSync: false,
        iv3: true,
        isShinyLocked: false,
        ability: 0,
        genderSetting: 0xff,
        randomGender: false,
        template: mewtwo,
      },
    });
    expect(leap.leapInfo).toBeDefined();
    expect(leap.leapInfo!.hitCount).toBeGreaterThan(0);
    expect(leap.rows.length).toBeGreaterThan(0);
    expect(leap.rows[0]!.frame).toBe(2000);
    expect(leap.rows[0]!.frame0).toBeLessThan(2000);
  });

  it('rejects all-zero TinyMT Egg seed cleanly and clamps startFrame in Timeline mode', () => {
    const filter = createDefaultRngFilter();
    filter.skip = true;

    expect(() =>
      runEgg7Search({
        kind: 'egg',
        mode: 'frame',
        eggSeed: [0, 0, 0, 0],
        config: {
          tsv: 0,
          trv: 0,
          maleIvs: [31, 31, 31, 31, 31, 31],
          femaleIvs: [31, 31, 31, 31, 31, 31],
          maleItem: 2,
          femaleItem: 1,
          inheritAbility: 0,
          genderRatioRaw: 0x7f,
          shinyCharm: false,
          masuda: false,
          nidoType: false,
          homogeneous: true,
          femaleIsDitto: false,
          considerOtherTsv: false,
          otherTsvs: [],
        },
        startFrame: 0,
        endFrame: 20,
        eggMin: 1,
        eggMax: 10,
        targetFrame: 10,
        shinyRemind: false,
        filter,
      }),
    ).toThrow(/Egg Seed/i);

    const mewtwo = STATIONARY_CATS.find((c) => c.text === 'Kanto Legendary')!.list[3]!;
    const clampedTimeline = runMainGen7Search({
      kind: 'stationary',
      seed: 0x12345678,
      isUltra: true,
      startFrame: 10, // below 478 -> must clamp to 478
      endFrame: 600,
      targetFrame: 500,
      npcCount: mewtwo.npc,
      raining: false,
      considerDelay: true,
      delayFrames: mewtwo.delay,
      mode: 'timeline',
      timeSpanSec: 2,
      isBoy: true,
      fidgetTimeline: false,
      xMenu: false,
      jumpFrame: 0,
      filter,
      config: {
        species: mewtwo.species,
        forme: mewtwo.forme,
        level: mewtwo.level,
        tsv: 1234,
        trv: 5,
        shinyCharm: false,
        synchroStat: 10,
        assumeSynced: true, // even if passed, timeline works cleanly
        isForcedShiny: false,
        pelagoShift: 0,
        alwaysSync: false,
        iv3: true,
        isShinyLocked: false,
        ability: 0,
        genderSetting: 0xff,
        randomGender: false,
        template: mewtwo,
      },
    });
    expect(clampedTimeline.rows[0]!.frame).toBe(478);

    // Around Target with caller-supplied assumeSynced: true still finds EC matches (< ?> frames)
    const aroundWithSync = runMainGen7Search({
      kind: 'stationary',
      seed: 0x12345678,
      isUltra: true,
      startFrame: 478,
      endFrame: 900,
      targetFrame: 700,
      npcCount: mewtwo.npc,
      raining: false,
      considerDelay: true,
      delayFrames: mewtwo.delay,
      mode: 'aroundTarget',
      timeSpanSec: 10,
      isBoy: true,
      fidgetTimeline: false,
      xMenu: false,
      jumpFrame: 0,
      filter,
      config: {
        species: mewtwo.species,
        forme: mewtwo.forme,
        level: mewtwo.level,
        tsv: 1234,
        trv: 5,
        shinyCharm: false,
        synchroStat: 10,
        assumeSynced: true,
        isForcedShiny: false,
        pelagoShift: 0,
        alwaysSync: false,
        iv3: true,
        isShinyLocked: false,
        ability: 0,
        genderSetting: 0xff,
        randomGender: false,
        template: mewtwo,
      },
    });
    expect(aroundWithSync.rows.some((r) => r.blink === 4)).toBe(true);
  });

  it('supports Pokémon Sun & Moon (isUltra=false) Stationary, Wild, and ID starting frames', () => {
    const smCats = stationarySmData as StationaryCategory[];
    const legendaryCat = smCats.find((c) => c.text === 'Legendary')!;
    const lunalaSm = legendaryCat.list.find((t) => t.species === 792)!;
    expect(lunalaSm.version).toBe('M');
    expect(lunalaSm.level).toBe(55);
    expect(lunalaSm.delayType).toBe(2);

    const filter = createDefaultRngFilter();
    filter.skip = true;

    const smStationary = runMainGen7Search({
      kind: 'stationary',
      seed: 0xacb13f1b,
      isUltra: false,
      startFrame: 100, // clamps to SM starting frame 418
      endFrame: 500,
      targetFrame: 450,
      npcCount: lunalaSm.npc,
      raining: false,
      considerDelay: true,
      delayFrames: lunalaSm.delay,
      mode: 'normal',
      timeSpanSec: 10,
      isBoy: true,
      fidgetTimeline: false,
      xMenu: false,
      jumpFrame: 0,
      filter,
      config: {
        species: lunalaSm.species,
        forme: lunalaSm.forme,
        level: lunalaSm.level,
        tsv: 1712,
        trv: 0,
        shinyCharm: false,
        synchroStat: 255,
        assumeSynced: null,
        isForcedShiny: false,
        pelagoShift: 0,
        alwaysSync: false,
        iv3: true,
        isShinyLocked: true,
        ability: 0,
        genderSetting: 0xff,
        randomGender: false,
        template: lunalaSm,
      },
    });
    expect(smStationary.rows.length).toBeGreaterThan(0);
    expect(smStationary.rows[0]!.frame).toBe(418);
    expect(smStationary.rows[0]!.result.shiny).toBe(false);

    expect(wildSmData.smAreas.length).toBeGreaterThan(80);
    expect(wildSmData.fishingAreas.length).toBeGreaterThan(15);

    const smIds = runId7Search({
      kind: 'id',
      seed: 0xacb13f1b,
      isUltra: false,
      startFrame: 1012,
      endFrame: 1050,
      clockCorrection: 0,
      filter: {
        skip: true,
        idType: 3,
        regex: false,
        idList: [],
        tsvList: [],
        randList: [],
      },
    });
    expect(smIds.rows[0]!.frame).toBe(1012);
    expect(smIds.rows.length).toBe(39);
  });
});
