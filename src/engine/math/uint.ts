/** Force JS number to unsigned 32-bit integer [0, 0xFFFFFFFF]. */
export function u32(n: number): number {
  return n >>> 0;
}

/** Exact C# uint * uint overflow multiplication. */
export function imul32(a: number, b: number): number {
  return Math.imul(a, b) >>> 0;
}

/** Exact C# uint + uint overflow addition. */
export function add32(a: number, b: number): number {
  return (a + b) >>> 0;
}

/**
 * Exact 64-bit unsigned modulo (hi * 2^32 + lo) % m without BigInt allocation.
 * Safe and exact for all moduli 1 <= m <= 2^20 (Gen 7 uses m <= 252).
 */
export function modU64(lo: number, hi: number, m: number): number {
  const two32Mod = 0x100000000 % m;
  return (((hi >>> 0) % m) * two32Mod + ((lo >>> 0) % m)) % m;
}

/** Reference BigInt 64-bit modulo for arbitrary m and verification tests. */
export function modU64BigInt(lo: number, hi: number, m: number): number {
  const val = (BigInt(hi >>> 0) << 32n) | BigInt(lo >>> 0);
  return Number(val % BigInt(m));
}

export function toHex32(n: number): string {
  return (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export function toHex64(lo: number, hi: number): string {
  return toHex32(hi) + toHex32(lo);
}

export function parseHex32(hex: string): number | null {
  const cleaned = hex.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{1,8}$/.test(cleaned)) {
    return null;
  }
  return Number.parseInt(cleaned, 16) >>> 0;
}

/**
 * Port of FuncUtil.SeedStr2Array:
 * Input format in 3DSRNGTool: "St3,St2,St1,St0" (comma-separated 32-bit hex strings).
 * Returns [St0, St1, St2, St3] matching TinyMT.status layout.
 */
export function parseEggSeedStr(seed: string): [number, number, number, number] | null {
  const parts = seed.split(',').map((p) => p.trim());
  if (parts.length !== 4) return null;
  const parsed = parts.map((p) => parseHex32(p));
  if (parsed.some((v) => v === null)) return null;
  return [parsed[3]!, parsed[2]!, parsed[1]!, parsed[0]!];
}

/** Format TinyMT status [s0, s1, s2, s3] as "S3,S2,S1,S0" matching PRNGState.ToString(). */
export function formatEggSeedStr(status: readonly [number, number, number, number]): string {
  return `${toHex32(status[3])},${toHex32(status[2])},${toHex32(status[1])},${toHex32(status[0])}`;
}
