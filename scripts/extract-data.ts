import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REF_DIR = path.join(
  ROOT,
  '_reference',
  '3DSRNGTool-master',
  '3DSRNGTool-master',
  '3DSRNGTool',
);
const OUT_DIR = path.join(ROOT, 'src', 'data', 'generated');
const PUBLIC_CLOCK_DIR = path.join(ROOT, 'public', 'assets', 'clocks');

function readRef(relPath: string): string {
  return fs.readFileSync(path.join(REF_DIR, relPath), 'utf8');
}

function stripLineComments(src: string): string {
  return src
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('#region') || trimmed.startsWith('#endregion')) {
        return '';
      }
      let inStr = false;
      for (let i = 0; i < line.length - 1; i++) {
        if (line[i] === '"' && line[i - 1] !== '\\') {
          inStr = !inStr;
        } else if (!inStr && line[i] === '/' && line[i + 1] === '/') {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join('\n');
}

function extractBraceBlock(src: string, openBraceIdx: number): { block: string; endIdx: number } {
  if (openBraceIdx < 0 || src[openBraceIdx] !== '{') {
    throw new Error(`Invalid openBraceIdx=${openBraceIdx} in snippet: ${src.slice(0, 120)}`);
  }
  let depth = 0;
  let inStr = false;
  for (let i = openBraceIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' && src[i - 1] !== '\\') {
      inStr = !inStr;
    } else if (!inStr) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return { block: src.slice(openBraceIdx + 1, i), endIdx: i };
        }
      }
    }
  }
  throw new Error(`Unbalanced brace block in C# source: ${src.slice(0, 120)}`);
}

function findNamedBlock(src: string, marker: string): string {
  const idx = src.indexOf(marker);
  if (idx === -1) throw new Error(`Marker not found: ${marker}`);
  const openBrace = src.indexOf('{', idx + marker.length);
  if (openBrace === -1) throw new Error(`Opening brace not found for: ${marker}`);
  return extractBraceBlock(src, openBrace).block;
}

function splitTopLevelItems(block: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let inStr = false;
  let start = 0;
  for (let i = 0; i < block.length; i++) {
    const ch = block[i];
    if (ch === '"' && block[i - 1] !== '\\') {
      inStr = !inStr;
    } else if (!inStr) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === ',' && depth === 0) {
        const chunk = block.slice(start, i).trim();
        if (chunk) items.push(chunk);
        start = i + 1;
      }
    }
  }
  const tail = block.slice(start).trim();
  if (tail) items.push(tail);
  return items;
}

function parseIntList(inner: string): number[] {
  return inner
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseCSharpNumber(s));
}

function parseCSharpNumber(raw: string): number {
  const s = raw.trim();
  if (s.startsWith('0x') || s.startsWith('0X')) {
    return Number.parseInt(s.slice(2), 16);
  }
  return Number.parseInt(s, 10);
}

function parseObjectAssignments(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of splitTopLevelItems(body)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    out[key] = val;
  }
  return out;
}

function parseNewArrayNumbers(expr: string): number[] {
  const open = expr.indexOf('{');
  const close = expr.lastIndexOf('}');
  if (open === -1 || close === -1) return [];
  return parseIntList(expr.slice(open + 1, close));
}

function parseDict(src: string, marker: string): Record<number, number> {
  const block = findNamedBlock(src, marker);
  const dict: Record<number, number> = {};
  const re = /\{\s*([^{},]+)\s*,\s*([^{},]+)\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    dict[parseCSharpNumber(m[1]!)] = parseCSharpNumber(m[2]!);
  }
  return dict;
}

