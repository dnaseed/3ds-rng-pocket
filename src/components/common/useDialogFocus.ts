import { useEffect, useRef } from 'react';

export function useDialogFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !ref.current) return;
    const trigger = document.activeElement;
    const dialog = ref.current;
    dialog.focus({ preventScroll: true });
    const cycleFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, a[href], [tabindex]',
      )).filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length > 0);
      const first = controls[0] ?? dialog;
      const last = controls[controls.length - 1] ?? dialog;
      const active = document.activeElement;
      if (event.shiftKey ? active === dialog || active === first : active === last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    dialog.addEventListener('keydown', cycleFocus);
    return () => {
      dialog.removeEventListener('keydown', cycleFocus);
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);
  return ref;
}
