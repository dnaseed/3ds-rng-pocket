import { NumericInput } from '../../components/common/NumericInput';
import { MAX_FRAME } from '../../engine/core/pokemonMath';

export const cardClass = 'rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-3';
export const fieldClass = 'w-full min-w-0 min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 focus-visible:outline-2 focus-visible:outline-amber-400';
export const labelClass = 'block min-w-0 space-y-1 text-xs font-medium text-zinc-300';
export const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-semibold text-zinc-100 hover:border-zinc-500 disabled:opacity-50';
export const primaryClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 text-xs font-bold text-zinc-950 disabled:opacity-50';

export function NumberField({ label, value, onChange, min = 0, max = MAX_FRAME }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return <label className={labelClass}>
    <span>{label}</span>
    <NumericInput value={value} onChange={onChange} min={min} max={max} ariaLabel={label}
      className={`${fieldClass} font-mono tabular-nums`} />
  </label>;
}