function extractPersonal(resource: 'personal_ao' | 'personal_uu') {
  const buf = fs.readFileSync(path.join(REF_DIR, 'Resources', 'bytes', resource));
  const size = resource === 'personal_ao' ? 0x50 : 0x54;
  if (buf.length % size !== 0) {
    throw new Error(`Invalid ${resource} length: ${buf.length}`);
  }
  const count = buf.length / size;
  const entries = [];
  for (let i = 0; i < count; i++) {
    const o = i * size;
    // Note: in PersonalInfoORAS/USUM, bytes are HP=0x00, ATK=0x01, DEF=0x02, SPE=0x03, SPA=0x04, SPD=0x05.
    // We normalize to [HP, ATK, DEF, SPA, SPD, SPE] matching MainForm BS & Pokemon.getStats!
    entries.push({
      stats: [
        buf.readUInt8(o + 0x00),
        buf.readUInt8(o + 0x01),
        buf.readUInt8(o + 0x02),
        buf.readUInt8(o + 0x04),
        buf.readUInt8(o + 0x05),
        buf.readUInt8(o + 0x03),
      ],
      types: [buf.readUInt8(o + 0x06), buf.readUInt8(o + 0x07)],
      catchRate: buf.readUInt8(o + 0x08),
      gender: buf.readUInt8(o + 0x12),
      eggGroups: [buf.readUInt8(o + 0x16), buf.readUInt8(o + 0x17)],
      abilities: [buf.readUInt8(o + 0x18), buf.readUInt8(o + 0x19), buf.readUInt8(o + 0x1a)],
      ...(resource === 'personal_ao'
        ? { escapeRate: buf.readUInt8(o + 0x1b) }
        : { callRate: buf.readUInt8(o + 0x1b) }),
      formStatsIndex: buf.readUInt16LE(o + 0x1c),
      formeCount: buf.readUInt8(o + 0x20),
    });
  }
  return entries;
}

export interface StationaryTemplate {
  species: number;
  forme: number;
  level: number;
  delay: number;
  delayType: number;
  npc: number;
  shinyLocked: boolean;
  gift: boolean;
  egg: boolean;
  raining: boolean;
  totem: boolean;
  ultraWormhole: boolean;
  isPelago: boolean;
  unstable: boolean;
  conceptual: boolean;
  syncable: boolean;
  alwaysSync: boolean;
  iv3: boolean;
  otTsv: number | null;
  version: 'Gen7' | 'US' | 'UM' | 'S' | 'M';
  nature: number;
  ability: number;
  gender: number;
  ivs: number[] | null;
}

function parseVersion(expr?: string): 'Gen7' | 'US' | 'UM' | 'S' | 'M' {
  if (!expr) return 'Gen7';
  if (expr.endsWith('.US')) return 'US';
  if (expr.endsWith('.UM')) return 'UM';
  if (expr.endsWith('.SN')) return 'S';
  if (expr.endsWith('.MN')) return 'M';
  return 'Gen7';
}

function parseBool(expr: string | undefined, fallback: boolean): boolean {
  if (expr === 'true') return true;
  if (expr === 'false') return false;
  return fallback;
}

function parseCSharpString(expr: string | undefined): string {
  if (!expr) return '';
  const m = expr.match(/^"(.*)"$/);
  return m ? m[1]! : expr;
}

function extractStationaryGen6() {
  const src = stripLineComments(readRef('Gen6/PKM6.cs'));
  const defaults = findNamedBlock(src, 'static PokemonList Default =');
  const babyMons = parseIntList(findNamedBlock(readRef('Pokemon/Pokemon.cs'), 'BabyMons ='));

  function extractTable(group: 'XY' | 'ORAS' | 'VC') {
    const categories = splitTopLevelItems(findNamedBlock(src, `Species_${group} =`));
    return categories.map((category, categoryIndex) => {
      const body = category === 'Default' ? defaults : extractBraceBlock(category, category.indexOf('{')).block;
      const fields = parseObjectAssignments(body);
      const list = fields.List;
      if (!list) throw new Error(`Missing Gen 6 Stationary list in ${group}, category ${categoryIndex}`);
      const items = splitTopLevelItems(extractBraceBlock(list, list.indexOf('{')).block);
      const text = parseCSharpString(fields.Text);
      return {
        text,
        list: items.map((item, index) => {
          const id = `${group.toLowerCase()}:${categoryIndex}:${index}`;
          const preset = parseObjectAssignments(extractBraceBlock(item, item.indexOf('{')).block);
          const version = preset.Version?.replace(/^GameVersion\./, '') ?? 'Gen6';
          if (!['Gen6', 'XY', 'ORAS', 'X', 'Y', 'OR', 'AS'].includes(version)) {
            throw new Error(`Unsupported game version in ${id}: ${version}`);
          }
          const number = (key: string, fallback: number) =>
            preset[key] === undefined ? fallback : parseCSharpNumber(preset[key]);
          const flag = (key: string) => parseBool(preset[key], false);
          const ivs = preset.IVs ? parseNewArrayNumbers(preset.IVs) : null;
          if (ivs && (ivs.length !== 6 || ivs.some(iv => !Number.isInteger(iv) || iv < -1 || iv > 31))) {
            throw new Error(`Invalid IVs in ${id}`);
          }
          return {
            id,
            version,
            species: number('Species', 0),
            forme: number('Forme', 0),
            level: number('Level', 0),
            delay: number('Delay', 0),
            cry: number('Cry', 0xff),
            ability: number('Ability', 0),
            gender: number('Gender', 0),
            nature: number('Nature', 0xff),
            ivs,
            otTsv: preset.OTTSV === undefined ? null : parseCSharpNumber(preset.OTTSV),
            shinyLocked: flag('ShinyLocked'),
            gift: flag('Gift'),
            egg: flag('Egg'),
            conceptual: flag('Conceptual'),
            unstable: flag('Unstable'),
            bank: flag('Bank'),
            instantSync: flag('InstantSync'),
            numOfPkm: number('NumOfPkm', 1),
          };
        }),
      };
    });
  }

  return { xy: extractTable('XY'), oras: extractTable('ORAS'), vc: extractTable('VC'), babyMons };
}

