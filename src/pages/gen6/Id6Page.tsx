import { useState } from 'react';
import { SearchWorkspace } from '../../components/layout/SearchWorkspace';
import { SearchActionBar } from '../../components/results/SearchActionBar';
import type { IdResult6 } from '../../engine/core/types';
import { isTinyState6 } from '../../engine/gen6/id6';
import type { Id6WorkerRequest } from '../../engine/gen6/searches';
import { formatEggSeedStr, parseEggSeedStr, toHex32 } from '../../engine/math/uint';
import type { Session6 } from '../../services/gen6Storage';
import { useApp } from '../../store/AppContext';
import { useSearchWorker } from '../../workers/useSearchWorker';
import { cardClass, fieldClass, labelClass, NumberField } from './fields';
import { Check6 } from './ToolFields6';
import { CopyResultValue, Details6, Results6, rowButtonClass, type Results6Data } from './Results6';

export function Id6Page({ scope, session, updateSession }: {
  scope: string;
  session: Session6;
  updateSession: (next: Partial<Session6>) => void;
}) {
  const { i18n: { t } } = useApp();
  const [words, setWords] = useState(() => session.idState ? formatEggSeedStr(session.idState).split(',') : ['', '', '', '']);
  const [idType, setIdType] = useState<0 | 1 | 2>(0);
  const [idText, setIdText] = useState('');
  const [tsvText, setTsvText] = useState('');
  const [stateText, setStateText] = useState('');
  const [regex, setRegex] = useState(false);
  const [result, setResult] = useState<Results6Data<IdResult6> | null>(null);
  const [selected, setSelected] = useState<IdResult6 | null>(null);
  const [validationError, setValidationError] = useState('');
  const worker = useSearchWorker(scope);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = [idText, tsvText, stateText].filter(value => value.trim()).length;
  const fieldTexts = [
    { label: t('id.idList'), value: idText, change: setIdText },
    { label: t('id.tsvList'), value: tsvText, change: setTsvText },
    { label: t('gen6.tinyFilter'), value: stateText, change: setStateText },
  ];

  async function search() {
    setValidationError('');
    const state = parseEggSeedStr(words.join(','));
    if (!isTinyState6(state)) {
      setValidationError('gen6.tinyInvalid');
      return;
    }
    const { idStartFrame: minFrame, idEndFrame: maxFrame } = session;
    if (minFrame > maxFrame) {
      setValidationError('gen6.invalidRange');
      return;
    }
    const filter: Id6WorkerRequest['filter'] = {
      idType, regex, skip: false, idList: idText.split(/\r?\n/),
      tsvList: tsvText.split(/\r?\n/), randList: stateText.split(/\r?\n/),
    };
    updateSession({ idState: state });
    try {
      const output = await worker.runId6Search({ state, minFrame, maxFrame, filter });
      setResult({ ...output, summary: `ID RNG · #${minFrame}–#${maxFrame} · ${formatEggSeedStr(state).replaceAll(',', ', ')}` });
    } catch {
      // The worker exposes non-cancellation errors.
    }
  }

  return <>
    <SearchWorkspace collapsible={!!result}
      actions={<SearchActionBar activeFilters={activeFilters} onOpenFilters={() => setFiltersOpen(true)} isRunning={worker.isRunning} progress={worker.progress}
        onSearch={() => void search()} onAbort={worker.abort} />}
      results={<Results6 result={result} error={validationError ? t(validationError) : worker.error ? t('misc.searchError') : null}
        renderRow={row => <button type="button" className={rowButtonClass} onClick={() => setSelected(row)}>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm">
            <span className="font-bold text-amber-300">#{row.frame}</span>
            <span>TID {String(row.tid).padStart(5, '0')}</span>
            <span>SID {String(row.sid).padStart(5, '0')}</span>
          </span>
          <span className="block font-mono text-xs text-zinc-400">TSV {String(row.tsv).padStart(4, '0')} · TRV {row.trv.toString(16).toUpperCase()}</span>
        </button>} />}>
      <section className={cardClass}>
        <h1 className="text-base font-bold">ID RNG</h1>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t('gen6.tinyState')}</legend>
          <p className="text-xs text-zinc-400">{t('gen6.tinyHelp')}</p>
          <div className="grid grid-cols-2 gap-2">
            {words.map((word, index) => <label key={index} className={labelClass}>
              <span>S{3 - index}</span>
              <input className={`${fieldClass} font-mono tracking-wider`} value={word} maxLength={8}
                autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="00000000"
                onChange={event => {
                  const next = words.map((part, i) => i === index ? event.target.value.toUpperCase() : part);
                  setWords(next);
                  const state = parseEggSeedStr(next.join(','));
                  if (isTinyState6(state)) updateSession({ idState: state });
                }} />
            </label>)}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t('search.startFrame')} value={session.idStartFrame}
            onChange={idStartFrame => updateSession({ idStartFrame })} />
          <NumberField label={t('search.endFrame')} value={session.idEndFrame}
            onChange={idEndFrame => updateSession({ idEndFrame })} />
        </div>
      </section>
    </SearchWorkspace>
    <Details6 title={t('gen6.idFilters')} open={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <label className={labelClass}><span>{t('id.filterType')}</span>
          <select aria-label={t('id.filterType')} className={fieldClass} value={idType} onChange={event => setIdType(Number(event.target.value) as 0 | 1 | 2)}>
            <option value={0}>{t('id.tid')}</option>
            <option value={1}>{t('id.sid')}</option>
            <option value={2}>{t('id.fullId')}</option>
          </select>
        </label>
        {fieldTexts.map(({ label, value, change }) => <label key={label} className={labelClass}>
          <span>{label}</span>
          <textarea className={`${fieldClass} py-2 font-mono`} rows={2} spellCheck={false} value={value}
            onChange={event => change(event.target.value)} />
        </label>)}
        <Check6 label={t('id.regex')} value={regex} change={setRegex} />
    </Details6>
    <Details6 open={selected !== null} title={`ID RNG · #${selected?.frame ?? ''}`} onClose={() => setSelected(null)}>
      {selected && <>
        <dl className="grid grid-cols-2 gap-2 font-mono text-sm">
          <dt>TID / SID</dt><dd>{String(selected.tid).padStart(5, '0')} / {String(selected.sid).padStart(5, '0')}</dd>
          <dt>TSV / TRV</dt><dd>{String(selected.tsv).padStart(4, '0')} / {selected.trv.toString(16).toUpperCase()}</dd>
          <dt>{t('misc.randomNumber')}</dt><dd>{toHex32(selected.rand)}</dd>
        </dl>
        <p className="text-xs text-zinc-400">{t('gen6.tinyState')}</p>
        <p className="break-words font-mono text-sm text-amber-300">{formatEggSeedStr(selected.state).replaceAll(',', ', ')}</p>
        <CopyResultValue value={formatEggSeedStr(selected.state)} label={t('gen6.copyState')} />
      </>}
    </Details6>
  </>;
}
