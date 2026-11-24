import { MT19937 } from '../rng/mt19937';
import { getGenderRatio, getPSV, getPRV } from '../core/pokemonMath';
import { getRandomAbility } from '../gen7/egg7';
import { collectFrames6, type FrameRange6 } from './framePool6';
import { scale6 } from './tinyTimeline';

export interface Egg6Options {
  male: number[]; female: number[]; maleItem: number; femaleItem: number; ability: number; ratio: number;
  nido: boolean; masuda: boolean; charm: boolean; accept: boolean; tsv: number; trv: number; otherTSVs:number[];
}
export interface Egg6Request extends FrameRange6, Egg6Options { delay: number }
export type EggKey6 = [number,number];
export function eggFromKey6(q: Egg6Options, key: EggKey6, mainPID?: number) {
  const rng=new MT19937(key);
  const roll=(n:number)=>scale6(rng.nextU32(),n);
  const coin=()=>rng.nextU32()<0x80000000;
  const ratio=getGenderRatio(q.ratio);
  const gender=q.nido?(coin()?1:2):ratio>15?(roll(252)>=ratio?1:2):ratio;
  const nature=roll(25);
  const everstone=q.maleItem===1&&q.femaleItem===1?coin():q.maleItem===1?true:q.femaleItem===1?false:null;
  const ability=getRandomAbility(q.ability,roll(100));
  const parents=Array<boolean|null>(6).fill(null);
  const powerMale=q.maleItem>2, powerFemale=q.femaleItem>2;
  if(powerMale||powerFemale) {
    const male=powerMale && (!powerFemale || coin());
    parents[(male?q.maleItem:q.femaleItem)-3]=male;
  }
  const cnt=q.maleItem===2||q.femaleItem===2?5:3;
  for(let i=powerMale||powerFemale?1:0;i<cnt;i++) {
    let stat; do {stat=roll(6);} while(parents[stat]!==null);
    parents[stat]=coin();
  }
  const ivs=parents.map((male,i)=>{const iv=rng.nextU32()>>>27;return male===null?iv:(male?q.male:q.female)[i]!;});
  const ec=rng.nextU32();
  let pid=mainPID, shiny=false, square=false;
  if(mainPID!==undefined) shiny=getPSV(mainPID)===q.tsv;
  else {
    for(let left=(q.masuda?6:0)+(q.charm?2:0);left>0;left--) {
      pid=rng.nextU32();
      if(getPSV(pid)===q.tsv) {shiny=true;square=getPRV(pid)===q.trv;break;}
    }
  }
  if(pid!==undefined && (q.charm||q.masuda||q.accept) && q.otherTSVs.includes(getPSV(pid))) shiny=true;
  return {key,gender,nature,everstone,ability,parents,ivs,ec,pid:pid??null,shiny,square};
}
export interface EggRow6 extends ReturnType<typeof eggFromKey6> {frame:number;rand:number;state:number}
export function searchEgg6(q:Egg6Request,progress?:(p:number)=>void) {
  return collectFrames6<EggRow6>(q,(pool,frame,rand)=>{
    pool.begin(q.delay+1);
    const main=q.accept&&!q.charm&&!q.masuda?pool.next():undefined;
    return {...eggFromKey6(q,[pool.next(),pool.next()],main),frame,rand,state:pool.state};
  },progress);
}