function extractStationaryTable(marker: 'Species_USUM =' | 'Species_SM =') {
  const src = stripLineComments(readRef('Gen7/PKM7.cs'));
  const block = findNamedBlock(src, marker);
  const rawCategories = splitTopLevelItems(block);
  const categories: Array<{ text: string; list: StationaryTemplate[] }> = [];

  for (const catExpr of rawCategories) {
    if (catExpr === 'Default') {
      categories.push({
        text: '-',
        list: [
          {
            species: 0,
            forme: 0,
            level: 50,
            delay: 0,
            delayType: 0,
            npc: 0,
            shinyLocked: false,
            gift: false,
            egg: false,
            raining: false,
            totem: false,
            ultraWormhole: false,
            isPelago: false,
            unstable: false,
            conceptual: true,
            syncable: true,
            alwaysSync: false,
            iv3: false,
            otTsv: null,
            version: 'Gen7',
            nature: 0xff,
            ability: 0,
            gender: 0,
            ivs: null,
          },
        ],
      });
      continue;
    }

    const open = catExpr.indexOf('{');
    const inner = extractBraceBlock(catExpr, open).block;
    const fields = parseObjectAssignments(inner);
    const text = parseCSharpString(fields['Text']);
    const listExpr = fields['List'];
    if (!listExpr) throw new Error(`Missing List in category ${text}`);
    const listBlock = extractBraceBlock(listExpr, listExpr.indexOf('{')).block;
    const rawItems = splitTopLevelItems(listBlock);
    const list: StationaryTemplate[] = rawItems.map((itemExpr) => {
      const b = extractBraceBlock(itemExpr, itemExpr.indexOf('{')).block;
      const f = parseObjectAssignments(b);
      const gift = parseBool(f['Gift'], false);
      const totem = parseBool(f['Totem'], false);
      const ultraWormhole = parseBool(f['UltraWormhole'], false);
      const otTsv = f['OTTSV'] !== undefined ? parseCSharpNumber(f['OTTSV']) : null;
      const explicitShinyLocked = f['ShinyLocked'] !== undefined ? parseBool(f['ShinyLocked'], false) : null;
      const nature = f['Nature'] !== undefined ? parseCSharpNumber(f['Nature']) : 0xff;
      return {
        species: f['Species'] !== undefined ? parseCSharpNumber(f['Species']) : 0,
        forme: f['Forme'] !== undefined ? parseCSharpNumber(f['Forme']) : 0,
        level: f['Level'] !== undefined ? parseCSharpNumber(f['Level']) : 0,
        delay: f['Delay'] !== undefined ? parseCSharpNumber(f['Delay']) : 0,
        delayType: f['DelayType'] !== undefined ? parseCSharpNumber(f['DelayType']) : 0,
        npc: f['NPC'] !== undefined ? parseCSharpNumber(f['NPC']) : 0,
        shinyLocked: explicitShinyLocked ?? (totem || ultraWormhole || otTsv !== null),
        gift,
        egg: parseBool(f['Egg'], false),
        raining: parseBool(f['Raining'], false),
        totem,
        ultraWormhole,
        isPelago: parseBool(f['IsPelago'], false),
        unstable: parseBool(f['Unstable'], false),
        conceptual: parseBool(f['Conceptual'], false),
        syncable: parseBool(f['Syncable'], true),
        alwaysSync: gift || nature < 25,
        iv3: totem || ultraWormhole,
        otTsv,
        version: parseVersion(f['Version']),
        nature,
        ability: f['Ability'] !== undefined ? parseCSharpNumber(f['Ability']) : 0,
        gender: f['Gender'] !== undefined ? parseCSharpNumber(f['Gender']) : 0,
        ivs: f['IVs'] !== undefined ? parseNewArrayNumbers(f['IVs']) : null,
      };
    });
    categories.push({ text, list });
  }
  return categories;
}

