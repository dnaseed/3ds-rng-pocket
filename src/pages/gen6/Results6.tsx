import { HelpCircle, X } from 'lucide-react';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { RngLegendModal } from '../../components/results/RngLegendModal';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useDialogFocus } from '../../components/common/useDialogFocus';
import type { Search6Output } from '../../engine/gen6/searches';
import { getPersonalEntry6 } from '../../data/personalTable6';
import { convertToTimeStr, getStats } from '../../engine/core/pokemonMath';
import { toHex32 } from '../../engine/math/uint';
import { FrameField } from '../../components/results/FrameValues';
import { useApp } from '../../store/AppContext';
import { buttonClass } from './fields';

export interface Results6Data<Row> extends Search6Output<Row> {
  summary: string;
}

export const rowButtonClass = 'w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-left space-y-1.5 hover:border-amber-500/60 focus-visible:outline-2 focus-visible:outline-amber-400';

export function Results6<Row extends { frame: number }>({ result, error, renderRow, simple = false, headerExtra }: {
  result: Results6Data<Row> | null;
  error: string | null;
  renderRow: (row: Row) => ReactNode;
  simple?: boolean;
  headerExtra?: ReactNode;
}) {
  const { i18n } = useApp();
  const [legendOpen, setLegendOpen] = useState(false);
  const [focus, setFocus] = useState<{ result: Results6Data<Row>; index: number } | null>(null);
  const pinned = focus?.result === result ? focus?.index : undefined;
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const rows = result?.rows;
  const virtual = !simple && (rows?.length ?? 0) > 20;
  const virtualizer = useVirtualizer({
    count: virtual ? rows!.length : 0,
    getScrollElement: () => list.current,
    estimateSize: () => 86,
    overscan: 7,
    rangeExtractor: range => {
      const visible = defaultRangeExtractor(range);
      if (pinned === undefined || visible.includes(pinned) || pinned >= range.count) return visible;
      return [...visible, pinned].sort((a, b) => a - b);
    },
  });

  const pendingIndex = useRef<number | null>(null);
  const visible = virtualizer.getVirtualItems();

  useEffect(() => {
    if (pendingIndex.current === null) return;
    const button = list.current?.querySelector<HTMLButtonElement>(`li[data-index="${pendingIndex.current}"] button`);
    if (!button) return;
    pendingIndex.current = null;
    button.focus({ preventScroll: true });
  }, [visible]);

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!virtual || !rows) return;
    const row = (event.target as HTMLElement).closest<HTMLLIElement>('li[data-index]');
    const index = Number(row?.dataset.index ?? -1);
    const next = event.key === 'ArrowDown' ? index + 1
      : event.key === 'ArrowUp' ? index - 1
      : event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    pendingIndex.current = Math.max(0, Math.min(rows.length - 1, next));
    const button = list.current?.querySelector<HTMLButtonElement>(`li[data-index="${pendingIndex.current}"] button`);
    virtualizer.scrollToIndex(pendingIndex.current);
    if (button) {
      pendingIndex.current = null;
      button.focus({ preventScroll: true });
    }
  }

  useEffect(() => {
    pendingIndex.current = null;
    if (!result) return;
    list.current?.scrollTo({ top: 0 });
    if (!window.matchMedia('(min-width: 64rem)').matches) {
      (root.current?.closest('.workspace-results') ?? root.current)?.scrollIntoView({ block: 'start' });
    }
  }, [result]);

  return <div ref={root} className="scroll-mt-16 space-y-2">
    {error && <p role="alert" className="rounded-xl border border-rose-700 bg-rose-950 p-3 text-sm text-rose-200">{error}</p>}
    {result && <div className="flex items-start justify-between gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2">
      <div className="min-w-0 space-y-1">
        <p role="status" className="text-xs font-semibold">{result.rows.length} {i18n.t('app.results')}</p>
        <p className="break-words text-xs text-zinc-400">{result.summary}</p>
        {result.truncated && <p className="text-xs text-amber-300">{i18n.t('gen6.resultsLimit', { n: result.rows.length })}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {headerExtra}
        <button type="button" onClick={() => setLegendOpen(true)} aria-label={i18n.t('search.legendTitle')}
          className={`${buttonClass} shrink-0`}><HelpCircle size={17} aria-hidden="true" /></button>
      </div>
    </div>}
    {rows?.length ? <div ref={list} tabIndex={virtual ? 0 : undefined} aria-label={virtual ? i18n.t('app.results') : undefined} onKeyDown={moveFocus}
      role={virtual ? 'region' : undefined}
      className={virtual ? 'gen6-virtual-results overflow-y-auto overscroll-contain pr-1' : 'gen6-simple-results lg:overflow-y-auto lg:pr-1'}>
      {virtual ? <ul className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {visible.map(item => <li key={item.key} data-index={item.index}
          ref={virtualizer.measureElement} aria-posinset={item.index + 1} aria-setsize={rows.length}
          className="absolute inset-x-0 top-0 pb-2" style={{ transform: `translateY(${item.start}px)` }}
          onFocus={event => {
            setFocus({ result: result!, index: item.index });
            const viewport = list.current?.getBoundingClientRect();
            const row = event.currentTarget.getBoundingClientRect();
            if (viewport && (row.top < viewport.top || row.bottom > viewport.bottom)) {
              virtualizer.scrollToIndex(item.index);
            }
          }}>
          {renderRow(rows[item.index]!)}
        </li>)}
      </ul> : <ul className="space-y-2">
        {rows.map((row, index) => <li key={index}>{renderRow(row)}</li>)}
      </ul>}
    </div> : <p className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
      {i18n.t(result ? 'app.noResults' : 'app.startSearch')}
    </p>}
    <RngLegendModal open={legendOpen} onClose={() => setLegendOpen(false)} gen6 />
  </div>;
}

