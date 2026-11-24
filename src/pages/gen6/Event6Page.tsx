import { Upload } from 'lucide-react';
import { FrameIvValues, FrameShinyBadge } from '../../components/results/FrameValues';
import { CopyResultValue, PokemonDetailCard6 } from './Results6';
import { useState } from 'react';
import { createDefaultRngFilter } from '../../engine/core/filters';
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
  const change=(patch:Partial<WonderCard6>)=>{setFilename('');setCard(old=>({...old,...patch}));};
  const worker=useSearchWorker();
  const [filter, setFilter] = useState(createDefaultRngFilter);
  const [filename, setFilename] = useState('');
  async function importFile(file:File) {
    try {
      const parsed=parseWc6(file.name,new Uint8Array(await file.arrayBuffer()));
      if(!parsed) throw Error();
      setFilename(file.name);setCard(parsed);setEc(toHex32(parsed.ec));setPid(toHex32(parsed.pid));setError('');
    } catch {setError(it?'Seleziona una Wonder Card Pokémon Gen 6 valida.':'Select a valid Gen 6 Pokémon Wonder Card.');}
  }
  async function run() {
    const parsedEC=parseHex32(ec), parsedPID=parseHex32(pid);
    if(parsedEC===null || (card.pidType===3&&parsedPID===null)) throw Error(t('gen6.seedInvalid'));
    return worker.searchEvent6({...range6(session),card:{...card,pid:parsedPID??0,ec:parsedEC},delay,
      oras:profile.gameVersion==='OR'||profile.gameVersion==='AS',filter, trainerTSV:computeTsvTrv(profile.tid,profile.sid).tsv});
  }
  return <FrameSearch6<EventRow6> title={t('nav.event')} summary={[profile.gameVersion, i18n.getSpeciesName(card.species), filename].filter(Boolean).join(' · ')} worker={worker} run={run} session={session} updateSession={updateSession} showTarget filters={{ mode: 'event', value: filter, change: setFilter }}
    brief={r => <>
      <span className="font-semibold text-zinc-100">{i18n.getSpeciesName(r.species)}</span>
      {r.forme > 0 && <span className="text-xs text-zinc-400">{t('event.forme')} {r.forme}</span>}
      <span className="text-xs text-zinc-200">{i18n.getNatureName(r.nature)}</span>
      {r.shiny && <FrameShinyBadge />}
    </>}
    briefRight={r => <span className="flex shrink-0 items-center gap-2 font-mono text-xs text-zinc-300">
      <span>Ab {r.ability === 3 ? 'HA' : r.ability > 0 ? String(r.ability) : '-'}</span>
      <span className={`font-bold ${r.gender === 1 ? 'text-sky-400' : r.gender === 2 ? 'text-pink-400' : 'text-zinc-400'}`}>{['-','♂','♀'][r.gender] ?? '-'}</span>
    </span>}
    briefSub={r => <div className="flex items-center justify-between gap-2">
      <FrameIvValues ivs={r.ivs} />
      <span className="shrink-0 text-[11px] font-medium text-zinc-400">{t('search.hpShort')} {i18n.getHpTypeName(r.hiddenPower)}</span>
    </div>}
    detail={r=><>
      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-200">
        <span className="font-semibold">{i18n.getSpeciesName(r.species)} · Lv. {r.level}{r.forme > 0 ? ` · ${t('event.forme')} ${r.forme}` : ''}</span>
        {r.shiny && <FrameShinyBadge />}
      </div>
      <PokemonDetailCard6
        species={r.species} forme={r.forme} level={r.level}
        nature={r.nature} ability={r.ability} gender={r.gender} hiddenPower={r.hiddenPower}
        ivs={r.ivs} pid={r.pid} ec={r.ec} psv={r.psv} prv={r.prv}
        extra={[
          { label: t('misc.randomNumber'), value: toHex32(r.rand), wide: true, tone: 'amber' },
          { label: t('gen6.mtState'), value: toHex32(r.state), wide: true, tone: 'emerald' },
        ]}
      />
      <CopyResultValue value={toHex32(r.state)} label={t('gen6.copyState')} />
    </>}>
    <label className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-xs font-semibold text-zinc-100 hover:border-zinc-500 focus-within:outline-2 focus-within:outline-amber-400"><Upload className="size-4 text-amber-400" aria-hidden="true" />{it?'Importa .wc6 / .wc6full':'Import .wc6 / .wc6full'}<input className="sr-only" type="file" accept=".wc6,.wc6full" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void importFile(file);}}/></label>
    <p role="status" className="break-all text-xs text-zinc-400">{filename || t('gen6.manualEvent')}</p>
    {error&&<p role="alert">{error}</p>}
    <Select6 label={t('event.species')} value={card.species} options={Array.from({length:722},(_,i)=>[i,i?i18n.getSpeciesName(i):'—'])} change={v=>change({species:+v,forme:0})}/>
    <Pair6><NumberField label={t('event.forme')} value={card.forme} max={Math.max(0,getPersonalEntry6(card.species).formeCount-1)} onChange={forme=>change({forme})}/>
      <NumberField label={t('filters.level')} value={card.level} min={1} max={100} onChange={level=>change({level})}/></Pair6>
    <Select6 label="PID" value={card.pidType} options={[[0,it?'Casuale':'Random'],[1,it?'Mai shiny':'Never shiny'],[2,'Shiny'],[3,it?'Fisso':'Fixed']]} change={v=>change({pidType:+v as WonderCard6['pidType']})}/>
    {card.pidType===3&&<Text6 label="PID (hex)" value={pid} change={value => { setFilename(''); setPid(value); }} limit={8}/>}<Text6 label="EC (hex)" value={ec} change={value => { setFilename(''); setEc(value); }} limit={8}/>
    <Check6 label={t('gen6.playerId')} value={card.yourId} change={yourId=>change({yourId})}/>
    {!card.yourId&&<Pair6>{(['tid','sid'] as const).map(k=><NumberField key={k} label={k.toUpperCase()} value={card[k]} max={65535} onChange={v=>change({[k]:v})}/>)}</Pair6>}
    <Check6 label={t('gen6.otInfo')} value={card.otherInfo} change={otherInfo=>change({otherInfo})}/>
    <Check6 label={it ? 'Uovo' : 'Egg'} value={card.isEgg} change={isEgg=>change({isEgg})}/>
    <Select6 label={t('search.nature')} value={card.natureLocked?card.nature:-1} options={[[-1,'—'],...Array.from({length:25},(_,i)=>[i,i18n.getNatureName(i)] as const)]} change={v=>change({natureLocked:+v>=0,nature:Math.max(0,+v)})}/>
    <Select6 label={t('filters.gender')} value={card.genderLocked?card.gender:-1} options={[[-1,it?'Casuale':'Random'],[0,'—'],[1,'♂'],[2,'♀']]} change={v=>change({genderLocked:+v>=0,gender:Math.max(0,+v)})}/>
    <Select6 label={t('filters.ability')} value={card.abilityLocked?card.ability:card.ability===0?-1:-2} options={[[-1,'1 / 2'],[-2,'1 / 2 / HA'],[0,'—'],[1,'1'],[2,'2'],[3,'HA']]} change={v=>change({abilityLocked:+v>=0,ability:+v<0?-Number(v)-1:+v})}/>
    <NumberField label={t('gen6.guaranteedIv')} value={card.ivsCount} max={6} onChange={ivsCount=>change({ivsCount})}/>
    <div className="grid grid-cols-3 gap-1">{card.ivs.map((iv,i)=><Select6 key={i} label={['HP','Atk','Def','SpA','SpD','Spe'][i]!} value={iv} options={[[-1,'—'],...Array.from({length:32},(_,v)=>[v,String(v)] as const)]} change={v=>{
      const ivs=[...card.ivs] as WonderCard6['ivs'];ivs[i]=+v;change({ivs});}}/>)}</div>
    <NumberField label={t('gen6.delay')} max={4000} value={delay} onChange={setDelay}/>
  </FrameSearch6>;
}
