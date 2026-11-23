import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

interface NumberStepperProps {
  label?: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 1_000_000_000,
  step = 1,
  disabled = false,
}: NumberStepperProps) {
  const [draft, setDraft] = useState(() => String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(String(value));
    }
  }, [value, focused]);

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.trunc(v)));

  const commitDraft = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '-') {
      setDraft(String(value));
      return;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(parsed)) {
      const clamped = clamp(parsed);
      onChange(clamped);
      setDraft(String(clamped));
    } else {
      setDraft(String(value));
    }
  };

  return (
    <div className="space-y-1 min-w-0">
      {label && <label className="block text-xs font-medium text-zinc-400 truncate">{label}</label>}
      <div className="flex items-center rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden h-[46px]">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => {
            const next = clamp(value - step);
            onChange(next);
            setDraft(String(next));
          }}
          className="w-11 h-full flex items-center justify-center text-zinc-300 hover:bg-zinc-800 disabled:opacity-35 active:bg-zinc-700 transition shrink-0"
          aria-label="Decrease"
        >
          <Minus className="w-4 h-4" />
        </button>
        <input
          type="text"
          inputMode={min < 0 ? 'text' : 'numeric'}
          pattern={min < 0 ? '-?[0-9]*' : '[0-9]*'}
          disabled={disabled}
          value={draft}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commitDraft(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitDraft(draft);
              (e.target as HTMLInputElement).blur();
            }
          }}
          onChange={(e) => {
            const raw = e.target.value;
            const allowed = min < 0 ? /^-?\d*$/ : /^\d*$/;
            if (!allowed.test(raw)) return;
            setDraft(raw);
            if (raw !== '' && raw !== '-') {
              const parsed = Number.parseInt(raw, 10);
              if (!Number.isNaN(parsed)) {
                onChange(clamp(parsed));
              }
            }
          }}
          className="w-full h-full min-w-0 bg-transparent px-1 text-center font-mono text-sm font-semibold tabular-nums text-zinc-100 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => {
            const next = clamp(value + step);
            onChange(next);
            setDraft(String(next));
          }}
          className="w-11 h-full flex items-center justify-center text-zinc-300 hover:bg-zinc-800 disabled:opacity-35 active:bg-zinc-700 transition shrink-0"
          aria-label="Increase"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
