import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { HexSeedInput } from '../components/common/HexSeedInput';
import { NumberStepper } from '../components/common/NumberStepper';
import { NumericInput } from '../components/common/NumericInput';
import { MiscToolFields, miscSelectClass } from '../components/filters/MiscToolFields';
import { SearchWorkspace } from '../components/layout/SearchWorkspace';
import { SearchActionBar } from '../components/results/SearchActionBar';
import {
  FESTIVAL_FACILITIES,
  FESTIVAL_RANKS,
  SPECIAL_TRAINERS,
  getBerryLocationLabel,
  getBerryNameLabel,
  getRotoPowerLabel,
} from '../data/miscGen7';
import type { MiscResult, MiscSearchOutput, MiscSettings } from '../engine/gen7/misc7';
import { parseHex32 } from '../engine/math/uint';
import { useApp } from '../store/AppContext';
import { useSearchWorker } from '../workers/useSearchWorker';

interface MiscResults extends MiscSearchOutput {
  settings: MiscSettings;
  seed: string;
  start: number;
  end: number;
  npcCount: number;
  delay: number;
}

const PAGE_SIZE = 50;

function ResultValue({ result }: { result: MiscResult }) {
  const { i18n, lang } = useApp();
  switch (result.kind) {
    case 'pokerus': return result.strain;
    case 'festival': return (
      <>
        <span>{FESTIVAL_FACILITIES[result.facility]} · {result.stars}★</span>
        <span className="block text-zinc-400">{i18n.t('misc.npc')} {result.npc} · {i18n.t('misc.color')} {result.color}</span>
      </>
    );
    case 'battleTree': {
      const name = SPECIAL_TRAINERS[result.trainerId - 192];
      return name ? `${result.trainerId} · ${name}` : result.trainerId;
    }
    case 'rotoLoto': return `${getRotoPowerLabel(result.roll, lang)} · ${result.roll}`;
    case 'berries': return `${getBerryNameLabel(result.berry, lang)} · ${result.roll}`;
  }
}

function AppliedFilters({ settings }: { settings: MiscSettings }) {
  const { i18n, lang } = useApp();
  const filters: string[] = [];
  switch (settings.kind) {
    case 'festival': {
      const { facility, stars, npc, color } = settings.filters;
      if (facility !== undefined) filters.push(FESTIVAL_FACILITIES[facility]!);
      if (stars !== undefined) filters.push(`${stars}★`);
      if (npc !== undefined) filters.push(`${i18n.t('misc.npc')} ${npc}`);
      if (color !== undefined) filters.push(`${i18n.t('misc.color')} ${color}`);
      break;
    }
    case 'battleTree':
      if (settings.trainerId !== undefined) filters.push(`${i18n.t('misc.trainerId')} ${settings.trainerId}`);
      break;
    case 'rotoLoto':
      if (settings.target !== undefined) filters.push(getRotoPowerLabel(settings.target, lang));
      break;
    case 'berries':
      if (settings.target !== undefined) filters.push(getBerryNameLabel(settings.target, lang));
      break;
  }
  if (filters.length === 0) return null;
  return <span className="mt-1 block">{i18n.t('search.filters')} · {filters.join(' · ')}</span>;
}