export function Details6({ title, open, onClose, children }: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { i18n } = useApp();
  const id = useId();
  const dialog = useDialogFocus(open);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-xs lg:items-center lg:p-6" onClick={onClose}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}
      onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}
      className="w-full max-w-xl max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-zinc-800 bg-zinc-950 p-4 space-y-3 safe-pb shadow-2xl lg:max-h-[88dvh] lg:max-w-2xl lg:rounded-3xl lg:border lg:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="flex flex-wrap items-center gap-2 text-base font-bold">{title}</h2>
        <button type="button" className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600" aria-label={i18n.t('app.close')} onClick={onClose}><X size={16} /></button>
      </div>
      {children}
    </div>
  </div>;
}

export function StatValues6({ ivs, nature, level, species, forme = 0 }: {
  ivs: readonly number[];
  nature: number;
  level: number;
  species: number;
  forme?: number;
}) {
  if (species <= 0 || level <= 0) return null;
  const stats = getStats(ivs, nature, level, getPersonalEntry6(species, forme).stats);
  return <span className="flex flex-wrap items-center gap-1 font-mono text-xs tabular-nums">
    {stats.map((st, idx) => (
      <span key={idx} className="inline-flex min-w-6 justify-center rounded bg-sky-500/15 px-1 py-0.5 font-semibold text-sky-200">
        {st}
      </span>
    ))}
  </span>;
}

export interface DetailMetaField {
  label: string;
  value: ReactNode;
  wide?: boolean;
  tone?: 'amber' | 'emerald' | 'default';
}

