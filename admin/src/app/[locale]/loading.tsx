import Image from 'next/image';
import { useTranslations } from 'next-intl';

export default function Loading() {
  const t = useTranslations('common');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[var(--bg)] px-6">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.16),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.10),transparent_28%)]" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
          <Image src="/brand/mark-lockup@2x.png" alt="" width={152} height={192} className="h-10 w-auto" priority />
        </div>

        <div className="space-y-3 text-center">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{t('loading')}</p>
          <div className="mx-auto h-3 w-64 rounded bg-[var(--color-surface-2)] animate-pulse" />
        </div>

        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-brand-500)] animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-brand-500)] animate-pulse" style={{ animationDelay: '120ms' }} />
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-brand-500)] animate-pulse" style={{ animationDelay: '240ms' }} />
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)]">
          <div
            className="h-full w-1/2 rounded-full bg-[linear-gradient(90deg,var(--color-brand-500),var(--color-cyan-500))]"
            style={{ animation: 'loading-bar 1.5s ease-in-out infinite' }}
          />
        </div>
      </div>
    </div>
  );
}
