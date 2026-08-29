'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/shared/ui/Button';
import { StatusPill } from '@/shared/ui/StatusPill';
import { StatLabel } from './stat-kit';

/**
 * The public monetization switch, unchanged in logic and moved down the page.
 *
 * It used to be the first thing a moderator read, which is the wrong answer to
 * "what should I do this morning": it is a platform MODE, not a task, and
 * everyone below SUPERADMIN cannot act on it at all. It stays fully visible —
 * the state is readable by anyone, the route behind it is not even
 * authenticated — it simply stops competing with the queue.
 *
 * The accent spine and the faint diagonal wash are what mark it as a mode
 * rather than a metric; it is the only card on the page with no number on it.
 *
 * A failed read must not print "Off". `enabled` is derived from
 * `data?.is_monetization_enabled === true`, so a 500 and a genuinely disabled
 * platform both arrive here as `false` — and this card states the platform's
 * billing mode, which is the last thing that should be guessed confidently.
 * On error it says so and offers the retry instead.
 */

export function MonetizationCard({
  enabled,
  loading,
  error,
  onRetry,
  canToggle,
  toggling,
  onToggle,
}: {
  enabled: boolean;
  loading: boolean;
  /** The settings read failed — the mode is unknown, not "off". */
  error: boolean;
  onRetry: () => void;
  /** SUPERADMIN only — anyone else would collect a 403 from the POST. */
  canToggle: boolean;
  toggling: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('dashboard');
  const c = useTranslations('common');

  return (
    <div className="card card-cut-tr card-wash rail tone-accent flex h-full flex-col p-5">
      <StatLabel className="block truncate">{t('monetization')}</StatLabel>

      <div className="mt-3">
        {!loading && !error && (
          <StatusPill
            status={enabled ? 'ACTIVE' : 'ARCHIVED'}
            label={enabled ? t('monetizationOn') : t('monetizationOff')}
            pulse={enabled}
          />
        )}
        {!loading && error && (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--color-danger)' }}
          >
            <AlertTriangle size={15} aria-hidden="true" />
            {c('error')}
          </p>
        )}
      </div>

      <p className="mt-3 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
        {t('monetizationHint')}
      </p>

      {error ? (
        <div className="mt-auto pt-4">
          <Button variant="secondary" size="sm" className="max-sm:w-full" onClick={onRetry}>
            {c('retry')}
          </Button>
        </div>
      ) : canToggle && (
        <div className="mt-auto pt-4">
          {/* Full width below sm: this is the only action on the whole page,
              and a 90px pill in the corner of a phone is not one. */}
          <Button
            variant="secondary"
            size="sm"
            className="max-sm:w-full"
            onClick={onToggle}
            loading={toggling}
            disabled={loading}
          >
            {t('toggleMonetization')}
          </Button>
        </div>
      )}
    </div>
  );
}