function parseEncounterAreas(block: string) {
  return splitTopLevelItems(block).map((expr) => {
    const braceIdx = expr.indexOf('{');
    if (braceIdx === -1) {
      return {
        location: 0,
        idx: 0,
        locationIdx: 0,
        mark: '',
        correction: 1,
        npc: 0,
        levelMin: 0,
        levelMax: 3,
        lvldiff: 0,
        reverse: false,
        raining: false,
        species: [0],
        isSeparator: true,
      };
    }
    const f = parseObjectAssignments(extractBraceBlock(expr, braceIdx).block);
    const location = parseCSharpNumber(f['Location'] ?? '0');
    const idx = f['idx'] !== undefined ? parseCSharpNumber(f['idx']) : 0;
    const levelMin = parseCSharpNumber(f['LevelMin'] ?? '0');
    const levelMax = f['LevelMax'] !== undefined ? parseCSharpNumber(f['LevelMax']) : levelMin + 3;
    const lvldiff = f['lvldiff'] !== undefined ? parseCSharpNumber(f['lvldiff']) : 0;
    const markRaw = f['mark'] !== undefined ? parseCSharpString(f['mark']) : idx > 0 ? String(idx) : '';
    return {
      location,
      idx,
      locationIdx: location + (idx << 8),
      mark: markRaw ? ` (${markRaw})` : '',
      correction: f['Correction'] !== undefined ? parseCSharpNumber(f['Correction']) : 1,
      npc: f['NPC'] !== undefined ? parseCSharpNumber(f['NPC']) : 0,
      levelMin,
      levelMax,
      lvldiff,
      reverse: parseBool(f['Reverse'], false),
      raining: parseBool(f['Raining'], false),
      species: parseNewArrayNumbers(f['Species'] ?? '{}'),
      isSeparator: false,
    };
  });
}

function parseFishingAreas(block: string) {
  return splitTopLevelItems(block).map((expr) => {
    const f = parseObjectAssignments(extractBraceBlock(expr, expr.indexOf('{')).block);
    const location = parseCSharpNumber(f['Location'] ?? '0');
    const idx = f['idx'] !== undefined ? parseCSharpNumber(f['idx']) : 0;
    const markRaw = f['mark'] !== undefined ? parseCSharpString(f['mark']) : idx > 0 ? String(idx) : '';
    return {
      location,
      idx,
      locationIdx: location + (idx << 8),
      mark: markRaw ? ` (${markRaw})` : '',
      npc: f['NPC'] !== undefined ? parseCSharpNumber(f['NPC']) : 0,
      longdelay: parseBool(f['Longdelay'], false),
      lapras: parseBool(f['Lapras'], false),
      levelMin: f['LevelMin'] !== undefined ? parseCSharpNumber(f['LevelMin']) : 10,
      levelMax: parseCSharpNumber(f['LevelMax'] ?? '10'),
      slotType: parseCSharpNumber(f['SlotType'] ?? '0'),
      species: parseNewArrayNumbers(f['Species'] ?? '{}'),
    };
  });
}