export function MiscPage() {
  const { activeProfile, initialSeedHex, i18n, lang } = useApp();
  const { runMiscSearch, isRunning, progress, abort, error } = useSearchWorker();
  const [kind, setKind] = useState<MiscSettings['kind']>('pokerus');
  const [settingsByKind, setSettingsByKind] = useState<Record<MiscSettings['kind'], MiscSettings>>({
    pokerus: { kind: 'pokerus' },
    festival: { kind: 'festival', game: activeProfile.gameVersion, rank: 18, filters: {} },
    battleTree: { kind: 'battleTree', game: activeProfile.gameVersion, streak: 1 },
    rotoLoto: { kind: 'rotoLoto' },
    berries: { kind: 'berries', location: 0 },
  });
  const [localSeed, setLocalSeed] = useState<string>();
  const [start, setStart] = useState(0);
  const [count, setCount] = useState(5000);
  const [npcCount, setNpcCount] = useState(0);
  const [delays, setDelays] = useState<Partial<Record<MiscSettings['kind'], number>>>({});
  const [lastResults, setLastResults] = useState<MiscResults>();
  const [page, setPage] = useState(0);
  const resultsRef = useRef<HTMLElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const settings = settingsByKind[kind];
  const delay = delays[kind] ?? (kind === 'berries' ? 8 : 0);
  const results = lastResults?.settings.kind === kind ? lastResults : undefined;
  const pageCount = Math.ceil((results?.rows.length ?? 0) / PAGE_SIZE);
  const showActualIndex = results && (results.delay >= 2 || results.settings.kind === 'battleTree');
  const seed = localSeed ?? initialSeedHex;
  const number = (value: number) => value.toLocaleString(lang);

  useEffect(() => {
    const panel = resultsRef.current;
    if (!results || !panel || matchMedia('(min-width: 64rem)').matches) return;
    const panelBounds = panel.getBoundingClientRect();
    const scrollBounds = panel.closest('main')?.getBoundingClientRect();
    if (scrollBounds && (panelBounds.top < scrollBounds.top ||
        Math.min(panelBounds.bottom, panelBounds.top + 160) > scrollBounds.bottom)) {
      panel.scrollIntoView({ block: 'nearest' });
    }
  }, [lastResults]);

  async function calculate() {
    const end = start + count - 1;
    try {
      const output = await runMiscSearch({
        seed: parseHex32(seed) ?? 0, startIndex: start, endIndex: end, npcCount, delayFrames: delay,
        settings,
      });
      setPage(0);
      setLastResults({ ...output, settings, seed, start, end, npcCount, delay });
    } catch {
      // The worker reports errors separately and cancellation preserves the previous search.
    }
  }

  function goToPage(next: number) {
    setPage(next);
    if (matchMedia('(min-width: 64rem)').matches) tableRef.current?.scrollTo({ top: 0 });
    else resultsRef.current?.scrollIntoView({ block: 'start' });
  }

  return (
    <SearchWorkspace
      collapsed={false}
      actions={
        <SearchActionBar
          activeFilters={0}
          isRunning={isRunning}
          progress={progress}
          onSearch={() => void calculate()}
          onAbort={abort}
          searchLabel={i18n.t('misc.calculate')}
        />
      }
      results={
        <section ref={resultsRef} className="flex min-h-0 flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 lg:h-full lg:p-4" aria-labelledby="misc-results">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="misc-results" className="text-sm font-bold">{i18n.t(kind === 'pokerus' ? 'misc.results' : 'misc.matches')}</h2>
            {results && <span className="text-xs tabular-nums text-amber-200">
              {number(results.rows.length)} {i18n.t(results.rows.length === 1 ? 'misc.singleResult' : 'app.results')}
            </span>}
          </div>
          {results && <p className="text-xs text-zinc-400">
            <span className="font-mono text-zinc-200">{results.seed}</span>
            {' · '}{number(results.start)}–{number(results.end)}
            {' · '}{i18n.t('misc.npcs')} {results.npcCount}
            {' · '}{i18n.t('misc.delay')} {results.delay}
            {results.settings.kind === 'festival' && ` · ${results.settings.game} · ${i18n.t('misc.rank')} ${FESTIVAL_RANKS[results.settings.rank]}`}
            {results.settings.kind === 'battleTree' && ` · ${results.settings.game} · ${i18n.t('misc.streak')} ${results.settings.streak}`}
            {results.settings.kind === 'berries' && ` · ${getBerryLocationLabel(results.settings.location, lang)}`}
            <AppliedFilters settings={results.settings} />
          </p>}
          <div role="status" className="sr-only">
            {results && `${i18n.t('misc.matches')} ${number(results.rows.length)}`}
          </div>
          {error && <p role="alert" className="text-sm text-rose-300">{i18n.t('misc.searchError')}</p>}
          {!results && !error && <p className="text-sm text-zinc-400">{i18n.t('misc.startSearch')}</p>}
          {results?.rows.length === 0 && <p className="text-sm text-zinc-400">{i18n.t(kind === 'pokerus' ? 'misc.noInfections' : 'app.noResults')}</p>}
          {results?.truncated && <p className="text-xs text-amber-200">{i18n.t('misc.truncated')}</p>}
          {results && results.rows.length > 0 && (
            <div ref={tableRef} className="overflow-x-auto lg:overflow-y-auto">
              <table className="w-full text-left text-xs tabular-nums">
                <thead className="sticky top-0 bg-zinc-900 text-zinc-300">
                  <tr>
                    <th scope="col" className="px-2 py-2">{i18n.t('misc.index')}</th>
                    {showActualIndex && <th scope="col" className="px-2 py-2">{i18n.t('misc.actualIndex')}</th>}
                    <th scope="col" className="px-2 py-2">{i18n.t(kind === 'pokerus' ? 'misc.strain' : `misc.${kind}`)}</th>
                    <th scope="col" className="hidden px-2 py-2 sm:table-cell">{i18n.t('misc.randomNumber')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 font-mono">
                  {results.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((row) => (
                    <tr key={row.index}>
                      <td className="px-2 py-2.5">{number(row.index)}</td>
                      {showActualIndex && <td className="px-2 py-2.5">{number(row.actualIndex)}</td>}
                      <td className="px-2 py-2.5">
                        <span className="font-semibold text-amber-200"><ResultValue result={row.result} /></span>
                        <span className="block text-[11px] text-zinc-400 sm:hidden" title={i18n.t('misc.randomNumber')}>{row.randomNumber}</span>
                      </td>
                      <td className="hidden px-2 py-2.5 text-zinc-400 sm:table-cell">{row.randomNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pageCount > 1 && (
            <div className="flex shrink-0 items-center justify-between text-xs text-zinc-300">
              <button type="button" aria-label={i18n.t('misc.previous')} disabled={page === 0}
                onClick={() => goToPage(page - 1)} className="grid h-10 w-10 place-items-center rounded-lg border border-zinc-700 disabled:opacity-35">
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <span aria-live="polite">{i18n.t('misc.page', { page: page + 1, total: pageCount })}</span>
              <button type="button" aria-label={i18n.t('misc.next')} disabled={page + 1 === pageCount}
                onClick={() => goToPage(page + 1)} className="grid h-10 w-10 place-items-center rounded-lg border border-zinc-700 disabled:opacity-35">
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </section>
      }
    >
      <h1 className="text-lg font-bold">{i18n.t('misc.title')}</h1>
      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 lg:p-4" aria-label={i18n.t('misc.tool')}>
        <div>
          <label className="block text-xs font-semibold text-zinc-300">
            {i18n.t('misc.tool')}
            <select className={miscSelectClass} value={kind} disabled={isRunning}
              onChange={event => setKind(event.target.value as MiscSettings['kind'])}>
              {Object.keys(settingsByKind).map(tool => <option key={tool} value={tool}>{i18n.t(`misc.${tool}`)}</option>)}
            </select>
          </label>
          <p className="mt-2 text-xs text-zinc-400">{i18n.t(`misc.${kind}Description`)}</p>
        </div>
        <HexSeedInput value={seed} label={i18n.t('app.seedLabel')} onChange={setLocalSeed} />
        <div className="space-y-2">
          <div className="grid grid-cols-2 items-end gap-2">
            <label className="text-xs font-medium text-zinc-300">
              {i18n.t('misc.startIndex')}
              <NumericInput value={start} onChange={setStart} max={1_000_000_000}
                className={`${miscSelectClass} font-mono tabular-nums`} />
            </label>
            <label className="text-xs font-medium text-zinc-300">
              {i18n.t('misc.indexCount')}
              <NumericInput value={count} onChange={setCount} min={1} max={1_000_000}
                className={`${miscSelectClass} font-mono tabular-nums`} />
            </label>
          </div>
          <p className="text-xs tabular-nums text-zinc-400">
            {i18n.t('misc.range', { start: number(start), end: number(start + count - 1) })}
          </p>
        </div>
        <MiscToolFields key={kind} settings={settings}
          onChange={next => setSettingsByKind(previous => ({ ...previous, [next.kind]: next }))} />
        <details className="rounded-xl border border-zinc-800 px-3">
          <summary className="cursor-pointer py-2.5 text-xs font-semibold text-zinc-300">
            {i18n.t('misc.timing')}
          </summary>
          <div className="space-y-2 pb-3">
            <NumberStepper label={i18n.t('misc.npcs')} value={npcCount} onChange={setNpcCount} max={100} />
            <NumberStepper label={i18n.t('misc.delay')} value={delay} onChange={value => setDelays(previous => ({ ...previous, [kind]: value }))} max={10000} />
          </div>
        </details>
      </section>
    </SearchWorkspace>
  );
}
