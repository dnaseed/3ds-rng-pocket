import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultProfileStore6, exportProfiles6Json, importProfiles6Json,
  loadProfileStore6, loadSession6, saveProfileStore6, saveSession6,
} from '../../src/services/gen6Storage';
import { importProfilesJson, loadProfileStore } from '../../src/services/profileStorage';

const export130 = `{
  "version": 1,
  "activeProfileId": "sample-um",
  "profiles": [{
    "id": "sample-um",
    "name": "Example Ultra Moon",
    "gameVersion": "UM",
    "tid": 12345,
    "sid": 54321,
    "tsv": 1746,
    "trv": 2,
    "shinyCharm": true,
    "eggSeed": [11, 22, 33, 44],
    "otherTsvs": [42]
  }]
}`;

afterEach(() => vi.unstubAllGlobals());

describe('Gen 6 storage', () => {
  it('round-trips active profile, MT seed, TinyMT state and both ranges without changing the Gen 7 export', () => {
    const values = new Map([['usum_rng_profiles_v1', export130]]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const store = createDefaultProfileStore6();
    store.profiles.push({ id: 'alpha', name: 'Alpha', gameVersion: 'AS', tid: 43, sid: 50000, shinyCharm: true });
    store.activeProfileId = 'alpha';
    const session = {
      ...loadSession6(), initialSeedHex: '35B19AF2',
      startFrame: 10, endFrame: 20, targetFrame: 18,
      idState: [0xddeeff00, 0x99aabbcc, 0x55667788, 0x11223344] as [number, number, number, number],
      idStartFrame: 2, idEndFrame: 9,
    };
    saveProfileStore6(store);
    saveSession6(session);
    expect(loadProfileStore6()).toEqual(store);
    expect(loadSession6()).toEqual(session);
    expect(importProfiles6Json(exportProfiles6Json(store))).toEqual(store);
    expect(loadProfileStore()).toEqual(JSON.parse(export130));
    expect(values.get('usum_rng_profiles_v1')).toBe(export130);
  });

  it('rejects cross-generation imports and still accepts the v1.3.0 Gen 7 format', () => {
    expect(() => importProfiles6Json(export130)).toThrow('Expected a Gen 6 profile file');
    const store = createDefaultProfileStore6();
    expect(() => importProfilesJson(exportProfiles6Json(store))).toThrow('Gen 6');
    expect(() => importProfilesJson(JSON.stringify(store.profiles))).toThrow('Gen 6');
    expect(importProfilesJson(export130)).toEqual(JSON.parse(export130));
  });
});
