import { collectFrames6, type FrameRange6 } from './framePool6';
export interface Pokerus6Request extends FrameRange6 {delay:number}
export interface PokerusRow6 {frame:number;rand:number;state:number;strain:number}
export function searchPokerus6(q:Pokerus6Request,progress?:(n:number)=>void) {
  return collectFrames6<PokerusRow6>(q,(pool,frame,rand)=>{
    pool.begin(q.delay);
    const low=pool.next()&65535;
    if(low!==0x4000&&low!==0x8000&&low!==0xc000)return null;
    pool.skip(1);
    let strain;do{strain=pool.next()>>>24;}while((strain&7)===0);
    if(strain&0xf0)strain&=7;
    return {frame,rand,state:pool.state,strain};
  },progress);
}
