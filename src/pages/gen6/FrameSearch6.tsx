import { useState, type ReactNode } from 'react';
import { useApp } from '../../store/AppContext';
import { SearchWorkspace } from '../../components/layout/SearchWorkspace';
import { SearchActionBar } from '../../components/results/SearchActionBar';
import type { Session6, TrainerProfile6 } from '../../services/gen6Storage';
import type { Search6Output } from '../../engine/gen6/searches';
import { parseHex32 } from '../../engine/math/uint';
import { Details6, Results6, rowButtonClass, type Results6Data } from './Results6';
import { cardClass, NumberField } from './fields';
import { Pair6 } from './ToolFields6';

export interface Page6Props {profile:TrainerProfile6;session:Session6;updateSession:(patch:Partial<Session6>)=>void}
export function range6(s:Session6) {return {seed:parseHex32(s.initialSeedHex)??0,minFrame:s.startFrame,maxFrame:s.endFrame};}

export function FrameSearch6<R extends {frame:number}>({title,summary,children,worker,run,brief,detail,session,updateSession}: {
  title:string;summary:string;children:ReactNode;worker:{isRunning:boolean;progress:number;error:string|null;abort:()=>void};
  run:()=>Promise<Search6Output<R>>; brief:(row:R)=>ReactNode; detail:(row:R)=>ReactNode;
  session:Session6;updateSession:Page6Props['updateSession'];
}) {
  const {i18n}=useApp();
  const [result,setResult]=useState<Results6Data<R>|null>(null),[row,setRow]=useState<R|null>(null),[error,setError]=useState('');
  async function search() {
    setError('');
    if(session.startFrame>session.endFrame) {setError(i18n.t('gen6.invalidRange'));return;}
    try {setResult({...await run(),summary:[title,summary,session.initialSeedHex,'#'+session.startFrame+'–#'+session.endFrame].join(' · ')});}
    catch(e) {if(e instanceof Error&&e.message!=='ABORTED')setError(e.message);}
  }
  return <><SearchWorkspace collapsed={false} actions={<SearchActionBar activeFilters={0} isRunning={worker.isRunning} progress={worker.progress} onAbort={worker.abort} onSearch={()=>void search()}/>}
    results={<Results6 result={result} error={error||worker.error} renderRow={r=><button className={rowButtonClass} onClick={()=>setRow(r)}><b>#{r.frame}</b> · {brief(r)}</button>}/>}>
    <section className={cardClass}><h1 className="font-bold">{title}</h1>{children}
      <Pair6><NumberField label={i18n.t('search.startFrame')} value={session.startFrame} onChange={startFrame=>updateSession({startFrame})}/>
        <NumberField label={i18n.t('search.endFrame')} value={session.endFrame} onChange={endFrame=>updateSession({endFrame})}/></Pair6>
    </section></SearchWorkspace>
    <Details6 open={row!==null} title={title+' #'+(row?.frame??'')} onClose={()=>setRow(null)}>{row&&detail(row)}</Details6></>;
}
