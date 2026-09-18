'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Send, RefreshCw, UserX, UserCheck, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { PushStats } from '@/shared/api/types';
import { SectionHeader } from '@/features/hubs/SectionHeader';
import { Button } from '@/shared/ui/Button';
import { PageTabs } from '@/shared/ui/PageTabs';
import { KpiCard } from '@/shared/ui/KpiCard';
import { PushComposer } from './PushComposer';
import { PushHistoryTable } from './PushHistoryTable';
import { GuestSubscribersTable } from './GuestSubscribersTable';

export function PushScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const t = useTranslations('pushPage');

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Tab state: 'composer' | 'guests'
  const [activeTab, setActiveTab] = useState<'composer' | 'guests'>('composer');
  const [targetGuestId, setTargetGuestId] = useState<string | undefined>(undefined);

  const EMPTY_STATS: PushStats = {
    active_subscribers: 0,
    total_subscribers: 0,
    registered_subscribers: 0,
    guest_subscribers: 0,
    total_devices: 0,
    total_sent: 0,
  };

  const { data: statsData, isFetching: statsLoading } = useQuery({
    queryKey: ['push', 'stats', refreshTrigger],
    queryFn: async () => {
      try {
        return await http.get<PushStats>(api.push.stats);
      } catch {
        return EMPTY_STATS;
      }
    },
  });
  const stats = statsData ?? null;

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSendToGuest = (guestId: string) => {
    setTargetGuestId(guestId);
    setActiveTab('composer');
  };

  return (
    <div className={embedded ? "space-y-6" : "space-y-6 pb-12"}>
      <SectionHeader
        embedded={embedded}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="rounded-xl flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
            <span>Yangilash</span>
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          iconBg="bg-indigo-50 dark:bg-indigo-950/50"
          iconColor="text-indigo-600 dark:text-indigo-400"
          label={t('stats.subscribers')}
          value={stats?.total_subscribers ?? 0}
          loading={statsLoading}
        />
        <KpiCard
          icon={<UserCheck className="w-5 h-5" />}
          iconBg="bg-blue-50 dark:bg-blue-950/50"
          iconColor="text-blue-600 dark:text-blue-400"
          label="Roʻyxatdan oʻtganlar"
          value={stats?.registered_subscribers ?? 0}
          loading={statsLoading}
        />
        <KpiCard
          icon={<UserX className="w-5 h-5" />}
          iconBg="bg-purple-50 dark:bg-purple-950/50"
          iconColor="text-purple-600 dark:text-purple-400"
          label="Mehmonlar (Kirib ketganlar)"
          value={stats?.guest_subscribers ?? 0}
          loading={statsLoading}
        />
        <KpiCard
          icon={<Send className="w-5 h-5" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          iconColor="text-emerald-600 dark:text-emerald-400"
          label={t('stats.sent')}
          value={stats?.total_sent ?? 0}
          loading={statsLoading}
        />
      </div>

      {/* Tabs Navigation — same pill recipe as the hub tabs above */}
      <PageTabs
        className="mb-5"
        aria-label="Push bo‘limlari"
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: 'composer', label: 'Push xabar yuborish va tarix', icon: <MessageSquare size={14} /> },
          {
            key: 'guests',
            label: 'Mehmon foydalanuvchilar',
            icon: <UserX size={14} />,
            count: stats && stats.guest_subscribers > 0 ? stats.guest_subscribers : undefined,
          },
        ]}
      />

      {/* Tab 1: Push Composer & History */}
      {activeTab === 'composer' && (
        <div className="space-y-6">
          <PushComposer
            key={targetGuestId || 'default'}
            onSent={handleRefresh}
            initialTargetUserId={targetGuestId}
            initialAudience={targetGuestId ? 'specific' : undefined}
          />
          <PushHistoryTable refreshTrigger={refreshTrigger} />
        </div>
      )}

      {/* Tab 2: Guest Subscribers */}
      {activeTab === 'guests' && (
        <GuestSubscribersTable
          onSendToGuest={handleSendToGuest}
          refreshTrigger={refreshTrigger}
        />
      )}
    </div>
  );
}
