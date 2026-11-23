import { SearchWorkspace } from '../components/layout/SearchWorkspace';
import { RotateCcw, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import stationarySmData from '../data/generated/stationary_sm.json';
import stationaryUsumData from '../data/generated/stationary_usum.json';
import { getFormeEntry, isUndiscoveredEggGroup3IV } from '../data/personalTable';
import type { StationaryCategory, StationaryTemplate } from '../data/types';
import { createDefaultRngFilter } from '../engine/core/filters';
import { getGenderRatio, getStartingFrame } from '../engine/core/pokemonMath';
import type { FrameRow, RngFilterOptions, SearchMode } from '../engine/core/types';
import type { MainSearchOutput } from '../engine/gen7/searches';
import { NumberStepper } from '../components/common/NumberStepper';
import { countActiveFilters, FilterBottomSheet } from '../components/filters/FilterBottomSheet';
import { FrameDetailModal } from '../components/results/FrameDetailModal';
import { SearchActionBar } from '../components/results/SearchActionBar';
import { VirtualFrameList } from '../components/results/VirtualFrameList';
import { useApp } from '../store/AppContext';
import { useSearchWorker } from '../workers/useSearchWorker';

const USUM_CATEGORIES = stationaryUsumData as StationaryCategory[];
const SM_CATEGORIES = stationarySmData as StationaryCategory[];

export function StationaryPage() {
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

  const CATEGORIES = isUltra ? USUM_CATEGORIES : SM_CATEGORIES;
  const [catIdx, setCatIdx] = useState(1); // Default Alola Legendary / Legendary
  const [tmplIdx, setTmplIdx] = useState(0);

  const filteredTemplates = useMemo(() => {
    const cat = CATEGORIES[catIdx] ?? CATEGORIES[0]!;
    return cat.list.filter(
      (t) => t.version === 'Gen7' || t.version === activeProfile.gameVersion,
    );
  }, [CATEGORIES, catIdx, activeProfile.gameVersion]);

  const activeTemplate: StationaryTemplate =
    filteredTemplates[tmplIdx] ?? filteredTemplates[0] ?? CATEGORIES[0]!.list[0]!;

  const [mode, setMode] = useState<SearchMode>('normal');
  const [endFrame, setEndFrame] = useState(50000);
  const [npcCount, setNpcCount] = useState(0);
  const [delayFrames, setDelayFrames] = useState(0);
  const [considerDelay, setConsiderDelay] = useState(true);
  const [raining, setRaining] = useState(false);
  const [syncNature, setSyncNature] = useState(255); // 255 = None, 0..24
  const [isForcedShiny, setIsForcedShiny] = useState(false);
  const [pelagoShift, setPelagoShift] = useState(0);

  // Conceptual overrides
  const [customAlwaysSync, setCustomAlwaysSync] = useState(false);
  const [customFix3v, setCustomFix3v] = useState(false);
  const [customShinyLocked, setCustomShinyLocked] = useState(false);
  const [customAbility, setCustomAbility] = useState(0);
  const [customGender, setCustomGender] = useState(0x7f);

  // Timeline & Leap options
  const [timeSpanSec, setTimeSpanSec] = useState(3600);
  const [isBoy, setIsBoy] = useState(true);
  const [fidgetTimeline, setFidgetTimeline] = useState(false);
  const [xMenu, setXMenu] = useState(false);
  const [jumpFrame, setJumpFrame] = useState(0);
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
  const [resultInfo, setResultInfo] = useState({ summary: '', filterCount: 0, ignored: false, species: 0, forme: 0 });
  const [searchNonce, setSearchNonce] = useState(0);

  const { isRunning, progress, error, abort, runMainSearch } = useSearchWorker();

  // Sync UI state when template changes
  useEffect(() => {
    const t = activeTemplate;
    setNpcCount(t.npc);
    setDelayFrames(t.delay);
    setRaining(t.raining);
    setIsForcedShiny(false);
    setPelagoShift(0);

    if (t.nature < 25) {
      setSyncNature(t.nature);
    } else if (!t.syncable) {
      setSyncNature(255);
    }

    const entry = getFormeEntry(t.species, t.forme);
    setCustomAlwaysSync(t.alwaysSync);
    setCustomFix3v((isUndiscoveredEggGroup3IV(t.species, t.forme) && !t.egg) || t.iv3);
    setCustomShinyLocked(t.shinyLocked);
    setCustomAbility(t.ability > 3 ? 0 : t.ability);
    setCustomGender(t.species === 0 ? 0x7f : entry.gender);

    setFilter((prev) => ({
      ...prev,
      baseStats: [...entry.stats] as [number, number, number, number, number, number],
    }));

    const isMenuMethod = t.conceptual || t.delayType > 0 || t.unstable;
    setLeapDelayMin(isMenuMethod ? 1 : 10);
    setLeapDelayMax(isMenuMethod ? 3 : 100);
    if (t.isPelago && mode === 'timelineLeap') {
      setMode('normal');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTemplate]);

  // Reset category/template indices when active game version changes
  useEffect(() => {
    setCatIdx(1);
    setTmplIdx(0);
  }, [activeProfile.gameVersion]);

  useEffect(() => {
    if (startFrame > endFrame) {
      setEndFrame(startFrame + 50000);
    }
  }, [startFrame, endFrame]);

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
    const isConceptual = activeTemplate.conceptual;
    const isMenuMethod =
      activeTemplate.conceptual || activeTemplate.delayType > 0 || activeTemplate.unstable;

    const reqFilter: RngFilterOptions = {
      ...filter,
      safeOnly: m === 'normal' && npcCount > 0 ? filter.safeOnly : false,
      blinkOnly: m === 'normal' && npcCount === 0 ? filter.blinkOnly : false,
    };

    try {
      const res = await runMainSearch({
        kind: 'stationary',
        seed: initialSeedNum,
        isUltra,
        startFrame: sf,
        endFrame,
        targetFrame: tgt,
        npcCount,
        raining: canRain && raining,
        considerDelay: m === 'timeline' ? true : considerDelay,
        delayFrames,
        mode: m,
        timeSpanSec,
        isBoy,
        fidgetTimeline,
        xMenu,
        jumpFrame,
        leapType: isMenuMethod ? 1 : 2,
        leapDelayMinSec: leapDelayMin,
        leapDelayMaxSec: leapDelayMax,
        leapView: lv,
        filter: reqFilter,
        config: {
          species: activeTemplate.species,
          forme: activeTemplate.forme,
          level: activeTemplate.level || 50,
          tsv: activeProfile.tsv,
          trv: activeProfile.trv,
          shinyCharm: activeProfile.shinyCharm,
          synchroStat: syncNature,
          assumeSynced: null,
          isForcedShiny: activeTemplate.ultraWormhole && isForcedShiny,
          pelagoShift,
          alwaysSync: isConceptual ? customAlwaysSync : activeTemplate.alwaysSync,
          iv3: isConceptual ? customFix3v : activeTemplate.iv3,
          isShinyLocked: isConceptual ? customShinyLocked : activeTemplate.shinyLocked,
          ability: isConceptual ? customAbility : activeTemplate.ability,
          genderSetting: customGender,
          randomGender: getGenderRatio(customGender) > 2 && customGender !== 0xff,
          template: isConceptual ? null : activeTemplate,
        },
      });
      const modeName = { normal: 'search.modeNormal', timeline: 'search.modeTimeline', aroundTarget: 'search.modeAround', timelineLeap: 'search.modeLeap' } as const;
      setResultInfo({
        summary: `${formatTemplateName(activeTemplate)} · ${i18n.t(modeName[m])}`,
        filterCount: countActiveFilters(filter), ignored: filter.skip,
        species: activeTemplate.species, forme: activeTemplate.forme,
      });
      setRows(res.rows);
      setTruncated(res.truncated);
      setLeapInfo(res.leapInfo);
      if (res.leapInfo) {
        setJumpFrame(res.leapInfo.frame0);
      }
      setSearchNonce((n) => n + 1);
    } catch {
      // Aborted or worker error
    }
  };

  // React to AroundTarget jump from Detail Modal
  useEffect(() => {
    if (aroundJump && aroundJump.tab === 'stationary') {
      setMode('aroundTarget');
      setTargetFrame(aroundJump.targetFrame);
      clearAroundJump();
      void executeSearch('aroundTarget', aroundJump.targetFrame);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aroundJump]);

  // React to 1-tap Timeline jump from Detail Modal
  useEffect(() => {
    if (timelineJump && timelineJump.tab === 'stationary') {
      const sf = timelineJump.startFrame;
      clearTimelineJump();
      setMode('timeline');
      setStartFrame(sf);
      setConsiderDelay(true);
      void executeSearch('timeline', undefined, undefined, sf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineJump]);

  const canRain = activeTemplate.raining || activeTemplate.conceptual;
  const showMenuMethod =
    activeTemplate.conceptual || activeTemplate.delayType > 0 || activeTemplate.unstable;

  const formatTemplateName = (t: StationaryTemplate) => {
    if (t.conceptual) return '-';
    let base = i18n.getSpeciesName(t.species);
    if (t.egg) base += ` (${i18n.getSpeciesName(0)})`;
    if (t.species === 25 && t.gift) base += t.otTsv === null ? ' (Surf)' : ' (Partner)';
    if (t.species === 132 && t.nature < 25) base += ` (${i18n.getNatureName(t.nature)})`;
    if (t.species === 718 && (t.forme === 1 || t.forme === 2)) base += '-10%';
    if (t.species === 718 && t.forme === 3) base += '-50%';
    if (t.delayType >= 21) base += ' [1st]';
    return base;
  };

  return (
    <>
      <SearchWorkspace
        collapsed={paramsCollapsed}
        results={
          <>
            {leapInfo && (
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

            {/* Results List */}
            <VirtualFrameList
              rows={rows}
              truncated={truncated}
              allowShowStats={resultInfo.species > 0}
              fallbackSpecies={resultInfo.species}
              fallbackForme={resultInfo.forme}
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
            onSearch={() => void executeSearch()}
            onAbort={abort}
          />
        }
      >
      {/* Target Picker Card */}
      <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-400">
              {i18n.t('stationary.category')}
            </label>
            <select
              value={catIdx}
              onChange={(e) => {
                setCatIdx(Number(e.target.value));
                setTmplIdx(0);
              }}
              className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-800 px-2.5 text-xs font-medium text-zinc-100 focus:outline-none focus:border-amber-500"
            >
              {CATEGORIES.map((c, idx) => (
                <option key={c.text} value={idx}>
                  {i18n.getCategoryName(c.text)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-400">
              {i18n.t('stationary.template')}
            </label>
            <select
              value={tmplIdx}
              onChange={(e) => setTmplIdx(Number(e.target.value))}
              className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-800 px-2.5 text-xs font-medium text-zinc-100 focus:outline-none focus:border-amber-500"
            >
              {filteredTemplates.map((t, idx) => (
                <option key={`${t.species}-${t.forme}-${t.delayType}-${idx}`} value={idx}>
                  {formatTemplateName(t)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300">
            Lv.{activeTemplate.level || 50}
          </span>
          {(activeTemplate.alwaysSync || !activeTemplate.syncable) && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[11px] font-medium">
              {activeTemplate.syncable && activeTemplate.nature > 25
                ? i18n.t('stationary.alwaysSync')
                : i18n.t('stationary.cannotSync')}
            </span>
          )}
          {customShinyLocked && (
            <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 text-[11px] font-medium">
              {i18n.t('stationary.shinyLocked')}
            </span>
          )}
          {customFix3v && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[11px] font-medium">
              {i18n.t('stationary.fix3v')}
            </span>
          )}
        </div>

        {/* Synchronize Lead */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-400">
            {i18n.t('stationary.syncNature')}
          </label>
          <select
            disabled={!activeTemplate.syncable || activeTemplate.nature < 25}
            value={syncNature}
            onChange={(e) => setSyncNature(Number(e.target.value))}
            className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-xs font-medium text-zinc-100 disabled:opacity-50"
          >
            <option value={255}>—</option>
            {Array.from({ length: 25 }, (_, i) => (
              <option key={i} value={i}>
                {i18n.getNatureName(i)}
              </option>
            ))}
          </select>
        </div>

        {activeTemplate.ultraWormhole && (
          <label className="flex items-center justify-between min-h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-xs font-medium text-amber-300">
              {i18n.t('stationary.forcedShiny')}
            </span>
            <input
              type="checkbox"
              checked={isForcedShiny}
              onChange={(e) => setIsForcedShiny(e.target.checked)}
              className="w-4 h-4 accent-amber-500"
            />
          </label>
        )}

        {activeTemplate.isPelago && (
          <NumberStepper
            label={i18n.t('stationary.pelagoShift')}
            value={pelagoShift}
            min={0}
            max={255}
            onChange={setPelagoShift}
          />
        )}

        {activeTemplate.conceptual && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setCustomAlwaysSync((v) => !v)}
                className={`h-9 rounded-xl text-[11px] font-medium border ${
                  customAlwaysSync
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                Always Sync
              </button>
              <button
                type="button"
                onClick={() => setCustomFix3v((v) => !v)}
                className={`h-9 rounded-xl text-[11px] font-medium border ${
                  customFix3v
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                3IVs
              </button>
              <button
                type="button"
                onClick={() => setCustomShinyLocked((v) => !v)}
                className={`h-9 rounded-xl text-[11px] font-medium border ${
                  customShinyLocked
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                Shiny Lock
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label={i18n.t('filters.ability')}
                value={customAbility}
                onChange={(e) => setCustomAbility(Number(e.target.value))}
                className="w-full h-9 rounded-xl bg-zinc-950 border border-zinc-800 px-2 text-xs text-zinc-100"
              >
                <option value={0}>{i18n.t('filters.ability')}: 1/2</option>
                <option value={1}>{i18n.t('filters.ability')}: 1</option>
                <option value={2}>{i18n.t('filters.ability')}: 2</option>
                <option value={3}>{i18n.t('filters.ability')}: H</option>
              </select>
              <select
                aria-label={i18n.t('filters.gender')}
                value={customGender}
                onChange={(e) => setCustomGender(Number(e.target.value))}
                className="w-full h-9 rounded-xl bg-zinc-950 border border-zinc-800 px-2 text-xs text-zinc-100"
              >
                {[
                  { v: 0xff, l: i18n.getGenderRatioLabel(0) },
                  { v: 0x7f, l: i18n.getGenderRatioLabel(1) },
                  { v: 0x1f, l: i18n.getGenderRatioLabel(2) },
                  { v: 0x3f, l: i18n.getGenderRatioLabel(3) },
                  { v: 0xbf, l: i18n.getGenderRatioLabel(4) },
                  { v: 0xe1, l: i18n.getGenderRatioLabel(5) },
                  { v: 0x00, l: i18n.getGenderRatioLabel(6) },
                  { v: 0xfe, l: i18n.getGenderRatioLabel(7) },
                ].map((opt) => (
                  <option key={opt.v} value={opt.v}>
                    {opt.l}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Search Mode & Parameters Card */}
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
                setStartFrame(getStartingFrame(isUltra, 0));
                setEndFrame(50000);
                setTargetFrame(5000);
                setTimeSpanSec(3600);
                setJumpFrame(0);
                setNpcCount(activeTemplate.npc);
                setDelayFrames(activeTemplate.delay);
                setRaining(activeTemplate.raining);
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

        <div
          className={`grid gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800 ${
            activeTemplate.isPelago ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'
          }`}
        >
          {(
            [
              { id: 'normal', label: i18n.t('search.modeNormal') },
              { id: 'timeline', label: i18n.t('search.modeTimeline') },
              { id: 'aroundTarget', label: i18n.t('search.modeAround') },
              ...(!activeTemplate.isPelago
                ? [{ id: 'timelineLeap' as const, label: i18n.t('search.modeLeap') }]
                : []),
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className="choice-button min-h-10 rounded-lg text-[11px] font-semibold px-1.5 transition"
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
              max={86400}
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

        {(mode === 'normal' || mode === 'timeline') && (
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
            value={npcCount}
            min={0}
            max={20}
            onChange={setNpcCount}
          />
          <NumberStepper
            label={i18n.t('search.delay')}
            value={delayFrames}
            min={-20}
            max={5000}
            step={2}
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
          <label
            className={`flex items-center gap-2 px-3 h-10 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 ${
              !canRain ? 'opacity-50' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={canRain ? raining : false}
              disabled={!canRain}
              onChange={(e) => setRaining(e.target.checked)}
              className="w-4 h-4 accent-amber-500"
            />
            <span>{i18n.t('search.raining')}</span>
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

        {(mode === 'timeline' || mode === 'timelineLeap') && showMenuMethod && (
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {mode === 'timeline' && (
                <>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={fidgetTimeline}
                      onChange={(e) => {
                        setFidgetTimeline(e.target.checked);
                        if (e.target.checked) setXMenu(false);
                      }}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span>{i18n.t('search.fidget')}</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-200">
                    <input
                      type="checkbox"
                      checked={xMenu}
                      onChange={(e) => {
                        setXMenu(e.target.checked);
                        if (e.target.checked) setFidgetTimeline(false);
                      }}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span>{i18n.t('search.xMenu')}</span>
                  </label>
                </>
              )}
              <div className="ml-auto flex gap-1">
                <button
                  type="button"
                  onClick={() => setIsBoy(true)}
                  className={`h-8 px-2.5 rounded-lg text-[11px] font-bold ${
                    isBoy ? 'bg-sky-500/20 text-sky-300' : 'text-zinc-400'
                  }`}
                >
                  {i18n.t('search.boy')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsBoy(false)}
                  className={`h-8 px-2.5 rounded-lg text-[11px] font-bold ${
                    !isBoy ? 'bg-pink-500/20 text-pink-300' : 'text-zinc-400'
                  }`}
                >
                  {i18n.t('search.girl')}
                </button>
              </div>
            </div>
            {mode === 'timeline' && (fidgetTimeline || xMenu) && (
              <NumberStepper
                label={i18n.t('search.jumpFrame')}
                value={jumpFrame}
                min={0}
                onChange={setJumpFrame}
              />
            )}
          </div>
        )}
      </div>
      </SearchWorkspace>

      {/* Filter Sheet */}
      <FilterBottomSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filter={filter}
        onChange={setFilter}
        mode="stationary"
        encounter={activeTemplate}
        syncNature={syncNature}
        showSafeBlink={mode === 'normal'}
        npcCount={npcCount}
      />

      {/* Detail Sheet */}
      <FrameDetailModal
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        fallbackSpecies={resultInfo.species}
        fallbackForme={resultInfo.forme}
        aroundTab="stationary"
      />
    </>
  );
}
