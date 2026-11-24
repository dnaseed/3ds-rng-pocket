import { searchQrFrames } from '../engine/gen7/qrSearch';
import { searchMisc7 } from '../engine/gen7/misc7';
import { runEgg7Search, runId7Search, runMainGen7Search } from '../engine/gen7/searches';
import type { WorkerRequest, WorkerResponse } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

function post(msg: WorkerResponse): void {
  self.postMessage(msg);
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  let lastProgressSent = 0;
  const onProgress = (percent: number) => {
    const now = Date.now();
    if (percent === 100 || now - lastProgressSent >= 50) {
      lastProgressSent = now;
      post({ id: req.id, type: 'PROGRESS', percent });
    }
  };

  try {
    switch (req.type) {
      case 'FINDER6_SEARCH': {
        const { searchFinder6 } = await import('../engine/gen6/finder6');
        post({ id: req.id, type: 'FINDER6_DONE', payload: searchFinder6(req.payload, onProgress) });
        break;
      }
      case 'POKERUS6_SEARCH': {
        const { searchPokerus6 } = await import('../engine/gen6/pokerus6');
        post({ id: req.id, type: 'POKERUS6_DONE', payload: searchPokerus6(req.payload, onProgress) });
        break;
      }
      case 'EGG6_SEARCH': {
        const { searchEgg6 } = await import('../engine/gen6/egg6');
        post({ id: req.id, type: 'EGG6_DONE', payload: searchEgg6(req.payload, onProgress) });
        break;
      }
      case 'EVENT6_SEARCH': {
        const { searchEvent6 } = await import('../engine/gen6/event6');
        post({ id: req.id, type: 'EVENT6_DONE', payload: searchEvent6(req.payload, onProgress) });
        break;
      }
      case 'WILD6_SEARCH': {
        const { searchWild6 } = await import('../engine/gen6/wild6');
        post({ id: req.id, type: 'WILD6_DONE', payload: searchWild6(req.payload, onProgress) });
        break;
      }
      case 'TIMELINE6_SEARCH': {
        const { searchTimeline6 } = await import('../engine/gen6/timelineSearch');
        post({ id: req.id, type: 'TIMELINE6_DONE', payload: searchTimeline6(req.payload, onProgress) });
        break;
      }
      case 'STATIONARY6_SEARCH': {
        const { runStationary6Search } = await import('../engine/gen6/searches');
        const payload = runStationary6Search(req.payload, onProgress);
        post({ id: req.id, type: 'STATIONARY6_DONE', payload });
        break;
      }
      case 'ID6_SEARCH': {
        const { runId6Search } = await import('../engine/gen6/searches');
        const payload = runId6Search(req.payload, onProgress);
        post({ id: req.id, type: 'ID6_DONE', payload });
        break;
      }
      case 'MISC_SEARCH': {
        const result = searchMisc7(req.payload, onProgress);
        post({ id: req.id, type: 'MISC_DONE', payload: result });
        break;
      }
      case 'MAIN_SEARCH': {
        const result = runMainGen7Search(req.payload, { onProgress });
        post({ id: req.id, type: 'MAIN_DONE', payload: result });
        break;
      }
      case 'EGG_SEARCH': {
        const result = runEgg7Search(req.payload, { onProgress });
        post({ id: req.id, type: 'EGG_DONE', payload: result });
        break;
      }
      case 'ID_SEARCH': {
        const result = runId7Search(req.payload, { onProgress });
        post({ id: req.id, type: 'ID_DONE', payload: result });
        break;
      }
      case 'QR_SEARCH': {
        const { seed, clocks, min, max } = req.payload;
        const result = searchQrFrames(seed, clocks, min, max);
        post({ id: req.id, type: 'QR_DONE', payload: result });
        break;
      }
    }
  } catch (err) {
    post({
      id: req.id,
      type: 'ERROR',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
