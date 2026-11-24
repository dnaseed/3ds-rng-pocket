import { checkRngFilter, CompiledIdFilter } from '../core/filters';
import type { IdFilterOptions, IdResult6, RngFilterOptions } from '../core/types';
import type { TinyState } from '../rng/types';
import { searchId6 } from './id6';
import { searchStationary6, type Stationary6Row, type Stationary6SearchRequest } from './stationary6';

type Progress = (percent: number) => void;

export interface Stationary6WorkerRequest extends Stationary6SearchRequest {
  filter?: RngFilterOptions;
  maxResults?: number;
}

export interface Id6WorkerRequest {
  state: TinyState;
  minFrame: number;
  maxFrame: number;
  filter?: Omit<IdFilterOptions, 'idType'> & { idType: 0 | 1 | 2 };
  maxResults?: number;
}

export interface Search6Output<Row> {
  rows: Row[];
  truncated: boolean;
}

function collectRows<Row extends { frame: number }>(
  source: Iterable<Row>,
  range: { minFrame: number; maxFrame: number; maxResults?: number },
  matches: (row: Row) => boolean,
  onProgress?: Progress,
): Search6Output<Row> {
  const { minFrame, maxFrame, maxResults = 5000 } = range;
  if (!Number.isSafeInteger(maxResults) || maxResults < 1) throw new RangeError('Invalid result limit');
  const rows: Row[] = [];
  let lastPercent = 0;
  for (const row of source) {
    if (matches(row)) {
      if (rows.length === maxResults) return { rows, truncated: true };
      rows.push(row);
    }
    if (onProgress) {
      const percent = Math.floor(100 * (row.frame - minFrame + 1) / (maxFrame - minFrame + 1));
      if (percent > lastPercent) {
        lastPercent = percent;
        onProgress(percent);
      }
    }
  }
  return { rows, truncated: false };
}

export function runStationary6Search(req: Stationary6WorkerRequest, onProgress?: Progress): Search6Output<Stationary6Row> {
  const filter = req.filter;
  return collectRows(searchStationary6(req), req, row => !filter || checkRngFilter(filter, row), onProgress);
}

export function runId6Search(req: Id6WorkerRequest, onProgress?: Progress): Search6Output<IdResult6> {
  const filter = req.filter && new CompiledIdFilter(req.filter);
  return collectRows(searchId6(req.state, req.minFrame, req.maxFrame), req, row => !filter || filter.check(row), onProgress);
}
