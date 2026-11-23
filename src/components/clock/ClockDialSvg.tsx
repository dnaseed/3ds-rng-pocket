interface ClockDialSvgProps {
  index: number; // 0..16
  size?: number;
  className?: string;
}

/**
 * Crisp vector clock face matching Gen 7's 17 clock frames (Clock_00..16).
 * Short hand rotates index * (360/17) deg, long hand rotates index * (720/17) deg.
 */
export function ClockDialSvg({ index, size = 44, className = '' }: ClockDialSvgProps) {
  const shortAngle = (index * 360) / 17;
  const longAngle = (index * 720) / 17;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
    >
      {/* Outer glowing dial */}
      <circle cx="24" cy="24" r="21" fill="#18181b" stroke="#fde68a" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="18" fill="#27272a" stroke="#52525b" strokeWidth="0.8" />

      {/* 17 subtle tick marks */}
      {Array.from({ length: 17 }, (_, k) => {
        const a = (k * 360) / 17;
        return (
          <line
            key={k}
            x1="24"
            y1="5.5"
            x2="24"
            y2={k === 0 ? '8.5' : '7.2'}
            stroke={k === 0 ? '#f59e0b' : '#71717a'}
            strokeWidth={k === 0 ? '1.6' : '0.9'}
            strokeLinecap="round"
            transform={`rotate(${a} 24 24)`}
          />
        );
      })}

      {/* Long hand (2x step) */}
      <line
        x1="24"
        y1="24"
        x2="24"
        y2="8.5"
        stroke="#fef08a"
        strokeWidth="2.6"
        strokeLinecap="round"
        transform={`rotate(${longAngle} 24 24)`}
      />

      {/* Short hand (1x step) */}
      <line
        x1="24"
        y1="24"
        x2="24"
        y2="12.5"
        stroke="#f59e0b"
        strokeWidth="3.2"
        strokeLinecap="round"
        transform={`rotate(${shortAngle} 24 24)`}
      />

      <circle cx="24" cy="24" r="2.6" fill="#fef3c7" />
    </svg>
  );
}
