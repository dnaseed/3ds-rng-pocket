import { MAX_FRAME } from '../engine/core/pokemonMath';

export type OverlayFields = Partial<
  Record<'seed' | 'frame' | 'egg0' | 'egg1' | 'egg2' | 'egg3', string>
>;

export interface ParsedOverlayResult {
  fields: OverlayFields;
  state1?: string;
  state0?: string;
}

function normalizeHex(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[O@]/g, '0')
    .replace(/[IL|]/g, '1')
    .replace(/S/g, '5');
}

export function parseOverlayWithStates(text: string): ParsedOverlayResult {
  const fields: OverlayFields = {};
  const token = '[0-9A-FOISl|]';

  function find(label: string, pattern: string): string | undefined {
    const match = new RegExp(
      '\\b' + label + '[\\s:=;!?}]*(' + pattern + ')(?![\\w|])',
      'im',
    ).exec(text);
    if (pattern.startsWith('[0-9O') && match && !/\d/.test(match[1]!)) {
      return undefined;
    }
    return match?.[1] ? normalizeHex(match[1]) : undefined;
  }

  const seed = find(
    '(?<!Egg[ \\t])(?:(?:Init(?:ial)?[ \\t]+)?Seed)',
    token + '{8}',
  );
  if (seed && /^[0-9A-F]{8}$/.test(seed)) {
    fields.seed = seed;
  } else if (/\bNPC\s+count|\bTR[VUY]\s*:/i.test(text)) {
    const split =
      /^\s*([0-9A-F]{4})[ \t]+([0-9A-F]{4})\s*\n\s*State[\[({t][1ilI]/im.exec(text);
    if (split) fields.seed = split[1]! + split[2]!;
  }

  for (const index of [0, 1, 2, 3] as const) {
    const word = find(
      'Egg[ \\t]*[\\[(]?[ \\t]*' + index + '[ \\t]*[\\])]?',
      token + '{8}',
    );
    if (word && /^[0-9A-F]{8}$/.test(word)) fields[`egg${index}`] = word;
  }

  const block =
    /\bPar(?:ent)?\s*[2e]\b[^\n]*\n([\s\S]*?)\b(?:Shiny\s+Charm|Masuda)/i.exec(
      text,
    )?.[1];
  if (block) {
    const noisyRows = [
      ...block.matchAll(
        /^\s*E[gs][gsao][ft(\[]?[\d@Il][\dIi)\]>:;]{0,3}[:;]?\s*\n\s*(\S+)/gim,
      ),
    ];
    if (noisyRows.length === 4) {
      const order = ['egg3', 'egg2', 'egg1', 'egg0'] as const;
      noisyRows.forEach((row, i) => {
        const value = normalizeHex(row[1]!);
        if (/^[0-9A-F]{8}$/.test(value)) fields[order[i]!] ??= value;
      });
    }
    const words = Array.from(
      block.matchAll(/(?<![\w|])([\da-fOISl|]{8})(?![\w|])/gi),
      (m) => normalizeHex(m[1]!),
    );
    const keys = ['egg3', 'egg2', 'egg1', 'egg0'] as const;
    if (
      words.length === 4 &&
      words.every((w) => /^[0-9A-F]{8}$/.test(w)) &&
      keys.every((k, i) => !fields[k] || fields[k] === words[i])
    ) {
      keys.forEach((k, i) => {
        fields[k] = words[i];
      });
    }
  }

  const frameVal = find(
    '(?:Advances|(?:Curr(?:ent)?|MT)\\s+Frame)',
    '[0-9OISl|]{1,10}',
  );
  if (frameVal !== undefined && /^\d+$/.test(frameVal) && Number(frameVal) <= MAX_FRAME) {
    fields.frame = frameVal;
  }

  const s1Match =
    /\bStat[eot]\s*[\[({tfl|]?\s*[1ilI]\s*[\]})li>]?[:;\s=!?]*([0-9A-FOISl|@]{3,5}[ \t]*[0-9A-FOISl|@]{3,5})(?![\w|])/im.exec(
      text,
    );
  const s1Clean = s1Match?.[1] ? normalizeHex(s1Match[1].replace(/\s+/g, '')) : undefined;
  const state1 = s1Clean && /^[0-9A-F]{8}$/.test(s1Clean) ? s1Clean : undefined;

  const s0Match =
    /\bStat[eot]\s*[\[({tfl|]?\s*[0O@]\s*[\]})li>]?[:;\s=!?]*([0-9A-FOISl|@]{3,5}[ \t]*[0-9A-FOISl|@]{3,5})(?![\w|])/im.exec(
      text,
    );
  const s0Clean = s0Match?.[1] ? normalizeHex(s0Match[1].replace(/\s+/g, '')) : undefined;
  const state0 = s0Clean && /^[0-9A-F]{8}$/.test(s0Clean) ? s0Clean : undefined;

  return { fields, state1, state0 };
}

export function parseOverlay(text: string): OverlayFields {
  return parseOverlayWithStates(text).fields;
}

export type OverlayFields6 = Partial<
  Record<'seed' | 'frame' | 'tiny3' | 'tiny2' | 'tiny1' | 'tiny0' | 'egg1' | 'egg0', string>
>;

export interface ParsedOverlay6Result {
  fields: OverlayFields6;
  currState?: string;
  tinyU32?: string;
  tinyAdvances?: string;
  tinySeed?: [string, string, string, string];
}

function parseTinyBlock(
  text: string,
  headerRe: RegExp,
): [string, string, string, string] | undefined {
  const m = headerRe.exec(text);
  if (!m?.[1]) return undefined;
  const block = m[1];
  const hex = '[0-9A-FOISl|@]{8}';
  const words: Record<number, string> = {};
  for (const idx of [3, 2, 1, 0] as const) {
    const match = new RegExp(`\\[${idx}\\]\\s*(${hex})(?![\\w|])`, 'im').exec(block);
    if (match?.[1]) {
      const norm = normalizeHex(match[1]);
      if (/^[0-9A-F]{8}$/.test(norm)) words[idx] = norm;
    }
  }
  if (words[3] && words[2] && words[1] && words[0]) {
    return [words[3], words[2], words[1], words[0]];
  }
  return undefined;
}

export function parseOverlay6WithStates(text: string): ParsedOverlay6Result {
  const fields: OverlayFields6 = {};
  const token = '[0-9A-FOISl|@]';

  function find(pattern: string, valPattern: string): string | undefined {
    const match = new RegExp(
      `\\b${pattern}[\\s:=;!?}]*(${valPattern})(?![\\w|])`,
      'im',
    ).exec(text);
    return match?.[1] ? normalizeHex(match[1]) : undefined;
  }

  const seed = find('Init(?:ial)?\\s+seed', `${token}{8}`);
  if (seed && /^[0-9A-F]{8}$/.test(seed)) fields.seed = seed;

  const currRaw = find('Curr(?:ent)?\\s+state', `${token}{8}`);
  const currState = currRaw && /^[0-9A-F]{8}$/.test(currRaw) ? currRaw : undefined;

  const frameRaw = find('MT\\s+Advances', '[0-9OISl|]{1,10}');
  if (frameRaw && /^\d+$/.test(frameRaw) && Number(frameRaw) <= MAX_FRAME) {
    fields.frame = frameRaw;
  }

  const tinyU32Raw = find('Tiny\\s+u32\\s+seed', `${token}{8}`);
  const tinyU32 = tinyU32Raw && /^[0-9A-F]{8}$/.test(tinyU32Raw) ? tinyU32Raw : undefined;

  const tinyAdvMatch = /(?:^|\n)\s*Advances[\s:=;!?]*([0-9OISl|]{1,6})(?![\w|])/im.exec(text);
  const tinyAdvClean = tinyAdvMatch?.[1] ? normalizeHex(tinyAdvMatch[1]) : undefined;
  const tinyAdvances = tinyAdvClean && /^\d+$/.test(tinyAdvClean) ? tinyAdvClean : undefined;

  const tinySeed = parseTinyBlock(
    text,
    /TinyMT\s+seed[:;\s]*\n([\s\S]{1,180}?)(?:\n\s*TinyMT\s+state|\n\s*Save\s+var|$)/i,
  );
  const tinyState = parseTinyBlock(
    text,
    /TinyMT\s+state[:;\s]*\n([\s\S]{1,180}?)(?:\n\s*Save\s+var|$)/i,
  );
  if (tinyState) {
    fields.tiny3 = tinyState[0];
    fields.tiny2 = tinyState[1];
    fields.tiny1 = tinyState[2];
    fields.tiny0 = tinyState[3];
  }

  const isMenu = />\s*Daycare/i.test(text) || /Ver\s+0\./i.test(text);
  const hasGen7Egg = /Egg\s*[\[(]?\s*[23]/i.test(text);
  if (!isMenu && !hasGen7Egg) {
    const e1 = find('Egg\\s*[\\[(]?\\s*1\\s*[\\])]?', `${token}{8}`);
    const e0 = find('Egg\\s*[\\[(]?\\s*0\\s*[\\])]?', `${token}{8}`);
    if (e1 && /^[0-9A-F]{8}$/.test(e1)) fields.egg1 = e1;
    if (e0 && /^[0-9A-F]{8}$/.test(e0)) fields.egg0 = e0;
  }

  return { fields, currState, tinyU32, tinyAdvances, tinySeed };
}
