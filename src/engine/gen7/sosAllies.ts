import { getFormeEntry } from '../../data/personalTable';

export type SosWeather = 0 | 1 | 2 | 3; // 0=None, 1=Rain, 2=Hail, 3=Sand

interface SosAllyRule {
  species: number;
  slottype?: number;
  ally?: readonly number[];
  baby?: number;
  locations?: readonly number[];
  ultra?: boolean;
}

const WEATHER_LOCATIONS = new Set<number>([134, 90, 120, 184, 114, 146, 124]);

const SOS_ALLY_TABLE: readonly SosAllyRule[] = [
  { species: 10, locations: [6, 8] },
  { species: 10, slottype: 4, ally: [12] },
  { species: 11, slottype: 2, ally: [10], locations: [6] },
  { species: 11, slottype: 5, ally: [12, 10] },
  { species: 41, slottype: 4, ally: [42], locations: [76, 100], ultra: true },
  { species: 42, slottype: 3, ally: [169], locations: [90, 182] },
  { species: 2100, slottype: 4, ally: [2101], ultra: true },
  { species: 79, slottype: 3, ally: [80], locations: [14], ultra: false },
  { species: 79, slottype: 9, ally: [199, 80], locations: [14], ultra: true },
  { species: 93, slottype: 1, ally: [94] },
  { species: 104, baby: 115 },
  { species: 113, slottype: 8, ally: [242], ultra: true },
  { species: 118, slottype: 4, ally: [119] },
  { species: 120, slottype: 3, ally: [121], locations: [56], ultra: false },
  { species: 120, slottype: 3, ally: [121], ultra: true },
  { species: 128, slottype: 7, ally: [241] },
  { species: 129, slottype: 4, ally: [130] },
  { species: 133, slottype: 3, ally: [196] },
  { species: 147, slottype: 4, ally: [148] },
  { species: 147, slottype: 9, ally: [149, 148], locations: [170] },
  { species: 163, slottype: 4, ally: [164] },
  { species: 170, slottype: 4, ally: [171], ultra: true },
  { species: 172, slottype: 4, ally: [25], baby: 440 },
  { species: 173, slottype: 4, ally: [35], baby: 440, ultra: true },
  { species: 173, slottype: 4, ally: [35], baby: 113, ultra: false },
  { species: 174, slottype: 4, ally: [39], baby: 440 },
  { species: 177, slottype: 4, ally: [178] },
  { species: 190, slottype: 3, ally: [424] },
  { species: 222, slottype: 6, ally: [747] },
  { species: 223, slottype: 4, ally: [224] },
  { species: 238, slottype: 3, ally: [124], baby: 440 },
  { species: 239, slottype: 4, ally: [125], baby: 440, ultra: true },
  { species: 239, slottype: 4, ally: [125], baby: 113, ultra: false },
  { species: 240, slottype: 4, ally: [126], baby: 440, ultra: true },
  { species: 240, slottype: 4, ally: [126], ultra: false },
  { species: 241, slottype: 7, ally: [128] },
  { species: 318, slottype: 4, ally: [319] },
  { species: 339, slottype: 4, ally: [340] },
  { species: 341, slottype: 4, ally: [342] },
  { species: 361, slottype: 7, ally: [362], ultra: false },
  { species: 366, slottype: 3, ally: [367] },
  { species: 371, slottype: 3, ally: [372], locations: [14] },
  { species: 371, slottype: 1, ally: [373], locations: [10] },
  { species: 427, slottype: 3, ally: [428] },
  { species: 438, slottype: 3, ally: [185], baby: 440, locations: [8] },
  { species: 438, slottype: 4, ally: [185], baby: 440, locations: [90] },
  { species: 439, slottype: 3, ally: [122], baby: 440 },
  { species: 446, slottype: 1, ally: [143], baby: 440 },
  { species: 447, slottype: 3, ally: [448], baby: 440, ultra: true },
  { species: 447, slottype: 3, ally: [448], baby: 113, ultra: false },
  { species: 458, slottype: 10, ally: [223] },
  { species: 568, slottype: 4, ally: [569], ultra: false },
  { species: 625, slottype: 2, ally: [624] },
  { species: 636, slottype: 1, ally: [637] },
  { species: 661, slottype: 4, ally: [662], ultra: true },
  { species: 674, slottype: 7, ally: [675] },
  { species: 702, slottype: 10, ally: [777], ultra: true },
  { species: 703, slottype: 7, ally: [302] },
  { species: 732, slottype: 2, ally: [731], locations: [58], ultra: false },
  { species: 732, slottype: 4, ally: [733], locations: [164, 166], ultra: true },
  { species: 732, slottype: 3, ally: [733], locations: [108], ultra: true },
  { species: 734, slottype: 4, ally: [735], locations: [58], ultra: true },
  { species: 737, slottype: 11, ally: [738, 736], locations: [138], ultra: true },
  { species: 749, slottype: 4, ally: [750], ultra: true },
  { species: 757, slottype: 1, ally: [758], ultra: true },
  { species: 765, slottype: 2, ally: [732] },
  { species: 766, slottype: 2, ally: [732] },
  { species: 777, slottype: 10, ally: [702], ultra: true },
  { species: 782, slottype: 11, ally: [784, 783] },
];

