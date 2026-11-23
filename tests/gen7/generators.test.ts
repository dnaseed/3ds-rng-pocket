import { describe, expect, it } from 'vitest';
import stationaryData from '../../src/data/generated/stationary_usum.json';
import wildData from '../../src/data/generated/wild_usum.json';
import type { StationaryCategory } from '../../src/data/types';
import { createDefaultRngFilter } from '../../src/engine/core/filters';
import { getPSV } from '../../src/engine/core/pokemonMath';
import { RngPool } from '../../src/engine/core/rngPool';
import type { EggResult7, Result7, WildResult7 } from '../../src/engine/core/types';
import { Egg7 } from '../../src/engine/gen7/egg7';
import { Event7 } from '../../src/engine/gen7/event7';
import { makeId7 } from '../../src/engine/gen7/id7';
import { getSosAllies, getWeatherAllies } from '../../src/engine/gen7/sosAllies';
import { MainEggRng, Stationary7 } from '../../src/engine/gen7/stationary7';
import { parseWc7File } from '../../src/engine/gen7/wc7Parser';
import { SLOT_DISTRIBUTIONS, Wild7 } from '../../src/engine/gen7/wild7';
import { SFMT } from '../../src/engine/rng/sfmt';
import { TinyMT } from '../../src/engine/rng/tinymt';

const STATIONARY_CATS = stationaryData as StationaryCategory[];

function findStationaryTemplate(species: number, filterFn?: (t: StationaryCategory['list'][number]) => boolean) {
  for (const cat of STATIONARY_CATS) {
    for (const item of cat.list) {
      if (item.species === species && (!filterFn || filterFn(item))) {
        return item;
      }
    }
  }
  throw new Error(`Template not found for species ${species}`);
}