function parseMiscAreas(block: string) {
  return splitTopLevelItems(block).map((expr) => {
    const f = parseObjectAssignments(extractBraceBlock(expr, expr.indexOf('{')).block);
    const location = parseCSharpNumber(f['Location'] ?? '0');
    const idx = f['idx'] !== undefined ? parseCSharpNumber(f['idx']) : 0;
    const levelMin = parseCSharpNumber(f['LevelMin'] ?? '0');
    const levelMax = f['LevelMax'] !== undefined ? parseCSharpNumber(f['LevelMax']) : levelMin + 3;
    const markRaw = f['mark'] !== undefined ? parseCSharpString(f['mark']) : idx > 0 ? String(idx) : '';
    return {
      location,
      idx,
      locationIdx: location + (idx << 8),
      mark: markRaw ? ` (${markRaw})` : '',
      npc: f['NPC'] !== undefined ? parseCSharpNumber(f['NPC']) : 0,
      delayType1: f['DelayType1'] !== undefined ? parseCSharpNumber(f['DelayType1']) : 1,
      delayType2: f['DelayType2'] !== undefined ? parseCSharpNumber(f['DelayType2']) : 1,
      delay1: f['Delay1'] !== undefined ? parseCSharpNumber(f['Delay1']) : 4,
      delay2: f['Delay2'] !== undefined ? parseCSharpNumber(f['Delay2']) : 90,
      slotType: parseCSharpNumber(f['SlotType'] ?? '0'),
      levelMin,
      levelMax,
      cry: location === 64,
      species: parseNewArrayNumbers(f['Species'] ?? '{}'),
    };
  });
}

function parseWildCategories(pkmwSrc: string, marker: 'Species_USUM =' | 'Species_SM =') {
  const pkmwBlock = findNamedBlock(pkmwSrc, marker);
  return splitTopLevelItems(pkmwBlock).map((catExpr) => {
    const f = parseObjectAssignments(extractBraceBlock(catExpr, catExpr.indexOf('{')).block);
    const text = parseCSharpString(f['Text']);
    const listExpr = f['List']!;
    const listBlock = extractBraceBlock(listExpr, listExpr.indexOf('{')).block;
    const list = splitTopLevelItems(listBlock).map((itemExpr) => {
      const itemF = parseObjectAssignments(extractBraceBlock(itemExpr, itemExpr.indexOf('{')).block);
      return {
        species: itemF['Species'] !== undefined ? parseCSharpNumber(itemF['Species']) : 0,
        level: itemF['Level'] !== undefined ? parseCSharpNumber(itemF['Level']) : 0,
        delay: itemF['Delay'] !== undefined ? parseCSharpNumber(itemF['Delay']) : 8,
        conceptual: parseBool(itemF['Conceptual'], false),
        rate: itemF['Rate'] !== undefined ? parseNewArrayNumbers(itemF['Rate']) : null,
        location: itemF['Location'] !== undefined ? parseNewArrayNumbers(itemF['Location']) : null,
        version: parseVersion(itemF['Version']),
      };
    });
    return { text, list };
  });
}

