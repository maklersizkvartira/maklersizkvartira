'use client';

import { useState, useEffect } from 'react';
import { Bell, Users, Smartphone, Send, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { PushStats } from '@/shared/api/types';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { KpiCard } from '@/shared/ui/KpiCard';
import { PushComposer } from './PushComposer';
import { PushHistoryTable } from './PushHistoryTable';

export function PushScreen() {
  const t = useTranslations('pushPage');

  const [stats, setStats] = useState<PushStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const data = await http.get<PushStats>(api.push.stats);
      setStats(data);
    } catch {
      setStats({
        active_subscribers: 0,
        total_devices: 0,
        total_sent: 0,
      });
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          iconBg="bg-indigo-50 dark:bg-indigo-950/50"
          iconColor="text-indigo-600 dark:text-indigo-400"
          label={t('stats.subscribers')}
          value={stats?.active_subscribers ?? 0}
          loading={statsLoading}
        />
        <KpiCard
          icon={<Smartphone className="w-5 h-5" />}
          iconBg="bg-purple-50 dark:bg-purple-950/50"
          iconColor="text-purple-600 dark:text-purple-400"
          label={t('stats.devices')}
          value={stats?.total_devices ?? 0}
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

      {/* Push Composer + Live Mobile Simulator */}
      <PushComposer onSent={handleRefresh} />

      {/* History Archive */}
      <PushHistoryTable refreshTrigger={refreshTrigger} />
    </div>
  );
}
