import { useMemo, useRef, useState } from 'react';
import { getFormeEntry } from '../../data/personalTable';
import { getIvRanges, type IvRanges } from '../../engine/core/ivRanges';
import { useApp } from '../../store/AppContext';

export interface EncounterStats {
  species: number;
  forme?: number;
  level?: number;
}

export interface IvPersonalData {
  speciesCount: number;
  getEntry: (species: number, forme?: number) => Pick<ReturnType<typeof getFormeEntry>, 'formeCount' | 'stats'>;
}

interface Props {
  encounter?: EncounterStats;
  statNames: readonly string[];
  onApply: (ranges: IvRanges, nature: number) => void;
  personalData?: IvPersonalData;
  maxIvSpread?: number;
}

const inputClass = 'block mt-1 h-10 w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-100';

export function IvCalculator(props: Props) {
  const { i18n } = useApp();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900">
      <button type="button" ref={trigger} aria-expanded={open} onClick={() => setOpen(!open)}
        className="w-full px-3 py-2.5 text-left text-sm font-semibold text-amber-300">
        {i18n.t('filters.calcIvs')} <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && <CalculatorFields {...props} onApply={(ranges,nature) => {
        props.onApply(ranges,nature);
        setOpen(false);
        trigger.current?.focus();
      }} />}
    </section>
  );
}

function CalculatorFields({ encounter, statNames, onApply, personalData, maxIvSpread }: Props) {
  const { i18n, isUltra } = useApp();
  const getEntry = personalData?.getEntry ?? getFormeEntry;
  const speciesCount = personalData?.speciesCount ?? (isUltra ? 807 : 802);
  const [species, setSpecies] = useState(encounter?.species ?? 0);
  const [forme, setForme] = useState(encounter?.forme ?? 0);
  const [level, setLevel] = useState(encounter?.level ? String(encounter.level) : '');
  const [nature, setNature] = useState(-1);
  const [trait, setTrait] = useState(-1);
  const [observed, setObserved] = useState<string[]>(Array(6).fill(''));
  const speciesOptions = useMemo(() => Array.from({ length: speciesCount }, (_, i) =>
    <option key={i + 1} value={i + 1}>{i18n.getSpeciesName(i + 1)}</option>), [i18n, speciesCount]);
  const formCount = getEntry(species).formeCount;
  const ready = species > 0 && nature >= 0 && level !== '' && observed.every(value => value !== '');
  const ranges = ready
    ? getIvRanges(getEntry(species, forme).stats, Number(level), nature, observed.map(Number),
      trait < 0 ? undefined : { stat: Math.floor(trait / 5), remainder: trait % 5 })
    : null;

  return (
    <div className="space-y-3 px-3 pb-3 text-xs text-zinc-300">
      <p>{i18n.t('filters.calcZeroEvs')}</p>
      <div className="grid grid-cols-2 gap-2">
        <label>{i18n.t('event.species')}
          <select aria-label={i18n.t('event.species')} className={inputClass} value={species} onChange={event => {
            setSpecies(Number(event.target.value));
            setForme(0);
          }}>
            <option value={0}>—</option>
            {speciesOptions}
          </select>
        </label>
        {formCount > 1 && <label>{i18n.t('event.forme')}
          <select aria-label={i18n.t('event.forme')} className={inputClass} value={forme} onChange={event => setForme(Number(event.target.value))}>
            {Array.from({ length: formCount }, (_, i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>}
        <label>{i18n.t('filters.level')}
          <input type="number" inputMode="numeric" min={1} max={100} className={inputClass}
            value={level} onChange={event => setLevel(event.target.value)} />
        </label>
        <label>{i18n.t('search.nature')}
          <select aria-label={i18n.t('search.nature')} className={inputClass} value={nature} onChange={event => setNature(Number(event.target.value))}>
            <option value={-1}>—</option>
            {Array.from({ length: 25 }, (_, i) => <option key={i} value={i}>{i18n.getNatureName(i)}</option>)}
          </select>
        </label>
      </div>
      <label className="block">{i18n.t('filters.characteristic')}
        <select aria-label={i18n.t('filters.characteristic')} className={inputClass} value={trait} onChange={event => setTrait(Number(event.target.value))}>
          <option value={-1}>—</option>
          {statNames.map((name, index) => <optgroup key={name} label={name}>
            {Array.from({ length: 5 }, (_, offset) => {
              const id = index * 5 + offset;
              return <option key={id} value={id}>{i18n.t(`filters.traits.${id}`)}</option>;
            })}
          </optgroup>)}
        </select>
      </label>
      <div className="grid grid-cols-3 gap-2">
        {statNames.map((label, index) => (
          <label key={label}>{label}
            <input type="number" min={1} inputMode="numeric" className={inputClass}
              value={observed[index]} onChange={event => {
                const next = [...observed];
                next[index] = event.target.value;
                setObserved(next);
              }} />
          </label>
        ))}
      </div>
      <p role="status" className={ranges ? 'grid grid-cols-3 gap-1 font-mono text-amber-200' : 'text-zinc-300'}>
        {ranges ? statNames.map((label, i) =>
          <span key={label}>{label} {ranges.ivLow[i]}–{ranges.ivUp[i]}</span>)
          : ready ? i18n.t('filters.calcImpossible') : ''}
      </p>
      {trait >= 0 && ranges && <p>{i18n.t('filters.traitBounds')}</p>}
      <button type="button" disabled={!ranges || (maxIvSpread !== undefined && ranges.ivUp.some((v,i)=>v-ranges.ivLow[i]! > maxIvSpread))} onClick={() => ranges && onApply(ranges,nature)}
        className="min-h-10 w-full rounded-lg bg-amber-400 px-3 text-sm font-bold text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-400">
        {i18n.t('filters.applyRanges')}
      </button>
    </div>
  );
}
