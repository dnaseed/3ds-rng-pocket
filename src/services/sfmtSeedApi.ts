export const DEFAULT_SEED_API_BASE = 'https://rng-api.odanado.com';

export interface SeedApiResult {
  add: number;
  seed: string;
  encoded_needle: string;
  step: number;
}

export class SeedApiError extends Error {
  public readonly code: 'OFFLINE' | 'TIMEOUT' | 'NETWORK_OR_CORS' | 'HTTP_ERROR';

  constructor(
    code: 'OFFLINE' | 'TIMEOUT' | 'NETWORK_OR_CORS' | 'HTTP_ERROR',
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

/**
 * Queries rng-api.odanado.com (or a user-configured proxy endpoint) for SFMT initial seed
 * from Gen 7 clock readings.
 */
export async function fetchInitialSeed(params: {
  needle: string;
  isId: boolean;
  isUltra?: boolean;
  baseUrl?: string;
  timeoutMs?: number;
}): Promise<SeedApiResult[]> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new SeedApiError('OFFLINE', 'Device is offline.');
  }

  const base = (params.baseUrl || DEFAULT_SEED_API_BASE).replace(/\/+$/, '');
  const gamePath = params.isUltra === false ? '/sm' : '/usm';
  const idPath = params.isId ? '/id' : '';
  const url = `${base}${gamePath}/sfmt/seed${idPath}?needle=${encodeURIComponent(params.needle)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new SeedApiError('HTTP_ERROR', `API returned HTTP ${res.status}`);
    }
    const data = (await res.json()) as { results?: SeedApiResult[] };
    return Array.isArray(data.results) ? data.results : [];
  } catch (err) {
    if (err instanceof SeedApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new SeedApiError('TIMEOUT', 'Seed API request timed out.');
    }
    throw new SeedApiError(
      'NETWORK_OR_CORS',
      err instanceof Error ? err.message : 'Network or CORS error calling Seed API.',
    );
  } finally {
    clearTimeout(timer);
  }
}