function applyAllyRule(rule: SosAllyRule, isNight: boolean): number[] {
  let allies = new Array<number>(7).fill(rule.species);
  if (rule.baby && rule.baby > 0) {
    allies[4] = rule.baby;
  }
  const ally = rule.ally ?? [];
  switch (rule.slottype) {
    case 1:
      allies[0] = ally[0] ?? rule.species;
      break;
    case 2:
      allies = new Array<number>(7).fill(ally[0] ?? rule.species);
      break;
    case 3: {
      let a = ally[0] ?? rule.species;
      if ((isNight && a === 196) || (!isNight && a === 367)) {
        // Espeon -> Umbreon at night; Gorebyss -> Huntail during day
        a++;
      }
      allies[0] = allies[1] = allies[2] = a;
      break;
    }
    case 4: {
      const a0 = ally[0] ?? rule.species;
      allies[0] = allies[1] = allies[2] = allies[3] = a0;
      break;
    }
    case 5: {
      const a0 = ally[0] ?? rule.species;
      const a1 = ally[1] ?? rule.species;
      allies[0] = allies[1] = allies[2] = allies[3] = a0;
      allies[4] = allies[5] = allies[6] = a1;
      break;
    }
    case 6: {
      const a0 = ally[0] ?? rule.species;
      allies[0] = allies[1] = allies[2] = allies[3] = allies[4] = allies[5] = a0;
      break;
    }
    case 7:
      allies[6] = ally[0] ?? rule.species;
      break;
    case 8: {
      const a0 = ally[0] ?? rule.species;
      allies[3] = allies[4] = a0;
      break;
    }
    case 9: {
      const a0 = ally[0] ?? rule.species;
      const a1 = ally[1] ?? rule.species;
      allies[0] = a0;
      allies[1] = allies[2] = allies[3] = a1;
      break;
    }
    case 10: {
      const a0 = ally[0] ?? rule.species;
      allies[4] = allies[5] = a0;
      break;
    }
    case 11: {
      const a0 = ally[0] ?? rule.species;
      const a1 = ally[1] ?? rule.species;
      allies[0] = allies[1] = allies[2] = a0;
      allies[3] = allies[4] = allies[5] = allies[6] = a1;
      break;
    }
  }
  return allies;
}

function meetRequire(rule: SosAllyRule, loc: number, isUltra: boolean): boolean {
  if (rule.locations === undefined) {
    return isUltra === rule.ultra;
  }
  if (rule.ultra === undefined) {
    return rule.locations.includes(loc);
  }
  return isUltra === rule.ultra && rule.locations.includes(loc);
}

/**
 * Exact TypeScript port of Pk3DSRNGTool.SOSAllies.getAllies.
 * Returns the 7 SOS ally SpecForm slots for a caller species at a given location.
 */
export function getSosAllies(
  locationIdx: number,
  species: number,
  isMoon: boolean,
  isNight: boolean,
  isUltra = true,
): number[] {
  if (
    species <= 0 ||
    getFormeEntry(species & 0x7ff, species >>> 11).callRate === 0
  ) {
    return new Array<number>(7).fill(0);
  }
  if (isUltra && locationIdx === 124) {
    // Haina Desert adds Golett (US) or Baltoy (UM) on slot 6 (index 5)
    const tmp = new Array<number>(7).fill(species);
    tmp[5] = isMoon ? 343 : 622;
    return tmp;
  }
  const candidacies = SOS_ALLY_TABLE.filter((t) => t.species === species);
  if (candidacies.length === 0) {
    return new Array<number>(7).fill(species);
  }
  const loc = locationIdx & 0xff;
  const firstMatch = candidacies.find((t) => meetRequire(t, loc, isUltra));
  const fallback = candidacies.find(
    (t) => t.ultra === undefined && t.locations === undefined,
  );
  return applyAllyRule(firstMatch ?? fallback ?? { species }, isNight);
}

/**
 * Exact TypeScript port of Pk3DSRNGTool.SOSAllies.getWeatherAllies.
 * Returns [W1 (1%), W2 (10%)] SpecForm IDs for weather-triggered SOS encounters.
 */
export function getWeatherAllies(
  locationIdx: number,
  weather: SosWeather,
  isNight: boolean,
  isUltra = true,
): [number, number] {
  const location = locationIdx & 0xff;
  const index = locationIdx >>> 8;
  if (weather === 0 || !WEATHER_LOCATIONS.has(location)) {
    return [0, 0];
  }
  const tmp: [number, number] = [351, 351]; // Castform
  switch (weather) {
    case 1: // Rain
      if (location === 134) {
        tmp[0] = isNight ? 186 : 62;
        tmp[1] = 61;
      } else if (location === 90 || location === 120) {
        tmp[1] = 704;
      } else if (location === 184) {
        tmp[1] = 705;
      }
      break;
    case 2: // Hail
      if (location === 114 || (location === 146 && isUltra && index === 1)) {
        tmp[1] = 582;
      } else if (location === 146) {
        if (isUltra) tmp[0] = 584;
        tmp[1] = 583;
      }
      break;
    case 3: // Sand
      if (location === 124) {
        tmp[1] = 444;
      }
      break;
  }
  return tmp;
}
