import type { ClockVisualStyle } from '../../store/AppContext';
import { ClockDialSvg } from './ClockDialSvg';

interface ClockPickerGridProps {
  clockStyle: ClockVisualStyle;
  onPick: (rawIndex: number) => void;
}

export function ClockPickerGrid({ clockStyle, onPick }: ClockPickerGridProps) {
  const handlePress = (idx: number) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    onPick(idx);
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      {Array.from({ length: 17 }, (_, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => handlePress(idx)}
          className={`flex flex-col items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 active:scale-95 active:bg-amber-500/15 active:border-amber-400 transition py-2 min-h-16 ${
            idx === 16 ? 'col-span-4 flex-row gap-3 min-h-14' : ''
          }`}
          aria-label={`Clock ${String(idx).padStart(2, '0')}`}
        >
          {clockStyle === 'sprite' ? (
            <img
              src={`${import.meta.env.BASE_URL}assets/clocks/Clock_${String(idx).padStart(2, '0')}.jpg`}
              alt={`Clock ${idx}`}
              className="w-10 h-10 rounded-full object-cover border border-zinc-700"
              loading="eager"
            />
          ) : (
            <ClockDialSvg index={idx} size={42} />
          )}
          <span className="font-mono text-xs font-bold tabular-nums text-zinc-300 mt-0.5">
            {String(idx).padStart(2, '0')}
          </span>
        </button>
      ))}
    </div>
  );
}
