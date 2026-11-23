import { SearchWorkspace } from '../components/layout/SearchWorkspace';
import { RotateCcw, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import wildSmData from '../data/generated/wild_sm.json';
import wildData from '../data/generated/wild_usum.json';
import { getFormeEntry, isAlolanForm } from '../data/personalTable';
import type {
  CrabrawlerAreaUsum,
  FishingAreaUsum,
  MiscAreaUsum,
  WildAreaUsum,
  WildCategory,
  WildTemplateItem,
} from '../data/types';
import { createDefaultRngFilter } from '../engine/core/filters';
import { getStartingFrame } from '../engine/core/pokemonMath';
import type { FrameRow, RngFilterOptions, SearchMode } from '../engine/core/types';
import { getSosAllies, getWeatherAllies, type SosWeather } from '../engine/gen7/sosAllies';
import { SLOT_DISTRIBUTIONS } from '../engine/gen7/wild7';
import { parseHex32 } from '../engine/math/uint';
import { HexSeedInput } from '../components/common/HexSeedInput';
import { NumberStepper } from '../components/common/NumberStepper';
import { countActiveFilters, FilterBottomSheet } from '../components/filters/FilterBottomSheet';
import { FrameDetailModal } from '../components/results/FrameDetailModal';
import { SearchActionBar } from '../components/results/SearchActionBar';
import { VirtualFrameList } from '../components/results/VirtualFrameList';
import { useApp } from '../store/AppContext';
import { useSearchWorker } from '../workers/useSearchWorker';

const WILD_CATS_USUM = wildData.wildCategories as WildCategory[];
const WILD_CATS_SM = wildSmData.wildCategories as WildCategory[];
const USUM_AREAS = wildData.usumAreas as WildAreaUsum[];
const SM_AREAS = wildSmData.smAreas as WildAreaUsum[];
const FISHING_AREAS_USUM = wildData.fishingAreas as FishingAreaUsum[];
const FISHING_AREAS_SM = wildSmData.fishingAreas as FishingAreaUsum[];
const MISC_AREAS_USUM = wildData.miscAreas as MiscAreaUsum[];
const MISC_AREAS_SM = wildSmData.miscAreas as MiscAreaUsum[];
const CRABRAWLER_AREAS_USUM = wildData.crabrawlerAreas as CrabrawlerAreaUsum[];
const CRABRAWLER_AREAS_SM = wildSmData.crabrawlerAreas as CrabrawlerAreaUsum[];
const DAY2NIGHT_USUM = wildData.day2NightUSUM as Record<string, number>;
const SUN2MOON_USUM = wildData.sun2MoonUSUM as Record<string, number>;
const DAY2NIGHT_SM = wildSmData.day2NightSM as Record<string, number>;
const SUN2MOON_SM = wildSmData.sun2MoonSM as Record<string, number>;
const MISC_DAY2NIGHT = wildData.miscDay2Night as Record<string, number>;
const MISC_ULTRA_DAY2NIGHT = wildData.miscUltraDay2Night as Record<string, number>;
const MISC_SUN2MOON = wildData.miscSun2Moon as Record<string, number>;

const SPECIAL_SLOT_STRINGS = ['WT', 'UB', 'QR', '', '', ''] as const;

type AreaUnion =
  | { kind: 'normal'; area: WildAreaUsum }
  | { kind: 'fishing'; area: FishingAreaUsum }
  | { kind: 'misc'; area: MiscAreaUsum }
  | { kind: 'crabrawler'; area: CrabrawlerAreaUsum };

function computeAreaSpecies(
  area: WildAreaUsum,
  isMoon: boolean,
  isNight: boolean,
  isUltra: boolean,
): number[] {
  const day2Night = isUltra ? DAY2NIGHT_USUM : DAY2NIGHT_SM;
  const sun2Moon = isUltra ? SUN2MOON_USUM : SUN2MOON_SM;
  const effNight = isNight !== area.reverse;
  const effMoon = isMoon !== area.reverse;
  const table = [...area.species];
  for (let i = 1; i < table.length; i++) {
    let s = table[i]!;
    if (effNight) {
      s = day2Night[String(s)] ?? s;
    }
    if (effMoon) {
      s = sun2Moon[String(s)] ?? s;
    }
    if (isAlolanForm(s)) {
      s += 2048;
    }
    if (isUltra && effNight) {
      if (s === 173) {
        s = i === 6 ? 774 : i === 4 ? 605 : 22;
      }
      if (s === 174) {
        s = i === 7 ? 731 : 506;
      }
      if (area.location === 90 && table[0] === 44) {
        if (i === 2) s = 163;
      }
    }
    table[i] = s;
  }
  return table;
}

function computeMiscSpecies(
  area: MiscAreaUsum,
  isMoon: boolean,
  isNight: boolean,
  isUltra: boolean,
): number[] {
  return area.species.map((raw) => {
    let s = raw;
    if (isNight) {
      s = MISC_DAY2NIGHT[String(s)] ?? s;
      if (isUltra) {
        s = MISC_ULTRA_DAY2NIGHT[String(s)] ?? s;
      }
    }
    if (isMoon) {
      s = MISC_SUN2MOON[String(s)] ?? s;
    }
    if (isAlolanForm(s)) {
      s += 2048;
    }
    return s;
  });
}

export function WildPage() {
  const {
    i18n,
    activeProfile,
    isUltra,
    isMoon,
    initialSeedHex,
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

  const WILD_CATS = isUltra ? WILD_CATS_USUM : WILD_CATS_SM;
  const NORMAL_AREAS = isUltra ? USUM_AREAS : SM_AREAS;
  const FISHING_AREAS = isUltra ? FISHING_AREAS_USUM : FISHING_AREAS_SM;
  const MISC_AREAS = isUltra ? MISC_AREAS_USUM : MISC_AREAS_SM;
  const CRABRAWLER_AREAS = isUltra ? CRABRAWLER_AREAS_USUM : CRABRAWLER_AREAS_SM;

  const [catIdx, setCatIdx] = useState(0); // 0=Normal, 1=UB, 2=Island Scan, 3=Fishing, 4=Ambush, 5=Berry Tree
  const [tmplIdx, setTmplIdx] = useState(0);
  const [locIdx, setLocIdx] = useState(0);
  const [targetSpeciesIdx, setTargetSpeciesIdx] = useState(0); // 0 = All

  const [isNight, setIsNight] = useState(false);
  const [bubbling, setBubbling] = useState(false);
  const [leadAbility, setLeadAbility] = useState(0);
  const [syncNature, setSyncNature] = useState(255);
  const [specialRate, setSpecialRate] = useState(0);

  const [mode, setMode] = useState<SearchMode>('normal');
  const [endFrame, setEndFrame] = useState(50000);
  const [npcCount, setNpcCount] = useState(0);
  const [correction, setCorrection] = useState(1);
  const [delayFrames, setDelayFrames] = useState(8);
  const [considerDelay, setConsiderDelay] = useState(true);
  const [raining, setRaining] = useState(false);
  const [triggerMethod, setTriggerMethod] = useState(0); // 0=Honey/Simple, 1=Step, 2=Menu
  const [delay2Frames, setDelay2Frames] = useState(90);

  // Fishing & Timeline
  const [fishyTimeline, setFishyTimeline] = useState(true);
  const [fishyOverview, setFishyOverview] = useState(false);
  const [biteDelay, setBiteDelay] = useState(78);
  const [timeSpanSec, setTimeSpanSec] = useState(3600);

  // SOS RNG
  const [sos, setSos] = useState(false);
  const [sosWeather, setSosWeather] = useState<SosWeather>(0);
  const [sosAllyIdx, setSosAllyIdx] = useState(0);
  const [sosChainLength, setSosChainLength] = useState(0);
  const [sosSeedHex, setSosSeedHex] = useState(initialSeedHex);
  const [sosFrame, setSosFrame] = useState(100);

  const [filter, setFilter] = useState<RngFilterOptions>(() => createDefaultRngFilter());
  const [filterOpen, setFilterOpen] = useState(false);
  const [rows, setRows] = useState<FrameRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [selectedRow, setSelectedRow] = useState<FrameRow | null>(null);
  const [paramsCollapsed, setParamsCollapsed] = useState(false);
  const [resultInfo, setResultInfo] = useState({ summary: '', filterCount: 0, ignored: false });
  const [searchNonce, setSearchNonce] = useState(0);

  const { isRunning, progress, error, abort, runMainSearch } = useSearchWorker();

  const templates = useMemo(() => {
    const cat = WILD_CATS[catIdx] ?? WILD_CATS[0]!;
    return cat.list.filter(
      (t) => t.version === 'Gen7' || t.version === activeProfile.gameVersion,
    );
  }, [WILD_CATS, catIdx, activeProfile.gameVersion]);

  const activeTemplate: WildTemplateItem =
    templates[tmplIdx] ?? templates[0] ?? WILD_CATS[0]!.list[0]!;

  // Locations list for selected category/template
  const locationEntries = useMemo<AreaUnion[]>(() => {
    if (catIdx === 3) {
      return FISHING_AREAS.map((area) => ({ kind: 'fishing', area }));
    }
    if (catIdx === 4) {
      return MISC_AREAS.map((area) => ({ kind: 'misc', area }));
    }
    if (catIdx === 5) {
      return CRABRAWLER_AREAS.map((area) => ({ kind: 'crabrawler', area }));
    }
    const nonSep = NORMAL_AREAS.filter((a) => !a.isSeparator);
    if (!activeTemplate.conceptual && activeTemplate.location) {
      const matched = activeTemplate.location
        .map((locId) => nonSep.find((a) => a.locationIdx === locId))
        .filter((a): a is WildAreaUsum => a !== undefined);
      if (matched.length > 0) {
        return matched.map((area) => ({ kind: 'normal', area }));
      }
    }
    return nonSep.map((area) => ({ kind: 'normal', area }));
  }, [catIdx, activeTemplate, FISHING_AREAS, MISC_AREAS, CRABRAWLER_AREAS, NORMAL_AREAS]);

  const activeLocEntry = locationEntries[locIdx] ?? locationEntries[0]!;

  // Update defaults on category/template change
  useEffect(() => {
    setLocIdx(0);
    setTargetSpeciesIdx(0);
    setSosAllyIdx(0);
    if (catIdx === 1 || catIdx === 2) {
      setSos(false);
      const rate = activeTemplate.rate?.[0] ?? (catIdx === 1 ? 80 : 50);
      setSpecialRate(rate);
    } else if (catIdx === 3) {
      setSpecialRate(80);
      setFishyTimeline(true);
    } else {
      setSpecialRate(0);
    }
    setDelayFrames(activeTemplate.delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catIdx, activeTemplate]);

  // Update location-specific defaults
  useEffect(() => {
    setTargetSpeciesIdx(0);
    setSosWeather(0);
    setSosAllyIdx(0);
    if (activeLocEntry.kind === 'normal') {
      const a = activeLocEntry.area;
      setNpcCount(a.npc);
      setCorrection(a.correction);
      setRaining(a.raining);
      if (catIdx === 1 && !activeTemplate.conceptual && activeTemplate.rate) {
        setSpecialRate(activeTemplate.rate[locIdx] ?? activeTemplate.rate[0] ?? 80);
      }
    } else if (activeLocEntry.kind === 'fishing') {
      const f = activeLocEntry.area;
      setNpcCount(f.npc);
      setRaining(false);
      setBiteDelay(f.longdelay ? (isUltra ? 89 : 97) : 78);
      setDelayFrames(f.lapras ? 0 : -2);
    } else if (activeLocEntry.kind === 'misc') {
      const m = activeLocEntry.area;
      setNpcCount(m.npc);
      setRaining(false);
      setDelayFrames(m.delay1);
      setDelay2Frames(m.delay2);
      setTriggerMethod(0);
    } else {
      const c = activeLocEntry.area;
      setNpcCount(c.npc);
      setRaining(c.raining);
    }
  }, [activeLocEntry, catIdx, activeTemplate, locIdx]);

  const slotSpeciesList = useMemo(() => {
    if (activeLocEntry.kind === 'normal') {
      return computeAreaSpecies(activeLocEntry.area, isMoon, isNight, isUltra);
    }
    if (activeLocEntry.kind === 'fishing') {
      return [...activeLocEntry.area.species];
    }
    if (activeLocEntry.kind === 'misc') {
      return computeMiscSpecies(activeLocEntry.area, isMoon, isNight, isUltra);
    }
    return [739];
  }, [activeLocEntry, isMoon, isNight, isUltra]);

  const distinctSpecies = useMemo(() => {
    const raw = catIdx < 3 ? slotSpeciesList.slice(1) : slotSpeciesList;
    const seen = new Set<number>();
    const out: number[] = [];
    for (const sf of raw) {
      if (sf > 0 && !seen.has(sf)) {
        seen.add(sf);
        out.push(sf);
      }
    }
    return out;
  }, [catIdx, slotSpeciesList]);

  const sosAvailable = catIdx === 0 || catIdx >= 3;
  const isSos = sos && sosAvailable;

  const callerSf =
    targetSpeciesIdx > 0 ? (distinctSpecies[targetSpeciesIdx - 1] ?? 0) : (distinctSpecies[0] ?? 0);

  const sosSlots = useMemo(
    () =>
      isSos
        ? getSosAllies(activeLocEntry.area.locationIdx, callerSf, isMoon, isNight, isUltra)
        : [],
    [isSos, activeLocEntry.area.locationIdx, callerSf, isMoon, isNight, isUltra],
  );

  const weatherSlots = useMemo<[number, number]>(
    () =>
      isSos
        ? getWeatherAllies(activeLocEntry.area.locationIdx, sosWeather, isNight, isUltra)
        : [0, 0],
    [isSos, activeLocEntry.area.locationIdx, sosWeather, isNight, isUltra],
  );

  const distinctSosAllies = useMemo(() => {
    const chanceList = [...(SLOT_DISTRIBUTIONS[39] ?? []), 1, 10];
    const hasWeather = weatherSlots.some((s) => s !== 0);
    const combined = [...sosSlots, ...(hasWeather ? weatherSlots : [])];
    const out: { sf: number; pct: number }[] = [];
    const seen = new Map<number, number>();
    combined.forEach((sf, idx) => {
      if (sf <= 0) return;
      const pct = chanceList[idx] ?? 0;
      const existing = seen.get(sf);
      if (existing !== undefined) {
        out[existing]!.pct += pct;
      } else {
        seen.set(sf, out.length);
        out.push({ sf, pct });
      }
    });
    return out;
  }, [sosSlots, weatherSlots]);

  const selectedEncounter = isSos
    ? distinctSosAllies[sosAllyIdx - 1]?.sf
    : distinctSpecies[targetSpeciesIdx - 1];

  useEffect(() => {
    setSosAllyIdx(0);
  }, [callerSf, sosWeather, isNight, isSos]);

  // Auto-mark slots + baseStats when selecting target species or SOS ally
  useEffect(() => {
    const nextSlots = new Array<boolean>(11).fill(false);

    if (isSos) {
      const selectedAllySf =
        sosAllyIdx > 0 ? (distinctSosAllies[sosAllyIdx - 1]?.sf ?? 0) : 0;
      const hasWeather = weatherSlots.some((s) => s !== 0);
      const fullSlots = [...sosSlots, ...(hasWeather ? weatherSlots : [])];
      if (selectedAllySf > 0) {
        for (let i = 0; i < fullSlots.length; i++) {
          if (fullSlots[i] === selectedAllySf) {
            nextSlots[i + 1] = true;
          }
        }
      }
      const baseSf = selectedAllySf > 0 ? selectedAllySf : (distinctSosAllies[0]?.sf ?? callerSf);
      const entry = getFormeEntry(baseSf & 0x7ff, baseSf >>> 11);
      setFilter((prev) => ({
        ...prev,
        slots: nextSlots,
        baseStats: [...entry.stats] as [number, number, number, number, number, number],
      }));
      return;
    }

    const sf = targetSpeciesIdx > 0 ? (distinctSpecies[targetSpeciesIdx - 1] ?? 0) : 0;

    if (sf > 0) {
      if (catIdx < 3 && activeLocEntry.kind === 'normal') {
        const slotType = wildData.slotTypes[slotSpeciesList[0] ?? 0] ?? [];
        for (let i = 0; i < 10; i++) {
          if (slotSpeciesList[slotType[i]!] === sf) {
            nextSlots[i + 1] = true;
          }
        }
      } else {
        for (let i = 0; i < slotSpeciesList.length; i++) {
          if (slotSpeciesList[i] === sf) {
            nextSlots[i + 1] = true;
          }
        }
      }
    }

    const baseSf = sf > 0 ? sf : activeTemplate.species;
    const entry = getFormeEntry(baseSf & 0x7ff, baseSf >>> 11);
    setFilter((prev) => ({
      ...prev,
      slots: nextSlots,
      baseStats: [...entry.stats] as [number, number, number, number, number, number],
    }));
  }, [
    isSos,
    sosAllyIdx,
    distinctSosAllies,
    sosSlots,
    weatherSlots,
    callerSf,
    targetSpeciesIdx,
    distinctSpecies,
    catIdx,
    activeLocEntry,
    slotSpeciesList,
    activeTemplate.species,
  ]);

  useEffect(() => {
    if (mode === 'timeline') {
      setConsiderDelay(true);
    }
  }, [mode]);

  const executeSearch = async (
    overrideMode?: SearchMode,
    overrideTarget?: number,
    overrideStartFrame?: number,
  ) => {
    const m = overrideMode ?? mode;
    const sf = overrideStartFrame ?? startFrame;
    const tgt = overrideTarget ?? targetFrame;

    let specForm: number[] = [];
    let slotSplitter: readonly number[] = SLOT_DISTRIBUTIONS[0]!;
    let levelMin = 1;
    let levelMax = 5;
    let wildDelayType = 0;
    let wildCry = false;
    let inlineDelayType = 0;
    let inlineDelayTime = 0;
    let modifiedLevel = 0;
    let hookedItemSlot: [number, number] = [50, 80];

    if (activeLocEntry.kind === 'normal') {
      const a = activeLocEntry.area;
      wildDelayType = 0;
      specForm = new Array<number>(11).fill(0);
      const slottype = wildData.slotTypes[slotSpeciesList[0] ?? 0] ?? [];
      for (let i = 1; i < 11; i++) {
        specForm[i] = slotSpeciesList[slottype[i - 1]!] ?? 0;
      }
      if (specialRate > 0) {
        specForm[0] = activeTemplate.species;
      }
      slotSplitter = SLOT_DISTRIBUTIONS[a.locationIdx === 1190 ? 1 : 0]!;
      levelMin = a.levelMin + (isMoon && a.lvldiff !== 0 ? a.lvldiff : 0);
      levelMax = a.levelMax + (isMoon && a.lvldiff !== 0 ? a.lvldiff : 0);
    } else if (activeLocEntry.kind === 'fishing') {
      const f = activeLocEntry.area;
      wildDelayType = considerDelay && m !== 'timeline' && fishyOverview ? 2 : 1;
      specForm = [0, ...slotSpeciesList];
      slotSplitter = SLOT_DISTRIBUTIONS[f.slotType + (bubbling ? 1 : 0)]!;
      levelMin = f.levelMin;
      levelMax = f.levelMax + (bubbling && isUltra ? 5 : 0);
      const island = Math.trunc(f.location / 50);
      const idx = island + (bubbling && isUltra ? 4 : 0);
      const fItems = wildData.fishingItemSlots;
      const p0 = fItems[idx * 3] ?? 50;
      const p1 = fItems[idx * 3 + 1] ?? 30;
      hookedItemSlot = [p0, p0 + p1];
    } else if (activeLocEntry.kind === 'misc') {
      const misc = activeLocEntry.area;
      wildDelayType =
        misc.delayType1 === 1 && triggerMethod > 0 ? triggerMethod + 2 : misc.delayType1;
      wildCry = misc.cry;
      inlineDelayType = misc.delayType2;
      inlineDelayTime = Math.trunc(delay2Frames / 2);
      specForm = [0, ...slotSpeciesList];
      slotSplitter = SLOT_DISTRIBUTIONS[misc.slotType]!;
      levelMin = misc.levelMin;
      levelMax = misc.levelMax;
    } else {
      const c = activeLocEntry.area;
      wildDelayType = 1;
      specForm = [0, 739];
      slotSplitter = SLOT_DISTRIBUTIONS[42]!;
      levelMin = c.levelMin;
      levelMax = c.scriptedLevel;
      modifiedLevel = c.scriptedLevel;
    }

    const hasSosWeather = isSos && weatherSlots.some((s) => s !== 0);
    if (isSos) {
      wildDelayType = 1;
      specForm = [0, ...sosSlots, ...(hasSosWeather ? weatherSlots : [0, 0])];
      slotSplitter = SLOT_DISTRIBUTIONS[39]!;
      wildCry = false;
      inlineDelayType = 0;
      inlineDelayTime = 0;
      modifiedLevel = 0;
    }

    const reqFilter: RngFilterOptions = {
      ...filter,
      safeOnly: m === 'normal' && npcCount > 0 ? filter.safeOnly : false,
      blinkOnly: m === 'normal' && npcCount === 0 ? filter.blinkOnly : false,
    };

    try {
      const res = await runMainSearch({
        kind: 'wild',
        seed: initialSeedNum,
        isUltra,
        startFrame: sf,
        endFrame,
        targetFrame: tgt,
        npcCount,
        raining: isSos ? false : raining,
        considerDelay: m === 'timeline' ? true : considerDelay,
        delayFrames,
        mode: m,
        timeSpanSec,
        isBoy: true,
        fidgetTimeline: false,
        xMenu: false,
        jumpFrame: 0,
        filter: reqFilter,
        wildDelayType,
        wildCry,
        preHoneyCorrection: correction,
        fishingSetting: {
          basedelay: biteDelay,
          suctioncups: leadAbility === 7,
          platdelay: bubbling ? 19 : 14,
          pkmdelay: Math.trunc((delayFrames + 4) / 2),
        },
        fishyTimeline: !isSos && catIdx === 3 && fishyTimeline && m === 'timeline',
        fishyOverview,
        specialSlotStr: isSos ? '' : (SPECIAL_SLOT_STRINGS[catIdx] ?? ''),
        config: {
          tsv: activeProfile.tsv,
          trv: activeProfile.trv,
          shinyCharm: activeProfile.shinyCharm,
          synchroStat: syncNature,
          lead: leadAbility,
          levelMin,
          levelMax,
          specialLevel: activeTemplate.level || 60,
          specialEnctr: isSos ? 0 : catIdx === 3 ? specialRate : catIdx < 3 ? specialRate : 0,
          ub: !isSos && catIdx === 1,
          fishing: !isSos && catIdx === 3,
          crabrawler: !isSos && catIdx === 5,
          sos: isSos,
          sosSeed: isSos ? (parseHex32(sosSeedHex) ?? initialSeedNum) : undefined,
          sosFrame: isSos ? sosFrame : undefined,
          sosChainLength: isSos ? sosChainLength : undefined,
          sosWeather: hasSosWeather,
          modifiedLevel,
          delayType: inlineDelayType,
          delayTime: inlineDelayTime,
          specForm,
          slotSplitter,
          hookedItemSlot,
        },
      });
      const modeLabel = m === 'normal' ? 'search.modeNormal' : m === 'timeline' ? 'search.modeTimeline' : 'search.modeAround';
      setResultInfo({
        summary: `${wildContextSummary} · ${i18n.t(modeLabel)}`,
        filterCount: countActiveFilters(filter),
        ignored: filter.skip,
      });
      setRows(res.rows);
      setTruncated(res.truncated);
      setSearchNonce((n) => n + 1);
    } catch {
      // aborted
    }
  };

  useEffect(() => {
    if (aroundJump && aroundJump.tab === 'wild') {
      const target = aroundJump.targetFrame;
      clearAroundJump();
      setMode('aroundTarget');
      setTargetFrame(target);
      void executeSearch('aroundTarget', target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aroundJump]);

  useEffect(() => {
    if (timelineJump && timelineJump.tab === 'wild') {
      const sf = timelineJump.startFrame;
      clearTimelineJump();
      setMode('timeline');
      setStartFrame(sf);
      setConsiderDelay(true);
      void executeSearch('timeline', undefined, sf);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineJump]);

  const wildContextSummary = useMemo(() => {
    const locName = i18n.getLocationName(activeLocEntry.area.locationIdx, activeLocEntry.area.mark);
    if (isSos && callerSf > 0) {
      return `SOS · ${locName} · ${i18n.getSpeciesName(callerSf & 0x7ff)}`;
    }
    if (!activeTemplate.conceptual && activeTemplate.species > 0) {
      return `${locName} · ${i18n.getSpeciesName(activeTemplate.species)}`;
    }
    if (targetSpeciesIdx > 0 && distinctSpecies[targetSpeciesIdx - 1]) {
      return `${locName} · ${i18n.getSpeciesName(distinctSpecies[targetSpeciesIdx - 1]! & 0x7ff)}`;
    }
    const catName = i18n.getCategoryName((WILD_CATS[catIdx] ?? WILD_CATS[0]!).text);
    return `${locName} · ${catName}`;
  }, [i18n, activeLocEntry, isSos, callerSf, activeTemplate, targetSpeciesIdx, distinctSpecies, WILD_CATS, catIdx]);

  return (
    <>
      <SearchWorkspace
        collapsed={paramsCollapsed}
        results={
          <VirtualFrameList
            rows={rows}
            truncated={truncated}
            showSpecies
            allowShowStats
            onSelectRow={setSelectedRow}
            activeFiltersCount={resultInfo.filterCount}
            filtersIgnored={resultInfo.ignored}
            paramsCollapsed={paramsCollapsed}
            onToggleParamsCollapsed={() => setParamsCollapsed((v) => !v)}
            scrollNonce={searchNonce}
            contextSummary={resultInfo.summary}
            splitView
          />
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
      {/* Category & Location Card */}
      <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-400">
              {i18n.t('wild.category')}
            </label>
            <select
              value={catIdx}
              onChange={(e) => {
                setCatIdx(Number(e.target.value));
                setTmplIdx(0);
              }}
              className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-800 px-2.5 text-xs font-medium text-zinc-100"
            >
              {WILD_CATS.map((c, idx) => (
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
              disabled={templates.length <= 1}
              value={tmplIdx}
              onChange={(e) => setTmplIdx(Number(e.target.value))}
              className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-800 px-2.5 text-xs font-medium text-zinc-100 disabled:opacity-50"
            >
              {templates.map((t, idx) => (
                <option key={`${t.species}-${idx}`} value={idx}>
                  {t.conceptual ? '-' : i18n.getSpeciesName(t.species)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Location Picker */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-400">
            {i18n.t('wild.location')}
          </label>
          <select
            value={locIdx}
            onChange={(e) => setLocIdx(Number(e.target.value))}
            className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-xs font-medium text-zinc-100"
          >
            {locationEntries.map((entry, idx) => (
              <option key={`${entry.area.locationIdx}-${idx}`} value={idx}>
                {i18n.getLocationName(entry.area.locationIdx, entry.area.mark)}
              </option>
            ))}
          </select>
        </div>

        {/* Species Slot / Caller Shortcut */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-400">
            {isSos ? i18n.t('wild.caller') : i18n.t('wild.species')}
          </label>
          <select
            value={targetSpeciesIdx}
            onChange={(e) => setTargetSpeciesIdx(Number(e.target.value))}
            className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-xs font-medium text-zinc-100"
          >
            <option value={0}>
              {isSos && distinctSpecies[0]
                ? `— (${i18n.getSpeciesName(distinctSpecies[0] & 0x7ff)})`
                : `— (${i18n.t('filters.presetAny')})`}
            </option>
            {distinctSpecies.map((sf, idx) => (
              <option key={`${sf}-${idx}`} value={idx + 1}>
                {i18n.getSpeciesName(sf & 0x7ff)}
              </option>
            ))}
          </select>
        </div>

        {/* Lead Ability & Sync Nature */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-400">
              {i18n.t('wild.leadAbility')}
            </label>
            <select
              value={leadAbility}
              onChange={(e) => {
                const nextLead = Number(e.target.value);
                setLeadAbility(nextLead);
                if (nextLead !== 0 && nextLead !== 1) {
                  setSyncNature(255);
                }
              }}
              className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-800 px-2.5 text-xs font-medium text-zinc-100"
            >
              {Array.from({ length: 11 }, (_, idx) => (
                <option key={idx} value={idx}>
                  {i18n.getLeadAbilityName(idx)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-400">
              {i18n.t('stationary.syncNature')}
            </label>
            <select
              value={syncNature}
              onChange={(e) => {
                const nextSync = Number(e.target.value);
                setSyncNature(nextSync);
                if (nextSync < 25) {
                  setLeadAbility(1);
                } else if (leadAbility === 1) {
                  setLeadAbility(0);
                }
              }}
              className="w-full h-11 rounded-xl bg-zinc-950 border border-zinc-800 px-2.5 text-xs font-medium text-zinc-100"
            >
              <option value={255}>—</option>
              {Array.from({ length: 25 }, (_, i) => (
                <option key={i} value={i}>
                  {i18n.getNatureName(i)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Contextual Toggles (Night / SOS / Bubbling / Special Rate / Ambush Method) */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 px-3 h-10 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200">
            <input
              type="checkbox"
              checked={isNight}
              onChange={(e) => setIsNight(e.target.checked)}
              className="w-4 h-4 accent-amber-500"
            />
            <span>{i18n.t('wild.night')}</span>
          </label>

          {sosAvailable && (
            <label
              className={`flex items-center gap-2 px-3 h-10 rounded-xl border text-xs transition ${
                isSos
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-semibold'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-200'
              }`}
            >
              <input
                type="checkbox"
                checked={sos}
                onChange={(e) => setSos(e.target.checked)}
                className="w-4 h-4 accent-emerald-500"
              />
              <span>{i18n.t('wild.sos')}</span>
            </label>
          )}

          {catIdx === 3 && !isSos && (
            <>
              <label className="flex items-center gap-2 px-3 h-10 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200">
                <input
                  type="checkbox"
                  checked={bubbling}
                  onChange={(e) => setBubbling(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span>{i18n.t('wild.bubbling')}</span>
              </label>
              <label className="flex items-center gap-2 px-3 h-10 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200">
                <input
                  type="checkbox"
                  checked={fishyTimeline}
                  onChange={(e) => setFishyTimeline(e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span>{i18n.t('wild.fishyTimeline')}</span>
              </label>
            </>
          )}
        </div>

        {isSos && (
          <div className="rounded-xl bg-zinc-950 border border-emerald-500/30 p-2.5 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-zinc-400">
                  {i18n.t('wild.ally')}
                </label>
                <select
                  value={sosAllyIdx}
                  onChange={(e) => setSosAllyIdx(Number(e.target.value))}
                  className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 px-2 text-xs font-medium text-zinc-100"
                >
                  <option value={0}>
                    {distinctSosAllies.length === 0 ? '—' : `— (${i18n.t('filters.presetAny')})`}
                  </option>
                  {distinctSosAllies.map((ally, idx) => (
                    <option key={`${ally.sf}-${idx}`} value={idx + 1}>
                      {i18n.getSpeciesName(ally.sf & 0x7ff)} ({ally.pct}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-zinc-400">
                  {i18n.t('wild.weather')}
                </label>
                <select
                  value={sosWeather}
                  onChange={(e) => setSosWeather(Number(e.target.value) as SosWeather)}
                  className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 px-2 text-xs font-medium text-zinc-100"
                >
                  <option value={0}>{i18n.t('wild.weatherNone')}</option>
                  <option value={1}>{i18n.t('wild.weatherRain')}</option>
                  <option value={2}>{i18n.t('wild.weatherHail')}</option>
                  <option value={3}>{i18n.t('wild.weatherSand')}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <NumberStepper
                label={i18n.t('wild.chainLength')}
                value={sosChainLength}
                min={0}
                max={255}
                onChange={setSosChainLength}
              />
              <NumberStepper
                label={i18n.t('wild.sosFrame')}
                value={sosFrame}
                min={0}
                max={9999999}
                onChange={setSosFrame}
              />
            </div>

            <HexSeedInput
              label={i18n.t('wild.sosSeed')}
              value={sosSeedHex}
              onChange={setSosSeedHex}
            />
          </div>
        )}

        {(catIdx === 1 || catIdx === 2 || (catIdx === 3 && !isSos)) && (
          <div className="grid grid-cols-2 gap-2">
            <NumberStepper
              label={i18n.t('wild.specialRate')}
              value={specialRate}
              min={0}
              max={100}
              onChange={setSpecialRate}
            />
            {catIdx === 3 && (
              <NumberStepper
                label={i18n.t('wild.biteDelay')}
                value={biteDelay}
                min={0}
                max={200}
                onChange={setBiteDelay}
              />
            )}
          </div>
        )}

        {!isSos && catIdx === 4 && activeLocEntry.kind === 'misc' && activeLocEntry.area.delayType1 === 1 && (
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
            {[
              { v: 0, l: i18n.t('wild.methodSimple') },
              { v: 1, l: i18n.t('wild.methodStep') },
              { v: 2, l: i18n.t('wild.methodMenu') },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setTriggerMethod(opt.v)}
                aria-pressed={triggerMethod === opt.v}
                className="choice-button h-8 rounded-lg text-xs font-semibold"
              >
                {opt.l}
              </button>
            ))}
          </div>
        )}

        {!isSos && catIdx === 3 && (mode === 'normal' || (fishyTimeline && mode === 'timeline')) && (
          <label className="flex items-center justify-between px-3 h-9 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200">
            <span>{i18n.t('wild.overview')}</span>
            <input
              type="checkbox"
              checked={fishyOverview}
              onChange={(e) => setFishyOverview(e.target.checked)}
              className="w-4 h-4 accent-amber-500"
            />
          </label>
        )}
      </div>

      {/* Search Mode & Parameters */}
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
                setStartFrame(getStartingFrame(isUltra, 2));
                setEndFrame(50000);
                setTargetFrame(5000);
                setTimeSpanSec(3600);
                setConsiderDelay(true);
                if (activeLocEntry.kind === 'normal') {
                  setNpcCount(activeLocEntry.area.npc);
                  setCorrection(activeLocEntry.area.correction);
                  setRaining(activeLocEntry.area.raining);
                  setDelayFrames(activeTemplate.delay);
                } else if (activeLocEntry.kind === 'fishing') {
                  setNpcCount(activeLocEntry.area.npc);
                  setRaining(false);
                  setBiteDelay(activeLocEntry.area.longdelay ? (isUltra ? 89 : 97) : 78);
                  setDelayFrames(activeLocEntry.area.lapras ? 0 : -2);
                } else if (activeLocEntry.kind === 'misc') {
                  setNpcCount(activeLocEntry.area.npc);
                  setRaining(false);
                  setDelayFrames(activeLocEntry.area.delay1);
                  setDelay2Frames(activeLocEntry.area.delay2);
                } else {
                  setNpcCount(activeLocEntry.area.npc);
                  setRaining(activeLocEntry.area.raining);
                  setDelayFrames(activeTemplate.delay);
                }
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
            onChange={(v) => {
              setStartFrame(v);
              if (v > endFrame) setEndFrame(v);
            }}
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
              min={100}
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
            max={500}
            step={2}
            disabled={mode !== 'timeline' && !considerDelay}
            onChange={setDelayFrames}
          />
          {!isSos && catIdx < 3 && (
            <NumberStepper
              label={i18n.t('wild.correction')}
              value={correction}
              min={-20}
              max={100}
              onChange={setCorrection}
            />
          )}
          {!isSos && catIdx === 4 && activeLocEntry.kind === 'misc' && activeLocEntry.area.delayType2 > 0 && (
            <NumberStepper
              label="Delay 2 (F)"
              value={delay2Frames}
              min={0}
              max={500}
              step={2}
              onChange={setDelay2Frames}
            />
          )}
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
          {!isSos && (
            <label className="flex items-center gap-2 px-3 h-10 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200">
              <input
                type="checkbox"
                checked={raining}
                onChange={(e) => setRaining(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span>{i18n.t('search.raining')}</span>
            </label>
          )}
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


      {error && (
        <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      </SearchWorkspace>

      <FilterBottomSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filter={filter}
        onChange={setFilter}
        mode="wild"
        encounter={selectedEncounter ? { species: selectedEncounter & 0x7ff, forme: selectedEncounter >>> 11 } : undefined}
        syncNature={syncNature}
        showSafeBlink={mode === 'normal'}
        npcCount={npcCount}
      />

      <FrameDetailModal
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        aroundTab="wild"
      />
    </>
  );
}
