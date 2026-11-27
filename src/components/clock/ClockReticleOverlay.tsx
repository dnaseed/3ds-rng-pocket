import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { CLOCK_POSITIONS, pointerToClockIndex } from '../../engine/gen7/clockHelper';

interface ClockReticleOverlayProps {
  selectedIndex: number;
  tiltDeg: number;
  interactive: boolean;
  onSelectIndex: (idx: number) => void;
  offsetX?: number;
  offsetY?: number;
  centerMode?: boolean;
  onMoveCenter?: (x: number, y: number) => void;
}

const CENTER = 100;
const OUTER_R = 82;
const TICK_OUTER = 80;
const TICK_INNER = 69;
const MAX_OFFSET = 45;

/**
 * High-contrast 17-position clock reticle overlay aligned with Gen 7 clock geometry.
 */
export function ClockReticleOverlay({
  selectedIndex,
  tiltDeg,
  interactive,
  onSelectIndex,
  offsetX = 0,
  offsetY = 0,
  centerMode = false,
  onMoveCenter,
}: ClockReticleOverlayProps) {
  const activePointerId = useRef<number | null>(null);
  const dragOriginRef = useRef<{
    svgX: number;
    svgY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  const pickFromEvent = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * 200;
    const svgY = ((e.clientY - rect.top) / rect.height) * 200;

    const dx = svgX - (CENTER + offsetX);
    const dy = svgY - (CENTER + offsetY);
    const next = pointerToClockIndex(dx, dy, tiltDeg);
    if (next !== selectedIndex) {
      onSelectIndex(next);
    }
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    activePointerId.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors on synthetic events
    }
    if (centerMode && onMoveCenter) {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const svgX = ((e.clientX - rect.left) / rect.width) * 200;
        const svgY = ((e.clientY - rect.top) / rect.height) * 200;
        dragOriginRef.current = { svgX, svgY, baseX: offsetX, baseY: offsetY };
      }
      return;
    }
    pickFromEvent(e);
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    if (activePointerId.current !== e.pointerId && e.buttons !== 1) return;
    if (centerMode && onMoveCenter && dragOriginRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const svgX = ((e.clientX - rect.left) / rect.width) * 200;
        const svgY = ((e.clientY - rect.top) / rect.height) * 200;
        const nx = Math.max(
          -MAX_OFFSET,
          Math.min(MAX_OFFSET, dragOriginRef.current.baseX + (svgX - dragOriginRef.current.svgX)),
        );
        const ny = Math.max(
          -MAX_OFFSET,
          Math.min(MAX_OFFSET, dragOriginRef.current.baseY + (svgY - dragOriginRef.current.svgY)),
        );
        onMoveCenter(nx, ny);
      }
      return;
    }
    pickFromEvent(e);
  };

  const handlePointerEnd = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (activePointerId.current === e.pointerId) {
      activePointerId.current = null;
      dragOriginRef.current = null;
    }
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore release errors
      }
    }
  };

  const shortAngle = (selectedIndex * 360) / CLOCK_POSITIONS;
  const longAngle = (selectedIndex * 720) / CLOCK_POSITIONS;
  const selectedAngle = shortAngle;

  return (
    <svg
      viewBox="0 0 200 200"
      className={
        interactive
          ? centerMode
            ? 'absolute inset-0 h-full w-full touch-none select-none cursor-move'
            : 'absolute inset-0 h-full w-full touch-none select-none cursor-crosshair'
          : 'absolute inset-0 h-full w-full pointer-events-none select-none'
      }
      aria-hidden={!interactive}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <g transform={`translate(${offsetX} ${offsetY}) rotate(${tiltDeg} ${CENTER} ${CENTER})`}>
        {/* Outer double ring for contrast on both bright and dark 2DS screens */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_R}
          fill="none"
          stroke="rgba(0,0,0,0.65)"
          strokeWidth="4.5"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_R}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.6"
        />

        {/* Subtle inner reference ring */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={48}
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* 17 radial ticks */}
        {Array.from({ length: CLOCK_POSITIONS }, (_, k) => {
          const angle = (k * 360) / CLOCK_POSITIONS;
          const isZero = k === 0;
          const isSelected = interactive && k === selectedIndex;
          return (
            <g key={k} transform={`rotate(${angle} ${CENTER} ${CENTER})`}>
              <line
                x1={CENTER}
                y1={CENTER - TICK_OUTER}
                x2={CENTER}
                y2={CENTER - (isZero ? TICK_INNER - 4 : TICK_INNER)}
                stroke="rgba(0,0,0,0.75)"
                strokeWidth={isZero || isSelected ? 4.4 : 2.8}
                strokeLinecap="round"
              />
              <line
                x1={CENTER}
                y1={CENTER - TICK_OUTER}
                x2={CENTER}
                y2={CENTER - (isZero ? TICK_INNER - 4 : TICK_INNER)}
                stroke={isZero ? '#f59e0b' : isSelected ? '#fef08a' : 'rgba(255,255,255,0.85)'}
                strokeWidth={isZero || isSelected ? 2.4 : 1.3}
                strokeLinecap="round"
              />
              {isZero && (
                <text
                  x={CENTER}
                  y={CENTER - OUTER_R - 6}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fill="#fbbf24"
                  stroke="rgba(0,0,0,0.85)"
                  strokeWidth="2.4"
                  paintOrder="stroke"
                >
                  00
                </text>
              )}
              {isSelected && (
                <circle
                  cx={CENTER}
                  cy={CENTER - OUTER_R}
                  r="4.2"
                  fill="#fef08a"
                  stroke="rgba(0,0,0,0.85)"
                  strokeWidth="1.6"
                />
              )}
            </g>
          );
        })}

        {/* Synchronized short (1x) + long (2x) hands when frozen/interactive */}
        {interactive ? (
          <>
            {/* Long hand (2x step) */}
            <g transform={`rotate(${longAngle} ${CENTER} ${CENTER})`}>
              <line
                x1={CENTER}
                y1={CENTER}
                x2={CENTER}
                y2={CENTER - 64}
                stroke="rgba(0,0,0,0.7)"
                strokeWidth="5.2"
                strokeLinecap="round"
              />
              <line
                x1={CENTER}
                y1={CENTER}
                x2={CENTER}
                y2={CENTER - 64}
                stroke="rgba(254,240,138,0.9)"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            </g>

            {/* Short hand (1x step) */}
            <g transform={`rotate(${shortAngle} ${CENTER} ${CENTER})`}>
              <line
                x1={CENTER}
                y1={CENTER}
                x2={CENTER}
                y2={CENTER - 42}
                stroke="rgba(0,0,0,0.75)"
                strokeWidth="6.2"
                strokeLinecap="round"
              />
              <line
                x1={CENTER}
                y1={CENTER}
                x2={CENTER}
                y2={CENTER - 42}
                stroke="#f59e0b"
                strokeWidth="3.6"
                strokeLinecap="round"
              />
            </g>

            <circle
              cx={CENTER}
              cy={CENTER}
              r={centerMode ? '3.2' : '2.6'}
              fill="none"
              stroke="rgba(0,0,0,0.85)"
              strokeWidth="2.4"
            />
            <circle
              cx={CENTER}
              cy={CENTER}
              r={centerMode ? '3.2' : '2.6'}
              fill="none"
              stroke={centerMode ? '#38bdf8' : '#fef3c7'}
              strokeWidth="1.2"
            />
            {centerMode && (
              <g stroke="#38bdf8" strokeWidth="1.4" strokeLinecap="round">
                <line x1={CENTER - 13} y1={CENTER} x2={CENTER - 7} y2={CENTER} />
                <line x1={CENTER + 7} y1={CENTER} x2={CENTER + 13} y2={CENTER} />
                <line x1={CENTER} y1={CENTER - 13} x2={CENTER} y2={CENTER - 7} />
                <line x1={CENTER} y1={CENTER + 7} x2={CENTER} y2={CENTER + 13} />
              </g>
            )}
          </>
        ) : (
          /* Live center crosshair dot */
          <g>
            <circle
              cx={CENTER}
              cy={CENTER}
              r="3.2"
              fill="none"
              stroke="rgba(0,0,0,0.75)"
              strokeWidth="2.5"
            />
            <circle
              cx={CENTER}
              cy={CENTER}
              r="3.2"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1.3"
            />
          </g>
        )}

        {/* Selected angle indicator ring marker in interactive mode */}
        {interactive && (
          <g transform={`rotate(${selectedAngle} ${CENTER} ${CENTER})`}>
            <circle
              cx={CENTER}
              cy={CENTER - OUTER_R - 8}
              r="2.2"
              fill="#f59e0b"
              stroke="rgba(0,0,0,0.75)"
              strokeWidth="1"
            />
          </g>
        )}
      </g>
    </svg>
  );
}
