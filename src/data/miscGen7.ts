// Display labels from 3DSRNGTool's StringItem.cs and Data/ guides.
export const FESTIVAL_FACILITIES = [
  'Big Dream', 'Gold Rush', 'Treasure Hunt', 'Ghosts Den', 'Trick Room', 'Confuse Ray',
  'Ball Shop', 'General Shop', 'Battle Shop', 'Soft Drink', 'Pharmacy', 'Rare Kitchen',
  'Battle Table', 'Friendship Cafe', 'Friendship Parlor', 'Thump-Bump', 'Clink-Clunk',
  'Stomp-Stomp', 'Kanto Tent', 'Johto Tent', 'Hoenn Tent', 'Sinnoh Tent', 'Unova Tent',
  'Kalos Tent', 'Pokemon House', 'Team Red', 'Team Yellow', 'Team Green', 'Team Blue',
  'Team Orange', 'Team NavyBlue', 'Team Purple', 'Team Pink', 'Switcheroo',
] as const;

export const FESTIVAL_RANKS = [
  '1–2', '3', '4', '5', '6', '7', '8', '9', '10', '11–20', '21–30', '31–40',
  '41–50', '51–60', '61–70', '71–80', '81–90', '91–99', '100+',
] as const;

export const SPECIAL_TRAINERS = [
  'Grimsley', 'Anabel', 'Wally', 'Colress', 'Cynthia', 'Plumeria', 'Guzma',
  'Kiawe', 'Mallow', 'Sina', 'Dexio', 'Red', 'Blue', 'Kukui',
] as const;

export const ROTO_POWERS = [
  'Boost', 'Hatch', 'Bargain', 'Prize Money', 'Exp. Points', 'Friendship', 'Encounter',
  'Stealth', 'HP Restore', 'PP Restore', 'Catch',
] as const;

export const ROTO_POWERS_IT = [
  'Stat’n’roll', 'Cova’n’roll', 'Sconto’n’roll', 'Soldi’n’roll', 'Esp’n’roll', 'Affetto’n’roll',
  'Incontra’n’roll', 'Repelle’n’roll', 'PS’n’roll', 'PP’n’roll', 'Acchiappa’n’roll',
] as const;

export const BERRY_PILES = [
  { location: 'Berry Fields', first: null, berries: ['Persim', 'Persim', 'Persim', 'Oran', 'Oran', 'Oran'] },
  { location: 'Route 2', first: 'Sitrus', berries: ['Chesto', 'Chesto', 'Oran', 'Persim', 'Leppa', 'Leppa'] },
  { location: 'Route 3', first: 'Sitrus', berries: ['Chesto', 'Pecha', 'Pecha', 'Cheri', 'Sitrus', 'Leppa'] },
  { location: 'Route 4', first: 'Lum', berries: ['Pecha', 'Figy', 'Wiki', 'Mago', 'Aguav', 'Iapapa'] },
  { location: 'Route 5', first: 'Lum', berries: ['Rawst', 'Rawst', 'Cheri', 'Cheri', 'Persim', 'Pecha'] },
  { location: 'Route 8', first: 'Lum', berries: ['Pecha', 'Persim', 'Chesto', 'Cheri', 'Oran', 'Sitrus'] },
  { location: 'Route 10', first: 'Kee', berries: ['Pomeg', 'Kelpsy', 'Qualot', 'Hondew', 'Grepa', 'Tamato'] },
  { location: "Ula'ula Beach", first: 'Apicot', berries: ['Aspear', 'Aspear', 'Cheri', 'Chesto', 'Leppa', 'Leppa'] },
  { location: 'Route 16', first: 'Lum', berries: ['Aspear', 'Aspear', 'Sitrus', 'Persim', 'Pecha', 'Oran'] },
  { location: 'Route 17', first: 'Ganlon', berries: ['Sitrus', 'Sitrus', 'Leppa', 'Pecha', 'Rawst', 'Lum'] },
  { location: 'Poni Wilds - NW', first: 'Salac', berries: ['Occa', 'Colbur', 'Chople', 'Shuca', 'Charti', 'Chilan'] },
  { location: 'Poni Wilds - N', first: 'Petaya', berries: ['Passho', 'Roseli', 'Yache', 'Wacan', 'Payapa', 'Babiri'] },
  { location: 'Poni Wilds - NE', first: 'Liechi', berries: ['Rindo', 'Kasib', 'Coba', 'Kebia', 'Tanga', 'Haban'] },
  { location: 'Poni Plains', first: 'Maranga', berries: ['Occa', 'Colbur', 'Chople', 'Shuca', 'Charti', 'Chilan'] },
] as const;