function extractWildUSUM() {
  const locSrc = stripLineComments(readRef('Gen7/Gen7Encounter/LocationTable7.cs'));
  const encSrc = stripLineComments(readRef('Gen7/Gen7Encounter/EncounterArea7.cs'));
  const fishSrc = stripLineComments(readRef('Gen7/Gen7Encounter/FishingArea7.cs'));
  const miscSrc = stripLineComments(readRef('Gen7/Gen7Encounter/MiscEncounter7.cs'));
  const pkmwSrc = stripLineComments(readRef('Gen7/PKMW7.cs'));
  const wildRngSrc = stripLineComments(readRef('Core/WildRNG.cs'));
  const pkmSrc = stripLineComments(readRef('Pokemon/Pokemon.cs'));

  const usumAreas = parseEncounterAreas(findNamedBlock(locSrc, 'USUMTable ='));
  const smAreas = parseEncounterAreas(findNamedBlock(locSrc, 'SMTable ='));
  const fishingAreas = parseFishingAreas(findNamedBlock(locSrc, 'Fishing_USUM ='));
  const fishingAreasSM = parseFishingAreas(findNamedBlock(locSrc, 'Fishing_SM ='));
  const miscAreas = parseMiscAreas(findNamedBlock(locSrc, 'Misc_USUM ='));
  const miscAreasSM = parseMiscAreas(findNamedBlock(locSrc, 'Misc_SM ='));

  // Crabrawler scripted levels come from SMTable max level in EncounterArea_Crabrawler!
  const smLevelsByLocation = new Map<number, number>();
  for (const area of smAreas) {
    if (area.isSeparator) continue;
    if (!smLevelsByLocation.has(area.location)) {
      smLevelsByLocation.set(area.location, area.levelMax);
    }
  }

  const crabrawlerSpots = parseIntList(findNamedBlock(locSrc, 'CrabrawlerSpots ='));
  const crabrawlerAreas = crabrawlerSpots.map((loc) => {
    const match = usumAreas.find((a) => a.location === loc);
    return {
      location: loc,
      idx: 0,
      locationIdx: loc,
      mark: '',
      npc: match?.npc ?? 7,
      levelMin: match?.levelMin ?? 29,
      scriptedLevel: smLevelsByLocation.get(loc) ?? 29,
      raining: match?.raining ?? false,
    };
  });
  const crabrawlerAreasSM = crabrawlerSpots.map((loc) => {
    const match = smAreas.find((a) => a.location === loc);
    return {
      location: loc,
      idx: 0,
      locationIdx: loc,
      mark: '',
      npc: match?.npc ?? 7,
      levelMin: match?.levelMin ?? 29,
      scriptedLevel: smLevelsByLocation.get(loc) ?? 29,
      raining: match?.raining ?? false,
    };
  });

  const wildCategories = parseWildCategories(pkmwSrc, 'Species_USUM =');
  const wildCategoriesSM = parseWildCategories(pkmwSrc, 'Species_SM =');

  // EncounterArea7.SlotType
  const slotTypeBlock = findNamedBlock(encSrc, 'SlotType =');
  const slotTypes = splitTopLevelItems(slotTypeBlock).map((arrExpr) => parseNewArrayNumbers(arrExpr));

  // WildRNG.SlotDistribution
  const slotDistBlock = findNamedBlock(wildRngSrc, 'SlotDistribution =');
  const slotDistributions = splitTopLevelItems(slotDistBlock).map((arrExpr) => parseNewArrayNumbers(arrExpr));

  // FishingItemSlots
  const fishingItemSlots = parseIntList(findNamedBlock(fishSrc, 'FishingItemSlots ='));

  // Maps
  const smAreaBlock = encSrc.slice(
    encSrc.indexOf('class EncounterArea_SM'),
    encSrc.indexOf('class EncounterArea_USUM'),
  );
  const day2NightSM = parseDict(smAreaBlock, 'Day2Night =>');
  const sun2MoonSM = parseDict(smAreaBlock, 'Sun2Moon =>');

  const usumAreaBlock = encSrc.slice(encSrc.indexOf('class EncounterArea_USUM'));
  const day2NightUSUM = parseDict(usumAreaBlock, 'Day2Night =>');
  const sun2MoonUSUM = parseDict(usumAreaBlock, 'Sun2Moon =>');

  const miscDay2Night = parseDict(miscSrc, 'Day2Night =>');
  const miscUltraDay2Night = parseDict(miscSrc, 'UltraDay2Night =>');
  const miscSun2Moon = parseDict(miscSrc, 'Sun2Moon =>');

  const alolanForms = parseIntList(findNamedBlock(pkmSrc, 'AlolanForms ='));
  const babyMons = parseIntList(findNamedBlock(pkmSrc, 'BabyMons ='));
  const alolanDexSM = parseIntList(findNamedBlock(pkmSrc, 'AlolanDex_SM ='));
  const alolanDexUSUM = parseIntList(findNamedBlock(pkmSrc, 'AlolanDex_USUM ='));
  const rustlingSpots = parseIntList(findNamedBlock(locSrc, 'RustlingSpots ='));
  const fishingNpcChangeSpots = parseIntList(findNamedBlock(locSrc, 'FishingNPCChangeSpots ='));

  return {
    usum: {
      wildCategories,
      usumAreas,
      fishingAreas,
      miscAreas,
      crabrawlerAreas,
      slotTypes,
      slotDistributions,
      fishingItemSlots,
      day2NightUSUM,
      sun2MoonUSUM,
      miscDay2Night,
      miscUltraDay2Night,
      miscSun2Moon,
      alolanForms,
      babyMons,
      alolanDexSM,
      alolanDexUSUM,
      rustlingSpots,
      fishingNpcChangeSpots,
    },
    sm: {
      wildCategories: wildCategoriesSM,
      smAreas,
      fishingAreas: fishingAreasSM,
      miscAreas: miscAreasSM,
      crabrawlerAreas: crabrawlerAreasSM,
      day2NightSM,
      sun2MoonSM,
    },
  };
}

