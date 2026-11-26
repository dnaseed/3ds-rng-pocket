import { describe, expect, it } from 'vitest';
import {
  CLOCK_POSITIONS,
  CLOCK_REQUIRED_COUNT,
  FrameRingBuffer,
  adjustClockReading,
  adjustClockSequence,
  clampTilt,
  clampZoom,
  normalizeClockIndex,
  pointerToClockIndex,
  stepClockIndex,
} from '../src/engine/gen7/clockHelper';

describe('clockHelper', () => {
  it('defines required counts per mode', () => {
    expect(CLOCK_REQUIRED_COUNT).toEqual({ save: 8, id: 9, qr: 2 });
  });

  it('normalizes positive, negative, and out-of-range indices', () => {
    for (let i = 0; i < CLOCK_POSITIONS; i++) {
      expect(normalizeClockIndex(i)).toBe(i);
      expect(normalizeClockIndex(i + 17)).toBe(i);
      expect(normalizeClockIndex(i - 17)).toBe(i);
    }
    expect(normalizeClockIndex(-1)).toBe(16);
    expect(normalizeClockIndex(17)).toBe(0);
  });

  it('applies Save End correction for all 17 ticks with offset 4, 0, and 16', () => {
    for (let raw = 0; raw < CLOCK_POSITIONS; raw++) {
      expect(adjustClockReading(raw, 'save', true, 4)).toBe((raw + 13) % 17);
      expect(adjustClockReading(raw, 'save', true, 0)).toBe(raw);
      expect(adjustClockReading(raw, 'save', true, 16)).toBe((raw + 1) % 17);
    }
  });

  it('uses Start position (no offset) for Save Start, ID, and QR even if isEndReading is true', () => {
    for (let raw = 0; raw < CLOCK_POSITIONS; raw++) {
      expect(adjustClockReading(raw, 'save', false, 4)).toBe(raw);
      expect(adjustClockReading(raw, 'id', true, 4)).toBe(raw);
      expect(adjustClockReading(raw, 'qr', true, 4)).toBe(raw);
    }
  });

  it('adjusts an entire sequence once and preserves consecutive duplicate readings', () => {
    const raw = [7, 7, 0, 0, 16, 16, 3, 3];
    const saveEnd = adjustClockSequence(raw, 'save', true, 4);
    expect(saveEnd).toEqual([3, 3, 13, 13, 12, 12, 16, 16]);
    expect(adjustClockSequence(raw, 'id', true, 4)).toEqual(raw);
    expect(adjustClockSequence(raw, 'qr', true, 4)).toEqual(raw);
  });

  it('maps all 17 exact radial angles to their clock index', () => {
    for (let k = 0; k < CLOCK_POSITIONS; k++) {
      const rad = ((k * 360) / CLOCK_POSITIONS) * (Math.PI / 180);
      const dx = Math.sin(rad) * 80;
      const dy = -Math.cos(rad) * 80;
      expect(pointerToClockIndex(dx, dy, 0)).toBe(k);
    }
  });

  it('handles wrap-around near 00/16 and compensates reticle tilt', () => {
    expect(pointerToClockIndex(0, 0, 0)).toBe(0);
    // Slightly counter-clockwise from 12 o'clock -> 16
    expect(pointerToClockIndex(-15, -80, 0)).toBe(16);
    // Slightly clockwise from 12 o'clock -> 0
    expect(pointerToClockIndex(2, -80, 0)).toBe(0);

    // With +12 deg clockwise reticle tilt, tick 00 sits at +12 deg
    const rad12 = (12 * Math.PI) / 180;
    expect(pointerToClockIndex(Math.sin(rad12) * 80, -Math.cos(rad12) * 80, 12)).toBe(0);

    // With -15 deg counter-clockwise reticle tilt, tick 05 sits at (5*360/17 - 15) deg
    const degTick5 = (5 * 360) / 17 - 15;
    const radTick5 = (degTick5 * Math.PI) / 180;
    expect(pointerToClockIndex(Math.sin(radTick5) * 80, -Math.cos(radTick5) * 80, -15)).toBe(5);
  });

  it('steps clock index and clamps zoom and tilt safely', () => {
    expect(stepClockIndex(0, -1)).toBe(16);
    expect(stepClockIndex(16, 1)).toBe(0);
    expect(stepClockIndex(5, 2)).toBe(7);

    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(2.5)).toBe(2.5);
    expect(clampZoom(9)).toBe(4);
    expect(clampZoom(Number.NaN)).toBe(1);

    expect(clampTilt(-30)).toBe(-15);
    expect(clampTilt(7)).toBe(7);
    expect(clampTilt(22)).toBe(15);
    expect(clampTilt(Number.NaN)).toBe(0);
  });

  it('maintains chronological order and overwrites oldest items in FrameRingBuffer', () => {
    const rb = new FrameRingBuffer<string>(3);
    expect(rb.length).toBe(0);
    expect(rb.snapshot()).toEqual([]);

    rb.push('f1');
    rb.push('f2');
    expect(rb.length).toBe(2);
    expect(rb.snapshot()).toEqual(['f1', 'f2']);

    rb.push('f3');
    rb.push('f4');
    rb.push('f5');
    expect(rb.length).toBe(3);
    expect(rb.snapshot()).toEqual(['f3', 'f4', 'f5']);

    rb.clear();
    expect(rb.length).toBe(0);
    expect(rb.snapshot()).toEqual([]);
  });
});
