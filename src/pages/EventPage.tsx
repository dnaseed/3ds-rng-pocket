import { RotateCcw, Settings2, Upload, X } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
import textEn from '../data/generated/text_en.json';
import { getFormeEntry, inAlolanDex } from '../data/personalTable';
import { createDefaultRngFilter } from '../engine/core/filters';
import { getStartingFrame } from '../engine/core/pokemonMath';
import type { FrameRow, RngFilterOptions, SearchMode } from '../engine/core/types';
import type { MainSearchOutput } from '../engine/gen7/searches';
import { parseWc7File } from '../engine/gen7/wc7Parser';
import { parseHex32, toHex32 } from '../engine/math/uint';
import { NumberStepper } from '../components/common/NumberStepper';
import { NumericInput } from '../components/common/NumericInput';
import { countActiveFilters, FilterBottomSheet } from '../components/filters/FilterBottomSheet';
import { FrameDetailModal } from '../components/results/FrameDetailModal';
import { SearchActionBar } from '../components/results/SearchActionBar';
import { VirtualFrameList } from '../components/results/VirtualFrameList';
import { useApp } from '../store/AppContext';
import { useSearchWorker } from '../workers/useSearchWorker';

export function EventPage() {
  const {
    i18n,
    activeProfile,
    isUltra,
    initialSeedNum,
    startFrame,
    setStartFrame,
    targetFrame,
    setTargetFrame,
    aroundJump,
    clearAroundJump,
    timelineJump,
    clearTimelineJump,
  } = useApp();

  const [species, setSpecies] = useState(802); // Marshadow default
  const [forme, setForme] = useState(0);
  const [level, setLevel] = useState(50);
  const [pidType, setPidType] = useState<0 | 1 | 2 | 3>(1);
  const [yourId, setYourId] = useState(false);
  const [isEgg, setIsEgg] = useState(false);
  const [noDex, setNoDex] = useState(false);
  const [otherInfo, setOtherInfo] = useState(true);
  const [ivsCount, setIvsCount] = useState(3);
  const [lockedIvs, setLockedIvs] = useState<[number, number, number, number, number, number]>([
    -1, -1, -1, -1, -1, -1,
  ]);
  const [wc7Status, setWc7Status] = useState<{ ok: boolean; msg: string } | null>(null);

  const [abilityLocked, setAbilityLocked] = useState(true);
  const [ability, setAbility] = useState(0);
  const [natureLocked, setNatureLocked] = useState(false);
  const [nature, setNature] = useState(0);
  const [genderLocked, setGenderLocked] = useState(true);
  const [gender, setGender] = useState(0);

  const [tid, setTid] = useState(0);
  const [sid, setSid] = useState(0);
  const [ecHex, setEcHex] = useState('00000000');
  const [pidHex, setPidHex] = useState('00000000');

  const [mode, setMode] = useState<SearchMode>('normal');
  const [endFrame, setEndFrame] = useState(50000);
  const [npcCount, setNpcCount] = useState(4);
  const [delayFrames, setDelayFrames] = useState(0);
  const [considerDelay, setConsiderDelay] = useState(true);
  const [timeSpanSec, setTimeSpanSec] = useState(3600);
  const [leapDelayMin, setLeapDelayMin] = useState(10);
  const [leapDelayMax, setLeapDelayMax] = useState(100);
  const [leapView, setLeapView] = useState<'timeline' | 'spread'>('timeline');
  const [leapInfo, setLeapInfo] = useState<MainSearchOutput['leapInfo']>(undefined);

  const [filter, setFilter] = useState<RngFilterOptions>(() => createDefaultRngFilter());
  const [filterOpen, setFilterOpen] = useState(false);
  const [rows, setRows] = useState<FrameRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [selectedRow, setSelectedRow] = useState<FrameRow | null>(null);
  const [paramsCollapsed, setParamsCollapsed] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);

  const { isRunning, progress, error, abort, runMainSearch } = useSearchWorker();

  const speciesInAlolaDex = inAlolanDex(species, isUltra);
  const speciesFormeCount = getFormeEntry(species, 0).formeCount;

  useEffect(() => {
    const entry = getFormeEntry(species, forme);
    if (!inAlolanDex(species, isUltra)) {
      setNoDex(false);
    }
    setFilter((prev) => ({
      ...prev,
      baseStats: [...entry.stats] as [number, number, number, number, number, number],
    }));
  }, [species, forme, isUltra]);

  useEffect(() => {
    if (startFrame > endFrame) {
      setEndFrame(startFrame + 50000);
    }
  }, [startFrame, endFrame]);

  // Event delay: 42F in USUM, 62F in SM when double-generation triggers
  useEffect(() => {
    const doubleDelay = isUltra ? 42 : 62;
    setDelayFrames((yourId && !isEgg) || (speciesInAlolaDex && noDex) ? doubleDelay : 0);
  }, [yourId, isEgg, noDex, speciesInAlolaDex, isUltra]);

  useEffect(() => {
    if (mode === 'timeline') {
      setConsiderDelay(true);
    }
  }, [mode]);

  const executeSearch = async (
    overrideMode?: SearchMode,
    overrideTarget?: number,
    overrideLeapView?: 'timeline' | 'spread',
    overrideStartFrame?: number,
  ) => {
    const m = overrideMode ?? mode;
    const sf = overrideStartFrame ?? startFrame;
    const tgt = overrideTarget ?? targetFrame;
    const lv = overrideLeapView ?? leapView;

    const reqFilter: RngFilterOptions = {
      ...filter,
      safeOnly: m === 'normal' && npcCount > 0 ? filter.safeOnly : false,
      blinkOnly: m === 'normal' && npcCount === 0 ? filter.blinkOnly : false,
    };

    try {
      const res = await runMainSearch({
        kind: 'event',
        seed: initialSeedNum,
        isUltra,
        startFrame: sf,
        endFrame,
        targetFrame: tgt,
        npcCount,
        raining: false,
        considerDelay: m === 'timeline' ? true : considerDelay,
        delayFrames,
        mode: m,
        timeSpanSec,
        isBoy: true,
        fidgetTimeline: false,
        xMenu: false,
        jumpFrame: 0,
        leapType: 0,
        leapDelayMinSec: leapDelayMin,
        leapDelayMaxSec: leapDelayMax,
        leapView: lv,
        filter: reqFilter,
        config: {
          species,
          forme,
          level,
          ivs: lockedIvs,
          ivsCount,
          yourId,
          isEgg,
          noDex,
          pidType,
          abilityLocked,
          natureLocked,
          genderLocked,
          otherInfo,
          tid: yourId ? 0 : tid,
          sid: yourId ? 0 : sid,
          tsv: yourId ? activeProfile.tsv : undefined,
          trv: yourId ? activeProfile.trv : undefined,
          ec: parseHex32(ecHex) ?? 0,
          pid: yourId ? 0 : (parseHex32(pidHex) ?? 0),
          ability,
          nature,
          gender,
        },
      });
      setRows(res.rows);
      setTruncated(res.truncated);
      setLeapInfo(res.leapInfo);
      setSearchNonce((n) => n + 1);
    } catch {
      // aborted
    }
  };

  useEffect(() => {
    if (aroundJump && aroundJump.tab === 'event') {
      setMode('aroundTarget');
      setTargetFrame(aroundJump.targetFrame);
      clearAroundJump();
      void executeSearch('aroundTarget', aroundJump.targetFrame);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aroundJump]);

  useEffect(() => {
    if (timelineJump && timelineJump.tab === 'event') {
      const sf = timelineJump.startFrame;
      clearTimelineJump();
      setMode('timeline');
      setStartFrame(sf);
      setConsiderDelay(true);
      void executeSearch('timeline', undefined, undefined, sf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineJump]);

  const handleWc7Import = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const parsed = parseWc7File(buf);
      if (!parsed) {
        setWc7Status({ ok: false, msg: i18n.t('event.wc7Error') });
        return;
      }
      setSpecies(parsed.species);
      setForme(parsed.forme);
      setLevel(parsed.level);
      setAbilityLocked(parsed.abilityLocked);
      setAbility(parsed.ability);
      setNatureLocked(parsed.natureLocked);
      setNature(parsed.nature);
      setGenderLocked(parsed.genderLocked);
      setGender(parsed.gender);
      setIvsCount(parsed.ivsCount);
      setLockedIvs(parsed.ivs);
      setTid(parsed.tid);
      setSid(parsed.sid);
      setPidType(parsed.pidType);
      setPidHex(toHex32(parsed.pid));
      setEcHex(toHex32(parsed.ec));
      setIsEgg(parsed.isEgg);
      setYourId(parsed.yourId);
      setOtherInfo(parsed.otherInfo);
      setWc7Status({
        ok: true,
        msg: `${i18n.t('event.wc7Loaded')} ${i18n.getSpeciesName(parsed.species)}${
          parsed.forme > 0 ? ` (F${parsed.forme})` : ''
        }`,
      });
    } catch {
      setWc7Status({ ok: false, msg: i18n.t('event.wc7Error') });
    }
  };

  return (
    <div className="space-y-3 pb-6">
      {!paramsCollapsed && (
        <>
      <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-zinc-100">{i18n.t('event.title')}</h2>
          <label className="h-10 px-3 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-semibold text-amber-300 flex items-center gap-1.5 cursor-pointer active:scale-95 transition">
            <Upload className="w-3.5 h-3.5" />
            <span>{i18n.t('event.importWc7')}</span>
            <input
              type="file"
              accept=".wc7,.wc7full"
              onChange={(ev) => void handleWc7Import(ev)}
              className="hidden"
            />
          </label>
        </div>

        {wc7Status && (
          <div
            className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs border ${
              wc7Status.ok
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
            }`}
          >
            <span className="truncate">{wc7Status.msg}</span>
            <button
              type="button"
              onClick={() => setWc7Status(null)}
              className="shrink-0 text-zinc-400"
              aria-label={i18n.t('app.close')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {lockedIvs.some((v) => v >= 0) && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-[11px] font-mono text-amber-200">
            <span>
              {i18n.t('event.fixedIvs')}:{' '}
              {lockedIvs.map((v) => (v >= 0 ? String(v) : 'x')).join('/')}
            </span>
            <button
              type="button"
              onClick={() => setLockedIvs([-1, -1, -1, -1, -1, -1])}
              className="text-zinc-400 hover:text-zinc-200"
              aria-label={i18n.t('app.reset')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1">
            <label className="block text-xs font-medium text-zinc-400">
              {i18n.t('event.species')}
            </label>
            <select
              value={species}
              onChange={(e) => {
                setSpecies(Number(e.target.value));
                setForme(0);
              }}
              className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-800 px-2.5 text-xs text-zinc-100"
            >
              {textEn.species.slice(0, isUltra ? 808 : 803).map((_, idx) => (
                <option key={idx} value={idx}>
                  {idx === 0 ? '-' : `${String(idx).padStart(3, '0')} - ${i18n.getSpeciesName(idx)}`}
                </option>
              ))}
            </select>
          </div>
          <NumberStepper
            label={i18n.t('event.level')}
            value={level}
            min={0}
            max={100}
            onChange={setLevel}
          />
        </div>

        {speciesFormeCount > 1 && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-400">
              {i18n.t('event.forme')}
            </label>
            <select
              value={forme}
              onChange={(e) => setForme(Number(e.target.value))}
              className="w-full h-10 rounded-xl bg-zinc-950 border border-zinc-800 px-2.5 text-xs text-zinc-100"
            >
              {Array.from({ length: speciesFormeCount }, (_, idx) => (
                <option key={idx} value={idx}>
                  Forme {idx}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-400">
              {i18n.t('event.pidType')}
            </label>
            <select
              value={pidType}
              onChange={(e) => setPidType(Number(e.target.value) as 0 | 1 | 2 | 3)}
              className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-800 px-2.5 text-xs text-zinc-100"
            >
              {[0, 1, 2, 3].map((p) => (
                <option key={p} value={p}>
                  {i18n.getPidTypeName(p)}
                </option>
              ))}
            </select>
          </div>
          <NumberStepper
            label={i18n.t('event.ivsCount')}
            value={ivsCount}
            min={0}
            max={Math.max(0, 6 - lockedIvs.filter((v) => v >= 0).length)}
            onChange={setIvsCount}
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { label: i18n.t('event.yourId'), checked: yourId, set: setYourId },
            { label: i18n.t('event.isEgg'), checked: isEgg, set: setIsEgg },
            ...(speciesInAlolaDex
              ? [{ label: i18n.t('event.noDex'), checked: noDex, set: setNoDex }]
              : []),
            { label: i18n.t('event.otherInfo'), checked: otherInfo, set: setOtherInfo },
          ].map((flag) => (
            <button
              key={flag.label}
              type="button"
              onClick={() => flag.set(!flag.checked)}
              className={`h-9 px-2.5 rounded-lg text-[11px] font-medium border ${
                flag.checked
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400'
              }`}
            >
              {flag.label}
            </button>
          ))}
        </div>

        {/* Locks */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] text-zinc-400">
              <input
                type="checkbox"
                checked={abilityLocked}
                onChange={(e) => {
                  const locked = e.target.checked;
                  setAbilityLocked(locked);
                  setAbility(0);
                }}
                className="accent-amber-500"
              />
              {i18n.t('filters.ability')}
            </label>
            <select
              aria-label={i18n.t('filters.ability')}
              value={ability}
              onChange={(e) => setAbility(Number(e.target.value))}
              className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 px-2 text-xs text-zinc-100"
            >
              {abilityLocked ? (
                <>
                  <option value={0}>-</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>H</option>
                </>
              ) : (
                <>
                  <option value={0}>1/2</option>
                  <option value={1}>1/2/H</option>
                </>
              )}
            </select>
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] text-zinc-400">
              <input
                type="checkbox"
                checked={natureLocked}
                onChange={(e) => setNatureLocked(e.target.checked)}
                className="accent-amber-500"
              />
              Nature
            </label>
            <select
              disabled={!natureLocked}
              value={nature}
              onChange={(e) => setNature(Number(e.target.value))}
              className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 px-2 text-xs text-zinc-100 disabled:opacity-40"
            >
              {Array.from({ length: 25 }, (_, i) => (
                <option key={i} value={i}>
                  {i18n.getNatureName(i)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] text-zinc-400">
              <input
                type="checkbox"
                checked={genderLocked}
                onChange={(e) => setGenderLocked(e.target.checked)}
                className="accent-amber-500"
              />
              {i18n.t('filters.gender')}
            </label>
            <select
              disabled={!genderLocked}
              value={gender}
              onChange={(e) => setGender(Number(e.target.value))}
              className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 px-2 text-xs text-zinc-100 disabled:opacity-40"
            >
              <option value={0}>-</option>
              <option value={1}>♂</option>
              <option value={2}>♀</option>
            </select>
          </div>
        </div>

        {!yourId && (
          <div className="grid grid-cols-2 gap-2">
            <NumberStepper label="Event TID" value={tid} min={0} max={65535} onChange={setTid} />
            <NumberStepper label="Event SID" value={sid} min={0} max={65535} onChange={setSid} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="block text-[11px] text-zinc-400">EC (Hex)</label>
            <input
              type="text"
              maxLength={8}
              value={ecHex}
              onChange={(e) => setEcHex(e.target.value.toUpperCase())}
              onBlur={() => {
                const p = parseHex32(ecHex);
                if (p !== null) setEcHex(toHex32(p));
              }}
              className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 font-mono text-xs text-zinc-100"
            />
          </div>
          {pidType === 3 && (
            <div className="space-y-1">
              <label className="block text-[11px] text-zinc-400">PID (Hex)</label>
              <input
                type="text"
                maxLength={8}
                value={pidHex}
                onChange={(e) => setPidHex(e.target.value.toUpperCase())}
                onBlur={() => {
                  const p = parseHex32(pidHex);
                  if (p !== null) setPidHex(toHex32(p));
                }}
                className="w-full h-9 rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 font-mono text-xs text-zinc-100"
              />
            </div>
          )}
        </div>

        {/* Individual IV Locks */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-0.5">
          {(['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'] as const).map((stat, idx) => {
            const val = lockedIvs[idx] ?? -1;
            const locked = val >= 0;
            return (
              <div
                key={stat}
                className={`rounded-xl border p-1.5 space-y-1 ${
                  locked ? 'bg-zinc-950 border-amber-500/40' : 'bg-zinc-950/60 border-zinc-800'
                }`}
              >
                <label className="flex items-center justify-between text-[10px] font-bold text-zinc-400">
                  <span>{stat}</span>
                  <input
                    type="checkbox"
                    checked={locked}
                    onChange={(e) => {
                      const next = [...lockedIvs] as [
                        number,
                        number,
                        number,
                        number,
                        number,
                        number,
                      ];
                      next[idx] = e.target.checked ? 31 : -1;
                      setLockedIvs(next);
                    }}
                    className="w-3.5 h-3.5 accent-amber-500"
                  />
                </label>
                {locked ? (
                  <NumericInput
                    ariaLabel={`Event ${stat} IV`}
                    min={0}
                    max={31}
                    value={val}
                    onChange={(v) => {
                      const next = [...lockedIvs] as [
                        number,
                        number,
                        number,
                        number,
                        number,
                        number,
                      ];
                      next[idx] = v;
                      setLockedIvs(next);
                    }}
                    className="w-full h-7 rounded-lg bg-zinc-900 border border-zinc-800 text-center font-mono text-xs tabular-nums text-amber-300"
                  />
                ) : (
                  <div className="h-7 flex items-center justify-center font-mono text-[11px] text-zinc-400">
                    —
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mode & Frame Range */}
      <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
            {i18n.t('search.rngInfo')}
          </span>
          <div className="flex items-center gap-1.5">
            {(countActiveFilters(filter) > 0 || filter.skip) && (
              <button
                type="button"
                onClick={() => {
                  const fresh = createDefaultRngFilter();
                  fresh.baseStats = filter.baseStats;
                  setFilter(fresh);
                }}
                className="h-8 px-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-medium text-zinc-300 flex items-center gap-1 active:scale-95 transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{i18n.t('search.resetFilters')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setStartFrame(getStartingFrame(isUltra, 1));
                setEndFrame(50000);
                setTargetFrame(5000);
                setTimeSpanSec(3600);
                setNpcCount(4);
                setDelayFrames((yourId && !isEgg) || (speciesInAlolaDex && noDex) ? (isUltra ? 42 : 62) : 0);
                setConsiderDelay(true);
              }}
              className="h-8 px-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-medium text-amber-300 flex items-center gap-1 active:scale-95 transition"
              title={i18n.t('search.resetRng')}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{i18n.t('search.resetRng')}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
          {(
            [
              { id: 'normal', label: i18n.t('search.modeNormal') },
              { id: 'timeline', label: i18n.t('search.modeTimeline') },
              { id: 'aroundTarget', label: i18n.t('search.modeAround') },
              { id: 'timelineLeap', label: i18n.t('search.modeLeap') },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className="choice-button min-h-10 rounded-lg text-[11px] font-semibold px-1"
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NumberStepper
            label={
              mode === 'timeline'
                ? i18n.t('search.startingFrame')
                : i18n.t('search.startFrame')
            }
            value={startFrame}
            min={0}
            onChange={setStartFrame}
          />
          {mode === 'normal' ? (
            <NumberStepper
              label={i18n.t('search.endFrame')}
              value={endFrame}
              min={startFrame}
              onChange={setEndFrame}
            />
          ) : mode === 'timeline' ? (
            <NumberStepper
              label={i18n.t('search.timeSpan')}
              value={timeSpanSec}
              min={1}
              onChange={setTimeSpanSec}
            />
          ) : (
            <NumberStepper
              label={i18n.t('search.targetFrame')}
              value={targetFrame}
              min={mode === 'aroundTarget' ? 100 : 0}
              onChange={setTargetFrame}
            />
          )}
        </div>

        {(mode === 'normal' || mode === 'timeline') && (
          <NumberStepper
            label={i18n.t('search.targetFrame')}
            value={targetFrame}
            min={0}
            onChange={setTargetFrame}
          />
        )}

        {mode === 'timelineLeap' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <NumberStepper
                label={i18n.t('search.leapDelayMin')}
                value={leapDelayMin}
                min={0}
                max={3600}
                onChange={setLeapDelayMin}
              />
              <NumberStepper
                label={i18n.t('search.leapDelayMax')}
                value={leapDelayMax}
                min={leapDelayMin}
                max={3600}
                onChange={setLeapDelayMax}
              />
            </div>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
              {(
                [
                  { id: 'timeline', label: i18n.t('search.leapTimeline') },
                  { id: 'spread', label: i18n.t('search.leapSpread') },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setLeapView(v.id);
                    if (leapInfo) void executeSearch('timelineLeap', targetFrame, v.id);
                  }}
                  className={`h-8 rounded-lg text-[11px] font-semibold transition ${
                    leapView === v.id ? 'bg-zinc-800 text-amber-300' : 'text-zinc-400'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <NumberStepper
            label={i18n.t('search.npcCount')}
            value={npcCount}
            min={0}
            max={20}
            onChange={setNpcCount}
          />
          <NumberStepper
            label={i18n.t('search.delay')}
            value={delayFrames}
            min={0}
            max={200}
            disabled={mode !== 'timeline' && !considerDelay}
            onChange={setDelayFrames}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label
            className={`flex items-center gap-2 px-3 h-10 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 ${
              mode === 'timeline' ? 'opacity-60' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={mode === 'timeline' ? true : considerDelay}
              disabled={mode === 'timeline'}
              onChange={(e) => setConsiderDelay(e.target.checked)}
              className="w-4 h-4 accent-amber-500"
            />
            <span>{i18n.t('search.considerDelay')}</span>
          </label>
          {mode === 'normal' && (
            <label
              className={`flex items-center gap-2 px-3 h-10 rounded-xl border text-xs transition ${
                (npcCount === 0 ? filter.blinkOnly : filter.safeOnly)
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-medium'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-200'
              }`}
            >
              <input
                type="checkbox"
                checked={npcCount === 0 ? Boolean(filter.blinkOnly) : Boolean(filter.safeOnly)}
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    safeOnly: npcCount > 0 ? e.target.checked : false,
                    blinkOnly: npcCount === 0 ? e.target.checked : false,
                  }))
                }
                className="w-4 h-4 accent-emerald-500"
              />
              <span>
                {npcCount === 0 ? i18n.t('search.blinkOnly') : i18n.t('search.safeOnly')}
              </span>
            </label>
          )}
          <label
            className={`flex items-center gap-2 px-3 h-10 rounded-xl border text-xs transition ${
              filter.shinyOnly
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-200 font-medium'
                : 'bg-zinc-950 border-zinc-800 text-zinc-200'
            }`}
          >
            <input
              type="checkbox"
              checked={filter.shinyOnly}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  shinyOnly: e.target.checked,
                  squareShinyOnly: e.target.checked ? prev.squareShinyOnly : false,
                }))
              }
              className="w-4 h-4 accent-amber-500"
            />
            <span>{i18n.t('search.shinyOnly')}</span>
          </label>
          <label
            className={`flex items-center gap-2 px-3 h-10 rounded-xl border text-xs transition ${
              filter.skip
                ? 'bg-zinc-800 border-zinc-600 text-zinc-100 font-medium'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400'
            }`}
          >
            <input
              type="checkbox"
              checked={filter.skip}
              onChange={(e) => setFilter((prev) => ({ ...prev, skip: e.target.checked }))}
              className="w-4 h-4 accent-amber-500"
            />
            <span>{i18n.t('search.ignoreFilters')}</span>
          </label>
        </div>
      </div>
        </>
      )}

      {mode === 'timelineLeap' && leapInfo && (
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/40 p-3 text-xs text-emerald-200 font-medium">
          {i18n
            .t('search.leapHitSummary')
            .replace('{f0}', leapInfo.frame0.toLocaleString())
            .replace('{target}', leapInfo.targetFrame.toLocaleString())
            .replace('{count}', String(leapInfo.hitCount))}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      <VirtualFrameList
        rows={rows}
        truncated={truncated}
        allowShowStats={species > 0}
        fallbackSpecies={species}
        fallbackForme={forme}
        onSelectRow={setSelectedRow}
        activeFiltersCount={countActiveFilters(filter)}
        filtersIgnored={filter.skip}
        paramsCollapsed={paramsCollapsed}
        onToggleParamsCollapsed={() => setParamsCollapsed((v) => !v)}
        scrollNonce={searchNonce}
      />

      <SearchActionBar
        activeFilters={countActiveFilters(filter)}
        onOpenFilters={() => setFilterOpen(true)}
        isRunning={isRunning}
        progress={progress}
        onSearch={() => void executeSearch()}
        onAbort={abort}
      />

      <FilterBottomSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filter={filter}
        onChange={setFilter}
        mode="event"
        showSafeBlink={mode === 'normal'}
        npcCount={npcCount}
      />

      <FrameDetailModal
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        fallbackSpecies={species}
        fallbackForme={forme}
        aroundTab="event"
      />
    </div>
  );
}
