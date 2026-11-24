import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Id6WorkerRequest, Stationary6WorkerRequest } from '../engine/gen6/searches';
import type { QrMatch } from '../engine/gen7/qrSearch';
import type { MiscSearchOutput, MiscSearchRequest } from '../engine/gen7/misc7';
import type {
  EggSearchOutput,
  EggSearchRequest,
  IdSearchOutput,
  IdSearchRequest,
  MainGen7SearchRequest,
  MainSearchOutput,
} from '../engine/gen7/searches';
import type { WorkerCommand, WorkerRequest, WorkerResponse } from './protocol';

type CompletedSearch = Extract<WorkerResponse, { payload: unknown }>;
type AnySearchResult = CompletedSearch['payload'];

/** A changed scope (for example the active game) invalidates the in-flight request. */
export function useSearchWorker(scope?: string) {
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
      if (workerRef.current !== w || msg.id !== activeIdRef.current) return;

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
      if (workerRef.current !== w) return;
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

  const disposeWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    activeIdRef.current++;
    resolverRef.current?.reject(new Error('ABORTED'));
    resolverRef.current = null;
    isRunningRef.current = false;
  }, []);

  useLayoutEffect(() => {
    setIsRunning(false);
    setProgress(0);
    setError(null);
    return disposeWorker;
  }, [scope, disposeWorker]);

  const abort = useCallback(() => {
    disposeWorker();
    setIsRunning(false);
    setProgress(0);
  }, [disposeWorker]);

  const dispatch = useCallback(
    <T extends AnySearchResult>(command: WorkerCommand): Promise<T> => {
      if (isRunningRef.current) disposeWorker();
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
        const request: WorkerRequest = { ...command, id };
        try {
          w.postMessage(request);
        } catch (err) {
          resolverRef.current = null;
          isRunningRef.current = false;
          setIsRunning(false);
          const failure = err instanceof Error ? err : new Error(String(err));
          setError(failure.message);
          reject(failure);
        }
      });
    },
    [disposeWorker, spawnWorker],
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

  const runMiscSearch = useCallback(
    (payload: MiscSearchRequest) => dispatch<MiscSearchOutput>({ type: 'MISC_SEARCH', payload }),
    [dispatch],
  );

  const runStationary6Search = useCallback(
    (payload: Stationary6WorkerRequest) =>
      dispatch<Extract<CompletedSearch, { type: 'STATIONARY6_DONE' }>['payload']>({
        type: 'STATIONARY6_SEARCH', payload,
      }),
    [dispatch],
  );

  const runId6Search = useCallback(
    (payload: Id6WorkerRequest) => dispatch<Extract<CompletedSearch, { type: 'ID6_DONE' }>['payload']>({
      type: 'ID6_SEARCH', payload,
    }),
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
    runMiscSearch,
    runStationary6Search,
    runId6Search,
  };
}
