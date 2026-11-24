import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useDialogFocus } from '../../components/common/useDialogFocus';
import type { Search6Output } from '../../engine/gen6/searches';
import { useApp } from '../../store/AppContext';
import { buttonClass } from './fields';

export interface Results6Data<Row> extends Search6Output<Row> {
  summary: string;
}

const pageSize = 20;

export const rowButtonClass = 'w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-left space-y-1 hover:border-amber-500/60 focus-visible:outline-2 focus-visible:outline-amber-400';

export function Results6<Row extends { frame: number }>({ result, error, renderRow }: {
  result: Results6Data<Row> | null;
  error: string | null;
  renderRow: (row: Row) => ReactNode;
}) {
  const { i18n } = useApp();
  const [position, setPosition] = useState<{ result: Results6Data<Row>; page: number } | null>(null);
  const page = position && position.result === result ? position.page : 0;
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const total = result ? Math.ceil(result.rows.length / pageSize) : 0;

  useEffect(() => {
    if (!result) return;
    list.current?.scrollTo({ top: 0 });
    if (!window.matchMedia('(min-width: 64rem)').matches) {
      root.current?.scrollIntoView({ block: 'start' });
    }
  }, [result, page]);

  return <div ref={root} className="scroll-mt-16 space-y-2">
    {error && <p role="alert" className="rounded-xl border border-rose-700 bg-rose-950 p-3 text-sm text-rose-200">{error}</p>}
    {result && <div className="space-y-1 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2">
      <p role="status" className="text-xs font-semibold">{result.rows.length} {i18n.t('app.results')}</p>
      <p className="break-words text-xs text-zinc-400">{result.summary}</p>
      {result.truncated && <p className="text-xs text-amber-300">{i18n.t('gen6.resultsLimit', { n: result.rows.length })}</p>}
    </div>}
    {result && result.rows.length ? <>
      {total > 1 && <div className="flex items-center justify-between gap-2">
        <button type="button" className={buttonClass} aria-label={i18n.t('misc.previous')} disabled={page === 0}
          onClick={() => setPosition({ result, page: page - 1 })}><ChevronLeft size={17} /></button>
        <span className="text-xs text-zinc-400">{i18n.t('misc.page', { page: page + 1, total })}</span>
        <button type="button" className={buttonClass} aria-label={i18n.t('misc.next')} disabled={page >= total - 1}
          onClick={() => setPosition({ result, page: page + 1 })}><ChevronRight size={17} /></button>
      </div>}
      <div className="lg:overflow-y-auto lg:pr-1" ref={list}>
        <ul className="space-y-2">
          {result.rows.slice(page * pageSize, (page + 1) * pageSize).map((row, index) => <li key={page * pageSize + index}>{renderRow(row)}</li>)}
        </ul>
      </div>
    </> : <p className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
      {i18n.t(result ? 'app.noResults' : 'app.startSearch')}
    </p>}
  </div>;
}

export function Details6({ title, open, onClose, children }: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { i18n } = useApp();
  const id = useId();
  const dialog = useDialogFocus(open);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" onClick={onClose}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}
      onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}
      className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl bg-zinc-900 border border-zinc-700 p-4 space-y-3 shadow-2xl">
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="text-base font-bold">{title}</h2>
        <button type="button" className={buttonClass} aria-label={i18n.t('app.close')} onClick={onClose}><X size={16} /></button>
      </div>
      {children}
    </div>
  </div>;
}
