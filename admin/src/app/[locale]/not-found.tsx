import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export default function NotFound() {
  const t = useTranslations('errors');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--bg)] px-6 text-center">
      <Image src="/brand/mark-lockup@2x.png" alt="" width={152} height={192} className="h-14 w-auto" priority />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">404</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">{t('notFound')}</p>
      </div>

      <Link
        href="/dashboard"
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-2)]"
      >
        {t('backToDashboard')}
      </Link>
    </div>
  );
}
