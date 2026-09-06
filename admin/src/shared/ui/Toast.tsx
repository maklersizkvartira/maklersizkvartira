'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useUIStore, type ToastMessage, type ToastType } from '@/store/ui.store';

import { Z_DIALOG_POPOVER } from './z-layers';

/**
 * Transient notices.
 *
 * The queue itself lives in the UI store alongside the other chrome state —
 * this file used to keep a second zustand store of its own, which meant a
 * `toast.error()` raised from a hook and a toast raised through the store went
 * into two different lists and only one of them was ever rendered.
 *
 * The dismiss label is read from the catalogue here rather than injected like
 * the rest of the kit's strings: a toast is raised imperatively from a mutation
 * handler, so there is no call site with a translator to pass one. `<Toaster/>`
 * renders inside `NextIntlClientProvider`, so the hook is available.
 */

export type { ToastMessage, ToastType };

/**
 * One step above the topmost layer in `z-layers`, because a toast has to clear
 * every dialog and not only the mobile dock.
 *
 * Almost every toast in the panel is raised *while* the thing that raised it is
 * still on screen — a moderation mutation fails and its sheet stays open — and
 * the old `z-[100]` put the whole stack under the dialog's opaque blurred
 * backdrop. The moderator saw nothing at all and tapped the action a second
 * time. The wrapper stays `pointer-events-none` (only the card itself takes
 * clicks) so raising the layer cannot swallow taps meant for the dialog below.
 */
const Z_TOAST = Z_DIALOG_POPOVER + 1;

/**
 * How many toasts may be on screen at once.
 *
 * The stack is a fixed column with no scroll, so an unbounded list runs off the
 * bottom of a phone. Nothing raises a burst today — there is no
 * `QueryCache.onError` — but a page with four queries during a backend blip is
 * one line of configuration away from it. The OLDEST are dropped: the newest
 * notice is the one the admin is waiting on, and every call site discards the
 * id `addToast` returns, so nothing is left holding a reference to a dropped
 * one.
 */
const MAX_VISIBLE = 3;

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="text-[var(--color-success)]" size={20} />,
  error: <AlertCircle className="text-[var(--color-danger)]" size={20} />,
  info: <Info className="text-[var(--accent)]" size={20} />,
};

const BG_COLORS: Record<ToastType, string> = {
  success: 'bg-[var(--color-success-bg)] border-[var(--color-success-border)]',
  error: 'bg-[var(--color-danger-bg)] border-[var(--color-danger-border)]',
  info: 'bg-[var(--accent-subtle)] border-[var(--accent-border)]',
};

function ToastItem({ toast }: { toast: ToastMessage }) {
  const removeToast = useUIStore((s) => s.removeToast);
  const c = useTranslations('common');

  useEffect(() => {
    // duration 0 pins the toast — for anything the admin has to acknowledge.
    if (toast.duration === 0) return;
    const timer = setTimeout(() => removeToast(toast.id), toast.duration ?? 3000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  return (
    <div
      className={`
        pointer-events-auto w-full max-w-sm overflow-hidden rounded-[var(--radius-lg)]
        border shadow-lg transition-all animate-slide-in-right
        flex items-start p-4 ${BG_COLORS[toast.type]}
      `}
    >
      <div className="flex-shrink-0">{ICONS[toast.type]}</div>
      <div className="ml-3 w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{toast.title}</p>
        {toast.message && <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{toast.message}</p>}
      </div>
      <div className="ml-4 flex flex-shrink-0">
        <button
          type="button"
          className="inline-flex rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus:outline-none transition-all"
          onClick={() => removeToast(toast.id)}
        >
          <span className="sr-only">{c('close')}</span>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * The stack, and the one live region announcing it.
 *
 * Two things it does not do any more, both of which were wrong:
 *
 *  · It no longer unmounts when the list is empty. A live region has to be in
 *    the document BEFORE its content changes; mounted in the same instant as
 *    the first toast, screen readers commonly announced nothing at all. The
 *    always-present wrapper is `pointer-events-none`, so an empty one cannot
 *    swallow the taps meant for the header underneath it.
 *  · The `role`/`aria-live` pair moved here off each card. Nesting a live
 *    region inside a live region is what NVDA and JAWS read twice.
 *
 * The top padding is the fixed header's own height. Without it a toast on a
 * 390px phone covers the hamburger button — the control the admin needs in
 * order to leave the screen that has just failed. Padding rather than `top`,
 * so the box still spans the viewport and the two are never added together.
 * `--header-height` is declared on bare `:root`, so this also resolves on
 * /login and over the full-screen moderation sheets, where the toast simply
 * sits 58px lower.
 */
export function Toaster() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  // Dropped from the queue, not merely hidden: the dismiss timer lives in
  // `ToastItem`, so a toast held back until the stack drained would carry no
  // timer at all and then surface seconds after the event it describes.
  const overflow = toasts.length - MAX_VISIBLE;
  useEffect(() => {
    if (overflow <= 0) return;
    for (const dropped of useUIStore.getState().toasts.slice(0, overflow)) {
      removeToast(dropped.id);
    }
  }, [overflow, removeToast]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="fixed inset-x-0 top-0 flex items-start p-4 pt-[calc(var(--header-height)+1rem)] sm:p-6 sm:pt-[calc(var(--header-height)+1.5rem)] pointer-events-none justify-center sm:justify-end"
      style={{ zIndex: Z_TOAST }}
    >
      <div className="w-full max-w-sm flex flex-col items-center space-y-4 sm:items-end">
        {toasts.slice(-MAX_VISIBLE).map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
    </div>
  );
}

/**
 * Imperative shorthand for code that is not a component — a mutation's
 * onError, say. Titles and messages must arrive already translated; this layer
 * has no access to the message catalogue.
 */
export const toast = {
  success: (title: string, message?: string, duration?: number) =>
    useUIStore.getState().addToast({ type: 'success', title, message, duration }),
  error: (title: string, message?: string, duration?: number) =>
    useUIStore.getState().addToast({ type: 'error', title, message, duration }),
  info: (title: string, message?: string, duration?: number) =>
    useUIStore.getState().addToast({ type: 'info', title, message, duration }),
};
