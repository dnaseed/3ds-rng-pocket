import type { GameVersionId } from '../engine/core/types';
import type { TinyState } from '../engine/rng/types';

export interface TrainerProfile {
  id: string;
  name: string;
  gameVersion: GameVersionId;
  tid: number; // 0..65535
  sid: number; // 0..65535
  tsv: number; // 0..4095
  trv: number; // 0..15
  shinyCharm: boolean;
  eggSeed: TinyState;
  otherTsvs: number[];
}

export interface ProfileStoreData {
  version: 1;
  activeProfileId: string;
  profiles: TrainerProfile[];
}

const STORAGE_KEY = 'usum_rng_profiles_v1';

export function computeTsvTrv(tid: number, sid: number): { tsv: number; trv: number; g7tid: number } {
  const t = tid & 0xffff;
  const s = sid & 0xffff;
  const xor = t ^ s;
  const full = (((s << 16) | t) >>> 0) % 1_000_000;
  return {
    tsv: (xor >>> 4) & 0xfff,
    trv: xor & 0xf,
    g7tid: full,
  };
}

/** Derive 16-bit TID/SID from a Gen 7 6-digit G7TID, TSV (0..4095), and TRV (0..15). */
export function solveTidSidFromG7Tid(
  g7tid: number,
  tsv: number,
  trv: number,
): { tid: number; sid: number } | null {
  const targetG7 = ((Math.trunc(g7tid) % 1_000_000) + 1_000_000) % 1_000_000;
  const xor = ((tsv & 0xfff) << 4) | (trv & 0xf);
  for (let sid = 0; sid <= 0xffff; sid++) {
    const tid = sid ^ xor;
    const full = (((sid << 16) | tid) >>> 0) % 1_000_000;
    if (full === targetG7) {
      return { tid, sid };
    }
  }
  return null;
}

export function createDefaultProfile(): TrainerProfile {
  return {
    id: 'default-us',
    name: 'Ultra Sun',
    gameVersion: 'US',
    tid: 0,
    sid: 0,
    tsv: 0,
    trv: 0,
    shinyCharm: false,
    eggSeed: [0, 0, 0, 0],
    otherTsvs: [],
  };
}

function sanitizeProfile(raw: unknown): TrainerProfile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const hasName = typeof obj.name === 'string' && obj.name.trim().length > 0;
  const hasVersion =
    obj.gameVersion === 'US' ||
    obj.gameVersion === 'UM' ||
    obj.gameVersion === 'S' ||
    obj.gameVersion === 'M';
  const hasTidOrTsv = typeof obj.tid === 'number' || typeof obj.tsv === 'number';
  if (!hasName && !hasVersion && !hasTidOrTsv) return null;
  const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id : `p-${Date.now()}`;
  const name = hasName ? (obj.name as string).trim() : 'Trainer';
  const gameVersion: GameVersionId = hasVersion ? (obj.gameVersion as GameVersionId) : 'US';
  const tid = clampInt(obj.tid, 0, 65535, 0);
  const sid = clampInt(obj.sid, 0, 65535, 0);
  const tsv = clampInt(obj.tsv, 0, 4095, ((tid ^ sid) >>> 4) & 0xfff);
  const trv = clampInt(obj.trv, 0, 15, (tid ^ sid) & 0xf);
  const shinyCharm = Boolean(obj.shinyCharm);

  let eggSeed: TinyState = [0, 0, 0, 0];
  if (Array.isArray(obj.eggSeed) && obj.eggSeed.length === 4) {
    eggSeed = [
      (Number(obj.eggSeed[0]) || 0) >>> 0,
      (Number(obj.eggSeed[1]) || 0) >>> 0,
      (Number(obj.eggSeed[2]) || 0) >>> 0,
      (Number(obj.eggSeed[3]) || 0) >>> 0,
    ];
  }

  const otherTsvs = Array.isArray(obj.otherTsvs)
    ? obj.otherTsvs
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v >= 0 && v < 4096)
    : [];

  return {
    id,
    name,
    gameVersion,
    tid,
    sid,
    tsv,
    trv,
    shinyCharm,
    eggSeed,
    otherTsvs,
  };
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  const truncated = Math.trunc(n);
  if (truncated < min || truncated > max) return fallback;
  return truncated;
}

export function loadProfileStore(): ProfileStoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && Array.isArray(parsed.profiles)) {
        const profiles = parsed.profiles
          .map(sanitizeProfile)
          .filter((p): p is TrainerProfile => p !== null);
        if (profiles.length > 0) {
          const activeId =
            typeof parsed.activeProfileId === 'string' &&
            profiles.some((p) => p.id === parsed.activeProfileId)
              ? parsed.activeProfileId
              : profiles[0]!.id;
          return { version: 1, activeProfileId: activeId, profiles };
        }
      }
    }
  } catch {
    // fallback to default
  }
  const def = createDefaultProfile();
  return { version: 1, activeProfileId: def.id, profiles: [def] };
}

export function saveProfileStore(store: ProfileStoreData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage quota errors
  }
}

export function exportProfilesJson(store: ProfileStoreData): string {
  return JSON.stringify(store, null, 2);
}

export function importProfilesJson(jsonStr: string): ProfileStoreData {
  const parsed = JSON.parse(jsonStr) as unknown;
  let candidateList: unknown[] = [];
  let requestedActive = '';

  if (Array.isArray(parsed)) {
    candidateList = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.profiles)) {
      candidateList = obj.profiles;
      if (typeof obj.activeProfileId === 'string') {
        requestedActive = obj.activeProfileId;
      }
    } else {
      const single = sanitizeProfile(parsed);
      if (single) candidateList = [single];
    }
  }

  const profiles = candidateList
    .map(sanitizeProfile)
    .filter((p): p is TrainerProfile => p !== null);

  if (profiles.length === 0) {
    throw new Error('No valid profiles found in JSON.');
  }

  const activeProfileId = profiles.some((p) => p.id === requestedActive)
    ? requestedActive
    : profiles[0]!.id;

  return { version: 1, activeProfileId, profiles };
}
