import { searchQrFrames } from '../engine/gen7/qrSearch';
import { searchMisc7 } from '../engine/gen7/misc7';
import { runEgg7Search, runId7Search, runMainGen7Search } from '../engine/gen7/searches';
import type { WorkerRequest, WorkerResponse } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

function post(msg: WorkerResponse): void {
  self.postMessage(msg);
}

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
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
