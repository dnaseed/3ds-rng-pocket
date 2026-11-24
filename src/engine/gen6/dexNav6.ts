import { TinyMT } from '../rng/tinymt';
import type { TinyState } from '../rng/types';
import { flute6, scale6 } from './tinyTimeline';

export interface DexNavOptions6 {
  active: boolean; terrain: number; specialSlots: boolean; searchLevel: number; chain: number;
  charm: boolean; compoundEyes: boolean;
}

/** v1.0.6 FindPatch and PostCheck accept the first generated position. */
export function dexNav6(state: TinyState, q: DexNavOptions6) {
  const rng = new TinyMT(state);
  const roll = (n: number) => scale6(rng.nextU32(), n);
  if (!q.active) {
    rng.next(); rng.next();
    if (roll(100) >= 50) return null;
  }
  const side = roll(4);
  let x: number, y: number;
  if (side === 0 || side === 3) { x = -9 + roll(18); y = (side === 0 ? -9 : 7) + roll(3); }
  else { x = (side === 1 ? -9 : 7) + roll(3); y = -7 + roll(14); }
  const terrain = roll(100) < 30 && q.specialSlots ? 3 : q.terrain;
  const boost = (q.chain > 0 && (q.chain+1)%5 === 0) || roll(100)<4;
  const lead = roll(100);
  let slot = 0;
  if (!q.active) {
    for (slot = [12,12,5,3][terrain]! - 1; slot >= 0; slot--) if (roll(100)<30) break;
    slot = Math.max(0, slot);
  }
  rng.next();
  const grade = [5,10,25,50,100].filter(n=>q.searchLevel>=n).length;
  const levelBoost = Math.floor(q.chain / 5) + (boost ? 10 : 0);
  const flute = flute6(roll(100));
  const ha = roll(100) < [0,0,5,15,20,25][grade]!;
  const rates = [[0,0,0],[10,0,0],[15,10,0],[20,15,5],[15,20,5],[10,25,10]][grade]!;
  let i = 2;
  for (; i>=0; i--) if (roll(100)<rates[i]!) break;
  const potential = Math.min(3,i+(boost ? 2 : 1));
  const eggMove = roll(100)<[20,50,55,60,65,80][grade]! || boost;
  let itemRoll = roll(100);
  const ratesItem = [[40,10],[40,10],[45,15],[50,20],[50,20],[50,30]][grade]!;
  const item = ratesItem.findIndex(rate => (itemRoll -= rate + (q.compoundEyes ? 5 : 0)) < 0);
  const count = (q.charm?3:1)+(boost?4:0)+(q.chain===49?5:q.chain===99?10:0);
  const threshold = q.searchLevel>200 ? q.searchLevel+600 : q.searchLevel>100 ? 2*q.searchLevel+400 : 6*q.searchLevel;
  let forcedShiny = false;
  for (let j=0;j<count;j++) if (roll(10000)<threshold*0.01) forcedShiny = true;
  return { x,y,terrain,slot,boost,lead,levelBoost,flute,ha,potential,eggMove,item:item<0?3:item,forcedShiny };
}
