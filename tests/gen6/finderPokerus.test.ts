import { expect, it } from 'vitest';
import { searchFinder6, validFinder6 } from '../../src/engine/gen6/finder6';
import { searchPokerus6 } from '../../src/engine/gen6/pokerus6';

// Captured from MTSeedFinder.Search and Pokerus6.getStrain in the v1.0.6 executable.
const seed=0x35b19af2;
const firstIVs=[31,1,5,5,2,27], secondIVs=[31,30,8,23,20,15];
const first={low:firstIVs,high:firstIVs,min:1,max:11};
const second={low:secondIVs,high:secondIVs,min:20,max:32};
const query={seedMin:seed-18,seedMax:seed+14,first,second:null,nature:3};
it('finds the original candidate on both sides of worker partition boundaries',()=>{
  for(const [seedMin,seedMax] of [[seed-18,seed+14],[seed,seed+1],[seed-1,seed],[seed,seed]] as const){
    expect(searchFinder6({...query,seedMin,seedMax}).rows).toEqual([{seed,frame:2,nature:3,frame2:null,nature2:null,genderRoll:65}]);
    expect(searchFinder6({...query,seedMin,seedMax,second}).rows).toEqual([{seed,frame:2,nature:3,frame2:23,nature2:6,genderRoll:null}]);
  }
  expect(searchFinder6({...query,nature:0}).rows).toEqual([]);
  expect(searchFinder6({...query,seedMin:0xffffffff,seedMax:0xffffffff}).rows).toEqual([]);
});
it('enforces the original single-capture IV and seed-span limits',()=>{
  expect(validFinder6({...query,seedMin:0,seedMax:0x10000000})).toBe(true);
  expect(validFinder6({...query,seedMin:0,seedMax:0x10000001})).toBe(false);
  for (const spread of [0,2,3]) expect(validFinder6({...query,first:{...first,low:[31-spread,...firstIVs.slice(1)]}})).toBe(spread<=2);
});
it('matches infection frames and strains over the first 150000 MT outputs',()=>{
  const rows=searchPokerus6({seed,minFrame:0,maxFrame:149999,delay:0}).rows;
  expect(rows.map(r=>[r.frame,r.rand&65535,r.strain])).toEqual([
    [21203,49152,3],[45241,16384,5],[77687,16384,3],[91380,16384,3],[126453,32768,6],[126593,49152,5],
  ]);
});
