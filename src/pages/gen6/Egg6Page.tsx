import { useState } from 'react';
import { eggFromKey6, type Egg6Options, type EggKey6, type EggRow6 } from '../../engine/gen6/egg6';
import { parseHex32, toHex32 } from '../../engine/math/uint';
import { computeTsvTrv } from '../../services/profileStorage';
import { useApp } from '../../store/AppContext';
import { useSearchWorker } from '../../workers/useSearchWorker';
import { FrameSearch6, range6, type Page6Props } from './FrameSearch6';
import { Check6, Pair6, Select6, Text6 } from './ToolFields6';
import { buttonClass, NumberField } from './fields';

export function Egg6Page({profile,session,updateSession}:Page6Props) {
  const {i18n,lang}=useApp(), it=lang==='it';
  const ids=computeTsvTrv(profile.tid,profile.sid);
  const [q,setQ]=useState<Egg6Options>({male:Array(6).fill(31),female:Array(6).fill(31),maleItem:0,femaleItem:0,ability:0,ratio:127,nido:false,masuda:false,
    charm:profile.shinyCharm,accept:true,tsv:ids.tsv,trv:ids.trv,otherTSVs:[]});
  const update=(patch:Partial<Egg6Options>)=>setQ(prev=>({...prev,...patch}));
  const [delay,setDelay]=useState(16);
  const [key,setKey]=useState<string[]>(session.eggKey?.map(toHex32)??['','']);
  const [others,setOthers]=useState('');
  const words=key.map(parseHex32);
  const current=words.every(w=>w!==null)?eggFromKey6(q,words as EggKey6):null;
  const worker=useSearchWorker();
  const itemNames=it?['Nessuno','Pietrastante','Destincomune','Vigorpeso','Vigorcerchio','Vigorfascia','Vigorlente','Vigorbanda','Vigorgliera']:
    ['None','Everstone','Destiny Knot','Power Weight','Power Bracer','Power Belt','Power Lens','Power Band','Power Anklet'];
  const show=(r:ReturnType<typeof eggFromKey6>)=><><p className="font-mono">Key0 {toHex32(r.key[0])} · Key1 {toHex32(r.key[1])}</p><p>PID {r.pid===null?'—':toHex32(r.pid)} · EC {toHex32(r.ec)} {r.shiny?'★':''}</p>
    <p>{r.everstone===null?i18n.getNatureName(r.nature):(r.everstone?'♂':'♀')+' · '+itemNames[1]} · {i18n.t('filters.ability')} {r.ability} · {['—','♂','♀'][r.gender]}</p>
    <p>IV {r.ivs.map((iv,i)=>iv+(r.parents[i]===null?'':r.parents[i]?'♂':'♀')).join(' / ')}</p></>;
  return <FrameSearch6<EggRow6> title={i18n.t('nav.egg')} summary={profile.gameVersion+' · '+(q.accept&&!q.charm&&!q.masuda?'Main RNG Egg':'Egg RNG')} session={session} updateSession={updateSession} worker={worker}
    run={()=>worker.searchEgg6({...range6(session),...q,delay})} brief={r=>r.key.map(toHex32).join(' / ')} detail={r=><>{show(r)}<button className={buttonClass} onClick={()=>{setKey(r.key.map(toHex32));updateSession({eggKey:r.key});}}>{it?'Usa chiave':'Use key'}</button></>}>
    <Pair6>{key.map((v,i)=><Text6 key={i} label={'Key'+i} value={v} limit={8} change={s=>{const next=key.map((k,j)=>j===i?s.toUpperCase():k);setKey(next);
      const parsed=next.map(parseHex32);if(parsed.every(w=>w!==null))updateSession({eggKey:parsed as EggKey6});}}/>)}</Pair6>
    {current&&<section><h2>{it?'Uovo corrente':'Current egg'}</h2>{show(current)}</section>}
    <Check6 label="Masuda" value={q.masuda} change={masuda=>update({masuda})}/>
    <Check6 label={it?'Accetta uovo':'Accept egg'} value={q.accept} change={accept=>{update({accept});setDelay(accept?16:0);}}/>
    <NumberField label={i18n.t('gen6.delay')} max={4000} value={delay} onChange={setDelay}/>
    <details><summary>{it?'Genitori e strumenti':'Parents and held items'}</summary>
      {(['male','female'] as const).map(parent=><fieldset key={parent} className="space-y-2 py-2"><legend>{parent==='male'?'♂':'♀'}</legend>
        <Select6 label={it?'Strumento':'Held item'} value={q[parent==='male'?'maleItem':'femaleItem']} options={itemNames.map((n,i)=>[i,n])} change={v=>update({[parent==='male'?'maleItem':'femaleItem']:+v})}/>
        <div className="grid grid-cols-3 gap-1">{q[parent].map((iv,i)=><NumberField key={i} label={['HP','Atk','Def','SpA','SpD','Spe'][i]!} value={iv} max={31}
          onChange={v=>update({[parent]:q[parent].map((old,j)=>i===j?v:old)})}/>)}</div></fieldset>)}
      <Select6 label={i18n.t('filters.ability')} value={q.ability} options={[[0,'1'],[1,'2'],[2,'HA']]} change={v=>update({ability:+v})}/>
      <Select6 label={i18n.t('gen6.genderRatio')} value={q.ratio} options={[[127,'1:1'],[31,'7:1'],[63,'3:1'],[191,'1:3'],[225,'1:7'],[254,'♀'],[0,'♂'],[255,'—']]} change={v=>update({ratio:+v})}/>
      <Check6 label="Nidoran / Volbeat / Illumise" value={q.nido} change={nido=>update({nido})}/>
      <Text6 label={it?'Altri TSV':'Other TSVs'} value={others} change={v=>{setOthers(v);update({otherTSVs:v.split(/[,\s]+/).filter(Boolean).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=4095)});}}/>
    </details>
  </FrameSearch6>;
}
