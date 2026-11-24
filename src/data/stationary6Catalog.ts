import catalog from './generated/stationary_gen6.json';
import { getPersonalEntry6 } from './personalTable6';
import type { GameVersion6 } from '../engine/core/types';

export type Stationary6Game = GameVersion6 | 'VC';
export type Stationary6Preset = (typeof catalog.xy)[number]['list'][number];

export function getStationary6Categories(game: Stationary6Game) {
  const xy = game === 'X' || game === 'Y';
  const group = xy ? 'XY' : 'ORAS';
  const categories = game === 'VC' ? catalog.vc : xy ? catalog.xy : catalog.oras;
  return categories.map(category => ({
    ...category,
    list: category.list.filter(preset =>
      preset.version === 'Gen6' || preset.version === group || preset.version === game),
  }));
}

export function getStationary6Traits(preset: Stationary6Preset) {
  const personal = getPersonalEntry6(preset.species, preset.forme);
  // The C# Version.Contains(XY) checks the template's version, not the active game.
  const iv3 = personal.eggGroups[0] === 0xf &&
    (preset.version === 'XY' || !catalog.babyMons.includes(preset.species));
  return {
    iv3,
    alwaysSync: preset.gift || preset.nature < 25 || preset.bank,
    syncable: !preset.bank && (!preset.gift || (iv3 && !preset.egg)),
    shinyLocked: preset.shinyLocked || preset.bank || preset.otTsv !== null,
    genderRatio: preset.gender > 0 ? (2 - 2 * preset.gender) & 0xff : personal.gender,
  };
}
