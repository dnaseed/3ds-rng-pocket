import type { GameVersion6, RngFilterOptions, RngResultBase } from '../core/types';
import { checkRngFilter } from '../core/filters';
import { getGenderRatio, getHiddenPowerValue, getPRV, getPSV, isRandomGender } from '../core/pokemonMath';
import { getPersonalEntry6 } from '../../data/personalTable6';
import { hordeMembers6, wildAreas6, wildGroup6, wildSlots6, type WildMethod6 } from '../../data/wild6Catalog';
import stationary from '../../data/generated/stationary_gen6.json';
import { collectFrames6, type FrameRange6 } from './framePool6';
import { TinyClock6, horde6, slot6, normalSlots6, fishingSlots6, smashSlots6, flute6, item6, type Timeline6Request } from './tinyTimeline';
import { dexNav6, type DexNavOptions6 } from './dexNav6';

export interface Wild6Request extends FrameRange6 {
  game: GameVersion6; method: WildMethod6; area: number; rod: number; slot: number; delay: number;
  chain: number; ha: boolean; haSlot: number; potential: number; forceShiny: boolean; level: number;
  genderRatio: number; safariSlots: number; charm: boolean; tsv: number; trv: number; syncNature: number;
  assumeSync: boolean; lead: 'none'|'static'|'magnet'|'cuteM'|'cuteF'|'pressure'|'black'|'white'|'compound';
  timeline?: Timeline6Request; dex: DexNavOptions6; filter?: RngFilterOptions; unown: boolean;
}
export interface WildMember6 extends RngResultBase { slot: number; item: number | null }
export interface WildRow6 {
  frame: number; rand: number; state: number; members: WildMember6[]; matches: number[];
  dex: ReturnType<typeof dexNav6>; slot: number;
}

