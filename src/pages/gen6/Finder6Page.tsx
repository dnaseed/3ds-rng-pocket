import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { useSearchWorker } from '../../workers/useSearchWorker';
import { parseHex32, toHex32 } from '../../engine/math/uint';
import { validFinder6, type FinderRow6, type Capture6 } from '../../engine/gen6/finder6';
import { getPersonalEntry6 } from '../../data/personalTable6';
import { IvCalculator } from '../../components/filters/IvCalculator';
import { SearchWorkspace } from '../../components/layout/SearchWorkspace';
import { SearchActionBar } from '../../components/results/SearchActionBar';
import { Results6, type Results6Data } from './Results6';
import { buttonClass, cardClass, NumberField } from './fields';
import { Pair6, Select6, Text6 } from './ToolFields6';

const stats=['HP','Atk','Def','SpA','SpD','Spe'];
const capture=(min:number,max:number):Capture6=>({min,max,low:Array(6).fill(0),high:Array(6).fill(0)});
function CaptureFields({value,change,exact,nature,error}:{value:Capture6;change:(c:Capture6)=>void;exact:boolean;nature:(n:number)=>void;error:(s:string)=>void}) {
  const {i18n,lang}=useApp();
  return <><Pair6><NumberField label={i18n.t('search.startFrame')} value={value.min} onChange={min=>change({...value,min})}/>
    <NumberField label={i18n.t('search.endFrame')} value={value.max} onChange={max=>change({...value,max})}/></Pair6>
    <div className="grid grid-cols-3 gap-2">{stats.map((s,i)=><div key={s}><NumberField label={s+(exact?'':' min')} value={value.low[i]!} max={31} onChange={n=>{
      const low=value.low.map((v,j)=>i===j?n:v);change({...value,low,high:exact?[...low]:value.high});}}/>
      {!exact&&<NumberField label={s+' max'} value={value.high[i]!} max={31} onChange={n=>change({...value,high:value.high.map((v,j)=>i===j?n:v)})}/>}</div>)}</div>
    <IvCalculator statNames={stats} maxIvSpread={exact?0:2} personalData={{speciesCount:721,getEntry:getPersonalEntry6}} onApply={(ranges,n)=>{
      if(ranges.ivUp.some((v,i)=>v-ranges.ivLow[i]!>(exact?0:2))){
        error(lang==='it'?'Raffina gli IV della cattura prima del trasferimento.':'Narrow the IV ranges before applying them.');return;
      }
      error('');change({...value,low:[...ranges.ivLow],high:[...ranges.ivUp]});nature(n);
    }}/></>;
}
export function Finder6Page({seed,apply}:{seed:string;apply:(seed:string)=>void}) {
  const {i18n,lang}=useApp(),it=lang==='it';
  const [lo,setLo]=useState(seed),[hi,setHi]=useState(seed),[two,setTwo]=useState(false),[nature,setNature]=useState(0);
  const [first,setFirst]=useState(capture(1,100)),[second,setSecond]=useState(capture(101,200)),[threads,setThreads]=useState(1);
  const [error,setError]=useState(''),[result,setResult]=useState<Results6Data<FinderRow6>|null>(null);
  const w1=useSearchWorker(),w2=useSearchWorker(),w3=useSearchWorker(),w4=useSearchWorker();
  const workers=[w1,w2,w3,w4];
  const [active,setActive]=useState(0);
  const busy=workers.some(w=>w.isRunning);
  async function search() {
    const min=parseHex32(lo),max=parseHex32(hi);
    const query={seedMin:min??-1,seedMax:max??-1,first,second:two?second:null,nature};
    if(!validFinder6(query)){setError(it?'Controlla i seed, le finestre e gli intervalli IV.':'Check seeds, frame windows and IV ranges.');return;}
    const size=query.seedMax-query.seedMin+1, count=Math.min(threads,size);
    setError('');setActive(count);
    try {
      const outputs=await Promise.all(workers.slice(0,count).map((w,i)=>w.searchFinder6({...query,
        seedMin:query.seedMin+Math.floor(size*i/count),seedMax:query.seedMin+Math.floor(size*(i+1)/count)-1})));
      const rows=outputs.flatMap(out=>out.rows);
      setResult({rows:rows.slice(0,5000),truncated:rows.length>5000||outputs.some(o=>o.truncated),
        summary:toHex32(query.seedMin)+'–'+toHex32(query.seedMax)+' · '+size+' seed · '+count+' worker'});
    } catch(e){if(e instanceof Error&&e.message!=='ABORTED'){workers.forEach(w=>w.abort());setError(e.message);}}
  }
  return <SearchWorkspace collapsed={false} actions={<SearchActionBar activeFilters={0} isRunning={busy} progress={active?Math.floor(workers.slice(0,active).reduce((s,w)=>s+w.progress,0)/active):0}
    onAbort={()=>workers.forEach(w=>w.abort())} onSearch={()=>void search()}/>}
    results={<Results6 result={result} error={error} renderRow={r=><div className={cardClass}><strong className="font-mono">{toHex32(r.seed)}</strong>
      <p>#{r.frame} · {i18n.getNatureName(r.nature)} {r.frame2!==null?' / #'+r.frame2+' · '+i18n.getNatureName(r.nature2!):' · '+r.genderRoll}</p>
      <button className={buttonClass} onClick={()=>apply(toHex32(r.seed))}>{it?'Applica seed':'Apply seed'}</button></div>}/>}>
    <section className={cardClass}><h1>MT Seed Finder</h1><Pair6><Text6 label="Seed min (hex)" value={lo} change={setLo} limit={8}/><Text6 label="Seed max (hex)" value={hi} change={setHi} limit={8}/></Pair6>
      <Select6 label={it?'Catture':'Captures'} value={two?2:1} options={[[1,'1'],[2,'2']]} change={v=>{setTwo(v==='2');if(v==='2')setFirst({...first,high:[...first.low]});}}/>
      <Select6 label="Worker" value={threads} options={[[1,'1'],[2,'2'],[4,'4']]} change={v=>setThreads(+v)}/>
      {!two&&<Select6 label={i18n.t('search.nature')} value={nature} options={Array.from({length:25},(_,i)=>[i,i18n.getNatureName(i)])} change={v=>setNature(+v)}/>}
    </section>
    <fieldset className={cardClass}><legend>{it?'Cattura 1':'Capture 1'}</legend><CaptureFields value={first} change={setFirst} exact={two} nature={setNature} error={setError}/></fieldset>
    {two&&<fieldset className={cardClass}><legend>{it?'Cattura 2':'Capture 2'}</legend><CaptureFields value={second} change={setSecond} exact nature={()=>{}} error={setError}/></fieldset>}
  </SearchWorkspace>;
}
