export type ClockSeedMode = 'save' | 'id' | 'qr';

export const CLOCK_POSITIONS = 17;

export const CLOCK_REQUIRED_COUNT: Record<ClockSeedMode, number> = {
  save: 8,
  id: 9,
  qr: 2,
};

/**
 * Normalizes any integer clock index into [0, 16].
 */
export function normalizeClockIndex(idx: number): number {
  const n = ((Math.trunc(idx) % CLOCK_POSITIONS) + CLOCK_POSITIONS) % CLOCK_POSITIONS;
  return n === 0 ? 0 : n;
}

/**
 * Applies the Gen 7 Save-screen End-position offset correction once.
 * ID and QR modes always use Start-position readings without offset adjustment.
 */
export function adjustClockReading(
  rawIdx: number,
  mode: ClockSeedMode,
  isEndReading: boolean,
  offset: number,
): number {
  const normalizedRaw = normalizeClockIndex(rawIdx);
  if (mode === 'save' && isEndReading) {
    const normalizedOffset = normalizeClockIndex(offset);
    return normalizeClockIndex(normalizedRaw + (CLOCK_POSITIONS - normalizedOffset));
  }
  return normalizedRaw;
}

/**
 * Converts a sequence of raw clock readings [0..16] into adjusted readings once.
 */
export function adjustClockSequence(
  rawSequence: readonly number[],
  mode: ClockSeedMode,
  isEndReading: boolean,
  offset: number,
): number[] {
  return rawSequence.map((rawIdx) => adjustClockReading(rawIdx, mode, isEndReading, offset));
}

/**
 * Maps a pointer vector (dx, dy) relative to reticle center to the nearest clock position [0..16],
 * compensating for the reticle tilt angle in degrees (positive = clockwise).
 */
export function pointerToClockIndex(dx: number, dy: number, tiltDeg = 0): number {
  if (dx === 0 && dy === 0) return 0;
  const rawDeg = (Math.atan2(dx, dy === 0 ? 0 : -dy) * 180) / Math.PI - tiltDeg;
  const normDeg = ((rawDeg % 360) + 360) % 360;
  const idx = Math.round(normDeg / (360 / CLOCK_POSITIONS)) % CLOCK_POSITIONS;
  return idx === 0 ? 0 : idx;
}

export function stepClockIndex(current: number, delta: number): number {
  return normalizeClockIndex(current + delta);
}

export function clampZoom(zoom: number, min = 1, max = 4): number {
  if (!Number.isFinite(zoom)) return min;
  return Math.min(max, Math.max(min, zoom));
}

export function clampTilt(tiltDeg: number, limit = 15): number {
  if (!Number.isFinite(tiltDeg)) return 0;
  return Math.min(limit, Math.max(-limit, tiltDeg));
}

/**
 * Fixed-capacity circular buffer returning snapshots in chronological order (oldest -> newest).
 */
export class FrameRingBuffer<T> {
  private readonly capacity: number;
  private buffer: T[] = [];
  private writePos = 0;
  private full = false;

  constructor(capacity = 10) {
    this.capacity = Math.max(1, Math.trunc(capacity));
  }

  get length(): number {
    return this.full ? this.capacity : this.buffer.length;
  }

  push(item: T): void {
    if (!this.full) {
      this.buffer.push(item);
      if (this.buffer.length === this.capacity) {
        this.full = true;
        this.writePos = 0;
      }
      return;
    }
    this.buffer[this.writePos] = item;
    this.writePos = (this.writePos + 1) % this.capacity;
  }

  snapshot(): T[] {
    if (!this.full) {
      return this.buffer.slice();
    }
    return [
      ...this.buffer.slice(this.writePos),
      ...this.buffer.slice(0, this.writePos),
    ];
  }

  clear(): void {
    this.buffer = [];
    this.writePos = 0;
    this.full = false;
  }
}
