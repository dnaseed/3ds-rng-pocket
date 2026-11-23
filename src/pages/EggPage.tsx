import { SearchWorkspace } from '../components/layout/SearchWorkspace';
import { CheckCircle2, Delete, RotateCcw, Settings2, Sparkles, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createDefaultRngFilter } from '../engine/core/filters';
import { getStartingFrame } from '../engine/core/pokemonMath';
import type { FrameRow, RngFilterOptions, SearchMode } from '../engine/core/types';
import { calcMagikarpSeed } from '../engine/gen7/magikarpCalc';
import type { EggSearchOutput } from '../engine/gen7/searches';
import { formatEggSeedStr, parseEggSeedStr } from '../engine/math/uint';
import { NumberStepper } from '../components/common/NumberStepper';
import { NumericInput } from '../components/common/NumericInput';
import { countActiveFilters, FilterBottomSheet } from '../components/filters/FilterBottomSheet';
import { FrameDetailModal } from '../components/results/FrameDetailModal';
import { SearchActionBar } from '../components/results/SearchActionBar';
import { VirtualFrameList } from '../components/results/VirtualFrameList';
import { useApp } from '../store/AppContext';
import { useSearchWorker } from '../workers/useSearchWorker';

type EggSubTab = 'calc' | 'magikarp' | 'main';
type EggMode = 'frame' | 'list' | 'shortestPath';

const GENDER_RATIOS = [0xff, 0x7f, 0x1f, 0x3f, 0xbf, 0xe1, 0x00, 0xfe] as const;

