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
import { FrameField, FrameIvValues, FrameShinyBadge, FrameSyncBadge } from '../../components/results/FrameValues';
import { SearchWorkspace } from '../../components/layout/SearchWorkspace';
import { SearchActionBar } from '../../components/results/SearchActionBar';
import { FilterBottomSheet, countActiveFilters } from '../../components/filters/FilterBottomSheet';
import { NumberField, cardClass } from './fields';
import { Check6, Pair6, Select6 } from './ToolFields6';
import { CopyResultValue, Details6, MtFrameTiming, PokemonDetailCard6, Results6, rowButtonClass, StatValues6, type Results6Data } from './Results6';

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
  const [result,setResult]=useState<(Results6Data<WildRow6> & { startFrame: number; targetFrame: number }) | null>(null),[row,setRow]=useState<WildRow6|null>(null);
  const [showStats,setShowStats]=useState(false);
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
      setResult({...output,startFrame:session.startFrame,targetFrame:session.targetFrame,summary:[game,names[q.method],area&&wildLocation6(area),session.initialSeedHex, '#' + session.startFrame + '–#' + session.endFrame,
        useTimeline && calibration ? 'TinyMT Timeline' : '',
        countActiveFilters(filter) ? t('search.filters') + ' ' + countActiveFilters(filter) : ''].filter(Boolean).join(' · ')});
    } catch { /* The worker reports errors. */ }
  }
  return <><SearchWorkspace collapsible={!!result} actions={<SearchActionBar activeFilters={countActiveFilters(filter)} onOpenFilters={()=>setOpen(true)} isRunning={worker.isRunning} progress={worker.progress} onSearch={()=>void search()} onAbort={worker.abort}/>}
    results={<Results6 result={result} error={error||worker.error}
      headerExtra={<button type="button" aria-pressed={showStats} onClick={() => setShowStats(value => !value)}
        className={`min-h-10 rounded-xl border px-2.5 text-xs font-semibold transition ${showStats
          ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
          : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'}`}>
        {t('search.showStats')}
      </button>}
      renderRow={r => {
      const member = r.members[r.matches[0]! - 1]!;
      const horde = r.members.length === 5;
      const abLabel = member.ability === 3 ? 'HA' : member.ability > 0 ? String(member.ability) : '-';
      const genderLabel = ['-', '♂', '♀'][member.gender] ?? '-';
      const genderTone = member.gender === 1 ? 'text-sky-400' : member.gender === 2 ? 'text-pink-400' : 'text-zinc-400';
      return <button type="button" className={rowButtonClass} onClick={() => setRow(r)}>
        <div className="flex items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <b className="font-mono text-amber-300">#{r.frame}</b>
            {horde && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-300">{names.Horde} · {r.matches.length}/5</span>}
            <span className="font-semibold text-zinc-100">{member.species ? i18n.getSpeciesName(member.species) : 'Slot ' + r.slot}</span>
            {member.level > 0 && <span className="text-xs text-zinc-400">Lv. {member.level}</span>}
            <span className="text-xs text-zinc-200">{i18n.getNatureName(member.nature)}</span>
            {member.synchronize && <FrameSyncBadge synced />}
            {member.shiny && <FrameShinyBadge square={member.squareShiny} />}
          </span>
          <span className="flex shrink-0 items-center gap-2 font-mono text-xs text-zinc-300">
            <span>Ab {abLabel}</span>
            <span className={`font-bold ${genderTone}`}>{genderLabel}</span>
          </span>
        </div>
        {horde && <span className="block text-xs text-zinc-400">{`${t('gen6.member')} ${r.matches[0]}`}</span>}
        <div className="flex items-center justify-between gap-2">
          {showStats && member.species > 0 && member.level > 0
            ? <StatValues6 ivs={member.ivs} nature={member.nature} level={member.level} species={member.species} forme={member.forme} />
            : <FrameIvValues ivs={member.ivs} />}
          <span className="shrink-0 text-[11px] font-medium text-zinc-400">
            {t('search.hpShort')} {i18n.getHpTypeName(member.hiddenPower)}
          </span>
        </div>
      </button>;
    }}/>}>
    <section className={cardClass}><h1 className="font-bold">{t('nav.wild')} · {game}</h1>
      <Select6 label={it?'Metodo':'Method'} value={q.method} options={Array.from(new Set(methods.map(m=>m.method as WildMethod6))).map(m=>[m,names[m]])}
        change={v=>update({method:v as WildMethod6,area:0,slot:0,rod:0,delay:methods.find(m=>m.method===v)!.delay,chain:0,ha:false,forceShiny:false})}/>
      {q.method==='Fishing'&&<Select6 label={it?'Canna':'Rod'} value={q.rod} options={(it?['Amo Vecchio','Amo Buono','Super Amo']:['Old Rod','Good Rod','Super Rod']).map((n,i)=>[i,n])} change={v=>update({rod:+v,slot:0})}/>}
      {areas.length>0&&<Select6 label={it?'Località':'Location'} value={q.area} options={areas.map((a,i)=>[i,wildLocation6(a)])} change={v=>update({area:+v,slot:0})}/>}
      {slots.length>0&&<Select6 label="Slot" value={q.slot} options={[[0,'—'],...slots.map((s,i)=>[i+1,(i+1)+' · '+i18n.getSpeciesName(s.species&2047)] as const)]} change={v=>update({slot:+v})}/>}
      <Pair6><NumberField label={t('search.startFrame')} value={session.startFrame} onChange={startFrame=>updateSession({startFrame})}/>
        <NumberField label={t('search.endFrame')} value={session.endFrame} onChange={endFrame=>updateSession({endFrame})}/></Pair6>
      {calibration&&<Check6 label="TinyMT Timeline" value={useTimeline} change={setUseTimeline}/>}
      {['Fishing','PokeRadar','DexNav'].includes(q.method)&&<NumberField label={it?'Catena':'Chain length'} value={q.chain} max={999} onChange={chain=>update({chain})}/>}
      {q.method==='DexNav'&&<><NumberField label={t('gen6.searchLevel')} value={dex.searchLevel} max={999} onChange={searchLevel=>setDex({...dex,searchLevel})}/>
        <Check6 label={it?'Ricerca attiva':'Active search'} value={dex.active} change={active=>setDex({...dex,active})}/>
        <Select6 label={it?'Terreno':'Terrain'} value={dex.terrain} options={[[0,it?'Erba':'Grass'],[1,it?'Erba alta':'Tall grass'],[2,'Surf']]} change={v=>setDex({...dex,terrain:+v})}/>
        <Check6 label={t('gen6.dexSlots')} value={dex.specialSlots} change={specialSlots=>setDex({...dex,specialSlots})}/>
        <Check6 label="Unown" value={q.unown} change={unown=>update({unown})}/>
        <NumberField label={it?'Potenziale':'Potential'} value={q.potential} max={3} onChange={potential=>update({potential})}/></>}
      {q.method==='FriendSafari'&&<NumberField label={t('gen6.safariSlots')} value={q.safariSlots} min={2} max={3} onChange={safariSlots=>update({safariSlots})}/>}
      {['DexNav','FriendSafari'].includes(q.method)&&<Check6 label={it?'Abilità nascosta':'Hidden ability'} value={q.ha} change={ha=>update({ha})}/>}
      {['DexNav','PokeRadar'].includes(q.method)&&<Check6 label={t('gen6.forceShiny')} value={q.forceShiny} change={forceShiny=>update({forceShiny})}/>}
      {q.method==='Horde'&&<NumberField label={t('gen6.haSlot')} max={5} value={q.haSlot} onChange={haSlot=>update({haSlot})}/>}
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
    <FilterBottomSheet open={open} onClose={()=>setOpen(false)} mode="wild" showSpecialOnly={false} filter={filter} onChange={setFilter} allowExactStats={false} personalData={{speciesCount:721,getEntry:getPersonalEntry6}}/>
    <Details6 open={!!row} title={'Frame #'+row?.frame} onClose={()=>setRow(null)}>{row && result && <>
      <MtFrameTiming frame={row.frame} startFrame={result.startFrame} targetFrame={result.targetFrame} />
      <dl className="grid grid-cols-2 gap-2">
        <FrameField label={t('misc.randomNumber')}>{toHex32(row.rand)}</FrameField>
        <FrameField label={t('gen6.mtState')}>{toHex32(row.state)}</FrameField>
      </dl>
      {row.dex&&<p className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200">DexNav ({row.dex.x}, {row.dex.y}) · Slot {row.dex.slot+1} · +{row.dex.levelBoost} Lv
        {' · '}{it?'Potenziale':'Potential'} {row.dex.potential} · HA {row.dex.ha?'✓':'×'}
        {' · '}{it?'Mossa uovo':'Egg move'} {row.dex.eggMove?'✓':'×'}{row.dex.boost?' · Boost':''}</p>}
      <ol className="space-y-3">{row.members.map((p,i)=><li key={i} className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {row.matches.includes(i + 1) && <span className="text-emerald-300" title={t('gen6.filterMatch')}>✓<span className="sr-only">{t('gen6.filterMatch')}</span></span>}
          <span>{i+1} · {p.species?i18n.getSpeciesName(p.species):'Slot ' + p.slot}{p.level > 0 && ` · Lv. ${p.level}`}</span>
          {p.shiny && <FrameShinyBadge square={p.squareShiny} />}
        </div>
        <PokemonDetailCard6
          species={p.species} forme={p.forme} level={p.level}
          nature={p.nature} synchronized={p.synchronize} ability={p.ability} gender={p.gender}
          hiddenPower={p.hiddenPower} ivs={p.ivs} pid={p.pid} ec={p.ec} psv={p.psv} prv={p.prv}
          extra={[
            { label: 'Slot', value: p.slot },
            ...(p.item!==null ? [{ label: it?'Strumento':'Held Item', value: ['50%','5%','1%','—'][p.item] }] : []),
            ...(p.species === 201 ? [{ label: t('event.forme'), value: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!?'[p.forme] ?? p.forme }] : []),
          ]}
        />
      </li>)}</ol><CopyResultValue value={toHex32(row.state)} label={t('gen6.copyState')} /></>}</Details6></>;
}