export const BERRY_LOCATIONS_IT = [
  'Campo di Bacche',
  'Percorso 2',
  'Percorso 3',
  'Percorso 4',
  'Percorso 5',
  'Percorso 8',
  'Percorso 10',
  'Spiaggia Ula Ula',
  'Percorso 16',
  'Percorso 17',
  'Prateria di Poni - NO',
  'Prateria di Poni - N',
  'Prateria di Poni - NE',
  'Pianura di Poni',
] as const;

export const BERRY_NAMES_IT: Record<string, string> = {
  Persim: 'Baccaki',
  Oran: 'Baccarancia',
  Sitrus: 'Baccacedro',
  Chesto: 'Baccastagna',
  Leppa: 'Baccamela',
  Pecha: 'Baccapesca',
  Cheri: 'Baccaliegia',
  Lum: 'Baccaprugna',
  Figy: 'Baccafico',
  Wiki: 'Baccakiwi',
  Mago: 'Baccamango',
  Aguav: 'Baccaguava',
  Iapapa: 'Baccapaia',
  Rawst: 'Baccafrago',
  Kee: 'Baccalighia',
  Pomeg: 'Baccagrana',
  Kelpsy: 'Baccalga',
  Qualot: 'Baccaloquat',
  Hondew: 'Baccamelon',
  Grepa: 'Baccauva',
  Tamato: 'Baccamodoro',
  Apicot: 'Baccacocca',
  Aspear: 'Baccaperina',
  Ganlon: 'Baccalongan',
  Salac: 'Baccasalak',
  Occa: 'Baccacao',
  Colbur: 'Baccaxan',
  Chople: 'Baccarosmel',
  Shuca: 'Baccanaca',
  Charti: 'Baccaciofo',
  Chilan: 'Baccacinlan',
  Petaya: 'Baccapitaya',
  Passho: 'Baccapasflo',
  Roseli: 'Baccarcadè',
  Yache: 'Baccamoya',
  Wacan: 'Baccaparmen',
  Payapa: 'Baccapayapa',
  Babiri: 'Baccababiri',
  Liechi: 'Baccalici',
  Rindo: 'Baccarindo',
  Kasib: 'Baccacitrus',
  Coba: 'Baccababa',
  Kebia: 'Baccakebia',
  Tanga: 'Baccaitan',
  Haban: 'Baccahaban',
  Maranga: 'Baccapane',
};

export function getRotoPowerLabel(index: number, lang: 'it' | 'en'): string {
  return lang === 'it'
    ? (ROTO_POWERS_IT[index] ?? `Roto ${ROTO_POWERS[index]}`)
    : `Roto ${ROTO_POWERS[index]}`;
}

export function getBerryLocationLabel(index: number, lang: 'it' | 'en'): string {
  return lang === 'it'
    ? (BERRY_LOCATIONS_IT[index] ?? BERRY_PILES[index]!.location)
    : BERRY_PILES[index]!.location;
}

export function getBerryNameLabel(berry: string, lang: 'it' | 'en'): string {
  return lang === 'it' ? (BERRY_NAMES_IT[berry] ?? berry) : berry;
}
