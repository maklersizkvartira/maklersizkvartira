'use client';

import { useState, useEffect } from 'react';
import { Bell, Users, Smartphone, Send, RefreshCw, UserX, UserCheck, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { PushStats } from '@/shared/api/types';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { KpiCard } from '@/shared/ui/KpiCard';
import { PushComposer } from './PushComposer';
import { PushHistoryTable } from './PushHistoryTable';
import { GuestSubscribersTable } from './GuestSubscribersTable';

export function PushScreen() {
  const t = useTranslations('pushPage');

  const [stats, setStats] = useState<PushStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Tab state: 'composer' | 'guests'
  const [activeTab, setActiveTab] = useState<'composer' | 'guests'>('composer');
  const [targetGuestId, setTargetGuestId] = useState<string | undefined>(undefined);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const data = await http.get<PushStats>(api.push.stats);
      setStats(data);
    } catch {
      setStats({
        active_subscribers: 0,
        total_subscribers: 0,
        registered_subscribers: 0,
        guest_subscribers: 0,
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

  const handleSendToGuest = (guestId: string) => {
    setTargetGuestId(guestId);
    setActiveTab('composer');
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

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('composer')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
            activeTab === 'composer'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Push xabar yuborish va tarix</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('guests')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition relative ${
            activeTab === 'guests'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <UserX className="w-4 h-4" />
          <span>Mehmon foydalanuvchilar</span>
          {stats && stats.guest_subscribers > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'guests' ? 'bg-white text-indigo-700' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'
              }`}
            >
              {stats.guest_subscribers}
            </span>
          )}
        </button>
      </div>

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
