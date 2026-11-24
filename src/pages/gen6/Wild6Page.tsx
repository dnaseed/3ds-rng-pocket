import { useState } from 'react';
import { wildAreas6, wildGroup6, wildLocation6, wildSlots6, type WildMethod6 } from '../../data/wild6Catalog';
import { getPersonalEntry6 } from '../../data/personalTable6';
import { parseHex32, toHex32 } from '../../engine/math/uint';
import { createDefaultRngFilter } from '../../engine/core/filters';
import type { Wild6Request, WildRow6 } from '../../engine/gen6/wild6';
import type { Session6, TrainerProfile6 } from '../../services/gen6Storage';
import { computeTsvTrv } from '../../services/profileStorage';
import { useSearchWorker } from '../../workers/useSearchWorker';
import { useApp } from '../../store/AppContext';
import { SearchWorkspace } from '../../components/layout/SearchWorkspace';
import { SearchActionBar } from '../../components/results/SearchActionBar';
import { FilterBottomSheet, countActiveFilters } from '../../components/filters/FilterBottomSheet';
import { NumberField, cardClass } from './fields';
import { Check6, Pair6, Select6 } from './ToolFields6';
import { Details6, Results6, rowButtonClass, type Results6Data } from './Results6';

export function Wild6Page({profile,session,updateSession}:{profile:TrainerProfile6; session:Session6; updateSession:(patch:Partial<Session6>)=>void}) {
  const {i18n,lang}=useApp(), it=lang==='it', t=i18n.t;
  const game=profile.gameVersion, oras=game==='OR'||game==='AS';
  const methods=wildGroup6(game).methods;
  const names:Record<WildMethod6,string>={Normal:it?'Incontro normale':'Normal Wild',Horde:it?'Orda':'Horde',Fishing:it?'Pesca':'Fishing',RockSmash:it?'Spaccaroccia':'Rock Smash',FriendSafari:it?'Safari Amici':'Friend Safari',CaveShadow:it?'Ombre in grotta':'Cave Shadows',Trap:it?'Trappola':'Trap',DexNav:'DexNav',PokeRadar:'PokéRadar'};
  const [q,setQ]=useState({method:'Normal' as WildMethod6,area:0,rod:0,slot:0,delay:6,chain:0,ha:false,haSlot:0,potential:0,forceShiny:false,level:50,
    genderRatio:127,safariSlots:2,syncNature:-1,assumeSync:false,lead:'none' as Wild6Request['lead'],unown:false});
  const [dex,setDex]=useState({active:true,terrain:0,specialSlots:false,searchLevel:0});
  const [useTimeline,setUseTimeline]=useState(false);
  const [filter,setFilter]=useState(createDefaultRngFilter),[open,setOpen]=useState(false);
  const [result,setResult]=useState<Results6Data<WildRow6>|null>(null),[row,setRow]=useState<WildRow6|null>(null);
  const [error,setError]=useState('');
  const worker=useSearchWorker();
  const update=(patch:Partial<typeof q>)=>setQ(prev=>({...prev,...patch}));
  const areas=wildAreas6(game,q.method), area=areas[q.area], slots=area?wildSlots6(game,q.method,area,q.rod):[];
  const calibration=session.timeline?.oras===oras ? session.timeline : undefined;
  async function search() {
    setError('');
    if(session.startFrame>session.endFrame){setError(t('gen6.invalidRange'));return;}
    const {tsv,trv}=computeTsvTrv(profile.tid,profile.sid);
    try {
      const output=await worker.searchWild6({...q,...{tsv,trv},game,seed:parseHex32(session.initialSeedHex)??0,minFrame:session.startFrame,maxFrame:session.endFrame,
        charm:profile.shinyCharm,timeline:useTimeline?calibration:undefined,filter,dex:{...dex,chain:q.chain,charm:profile.shinyCharm,compoundEyes:q.lead==='compound'}});
      setResult({...output,summary:[game,names[q.method],area&&wildLocation6(area),session.initialSeedHex,'#'+session.startFrame+'–#'+session.endFrame].filter(Boolean).join(' · ')});
    } catch { /* The worker reports errors. */ }
  }
  return <><SearchWorkspace collapsed={false} actions={<SearchActionBar activeFilters={countActiveFilters(filter)} onOpenFilters={()=>setOpen(true)} isRunning={worker.isRunning} progress={worker.progress} onSearch={()=>void search()} onAbort={worker.abort}/>}
    results={<Results6 result={result} error={error||worker.error} renderRow={r=><button className={rowButtonClass} onClick={()=>setRow(r)}>
      <b>#{r.frame}</b> · {r.members.length===5 ? (it?'Orda':'Horde')+' '+r.matches.length+'/5' : r.members[0]!.species?i18n.getSpeciesName(r.members[0]!.species):'Slot '+r.slot}
      <div className="font-mono text-xs">PID {toHex32(r.members[r.matches[0]!-1]!.pid)}</div></button>}/>}>
    <section className={cardClass}><h1 className="font-bold">Wild · {game}</h1>
      <Select6 label={it?'Metodo':'Method'} value={q.method} options={Array.from(new Set(methods.map(m=>m.method as WildMethod6))).map(m=>[m,names[m]])}
        change={v=>update({method:v as WildMethod6,area:0,slot:0,rod:0,delay:methods.find(m=>m.method===v)!.delay,chain:0,ha:false,forceShiny:false})}/>
      {q.method==='Fishing'&&<Select6 label={it?'Canna':'Rod'} value={q.rod} options={(it?['Amo Vecchio','Amo Buono','Super Amo']:['Old Rod','Good Rod','Super Rod']).map((n,i)=>[i,n])} change={v=>update({rod:+v,slot:0})}/>}
      {areas.length>0&&<Select6 label={it?'Località':'Location'} value={q.area} options={areas.map((a,i)=>[i,wildLocation6(a)])} change={v=>update({area:+v,slot:0})}/>}
      {slots.length>0&&<Select6 label="Slot" value={q.slot} options={[[0,'—'],...slots.map((s,i)=>[i+1,(i+1)+' · '+i18n.getSpeciesName(s.species&2047)] as const)]} change={v=>update({slot:+v})}/>}
      <Pair6><NumberField label={t('search.startFrame')} value={session.startFrame} onChange={startFrame=>updateSession({startFrame})}/>
        <NumberField label={t('search.endFrame')} value={session.endFrame} onChange={endFrame=>updateSession({endFrame})}/></Pair6>
      {calibration&&<Check6 label="TinyMT Timeline" value={useTimeline} change={setUseTimeline}/>}
      {['Fishing','PokeRadar','DexNav'].includes(q.method)&&<NumberField label={it?'Catena':'Chain length'} value={q.chain} max={999} onChange={chain=>update({chain})}/>}
      {q.method==='DexNav'&&<><NumberField label="Search Level" value={dex.searchLevel} max={999} onChange={searchLevel=>setDex({...dex,searchLevel})}/>
        <Check6 label={it?'Ricerca attiva':'Active search'} value={dex.active} change={active=>setDex({...dex,active})}/>
        <Select6 label={it?'Terreno':'Terrain'} value={dex.terrain} options={[[0,it?'Erba':'Grass'],[1,it?'Erba alta':'Tall grass'],[2,'Surf']]} change={v=>setDex({...dex,terrain:+v})}/>
        <Check6 label="DexNav slots" value={dex.specialSlots} change={specialSlots=>setDex({...dex,specialSlots})}/>
        <Check6 label="Unown" value={q.unown} change={unown=>update({unown})}/>
        <NumberField label={it?'Potenziale':'Potential'} value={q.potential} max={3} onChange={potential=>update({potential})}/></>}
      {q.method==='FriendSafari'&&<NumberField label="Safari slots" value={q.safariSlots} min={2} max={3} onChange={safariSlots=>update({safariSlots})}/>}
      {['DexNav','FriendSafari'].includes(q.method)&&<Check6 label={it?'Abilità nascosta':'Hidden ability'} value={q.ha} change={ha=>update({ha})}/>}
      {['DexNav','PokeRadar'].includes(q.method)&&<Check6 label={t('gen6.forceShiny')} value={q.forceShiny} change={forceShiny=>update({forceShiny})}/>}
      {q.method==='Horde'&&<NumberField label="HA slot" max={5} value={q.haSlot} onChange={haSlot=>update({haSlot})}/>}
      {q.method==='PokeRadar'&&q.chain>0&&<NumberField label={t('filters.level')} value={q.level} min={1} max={100} onChange={level=>update({level})}/>}
    </section>
    <details className={cardClass}><summary>{t('gen6.advanced')}</summary>
      <NumberField label={t('gen6.delay')} max={4000} value={q.delay} onChange={delay=>update({delay})}/>
      <Select6 label="Lead" value={q.lead} options={Object.entries({none:'—',static:'Static',magnet:'Magnet Pull',cuteM:'Cute Charm ♂',cuteF:'Cute Charm ♀',pressure:'Pressure',black:'Black Flute',white:'White Flute',compound:'Compound Eyes'})} change={v=>update({lead:v as Wild6Request['lead']})}/>
      <Select6 label={t('gen6.genderRatio')} value={q.genderRatio} options={[[127,'1:1'],[31,'7:1'],[63,'3:1'],[191,'1:3'],[225,'1:7'],[0,'♂'],[254,'♀'],[255,'—']]} change={v=>update({genderRatio:+v})}/>
      <Select6 label={t('stationary.syncNature')} value={q.syncNature} options={[[-1,'—'],...Array.from({length:25},(_,i)=>[i,i18n.getNatureName(i)] as const)]} change={v=>update({syncNature:+v})}/>
      <Check6 label={t('gen6.assumeSynced')} value={q.assumeSync} change={assumeSync=>update({assumeSync})}/>
    </details>
    </SearchWorkspace>
    <FilterBottomSheet open={open} onClose={()=>setOpen(false)} mode="wild" filter={filter} onChange={setFilter} allowExactStats={false} personalData={{speciesCount:721,getEntry:getPersonalEntry6}}/>
    <Details6 open={!!row} title={'Frame #'+row?.frame} onClose={()=>setRow(null)}>{row&&<>
      <p className="font-mono text-xs">MT {toHex32(row.state)} · Rand {toHex32(row.rand)}</p>
      {row.dex&&<p>DexNav ({row.dex.x}, {row.dex.y}) · Slot {row.dex.slot+1} · +{row.dex.levelBoost} Lv · HA {row.dex.ha?'✓':'×'} · Egg move {row.dex.eggMove?'✓':'×'}</p>}
      <ol className="space-y-2">{row.members.map((p,i)=><li key={i} className="rounded-xl border border-zinc-700 p-2">
        <strong>{row.matches.includes(i+1)?'✓ ':''}{i+1} · {p.species?i18n.getSpeciesName(p.species):'—'} · Lv. {p.level} {p.shiny?'★':''}</strong>
        <p>{i18n.getNatureName(p.nature)} · {['—','♂','♀'][p.gender]} · {t('filters.ability')} {p.ability===3?'HA':p.ability} · Slot {p.slot}</p>
        <p className="font-mono">IV {p.ivs.join(' / ')}<br/>PID {toHex32(p.pid)} · EC {toHex32(p.ec)}<br/>PSV/PRV {p.psv}/{p.prv.toString(16).toUpperCase()}</p>
      </li>)}</ol></>}</Details6></>;
}
