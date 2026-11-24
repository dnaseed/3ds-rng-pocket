import { useState } from 'react';
import { formatEggSeedStr, parseEggSeedStr, toHex32 } from '../../engine/math/uint';
import { convertToTimeStr } from '../../engine/core/pokemonMath';
import { FrameField, FrameSyncBadge } from '../../components/results/FrameValues';
import { scale6, item6, isCalibration6, timelineMethods6, type Timeline6Request, type TimelineMethod6, type TimelineRow6 } from '../../engine/gen6/tinyTimeline';
import { useSearchWorker } from '../../workers/useSearchWorker';
import { useApp } from '../../store/AppContext';
import { SearchWorkspace } from '../../components/layout/SearchWorkspace';
import { SearchActionBar } from '../../components/results/SearchActionBar';
import { Results6, CopyResultValue, Details6, rowButtonClass, type Results6Data } from './Results6';
import { Check6 } from './ToolFields6';
import { NumberField, buttonClass, cardClass, fieldClass, labelClass } from './fields';

const callNames = ['blink2', 'blink1', '', 'fidget', 'soaring', 'xyId', 'runningNpc', 'weather'];
const itemTiers = ['50%', '5%', '1%', '—'];
const allowedCalls = (method: TimelineMethod6) => {
  switch (method) {
    case 'cutscene': return [0,1,3,4];
    case 'fishing': case 'smash': return [0,1];
    case 'normal': return [0,1,3,6];
    case 'id': return [5];
    case 'weather': return [0,1,7];
    default: return [0,1,3];
  }
};

