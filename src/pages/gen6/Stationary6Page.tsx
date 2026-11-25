import { aroundTargetRange6 } from './searchOptions6';
import { Clock, Crosshair, Settings2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { countActiveFilters, FilterBottomSheet } from '../../components/filters/FilterBottomSheet';
import { FrameIvValues, FrameShinyBadge, FrameSyncBadge } from '../../components/results/FrameValues';
import { convertToTimeStr } from '../../engine/core/pokemonMath';
import { SearchWorkspace } from '../../components/layout/SearchWorkspace';
import { SearchActionBar } from '../../components/results/SearchActionBar';
import { getPersonalEntry6 } from '../../data/personalTable6';
import {
  getStationary6Categories, getStationary6Traits, type Stationary6Game, type Stationary6Preset,
} from '../../data/stationary6Catalog';
import { createDefaultRngFilter } from '../../engine/core/filters';
import type { Stationary6Row } from '../../engine/gen6/stationary6';
import { parseHex32, toHex32 } from '../../engine/math/uint';
import type { Session6, TrainerProfile6 } from '../../services/gen6Storage';
import { computeTsvTrv } from '../../services/profileStorage';
import { useApp } from '../../store/AppContext';
import { useSearchWorker } from '../../workers/useSearchWorker';
import { fieldClass, labelClass, NumberField } from './fields';
import { Check6 } from './ToolFields6';
import { CopyResultValue, Details6, PokemonDetailCard6, Results6, rowButtonClass, StatValues6, type Results6Data } from './Results6';

const personalData6 = { speciesCount: 721, getEntry: getPersonalEntry6 };
const genderRatios = [
  { value: 127, text: '♂ 1 : 1 ♀' }, { value: 31, text: '♂ 7 : 1 ♀' },
  { value: 63, text: '♂ 3 : 1 ♀' }, { value: 191, text: '♂ 1 : 3 ♀' },
  { value: 225, text: '♂ 1 : 7 ♀' }, { value: 0, text: '♂' }, { value: 254, text: '♀' },
  { value: 255, text: '—' },
];
const rngCardClass = 'rounded-2xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-2.5';

type SearchMode6 = 'normal' | 'timeline' | 'aroundTarget';

function defaultOptions(preset: Stationary6Preset) {
  const traits = getStationary6Traits(preset);
  return {
    delay: preset.delay,
    level: preset.level || 50,
    assumeSynced: false,
    nature: -1,
    genderRatio: preset.species ? traits.genderRatio : 127,
    ability: Math.min(preset.ability, 3) as 0 | 1 | 2 | 3,
    iv3: traits.iv3,
    shinyLocked: traits.shinyLocked,
    alwaysSync: traits.alwaysSync,
    forceShiny: false,
    target: 1,
    history: '',
  };
}

interface Props {
  profile: TrainerProfile6;
  session: Session6;
  updateSession: (next: Partial<Session6>) => void;
  onOpenTimeline?: () => void;
}

export function Stationary6Page(props: Props) {
  const [transporter, setTransporter] = useState(false);
  const game = transporter ? 'VC' : props.profile.gameVersion;
  return <StationaryWorkspace key={game} {...props} game={game} setTransporter={setTransporter} />;
}

function StationaryWorkspace({ profile, session, updateSession, game, setTransporter, onOpenTimeline }: Props & {
  game: Stationary6Game;
  setTransporter: (enabled: boolean) => void;
}) {
  const { i18n } = useApp();
  const { t } = i18n;
  const categories = useMemo(() => getStationary6Categories(game).filter(category => category.list.length), [game]);
  const [categoryIdx, setCategoryIdx] = useState(0);
  const category = categories[categoryIdx]!;
  const [presetId, setPresetId] = useState(category.list[0]!.id);
  const preset = category.list.find(entry => entry.id === presetId) ?? category.list[0]!;
  const traits = getStationary6Traits(preset);
  const [options, setOptions] = useState(() => defaultOptions(preset));
  const [considerDelay, setConsiderDelay] = useState(true);
  const [mode, setMode] = useState<SearchMode6>('normal');
  const calibration = session.timeline;
  const compatible = Boolean(
    game !== 'VC' && calibration && calibration.oras === (game === 'OR' || game === 'AS')
    && ['instant', 'cutscene', 'weather'].includes(calibration.method),
  );
  const timelineAvailable = game !== 'VC' && !options.alwaysSync;
  const effectiveMode: SearchMode6 = !timelineAvailable && mode === 'timeline' ? 'normal' : mode;
  const [filter, setFilter] = useState(createDefaultRngFilter);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [result, setResult] = useState<Results6Data<Stationary6Row> | null>(null);
  const [selected, setSelected] = useState<Stationary6Row | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [validationError, setValidationError] = useState('');
  const worker = useSearchWorker();
  const level = preset.level || options.level;
  const statFilter = preset.species > 0;
  const effectiveFilter = {
    ...filter,
    byStats: filter.byStats && statFilter,
    baseStats: statFilter ? [...getPersonalEntry6(preset.species, preset.forme).stats] : null,
  } satisfies typeof filter;

  function selectPreset(next: Stationary6Preset) {
    setPresetId(next.id);
    setOptions(defaultOptions(next));
  }

  function presetName(entry: Stationary6Preset) {
    if (entry.conceptual) return t('gen6.manualPreset');
    const name = i18n.getSpeciesName(entry.species);
    if (entry.bank && entry.numOfPkm === 3) return `${name} · Pokémon Link ×3`;
    return `${name}${entry.forme ? ` · ${t('event.forme')} ${entry.forme}` : ''}${entry.egg ? ` · ${t('nav.egg')}` : ''}${entry.level ? ` · Lv. ${entry.level}` : ''}`;
  }

  const activeFilters = countActiveFilters(effectiveFilter);

  async function search(overrideMode?: SearchMode6, overrideTarget?: number) {
    setValidationError('');
    const activeMode = overrideMode ?? effectiveMode;
    const targetFrame = overrideTarget ?? session.targetFrame;
    const { minFrame, maxFrame } = activeMode === 'aroundTarget'
      ? aroundTargetRange6(targetFrame)
      : { minFrame: session.startFrame, maxFrame: session.endFrame };

    if (activeMode === 'timeline' && !compatible) {
      setValidationError('gen6.timelineNeedsSetup');
      return;
    }
    if (minFrame > maxFrame) {
      setValidationError('gen6.invalidRange');
      return;
    }
    if (game === 'VC' && (!/^[012]*$/.test(options.history) || options.history.length >= options.target)) {
      setValidationError('gen6.invalidHistory');
      return;
    }
    const { tsv, trv } = computeTsvTrv(profile.tid, profile.sid);
    try {
      const rows = await worker.runStationary6Search({
        game, preset: preset.id,
        seed: parseHex32(session.initialSeedHex) ?? 0, minFrame, maxFrame, targetFrame,
        tsv, trv, shinyCharm: profile.shinyCharm, filter: effectiveFilter,
        considerDelay, delay: options.delay, level,
        timeline: activeMode === 'timeline' && compatible ? calibration : undefined,
        syncNature: options.nature, assumeSynced: activeMode !== 'timeline' && options.assumeSynced, forceShiny: options.forceShiny,
        manual: {
          genderRatio: options.genderRatio, ability: options.ability, perfectIVs: options.iv3,
          alwaysSync: options.alwaysSync, shinyLocked: options.shinyLocked,
        },
        bankTarget: options.target,
        transporterHistory: Array.from(options.history, digit => Number(digit) as 0 | 1 | 2),
      });
      const modeText = activeMode === 'timeline' ? t('search.modeTimeline') : activeMode === 'aroundTarget' ? t('search.modeAround') : '';
      setResult({ ...rows, summary: [
        t(`gen6.gameNames.${game}`), presetName(preset), modeText, session.initialSeedHex,
        `#${minFrame}–#${maxFrame}`, `${t('gen6.delay')} ${considerDelay ? options.delay : 0}`,
        activeFilters ? `${t('search.filters')} ${activeFilters}` : '',
      ].filter(Boolean).join(' · ') });
    } catch {
      // The worker exposes non-cancellation errors.
    }
  }

  return <>
    <SearchWorkspace collapsible={!!result}
      actions={<SearchActionBar activeFilters={activeFilters} onOpenFilters={() => setFiltersOpen(true)}
        isRunning={worker.isRunning} progress={worker.progress} onSearch={() => void search()} onAbort={worker.abort} />}
      results={<Results6 result={result} error={validationError ? t(validationError) : worker.error ? t('misc.searchError') : null}
        headerExtra={preset.species > 0 && (
          <button type="button" aria-pressed={showStats} onClick={() => setShowStats(value => !value)}
            className={`min-h-10 rounded-xl border px-2.5 text-xs font-semibold transition ${showStats
              ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
              : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'}`}>
            {t('search.showStats')}
          </button>
        )}
        renderRow={row => {
          const abLabel = row.ability === 3 ? 'HA' : row.ability > 0 ? String(row.ability) : '-';
          const genderLabel = ['-', '♂', '♀'][row.gender] ?? '-';
          const genderTone = row.gender === 1 ? 'text-sky-400' : row.gender === 2 ? 'text-pink-400' : 'text-zinc-400';
          return <button type="button" className={rowButtonClass} onClick={() => setSelected(row)}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <span className="font-mono font-bold text-amber-300">#{row.frame}</span>
                {row.species > 0 && <span className="font-semibold text-zinc-100">{i18n.getSpeciesName(row.species)}</span>}
                <span className="text-xs text-zinc-200">{i18n.getNatureName(row.nature)}</span>
                {row.synchronize && <FrameSyncBadge synced />}
                {row.shiny && <FrameShinyBadge square={row.squareShiny} />}
              </span>
              <span className="flex shrink-0 items-center gap-2 font-mono text-xs text-zinc-300">
                <span>Ab {abLabel}</span>
                <span className={`font-bold ${genderTone}`}>{genderLabel}</span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              {showStats && row.species > 0 && row.level > 0
                ? <StatValues6 ivs={row.ivs} nature={row.nature} level={row.level} species={row.species} forme={row.forme} />
                : <FrameIvValues ivs={row.ivs} />}
              <span className="shrink-0 text-[11px] font-medium text-zinc-400">
                {t('search.hpShort')} {i18n.getHpTypeName(row.hiddenPower)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 tabular-nums">
              <span>{convertToTimeStr(row.elapsedFrames / 60)} ({row.shift >= 0 ? '+' : ''}{row.shift}F)</span>
              <span>Delay +{row.delay}F</span>
            </div>
          </button>;
        }} />}>
      {/* Card 1: Encounter Settings */}
      <section className={rngCardClass}>
        <h1 className="text-base font-bold">{t('nav.stationary')}</h1>
        <label className={labelClass}><span>{t('profiles.version')}</span>
          <select aria-label={t('profiles.version')} className={fieldClass} value={game} onChange={event => setTransporter(event.target.value === 'VC')}>
            <option value={profile.gameVersion}>{t(`gen6.gameNames.${profile.gameVersion}`)}</option>
            <option value="VC">{t('gen6.gameNames.VC')}</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className={labelClass}><span>{t('gen6.category')}</span>
            <select aria-label={t('gen6.category')} className={fieldClass} value={categoryIdx} onChange={event => {
              const index = Number(event.target.value);
              setCategoryIdx(index);
              selectPreset(categories[index]!.list[0]!);
            }}>
              {categories.map((entry, index) => {
                const key = `gen6.categories.${entry.text}`;
                return <option key={entry.text} value={index}>{t(key) === key ? entry.text : t(key)}</option>;
              })}
            </select>
          </label>
          <label className={labelClass}><span>{t('gen6.preset')}</span>
            <select aria-label={t('gen6.preset')} className={fieldClass} value={preset.id} onChange={event => {
              const entry = category.list.find(item => item.id === event.target.value);
              if (entry) selectPreset(entry);
            }}>
              {category.list.map(entry => <option key={entry.id} value={entry.id}>{presetName(entry)}</option>)}
            </select>
          </label>
        </div>

        {(preset.bank || preset.level === 0) && (
          <div className="grid grid-cols-2 gap-2">
            {preset.bank && <NumberField label={t('gen6.bankTarget')} min={1} max={preset.numOfPkm} value={options.target}
              onChange={target => setOptions({ ...options, target, history: options.history.slice(0, target - 1) })} />}
            {preset.level === 0 && <NumberField label={t('filters.level')} min={1} max={100} value={options.level}
              onChange={level => setOptions({ ...options, level })} />}
          </div>
        )}

        {game === 'VC' && options.target > 1 && <label className={labelClass}><span>{t('gen6.history')}</span>
          <input className={`${fieldClass} font-mono`} inputMode="numeric" value={options.history} maxLength={options.target - 1}
            onChange={event => setOptions({ ...options, history: event.target.value })} />
          <span className="text-zinc-400">{t('gen6.historyHelp')}</span>
        </label>}

        {preset.nature < 25 && <p className="text-xs text-zinc-400">{t('search.nature')} · {i18n.getNatureName(preset.nature)}</p>}
        {traits.syncable && preset.nature >= 25 && (
          <div className="space-y-2">
            <label className={labelClass}><span>{t('stationary.syncNature')}</span>
              <select aria-label={t('stationary.syncNature')} className={fieldClass} value={options.nature}
                onChange={event => setOptions({ ...options, nature: Number(event.target.value) })}>
                <option value={-1}>—</option>
                {Array.from({ length: 25 }, (_, nature) => <option key={nature} value={nature}>{i18n.getNatureName(nature)}</option>)}
              </select>
            </label>
            {!options.alwaysSync && effectiveMode !== 'timeline' && (
              <Check6 label={t('gen6.assumeSynced')} value={options.assumeSynced}
                change={assumeSynced => setOptions({ ...options, assumeSynced })} />
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {preset.bank && <Check6 label={t('gen6.forceShiny')} value={options.forceShiny}
            change={forceShiny => setOptions({ ...options, forceShiny })} />}
          {timelineAvailable && onOpenTimeline && (
            <button type="button" onClick={onOpenTimeline}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs font-semibold text-zinc-200 hover:border-amber-500/60 active:scale-95 transition">
              <Clock size={14} className={compatible ? 'text-emerald-400' : 'text-amber-400'} aria-hidden="true" />
              <span>{t('gen6.tinyTimelineTool')}</span>
              {compatible && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">✓</span>}
            </button>
          )}
        </div>

        {preset.conceptual && (
          <div className="space-y-2 border-t border-zinc-800 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <label className={labelClass}><span>{t('gen6.genderRatio')}</span>
                <select aria-label={t('gen6.genderRatio')} className={fieldClass} value={options.genderRatio}
                  onChange={event => setOptions({ ...options, genderRatio: Number(event.target.value) })}>
                  {genderRatios.map(({ value, text }) => <option key={value} value={value}>{text}</option>)}
                </select>
              </label>
              <label className={labelClass}><span>{t('filters.ability')}</span>
                <select aria-label={t('filters.ability')} className={fieldClass} value={options.ability}
                  onChange={event => setOptions({ ...options, ability: Number(event.target.value) as 0 | 1 | 2 | 3 })}>
                  <option value={0}>—</option><option value={1}>1</option><option value={2}>2</option><option value={3}>HA</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {!preset.bank && <Check6 label={t('gen6.alwaysSync')} value={options.alwaysSync}
                change={alwaysSync => setOptions({ ...options, alwaysSync })} />}
              <Check6 label={t('gen6.threeIv')} value={options.iv3} change={iv3 => setOptions({ ...options, iv3 })} />
              {!preset.bank && <Check6 label={t('gen6.shinyLocked')} value={options.shinyLocked}
                change={shinyLocked => setOptions({ ...options, shinyLocked })} />}
            </div>
          </div>
        )}
      </section>

      {/* Card 2: RNG INFO (Always open, matching Gen 7) */}
      <section className={rngCardClass}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">{t('search.rngInfo')}</span>
          <button type="button" onClick={() => {
            updateSession({ startFrame: 0, endFrame: 50000, targetFrame: 5000 });
            setConsiderDelay(true);
            setOptions(current => ({ ...current, delay: preset.delay }));
          }} className="flex h-8 items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 text-[11px] font-medium text-amber-300 active:scale-95 transition">
            <Settings2 className="size-3.5" aria-hidden="true" />
            <span>{t('search.resetRng')}</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
          {([
            { id: 'normal', label: t('search.modeNormal'), disabled: false },
            { id: 'timeline', label: t('search.modeTimeline'), disabled: !timelineAvailable },
            { id: 'aroundTarget', label: t('search.modeAround'), disabled: false },
          ] as const).map(item => (
            <button key={item.id} type="button" disabled={item.disabled} aria-pressed={effectiveMode === item.id}
              onClick={() => setMode(item.id)}
              className="choice-button min-h-10 rounded-lg px-1.5 text-[11px] font-semibold transition disabled:opacity-40">
              {item.label}
            </button>
          ))}
        </div>

        {effectiveMode === 'timeline' && !compatible && (
          <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200">
            <p>{t('gen6.timelineNeedsSetup')}</p>
          </div>
        )}

        {effectiveMode === 'aroundTarget' ? (
          <div className="space-y-1.5">
            <NumberField label={t('search.targetFrame')} value={session.targetFrame} min={0}
              onChange={targetFrame => updateSession({ targetFrame })} />
            <p className="text-[11px] font-mono text-zinc-400">
              #{aroundTargetRange6(session.targetFrame).minFrame} – #{aroundTargetRange6(session.targetFrame).maxFrame}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <NumberField label={t('search.startFrame')} value={session.startFrame} onChange={startFrame => updateSession({ startFrame })} />
            <NumberField label={t('search.endFrame')} value={session.endFrame} onChange={endFrame => updateSession({ endFrame })} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 items-end">
          {effectiveMode !== 'aroundTarget' && (
            <NumberField label={t('search.targetFrame')} value={session.targetFrame} onChange={targetFrame => updateSession({ targetFrame })} />
          )}
          {considerDelay && (
            <NumberField label={t('gen6.delay')} value={options.delay} max={4000}
              onChange={delay => setOptions({ ...options, delay })} />
          )}
        </div>

        <Check6 label={t('search.considerDelay')} value={considerDelay} change={setConsiderDelay} />
      </section>
    </SearchWorkspace>

    <FilterBottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} mode="stationary"
      filter={effectiveFilter} onChange={setFilter} allowExactStats={statFilter} personalData={personalData6}
      encounter={{ species: preset.species, forme: preset.forme, level }} />

    <Details6 open={selected !== null} title={`${t('gen6.details')} #${selected?.frame ?? ''}`} onClose={() => setSelected(null)}>
      {selected && <>
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-200">
          <span className="font-semibold">
            {selected.species ? i18n.getSpeciesName(selected.species) : t('gen6.manualPreset')} · Lv. {selected.level}
            {selected.forme > 0 && ` · ${t('event.forme')} ${selected.forme}`}
          </span>
          {selected.shiny && <FrameShinyBadge square={selected.squareShiny} />}
        </div>
        <PokemonDetailCard6
          species={selected.species} forme={selected.forme} level={selected.level}
          nature={selected.nature} synchronized={game !== 'VC' ? selected.synchronize : undefined}
          ability={selected.ability} gender={selected.gender} hiddenPower={selected.hiddenPower}
          ivs={selected.ivs} pid={selected.pid} ec={selected.ec} psv={selected.psv} prv={selected.prv}
          extra={[
            { label: t('gen6.delay'), value: `${selected.delay}F` },
            ...(game === 'VC' ? [{ label: t('gen6.framesUsed'), value: `${selected.framesUsed}F` }] : []),
            { label: t('gen6.elapsedTime'), value: `${convertToTimeStr(selected.elapsedFrames / 60)} (${selected.shift >= 0 ? '+' : ''}${selected.shift}F)`, wide: true },
            { label: t('misc.randomNumber'), value: toHex32(selected.rand), wide: true, tone: 'amber' as const },
            { label: t('gen6.mtState'), value: toHex32(selected.state), wide: true, tone: 'emerald' as const },
          ]}
        />
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button"
            className="h-10 rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 text-xs font-semibold text-sky-200 active:scale-95 transition"
            onClick={() => { updateSession({ targetFrame: selected.frame }); setSelected(null); }}>
            {t('search.setAsTarget')}
          </button>
          <button type="button"
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 text-xs font-bold text-zinc-950 active:scale-95 transition"
            onClick={() => {
              const target = selected.frame;
              updateSession({ targetFrame: target });
              setMode('aroundTarget');
              setSelected(null);
              void search('aroundTarget', target);
            }}>
            <Crosshair size={14} aria-hidden="true" />
            <span>{t('search.aroundAction')}</span>
          </button>
        </div>
        <CopyResultValue value={toHex32(selected.state)} label={t('gen6.copyState')} />
      </>}
    </Details6>
  </>;
}
