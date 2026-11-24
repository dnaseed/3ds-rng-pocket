import data from './generated/wild_gen6.json';
import type { GameVersion6 } from '../engine/core/types';

export type WildMethod6 = 'Normal' | 'Horde' | 'RockSmash' | 'Fishing' | 'PokeRadar' | 'FriendSafari' | 'CaveShadow' | 'Trap' | 'DexNav';
export type WildArea6 = (typeof data.normal)[number];

export function wildGroup6(game: GameVersion6) {
  return game === 'X' || game === 'Y' ? data.xy : data.oras;
}

export function wildAreas6(game: GameVersion6, method: WildMethod6): WildArea6[] {
  const group = wildGroup6(game);
  if (!group.methods.some(preset => preset.method === method)) return [];
  switch (method) {
    case 'Horde': return group.horde;
    case 'Fishing': return group.fishing;
    case 'RockSmash': return group.smash;
    case 'CaveShadow': return data.shadow;
    case 'Trap': return data.trap;
    default: return group === data.oras ? data.normal : [];
  }
}

export function wildLocation6(area: WildArea6) {
  const name = data.locationNames[area.location] ?? String(area.location);
  return area.variant ? `${name} (${area.variant})` : name;
}

/** Species and levels in the same order as the desktop slot selector. */
export function wildSlots6(game: GameVersion6, method: WildMethod6, area: WildArea6, rod = 0) {
  const first = method === 'Fishing' ? rod * 3 : 0;
  const count = method === 'Fishing' ? 3 : area.species.length;
  const group = wildGroup6(game);
  return area.species.slice(first, first + count).map((original, i) => {
    let species = original;
    if (method === 'Horde' && (game === 'Y' || game === 'AS')) {
      species = group.hordeAlternate[group.hordeBase.indexOf(original)] ?? original;
    } else if (game === 'Y' && method === 'Fishing') {
      species = ({ 121: 91, 692: 690, 693: 691 } as Record<number, number>)[original] ?? original;
    } else if (game === 'AS' && (method === 'Normal' || method === 'DexNav') && original === 303) {
      species = 302;
    }
    return { species, level: area.levels[first + i]! };
  });
}

/** Horde area methods in v1.0.6 compare the special rule with the one-based slot. */
export function hordeMembers6(game: GameVersion6, area: WildArea6, slot: number): number[] {
  if (slot === 0) return Array<number>(5).fill(0);
  const original = area.species[slot - 1];
  if (original === undefined) throw new RangeError('Invalid horde slot');
  const group = wildGroup6(game);
  const members = Array<number>(5).fill(original);
  const rule = group.specialHordes.find(entry => entry[0] === original);
  if (rule && rule[3] === slot && (rule.length === 4 || rule[4] === area.location)) {
    members[rule[2]!] = rule[1]!;
  }
  if ((game === 'Y' || game === 'AS') && area.species.some(s => group.hordeBase.includes(s))) {
    for (const [i, member] of members.entries()) members[i] = group.hordeAlternate[group.hordeBase.indexOf(member)] ?? member;
    if (game === 'AS' && area.location === 230 && original === 270) members[3] = 333;
  }
  return members;
}
