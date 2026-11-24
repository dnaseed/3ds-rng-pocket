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

import type { Timeline6Request, TimelineRow6 } from '../engine/gen6/tinyTimeline';

import type { Wild6Request, WildRow6 } from '../engine/gen6/wild6';

import type { Event6Request, EventRow6 } from '../engine/gen6/event6';

import type { Egg6Request, EggRow6 } from '../engine/gen6/egg6';

import type { Pokerus6Request, PokerusRow6 } from '../engine/gen6/pokerus6';

import type { Finder6Request, FinderRow6 } from '../engine/gen6/finder6';

export type WorkerCommand =
  | { type: 'FINDER6_SEARCH'; payload: Finder6Request }
  | { type: 'POKERUS6_SEARCH'; payload: Pokerus6Request }
  | { type: 'EGG6_SEARCH'; payload: Egg6Request }
  | { type: 'EVENT6_SEARCH'; payload: Event6Request }
  | { type: 'WILD6_SEARCH'; payload: Wild6Request }
  | { type: 'TIMELINE6_SEARCH'; payload: Timeline6Request }
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
  | { id: number; type: 'FINDER6_DONE'; payload: Search6Output<FinderRow6> }
  | { id: number; type: 'POKERUS6_DONE'; payload: Search6Output<PokerusRow6> }
  | { id: number; type: 'EGG6_DONE'; payload: Search6Output<EggRow6> }
  | { id: number; type: 'EVENT6_DONE'; payload: Search6Output<EventRow6> }
  | { id: number; type: 'WILD6_DONE'; payload: Search6Output<WildRow6> }
  | { id: number; type: 'TIMELINE6_DONE'; payload: Search6Output<TimelineRow6> }
  | { id: number; type: 'STATIONARY6_DONE'; payload: Search6Output<Stationary6Row> }
  | { id: number; type: 'ID6_DONE'; payload: Search6Output<IdResult6> }
  | { id: number; type: 'MISC_DONE'; payload: MiscSearchOutput }
  | { id: number; type: 'PROGRESS'; percent: number }
  | { id: number; type: 'MAIN_DONE'; payload: MainSearchOutput }
  | { id: number; type: 'EGG_DONE'; payload: EggSearchOutput }
  | { id: number; type: 'ID_DONE'; payload: IdSearchOutput }
  | { id: number; type: 'QR_DONE'; payload: QrMatch[] }
  | { id: number; type: 'ERROR'; message: string };
