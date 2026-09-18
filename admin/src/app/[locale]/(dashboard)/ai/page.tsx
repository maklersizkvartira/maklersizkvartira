'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Bot, Gauge, MessagesSquare, SlidersHorizontal } from 'lucide-react';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { AdminBalances } from '@/shared/api/types';
import { useRole } from '@/providers/role-provider';
import { HubPage, type HubTab } from '@/features/hubs/HubPage';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { AiCostCard } from '@/features/ai/components/AiCostCard';
import { AiUsageCard } from '@/features/ai/components/AiUsageCard';
import { AiSettingsCard } from '@/features/ai/components/AiSettingsCard';
import { AiSessionsPanel } from '@/features/ai/components/AiSessionsPanel';
import { AiSupportToggleCard } from '@/features/ai/components/AiSupportToggleCard';

/**
 * /ai — everything about the Uyiz assistant on one page, as a hub:
 *
 *  · overview — the support auto-reply switch (moved here from the support
 *    desk), what the assistant costs and how much it is used;
 *  · settings — the model and prompt (ADMIN reads, SUPERADMIN writes);
 *  · sessions — the paginated log of assistant conversations.
 *
 * The route gate is MODERATOR, the lowest of the three; `aiSettingsRead`
 * hides the settings tab from moderators instead of showing a tab that 403s.
 */

type AiTab = 'overview' | 'settings' | 'sessions';

function Overview() {
  const t = useTranslations('ai');
  const c = useTranslations('common');

  /** Shares the dashboard's query key on purpose — same route, no second request. */
  const balances = useQuery({
    queryKey: ['balances'],
    queryFn: ({ signal }) => http.get<AdminBalances>(api.balances, { signal }),
  });

  return (
    <section className="flex flex-col gap-4">
      <AiSupportToggleCard />

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
          <AiCostCard
            cost={balances.data?.ai.cost}
            loading={balances.isLoading}
            refreshing={balances.isFetching}
            onRefresh={() => void balances.refetch()}
          />
          <AiUsageCard usage={balances.data?.ai} loading={balances.isLoading} />
        </>
      )}

      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        {t('usage.utcNote')}
      </p>
    </section>
  );
}

export default function AiPage({ initialTab }: { initialTab?: AiTab } = {}) {
  const t = useTranslations('ai');
  const { can } = useRole();

  const canReadSettings = can('aiSettingsRead');
  const canWriteSettings = can('aiSettingsWrite');

  const tabs: HubTab<AiTab>[] = [
    { key: 'overview', label: t('tabs.overview'), icon: <Gauge size={13} />, body: <Overview /> },
    ...(canReadSettings
      ? [
          {
            key: 'settings' as const,
            label: t('tabs.settings'),
            icon: <SlidersHorizontal size={13} />,
            body: <AiSettingsCard canWrite={canWriteSettings} />,
          },
        ]
      : []),
    { key: 'sessions', label: t('tabs.sessions'), icon: <MessagesSquare size={13} />, body: <AiSessionsPanel /> },
  ];

  return (
    <HubPage<AiTab>
      icon={<Bot size={18} />}
      title={t('title')}
      subtitle={t('subtitle')}
      initialTab={initialTab}
      tabs={tabs}
    />
  );
}