function readTextLines(filename: string): string[] {
  const raw = fs.readFileSync(path.join(REF_DIR, 'Resources', 'text', filename), 'utf8');
  return raw.split('\n').map((l: string) => l.trim());
}

function extractTextEN() {
  const species = readTextLines('text_Species_en.txt');
  const abilities = readTextLines('text_Abilities_en.txt');
  const natures = readTextLines('text_Natures_en.txt');
  const types = readTextLines('text_Types_en.txt');
  const items = readTextLines('text_Items_en.txt');
  const genderRatios = readTextLines('text_Genderratio_en.txt');

  // Exact port of MainForm.cs lines 340-349 for smlocation merging
  const rawLoc = readTextLines('text_Location_sm_en.txt');
  const locations = [...rawLoc];
  for (let i = 0; i < rawLoc.length; i += 2) {
    const nextLoc = rawLoc[i + 1] ?? '';
    if (nextLoc.trim().length > 0 && nextLoc[0] !== '[') {
      locations[i] = `${locations[i]} (${nextLoc})`;
    }
    if (i > 0 && (locations[i] ?? '').trim().length > 0) {
      let dupCount = 0;
      for (let k = 0; k < i - 1; k++) {
        if (locations[k] === locations[i]) dupCount++;
      }
      if (dupCount > 0) {
        locations[i] = `${locations[i]} (${dupCount + 1})`;
      }
    }
  }

  return {
    species,
    abilities,
    natures,
    types,
    items,
    genderRatios,
    locations,
  };
}

function copyClockAssets() {
  fs.mkdirSync(PUBLIC_CLOCK_DIR, { recursive: true });
  for (let i = 0; i < 17; i++) {
    const name = `Clock_${String(i).padStart(2, '0')}.jpg`;
    fs.copyFileSync(path.join(REF_DIR, 'Resources', 'pic', name), path.join(PUBLIC_CLOCK_DIR, name));
  }
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const personal = extractPersonal('personal_uu');
  const personalORAS = extractPersonal('personal_ao');
  const stationaryGen6 = extractStationaryGen6();
  const stationaryUSUM = extractStationaryTable('Species_USUM =');
  const stationarySM = extractStationaryTable('Species_SM =');
  const wild = extractWildUSUM();
  const textEn = extractTextEN();
  copyClockAssets();

  fs.writeFileSync(path.join(OUT_DIR, 'personal_usum.json'), JSON.stringify(personal));
  fs.writeFileSync(path.join(OUT_DIR, 'personal_oras.json'), JSON.stringify(personalORAS));
  fs.writeFileSync(path.join(OUT_DIR, 'stationary_gen6.json'), JSON.stringify(stationaryGen6, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'stationary_usum.json'), JSON.stringify(stationaryUSUM, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'stationary_sm.json'), JSON.stringify(stationarySM, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'wild_usum.json'), JSON.stringify(wild.usum));
  fs.writeFileSync(path.join(OUT_DIR, 'wild_sm.json'), JSON.stringify(wild.sm));
  fs.writeFileSync(path.join(OUT_DIR, 'text_en.json'), JSON.stringify(textEn));

  console.log(
    `Extracted: personal=${personal.length}, stationaryUSUM=${stationaryUSUM.length}, stationarySM=${stationarySM.length}, usumAreas=${wild.usum.usumAreas.length}, smAreas=${wild.sm.smAreas.length}, fishingSM=${wild.sm.fishingAreas.length}, miscSM=${wild.sm.miscAreas.length}`,
  );
}

main();