export function EggPage() {
  const {
    i18n,
    activeProfile,
    isUltra,
    updateActiveEggSeed,
    initialSeedNum,
    startFrame,
    setStartFrame,
    targetFrame,
    setTargetFrame,
  } = useApp();

  const [subTab, setSubTab] = useState<EggSubTab>('calc');
  const [eggSeedText, setEggSeedText] = useState(() => formatEggSeedStr(activeProfile.eggSeed));

  useEffect(() => {
    setEggSeedText(formatEggSeedStr(activeProfile.eggSeed));
  }, [activeProfile.eggSeed]);

  // Parent Config
  const [maleIvs, setMaleIvs] = useState<[number, number, number, number, number, number]>([
    31, 31, 31, 31, 31, 31,
  ]);
  const [femaleIvs, setFemaleIvs] = useState<[number, number, number, number, number, number]>([
    31, 31, 31, 31, 31, 31,
  ]);
  const [maleItem, setMaleItem] = useState(2); // Destiny Knot
  const [femaleItem, setFemaleItem] = useState(1); // Everstone
  const [inheritAbility, setInheritAbility] = useState(0);
  const [genderRatioIdx, setGenderRatioIdx] = useState(1); // 0x7F 1:1
  const [masuda, setMasuda] = useState(true);
  const [homogeneous, setHomogeneous] = useState(true);
  const [nidoType, setNidoType] = useState(false);
  const [maleIsDitto, setMaleIsDitto] = useState(false);
  const [femaleIsDitto, setFemaleIsDitto] = useState(false);
  const [considerOtherTsv, setConsiderOtherTsv] = useState(false);
  const [shinyRemind, setShinyRemind] = useState(false);

  // Egg Calc search state
  const [eggMode, setEggMode] = useState<EggMode>('frame');
  const [eggStartFrame, setEggStartFrame] = useState(0);
  const [eggEndFrame, setEggEndFrame] = useState(2000);
  const [eggMin, setEggMin] = useState(1);
  const [eggMax, setEggMax] = useState(100);
  const [eggTargetFrame, setEggTargetFrame] = useState(100);

  // Main RNG Egg state
  const [mainMode, setMainMode] = useState<SearchMode>('normal');
  const [mainEndFrame, setMainEndFrame] = useState(50000);
  const [mainNpc, setMainNpc] = useState(4);
  const [mainDelay, setMainDelay] = useState(38);
  const [mainConsiderDelay, setMainConsiderDelay] = useState(true);
  const [mainTimeSpan, setMainTimeSpan] = useState(3600);

  // 127 Magikarp state
  const [karpBits, setKarpBits] = useState('');

  // Results & Filters
  const [filter, setFilter] = useState<RngFilterOptions>(() => createDefaultRngFilter());
  const [filterOpen, setFilterOpen] = useState(false);
  const [rows, setRows] = useState<FrameRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [instruction, setInstruction] = useState<EggSearchOutput['instruction']>();
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(() => new Set());
  const [selectedRow, setSelectedRow] = useState<FrameRow | null>(null);
  const [paramsCollapsed, setParamsCollapsed] = useState(false);
  const [resultInfo, setResultInfo] = useState({ summary: '', filterCount: 0, ignored: false });
  const [searchNonce, setSearchNonce] = useState(0);

  const { isRunning, progress, error, abort, runEggSearch, runMainSearch } = useSearchWorker();

  const parsedEggSeed = parseEggSeedStr(eggSeedText);
  const isZeroEggSeed = parsedEggSeed !== null && parsedEggSeed.every((v) => v === 0);
  const validEggSeed = parsedEggSeed !== null && !isZeroEggSeed ? parsedEggSeed : null;

  const isGenderlessOrMaleOnly = genderRatioIdx === 0 || genderRatioIdx === 6;
  const isFemaleOnly = genderRatioIdx === 7;
  const isOneToOne = genderRatioIdx === 1;

  const handleGenderRatioChange = (idx: number) => {
    setGenderRatioIdx(idx);
    if (idx === 0 || idx === 6) {
      setFemaleIsDitto(true);
      setMaleIsDitto(false);
      setHomogeneous(false);
      setNidoType(false);
    } else if (idx === 7) {
      setFemaleIsDitto(false);
      setHomogeneous(false);
      setNidoType(false);
    } else if (idx !== 1) {
      setNidoType(false);
    }
  };

  const buildEggConfig = (isMainRngEgg = false) => ({
    tsv: activeProfile.tsv,
    trv: activeProfile.trv,
    maleIvs,
    femaleIvs,
    maleItem,
    femaleItem,
    inheritAbility,
    genderRatioRaw: GENDER_RATIOS[genderRatioIdx] ?? 0x7f,
    shinyCharm: isMainRngEgg ? false : activeProfile.shinyCharm,
    masuda: isMainRngEgg ? false : masuda,
    nidoType: isOneToOne && nidoType,
    homogeneous:
      !isGenderlessOrMaleOnly &&
      !isFemaleOnly &&
      !(isOneToOne && nidoType) &&
      !maleIsDitto &&
      !femaleIsDitto &&
      homogeneous,
    femaleIsDitto: isGenderlessOrMaleOnly ? true : isFemaleOnly ? false : femaleIsDitto,
    considerOtherTsv,
    otherTsvs: activeProfile.otherTsvs,
  });

  const resetParents = () => {
    setMaleIvs([31, 31, 31, 31, 31, 31]);
    setFemaleIvs([31, 31, 31, 31, 31, 31]);
    setMaleItem(0);
    setFemaleItem(0);
    setInheritAbility(0);
    setGenderRatioIdx(1);
    setMasuda(false);
    setHomogeneous(false);
    setNidoType(false);
    setMaleIsDitto(false);
    setFemaleIsDitto(false);
    setConsiderOtherTsv(false);
  };

  const applyFastMode = () => {
    resetParents();
    setFemaleIvs([0, 0, 0, 0, 0, 0]);
    setMaleItem(2); // Destiny Knot
    setMasuda(true);
    setHomogeneous(true);
  };

  const executeEggSearch = async () => {
    if (!validEggSeed) return;
    try {
      const res = await runEggSearch({
        kind: 'egg',
        mode: eggMode,
        eggSeed: validEggSeed,
        config: buildEggConfig(false),
        startFrame: eggStartFrame,
        endFrame: eggEndFrame,
        eggMin,
        eggMax,
        targetFrame: eggTargetFrame,
        shinyRemind,
        filter,
      });
      setResultInfo({ summary: i18n.t(eggMode === 'frame' ? 'egg.modeFrame' : eggMode === 'list' ? 'egg.modeList' : 'egg.modeShortest'), filterCount: countActiveFilters(filter), ignored: filter.skip });
      setRows(res.rows);
      setTruncated(res.truncated);
      setCheckedSteps(new Set());
      setInstruction(res.instruction);
      setSearchNonce((n) => n + 1);
    } catch {
      // aborted
    }
  };

  const executeMainEggSearch = async () => {
    if (!validEggSeed) return;
    const reqFilter: RngFilterOptions = {
      ...filter,
      safeOnly: mainMode === 'normal' && mainNpc > 0 ? filter.safeOnly : false,
      blinkOnly: mainMode === 'normal' && mainNpc === 0 ? filter.blinkOnly : false,
    };
    try {
      const res = await runMainSearch({
        kind: 'mainEgg',
        seed: initialSeedNum,
        isUltra,
        startFrame,
        endFrame: mainEndFrame,
        targetFrame,
        npcCount: mainNpc,
        raining: false,
        considerDelay: mainMode === 'timeline' ? true : mainConsiderDelay,
        delayFrames: mainDelay,
        mode: mainMode,
        timeSpanSec: mainTimeSpan,
        isBoy: true,
        fidgetTimeline: false,
        xMenu: false,
        jumpFrame: 0,
        filter: reqFilter,
        eggSeed: validEggSeed,
        eggConfig: buildEggConfig(true),
        considerOtherTsv,
        otherTsvs: activeProfile.otherTsvs,
      });
      setInstruction(undefined);
      setResultInfo({ summary: `Main RNG Egg · ${i18n.t(mainMode === 'normal' ? 'search.modeNormal' : mainMode === 'timeline' ? 'search.modeTimeline' : 'search.modeAround')}`, filterCount: countActiveFilters(filter), ignored: filter.skip });
      setRows(res.rows);
      setTruncated(res.truncated);
      setSearchNonce((n) => n + 1);
    } catch {
      // aborted
    }
  };

  const karpResult =
    karpBits.length === 127 ? calcMagikarpSeed(karpBits) : null;

  const renderParentIvRow = (
    label: string,
    ivs: [number, number, number, number, number, number],
    setIvs: (next: [number, number, number, number, number, number]) => void,
    itemVal: number,
    setItem: (v: number) => void,
  ) => (
    <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-zinc-200">{label}</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setIvs([31, 31, 31, 31, 31, 31])}
            className="h-8 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-emerald-300 active:scale-95 transition"
          >
            6IV
          </button>
          <button
            type="button"
            onClick={() => setIvs([31, 0, 31, 31, 31, 31])}
            className="h-8 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300 active:scale-95 transition"
          >
            -Atk
          </button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1">
        {ivs.map((v, idx) => (
          <NumericInput
            key={idx}
            ariaLabel={`${label} IV ${idx + 1}`}
            min={0}
            max={31}
            value={v}
            onChange={(val) => {
              const next = [...ivs] as [number, number, number, number, number, number];
              next[idx] = val;
              setIvs(next);
            }}
            className="h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-center font-mono text-xs tabular-nums text-zinc-100"
          />
        ))}
      </div>

      <select
        value={itemVal}
        onChange={(e) => setItem(Number(e.target.value))}
        className="w-full h-9 rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 text-xs text-zinc-200"
      >
        {Array.from({ length: 9 }, (_, i) => (
          <option key={i} value={i}>
            {i18n.getItemName(i)}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="egg-page space-y-3 pb-6">
      {/* Sub-Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
        {(
          [
            { id: 'calc', label: i18n.t('egg.tabCalc') },
            { id: 'magikarp', label: i18n.t('egg.tabFinder') },
            { id: 'main', label: i18n.t('egg.tabMain') },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            aria-pressed={subTab === tab.id}
            className="choice-button min-h-10 rounded-xl text-xs font-semibold transition px-1.5"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'magikarp' ? (
        <div className="karp-workspace min-h-[calc(100dvh-13.5rem)] flex flex-col justify-between gap-3">
          <div className="space-y-3">
            <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-100">{i18n.t('egg.magikarpTitle')}</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-bold tabular-nums ${
                    karpBits.length === 127
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-zinc-800 text-amber-300'
                  }`}
                >
                  {karpBits.length}/127
                </span>
              </div>
              <p className="text-xs text-zinc-400">{i18n.t('egg.magikarpHint')}</p>

              {/* Bit preview */}
              <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 font-mono text-xs tracking-wider text-zinc-200 break-all min-h-20">
                {karpBits || '—'}
              </div>
            </div>

            {karpResult && (
              <div className="rounded-2xl bg-zinc-900/95 border border-emerald-500/50 p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="font-mono break-all">{karpResult.hex}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateActiveEggSeed(karpResult.state);
                    setEggSeedText(karpResult.hex);
                    setSubTab('calc');
                  }}
                  className="w-full h-11 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-bold active:scale-95 transition"
                >
                  {i18n.t('egg.magikarpApply')}
                </button>
              </div>
            )}
          </div>

          {/* Bottom-anchored Thumb Keypad */}
          <div className="sticky bottom-16 z-20 pt-2 pb-1 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent">
            <div className="rounded-2xl bg-zinc-900/95 border border-zinc-800 p-2.5 space-y-2 shadow-xl shadow-black/40">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={karpBits.length === 0}
                  onClick={() => setKarpBits((s) => s.slice(0, -1))}
                  className="h-11 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95 transition"
                >
                  <Delete className="w-4 h-4" />
                  <span>{i18n.t('seed.undo')}</span>
                </button>
                <button
                  type="button"
                  disabled={karpBits.length === 0}
                  onClick={() => setKarpBits('')}
                  className="h-11 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-semibold text-rose-300 flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-95 transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{i18n.t('seed.clear')}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={karpBits.length >= 127}
                  onClick={() => {
                    navigator.vibrate?.(10);
                    setKarpBits((s) => (s.length < 127 ? `${s}0` : s));
                  }}
                  className="h-20 rounded-2xl bg-zinc-800 border border-zinc-700 font-mono text-2xl font-bold text-sky-300 active:scale-95 active:bg-sky-500/20 disabled:opacity-40 transition"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={karpBits.length >= 127}
                  onClick={() => {
                    navigator.vibrate?.(10);
                    setKarpBits((s) => (s.length < 127 ? `${s}1` : s));
                  }}
                  className="h-20 rounded-2xl bg-zinc-800 border border-zinc-700 font-mono text-2xl font-bold text-amber-300 active:scale-95 active:bg-amber-500/20 disabled:opacity-40 transition"
                >
                  1
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <SearchWorkspace
        collapsed={paramsCollapsed}
        results={
          <>
            {instruction && (
                  <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/40 p-3 flex items-center justify-between text-xs text-emerald-200">
                    <span>
                      {i18n.t('egg.accept')}: <strong>{instruction.acceptedEggs}</strong> ·{' '}
                      {i18n.t('egg.reject')}: <strong>{instruction.rejectedSteps}</strong>
                    </span>
                    {instruction.isShortestPath && (
                      <span className="font-mono tabular-nums">
                        {checkedSteps.size}/{rows.length}
                      </span>
                    )}
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
                  checkedIndices={
                    instruction?.isShortestPath ? checkedSteps : undefined
                  }
                  onToggleCheck={
                    instruction?.isShortestPath
                      ? (idx) => {
                          setCheckedSteps((prev) => {
                            const next = new Set(prev);
                            if (next.has(idx)) next.delete(idx);
                            else next.add(idx);
                            return next;
                          });
                        }
                      : undefined
                  }
                  onSelectRow={setSelectedRow}
                  activeFiltersCount={resultInfo.filterCount}
                  filtersIgnored={resultInfo.ignored}
                  paramsCollapsed={paramsCollapsed}
                  onToggleParamsCollapsed={() => setParamsCollapsed((v) => !v)}
                  scrollNonce={searchNonce}
                  splitView
                  contextSummary={resultInfo.summary}
                />
          </>
        }
        actions={
          <SearchActionBar
                activeFilters={countActiveFilters(filter)}
                onOpenFilters={() => setFilterOpen(true)}
                isRunning={isRunning}
                progress={progress}
                onSearch={() =>
                  void (subTab === 'calc' ? executeEggSearch() : executeMainEggSearch())
                }
                onAbort={abort}
              />
        }
      >
          {/* Egg Seed & Parent Card */}
          <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-2.5">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400">
                  {i18n.t('egg.eggSeed')}
                </label>
                {validEggSeed && (
                  <button
                    type="button"
                    onClick={() => updateActiveEggSeed(validEggSeed)}
                    className="text-[11px] font-semibold text-amber-300"
                  >
                    {i18n.t('app.save')}
                  </button>
                )}
              </div>
              <input
                type="text"
                value={eggSeedText}
                onChange={(e) => setEggSeedText(e.target.value.toUpperCase())}
                placeholder="S3,S2,S1,S0"
                className={`w-full h-10 rounded-xl bg-zinc-950 border px-3 font-mono text-xs tabular-nums ${
                  validEggSeed
                    ? 'border-zinc-800 text-emerald-300'
                    : isZeroEggSeed
                      ? 'border-amber-500/70 text-amber-300'
                      : 'border-rose-500/70 text-rose-300'
                }`}
              />
              {isZeroEggSeed && (
                <p className="text-[11px] text-amber-300 leading-snug">
                  {i18n.t('egg.zeroSeedWarn')}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={resetParents}
                  className="h-8 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-medium text-zinc-300 flex items-center gap-1 active:scale-95 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{i18n.t('egg.resetParents')}</span>
                </button>
                <button
                  type="button"
                  onClick={applyFastMode}
                  className="h-8 px-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-[11px] font-semibold text-amber-200 flex items-center gap-1 active:scale-95 transition"
                >
                  <Zap className="w-3 h-3" />
                  <span>{i18n.t('egg.fastMode')}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {renderParentIvRow(
                i18n.t('egg.maleParent'),
                maleIvs,
                setMaleIvs,
                maleItem,
                setMaleItem,
              )}
              {renderParentIvRow(
                i18n.t('egg.femaleParent'),
                femaleIvs,
                setFemaleIvs,
                femaleItem,
                setFemaleItem,
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-400">
                  {i18n.t('egg.ability')}
                </label>
                <select
                  value={inheritAbility}
                  onChange={(e) => setInheritAbility(Number(e.target.value))}
                  className="w-full h-10 rounded-xl bg-zinc-950 border border-zinc-800 px-2.5 text-xs text-zinc-100"
                >
                  <option value={0}>1</option>
                  <option value={1}>2</option>
                  <option value={2}>H</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-zinc-400">
                  {i18n.t('egg.genderRatio')}
                </label>
                <select
                  value={genderRatioIdx}
                  onChange={(e) => handleGenderRatioChange(Number(e.target.value))}
                  className="w-full h-10 rounded-xl bg-zinc-950 border border-zinc-800 px-2.5 text-xs text-zinc-100"
                >
                  {GENDER_RATIOS.map((val, idx) => (
                    <option key={val} value={idx}>
                      {i18n.getGenderRatioLabel(idx)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                {
                  label: i18n.t('egg.masuda'),
                  checked: subTab === 'main' ? false : masuda,
                  disabled: subTab === 'main',
                  onToggle: () => setMasuda((v) => !v),
                },
                {
                  label: i18n.t('egg.sameSpecies'),
                  checked:
                    !isGenderlessOrMaleOnly &&
                    !isFemaleOnly &&
                    !(isOneToOne && nidoType) &&
                    !maleIsDitto &&
                    !femaleIsDitto &&
                    homogeneous,
                  disabled:
                    isGenderlessOrMaleOnly ||
                    isFemaleOnly ||
                    (isOneToOne && nidoType) ||
                    maleIsDitto ||
                    femaleIsDitto,
                  onToggle: () => setHomogeneous((v) => !v),
                },
                {
                  label: i18n.t('egg.maleDitto'),
                  checked: isGenderlessOrMaleOnly ? false : maleIsDitto,
                  disabled: isGenderlessOrMaleOnly,
                  onToggle: () => {
                    const next = !maleIsDitto;
                    setMaleIsDitto(next);
                    if (next) {
                      setFemaleIsDitto(false);
                      setHomogeneous(false);
                    }
                  },
                },
                {
                  label: i18n.t('egg.femaleDitto'),
                  checked: isGenderlessOrMaleOnly ? true : isFemaleOnly ? false : femaleIsDitto,
                  disabled: isGenderlessOrMaleOnly || isFemaleOnly,
                  onToggle: () => {
                    const next = !femaleIsDitto;
                    setFemaleIsDitto(next);
                    if (next) {
                      setMaleIsDitto(false);
                      setHomogeneous(false);
                    }
                  },
                },
                {
                  label: i18n.t('egg.nidoType'),
                  checked: isOneToOne && nidoType,
                  disabled: !isOneToOne,
                  onToggle: () => {
                    const next = !nidoType;
                    setNidoType(next);
                    if (next) setHomogeneous(false);
                  },
                },
                {
                  label: i18n.t('egg.otherTsv'),
                  checked: considerOtherTsv,
                  disabled: false,
                  onToggle: () => setConsiderOtherTsv((v) => !v),
                },
              ].map((flag) => (
                <button
                  key={flag.label}
                  type="button"
                  disabled={flag.disabled}
                  onClick={flag.onToggle}
                  className={`h-10 px-3 rounded-xl text-xs font-medium border transition disabled:opacity-40 ${
                    flag.checked
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                  }`}
                >
                  {flag.label}
                </button>
              ))}
            </div>
          </div>

          {subTab === 'calc' ? (
            <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                  {i18n.t('search.rngInfo')}
                </span>
                <div className="flex items-center gap-1.5">
                  {(countActiveFilters(filter) > 0 || filter.skip) && (
                    <button
                      type="button"
                      onClick={() => setFilter(createDefaultRngFilter())}
                      className="h-8 px-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-medium text-zinc-300 flex items-center gap-1 active:scale-95 transition"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{i18n.t('search.resetFilters')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEggStartFrame(getStartingFrame(isUltra, 3));
                      setEggEndFrame(50000);
                      setEggTargetFrame(5000);
                      setEggMin(1);
                      setEggMax(500);
                    }}
                    className="h-8 px-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-medium text-amber-300 flex items-center gap-1 active:scale-95 transition"
                    title={i18n.t('search.resetRng')}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>{i18n.t('search.resetRng')}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                {(
                  [
                    { id: 'frame', label: i18n.t('egg.modeFrame') },
                    { id: 'list', label: i18n.t('egg.modeList') },
                    { id: 'shortestPath', label: i18n.t('egg.modeShortest') },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setEggMode(m.id)}
                    aria-pressed={eggMode === m.id}
                    className="choice-button min-h-10 rounded-lg text-[11px] font-semibold px-1"
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {eggMode === 'frame' ? (
                <div className="grid grid-cols-2 gap-2">
                  <NumberStepper
                    label={i18n.t('search.startFrame')}
                    value={eggStartFrame}
                    min={0}
                    onChange={(v) => {
                      setEggStartFrame(v);
                      if (v > eggEndFrame) setEggEndFrame(v);
                    }}
                  />
                  <NumberStepper
                    label={i18n.t('search.endFrame')}
                    value={eggEndFrame}
                    min={eggStartFrame}
                    onChange={setEggEndFrame}
                  />
                </div>
              ) : eggMode === 'list' ? (
                <div className="grid grid-cols-2 gap-2">
                  <NumberStepper
                    label="Egg Min"
                    value={eggMin}
                    min={1}
                    onChange={(v) => {
                      setEggMin(v);
                      if (v > eggMax) setEggMax(v);
                    }}
                  />
                  <NumberStepper
                    label="Egg Max"
                    value={eggMax}
                    min={eggMin}
                    onChange={setEggMax}
                  />
                  <div className="col-span-2">
                    <NumberStepper
                      label={i18n.t('search.targetFrame')}
                      value={eggTargetFrame}
                      min={0}
                      onChange={setEggTargetFrame}
                    />
                  </div>
                </div>
              ) : (
                <NumberStepper
                  label={i18n.t('search.targetFrame')}
                  value={eggTargetFrame}
                  min={0}
                  onChange={setEggTargetFrame}
                />
              )}

              {eggMode === 'frame' && (activeProfile.shinyCharm || masuda) && (
                <label className="flex items-center justify-between px-3 h-9 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    {i18n.t('egg.shinyRemind')}
                  </span>
                  <input
                    type="checkbox"
                    checked={shinyRemind}
                    onChange={(e) => setShinyRemind(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                </label>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                  {i18n.t('search.rngInfo')}
                </span>
                <div className="flex items-center gap-1.5">
                  {(countActiveFilters(filter) > 0 || filter.skip) && (
                    <button
                      type="button"
                      onClick={() => setFilter(createDefaultRngFilter())}
                      className="h-8 px-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-medium text-zinc-300 flex items-center gap-1 active:scale-95 transition"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{i18n.t('search.resetFilters')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setStartFrame(getStartingFrame(isUltra, 0));
                      setMainEndFrame(50000);
                      setTargetFrame(5000);
                      setMainTimeSpan(3600);
                      setMainNpc(4);
                      setMainDelay(38);
                      setMainConsiderDelay(true);
                    }}
                    className="h-8 px-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-medium text-amber-300 flex items-center gap-1 active:scale-95 transition"
                    title={i18n.t('search.resetRng')}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>{i18n.t('search.resetRng')}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                {(
                  [
                    { id: 'normal', label: i18n.t('search.modeNormal') },
                    { id: 'timeline', label: i18n.t('search.modeTimeline') },
                    { id: 'aroundTarget', label: i18n.t('search.modeAround') },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMainMode(m.id)}
                    aria-pressed={mainMode === m.id}
                    className="choice-button min-h-10 rounded-lg text-[11px] font-semibold px-1"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumberStepper
                  label={
                    mainMode === 'timeline'
                      ? i18n.t('search.startingFrame')
                      : i18n.t('search.startFrame')
                  }
                  value={startFrame}
                  min={0}
                  onChange={(v) => {
                    setStartFrame(v);
                    if (v > mainEndFrame) setMainEndFrame(v);
                  }}
                />
                {mainMode === 'normal' ? (
                  <NumberStepper
                    label={i18n.t('search.endFrame')}
                    value={mainEndFrame}
                    min={startFrame}
                    onChange={setMainEndFrame}
                  />
                ) : mainMode === 'timeline' ? (
                  <NumberStepper
                    label={i18n.t('search.timeSpan')}
                    value={mainTimeSpan}
                    min={1}
                    onChange={setMainTimeSpan}
                  />
                ) : (
                  <NumberStepper
                    label={i18n.t('search.targetFrame')}
                    value={targetFrame}
                    min={100}
                    onChange={setTargetFrame}
                  />
                )}
              </div>
              {(mainMode === 'normal' || mainMode === 'timeline') && (
                <NumberStepper
                  label={i18n.t('search.targetFrame')}
                  value={targetFrame}
                  min={0}
                  onChange={setTargetFrame}
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <NumberStepper
                  label={i18n.t('search.npcCount')}
                  value={mainNpc}
                  min={0}
                  max={20}
                  onChange={setMainNpc}
                />
                <NumberStepper
                  label={i18n.t('search.delay')}
                  value={mainDelay}
                  min={0}
                  max={500}
                  disabled={mainMode !== 'timeline' && !mainConsiderDelay}
                  onChange={setMainDelay}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label
                  className={`flex items-center gap-2 px-3 h-10 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 ${
                    mainMode === 'timeline' ? 'opacity-60' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={mainMode === 'timeline' ? true : mainConsiderDelay}
                    disabled={mainMode === 'timeline'}
                    onChange={(e) => setMainConsiderDelay(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span>{i18n.t('search.considerDelay')}</span>
                </label>
                {mainMode === 'normal' && (
                  <label
                    className={`flex items-center gap-2 px-3 h-10 rounded-xl border text-xs transition ${
                      (mainNpc === 0 ? filter.blinkOnly : filter.safeOnly)
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-medium'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={mainNpc === 0 ? Boolean(filter.blinkOnly) : Boolean(filter.safeOnly)}
                      onChange={(e) =>
                        setFilter((prev) => ({
                          ...prev,
                          safeOnly: mainNpc > 0 ? e.target.checked : false,
                          blinkOnly: mainNpc === 0 ? e.target.checked : false,
                        }))
                      }
                      className="w-4 h-4 accent-emerald-500"
                    />
                    <span>
                      {mainNpc === 0 ? i18n.t('search.blinkOnly') : i18n.t('search.safeOnly')}
                    </span>
                  </label>
                )}
              </div>
            </div>
          )}
      </SearchWorkspace>
        </>
      )}

      <FilterBottomSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filter={filter}
        onChange={setFilter}
        mode="egg"
        showSafeBlink={subTab === 'main' && mainMode === 'normal'}
        npcCount={mainNpc}
        allowExactStats={false}
      />

      <FrameDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />
    </div>
  );
}
