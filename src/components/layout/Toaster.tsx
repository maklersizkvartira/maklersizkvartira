/**
 * Toast host.
 *
 * Toasts are stored as translation keys, so a notification raised while the
 * UI was in Uzbek still reads correctly if the user switches language before
 * it disappears.
 */

import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

import { useTranslation } from '../../i18n';
import { useAppStore } from '../../stores/useAppStore';

const TONES = {
  success: { icon: CheckCircle2, className: 'border-brand/30 bg-brand-soft text-brand-text' },
  error: { icon: XCircle, className: 'border-danger/30 bg-danger-soft text-danger' },
  warning: { icon: AlertTriangle, className: 'border-warning/30 bg-warning-soft text-warning' },
  info: { icon: Info, className: 'border-info/30 bg-info-soft text-info' },
} as const;

export const Toaster: React.FC = () => {
  const { t } = useTranslation();
  const toasts = useAppStore((state) => state.toasts);
  const dismiss = useAppStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[130] flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      {toasts.map((toast) => {
        const tone = TONES[toast.tone];
        return (
          <div
            key={toast.id}
            className={`rise-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-raised backdrop-blur ${tone.className}`}
          >
            <tone.icon className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="flex-1 text-xs font-bold">
              {t(toast.key as never, toast.params)}
            </p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t('common.action.close')}
              className="shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default Toaster;
