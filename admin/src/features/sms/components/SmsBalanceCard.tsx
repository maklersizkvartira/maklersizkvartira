'use client';

/**
 * What is left with the SMS provider, and whether codes are going out at all.
 *
 * This is the sharpest number in the panel. When the credit runs out,
 * registration, code sign-in and password reset stop dead and the product
 * says nothing at all — a visitor simply never receives a code, and the first
 * anyone hears of it is a support message. Until the overview endpoint existed
 * the balance was reachable only by running `scripts/check_sms` from a
 * terminal, or as a raw so'm figure in the corner of the dashboard.
 *
 * Two rules this card exists to keep:
 *
 *  · Unreachable is not zero. `provider` is null both when no token is
 *    configured and when DevSMS did not answer, and neither of those is "the
 *    account is empty". They are emergencies of opposite kinds — one needs a
 *    payment, the other needs a retry — so the null case prints "unknown" and
 *    says why, and never a numeral.
 *  · "Low" is the backend's threshold, not one invented here. `lowBalanceWarnSum`
 *    arrives in the payload precisely so the amber on this screen and the
 *    `sms.balance_low` line in the server log mean the same thing.
 */

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { TriangleAlert, Wallet } from 'lucide-react';

import type { SmsOverview } from '@/shared/api/types';
import { Skeleton } from '@/shared/ui/Skeleton';

export function SmsBalanceCard({
  data,
  isError = false,
}: {
  data?: SmsOverview;
  /** The read failed. The screen shows the banner; the card shows an em dash
   *  rather than a skeleton that would shimmer for ever. */
  isError?: boolean;
}) {
  const t = useTranslations('sms.overview');
  const locale = useLocale();
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const provider = data?.provider ?? null;
  const threshold = data?.lowBalanceWarnSum ?? null;

  /*
   * The backend's own two tiers, from `_warn_on_low_balance` in
   * services/sms.py: at or below zero it logs an ERROR because sending has
   * already stopped, below the threshold a WARNING because there is still time
   * to top up. Mirrored with the same comparisons — `<= 0` and `< threshold` —
   * so a balance that pages whoever is on call is never calm on this screen.
   */
  const exhausted = provider !== null && provider.balance <= 0;
  const low =
    provider !== null && threshold !== null && !exhausted && provider.balance < threshold;
  const alarming = exhausted || low;

  const tone = provider === null
    ? 'tone-neutral'
    : exhausted
      ? 'tone-danger'
      : low
        ? 'tone-warning'
        : 'tone-accent';

  return (
    <div className={`card card-hero card-cut-tr ${tone} flex h-full flex-col p-5`}>
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden="true" className="icon-tile flex-center">
          {alarming ? <TriangleAlert size={18} /> : <Wallet size={18} />}
        </span>

        {/* Whether sending is switched on at all, first thing and always
            visible: with SMS_ENABLED off every counter below still moves —
            rows are written as SKIPPED — while nothing reaches a phone. */}
        {data && (
          <span className={`badge ${data.smsEnabled ? 'badge-success' : 'badge-warning'}`}>
            {data.smsEnabled ? t('enabled') : t('disabled')}
          </span>
        )}
      </div>

      <span className="stat-label mt-3 block">{t('balance')}</span>

      {!data ? (
        isError ? (
          <p className="stat-num mt-2" style={{ fontSize: 26, color: 'var(--color-text-muted)' }}>
            —
          </p>
        ) : (
          <Skeleton className="mt-2.5" width={150} height={26} radius="var(--radius-sm)" />
        )
      ) : provider === null ? (
        <>
          <p className="mt-2 text-xl font-bold" style={{ color: 'var(--color-text-muted)' }}>
            {t('balanceUnknown')}
          </p>
          {/* The sentence carries the whole point: this is not zero. */}
          <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {t('balanceUnknownHint')}
          </p>
        </>
      ) : (
        <>
          <p
            className="stat-num mt-2"
            style={{ fontSize: 26, ...(alarming ? { color: 'var(--tone)' } : {}) }}
          >
            {t('credit', { amount: nf.format(Math.round(provider.balance)) })}
          </p>
          {/* Null when the provider quotes a price of 0, in which case there
              is no honest division to print. */}
          {provider.remaining_sms !== null && (
            <p className="mt-1.5 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {t('remaining', { count: nf.format(provider.remaining_sms) })}
            </p>
          )}
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t('price', { amount: nf.format(provider.sms_price) })}
          </p>
        </>
      )}

      {alarming && threshold !== null && (
        <div
          className="mt-3.5 rounded-[var(--radius-md)] p-3"
          style={{ background: 'var(--tone-bg)', border: '1px solid var(--tone-border)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--tone)' }}>
            {t('low')}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            {t('lowHint', { amount: nf.format(threshold) })}
          </p>
        </div>
      )}

      {data && !data.smsEnabled && (
        <p className="mt-3.5 text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          {t('disabledHint')}
        </p>
      )}

      {/* The sender name is diagnosis, not decoration: twenty consecutive
          refusals of the screened name suspend sending for a day, and the
          reader of a wall of FAILED rows needs to know which name was used. */}
      <div
        className="mt-auto border-t pt-3.5"
        style={{ borderColor: 'var(--color-border-light)' }}
      >
        <span className="stat-label block">{t('senderName')}</span>
        {data ? (
          <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {data.senderName}
          </p>
        ) : isError ? (
          <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            —
          </p>
        ) : (
          <Skeleton className="mt-1.5" width={90} height={14} radius="var(--radius-xs)" />
        )}
        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {t('senderNameHint')}
        </p>
      </div>
    </div>
  );
}
