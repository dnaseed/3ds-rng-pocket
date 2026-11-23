import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, useState } from 'react';
import { ClockDialSvg } from '../components/clock/ClockDialSvg';
import { NumberStepper } from '../components/common/NumberStepper';
import { SearchActionBar } from '../components/results/SearchActionBar';
import { getStartingFrame } from '../engine/core/pokemonMath';
import type { IdFilterType, IdResult7 } from '../engine/core/types';
import { toHex64 } from '../engine/math/uint';
import { useApp } from '../store/AppContext';
import { useSearchWorker } from '../workers/useSearchWorker';

export function IdPage() {
  const {
    i18n,
    isUltra,
    initialSeedNum,
    idStartFrame: startFrame,
    setIdStartFrame: setStartFrame,
    idClockCorrection: clockCorrection,
    setIdClockCorrection: setClockCorrection,
  } = useApp();

  const [endFrame, setEndFrame] = useState(50000);

  const [skipFilter, setSkipFilter] = useState(true);
  const [idType, setIdType] = useState<IdFilterType>(3); // G7TID default
  const [regex, setRegex] = useState(false);
  const [idText, setIdText] = useState('');
  const [tsvText, setTsvText] = useState('');
  const [randText, setRandText] = useState('');

  const [rows, setRows] = useState<IdResult7[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [paramsCollapsed, setParamsCollapsed] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);

  const { isRunning, progress, error, abort, runIdSearch } = useSearchWorker();

  const resultsRef = useRef<HTMLDivElement | null>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (searchNonce <= 0) return;
    const raf = requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(raf);
  }, [searchNonce]);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 82,
    overscan: 8,
  });

  const executeSearch = async () => {
    try {
      const res = await runIdSearch({
        kind: 'id',
        seed: initialSeedNum,
        isUltra,
        startFrame,
        endFrame,
        clockCorrection,
        filter: {
          skip: skipFilter,
          idType,
          regex,
          idList: idText.split(/\r?\n/),
          tsvList: tsvText.split(/\r?\n/),
          randList: randText.split(/\r?\n/),
        },
      });
      setRows(res.rows);
      setTruncated(res.truncated);
      setSearchNonce((n) => n + 1);
    } catch {
      // aborted
    }
  };

  return (
    <div className="space-y-3 pb-6">
      {!paramsCollapsed && (
      <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-zinc-100">{i18n.t('id.title')}</h2>
          <button
            type="button"
            onClick={() => {
              setStartFrame(getStartingFrame(isUltra, 4));
              setEndFrame(50000);
              setClockCorrection(0);
            }}
            className="h-8 px-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-medium text-amber-300 flex items-center gap-1 active:scale-95 transition"
            title={i18n.t('search.resetRng')}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{i18n.t('search.resetRng')}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NumberStepper
            label={i18n.t('search.startFrame')}
            value={startFrame}
            min={0}
            onChange={setStartFrame}
          />
          <NumberStepper
            label={i18n.t('search.endFrame')}
            value={endFrame}
            min={startFrame}
            onChange={setEndFrame}
          />
          <div className="col-span-2">
            <NumberStepper
              label={i18n.t('id.clkCorrection')}
              value={clockCorrection}
              min={0}
              max={16}
              onChange={setClockCorrection}
            />
          </div>
        </div>

        <label className="flex items-center justify-between px-3 h-10 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200">
          <span>{i18n.t('filters.disable')}</span>
          <input
            type="checkbox"
            checked={skipFilter}
            onChange={(e) => setSkipFilter(e.target.checked)}
            className="w-4 h-4 accent-amber-500"
          />
        </label>

        {!skipFilter && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
              {(
                [
                  { v: 0, l: 'TID' },
                  { v: 1, l: 'SID' },
                  { v: 2, l: 'Full' },
                  { v: 3, l: 'G7TID' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setIdType(opt.v)}
                  aria-pressed={idType === opt.v}
                  className="choice-button h-8 rounded-lg text-xs font-semibold"
                >
                  {opt.l}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[11px] text-zinc-400">{i18n.t('id.idList')}</label>
                <textarea
                  rows={2}
                  value={idText}
                  onChange={(e) => setIdText(e.target.value)}
                  placeholder="777777"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2 font-mono text-xs text-zinc-100"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-zinc-400">{i18n.t('id.tsvList')}</label>
                <textarea
                  rows={2}
                  value={tsvText}
                  onChange={(e) => setTsvText(e.target.value)}
                  placeholder="1234"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-2 font-mono text-xs text-zinc-100"
                />
              </div>
            </div>

            <div className="flex items-start gap-2">
              <textarea
                rows={2}
                value={randText}
                onChange={(e) => setRandText(e.target.value)}
                placeholder={i18n.t('id.randList')}
                aria-label={i18n.t('id.randList')}
                className="flex-1 rounded-xl bg-zinc-950 border border-zinc-800 p-2 font-mono text-xs text-zinc-100"
              />
              <label className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 shrink-0">
                <input
                  type="checkbox"
                  checked={regex}
                  onChange={(e) => setRegex(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span>{i18n.t('id.regex')}</span>
              </label>
            </div>
          </div>
        )}
      </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Virtualized ID List */}
      <div ref={resultsRef} className="scroll-mt-16">
      {rows.length === 0 ? (
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-6 text-center text-xs text-zinc-400">
          {i18n.t('app.noResults')}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 text-xs text-zinc-400 font-mono tabular-nums">
            <span>
              {rows.length.toLocaleString()} {i18n.t('app.results')}
              {truncated ? ' (max)' : ''}
            </span>
            <button
              type="button"
              onClick={() => setParamsCollapsed((v) => !v)}
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
          </div>
          <div
            ref={parentRef}
            className={`${
              paramsCollapsed ? 'h-[70dvh]' : 'h-[52dvh]'
            } min-h-64 overflow-y-auto rounded-2xl transition-[height] duration-150`}
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((item) => {
                const id = rows[item.index]!;
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
                    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3 flex items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0 font-mono tabular-nums">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-100">
                            #{id.frame.toLocaleString()}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-xs font-bold">
                            G7 {String(id.g7tid).padStart(6, '0')}
                          </span>
                          <span className="text-xs text-emerald-300 font-semibold">
                            TSV {String(id.tsv).padStart(4, '0')}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          TID {String(id.tid).padStart(5, '0')} · SID{' '}
                          {String(id.sid).padStart(5, '0')} · TRV {id.trv} ·{' '}
                          <span className="text-zinc-400">{toHex64(id.randLo, id.randHi)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center shrink-0">
                        <ClockDialSvg index={id.clock} size={36} />
                        <span className="font-mono text-[10px] text-zinc-400 tabular-nums">
                          {String(id.clock).padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      </div>

      <SearchActionBar
        activeFilters={0}
        isRunning={isRunning}
        progress={progress}
        onSearch={() => void executeSearch()}
        onAbort={abort}
      />
    </div>
  );
}
