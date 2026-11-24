import { MT19937 } from '../rng/mt19937';
import { scale6 } from './tinyTimeline';
import type { Search6Output } from './searches';

export interface Capture6 { low:number[]; high:number[]; min:number; max:number }
export interface Finder6Request { first:Capture6; second:Capture6|null; nature:number; seedMin:number; seedMax:number }
export interface FinderRow6 {frame:number;seed:number;frame2:number|null;nature:number;nature2:number|null;genderRoll:number|null}

function validCapture(c:Capture6,exact:boolean) {
  return Number.isInteger(c.min)&&Number.isInteger(c.max)&&c.min>=0&&c.max>=c.min&&c.max<=1_000_000_000 &&
    c.low.length===6 && c.high.length===6 && c.low.every((n,i)=>Number.isInteger(n)&&n>=0&&Number.isInteger(c.high[i])&&c.high[i]!<=31 &&
      c.high[i]!>=n&&c.high[i]!-n<=(exact?0:2));
}
export function validFinder6(q:Finder6Request) {
  return [q.seedMin,q.seedMax].every(n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff)&&q.seedMin<=q.seedMax &&
    validCapture(q.first,!!q.second) && (q.second?validCapture(q.second,true)&&q.second.min>=q.first.max:
      q.seedMax-q.seedMin<=0x10000000 && Number.isInteger(q.nature)&&q.nature>=0&&q.nature<25);
}

/** Test IV windows in frame order. Nature is checked only for the first IV match. */
function findCapture(rng:MT19937,c:Capture6,ring:Uint8Array) {
  if(c.max-c.min<5)return null;
  for(let i=0;i<5;i++) ring[i]=rng.nextU32()>>>27;
  let head=0;
  for(let f=c.min;f<=c.max-5;f++) {
    ring[(head+5)%6]=rng.nextU32()>>>27;
    let i=0;
    for(;i<6;i++) {
      const value=ring[(head+i)%6]!;
      if(value<c.low[i]! || value>c.high[i]!)break;
    }
    if(i===6)return f;
    head=(head+1)%6;
  }
  return null;
}

export function searchFinder6(q:Finder6Request,progress?:(n:number)=>void):Search6Output<FinderRow6> {
  if(!validFinder6(q))throw new RangeError('Invalid seed or capture range');
  const rng=new MT19937(q.seedMin), ring=new Uint8Array(6);
  const rows:FinderRow6[]=[];
  for(let seed=q.seedMin;seed<=q.seedMax;seed++) {
    if((seed-q.seedMin)%128===0)progress?.(Math.floor(100*(seed-q.seedMin)/(q.seedMax-q.seedMin+1)));
    rng.reseed(seed); rng.advance(63+q.first.min);
    const frame=findCapture(rng,q.first,ring);
    if(frame===null || (!q.second&&frame===0))continue;
    let frame2:number|null=null;
    if(q.second) {
      // Reseeding also handles windows sharing their final/initial word.
      rng.reseed(seed);rng.advance(63+q.second.min);
      frame2=findCapture(rng,q.second,ring);
      if(frame2===null||frame2===0)continue;
    }
    rng.reseed(seed);rng.advance(70+frame);
    const nature=scale6(rng.nextU32(),25);
    if(!q.second&&nature!==q.nature)continue;
    let nature2:number|null=null, genderRoll:number|null=null;
    if(frame2!==null){rng.advance(frame2-frame-1);nature2=scale6(rng.nextU32(),25);}
    else genderRoll=scale6(rng.nextU32(),252);
    if(rows.length===5000)return {rows,truncated:true};
    rows.push({frame,seed,frame2,nature,nature2,genderRoll});
  }
  return {rows,truncated:false};
}
