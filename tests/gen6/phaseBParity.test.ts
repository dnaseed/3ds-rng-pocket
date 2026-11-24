import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { wildAreas6, wildSlots6, hordeMembers6 } from '../../src/data/wild6Catalog';
import { createI18n } from '../../src/data/i18n';
import { toHex32, formatEggSeedStr, parseEggSeedStr } from '../../src/engine/math/uint';
import { getPRV, getPSV } from '../../src/engine/core/pokemonMath';
import { timeline6, timelineMethods6, slot6, normalSlots6, scale6 } from '../../src/engine/gen6/tinyTimeline';
import { searchEvent6, type WonderCard6 } from '../../src/engine/gen6/event6';
import { searchEgg6, eggFromKey6 } from '../../src/engine/gen6/egg6';
import { searchWild6, type Wild6Request } from '../../src/engine/gen6/wild6';
import timeline from './timeline-reference.json';
import wild from './wild-desktop.json';
import egg from './egg-desktop.json';
import event from './event-desktop.json';

const range = {seed: 0x35b19af2, minFrame: 0, maxFrame: 9};
const english = createI18n('en');
const eggOptions = {
  ...range, male:Array(6).fill(31),female:Array(6).fill(31),maleItem:0,femaleItem:0,ability:0,ratio:127,
  nido:false,masuda:false,charm:true,accept:true,tsv:0,trv:0,otherTSVs:[],delay:16,
};
const wildOptions: Wild6Request = {
  ...range, game:'X',method:'Normal',area:0,rod:0,slot:0,delay:6,chain:0,ha:false,haSlot:0,potential:0,
  forceShiny:false,level:0,genderRatio:127,safariSlots:2,charm:true,tsv:0,trv:0,syncNature:0,
  assumeSync:false,lead:'none',dex:{active:true,terrain:0,specialSlots:false,searchLevel:0,chain:0,charm:true,compoundEyes:false},unown:false,
};
const eventCard:WonderCard6 = {
  species:0,forme:0,level:0,abilityLocked:true,ability:0,natureLocked:false,nature:0,genderLocked:true,gender:0,
  ivsCount:0,ivs:[-1,-1,-1,-1,-1,-1],tid:0,sid:0,pidType:0,pid:0,ec:0,isEgg:false,yourId:false,otherInfo:false,
};

function checkPokemon(actual:{ivs:number[]; nature:number; gender:number; ability:number; ec:number; pid:number|null}, row:Record<string,string>) {
  expect(actual.ivs).toEqual(['HP','Atk','Def','SpA','SpD','Spe'].map(k=>Number(row[k])));
  expect(toHex32(actual.ec)).toBe(row.EC);
  expect(toHex32(actual.pid!)).toBe(row.PID);
  expect(getPSV(actual.pid!)).toBe(Number(row.PSV));
  expect(getPRV(actual.pid!)).toBe(parseInt(row.PRV!,16));
  expect(english.getNatureName(actual.nature)).toBe(row.Nature);
  expect(['-','♂','♀'][actual.gender]).toBe(row.Gender);
  expect(actual.ability).toBe(row.Ability==='-'?0:Number(row.Ability));
}
function checkFrame(actual:{frame:number;rand:number;state:number}, row:Record<string,string>) {
  expect([actual.frame,toHex32(actual.rand),toHex32(actual.state)]).toEqual([Number(row.Frame),row['Rand#'],row.State]);
}

describe('3DS RNG Tool v1.0.6 grids, Pokémon X, TSV/TRV 0, seed 35B19AF2',()=>{
  it('matches ten Normal Wild rows with Shiny Charm, delay 6',()=>{
    const {rows}=searchWild6(wildOptions);
    expect(rows).toHaveLength(wild.length);
    rows.forEach((r,i)=>{checkFrame(r,wild[i]!);checkPokemon(r.members[0]!,wild[i]!);});
  });
  it('matches the current egg and ten accepted eggs with Shiny Charm',()=>{
    const current=eggFromKey6(eggOptions,[0xd60da9b6,0xa663ff5d]);
    checkPokemon(current,egg[0]!);
    const {rows}=searchEgg6(eggOptions);
    expect(rows).toHaveLength(egg.length-1);
    rows.forEach((r,i)=>{
      const original=egg[i+1]!;
      checkFrame(r,original);checkPokemon(r,original);
      expect(r.key.slice().reverse().map(toHex32).join('')).toBe(original['Egg Seed']);
    });
  });
  it('matches ten manual Event rows, random PID, locked ability',()=>{
    const {rows}=searchEvent6({...range,card:eventCard,oras:false,delay:0,trainerTSV:0});
    expect(rows).toHaveLength(event.length);
    rows.forEach((r,i)=>{checkFrame(r,event[i]!);checkPokemon(r,event[i]!);});
  });
});

describe('reference assembly v1.0.6',()=>{
  it('reproduces every extracted area, rod, level, slot and horde member',()=>{
    const records:string[]=[];
    for(const game of ['X','Y','OR','AS'] as const)
      for(const method of ['Normal','Horde','Fishing','RockSmash','CaveShadow','Trap','DexNav'] as const)
        for(const area of wildAreas6(game,method))
          for(const [rod,code] of (method==='Fishing'?[129,349,130]:[0]).entries()){
            const slots=wildSlots6(game,method,area,rod);
            const members=method==='Horde'?[1,2,3].map(s=>hordeMembers6(game,area,s).join(',')).join(';'):'';
            records.push([game,method,area.location+(area.variant<<9),code,slots.map(s=>s.species),slots.map(s=>s.level),members].join('|'));
          }
    expect(records).toHaveLength(722);
    expect(createHash('sha256').update(records.join('\n')).digest('hex')).toBe('680b49c0ffa8ef930a6fa69d9fcc9c05f8985a16e37a5d61700b82ab2dc87080');
  });
  it.each(timelineMethods6)('reproduces the first six %s spans with coincident calls',method=>{
    const results=timeline6({state:parseEggSeedStr('11223344,55667788,99AABBCC,DDEEFF00')!,calls:[{frame:500,type:0},{frame:500,type:1}],
      method,maxFrame:1030,split:method==='instant',delay:2,cry:null,party:2,oras:false,slots:2,rate:13,chain:13,boost:false});
    const encoded=Array.from(results).slice(0,6).map(r=>[r.index,r.hit,r.frame-2,r.end,r.rand,r.sync?'O':'X',
      r.slot??slot6(scale6(r.rand,100),normalSlots6),r.item??0,r.encounter??0,formatEggSeedStr(r.state).replaceAll(' ','')].join(' '));
    expect(encoded).toEqual(timeline.methods[timelineMethods6.indexOf(method)]);
  });
});