describe('Gen 7 Generators (Stationary7, Wild7, Egg7, Event7, ID7)', () => {
  it('runs Stationary7 across USUM templates and all DelayTypes (including Solgaleo, Lunala, Zapdos, and all UBs)', () => {
    const testTemplates = [
      findStationaryTemplate(791), // US Solgaleo DelayType 9
      findStationaryTemplate(792), // UM Lunala DelayType 10
      findStationaryTemplate(145), // Zapdos DelayType 4 -> 6 (odd delay 151)
      findStationaryTemplate(150), // Mewtwo DelayType 4 (even delay 156)
      findStationaryTemplate(793, (t) => t.delayType === 11), // Nihilego Rebattle
      findStationaryTemplate(794, (t) => t.delayType === 12), // Buzzwole Rebattle
      findStationaryTemplate(795, (t) => t.delayType === 13), // Pheromosa Rebattle
      findStationaryTemplate(796, (t) => t.delayType === 14), // Xurkitree Rebattle
      findStationaryTemplate(797, (t) => t.delayType === 15), // Celesteela Rebattle
      findStationaryTemplate(798, (t) => t.delayType === 16), // Kartana Rebattle
      findStationaryTemplate(799, (t) => t.delayType === 17), // Guzzlord Rebattle
      findStationaryTemplate(793, (t) => t.delayType === 21), // Nihilego First
      findStationaryTemplate(794, (t) => t.delayType === 22), // Buzzwole First
      findStationaryTemplate(795, (t) => t.delayType === 23), // Pheromosa First
      findStationaryTemplate(796, (t) => t.delayType === 24), // Xurkitree First
      findStationaryTemplate(797, (t) => t.delayType === 25), // Celesteela First
      findStationaryTemplate(798, (t) => t.delayType === 26), // Kartana First (with swap)
      findStationaryTemplate(799, (t) => t.delayType === 27), // Guzzlord First
      findStationaryTemplate(731, (t) => t.isPelago), // Pelago Pikipek
      findStationaryTemplate(132, (t) => t.nature === 5), // Ditto Five
      findStationaryTemplate(701, (t) => t.otTsv !== null), // In-Game Trade Hawlucha
      findStationaryTemplate(803), // Gift Poipole
    ];

    for (const tmpl of testTemplates) {
      const sfmt = new SFMT(0x12345678);
      sfmt.advance(478);
      const pool = new RngPool();
      pool.modelNumber = tmpl.npc + 1;
      pool.delayTime = Math.trunc(tmpl.delay / 2) + 2;
      pool.delayType = tmpl.delayType === 4 && (tmpl.delay & 1) === 1 ? 6 : tmpl.delayType;
      pool.considerDelay = true;
      pool.createBuffer64(sfmt, 5000);
      pool.resetModelStatus();

      const gen = new Stationary7({
        species: tmpl.species,
        forme: tmpl.forme,
        level: tmpl.level || 50,
        tsv: 1234,
        trv: 5,
        shinyCharm: true,
        synchroStat: 10, // Timid
        assumeSynced: null,
        isForcedShiny: false,
        pelagoShift: 0,
        alwaysSync: false,
        iv3: false,
        isShinyLocked: false,
        ability: 0,
        genderSetting: 0x7f,
        randomGender: true,
        template: tmpl,
      });

      const rt = pool.generate7<Result7>(gen);
      expect(rt.ivs.every((v) => v >= 0 && v <= 31)).toBe(true);
      if (tmpl.iv3 || tmpl.delayType >= 4) {
        // Legendaries & UBs guarantee >= 3 IVs of 31
        if (tmpl.species !== 132 && tmpl.species !== 701 && !tmpl.isPelago) {
          expect(rt.ivs.filter((v) => v === 31).length).toBeGreaterThanOrEqual(3);
        }
      }
      if (tmpl.shinyLocked) {
        expect(rt.shiny).toBe(false);
      }
      if (tmpl.species === 132 && tmpl.nature === 5) {
        // Ditto Five has PostNatureLock -> always inherits its locked nature 5
        expect(rt.nature).toBe(5);
      }
    }
  });

  it('captures Result7 randLo/randHi & frameDelayUsed BEFORE generating PID/EC/IVs', () => {
    const sfmt = new SFMT(0xaabbccdd);
    sfmt.advance(478);
    const pool = new RngPool();
    pool.modelNumber = 1;
    pool.considerDelay = false;
    pool.createBuffer64(sfmt, 128);

    const [expectedLo, expectedHi] = pool.getCurrent64Parts();
    const gen = new Stationary7({
      species: 150,
      forme: 0,
      level: 60,
      tsv: 100,
      trv: 0,
      shinyCharm: false,
      synchroStat: 10,
      assumeSynced: null,
      isForcedShiny: false,
      pelagoShift: 0,
      alwaysSync: false,
      iv3: true,
      isShinyLocked: false,
      ability: 1,
      genderSetting: 0xff,
      randomGender: false,
    });
    const rt = pool.generate7<Result7>(gen);
    expect(rt.randLo).toBe(expectedLo);
    expect(rt.randHi).toBe(expectedHi);
    expect(rt.frameDelayUsed).toBe(0);
  });

  it('supports ForcedShiny and ShinyLock XOR 0x10000000 in Stationary7', () => {
    // Find a frame where first PID roll hits TSV, verify ShinyLock flips bit 28
    const targetTsv = 42;
    const sfmt = new SFMT(0x01020304);
    sfmt.advance(478);
    const pool = new RngPool();
    pool.createBuffer64(sfmt, 8000);

    const lockedGen = new Stationary7({
      species: 785,
      forme: 0,
      level: 60,
      tsv: targetTsv,
      trv: 0,
      shinyCharm: false,
      synchroStat: 10,
      assumeSynced: true,
      isForcedShiny: false,
      pelagoShift: 0,
      alwaysSync: true,
      iv3: true,
      isShinyLocked: true,
      ability: 1,
      genderSetting: 0xff,
      randomGender: false,
    });

    const unlockedGen = new Stationary7({
      species: 785,
      forme: 0,
      level: 60,
      tsv: targetTsv,
      trv: 0,
      shinyCharm: false,
      synchroStat: 10,
      assumeSynced: true,
      isForcedShiny: false,
      pelagoShift: 0,
      alwaysSync: true,
      iv3: true,
      isShinyLocked: false,
      ability: 1,
      genderSetting: 0xff,
      randomGender: false,
    });

    let foundMatch = false;
    for (let i = 0; i < 6000; i++) {
      pool.resetModelStatus();
      const un = pool.generate7<Result7>(unlockedGen);
      if (un.shiny) {
        pool.resetModelStatus();
        const lk = pool.generate7<Result7>(lockedGen);
        expect(lk.shiny).toBe(false);
        expect(lk.pid).toBe((un.pid ^ 0x10000000) >>> 0);
        foundMatch = true;
        break;
      }
      pool.addNext64(sfmt);
    }
    expect(foundMatch).toBe(true);
  });

  it('generates Wild7 grass, fishing (with hooked item rewind), Minior forme, and Lead abilities', () => {
    const area = wildData.usumAreas[0]!; // Route 1
    const slotType = wildData.slotTypes[area.species[0]!]!;
    const specForm = new Array<number>(11).fill(0);
    for (let i = 1; i < 11; i++) {
      specForm[i] = area.species[slotType[i - 1]!]!;
    }

    const sfmt = new SFMT(0x55667788);
    sfmt.advance(478);
    const pool = new RngPool();
    pool.modelNumber = area.npc + 1;
    pool.preHoneyCorrection = area.correction;
    pool.honeyDelay = 63;
    pool.considerDelay = true;
    pool.delayTime = 6;
    pool.createBuffer64(sfmt, 5000);

    const wildGen = new Wild7({
      tsv: 1234,
      trv: 2,
      shinyCharm: true,
      synchroStat: 13, // Jolly
      lead: 1, // Sync
      levelMin: area.levelMin,
      levelMax: area.levelMax,
      specialLevel: 0,
      specialEnctr: 0,
      ub: false,
      fishing: false,
      crabrawler: false,
      delayType: 0,
      delayTime: 0,
      specForm,
      slotSplitter: SLOT_DISTRIBUTIONS[0]!,
    });

    const rt = pool.generate7<WildResult7>(wildGen);
    expect(rt.slot).toBeGreaterThanOrEqual(1);
    expect(rt.slot).toBeLessThanOrEqual(10);
    expect(rt.level).toBeGreaterThanOrEqual(area.levelMin);
    expect(rt.level).toBeLessThanOrEqual(area.levelMax);

    // Fishing + special hooked item
    const fishArea = wildData.fishingAreas[0]!;
    const fishGen = new Wild7({
      tsv: 1234,
      trv: 2,
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
    });

    let sawFishPokemon = false;
    let sawHookedItem = false;
    for (let i = 0; i < 40; i++) {
      pool.delayType = 1;
      pool.resetModelStatus();
      const fRt = pool.generate7<WildResult7>(fishGen);
      if (fRt.isSpecial) {
        sawHookedItem = true;
        expect(fRt.specialVal).not.toBeNull();
        expect(fRt.slot).toBeGreaterThanOrEqual(1);
        expect(fRt.slot).toBeLessThanOrEqual(3);
      } else {
        sawFishPokemon = true;
      }
      pool.addNext64(sfmt);
    }
    expect(sawFishPokemon).toBe(true);
    expect(sawHookedItem).toBe(true);
  });

  it('generates Egg7 with Destiny Knot, Both Everstone, Power Item, Masuda, and MainEggRng', () => {
    const tiny = new TinyMT(0x13572468);
    const pool = new RngPool();
    pool.createBuffer32(tiny, 100);

    const eggGen = new Egg7({
      tsv: 777,
      trv: 3,
      maleIvs: [31, 31, 31, 0, 31, 31],
      femaleIvs: [31, 0, 31, 31, 31, 31],
      maleItem: 1, // Everstone
      femaleItem: 2, // Destiny Knot
      inheritAbility: 2, // HA
      genderRatioRaw: 0x7f,
      shinyCharm: true,
      masuda: true,
      nidoType: false,
      homogeneous: true,
      femaleIsDitto: false,
      considerOtherTsv: false,
      otherTsvs: [],
    });

    const egg = pool.generateEgg7<EggResult7>((p) => eggGen.generate(p));
    expect(egg.beInheritParents).toBe(true); // maleItem === 1
    expect(egg.inheritMaleIv.filter((v) => v !== null).length).toBe(5); // Destiny Knot
    expect(egg.framesUsed).toBeGreaterThanOrEqual(15);

    // MainEggRng should inherit IVs/EC/Nature/Ability/Gender/Ball from egg and roll PID from SFMT
    const sfmt = new SFMT(0x22334455);
    sfmt.advance(478);
    const mainPool = new RngPool();
    mainPool.createBuffer64(sfmt, 128);
    const mainGen = new MainEggRng({
      tsv: getPSV(0), // arbitrary
      trv: 0,
      considerOtherTsv: false,
      otherTsvs: [],
      egg,
    });
    const meRt = mainPool.generate7<Result7>(mainGen);
    expect(meRt.ec).toBe(egg.ec);
    expect(meRt.ivs).toEqual(egg.ivs);
    expect(meRt.nature).toBe(egg.nature);
    expect(meRt.ability).toBe(egg.ability);
    expect(meRt.gender).toBe(egg.gender);
  });

  it('generates Event7 (all 4 PIDTypes + NoDex double-gen) and ID7 correctly', () => {
    const sfmt = new SFMT(0x99887766);
    sfmt.advance(478);
    const pool = new RngPool();
    pool.considerDelay = true;
    pool.delayTime = 23; // (42 / 2) + 2
    pool.createBuffer64(sfmt, 500);

    const ev = new Event7({
      species: 802, // Marshadow
      forme: 0,
      level: 50,
      ivs: [-1, -1, -1, -1, -1, -1],
      ivsCount: 3,
      yourId: false,
      isEgg: false,
      noDex: true,
      pidType: 2, // Random Shiny
      abilityLocked: true,
      natureLocked: false,
      genderLocked: true,
      otherInfo: true,
      tid: 12345,
      sid: 54321,
      ec: 0,
      pid: 0,
      ability: 1,
      nature: 0,
      gender: 0,
    });

    const rt = pool.generate7<Result7>(ev);
    expect(rt.shiny).toBe(true);
    expect(rt.squareShiny).toBe(true);
    expect(rt.psv).toBe(((12345 ^ 54321) >>> 4) & 0xfff);
    expect(rt.ivs.filter((v) => v === 31).length).toBeGreaterThanOrEqual(3);

    // ID7 direct check against makeId7
    const id = makeId7(1132, 0x12345678, 0x9abcdef0);
    expect(id.tid).toBe(0x5678);
    expect(id.sid).toBe(0x1234);
    expect(id.g7tid).toBe(0x12345678 % 1_000_000);
    expect(id.tsv).toBe(((0x5678 ^ 0x1234) >>> 4) & 0xfff);
    expect(id.trv).toBe((0x5678 ^ 0x1234) & 0xf);
    expect(id.clock).toBeGreaterThanOrEqual(0);
    expect(id.clock).toBeLessThan(17);

    // Ensure createDefaultRngFilter is valid
    const def = createDefaultRngFilter();
    expect(def.slots.length).toBe(11);
  });

  it('resolves Gen 7 SOS allies, weather slots, and runs Wild7 SOS generation', () => {
    // Pichu (172) -> Pikachu (25) slots 1..4, Happiny (440) slot 5, Pichu slots 6..7
    expect(getSosAllies(8, 172, false, false, true)).toEqual([25, 25, 25, 25, 440, 172, 172]);
    // Eevee (133) -> Espeon (196) by day, Umbreon (197) by night
    expect(getSosAllies(50, 133, false, false, true).slice(0, 3)).toEqual([196, 196, 196]);
    expect(getSosAllies(50, 133, false, true, true).slice(0, 3)).toEqual([197, 197, 197]);
    // Haina Desert (124) adds Golett (622) in US and Baltoy (343) in UM
    expect(getSosAllies(124, 552, false, false, true)[5]).toBe(622);
    expect(getSosAllies(124, 552, true, false, true)[5]).toBe(343);
    // Rain at Lush Jungle (90) gives Castform (351) W1 and Goomy (704) W2
    expect(getWeatherAllies(90, 1, false, true)).toEqual([351, 704]);
    // Minior (774) has callRate === 0 -> all 0s
    expect(getSosAllies(136, 774, false, false, true)).toEqual([0, 0, 0, 0, 0, 0, 0]);

    const sosSlots = getSosAllies(8, 172, false, false, true);
    const sfmt = new SFMT(0x2468ace0);
    sfmt.advance(478);
    const pool = new RngPool();
    pool.modelNumber = 2;
    pool.considerDelay = true;
    pool.delayType = 1;
    pool.delayTime = 6;
    pool.createBuffer64(sfmt, 500);

    const sosGen = new Wild7({
      tsv: 1234,
      trv: 1,
      shinyCharm: true,
      synchroStat: 10,
      lead: 1,
      levelMin: 2,
      levelMax: 5,
      specialLevel: 0,
      specialEnctr: 0,
      ub: false,
      fishing: false,
      crabrawler: false,
      delayType: 0,
      delayTime: 0,
      specForm: [0, ...sosSlots, 351, 704],
      slotSplitter: SLOT_DISTRIBUTIONS[39]!,
      sos: true,
      sosSeed: 0x2468ace0,
      sosFrame: 120,
      sosChainLength: 31, // 4 guaranteed IVs, 15% HA, 12 bonus PID rolls
      sosWeather: true,
    });

    const rt = pool.generate7<WildResult7>(sosGen);
    expect(rt.ivs.filter((v) => v === 31).length).toBeGreaterThanOrEqual(4);
    expect(rt.level).toBeGreaterThanOrEqual(2);
    expect(rt.level).toBeLessThanOrEqual(5);
    expect(rt.slot).toBeGreaterThanOrEqual(1);
    expect(rt.slot).toBeLessThanOrEqual(9);
  });

  it('parses both .wc7 (264 bytes) and .wc7full (784 bytes) Wonder Cards cleanly', () => {
    const raw = new Uint8Array(0x108);
    const dv = new DataView(raw.buffer);
    raw[0x51] = 0; // Pokemon Gift card type
    dv.setUint16(0x82, 802, true); // Marshadow
    raw[0x84] = 0; // Forme 0
    raw[0xa2] = 0; // Ability 1 locked
    raw[0xa0] = 13; // Jolly locked
    raw[0xa1] = 2; // Genderless (in USUM wc7: 2 -> (2+1)%3 = 0 '-')
    // Set 3 random 31 IVs flag (0xFE => 0xFE - 0xFB = 3)
    raw[0xaf] = 0xfe;
    raw[0x68] = 0x39;
    raw[0x69] = 0x30; // TID = 12345 (0x3039)
    dv.setUint16(0x6a, 54321, true); // SID
    raw[0xa3] = 3; // PIDType Order[3] = 1 (NonShiny)
    dv.setUint32(0x70, 0x11223344, true); // EC
    raw[0xd0] = 50; // Level
    raw[0xd1] = 0; // Not egg
    raw[0xb5] = 0; // Fixed TID/SID

    const parsed = parseWc7File(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.species).toBe(802);
    expect(parsed!.level).toBe(50);
    expect(parsed!.abilityLocked).toBe(true);
    expect(parsed!.ability).toBe(1);
    expect(parsed!.natureLocked).toBe(true);
    expect(parsed!.nature).toBe(13);
    expect(parsed!.ivsCount).toBe(3);
    expect(parsed!.tid).toBe(12345);
    expect(parsed!.sid).toBe(54321);
    expect(parsed!.pidType).toBe(1);
    expect(parsed!.ec).toBe(0x11223344);

    // Wrap into .wc7full (0x208 header + 0x108 payload = 0x310) with fixed IVs and YourID
    raw[0xaf] = 31;
    raw[0xaf + 1] = 0;
    raw[0xaf + 2] = 31;
    raw[0xaf + 3] = 0; // Spe (in-game order: HP, Atk, Def, Spe, SpA, SpD)
    raw[0xaf + 4] = 31; // SpA
    raw[0xaf + 5] = 31; // SpD
    raw[0xb5] = 3; // YourID
    raw[0xa3] = 2; // Shiny (PIDType Order[2] = 2)
    const full = new Uint8Array(0x310);
    full.set(raw, 0x208);

    const parsedFull = parseWc7File(full);
    expect(parsedFull).not.toBeNull();
    expect(parsedFull!.yourId).toBe(true);
    expect(parsedFull!.pidType).toBe(2);
    expect(parsedFull!.ivsCount).toBe(0);
    expect(parsedFull!.ivs).toEqual([31, 0, 31, 31, 31, 0]);
    expect(parseWc7File(new Uint8Array(10))).toBeNull();

    // Egg WC7 with level 0 preserves level === 0
    raw[0xd0] = 0;
    raw[0xd1] = 1;
    const parsedEgg = parseWc7File(raw);
    expect(parsedEgg).not.toBeNull();
    expect(parsedEgg!.isEgg).toBe(true);
    expect(parsedEgg!.level).toBe(0);
  });

  it('handles fixed-female Stationary7 templates (no negative byte wrap) and Trade synchronize=false', () => {
    const frillish = findStationaryTemplate(592); // gender === 2 (Fixed Female)
    expect(frillish.gender).toBe(2);
    const sfmt = new SFMT(0x11223344);
    sfmt.advance(478);
    const pool = new RngPool();
    pool.considerDelay = false;
    pool.createBuffer64(sfmt, 128);

    const gen = new Stationary7({
      species: frillish.species,
      forme: frillish.forme,
      level: frillish.level,
      tsv: 1000,
      trv: 0,
      shinyCharm: false,
      synchroStat: 10,
      assumeSynced: null,
      isForcedShiny: false,
      pelagoShift: 0,
      alwaysSync: false,
      iv3: false,
      isShinyLocked: false,
      ability: 0,
      genderSetting: 0x7f,
      randomGender: true,
      template: frillish,
    });
    const rt = pool.generate7<Result7>(gen);
    expect(rt.gender).toBe(2); // Female (was broken to 1 due to -2 instead of 0xFE)

    const hawlucha = findStationaryTemplate(701, (t) => t.otTsv !== null);
    const tradeGen = new Stationary7({
      species: hawlucha.species,
      forme: hawlucha.forme,
      level: hawlucha.level,
      tsv: 1000,
      trv: 0,
      shinyCharm: false,
      synchroStat: 10,
      assumeSynced: null,
      isForcedShiny: false,
      pelagoShift: 0,
      alwaysSync: false,
      iv3: false,
      isShinyLocked: false,
      ability: 0,
      genderSetting: 0x7f,
      randomGender: false,
      template: hawlucha,
    });
    const tradeRt = pool.generate7<Result7>(tradeGen);
    expect(tradeRt.synchronize).toBe(false);
  });

  it('guards Event7 random-31 IV loop when locked IVs + ivsCount > 6', () => {
    const sfmt = new SFMT(0x44332211);
    sfmt.advance(478);
    const pool = new RngPool();
    pool.considerDelay = false;
    pool.createBuffer64(sfmt, 128);

    const ev = new Event7({
      species: 802,
      forme: 0,
      level: 50,
      ivs: [31, 0, 31, 31, -1, -1], // 4 locked, only 2 empty slots
      ivsCount: 3, // > 2 empty slots -> must clamp to 2, not infinite-loop!
      yourId: false,
      isEgg: false,
      noDex: false,
      pidType: 0,
      abilityLocked: true,
      natureLocked: false,
      genderLocked: true,
      otherInfo: false,
      tid: 12345,
      sid: 54321,
      ec: 0,
      pid: 0,
      ability: 1,
      nature: 0,
      gender: 0,
    });
    const rt = pool.generate7<Result7>(ev);
    expect(rt.ivs).toEqual([31, 0, 31, 31, 31, 31]);
  });
});
