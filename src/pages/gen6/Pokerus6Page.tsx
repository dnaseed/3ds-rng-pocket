import { CopyResultValue } from './Results6';
import {useState} from 'react';
import {type PokerusRow6} from '../../engine/gen6/pokerus6';
import {useSearchWorker} from '../../workers/useSearchWorker';
import {useApp} from '../../store/AppContext';
import {toHex32} from '../../engine/math/uint';
import {FrameSearch6,range6,type Page6Props} from './FrameSearch6';
import {NumberField} from './fields';

export function Pokerus6Page({profile,session,updateSession}:Page6Props) {
  const worker=useSearchWorker(), {lang,i18n}=useApp();
  const [delay,setDelay]=useState(0);
  const strain=lang==='it'?'Ceppo':'Strain';
  return <FrameSearch6<PokerusRow6> title="Pokérus" summary={profile.gameVersion} session={session} updateSession={updateSession}
    worker={worker} run={()=>worker.searchPokerus6({...range6(session),delay})} brief={r=>strain+' '+r.strain}
    detail={r => <>
      <p>{strain} {r.strain}</p>
      <p className="font-mono">Rand {toHex32(r.rand)} · MT {toHex32(r.state)}</p>
      <CopyResultValue value={toHex32(r.state)} label={i18n.t('gen6.copyState')} />
    </>}>
    <NumberField label={i18n.t('gen6.delay')} value={delay} max={4000} onChange={setDelay}/>
  </FrameSearch6>;
}
