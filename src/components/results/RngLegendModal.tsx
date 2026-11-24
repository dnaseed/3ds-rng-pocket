import { useDialogFocus } from '../common/useDialogFocus';
import { HelpCircle, Sparkles, X } from 'lucide-react';
import { useEffect } from 'react';
import { useApp } from '../../store/AppContext';

interface RngLegendModalProps {
  open: boolean;
  onClose: () => void;
  gen6?: boolean;
}

export function RngLegendModal({ open, onClose, gen6 }: RngLegendModalProps) {
  const { i18n } = useApp();

  const dialogRef = useDialogFocus(open);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end justify-center lg:items-center lg:p-6"
      onClick={onClose}
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={i18n.t('search.legendTitle')}
    >
      <div
        className="w-full max-w-xl bg-zinc-950 border-t border-zinc-800 rounded-t-3xl lg:rounded-3xl lg:border lg:max-h-full p-4 space-y-3 safe-pb max-h-[82dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-zinc-100">{i18n.t('search.legendTitle')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={i18n.t('app.close')}
            className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {gen6 ? <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-xs leading-relaxed">
          <p>{i18n.t('gen6.legendBadges')}</p>
          <p>{i18n.t('gen6.legendIv')}</p>
          <p>{i18n.t('gen6.legendState')}</p>
        </div> : <>
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3 space-y-2.5 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="shrink-0 px-2 py-0.5 rounded-md border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[11px] font-semibold">
              Safe
            </span>
            <p className="text-zinc-300 leading-snug">{i18n.t('search.legendSafe')}</p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="shrink-0 px-2 py-0.5 rounded-md border bg-amber-500/15 text-amber-300 border-amber-500/30 text-[11px] font-semibold">
              ★ Blink
            </span>
            <p className="text-zinc-300 leading-snug">{i18n.t('search.legendBlink')}</p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="shrink-0 px-2 py-0.5 rounded-md border bg-rose-500/15 text-rose-300 border-rose-500/30 text-[11px] font-semibold">
              ? Unsafe
            </span>
            <p className="text-zinc-300 leading-snug">{i18n.t('search.legendUnsafe')}</p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="shrink-0 px-2 py-0.5 rounded-md border bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-[11px] font-semibold">
              {'<?>'}
            </span>
            <p className="text-zinc-300 leading-snug">{i18n.t('search.legendHidden')}</p>
          </div>
          <div className="flex items-start gap-2.5 pt-1 border-t border-zinc-800">
            <div className="shrink-0 flex items-center gap-1">
              <span className="text-emerald-400 font-bold">Sync ✓</span>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-400 text-zinc-950 text-[11px] font-bold">
                <Sparkles className="w-2.5 h-2.5" />★
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-cyan-400 text-zinc-950 text-[11px] font-bold">
                ◇
              </span>
            </div>
            <p className="text-zinc-300 leading-snug">{i18n.t('search.legendSync')}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3 space-y-1.5">
          <div className="text-xs font-bold text-amber-300">{i18n.t('search.legendFlowTitle')}</div>
          <p className="text-xs text-zinc-300 leading-relaxed">{i18n.t('search.legendFlow')}</p>
        </div>
        </>}
      </div>
    </div>
  );
}
