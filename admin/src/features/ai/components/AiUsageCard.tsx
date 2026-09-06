'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Activity } from 'lucide-react';

import type { AdminBalances } from '@/shared/api/types';

import { Figure, SectionHead } from './ai-kit';

/**
 * How much the assistant is being used, counted in our own database.
 *
 * These three numbers are the ones that are always right: they are `COUNT`s
 * over `AIMessage` and `AISession`, not a reading taken from someone else's
 * API, so they survive a missing admin key, a refused key and an OpenAI
 * outage alike. That is why the spend card above tells the reader they are
 * still correct instead of hiding them alongside the money.
 *
 * They are also the numbers a reader will be tempted to turn into money.
 * Nothing here does that, and nothing here should: a message is not a token
 * and a token is not a dollar.
 */

interface AiUsageCardProps {
  /** `undefined` while `/admin/balances` is in flight. */
  usage: AdminBalances['ai'] | undefined;
  loading: boolean;
}

export function AiUsageCard({ usage, loading }: AiUsageCardProps) {
  const t = useTranslations('ai');
  const locale = useLocale();

  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const show = (value: number | undefined) => (value === undefined ? '—' : number.format(value));

  return (
    <section className="card tone-neutral p-5">
      <SectionHead
        icon={<Activity size={17} />}
        title={t('usage.title')}
        subtitle={t('usage.subtitle')}
      />

      <div className="grid grid-cols-3 gap-3">
        <Figure label={t('usage.messagesToday')} value={show(usage?.messagesToday)} loading={loading} />
        <Figure label={t('usage.messagesThisMonth')} value={show(usage?.messagesThisMonth)} loading={loading} />
        <Figure label={t('usage.sessionsToday')} value={show(usage?.sessionsToday)} loading={loading} />
      </div>
    </section>
  );
}
