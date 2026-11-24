import { parseWonderCardPayload, type ParsedWc7 } from '../gen7/wc7Parser';
import { getPersonalEntry6 } from '../../data/personalTable6';
import { getGenderRatio, getHiddenPowerValue, getPSV, getPRV, isRandomGender } from '../core/pokemonMath';
import type { RngResultBase } from '../core/types';
import { collectFrames6, type FrameRange6, type FramePool6 } from './framePool6';

export type WonderCard6 = ParsedWc7;
export function parseWc6(name: string, bytes: Uint8Array) {
  const full = /\.wc6full$/i.test(name);
  if ((!full && !/\.wc6$/i.test(name)) || bytes.length !== (full ? 0x310 : 0x108)) return null;
  const payload=full?bytes.subarray(0x208):bytes;
  if (payload[0xa3]!>3 || payload[0xa2]!>4 || payload[0xa1]!>3 || (payload[0xa0]!==255 && payload[0xa0]!>=25)) return null;
  return parseWonderCardPayload(payload,721);
}
export interface Event6Request extends FrameRange6 { card: WonderCard6; oras: boolean; delay: number; trainerTSV: number }
export interface EventRow6 extends RngResultBase { frame: number; rand: number; state: number }
function generate(pool: FramePool6, q: Event6Request): RngResultBase {
  const c=q.card, tsv=c.yourId?q.trainerTSV:(c.tid^c.sid)>>>4;
  const ec=c.ec||pool.next();
  let pid=c.pidType===3?(c.yourId?0:c.pid):pool.next();
  let shiny=getPSV(pid)===tsv;
  if (c.pidType===1 && shiny) { pid=(pid^0x10000000)>>>0;shiny=false; }
  if (c.pidType===2) {
    shiny=true;
    if(c.otherInfo) pid=(((((c.yourId?0:c.tid^c.sid)^(pid&65535))<<16)|(pid&65535)))>>>0;
  }
  const ivs=[...c.ivs] as RngResultBase['ivs'];
  for(let left=c.ivsCount;left>0;) { const i=pool.roll(6); if(ivs[i]===-1){ivs[i]=31;left--;} }
  for(let i=0;i<6;i++) if(ivs[i]===-1) ivs[i]=pool.next()>>>27;
  const ability=c.abilityLocked?c.ability:pool.roll(c.ability+2)+1;
  const nature=c.natureLocked?c.nature:pool.roll(25);
  const ratio=getPersonalEntry6(c.species,c.forme).gender;
  const gender=c.genderLocked?c.gender:isRandomGender(ratio)?pool.roll(252)>=getGenderRatio(ratio)?1:2:getGenderRatio(ratio);
  return {species:c.species,forme:c.forme,level:c.level,ec,pid,shiny,squareShiny:shiny,ivs,ability,nature,gender,
    synchronize:false,psv:getPSV(pid),prv:getPRV(pid),hiddenPower:getHiddenPowerValue(ivs)};
}
export function searchEvent6(q: Event6Request, progress?: (p:number)=>void) {
  if(q.card.ivsCount>q.card.ivs.filter(v=>v===-1).length) throw new RangeError('IV locks exceed six stats');
  return collectFrames6<EventRow6>(q,(pool,frame,rand)=>{
    pool.begin(q.delay+1);
    if(q.oras) generate(pool,q);
    return {...generate(pool,q),frame,rand,state:pool.state};
  },progress);
}
