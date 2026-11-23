import { Delete, Trash2 } from 'lucide-react';
import { useApp } from '../../store/AppContext';

interface ClockSequenceBarProps {
  sequence: number[];
  requiredCount: number;
  onUndo: () => void;
  onClear: () => void;
}

export function ClockSequenceBar({
  sequence,
  requiredCount,
  onUndo,
  onClear,
}: ClockSequenceBarProps) {
  const { i18n } = useApp();

  return (
    <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-300">{i18n.t('seed.sequence')}</span>
          <span
            className={`px-2 py-0.5 rounded-full font-mono text-xs font-bold tabular-nums ${
              sequence.length >= requiredCount
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {sequence.length}/{requiredCount}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={sequence.length === 0}
            onClick={onUndo}
            className="h-9 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 disabled:opacity-40 active:scale-95 transition"
          >
            <Delete className="w-3.5 h-3.5" />
            <span>{i18n.t('seed.undo')}</span>
          </button>
          <button
            type="button"
            disabled={sequence.length === 0}
            onClick={onClear}
            className="h-9 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-medium text-rose-300 flex items-center gap-1.5 disabled:opacity-40 active:scale-95 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{i18n.t('seed.clear')}</span>
          </button>
        </div>
      </div>

      {/* Scrollable chip sequence */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 min-h-8">
        {sequence.length === 0 ? (
          <span className="text-xs text-zinc-400 italic">—</span>
        ) : (
          sequence.map((val, idx) => (
            <span
              key={idx}
              className="shrink-0 inline-flex items-center justify-center h-7 min-w-8 px-2 rounded-lg bg-zinc-800 border border-zinc-700 font-mono text-xs font-bold tabular-nums text-amber-300"
            >
              {String(val).padStart(2, '0')}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
