import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useDialogFocus } from './useDialogFocus';

interface ScannerModalShellProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Shared accessible modal shell for camera/overlay capture dialogs.
 * Handles dialog semantics, focus trap, Escape dismissal, and focus restoration.
 */
export function ScannerModalShell({
  title,
  subtitle,
  icon,
  closeLabel,
  onClose,
  children,
}: ScannerModalShellProps) {
  const titleId = useId();
  const dialogRef = useDialogFocus(true);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 p-3">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="mx-auto max-w-md space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 text-zinc-100 focus:outline-none"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-9 w-9 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center">
              {icon}
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-bold text-zinc-100 truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-[11px] text-zinc-400 truncate">{subtitle}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="h-11 w-11 -mr-1 -my-1 shrink-0 inline-flex items-center justify-center rounded-xl text-zinc-300 active:scale-95 transition"
          >
            <span className="h-9 w-9 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center">
              <X className="w-4 h-4" />
            </span>
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
