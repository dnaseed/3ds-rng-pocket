import { describe, expect, it } from 'vitest';
import { searchStationary6 } from '../../src/engine/gen6/stationary6';
import { eggFromKey6, searchEgg6, type EggKey6 } from '../../src/engine/gen6/egg6';
import { searchEvent6, type WonderCard6 } from '../../src/engine/gen6/event6';
import { searchWild6, type Wild6Request } from '../../src/engine/gen6/wild6';
import { formatEggSeedStr, toHex32 } from '../../src/engine/math/uint';
import { createDefaultRngFilter } from '../../src/engine/core/filters';
import { timeline6, timelineMethods6, type Timeline6Request } from '../../src/engine/gen6/tinyTimeline';
import reference from './b5-reference.json';

const seed = 0x35b19af2;
const range = { seed, minFrame: 0, maxFrame: 9 };

function encodePokemon(row: { pid: number | null; ec: number; ivs: number[]; nature: number; ability: number; gender: number; shiny: boolean }) {
  return [toHex32(row.pid ?? 0), toHex32(row.ec), row.ivs.join(','), row.nature, row.ability, row.gender, Number(row.shiny)].join(' ');
}

describe('v1.0.6 production generators', () => {
  // encounter-vectors.ps1 -DexNavEncounters combines DexNav.cs with the desktop Wild6 generator.
  it.each([
    '1 00000002 7 -4 1 0 29 3 0 1 0 0 201 20 AA6035AD 28011AAF 31,25,31,31,6,27 3 1 0 1 0 0',
    '1 000000B0 7 -4 1 0 29 3 1 1 1 1 201 24 DDEFA5E2 28011AAF 31,16,31,31,25,6 3 3 0 1 1 1',
    '0 00000001 5 8 5 0 29 3 0 1 3 0 201 20 AA6035AD 28011AAF 31,25,31,31,6,27 3 1 0 1 0 0',
    '0 000000E8 7 3 2 3 29 3 1 1 0 1 201 3 DDEFA5E2 28011AAF 31,16,31,31,25,6 21 3 0 0 1 1',
  ])('matches DexNav zone and capture %s', expected => {
    const [mode, word] = expected.split(' ');
    const active = mode === '1';
    for (const game of ['OR', 'AS'] as const) {
      const { rows } = searchWild6({
        seed, minFrame: 502, maxFrame: 502, game, method: 'DexNav', area: 0, rod: 0, slot: 0,
        delay: 14, chain: 99, ha: false, haSlot: 0, potential: 0, forceShiny: false, level: 0,
        genderRatio: 127, safariSlots: 2, charm: true, tsv: 1920, trv: 13, syncNature: 3,
        assumeSync: false, lead: 'none', unown: true,
        timeline: {
          state: [parseInt(word!, 16), 0x99aabbcc, 0x55667788, 0x11223344],
          calls: [{ frame: 500, type: 1 }], method: 'instant', maxFrame: 502, split: false,
          delay: 0, cry: null, party: 1, oras: true, slots: 2, rate: 1, chain: 0, boost: false,
        },
        dex: { active, terrain: 0, specialSlots: true, searchLevel: 999, chain: 99, charm: true, compoundEyes: false },
      });
      expect(rows).toHaveLength(1);
      const { dex, slot, members: [result] } = rows[0]!;
      expect(dex).not.toBeNull();
      expect(result!.level).toBe(dex!.levelBoost);
      expect(result!.item).toBe(dex!.item);
      expect([
        Number(active), word, dex!.x, dex!.y, slot, dex!.terrain, dex!.levelBoost, dex!.potential,
        Number(dex!.ha), Number(dex!.eggMove), dex!.item, Number(dex!.forcedShiny), result!.species, result!.forme,
        toHex32(result!.pid), toHex32(result!.ec), result!.ivs.join(','), result!.nature, result!.ability,
        result!.gender, Number(result!.synchronize), Number(result!.shiny), Number(result!.squareShiny),
      ].join(' ')).toBe(expected);
    }
  });

  it.each(reference.radar.encounters)('matches PokéRadar encounters in $game at chain $chain (forced shiny=$forceShiny)', ({ game, chain, forceShiny, rows }) => {
    const called = searchWild6({
      ...range, game: game === 'X' ? 'X' : 'Y', method: 'PokeRadar', area: 0, rod: 0, slot: 0,
      delay: 14, chain, ha: false, haSlot: 0, potential: 0, forceShiny, level: 50,
      genderRatio: 127, safariSlots: 2, charm: false, tsv: 0, trv: 0, syncNature: -1, assumeSync: false,
      lead: 'none', dex: { active: true, terrain: 0, specialSlots: false, searchLevel: 0, chain: 0, charm: false, compoundEyes: false },
      unown: false,
    });
    expect(called.rows.map(row => encodePokemon(row.members[0]!))).toEqual(rows);
  });

  it.each(reference.timelines)('matches Timeline method $method with calls $calls and delay $delay', fixture => {
    const rows = [...timeline6({
      state: [0xddeeff00, 0x99aabbcc, 0x55667788, 0x11223344],
      calls: fixture.frames.map((frame, index) => ({ frame, type: fixture.calls[index]! })),
      method: timelineMethods6[fixture.method]!, maxFrame: 5000, delay: fixture.delay, split: fixture.split,
      cry: fixture.cry < 0 ? null : fixture.cry, party: 2, oras: fixture.method === 10,
      slots: 2, rate: 1, chain: 0, boost: false,
    })];
    expect(rows.slice(0, fixture.rows.length).map(row => [
      row.index, row.hit, row.frame - 2, row.end, row.rand, row.sync ? 'O' : 'X', row.encounter ?? 0,
      formatEggSeedStr(row.state).replaceAll(' ', ''),
    ].join(' '))).toEqual(fixture.rows);
  });

  it.each(reference.hordes)('matches the order and filters of all five $game Horde members (TinyMT=$calibrated)', ({ game, calibrated, rows }) => {
    const oras = game === 'AS';
    const timeline: Timeline6Request | undefined = calibrated ? {
      state: [0xddeeff00, 0x99aabbcc, 0x55667788, 0x11223344],
      calls: [{ frame: 500, type: 0 }], method: 'horde', maxFrame: 770, split: false,
      delay: 0, cry: null, party: 2, oras, slots: 2, rate: 1, chain: 0, boost: false,
    } : undefined;
    const request: Wild6Request = {
      ...range, game: oras ? 'AS' : 'X', method: 'Horde', area: 0, rod: 0, slot: 1, delay: 0, chain: 0,
      ha: false, haSlot: oras ? 3 : 0, potential: 0, forceShiny: false, level: 0, genderRatio: 127,
      safariSlots: 2, charm: false, tsv: 0, trv: 0, syncNature: 3, assumeSync: false, lead: 'none', timeline,
      dex: { active: true, terrain: 0, specialSlots: false, searchLevel: 0, chain: 0, charm: false, compoundEyes: false },
      unown: false,
    };
    const actual = searchWild6(request).rows;
    expect(actual.map(({ frame, slot, members }) => {
      const entries = members.map(p => [p.slot, p.species, p.level, p.item ?? 0, encodePokemon(p)].join(' '));
      return `${frame} ${slot} ${entries.join(';')}`;
    })).toEqual(rows);
    for (const ability of [1, 2, 3]) {
      const filtered = searchWild6({ ...request, filter: { ...createDefaultRngFilter(), ability } }).rows;
      const expected = rows.flatMap((line, frame) => {
        const matches = line.split(';').flatMap((entry, index) =>
          Number(entry.split(' ').at(-3)) === ability ? [index + 1] : []);
        return matches.length ? [{ frame, matches }] : [];
      });
      expect(filtered.map(({ frame, matches }) => ({ frame, matches }))).toEqual(expected);
    }
  });

  it.each(reference.wild)('matches calibrated Wild $settings', ({ settings, rows }) => {
    const [game, method, area, rod, party, delay, rate, charm, lead] = settings;
    const timeline: Timeline6Request = {
      state: [0xddeeff00, 0x99aabbcc, 0x55667788, 0x11223344],
      calls: [{ frame: 500, type: 0 }, { frame: 500, type: 1 }],
      method: 'normal', maxFrame: 770, split: false, delay: 0, cry: null, party: Number(party),
      oras: game === 'OR' || game === 'AS', slots: 2, rate: Number(rate), chain: 0, boost: false,
    };
    const actual = searchWild6({
      seed, minFrame: 502, maxFrame: 770, game: game as Wild6Request['game'], method: method as Wild6Request['method'],
      area: Number(area), rod: Number(rod), slot: 0, delay: Number(delay), chain: method === 'Fishing' ? 4 : 0,
      ha: Boolean(charm), haSlot: 0, potential: 0, forceShiny: false, level: 0, genderRatio: 127,
      safariSlots: charm ? 3 : 2, charm: Boolean(charm), tsv: 0, trv: 0, syncNature: 3, assumeSync: false,
      lead: (lead ?? 'none') as Wild6Request['lead'], timeline,
      dex: { active: true, terrain: 0, specialSlots: false, searchLevel: 0, chain: 0,
        charm: Boolean(charm), compoundEyes: false }, unown: false,
    }).rows;
    expect(actual).toHaveLength(rows.length);
    for (const [index, { frame, slot, members }] of actual.entries()) {
      const member = members[0]!;
      expect([frame, slot, member.species, member.level, member.item, encodePokemon(member)].join(' ')).toBe(rows[index]);
    }
  });

  it.each(reference.stationary)('matches calibrated Stationary $game at delay $delay', ({ game, delay, rows }) => {
    const oras = game === 'OR';
    const timeline: Timeline6Request = {
      state: [0xddeeff00, 0x99aabbcc, 0x55667788, 0x11223344],
      calls: [{ frame: 500, type: 0 }, { frame: 500, type: 1 }],
      method: oras ? 'cutscene' : 'instant', maxFrame: 764, split: delay > 0,
      delay: 78, cry: delay > 0 ? 31 : null, party: 2, oras, slots: 2, rate: 1, chain: 0, boost: false,
    };
    const actual = [...searchStationary6({
      seed, minFrame: 502, maxFrame: 764, targetFrame: 5000, game: oras ? 'OR' : 'X',
      preset: oras ? 'oras:1:8' : 'xy:1:3', considerDelay: delay > 0, delay,
      timeline, syncNature: 3, tsv: 0, trv: 0, shinyCharm: false,
    })];
    expect(actual.map(row => [row.frame, Number(row.synchronize), encodePokemon(row)].join(' '))).toEqual(rows);
  });

  it.each(reference.event)('matches Event PID type $type with ORAS=$oras', ({ oras, type, rows }) => {
    const card: WonderCard6 = {
      species: 25, forme: 0, level: 50, tid: 12345, sid: 54321, pidType: type as WonderCard6['pidType'],
      pid: 0x12345678, ec: type === 3 ? 0x10203040 : 0, abilityLocked: type === 3, ability: type === 3 ? 3 : 1,
      natureLocked: type === 3, nature: 3, genderLocked: true, gender: 2, ivs: [31, -1, 5, -1, -1, -1],
      ivsCount: 2, isEgg: false, yourId: false, otherInfo: true,
    };
    expect(searchEvent6({ ...range, oras, card, trainerTSV: 0, delay: 0 }).rows.map(encodePokemon)).toEqual(rows);
  });

  it.each(reference.eventOt)('matches a player-owned Event egg, PID type $type, OT info $otherInfo, ORAS=$oras', fixture => {
    const card: WonderCard6 = {
      species: 25, forme: 0, level: 1, tid: 12345, sid: 54321, pidType: fixture.type as WonderCard6['pidType'],
      pid: 0x12345678, ec: 0, abilityLocked: false, ability: 0, natureLocked: false, nature: 0,
      genderLocked: false, gender: 0, ivs: [-1, -1, -1, -1, -1, -1], ivsCount: 3,
      isEgg: true, yourId: true, otherInfo: fixture.otherInfo,
    };
    const { rows } = searchEvent6({ ...range, oras: fixture.oras, card, trainerTSV: 3880, delay: 0 });
    expect(rows.map(encodePokemon)).toEqual(fixture.rows);
  });

  it.each(reference.eggKey)('matches the current egg and early square-shiny reroll with swapped key=$swap', fixture => {
    const key: EggKey6 = [0x6f08226b, 0x7f5a7341];
    if (fixture.swap) key.reverse();
    const row = eggFromKey6({
      male: [1, 2, 3, 4, 5, 6], female: [21, 22, 23, 24, 25, 26], maleItem: 1, femaleItem: 1,
      ability: 2, ratio: 127, masuda: true, charm: true, accept: true, nido: false,
      tsv: fixture.tsv, trv: fixture.trv, otherTSVs: [],
    }, key);
    expect([
      encodePokemon(row), Number(row.square), row.parents.map(p => p === null ? '-' : p ? 'M' : 'F').join(''), Number(row.everstone),
    ].join(' ')).toBe(fixture.row);
  });

  it.each(reference.egg)('matches Egg parents, key and PID for $settings', ({ settings, rows }) => {
    const [maleItem, femaleItem, masuda, charm, accept] = settings;
    const result = searchEgg6({
      ...range, male: [1, 2, 3, 4, 5, 6], female: [21, 22, 23, 24, 25, 26], ability: 2, ratio: 127,
      maleItem: Number(maleItem), femaleItem: Number(femaleItem), masuda: Boolean(masuda), charm: Boolean(charm),
      accept: Boolean(accept), nido: false, tsv: 0, trv: 0, otherTSVs: [1920, 2574, 466], delay: accept ? 16 : 0,
    });
    expect(result.rows.map(row => [
      encodePokemon(row), toHex32(row.key[1]) + toHex32(row.key[0]), row.parents.map(p => p === null ? '-' : p ? 'M' : 'F').join(''),
    ].join(' '))).toEqual(rows);
  });
});

