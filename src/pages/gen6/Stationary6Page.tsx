import { useMemo, useState } from 'react';
import { countActiveFilters, FilterBottomSheet } from '../../components/filters/FilterBottomSheet';
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
import { cardClass, fieldClass, labelClass, NumberField } from './fields';
import { Details6, Results6, rowButtonClass, type Results6Data } from './Results6';

const personalData6 = { speciesCount: 721, getEntry: getPersonalEntry6 };
const genderRatios = [
  { value: 127, text: '♂ 1 : 1 ♀' }, { value: 31, text: '♂ 7 : 1 ♀' },
  { value: 63, text: '♂ 3 : 1 ♀' }, { value: 191, text: '♂ 1 : 3 ♀' },
  { value: 225, text: '♂ 1 : 7 ♀' }, { value: 0, text: '♂' }, { value: 254, text: '♀' },
  { value: 255, text: '—' },
];

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
}

export function Stationary6Page(props: Props) {
  const [transporter, setTransporter] = useState(false);
  const game = transporter ? 'VC' : props.profile.gameVersion;
  return <StationaryWorkspace key={game} {...props} game={game} setTransporter={setTransporter} />;
}

function StationaryWorkspace({ profile, session, updateSession, game, setTransporter }: Props & {
  game: Stationary6Game;
  setTransporter: (enabled: boolean) => void;
}) {
  const { i18n, lang } = useApp();
  const { t } = i18n;
  const categories = useMemo(() => getStationary6Categories(game).filter(category => category.list.length), [game]);
  const [categoryIdx, setCategoryIdx] = useState(0);
  const category = categories[categoryIdx]!;
  const [presetId, setPresetId] = useState(category.list[0]!.id);
  const preset = category.list.find(entry => entry.id === presetId) ?? category.list[0]!;
  const traits = getStationary6Traits(preset);
  const [options, setOptions] = useState(() => defaultOptions(preset));
  const [considerDelay, setConsiderDelay] = useState(true);
  const [filter, setFilter] = useState(createDefaultRngFilter);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [result, setResult] = useState<Results6Data<Stationary6Row> | null>(null);
  const [selected, setSelected] = useState<Stationary6Row | null>(null);
  const [validationError, setValidationError] = useState('');
  const worker = useSearchWorker();
  const statNames = [lang === 'it' ? 'PS' : 'HP', 'Atk', 'Def', 'SpA', 'SpD', lang === 'it' ? 'Vel' : 'Spe'];
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

  async function search() {
    setValidationError('');
    const { startFrame: minFrame, endFrame: maxFrame, targetFrame } = session;
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
        syncNature: options.nature, assumeSynced: options.assumeSynced, forceShiny: options.forceShiny,
        manual: {
          genderRatio: options.genderRatio, ability: options.ability, perfectIVs: options.iv3,
          alwaysSync: options.alwaysSync, shinyLocked: options.shinyLocked,
        },
        bankTarget: options.target,
        transporterHistory: Array.from(options.history, digit => Number(digit) as 0 | 1 | 2),
      });
      setResult({ ...rows, summary: [
        t(`gen6.gameNames.${game}`), presetName(preset), session.initialSeedHex,
        `#${minFrame}–#${maxFrame}`, `${t('gen6.delay')} ${considerDelay ? options.delay : 0}`,
        activeFilters ? `${t('search.filters')} ${activeFilters}` : '',
      ].filter(Boolean).join(' · ') });
    } catch {
      // The worker exposes non-cancellation errors.
    }
  }

  return <>
    <SearchWorkspace collapsed={false}
      actions={<SearchActionBar activeFilters={activeFilters} onOpenFilters={() => setFiltersOpen(true)}
        isRunning={worker.isRunning} progress={worker.progress} onSearch={() => void search()} onAbort={worker.abort} />}
      results={<Results6 result={result} error={validationError ? t(validationError) : worker.error ? t('misc.searchError') : null}
        renderRow={row => <button type="button" className={rowButtonClass} onClick={() => setSelected(row)}>
          <span className="flex flex-wrap items-center gap-x-2 text-sm">
            <span className="font-mono font-bold text-amber-300">#{row.frame}</span>
            {row.species > 0 && <span className="font-semibold">{i18n.getSpeciesName(row.species)}</span>}
            <span className="text-xs text-zinc-300">{i18n.getNatureName(row.nature)}</span>
            {row.shiny && <span className="text-xs text-amber-300">{row.squareShiny ? '■' : '★'}</span>}
          </span>
          <span className="block font-mono text-xs text-zinc-400">IV {row.ivs.join(' / ')} · PID {toHex32(row.pid)}</span>
        </button>} />}>
      <section className={cardClass}>
        <h1 className="text-base font-bold">{t('nav.stationary')}</h1>
        <label className={labelClass}><span>{t('profiles.version')}</span>
          <select aria-label={t('profiles.version')} className={fieldClass} value={game} onChange={event => setTransporter(event.target.value === 'VC')}>
            <option value={profile.gameVersion}>{t(`gen6.gameNames.${profile.gameVersion}`)}</option>
            <option value="VC">{t('gen6.gameNames.VC')}</option>
          </select>
        </label>
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
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t('search.startFrame')} value={session.startFrame} onChange={startFrame => updateSession({ startFrame })} />
          <NumberField label={t('search.endFrame')} value={session.endFrame} onChange={endFrame => updateSession({ endFrame })} />
          {preset.bank && <NumberField label={t('gen6.bankTarget')} min={1} max={preset.numOfPkm} value={options.target}
            onChange={target => setOptions({ ...options, target, history: options.history.slice(0, target - 1) })} />}
          {preset.level === 0 && <NumberField label={t('filters.level')} min={1} max={100} value={options.level}
            onChange={level => setOptions({ ...options, level })} />}
        </div>
        {game === 'VC' && options.target > 1 && <label className={labelClass}><span>{t('gen6.history')}</span>
          <input className={`${fieldClass} font-mono`} inputMode="numeric" value={options.history} maxLength={options.target - 1}
            onChange={event => setOptions({ ...options, history: event.target.value })} />
          <span className="text-zinc-400">{t('gen6.historyHelp')}</span>
        </label>}
      </section>
      <details className={cardClass}>
        <summary className="cursor-pointer text-sm font-semibold">{t('gen6.advanced')}</summary>
        <Check label={t('search.considerDelay')} checked={considerDelay} onChange={setConsiderDelay} />
        {considerDelay && <NumberField label={t('gen6.delay')} value={options.delay} max={4000}
          onChange={delay => setOptions({ ...options, delay })} />}
        <NumberField label={t('search.targetFrame')} value={session.targetFrame} onChange={targetFrame => updateSession({ targetFrame })} />
        {preset.nature < 25 && <p className="text-xs text-zinc-400">{t('search.nature')} · {i18n.getNatureName(preset.nature)}</p>}
        {traits.syncable && preset.nature >= 25 && <>
          <label className={labelClass}><span>{t('stationary.syncNature')}</span>
            <select aria-label={t('stationary.syncNature')} className={fieldClass} value={options.nature}
              onChange={event => setOptions({ ...options, nature: Number(event.target.value) })}>
              <option value={-1}>—</option>
              {Array.from({ length: 25 }, (_, nature) => <option key={nature} value={nature}>{i18n.getNatureName(nature)}</option>)}
            </select>
          </label>
          {!options.alwaysSync && <Check label={t('gen6.assumeSynced')} checked={options.assumeSynced}
            onChange={assumeSynced => setOptions({ ...options, assumeSynced })} />}
        </>}
        {preset.bank && <Check label={t('gen6.forceShiny')} checked={options.forceShiny}
          onChange={forceShiny => setOptions({ ...options, forceShiny })} />}
        {preset.conceptual && <>
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
          {!preset.bank && <Check label={t('gen6.alwaysSync')} checked={options.alwaysSync}
            onChange={alwaysSync => setOptions({ ...options, alwaysSync })} />}
          <Check label={t('gen6.threeIv')} checked={options.iv3} onChange={iv3 => setOptions({ ...options, iv3 })} />
          {!preset.bank && <Check label={t('gen6.shinyLocked')} checked={options.shinyLocked}
            onChange={shinyLocked => setOptions({ ...options, shinyLocked })} />}
        </>}
      </details>
    </SearchWorkspace>
    <FilterBottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} mode="stationary"
      filter={effectiveFilter} onChange={setFilter} allowExactStats={statFilter} personalData={personalData6}
      encounter={{ species: preset.species, forme: preset.forme, level }} />
    <Details6 open={selected !== null} title={`${t('gen6.details')} #${selected?.frame ?? ''}`} onClose={() => setSelected(null)}>
      {selected && <>
        <p className="text-sm text-zinc-300">
          {selected.species ? i18n.getSpeciesName(selected.species) : t('gen6.manualPreset')} · Lv. {selected.level} · {i18n.getNatureName(selected.nature)}
        </p>
        <dl className="grid grid-cols-6 gap-1 rounded-xl bg-zinc-950 p-2 text-center">
          {selected.ivs.map((iv, index) => <div key={index}>
            <dt className="text-[11px] text-zinc-400">{statNames[index]}</dt>
            <dd className="font-mono text-sm text-amber-300">{iv}</dd>
          </div>)}
        </dl>
        <dl className="grid grid-cols-2 gap-2 break-words text-sm">
          <dt>PID</dt><dd className="font-mono">{toHex32(selected.pid)}</dd>
          <dt>EC</dt><dd className="font-mono">{toHex32(selected.ec)}</dd>
          <dt>PSV / PRV</dt><dd className="font-mono">{selected.psv} / {selected.prv.toString(16).toUpperCase()}</dd>
          <dt>{t('filters.ability')}</dt><dd>{selected.ability === 3 ? 'HA' : selected.ability}</dd>
          <dt>{t('filters.gender')}</dt><dd>{['—', '♂', '♀'][selected.gender]}</dd>
          <dt>{t('gen6.delay')}</dt><dd>{selected.delay}F</dd>
          <dt>{t('misc.randomNumber')}</dt><dd className="font-mono">{toHex32(selected.rand)}</dd>
          <dt>{t('gen6.mtState')}</dt><dd className="font-mono">{toHex32(selected.state)}</dd>
        </dl>
      </>}
    </Details6>
  </>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-9 items-center gap-2 text-sm">
    <input type="checkbox" className="size-4 accent-amber-400" checked={checked} onChange={event => onChange(event.target.checked)} />
    {label}
  </label>;
}
