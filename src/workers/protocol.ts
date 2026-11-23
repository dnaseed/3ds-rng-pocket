import type { QrMatch } from '../engine/gen7/qrSearch';
import type {
  EggSearchOutput,
  EggSearchRequest,
  IdSearchOutput,
  IdSearchRequest,
  MainGen7SearchRequest,
  MainSearchOutput,
} from '../engine/gen7/searches';

export type WorkerRequest =
  | { id: number; type: 'MAIN_SEARCH'; payload: MainGen7SearchRequest }
  | { id: number; type: 'EGG_SEARCH'; payload: EggSearchRequest }
  | { id: number; type: 'ID_SEARCH'; payload: IdSearchRequest }
  | {
      id: number;
      type: 'QR_SEARCH';
      payload: { seed: number; clocks: number[]; min: number; max: number };
    };

export type WorkerResponse =
  | { id: number; type: 'PROGRESS'; percent: number }
  | { id: number; type: 'MAIN_DONE'; payload: MainSearchOutput }
  | { id: number; type: 'EGG_DONE'; payload: EggSearchOutput }
  | { id: number; type: 'ID_DONE'; payload: IdSearchOutput }
  | { id: number; type: 'QR_DONE'; payload: QrMatch[] }
  | { id: number; type: 'ERROR'; message: string };
