import textEn from '../generated/text_en.json';
import gameIt from './game_it.json';
import uiEn from './ui_en.json';
import uiIt from './ui_it.json';

export type Language = 'it' | 'en';

type Dict = Record<string, unknown>;

const UI_DICTS: Record<Language, Dict> = {
  en: uiEn as Dict,
  it: uiIt as Dict,
};

function lookupNested(dict: Dict, key: string): string | null {
  const parts = key.split('.');
  let cur: unknown = dict;
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in (cur as Dict)) {
      cur = (cur as Dict)[part];
    } else {
      return null;
    }
  }
  return typeof cur === 'string' ? cur : null;
}

const LEAD_EN = [
  'None',
  'Synchronize',
  'Cute Charm ♂',
  'Cute Charm ♀',
  'Static',
  'Magnet Pull',
  'Compound Eyes',
  'Suction Cups | Sticky Hold',
  'Pressure | Hustle | Vital Spirit',
  'Black Flute (+Lv)',
  'White Flute (-Lv)',
];

const PID_TYPE_EN = ['Random', 'Nonshiny', 'Shiny', 'Specified'];

export function createI18n(lang: Language) {
  const ui = UI_DICTS[lang];
  const fallback = UI_DICTS.en;

  function t(key: string, vars?: Record<string, string | number>): string {
    let text = lookupNested(ui, key) ?? lookupNested(fallback, key) ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  }

  function getSpeciesName(species: number): string {
    if (lang === 'it') {
      const ov = (gameIt.speciesOverrides as Record<string, string>)[String(species)];
      if (ov) return ov;
    }
    return textEn.species[species] ?? `#${species}`;
  }

  function getNatureName(nature: number): string {
    if (nature < 0 || nature >= 25) return '-';
    return lang === 'it'
      ? (gameIt.natures[nature] ?? textEn.natures[nature] ?? '-')
      : (textEn.natures[nature] ?? '-');
  }

  function getTypeName(typeIdx: number): string {
    if (typeIdx < 0 || typeIdx >= 18) return '-';
    return lang === 'it'
      ? (gameIt.types[typeIdx] ?? textEn.types[typeIdx] ?? '-')
      : (textEn.types[typeIdx] ?? '-');
  }

  /** Hidden Power indices 0..15 map to Fighting..Dark (text_Types[1..16]). */
  function getHpTypeName(hpIdx: number): string {
    return getTypeName(hpIdx + 1);
  }

  function getAbilityName(abilityId: number): string {
    return textEn.abilities[abilityId] ?? `#${abilityId}`;
  }

  function getLocationName(locationIdx: number, mark = ''): string {
    const baseId = locationIdx & 0xff;
    let base = '';
    if (lang === 'it') {
      base =
        (gameIt.locationOverrides as Record<string, string>)[String(baseId)] ??
        textEn.locations[baseId] ??
        `Loc ${baseId}`;
    } else {
      base = textEn.locations[baseId] ?? `Loc ${baseId}`;
    }
    return mark ? `${base}${mark}` : base;
  }

  function getCategoryName(categoryText: string): string {
    if (lang === 'it') {
      return (gameIt.categories as Record<string, string>)[categoryText] ?? categoryText;
    }
    return categoryText;
  }

  function getItemName(idx: number): string {
    return lang === 'it'
      ? (gameIt.items[idx] ?? textEn.items[idx] ?? '-')
      : (textEn.items[idx] ?? '-');
  }

  function getGenderRatioLabel(idx: number): string {
    return lang === 'it'
      ? (gameIt.genderRatios[idx] ?? textEn.genderRatios[idx] ?? '-')
      : (textEn.genderRatios[idx] ?? '-');
  }

  function getLeadAbilityName(idx: number): string {
    return lang === 'it'
      ? (gameIt.leadAbilities[idx] ?? LEAD_EN[idx] ?? '-')
      : (LEAD_EN[idx] ?? '-');
  }

  function getPidTypeName(idx: number): string {
    return lang === 'it'
      ? (gameIt.pidTypes[idx] ?? PID_TYPE_EN[idx] ?? '-')
      : (PID_TYPE_EN[idx] ?? '-');
  }

  return {
    lang,
    t,
    getSpeciesName,
    getNatureName,
    getTypeName,
    getHpTypeName,
    getAbilityName,
    getLocationName,
    getCategoryName,
    getItemName,
    getGenderRatioLabel,
    getLeadAbilityName,
    getPidTypeName,
  };
}
