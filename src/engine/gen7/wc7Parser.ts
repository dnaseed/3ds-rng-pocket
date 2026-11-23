export interface ParsedWc7 {
  species: number;
  forme: number;
  level: number;
  abilityLocked: boolean;
  ability: number;
  natureLocked: boolean;
  nature: number;
  genderLocked: boolean;
  gender: number;
  ivsCount: number;
  ivs: [number, number, number, number, number, number]; // -1 = random, 0..31 = locked
  tid: number;
  sid: number;
  pidType: 0 | 1 | 2 | 3; // 0=Random, 1=NonShiny, 2=Shiny, 3=Specified
  pid: number;
  ec: number;
  isEgg: boolean;
  yourId: boolean;
  otherInfo: boolean;
}

const PID_TYPE_ORDER: readonly (0 | 1 | 2 | 3)[] = [3, 0, 2, 1];
const REORDER2 = [0, 1, 2, 4, 5, 3] as const;

/**
 * Exact TypeScript port of MainForm_Event.cs ReadWc + Event_RawData.
 * Supports raw .wc7 (264 bytes / 0x108) and .wc7full (784 bytes / 0x310).
 */
export function parseWc7File(raw: Uint8Array): ParsedWc7 | null {
  let data: Uint8Array;
  if (raw.byteLength === 0x310) {
    data = raw.subarray(0x208, 0x310);
  } else if (raw.byteLength === 0x108) {
    data = raw;
  } else {
    return null;
  }

  if (data[0x51] !== 0) {
    return null; // Must be a Pokemon gift card
  }

  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const species = dv.getUint16(0x82, true);
  if (species <= 0 || species > 807) {
    return null;
  }
  const forme = data[0x84] ?? 0;

  const abRaw = data[0xa2] ?? 0;
  const abilityLocked = abRaw < 3;
  const ability = abilityLocked ? abRaw + 1 : Math.min(1, Math.max(0, abRaw - 3));

  const natRaw = data[0xa0] ?? 0xff;
  const natureLocked = natRaw !== 0xff && natRaw < 25;
  const nature = natureLocked ? natRaw : 0;

  const genRaw = data[0xa1] ?? 3;
  const genderLocked = genRaw !== 3;
  const gender = genderLocked ? (genRaw + 1) % 3 : 0;

  const rawIvs = REORDER2.map((idx) => data[0xaf + idx] ?? 0);
  const ivFlag = rawIvs.find((iv) => ((iv - 0xfc) & 0xff) < 3) ?? 0;
  const ivsCount = ivFlag === 0 ? 0 : ivFlag - 0xfb;
  const ivs: [number, number, number, number, number, number] = [-1, -1, -1, -1, -1, -1];
  for (let i = 0; i < 6; i++) {
    const v = rawIvs[i]!;
    if (ivFlag === 0 && v <= 0x1f) {
      ivs[i] = v;
    }
  }

  const tid = dv.getUint16(0x68, true);
  const sid = dv.getUint16(0x6a, true);
  const pidType = PID_TYPE_ORDER[data[0xa3]!] ?? 1;
  const pid = pidType === 3 ? dv.getUint32(0xd4, true) : 0;
  const ec = dv.getUint32(0x70, true);
  const isEgg = data[0xd1] === 1;
  const yourId = data[0xb5] === 3;
  const level = data[0xd0] ?? 0;

  return {
    species,
    forme,
    level,
    abilityLocked,
    ability,
    natureLocked,
    nature,
    genderLocked,
    gender,
    ivsCount,
    ivs,
    tid,
    sid,
    pidType,
    pid,
    ec,
    isEgg,
    yourId,
    otherInfo: true,
  };
}
