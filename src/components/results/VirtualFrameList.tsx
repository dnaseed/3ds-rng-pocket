import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FrameRow } from '../../engine/core/types';
import { useApp } from '../../store/AppContext';
import { FrameCard } from './FrameCard';
import { RngLegendModal } from './RngLegendModal';

interface VirtualFrameListProps {
  rows: FrameRow[];
  truncated?: boolean;
  showSpecies?: boolean;
  allowShowStats?: boolean;
  fallbackSpecies?: number;
  fallbackForme?: number;
  onSelectRow: (row: FrameRow) => void;
  checkedIndices?: Set<number>;
  onToggleCheck?: (idx: number) => void;
  activeFiltersCount?: number;
  filtersIgnored?: boolean;
  paramsCollapsed?: boolean;
  onToggleParamsCollapsed?: () => void;
  scrollNonce?: number;
  contextSummary?: string;
}

export function VirtualFrameList({
  rows,
  truncated = false,
  showSpecies = false,
  allowShowStats = false,
  fallbackSpecies = 0,
  fallbackForme = 0,
  onSelectRow,
  checkedIndices,
  onToggleCheck,
  activeFiltersCount = 0,
  filtersIgnored = false,
  paramsCollapsed = false,
  onToggleParamsCollapsed,
  scrollNonce = 0,
  contextSummary,
}: VirtualFrameListProps) {
  const { i18n } = useApp();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  useEffect(() => {
    if (scrollNonce <= 0) return;
    const raf = requestAnimationFrame(() => {
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(raf);
  }, [scrollNonce]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 104,
    overscan: 8,
  });

  if (rows.length === 0) {
    return (
      <div ref={containerRef} className="scroll-mt-16">
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 flex items-center justify-between gap-2 text-xs text-zinc-400">
          <span>{i18n.t('app.noResults')}</span>
          <button
            type="button"
            onClick={() => setLegendOpen(true)}
            aria-label={i18n.t('search.legendTitle')}
            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 active:scale-95 transition"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
        <RngLegendModal open={legendOpen} onClose={() => setLegendOpen(false)} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-2 scroll-mt-16">
      <div className="flex items-center justify-between gap-1.5 flex-wrap px-0.5 text-xs text-zinc-400 font-mono tabular-nums">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span>
            {rows.length.toLocaleString()} {i18n.t('app.results')}
            {truncated ? ' (max)' : ''}
          </span>
          {filtersIgnored ? (
            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-sans text-[11px] font-medium">
              {i18n.t('search.ignoreFilters')}
            </span>
          ) : activeFiltersCount > 0 ? (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 font-sans text-[11px] font-semibold">
              {i18n.t('search.activeFilters').replace('{n}', String(activeFiltersCount))}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          {onToggleParamsCollapsed && (
            <button
              type="button"
              onClick={onToggleParamsCollapsed}
              className="h-9 px-2.5 rounded-xl bg-zinc-900 border border-zinc-800 font-sans text-[11px] font-semibold text-zinc-200 flex items-center gap-1 active:scale-95 transition"
            >
              {paramsCollapsed ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                  <span>{i18n.t('search.editParams')}</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{i18n.t('search.collapseParams')}</span>
                </>
              )}
            </button>
          )}

          {allowShowStats && (
            <button
              type="button"
              onClick={() => setShowStats((v) => !v)}
              className={`h-9 px-2.5 rounded-xl font-sans text-[11px] font-semibold border transition active:scale-95 ${
                showStats
                  ? 'bg-sky-500/20 border-sky-500/50 text-sky-200'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300'
              }`}
            >
              {i18n.t('search.showStats')}
            </button>
          )}

          <button
            type="button"
            onClick={() => setLegendOpen(true)}
            aria-label={i18n.t('search.legendTitle')}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 active:scale-95 transition"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {paramsCollapsed && contextSummary && (
        <div className="px-2.5 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-[11px] text-zinc-300 font-medium truncate">
          {contextSummary}
        </div>
      )}

      <div
        ref={parentRef}
        className={`${
          paramsCollapsed ? 'h-[70dvh]' : 'h-[54dvh]'
        } min-h-72 overflow-y-auto pr-0.5 rounded-2xl transition-[height] duration-150`}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index]!;
            return (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${item.start}px)`,
                }}
                className="pb-2"
              >
                <FrameCard
                  row={row}
                  showSpecies={showSpecies}
                  showStats={allowShowStats && showStats}
                  fallbackSpecies={fallbackSpecies}
                  fallbackForme={fallbackForme}
                  checked={checkedIndices?.has(item.index) ?? false}
                  onToggleCheck={
                    onToggleCheck ? () => onToggleCheck(item.index) : undefined
                  }
                  onSelect={() => onSelectRow(row)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <RngLegendModal open={legendOpen} onClose={() => setLegendOpen(false)} />
    </div>
  );
}
