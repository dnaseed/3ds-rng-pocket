import { AlertCircle, Calculator, Camera, CheckCircle2, Loader2, ScanText, Search, Settings2, WifiOff } from 'lucide-react';
import { lazy, Suspense, useEffect, useId, useMemo, useState } from 'react';
import { ClockPickerGrid } from '../components/clock/ClockPickerGrid';
import { ClockSequenceBar } from '../components/clock/ClockSequenceBar';
import { HexSeedInput } from '../components/common/HexSeedInput';
import { NumberStepper } from '../components/common/NumberStepper';
import { calcFrame, getStartingFrame } from '../engine/core/pokemonMath';
import { adjustClockReading, adjustClockSequence } from '../engine/gen7/clockHelper';
import type { QrMatch } from '../engine/gen7/qrSearch';
import { parseHex32, toHex32 } from '../engine/math/uint';
import { fetchInitialSeed, SeedApiError, type SeedApiResult } from '../services/sfmtSeedApi';
import { useApp } from '../store/AppContext';
import { useSearchWorker } from '../workers/useSearchWorker';

type SeedMode = 'save' | 'id' | 'qr';

const OverlayScanner = lazy(() => import('../components/clock/PokeReaderScanner'));
const ClockCameraHelper = lazy(() => import('../components/clock/ClockCameraHelper'));
export function SeedPage() {
  const [scan,setScan]=useState(false);
  const [clockCam, setClockCam] = useState(false);
  const {
    i18n,
    isUltra,
    clockStyle,
    setClockStyle,
    apiBaseUrl,
    isOnline,
    initialSeedHex,
    initialSeedNum,
    setInitialSeedHex,
    startFrame,
    setStartFrame,
    targetFrame,
    setTargetFrame,
    setIdStartFrame,
    setIdClockCorrection,
    setActiveTab,
    selectSection7,
  } = useApp();

  const [mode, setMode] = useState<SeedMode>('save');
  const [isEndReading, setIsEndReading] = useState(true);
  const [offset, setOffset] = useState(4); // Default 4 in 3DSRNGTool Gen7MainRNGTool
  const [sequence, setSequence] = useState<number[]>([]);

  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiResults, setApiResults] = useState<SeedApiResult[]>([]);

  const [qrMin, setQrMin] = useState(() => getStartingFrame(isUltra, 0));
  const [qrMax, setQrMax] = useState(50000);

  useEffect(() => {
    setQrMin((prev) =>
      prev === 478 || prev === 418 ? getStartingFrame(isUltra, 0) : prev,
    );
  }, [isUltra]);
  const [qrResults, setQrResults] = useState<QrMatch[]>([]);
  const [qrSearched, setQrSearched] = useState(false);

  const [tcNpc, setTcNpc] = useState(4);
  const [tcFidget, setTcFidget] = useState(false);
  const [tcRaining, setTcRaining] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 64rem)').matches : false,
  );
  const seedInputId = useId();
  const it = i18n.lang === 'it';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 64rem)');
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const timeCalcStr = useMemo(() => {
    if (Math.abs(targetFrame - startFrame) > 500_000) {
      return 'Range > 500.000F';
    }
    const [frames30, window30] = calcFrame(
      initialSeedNum,
      startFrame,
      targetFrame,
      tcNpc + 1,
      tcFidget,
      tcRaining,
    );
    const realtimeSec = (frames30 / 30).toFixed(2);
    let str = `${frames30 * 2}F (${realtimeSec}s)`;
    if (window30 > 0) {
      str += ` <${window30 * 2}F>`;
    }
    return str;
  }, [initialSeedNum, startFrame, targetFrame, tcNpc, tcFidget, tcRaining]);

  const { runQrSearch, isRunning: qrRunning } = useSearchWorker();

  const requiredCount = mode === 'id' ? 9 : mode === 'save' ? 8 : 2;

  const handlePickClock = (rawIdx: number) => {
    // Only Save Screen mode supports End Position offset; ID & QR always use Start Position (Gen7MainRNGTool.cs:72-73)
    const adjusted = adjustClockReading(rawIdx, mode, isEndReading, offset);
    setSequence((prev) => [...prev, adjusted]);
  };

  const handleConfirmCameraSequence = (rawSeq: number[]) => {
    const adjusted = adjustClockSequence(rawSeq, mode, isEndReading, offset);
    setSequence(adjusted);
    setClockCam(false);
  };

  // Auto-query when sequence satisfies minimum length
  useEffect(() => {
    if (mode === 'qr') {
      if (sequence.length < 2) {
        setQrResults([]);
        setQrSearched(false);
        return;
      }
      const seed = parseHex32(initialSeedHex);
      if (seed === null) return;
      let cancelled = false;
      runQrSearch({ seed, clocks: sequence, min: qrMin, max: qrMax })
        .then((matches) => {
          if (!cancelled) {
            setQrResults(matches);
            setQrSearched(true);
          }
        })
        .catch(() => {
          // aborted or failed
        });
      return () => {
        cancelled = true;
      };
    }

    if (sequence.length < requiredCount) {
      setApiResults([]);
      setApiError(null);
      return;
    }

    let cancelled = false;
    setApiLoading(true);
    setApiError(null);

    const needle = sequence.join(',');
    fetchInitialSeed({
      needle,
      isId: mode === 'id',
      isUltra,
      baseUrl: apiBaseUrl,
    })
      .then((res) => {
        if (cancelled) return;
        setApiResults(res);
        setApiLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setApiResults([]);
        setApiLoading(false);
        if (err instanceof SeedApiError) {
          setApiError(err.message);
        } else {
          setApiError(String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sequence, mode, requiredCount, isUltra, apiBaseUrl, initialSeedHex, qrMin, qrMax, runQrSearch]);

  const applyApiSeed = (res: SeedApiResult) => {
    const parsed = parseHex32(res.seed);
    if (parsed !== null) {
      setInitialSeedHex(toHex32(parsed));
    }
    if (mode === 'save') {
      const start = getStartingFrame(isUltra, 0) + Math.max(0, sequence.length - 1);
      setStartFrame(start);
      setActiveTab('stationary');
    } else {
      setIdStartFrame(getStartingFrame(isUltra, 4));
      setIdClockCorrection(Math.max(0, Math.min(16, res.add)));
      selectSection7('id');
    }
  };

  const applyQrMatch = (m: QrMatch) => {
    setStartFrame(m.currentFrameAfterQuit);
    setActiveTab('stationary');
  };

  const seedInputsNode = (
    <div className="seed-inputs space-y-3">
      {/* Manual Seed Hex Card (always first and accessible offline) */}
      <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={seedInputId}
            className="text-xs font-semibold text-zinc-300 truncate"
          >
            {i18n.t('seed.manualHex')}
          </label>
          <button
            type="button"
            onClick={() => setScan(true)}
            aria-label={it ? 'Scansiona overlay' : 'Scan overlay'}
            className="min-h-11 px-2.5 -my-1.5 shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-amber-500/10 border border-amber-500/35 text-xs font-semibold text-amber-200 hover:border-amber-400/60 active:scale-95 transition"
          >
            <ScanText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden min-[400px]:inline">
              {it ? 'Scansiona overlay' : 'Scan overlay'}
            </span>
            <span className="min-[400px]:hidden">Overlay</span>
          </button>
        </div>

        <HexSeedInput
          inputId={seedInputId}
          ariaLabel={i18n.t('seed.manualHex')}
          value={initialSeedHex}
          onChange={setInitialSeedHex}
        />

        {mode === 'qr' && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <NumberStepper
              label={i18n.t('search.startFrame')}
              value={qrMin}
              min={0}
              onChange={setQrMin}
            />
            <NumberStepper
              label={i18n.t('search.endFrame')}
              value={qrMax}
              min={0}
              onChange={setQrMax}
            />
          </div>
        )}
      </div>

      {/* Mode Segmented Control */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
        {(
          [
            { id: 'save', label: i18n.t('seed.modeSave') },
            { id: 'id', label: i18n.t('seed.modeId') },
            { id: 'qr', label: i18n.t('seed.modeQr') },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setMode(tab.id);
              setSequence([]);
              setApiResults([]);
              setApiError(null);
              setQrResults([]);
              setQrSearched(false);
            }}
            aria-pressed={mode === tab.id}
            className="choice-button min-h-10 rounded-xl text-xs font-semibold transition px-2"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Offline warning for API modes */}
      {!isOnline && mode !== 'qr' && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-200">
          <WifiOff className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <p>{i18n.t('seed.apiOfflineWarn')}</p>
        </div>
      )}

      {/* Clock Reading Controls */}
      <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {mode === 'save' ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsEndReading(true)}
                className={`min-h-11 px-3 rounded-xl text-xs font-medium border transition ${
                  isEndReading
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
              >
                {i18n.t('seed.readingEnd')}
              </button>
              <button
                type="button"
                onClick={() => setIsEndReading(false)}
                className={`min-h-11 px-3 rounded-xl text-xs font-medium border transition ${
                  !isEndReading
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
              >
                {i18n.t('seed.readingStart')}
              </button>
            </div>
          ) : (
            <span className="text-xs font-medium text-zinc-400">
              {mode === 'id' ? i18n.t('seed.readingStart') : i18n.t('seed.modeQr')}
            </span>
          )}

          <div className="inline-flex gap-1">
            {(['svg', 'sprite'] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setClockStyle(style)}
                aria-pressed={clockStyle === style}
                className="choice-button min-h-11 px-2.5 rounded-xl text-xs font-medium active:scale-95 transition"
              >
                {i18n.t(style === 'svg' ? 'seed.useSvg' : 'seed.useSprite')}
              </button>
            ))}
          </div>
        </div>

        {mode === 'save' && isEndReading && (
          <NumberStepper
            label={i18n.t('seed.offset')}
            value={offset}
            min={0}
            max={16}
            onChange={setOffset}
          />
        )}

        <button
          type="button"
          onClick={() => setClockCam(true)}
          className="min-h-11 w-full rounded-xl bg-amber-500/10 border border-amber-500/35 px-3 text-xs font-semibold text-amber-200 hover:border-amber-400/60 flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <Camera className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{it ? 'Usa fotocamera' : 'Use camera'}</span>
        </button>
      </div>

      {/* Entered Sequence */}
      <ClockSequenceBar
        sequence={sequence}
        requiredCount={requiredCount}
        onUndo={() => setSequence((prev) => prev.slice(0, -1))}
        onClear={() => setSequence([])}
      />
    </div>
  );

  const seedClocksNode = (
    <div className="seed-clocks">
      {/* Clock Hand Touch Grid */}
      <ClockPickerGrid clockStyle={clockStyle} onPick={handlePickClock} />
    </div>
  );

  const seedMatchesNode = (
    <div className="seed-matches">
      {/* Results Card */}
      {mode !== 'qr' ? (
        <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-2 lg:flex lg:flex-col lg:min-h-0">
          {sequence.length < requiredCount ? (
            <p className="text-xs text-zinc-400 text-center py-1">
              {i18n.t('seed.needMoreClocks', { n: requiredCount })}
            </p>
          ) : apiLoading ? (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-amber-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{i18n.t('app.searching')}</span>
            </div>
          ) : apiError ? (
            <div className="flex items-start gap-2 text-xs text-rose-300 py-1">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{apiError}</span>
            </div>
          ) : apiResults.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-1">{i18n.t('app.noResults')}</p>
          ) : (
            <div className="space-y-2 lg:overflow-y-auto lg:min-h-0 lg:pr-1">
              {apiResults.map((res, idx) => (
                <div
                  key={`${res.seed}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950 border border-emerald-500/40 p-2.5"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-mono text-base font-bold text-amber-300 tabular-nums">
                        {res.seed.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono tabular-nums mt-0.5">
                      step: {res.step} · add: {res.add}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyApiSeed(res)}
                    className="min-h-10 px-3.5 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-bold active:scale-95 transition"
                  >
                    {i18n.t('seed.applySeed')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-2 lg:flex lg:flex-col lg:min-h-0">
          {sequence.length < 2 ? (
            <p className="text-xs text-zinc-400 text-center py-1">
              {i18n.t('seed.qrNeedMore')}
            </p>
          ) : qrRunning ? (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-amber-300">
              <Search className="w-4 h-4 animate-pulse" />
              <span>{i18n.t('app.searching')}</span>
            </div>
          ) : qrSearched && qrResults.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-1">{i18n.t('app.noResults')}</p>
          ) : (
            <div className="space-y-2 lg:overflow-y-auto lg:min-h-0 lg:pr-1">
              {qrResults.slice(0, 20).map((m, idx) => (
                <div
                  key={`${m.lastClockFrame}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950 border border-emerald-500/40 p-2.5"
                >
                  <p className="text-xs text-zinc-200 tabular-nums">
                    {i18n.t('seed.qrResult', {
                      last: m.lastClockFrame,
                      next: m.currentFrameAfterQuit,
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() => applyQrMatch(m)}
                    className="shrink-0 min-h-9 px-3 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-bold active:scale-95 transition"
                  >
                    {i18n.t('app.apply')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const timeCalcNode = (
    <div
      className="seed-timecalc rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-2.5 scroll-mt-16"
    >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
            <Calculator className="w-3.5 h-3.5 text-amber-400" />
            <span>{i18n.t('seed.timeCalcTitle')}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setStartFrame(getStartingFrame(isUltra, 0));
              setTargetFrame(5000);
              setTcNpc(4);
              setTcFidget(false);
              setTcRaining(false);
            }}
            className="h-8 px-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-medium text-amber-300 flex items-center gap-1 active:scale-95 transition"
            title={i18n.t('search.resetRng')}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{getStartingFrame(isUltra, 0)}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NumberStepper
            label={i18n.t('search.startingFrame')}
            value={startFrame}
            min={0}
            onChange={setStartFrame}
          />
          <NumberStepper
            label={i18n.t('search.targetFrame')}
            value={targetFrame}
            min={0}
            onChange={setTargetFrame}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 items-end">
          <NumberStepper
            label={i18n.t('search.npcCount')}
            value={tcNpc}
            min={0}
            max={20}
            onChange={setTcNpc}
          />
          <div className="flex items-center gap-1.5">
            <label className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200">
              <input
                type="checkbox"
                checked={tcFidget}
                onChange={(e) => setTcFidget(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span>Fidget</span>
            </label>
            <label className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200">
              <input
                type="checkbox"
                checked={tcRaining}
                onChange={(e) => setTcRaining(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span>{i18n.t('search.raining')}</span>
            </label>
          </div>
        </div>

        <div className="rounded-xl bg-zinc-950 border border-sky-500/30 px-3 py-2 font-mono text-xs font-semibold text-sky-200 text-center tabular-nums">
          {i18n.t('seed.timeCalcResult', { time: timeCalcStr })}
        </div>
    </div>
  );

  return (
    <div className="tool-workspace seed-workspace pb-4">
      {isDesktop ? (
        <>
          <div className="tool-pane seed-left-pane">
            {seedInputsNode}
            {seedClocksNode}
          </div>
          <div className="tool-pane seed-right-pane">
            {seedMatchesNode}
            {timeCalcNode}
          </div>
        </>
      ) : (
        <>
          {seedInputsNode}
          {seedMatchesNode}
          {seedClocksNode}
          {timeCalcNode}
        </>
      )}
      {scan && (
        <Suspense fallback={null}>
          <OverlayScanner close={() => setScan(false)} />
        </Suspense>
      )}
      {clockCam && (
        <Suspense fallback={null}>
          <ClockCameraHelper
            mode={mode}
            isEndReading={isEndReading}
            offset={offset}
            hasValidSeed={parseHex32(initialSeedHex) !== null}
            onConfirmSequence={handleConfirmCameraSequence}
            close={() => setClockCam(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
