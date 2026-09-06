'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { AdminBalances } from '@/shared/api/types';
import { useRole } from '@/providers/role-provider';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Segmented, type SegmentedItem } from '@/features/dashboard/components/Segmented';
import { AiCostCard } from '@/features/ai/components/AiCostCard';
import { AiUsageCard } from '@/features/ai/components/AiUsageCard';
import { AiSettingsCard } from '@/features/ai/components/AiSettingsCard';
import { AiSessionsPanel } from '@/features/ai/components/AiSessionsPanel';

/**
 * Where the Uyiz AI assistant is run from.
 *
 * It used to be a paginated table of conversations and nothing else, which
 * meant the two questions an owner actually asks about the assistant — what is
 * it costing, and which model is it on — had no answer anywhere in the panel.
 * Now the page is three things, and the log is the third of them rather than
 * the whole of it.
 *
 * Three, not one long scroll, because the three are read at different times:
 * spend is a daily glance, settings are a rare and deliberate change, and the
 * transcripts are an investigation. On a phone a single column carrying all
 * three would put the conversation table two full screens below the number
 * somebody opened the page for.
 *
 * The gates are not the same on all three, and the route gate is only the
 * lowest of them:
 *
 *  · MODERATOR opens the page and reads the spend, the usage and the
 *    conversations — `/admin/balances` and `/admin/ai/sessions` are both
 *    MODERATOR on the backend.
 *  · ADMIN additionally sees the settings tab, because `GET /admin/ai/settings`
 *    is RequireAdmin. A moderator gets no settings tab at all rather than a tab
 *    that 403s on open.
 *  · SUPERADMIN additionally gets the save and reset controls, because the
 *    PATCH is RequireSuperadmin — which is right, since a model change alters
 *    what every visitor's assistant runs on and what it bills us.
 */

type AiTab = 'overview' | 'settings' | 'sessions';

export default function AiPage() {
  const t = useTranslations('ai');
  const c = useTranslations('common');
  const { can } = useRole();

  const canReadSettings = can('aiSettingsRead');
  const canWriteSettings = can('aiSettingsWrite');

  const [tab, setTab] = useState<AiTab>('overview');

  /**
   * Both halves of the overview come from one route.
   *
   * There is no OpenAI-only endpoint: `/admin/balances` is where the assistant's
   * usage counters and its real spend live, beside the SMS credit the dashboard
   * reads from the same call. Sharing the dashboard's query key is deliberate —
   * an admin who came here from the dashboard sees the figures immediately
   * instead of watching a second identical request run.
   */
  const balances = useQuery({
    queryKey: ['balances'],
    queryFn: ({ signal }) => http.get<AdminBalances>(api.balances, { signal }),
  });

  const tabs: SegmentedItem<AiTab>[] = [
    { key: 'overview', label: t('tabs.overview') },
    ...(canReadSettings ? [{ key: 'settings' as const, label: t('tabs.settings') }] : []),
    { key: 'sessions', label: t('tabs.sessions') },
  ];

  return (
    <div>
      {/* No subtitle: `ai.subtitle` describes the conversation log, which is now
          one third of this page, so it sits with the log itself instead. */}
      <PageHeader
        title={t('title')}
        actions={
          <Segmented
            items={tabs}
            value={tab}
            onChange={setTab}
            ariaLabel={t('title')}
            className={`grid w-full ${tabs.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} sm:inline-grid sm:grid-flow-col sm:w-auto`}
          />
        }
      />

      {tab === 'overview' && (
        <section className="flex flex-col gap-4">
          {balances.isError ? (
            <div className="card p-5">
              <EmptyState
                tone="danger"
                icon={<AlertTriangle size={26} />}
                title={c('error')}
                description={balances.error.message}
                size="sm"
                action={
                  <Button variant="secondary" onClick={() => void balances.refetch()}>
                    {c('retry')}
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              {/* Spend first, and usage under it: the copy in the spend card
                  points at these counters as the numbers that are still correct
                  when OpenAI cannot be read, so they have to be the ones below
                  it at every width. */}
              <AiCostCard
                cost={balances.data?.ai.cost}
                loading={balances.isLoading}
                refreshing={balances.isFetching}
                onRefresh={() => void balances.refetch()}
              />
              <AiUsageCard usage={balances.data?.ai} loading={balances.isLoading} />
            </>
          )}

          {/* One note for both cards. "Today" is the UTC day on the backend for
              the spend and for the counters alike — five hours behind Tashkent,
              the same boundary the dashboard's counters use. */}
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {t('usage.utcNote')}
          </p>
        </section>
      )}

      {tab === 'settings' && canReadSettings && <AiSettingsCard canWrite={canWriteSettings} />}

      {tab === 'sessions' && <AiSessionsPanel />}
    </div>
  );
}