export function Timeline6Page({ saved, game, onSave }: {
  saved?: Timeline6Request; game: string; onSave: (q: Timeline6Request) => void;
}) {
  const { lang, i18n } = useApp();
  const it = lang === 'it';
  const t = i18n.t;
  const methodName = (method: TimelineMethod6) => t(`gen6.timelineMethods.${method}`);
  const oras = game === 'OR' || game === 'AS';
  const initial = saved?.oras === oras ? saved : undefined;
  const [q, setQ] = useState<Timeline6Request>(() => initial ?? {
    state: [0,0,0,0], method: 'instant', calls: [{ frame: 500, type: 0 }], maxFrame: 5500,
    split: false, delay: 0, party: 1, cry: null, slots: 2, rate: 1, chain: 0, boost: false, oras,
  });
  const [words, setWords] = useState(initial ? formatEggSeedStr(initial.state).split(',') : ['','','','']);
  const [error, setError] = useState('');
  const [result, setResult] = useState<(Results6Data<TimelineRow6> & { query: Timeline6Request }) | null>(null);
  const [row, setRow] = useState<TimelineRow6 | null>(null);
  const worker = useSearchWorker(game);
  const update = (patch: Partial<Timeline6Request>) => setQ(current => ({ ...current, ...patch }));
  function changeMethod(method: TimelineMethod6) {
    const defaults: Partial<Record<TimelineMethod6, number>> = { safari: 6, radar: 14, fishing: 14, smash: 280, shadow: 78, normal: 6, id: 724, weather: game === 'AS' ? 324 : 326 };
    update({ method, calls: [{ frame: q.calls[0]!.frame, type: allowedCalls(method)[0]! }], split: ['fishing','smash','weather'].includes(method),
      delay: defaults[method] ?? 0, cry: method === 'shadow' ? 32 : null, rate: method === 'safari' ? 13 : method === 'fishing' ? 98 : 1 });
  }
  async function search() {
    const query = { ...q, state: parseEggSeedStr(words.join(',')) };
    if (!isCalibration6(query)) {
      setError(it ? 'Controlla le quattro parole TinyMT e l’ordine dei frame.' : 'Check the four TinyMT words and the frame order.');
      return;
    }
    setError('');
    onSave(query);
    try {
      const output = await worker.searchTimeline6(query);
      setResult({ ...output, query, summary: [game, methodName(query.method), formatEggSeedStr(query.state), '#' + query.calls[0]!.frame + '–#' + query.maxFrame].join(' · ') });
    } catch { /* Cancellation and errors are handled by the worker. */ }
  }
  const selectable = timelineMethods6.filter(m => oras ? !['safari','radar','shadow','id'].includes(m) : m !== 'weather');
  const patchMap = Array.from({length:9},(_,y) => Array.from({length:9},(_,x) =>
    x === 4 && y === 4 ? 'C' : row?.radar?.patches.find(p => p.x===x && p.y===y)?.kind ?? '·').join(' ')).join('\n');
  return <>
    <SearchWorkspace collapsible={!!result} actions={<SearchActionBar isRunning={worker.isRunning} progress={worker.progress} activeFilters={0} onSearch={() => void search()} onAbort={worker.abort}/>}
      results={<Results6 result={result} error={error || worker.error} renderRow={r => <button className={rowButtonClass} onClick={() => setRow(r)}>
        <span className="flex flex-wrap items-center gap-2">
          <b className="font-mono text-amber-300">#{r.index} · {r.frame <= r.end ? r.frame + '–' + r.end : '—'}</b>
          {r.frame > r.end && <span className="sr-only">{t('gen6.unreachable')}</span>}
          <FrameSyncBadge synced={r.sync} />
          {r.slot !== undefined && <span>Slot {r.slot}</span>}
          {r.radar && <span>{t('gen6.music')} {r.radar.music}</span>}
        </span>
        <span className="block font-mono text-xs">{result?.query.split ? `${t('gen6.hitIndex')} #${r.hit}` : `R(100) ${scale6(r.rand, 100)}`}</span>
      </button>}/>}>
      <section className={cardClass}><h1>TinyMT Timeline</h1>
        <label className={labelClass}>{it ? 'Metodo' : 'Method'}<select className={fieldClass} value={q.method} onChange={e=>changeMethod(e.target.value as TimelineMethod6)}>
          {selectable.map(m=><option key={m} value={m}>{methodName(m)}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-2">{words.map((word,i)=><label className={labelClass} key={i}>S{3-i}<input className={fieldClass} maxLength={8} value={word}
          onChange={e=>setWords(words.map((v,j)=>i===j ? e.target.value.toUpperCase() : v))}/></label>)}</div>
        {q.calls.map((call,i)=><div key={i} className="grid grid-cols-2 gap-2"><NumberField label={'Frame '+(i+1)} value={call.frame}
          onChange={frame=>update({calls:q.calls.map((c,j)=>j===i ? {...c,frame} : c)})}/>
          <label className={labelClass}>{(it?'Chiamata ':'Call ')+(i+1)}<select className={fieldClass} value={call.type}
            onChange={e=>update({calls:q.calls.map((c,j)=>j===i ? {...c,type:Number(e.target.value)} : c)})}>
            {allowedCalls(q.method).map(t=><option key={t} value={t}>{i18n.t(`gen6.timelineCalls.${callNames[t]}`)}</option>)}</select></label></div>)}
        <div className="flex gap-2"><button className={buttonClass} disabled={q.calls.length===4} onClick={()=>update({calls:[...q.calls,{...q.calls[q.calls.length-1]!}]})}>{it?'Aggiungi chiamata':'Add call'}</button>
          <button className={buttonClass} disabled={q.calls.length===1} onClick={()=>update({calls:q.calls.slice(0,-1)})}>{it?'Rimuovi ultima':'Remove last'}</button></div>
        <NumberField label={i18n.t('search.endFrame')} value={q.maxFrame} onChange={maxFrame=>update({maxFrame})}/>
        {q.method!=='horde' && <Check6 label={i18n.t('search.considerDelay')} value={q.split} change={split=>update({split})}/>}
        {q.split && <NumberField label={i18n.t('gen6.delay')} max={4000} value={q.delay} onChange={delay=>update({delay})}/>}
        {q.split && ['instant','cutscene','shadow'].includes(q.method) && <><Check6 label={t('gen6.cry')} value={q.cry!==null} change={checked=>update({cry:checked?0:null})}/>
          {q.cry!==null && <NumberField label={t('gen6.cryFrame')} value={q.cry} max={4000} onChange={cry=>update({cry})}/>}</>}
        {['cutscene','horde','fishing','radar','weather'].includes(q.method) && <NumberField label={it?'Pokémon in squadra':'Party size'} min={1} max={6} value={q.party} onChange={party=>update({party})}/>}
        {q.method==='safari' && <NumberField label={t('gen6.safariSlots')} min={2} max={3} value={q.slots} onChange={slots=>update({slots})}/>}
        {['safari','normal','fishing'].includes(q.method) && <NumberField label={it?'Probabilità incontro (%)':'Encounter rate (%)'} max={100} value={q.rate} onChange={rate=>update({rate})}/>}
        {q.method==='radar' && <><NumberField label={it?'Catena':'Chain length'} value={q.chain} onChange={chain=>update({chain})} max={999}/>
          <Check6 label="Boost" value={q.boost} change={boost=>update({boost})}/></>}
      </section>
    </SearchWorkspace>
    <Details6 open={!!row} title={'TinyMT #'+(row?.index??'')} onClose={()=>setRow(null)}>{row && result && <>
      <dl className="grid grid-cols-2 gap-2">
        <FrameField label={t('gen6.tinyState')}><span className="break-all">{formatEggSeedStr(row.state)}</span></FrameField>
        <FrameField label="Rand">{toHex32(row.rand)}</FrameField>
        <FrameField label={result.query.split ? t('gen6.hitIndex') : 'R(100)'}>
          {result.query.split ? row.hit : scale6(row.rand, 100)}
        </FrameField>
        <FrameField label={t('gen6.elapsedTime')}>{row.frame > row.end ? '—' :
          [row.frame, row.end].map(frame => convertToTimeStr((frame - result.query.calls[0]!.frame) / 60)).join(' – ')}</FrameField>
        {row.slot !== undefined && <FrameField label="Slot">{row.slot}</FrameField>}
        {row.encounter !== undefined && <FrameField label={t('gen6.encounterRoll')}>
          {row.encounter} · {result.query.rate === 1 ? '—' : row.encounter < result.query.rate ? '✓' : '×'}
        </FrameField>}
        {row.item !== undefined && <FrameField label={t('gen6.heldItem')}>{itemTiers[row.item]}</FrameField>}
        {row.flute !== undefined && <FrameField label={t('gen6.flute')}>+{row.flute}</FrameField>}
        {row.horde && <><FrameField label={t('gen6.haSlot')}>{row.horde.ha || '—'}</FrameField>
          <FrameField label={t('gen6.heldItems')}>{row.horde.items.map(roll => itemTiers[item6(roll)]).join(' / ')}</FrameField>
          {result.query.oras && <FrameField label={t('gen6.flute')}>{row.horde.flutes.map(boost => '+' + boost).join(' / ')}</FrameField>}
        </>}
      </dl>
      {row.radar && <><p>{it?'Musica':'Music'} {row.radar.music}</p><pre className="w-fit rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono" aria-label={t('gen6.radarMap')}>{patchMap}</pre>
        <ol>{row.radar.patches.map((p,i)=><li key={i}>{i+1} · ({p.x}, {p.y}) · {p.kind}</li>)}</ol></>}
      <button className={buttonClass} onClick={()=>{setWords(formatEggSeedStr(row.state).split(','));setRow(null);}}>{it?'Usa questo stato':'Use this state'}</button>
      <CopyResultValue value={formatEggSeedStr(row.state)} label={t('gen6.copyState')} />
    </>}</Details6>
  </>;
}