export function searchWild6(q: Wild6Request, progress?: (percent: number)=>void) {
  const group = wildGroup6(q.game);
  if (!group.methods.some(p=>p.method===q.method)) throw new RangeError('Unavailable encounter method');
  const oras = q.game === 'OR' || q.game === 'AS';
  const area = wildAreas6(q.game,q.method)[q.area];
  const slots = area ? wildSlots6(q.game,q.method,area,q.rod) : [];
  const isHorde = q.method === 'Horde';
  const isRadar = q.method === 'PokeRadar' && q.chain > 0;
  const isNav = q.method === 'DexNav';
  const isSafari = q.method === 'FriendSafari';
  const isFishing = q.method === 'Fishing';
  const weights = isFishing ? fishingSlots6 : q.method==='RockSmash' ? smashSlots6 : isSafari ?
    (q.safariSlots===2 ? [50,50] : [34,33,33]) : normalSlots6;
  const type = q.lead==='static' ? 12 : q.lead==='magnet' ? 8 : -1;
  const typeSlots = slots.map((s,i)=>getPersonalEntry6(s.species & 2047,s.species>>>11).types.includes(type)?i+1:0).filter(Boolean);
  const clock = q.timeline && new TinyClock6(q.timeline.state,q.timeline.calls,q.timeline.calls[0]!.frame-2);
  let source: TinyClock6 | undefined;
  return collectFrames6<WildRow6>(q,(pool,frame,rand)=>{
    let tiny: TinyClock6 | undefined;
    const cal = q.timeline;
    if (clock && cal) {
      const start = cal.calls[0]!.frame;
      if (frame<start+2 || (frame-start)%2) return null;
      while (clock.frame<frame) { source=clock.clone(); clock.advanceCall(); }
      tiny=source!.clone(); tiny.frame=frame;
      tiny.calls=tiny.calls.filter(c=>c.type!==3);
    }
    let lead = -1, slot = q.slot, flute = 0, item: number | null = null;
    let dex: ReturnType<typeof dexNav6> = null;
    let haSlot=q.haSlot, forced=q.forceShiny, potential=q.potential;
    let extraDelay=0;
    let horde: ReturnType<typeof horde6> | undefined;
    if (tiny && cal) {
      if (isHorde) {
        horde=horde6(tiny.rng.getState(),cal.party,oras);
        lead=horde.lead; slot=horde.slot; haSlot=horde.ha;
      } else if (isNav) {
        dex=dexNav6(tiny.rng.getState(),q.dex);
        if (!dex) return null;
        lead=dex.lead; slot=dex.slot+1; potential=dex.potential; forced=dex.forcedShiny; flute=dex.flute; item=dex.item;
      } else {
        if (q.method==='RockSmash') {
          tiny.elapse(16); tiny.skip(3); tiny.elapse(q.delay-228); tiny.next(); tiny.elapse(212);
          if (tiny.roll(3)!==0) return null;
        } else if (q.method==='CaveShadow') {
          tiny.elapse(32); tiny.next(); tiny.elapse(46);
        } else {
          tiny.elapse(q.delay);
          if (isFishing) {
            tiny.skip(3*cal.party); tiny.elapse(132);
            const wait=tiny.roll(7)*30+60;
            tiny.elapse(wait); extraDelay=132+wait;
          }
        }
        lead=tiny.roll(100);
        if (['Normal','Fishing','FriendSafari'].includes(q.method) && tiny.roll(100)>=cal.rate) return null;
        if (!isRadar) slot=lead<50 && typeSlots.length ? typeSlots[tiny.roll(typeSlots.length)]! : slot6(tiny.roll(100),weights);
        if (oras) flute=flute6(tiny.roll(100));
        tiny.next(); item=item6(tiny.roll(100),q.lead==='compound');
      }
    }
    const sync=lead<0 ? q.assumeSync : lead<50;
    const members: WildMember6[]=[];
    const matches:number[]=[];
    const hordeSpecies=isHorde && area ? hordeMembers6(q.game,area,slot) : [];
    pool.begin(1+q.delay+extraDelay+60);
    for (let i=0;i<(isHorde?5:1);i++) {
      const uniqueSpecies = slots[0] && slots.every(s=>s.species===slots[0]!.species) ? slots[0].species : 0;
      const encoded=isHorde ? hordeSpecies[i]??0 : isNav ? (q.unown?201:0) : isRadar||isSafari ? 0 : slots[slot-1]?.species??uniqueSpecies;
      const species=encoded & 2047;
      const personal=getPersonalEntry6(species,encoded>>>11);
      let level=isSafari ? 30 : isRadar ? q.level : isHorde ? area?.levels[0]??0 : isNav ? 0 : slots[slot-1]?.level??0;
      if (lead>=0 && lead<50 && q.lead==='pressure' && slots.length) level=Math.max(...slots.map(s=>s.level));
      const modifier=(q.lead==='black'?1:q.lead==='white'?-1:0)*(horde?.flutes[i]??flute)+(dex?.levelBoost??0);
      if(modifier) level=Math.min(100, Math.max(1,level+modifier));
      const ec=pool.next();
      const locked=isRadar && !forced;
      const rolls=(isSafari ? 4 : isFishing ? Math.min(40,2*q.chain) : 0)+(q.charm && !locked?3:1);
      let pid=0, shiny=false, squareShiny=false;
      for(let j=0;j<rolls;j++) {
        pid=pool.next();
        if ((isRadar || isNav) && forced) {
          pid=((((q.tsv<<4|q.trv)^(pid&65535))<<16)|(pid&65535))>>>0;
          shiny=squareShiny=true; break;
        }
        if(getPSV(pid)===q.tsv) {
          if(locked) pid=(pid^0x10000000)>>>0;
          else { shiny=true; squareShiny=getPRV(pid)===q.trv; }
          break;
        }
      }
      const perfect=Math.max(species && personal.eggGroups[0]===15 && !(oras&&stationary.babyMons.includes(species))?3:0,
        isSafari?2:isRadar?Math.min(3,Math.floor(q.chain/20)):isNav?potential:0);
      const ivs:RngResultBase['ivs']=[-1,-1,-1,-1,-1,-1];
      for(let left=perfect;left>0;) {const stat=pool.roll(6);if(ivs[stat]===-1){ivs[stat]=31;left--;}}
      for(let j=0;j<6;j++) if(ivs[j]===-1) ivs[j]=pool.next()>>>27;
      const ability=(isHorde && haSlot===i+1)||(isNav && (dex?.ha??q.ha)) ? 3 : pool.roll(isSafari && q.ha?3:2)+1;
      const nature=sync && q.syncNature>=0 ? q.syncNature : pool.roll(25);
      const forme=species===201 ? pool.roll(28) : encoded>>>11;
      const ratio=species ? personal.gender : q.genderRatio;
      const fixedGender=getGenderRatio(ratio);
      const cute=lead>=0 && lead<67 && (q.lead==='cuteM'||q.lead==='cuteF');
      const gender=isRandomGender(ratio) ? cute ? (q.lead==='cuteM'?2:1) : pool.roll(252)>=fixedGender?1:2 : fixedGender;
      const member={species,forme,level,ability,nature,gender,ivs,pid,ec,psv:getPSV(pid),prv:getPRV(pid),hiddenPower:getHiddenPowerValue(ivs),
        synchronize:sync,shiny,squareShiny,slot:isHorde?i+1:slot,item:horde?item6(horde.items[i]!,q.lead==='compound'):item};
      members.push(member);
      if(!q.filter || checkRngFilter(q.filter,{...member,kind:'wild',randLo:rand,randHi:0,frameDelayUsed:0,specialVal:null,isSpecial:false,item:member.item??3})) matches.push(i+1);
    }
    return matches.length ? {frame,rand,state:pool.state,slot,members,matches,dex} : null;
  },progress);
}
