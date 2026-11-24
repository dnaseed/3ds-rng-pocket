import type { QrMatch } from '../engine/gen7/qrSearch';
import type { IdResult6 } from '../engine/core/types';
import type { Id6WorkerRequest, Search6Output, Stationary6WorkerRequest } from '../engine/gen6/searches';
import type { Stationary6Row } from '../engine/gen6/stationary6';
import type { MiscSearchOutput, MiscSearchRequest } from '../engine/gen7/misc7';
import type {
  EggSearchOutput,
  EggSearchRequest,
  IdSearchOutput,
  IdSearchRequest,
  MainGen7SearchRequest,
  MainSearchOutput,
} from '../engine/gen7/searches';

export type WorkerCommand =
  | { type: 'STATIONARY6_SEARCH'; payload: Stationary6WorkerRequest }
  | { type: 'ID6_SEARCH'; payload: Id6WorkerRequest }
  | { type: 'MISC_SEARCH'; payload: MiscSearchRequest }
  | { type: 'MAIN_SEARCH'; payload: MainGen7SearchRequest }
  | { type: 'EGG_SEARCH'; payload: EggSearchRequest }
  | { type: 'ID_SEARCH'; payload: IdSearchRequest }
  | {
      type: 'QR_SEARCH';
      payload: { seed: number; clocks: number[]; min: number; max: number };
    };

export type WorkerRequest = WorkerCommand & { id: number };

export type WorkerResponse =
  | { id: number; type: 'STATIONARY6_DONE'; payload: Search6Output<Stationary6Row> }
  | { id: number; type: 'ID6_DONE'; payload: Search6Output<IdResult6> }
  | { id: number; type: 'MISC_DONE'; payload: MiscSearchOutput }
  | { id: number; type: 'PROGRESS'; percent: number }
  | { id: number; type: 'MAIN_DONE'; payload: MainSearchOutput }
  | { id: number; type: 'EGG_DONE'; payload: EggSearchOutput }
  | { id: number; type: 'ID_DONE'; payload: IdSearchOutput }
  | { id: number; type: 'QR_DONE'; payload: QrMatch[] }
  | { id: number; type: 'ERROR'; message: string };
