'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useUIStore, type ToastMessage, type ToastType } from '@/store/ui.store';

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
      role="status"
      aria-live="polite"
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

export function Toaster() {
  const toasts = useUIStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex items-start p-4 pointer-events-none sm:p-6 justify-center sm:justify-end">
      <div className="w-full max-w-sm flex flex-col items-center space-y-4 sm:items-end">
        {toasts.map((toast) => (
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
