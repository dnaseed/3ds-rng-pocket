import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatEggSeedStr, parseEggSeedStr, toHex32 } from '../../src/engine/math/uint';
import { runId6Search } from '../../src/engine/gen6/searches';
import type { WorkerRequest, WorkerResponse } from '../../src/workers/protocol';

// 3DSRNGTool v1.0.6, Pokémon X, frame range 0–9. State shown as S3,S2,S1,S0.
const initialState = '11223344,55667788,99AABBCC,DDEEFF00';
const idRequest = { state: parseEggSeedStr(initialState)!, minFrame: 0, maxFrame: 9 };
const reference = [
  '54300 02007 3388 B 07D7D41C 11223344,55667788,99AABBCC,DDEEFF00',
  '11873 25517 1244 C 63AD2E61 AAD57F2A,E69AFDCC,55667788,99AABBCC',
  '19091 09374 1760 D 249E4A93 01459227,14CA3187,69EAEC22,55667788',
  '07025 42306 3043 3 A5421B71 792CA543,36260D68,9BBA2069,69EAEC22',
  '39751 02467 2350 4 09A39B47 0921B487,3631A07A,B9561C86,9BBA2069',
  '05136 61684 3662 4 F0F41410 B0D7CB7B,1E33B6A0,B941B194,B9561C86',
  '50138 16123 4050 1 3EFBC3DA 4AD00210,E2646CD6,1E33B6A0,B941B194',
  '36929 11962 3055 B 2EBA9041 2082BF3E,45C64426,E2646CD6,1E33B6A0',
  '61188 38740 1925 0 9754EF04 FA714251,F3C319EF,CAB655C8,E2646CD6',
  '00919 24098 1499 5 5E220397 6A7A826A,073AC913,F3C319EF,CAB655C8',
];

const noFilters = { skip: false, idType: 0 as const, regex: false, idList: [], tsvList: [], randList: [] };

afterEach(() => vi.unstubAllGlobals());

describe('Gen 6 search worker', () => {
  it('matches all ten ID rows from 3DSRNGTool', () => {
    const { rows, truncated } = runId6Search(idRequest);
    expect(truncated).toBe(false);
    expect(rows.map(row => row.frame)).toEqual(reference.map((_, frame) => frame));
    expect(rows.map(row => [
      String(row.tid).padStart(5, '0'), String(row.sid).padStart(5, '0'),
      String(row.tsv).padStart(4, '0'), row.trv.toString(16).toUpperCase(),
      toHex32(row.rand), formatEggSeedStr(row.state),
    ].join(' '))).toEqual(reference);
    expect(formatEggSeedStr(idRequest.state)).toBe(initialState);
  });

  it('preserves the matched frame with a TID or TinyMT state filter and in a single-frame range', () => {
    const referenceRow = runId6Search(idRequest).rows[2];
    const tidFilter = { ...noFilters, idList: ['19091'] };
    const stateFilter = { ...noFilters, randList: ['01459227,14ca3187'] };
    expect(runId6Search({ ...idRequest, filter: tidFilter }).rows).toEqual([referenceRow]);
    expect(runId6Search({ ...idRequest, filter: stateFilter }).rows).toEqual([referenceRow]);
    expect(runId6Search({ ...idRequest, minFrame: 2, maxFrame: 2 }).rows).toEqual([referenceRow]);
  });

  it('caps results and marks truncation only when another row matches', () => {
    expect(runId6Search({ ...idRequest, maxResults: 2 })).toMatchObject({ rows: [{ frame: 0 }, { frame: 1 }], truncated: true });
    expect(runId6Search({ ...idRequest, maxResults: 10, filter: noFilters }).truncated).toBe(false);
  });

  it('dispatches both request types with the original ID and reports invalid inputs', async () => {
    const messages: WorkerResponse[] = [];
    const self = { postMessage: (message: WorkerResponse) => messages.push(message),
      onmessage: undefined as ((event: { data: WorkerRequest }) => Promise<void>) | undefined };
    vi.stubGlobal('self', self);
    await import('../../src/workers/search.worker');
    const send = async (data: WorkerRequest) => {
      messages.length = 0;
      await self.onmessage!({ data });
      return messages.at(-1);
    };

    expect(await send({ id: 17, type: 'ID6_SEARCH', payload: idRequest }))
      .toEqual({ id: 17, type: 'ID6_DONE', payload: runId6Search(idRequest) });
    expect(await send({
      id: 18, type: 'STATIONARY6_SEARCH', payload: {
        game: 'X', preset: 'xy:1:3', seed: 0x35b19af2, minFrame: 0, maxFrame: 0,
        targetFrame: 5000, considerDelay: true, tsv: 0, trv: 0, shinyCharm: false,
      },
    })).toMatchObject({
      id: 18, type: 'STATIONARY6_DONE',
      payload: { rows: [{ frame: 0, pid: 0x1adfde36, ec: 0xa665abf7 }], truncated: false },
    });
    expect(await send({ id: 19, type: 'ID6_SEARCH', payload: { ...idRequest, minFrame: 10 } }))
      .toMatchObject({ id: 19, type: 'ERROR', message: 'Invalid Gen 6 ID frame range' });
  });
});