export function PokemonDetailCard6({
  species = 0, forme = 0, level = 0, nature, everstoneLabel, synchronized, ability, gender,
  hiddenPower, ivs, inherited, pid, ec, psv, prv, extra = [],
}: {
  species?: number;
  forme?: number;
  level?: number;
  nature: number;
  everstoneLabel?: string;
  synchronized?: boolean;
  ability: number;
  gender: number;
  hiddenPower: number;
  ivs: readonly number[];
  inherited?: readonly (boolean | null)[];
  pid: number | null;
  ec: number;
  psv?: number;
  prv?: number;
  extra?: DetailMetaField[];
}) {
  const { i18n, lang } = useApp();
  const statLabels = lang === 'it' ? ['PS', 'Atk', 'Def', 'SpA', 'SpD', 'Vel'] : ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];
  const computedStats = species > 0 && level > 0
    ? getStats(ivs, nature, level, getPersonalEntry6(species, forme).stats)
    : null;
  const abLabel = ability === 3 ? 'HA' : ability > 0 ? String(ability) : '-';
  const genderLabel = ['-', '♂', '♀'][gender] ?? '-';
  const genderTone = gender === 1 ? 'text-sky-400' : gender === 2 ? 'text-pink-400' : 'text-zinc-300';

  return <div className="space-y-3">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-center text-xs">
      <div>
        <span className="block text-[11px] text-zinc-400">{i18n.t('search.nature')}</span>
        <span className="inline-flex flex-wrap items-center justify-center gap-1 font-semibold text-zinc-100">
          <span>{everstoneLabel ?? i18n.getNatureName(nature)}</span>
          {synchronized && <span className="text-[11px] font-semibold text-emerald-400">· Sync ✓</span>}
        </span>
      </div>
      <div>
        <span className="block text-[11px] text-zinc-400">{i18n.t('filters.ability')}</span>
        <span className="font-mono font-bold text-zinc-100">{abLabel}</span>
      </div>
      <div>
        <span className="block text-[11px] text-zinc-400">{i18n.t('filters.gender')}</span>
        <span className={`font-bold ${genderTone}`}>{genderLabel}</span>
      </div>
      <div>
        <span className="block text-[11px] text-zinc-400">{i18n.t('filters.hiddenPower')}</span>
        <span className="font-semibold text-zinc-100">{i18n.getHpTypeName(hiddenPower)}</span>
      </div>
    </div>

    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
      <div className="grid grid-cols-6 gap-1 text-center font-mono text-xs tabular-nums">
        {statLabels.map((label, idx) => {
          const iv = ivs[idx]!;
          const parent = inherited?.[idx];
          return <div key={label} className="space-y-0.5">
            <div className="text-[11px] text-zinc-400">{label}</div>
            <div className={`rounded bg-zinc-950 py-1 font-bold ${iv === 31 ? 'text-emerald-300' : iv === 0 ? 'text-amber-300' : 'text-zinc-200'}`}>
              {iv}
              {parent != null && <span aria-hidden="true">{parent ? '♂' : '♀'}</span>}
            </div>
            {computedStats && <div className="text-[11px] text-zinc-400">{computedStats[idx]}</div>}
          </div>;
        })}
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs tabular-nums">
      <div>
        <span className="block text-[11px] text-zinc-400">PID</span>
        <span className="text-zinc-100">{pid === null ? '—' : toHex32(pid)}</span>
      </div>
      <div>
        <span className="block text-[11px] text-zinc-400">EC</span>
        <span className="text-zinc-100">{toHex32(ec)}</span>
      </div>
      <div>
        <span className="block text-[11px] text-zinc-400">PSV / PRV</span>
        <span className="text-zinc-100">{pid === null || psv === undefined || prv === undefined ? '—' : `${String(psv).padStart(4, '0')} / ${prv.toString(16).toUpperCase()}`}</span>
      </div>
      {extra.map(item => (
        <div key={item.label} className={item.wide ? 'col-span-2' : undefined}>
          <span className="block text-[11px] text-zinc-400">{item.label}</span>
          <span className={`break-all ${item.tone === 'amber' ? 'text-amber-200' : item.tone === 'emerald' ? 'text-emerald-300' : 'text-zinc-100'}`}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  </div>;
}

export function CopyResultValue({ value, label }: { value: string; label?: string }) {
  const { i18n } = useApp();
  const [status, setStatus] = useState('');
  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" className={buttonClass} onClick={async () => {
      try {
        await navigator.clipboard.writeText(value);
        setStatus(i18n.t('app.copied'));
      } catch {
        setStatus(i18n.t('gen6.copyError'));
      }
    }}>{label ?? i18n.t('app.copy')}</button>
    <span role="status" className="text-xs text-zinc-400">{status}</span>
  </div>;
}

export function MtFrameTiming({ frame, startFrame, targetFrame }: {
  frame: number;
  startFrame: number;
  targetFrame?: number;
}) {
  const { i18n } = useApp();
  const shift = targetFrame === undefined ? undefined : frame - targetFrame;
  return <dl className="grid grid-cols-2 gap-2">
    <FrameField label={i18n.t('gen6.elapsedTime')}>{convertToTimeStr((frame - startFrame) / 60)}</FrameField>
    {shift !== undefined && <FrameField label={i18n.t('gen6.targetDelta')}>{shift > 0 ? '+' : ''}{shift}F</FrameField>}
  </dl>;
}
