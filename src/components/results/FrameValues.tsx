import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { useApp } from '../../store/AppContext';

export function FrameIvValues({ ivs, inherited }: { ivs: readonly number[]; inherited?: readonly (boolean | null)[] }) {
  const { i18n, lang } = useApp();
  const labels = lang === 'it' ? ['PS', 'Atk', 'Def', 'SpA', 'SpD', 'Vel'] : ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];
  return <span className="flex flex-wrap items-center gap-1 font-mono text-xs tabular-nums">
    {ivs.map((iv, index) => {
      const parent = inherited?.[index];
      const source = parent == null ? '' : i18n.t(parent ? 'gen6.maleParent' : 'gen6.femaleParent');
      return <span key={index} role="img" aria-label={`${labels[index]} ${iv}${source ? ` · ${source}` : ''}`} title={`${labels[index]}: ${iv}${source ? ` · ${source}` : ''}`}
        className={`inline-flex min-w-6 justify-center rounded px-1 py-0.5 ${iv === 31
          ? 'bg-emerald-500/15 font-bold text-emerald-300'
          : iv === 0 ? 'bg-amber-500/15 font-bold text-amber-300' : 'bg-zinc-950 text-zinc-300'}`}>
        {String(iv).padStart(2, '0')}
        {source && <span aria-hidden="true">{parent ? '♂' : '♀'}</span>}
      </span>;
    })}
  </span>;
}

export function FrameShinyBadge({ square = false }: { square?: boolean }) {
  const { i18n } = useApp();
  return <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-zinc-950 ${square ? 'bg-cyan-400' : 'bg-amber-400'}`}>
    <Sparkles className="size-2.5" aria-hidden="true" />
    <span aria-hidden="true">{square ? '◇' : '★'}</span>
    <span className="sr-only">{i18n.t(square ? 'filters.shinySquare' : 'gen6.shiny')}</span>
  </span>;
}

export function FrameSyncBadge({ synced }: { synced: boolean }) {
  const { i18n } = useApp();
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${synced
    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-zinc-700 text-zinc-400'}`}>
    <span aria-hidden="true">Sync {synced ? '✓' : '×'}</span>
    <span className="sr-only">{i18n.t(synced ? 'gen6.syncYes' : 'gen6.syncNo')}</span>
  </span>;
}

export function FrameField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0 rounded-lg bg-zinc-950 px-2 py-1.5">
    <dt className="text-xs text-zinc-400">{label}</dt>
    <dd className="break-words font-mono text-sm">{children}</dd>
  </div>;
}
