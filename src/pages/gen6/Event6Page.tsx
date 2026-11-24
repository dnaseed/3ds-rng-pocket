import { useState } from 'react';
import { parseWc6, type WonderCard6, type EventRow6 } from '../../engine/gen6/event6';
import { getPersonalEntry6 } from '../../data/personalTable6';
import { computeTsvTrv } from '../../services/profileStorage';
import { useApp } from '../../store/AppContext';
import { useSearchWorker } from '../../workers/useSearchWorker';
import { parseHex32, toHex32 } from '../../engine/math/uint';
import { FrameSearch6, range6, type Page6Props } from './FrameSearch6';
import { Check6, Pair6, Select6, Text6 } from './ToolFields6';
import { NumberField } from './fields';

export function Event6Page({profile,session,updateSession}:Page6Props) {
  const {i18n,lang}=useApp(), it=lang==='it',t=i18n.t;
  const [card,setCard]=useState<WonderCard6>({species:25,forme:0,level:50,abilityLocked:false,ability:0,natureLocked:false,nature:0,genderLocked:false,gender:0,
    ivsCount:0,ivs:[-1,-1,-1,-1,-1,-1],tid:0,sid:0,pidType:0,pid:0,ec:0,isEgg:false,yourId:true,otherInfo:true});
  const [pid,setPid]=useState('00000000'),[ec,setEc]=useState('00000000'),[error,setError]=useState(''),[delay,setDelay]=useState(0);
  const change=(patch:Partial<WonderCard6>)=>setCard(old=>({...old,...patch}));
  const worker=useSearchWorker();
  async function importFile(file:File) {
    try {
      const parsed=parseWc6(file.name,new Uint8Array(await file.arrayBuffer()));
      if(!parsed) throw Error();
      setCard(parsed);setEc(toHex32(parsed.ec));setPid(toHex32(parsed.pid));setError('');
    } catch {setError(it?'Seleziona una Wonder Card Pokémon Gen 6 valida.':'Select a valid Gen 6 Pokémon Wonder Card.');}
  }
  async function run() {
    const parsedEC=parseHex32(ec), parsedPID=parseHex32(pid);
    if(parsedEC===null || (card.pidType===3&&parsedPID===null)) throw Error(t('gen6.seedInvalid'));
    return worker.searchEvent6({...range6(session),card:{...card,pid:parsedPID??0,ec:parsedEC},delay,
      oras:profile.gameVersion==='OR'||profile.gameVersion==='AS',trainerTSV:computeTsvTrv(profile.tid,profile.sid).tsv});
  }
  return <FrameSearch6<EventRow6> title="Event" summary={profile.gameVersion+' · '+i18n.getSpeciesName(card.species)} worker={worker} run={run} session={session} updateSession={updateSession}
    brief={r=>i18n.getNatureName(r.nature)+' · PID '+toHex32(r.pid)} detail={r=><><p>{i18n.getSpeciesName(r.species)} · Lv. {r.level} {r.shiny?'★':''}</p><p>IV {r.ivs.join(' / ')}</p>
      <p>{i18n.getNatureName(r.nature)} · {['—','♂','♀'][r.gender]} · {t('filters.ability')} {r.ability}</p>
      <p className="font-mono">PID {toHex32(r.pid)} · EC {toHex32(r.ec)}<br/>PSV {r.psv} · PRV {r.prv.toString(16)}<br/>Rand {toHex32(r.rand)} · MT {toHex32(r.state)}</p></>}>
    <label className="block">{it?'Importa Wonder Card':'Import Wonder Card'}<input className="block w-full" type="file" accept=".wc6,.wc6full" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void importFile(file);}}/></label>
    {error&&<p role="alert">{error}</p>}
    <Select6 label={t('event.species')} value={card.species} options={Array.from({length:722},(_,i)=>[i,i?i18n.getSpeciesName(i):'—'])} change={v=>change({species:+v,forme:0})}/>
    <Pair6><NumberField label={t('event.forme')} value={card.forme} max={Math.max(0,getPersonalEntry6(card.species).formeCount-1)} onChange={forme=>change({forme})}/>
      <NumberField label={t('filters.level')} value={card.level} min={1} max={100} onChange={level=>change({level})}/></Pair6>
    <Select6 label="PID" value={card.pidType} options={[[0,it?'Casuale':'Random'],[1,it?'Mai shiny':'Never shiny'],[2,'Shiny'],[3,it?'Fisso':'Fixed']]} change={v=>change({pidType:+v as WonderCard6['pidType']})}/>
    {card.pidType===3&&<Text6 label="PID (hex)" value={pid} change={setPid} limit={8}/>}<Text6 label="EC (hex)" value={ec} change={setEc} limit={8}/>
    <Check6 label="Your ID" value={card.yourId} change={yourId=>change({yourId})}/>
    {!card.yourId&&<Pair6>{(['tid','sid'] as const).map(k=><NumberField key={k} label={k.toUpperCase()} value={card[k]} max={65535} onChange={v=>change({[k]:v})}/>)}</Pair6>}
    <Check6 label={it?'Dati OT disponibili':'OT information available'} value={card.otherInfo} change={otherInfo=>change({otherInfo})}/>
    <Check6 label={t('nav.egg')} value={card.isEgg} change={isEgg=>change({isEgg})}/>
    <Select6 label={t('search.nature')} value={card.natureLocked?card.nature:-1} options={[[-1,'—'],...Array.from({length:25},(_,i)=>[i,i18n.getNatureName(i)] as const)]} change={v=>change({natureLocked:+v>=0,nature:Math.max(0,+v)})}/>
    <Select6 label={t('filters.gender')} value={card.genderLocked?card.gender:-1} options={[[-1,it?'Casuale':'Random'],[0,'—'],[1,'♂'],[2,'♀']]} change={v=>change({genderLocked:+v>=0,gender:Math.max(0,+v)})}/>
    <Select6 label={t('filters.ability')} value={card.abilityLocked?card.ability:card.ability===0?-1:-2} options={[[-1,'1 / 2'],[-2,'1 / 2 / HA'],[0,'—'],[1,'1'],[2,'2'],[3,'HA']]} change={v=>change({abilityLocked:+v>=0,ability:+v<0?-Number(v)-1:+v})}/>
    <NumberField label={it?'IV perfetti garantiti':'Guaranteed perfect IVs'} value={card.ivsCount} max={6} onChange={ivsCount=>change({ivsCount})}/>
    <div className="grid grid-cols-3 gap-1">{card.ivs.map((iv,i)=><Select6 key={i} label={['HP','Atk','Def','SpA','SpD','Spe'][i]!} value={iv} options={[[-1,'—'],...Array.from({length:32},(_,v)=>[v,String(v)] as const)]} change={v=>{
      const ivs=[...card.ivs] as WonderCard6['ivs'];ivs[i]=+v;change({ivs});}}/>)}</div>
    <NumberField label={t('gen6.delay')} max={4000} value={delay} onChange={setDelay}/>
  </FrameSearch6>;
}
