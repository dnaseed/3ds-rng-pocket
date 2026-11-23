import { useCallback, useEffect, useRef, useState } from 'react';
import type { QrMatch } from '../engine/gen7/qrSearch';
import type {
  EggSearchOutput,
  EggSearchRequest,
  IdSearchOutput,
  IdSearchRequest,
  MainGen7SearchRequest,
  MainSearchOutput,
} from '../engine/gen7/searches';
import type { WorkerRequest, WorkerResponse } from './protocol';

type AnySearchResult = MainSearchOutput | EggSearchOutput | IdSearchOutput | QrMatch[];

export function useSearchWorker() {
  const workerRef = useRef<Worker | null>(null);
  const activeIdRef = useRef<number>(0);
  const resolverRef = useRef<{
    resolve: (val: AnySearchResult) => void;
    reject: (err: Error) => void;
  } | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const spawnWorker = useCallback(() => {
    const w = new Worker(new URL('./search.worker.ts', import.meta.url), {
      type: 'module',
    });
    w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;
      if (msg.id !== activeIdRef.current) return;

      if (msg.type === 'PROGRESS') {
        setProgress(msg.percent);
        return;
      }

      isRunningRef.current = false;
      setIsRunning(false);
      if (msg.type === 'ERROR') {
        setError(msg.message);
        resolverRef.current?.reject(new Error(msg.message));
        resolverRef.current = null;
        return;
      }

      setProgress(100);
      resolverRef.current?.resolve(msg.payload);
      resolverRef.current = null;
    };
    w.onerror = (ev) => {
      isRunningRef.current = false;
      setIsRunning(false);
      const errMsg = ev.message || 'Worker execution error';
      setError(errMsg);
      resolverRef.current?.reject(new Error(errMsg));
      resolverRef.current = null;
    };
    workerRef.current = w;
    return w;
  }, []);

  useEffect(() => {
    spawnWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [spawnWorker]);

  const abort = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    activeIdRef.current++;
    if (resolverRef.current) {
      resolverRef.current.reject(new Error('ABORTED'));
      resolverRef.current = null;
    }
    isRunningRef.current = false;
    setIsRunning(false);
    setProgress(0);
    spawnWorker();
  }, [spawnWorker]);

  const dispatch = useCallback(
    <T extends AnySearchResult>(reqWithoutId: Omit<WorkerRequest, 'id'>): Promise<T> => {
      if (isRunningRef.current && workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        resolverRef.current?.reject(new Error('ABORTED'));
        resolverRef.current = null;
        spawnWorker();
      }
      const w = workerRef.current ?? spawnWorker();
      const id = ++activeIdRef.current;
      isRunningRef.current = true;
      setIsRunning(true);
      setProgress(0);
      setError(null);

      return new Promise<T>((resolve, reject) => {
        resolverRef.current = {
          resolve: resolve as (val: AnySearchResult) => void,
          reject,
        };
        w.postMessage({ ...reqWithoutId, id } as WorkerRequest);
      });
    },
    [spawnWorker],
  );

  const runMainSearch = useCallback(
    (payload: MainGen7SearchRequest) =>
      dispatch<MainSearchOutput>({ type: 'MAIN_SEARCH', payload }),
    [dispatch],
  );

  const runEggSearch = useCallback(
    (payload: EggSearchRequest) => dispatch<EggSearchOutput>({ type: 'EGG_SEARCH', payload }),
    [dispatch],
  );

  const runIdSearch = useCallback(
    (payload: IdSearchRequest) => dispatch<IdSearchOutput>({ type: 'ID_SEARCH', payload }),
    [dispatch],
  );

  const runQrSearch = useCallback(
    (payload: { seed: number; clocks: number[]; min: number; max: number }) =>
      dispatch<QrMatch[]>({ type: 'QR_SEARCH', payload }),
    [dispatch],
  );

  return {
    isRunning,
    progress,
    error,
    abort,
    runMainSearch,
    runEggSearch,
    runIdSearch,
    runQrSearch,
  };
}
