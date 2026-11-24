import { useState, type ReactNode } from 'react';
import { countActiveFilters, FilterBottomSheet, type FilterSheetMode } from '../../components/filters/FilterBottomSheet';
import { SearchWorkspace } from '../../components/layout/SearchWorkspace';
import { SearchActionBar } from '../../components/results/SearchActionBar';
import { getPersonalEntry6 } from '../../data/personalTable6';
import type { RngFilterOptions } from '../../engine/core/types';
import type { Search6Output } from '../../engine/gen6/searches';
import { parseHex32 } from '../../engine/math/uint';
import type { Session6, TrainerProfile6 } from '../../services/gen6Storage';
import { useApp } from '../../store/AppContext';
import { Details6, MtFrameTiming, Results6, rowButtonClass, type Results6Data } from './Results6';
import { cardClass, NumberField } from './fields';
import { Pair6 } from './ToolFields6';

export interface Page6Props {
  profile: TrainerProfile6;
  session: Session6;
  updateSession: (patch: Partial<Session6>) => void;
}

export function range6(session: Session6) {
  return {
    seed: parseHex32(session.initialSeedHex) ?? 0,
    minFrame: session.startFrame,
    maxFrame: session.endFrame,
  };
}

interface FrameSearch6Props<Row> extends Pick<Page6Props, 'session' | 'updateSession'> {
  title: string;
  summary: string;
  children: ReactNode;
  worker: { isRunning: boolean; progress: number; error: string | null; abort: () => void };
  run: () => Promise<Search6Output<Row>>;
  brief: (row: Row) => ReactNode;
  briefRight?: (row: Row) => ReactNode;
  briefSub?: (row: Row) => ReactNode;
  detail: (row: Row) => ReactNode;
  showTarget?: boolean;
  headerExtra?: ReactNode;
  filters?: { mode: FilterSheetMode; value: RngFilterOptions; change: (next: RngFilterOptions) => void };
}

export function FrameSearch6<Row extends { frame: number }>({
  title, summary, children, worker, run, brief, briefRight, briefSub, detail, session, updateSession, filters, showTarget, headerExtra,
}: FrameSearch6Props<Row>) {
  const { i18n: { t } } = useApp();
  const [result, setResult] = useState<(Results6Data<Row> & { startFrame: number; targetFrame: number }) | null>(null);
  const [row, setRow] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = filters ? countActiveFilters(filters.value) : 0;

  async function search() {
    setError('');
    const { initialSeedHex, startFrame, endFrame, targetFrame } = session;
    if (startFrame > endFrame) {
      setError(t('gen6.invalidRange'));
      return;
    }

    try {
      const output = await run();
      const searchSummary = [title, summary, initialSeedHex, `#${startFrame}–#${endFrame}`];
      if (activeFilters) searchSummary.push(`${t('search.filters')} ${activeFilters}`);
      setResult({ ...output, summary: searchSummary.filter(Boolean).join(' · '), startFrame, targetFrame });
    } catch (exception) {
      if (exception instanceof Error && exception.message !== 'ABORTED') setError(exception.message);
    }
  }

  return <>
    <SearchWorkspace collapsible={!!result} actions={
      <SearchActionBar activeFilters={activeFilters} onOpenFilters={filters ? () => setFiltersOpen(true) : undefined}
        isRunning={worker.isRunning} progress={worker.progress} onAbort={worker.abort} onSearch={() => void search()} />
    } results={
      <Results6 result={result} error={error || worker.error} headerExtra={headerExtra} renderRow={entry =>
        <button type="button" className={rowButtonClass} onClick={() => setRow(entry)}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
              <b className="font-mono text-amber-300">#{entry.frame}</b>
              {brief(entry)}
            </span>
            {briefRight?.(entry)}
          </div>
          {briefSub?.(entry)}
        </button>
      } />
    }>
      <section className={cardClass}>
        <h1 className="font-bold">{title}</h1>
        {children}
        <Pair6>
          <NumberField label={t('search.startFrame')} value={session.startFrame} onChange={startFrame => updateSession({ startFrame })} />
          <NumberField label={t('search.endFrame')} value={session.endFrame} onChange={endFrame => updateSession({ endFrame })} />
        </Pair6>
      </section>
    </SearchWorkspace>
    {filters && <FilterBottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)}
      mode={filters.mode} filter={filters.value} onChange={filters.change} allowExactStats={false}
      allowSquareShiny={filters.mode !== 'event'} personalData={{ speciesCount: 721, getEntry: getPersonalEntry6 }} />}
    <Details6 open={row !== null} title={`${title} #${row?.frame ?? ''}`} onClose={() => setRow(null)}>
      {row && result && <>
        {detail(row)}
        <MtFrameTiming frame={row.frame} startFrame={result.startFrame} targetFrame={showTarget ? result.targetFrame : undefined} />
      </>}
    </Details6>
  </>;
}
