import { ScanText } from 'lucide-react';
import { getHiddenPowerValue, getPSV, getPRV } from '../../engine/core/pokemonMath';
import { FrameIvValues, FrameShinyBadge } from '../../components/results/FrameValues';
import { CopyResultValue, PokemonDetailCard6 } from './Results6';
import { useEffect, useState } from 'react';
import { createDefaultRngFilter } from '../../engine/core/filters';
import { eggFromKey6, type Egg6Options, type EggKey6, type EggRow6 } from '../../engine/gen6/egg6';
import { parseHex32, toHex32 } from '../../engine/math/uint';
import { computeTsvTrv } from '../../services/profileStorage';
import { useApp } from '../../store/AppContext';
import { useSearchWorker } from '../../workers/useSearchWorker';
import { FrameSearch6, range6, type Page6Props } from './FrameSearch6';
import { Check6, Pair6, Select6, Text6 } from './ToolFields6';
import { NumberField } from './fields';

export function Egg6Page({profile,session,updateSession,onOpenScan}:Page6Props & { onOpenScan?: () => void }) {
  const {i18n,lang}=useApp(), it=lang==='it';
  const ids=computeTsvTrv(profile.tid,profile.sid);
  const [q,setQ]=useState<Egg6Options>({male:Array(6).fill(31),female:Array(6).fill(31),maleItem:0,femaleItem:0,ability:0,ratio:127,nido:false,masuda:false,
    charm:profile.shinyCharm,accept:true,tsv:ids.tsv,trv:ids.trv,otherTSVs:[]});
  const update=(patch:Partial<Egg6Options>)=>setQ(prev=>({...prev,...patch}));
  const [delay,setDelay]=useState(16);
  const [key,setKey]=useState<string[]>(session.eggKey?.map(toHex32)??['','']);
  const eggKeyStr = session.eggKey ? session.eggKey.map(toHex32).join(',') : '';
  useEffect(() => {
    if (eggKeyStr) setKey(eggKeyStr.split(','));
  }, [eggKeyStr]);
  const [others,setOthers]=useState('');
  const words=key.map(parseHex32);
  const current=words.every(w=>w!==null)?eggFromKey6(q,words as EggKey6):null;
  const worker=useSearchWorker();
  const [filter, setFilter] = useState(createDefaultRngFilter);
  const itemNames=it?['Nessuno','Pietrastante','Destincomune','Vigorpeso','Vigorcerchio','Vigorfascia','Vigorlente','Vigorbanda','Vigorgliera']:
    ['None','Everstone','Destiny Knot','Power Weight','Power Bracer','Power Belt','Power Lens','Power Band','Power Anklet'];
  const nature = (r: ReturnType<typeof eggFromKey6>) => r.everstone === null
    ? i18n.getNatureName(r.nature)
    : itemNames[1] + ' · ' + i18n.t(r.everstone ? 'gen6.maleParent' : 'gen6.femaleParent');
  const show = (r: ReturnType<typeof eggFromKey6>, extra: Parameters<typeof PokemonDetailCard6>[0]['extra'] = []) => (
    <PokemonDetailCard6
      nature={r.nature}
      everstoneLabel={r.everstone === null ? undefined : `${itemNames[1]} · ${i18n.t(r.everstone ? 'gen6.maleParent' : 'gen6.femaleParent')}`}
      ability={r.ability}
      gender={r.gender}
      hiddenPower={getHiddenPowerValue(r.ivs)}
      ivs={r.ivs}
      inherited={r.parents}
      pid={r.pid}
      ec={r.ec}
      psv={r.pid === null ? undefined : getPSV(r.pid)}
      prv={r.pid === null ? undefined : getPRV(r.pid)}
      extra={[
        { label: 'Key0 / Key1', value: `${toHex32(r.key[0])} / ${toHex32(r.key[1])}`, wide: true },
        ...extra,
      ]}
    />
  );
  const abLabel = (ab: number) => ab === 3 ? 'HA' : ab > 0 ? String(ab) : '-';
  const genderColor = (g: number) => g === 1 ? 'text-sky-400' : g === 2 ? 'text-pink-400' : 'text-zinc-400';
  return <FrameSearch6<EggRow6> title={i18n.t('nav.egg')} summary={profile.gameVersion+' · '+(q.accept&&!q.charm&&!q.masuda?'Main RNG Egg':'Egg RNG')} session={session} updateSession={updateSession} showTarget filters={{ mode: 'egg6', value: filter, change: setFilter }} worker={worker}
    run={()=>worker.searchEgg6({...range6(session),...q,delay,filter})}
    brief={r => <>
      <span className="text-xs font-semibold text-zinc-100">{nature(r)}</span>
      {r.shiny && <FrameShinyBadge square={r.square} />}
    </>}
    briefRight={r => <span className="flex shrink-0 items-center gap-2 font-mono text-xs text-zinc-300">
      <span>Ab {abLabel(r.ability)}</span>
      <span className={`font-bold ${genderColor(r.gender)}`}>{['-','♂','♀'][r.gender] ?? '-'}</span>
    </span>}
    briefSub={r => <div className="flex items-center justify-between gap-2">
      <FrameIvValues ivs={r.ivs} inherited={r.parents} />
      <span className="shrink-0 text-[11px] font-medium text-zinc-400">{i18n.t('search.hpShort')} {i18n.getHpTypeName(getHiddenPowerValue(r.ivs))}</span>
    </div>}
    detail={r => <>
      {r.shiny && <div><FrameShinyBadge square={r.square} /></div>}
      {show(r, [
        { label: i18n.t('misc.randomNumber'), value: toHex32(r.rand), wide: true, tone: 'amber' },
        { label: i18n.t('gen6.mtState'), value: toHex32(r.state), wide: true, tone: 'emerald' },
      ])}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" className="min-h-10 rounded-xl bg-amber-500 px-3 text-xs font-bold text-zinc-950 active:scale-95 transition"
          onClick={()=>{setKey(r.key.map(toHex32));updateSession({eggKey:r.key});}}>{it?'Usa chiave':'Use key'}</button>
        <CopyResultValue value={r.key.map(toHex32).join(',')} label={i18n.t('gen6.copyKey')} />
      </div>
    </>}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold text-zinc-300">Egg Key</span>
      {onOpenScan && (
        <button
          type="button"
          onClick={onOpenScan}
          aria-label={it ? 'Scansiona overlay' : 'Scan overlay'}
          className="min-h-11 px-2.5 -my-1.5 shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-amber-500/10 border border-amber-500/35 text-xs font-semibold text-amber-200 hover:border-amber-400/60 active:scale-95 transition"
        >
          <ScanText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden min-[400px]:inline">
            {it ? 'Scansiona overlay' : 'Scan overlay'}
          </span>
          <span className="min-[400px]:hidden">Overlay</span>
        </button>
      )}
    </div>
    <Pair6>{key.map((v,i)=><Text6 key={i} label={'Key'+i} value={v} limit={8} change={s=>{const next=key.map((k,j)=>j===i?s.toUpperCase():k);setKey(next);
      const parsed=next.map(parseHex32);if(parsed.every(w=>w!==null))updateSession({eggKey:parsed as EggKey6});}}/>)}</Pair6>
    {current&&<section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">{i18n.t('gen6.eggFromKey')}</h2>
        {current.shiny && <FrameShinyBadge square={current.square} />}
      </div>
      {show(current)}
    </section>}
    <Check6 label="Masuda" value={q.masuda} change={masuda=>update({masuda})}/>
    <Check6 label={it?'Accetta uovo':'Accept egg'} value={q.accept} change={accept=>{update({accept});setDelay(accept?16:0);}}/>
    <NumberField label={i18n.t('gen6.delay')} max={4000} value={delay} onChange={setDelay}/>
    <details><summary>{it?'Genitori e strumenti':'Parents and held items'}</summary>
      {(['male','female'] as const).map(parent=><fieldset key={parent} className="space-y-2 py-2"><legend>{parent==='male'?'♂':'♀'}</legend>
        <Select6 label={it?'Strumento':'Held item'} value={q[parent==='male'?'maleItem':'femaleItem']} options={itemNames.map((n,i)=>[i,n])} change={v=>update({[parent==='male'?'maleItem':'femaleItem']:+v})}/>
        <div className="grid grid-cols-2 gap-2">{q[parent].map((iv,i)=><NumberField key={i} label={['HP','Atk','Def','SpA','SpD','Spe'][i]!} value={iv} max={31}
          onChange={v=>update({[parent]:q[parent].map((old,j)=>i===j?v:old)})}/>)}</div></fieldset>)}
      <Select6 label={i18n.t('filters.ability')} value={q.ability} options={[[0,'1'],[1,'2'],[2,'HA']]} change={v=>update({ability:+v})}/>
      <Select6 label={i18n.t('gen6.genderRatio')} value={q.ratio} options={[[127,'1:1'],[31,'7:1'],[63,'3:1'],[191,'1:3'],[225,'1:7'],[254,'♀'],[0,'♂'],[255,'—']]} change={v=>update({ratio:+v})}/>
      <Check6 label="Nidoran / Volbeat / Illumise" value={q.nido} change={nido=>update({nido})}/>
      <Text6 label={it?'Altri TSV':'Other TSVs'} value={others} change={v=>{setOthers(v);update({otherTSVs:v.split(/[,\s]+/).filter(Boolean).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=4095)});}}/>
    </details>
  </FrameSearch6>;
}
