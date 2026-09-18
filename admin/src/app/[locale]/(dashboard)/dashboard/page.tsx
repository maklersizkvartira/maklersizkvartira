'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import {
  Activity,
  Building2,
  Layers,
  MessageSquareText,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { Link } from '@/i18n/routing';
import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type {
  AdminBalances,
  AdminStats,
  PublicSettings,
  RegistrationPoint,
  TrafficPoint,
} from '@/shared/api/types';

/** `GET /admin/payments/stats` — the slice the first row reads. */
interface PaymentStatsSummary {
  totalRevenue: number;
  totalCount: number;
  todayRevenue: number;
  todayCount: number;
}
import { useRole } from '@/providers/role-provider';
import { useConfirm } from '@/providers/confirm-provider';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { toast } from '@/shared/ui/Toast';
import { STAT_COUNT } from '@/features/dashboard/dashboard-groups';
import { Reveal } from '@/features/dashboard/components/Reveal';
import { BalancesCard } from '@/features/dashboard/components/BalancesCard';
import { RiskCard } from '@/features/dashboard/components/RiskCard';
import { TodayCard } from '@/features/dashboard/components/TodayCard';
import { ListingFlowCard } from '@/features/dashboard/components/ListingFlowCard';
import { MonetizationCard } from '@/features/dashboard/components/MonetizationCard';
import { StatBand } from '@/features/dashboard/components/StatBand';
import { LineChart } from '@/features/dashboard/components/LineChart';
import {
  AnimatedCounter,
  CardHeader,
  PremiumStatCard,
} from '@/features/dashboard/components/PremiumStatCard';

/**
 * The overview, composed the way SotuvchiAi's dashboard is: a page header
 * with an icon tile, a row of four KPI cards whose first is the hero (the
 * one number the page is about — how much is waiting for a decision), then
 * bento rows of `.card` panels — a wide chart with a side card beside it,
 * then the queues, balances, risk, today and the platform switch — and the
 * reference band of every counter at the foot.
 *
 * All the data is what the page always read: `/admin/stats`, `/admin/balances`,
 * the seven-day traffic and registration series (shared with /analytics by
 * query key), and `/settings` for the monetization mode. Nothing is invented
 * for a delta: every trend line here is the series itself.
 */

const WINDOW_DAYS = 7;
const STATS_POLL_MS = 120_000;
const CHART_POLL_MS = 300_000;

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const c = useTranslations('common');
  const e = useTranslations('errors');
  const n = useTranslations('nav');
  const an = useTranslations('analytics');
  const locale = useLocale();
  const { can, canAccess } = useRole();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: ({ signal }) => http.get<AdminStats>(api.stats, { signal }),
    refetchInterval: STATS_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const balancesQuery = useQuery({
    queryKey: ['balances'],
    queryFn: ({ signal }) => http.get<AdminBalances>(api.balances, { signal }),
    refetchInterval: STATS_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const trafficQuery = useQuery({
    queryKey: ['chart', 'traffic', WINDOW_DAYS],
    queryFn: ({ signal }) => http.get<TrafficPoint[]>(api.charts.traffic(WINDOW_DAYS), { signal }),
    refetchInterval: CHART_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const registrationsQuery = useQuery({
    queryKey: ['chart', 'registrations', WINDOW_DAYS],
    queryFn: ({ signal }) =>
      http.get<RegistrationPoint[]>(api.charts.registrations(WINDOW_DAYS), { signal }),
    refetchInterval: CHART_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const monetizationQuery = useQuery({
    queryKey: ['public-settings'],
    queryFn: ({ signal }) =>
      http.raw.get<PublicSettings>(api.settings.publicRead, { signal, skipAuth: true }),
  });

  const monetizationOn = monetizationQuery.data?.is_monetization_enabled === true;

  const toggleMonetization = useMutation({
    mutationFn: () => http.post(api.settings.toggleMonetization),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['public-settings'] });
      toast.success(c('success'), monetizationOn ? t('monetizationOff') : t('monetizationOn'));
    },
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  // Revenue for the first row — the same summary the payments page reads.
  const paymentStatsQuery = useQuery({
    queryKey: ['admin-payment-stats'],
    queryFn: ({ signal }) =>
      http.get<PaymentStatsSummary>('/admin/payments/stats', { signal }),
    staleTime: 60_000,
  });

  const queries = [statsQuery, balancesQuery, trafficQuery, registrationsQuery, monetizationQuery, paymentStatsQuery];
  const refreshing = queries.some((query) => query.isFetching);
  const refreshAll = () => {
    void Promise.all(queries.map((query) => query.refetch()));
  };

  const stats = statsQuery.data;
  const pay = paymentStatsQuery.data;
  const smsProvider = balancesQuery.data?.sms ?? null;
  const money = (n: number) => `${Math.round(n).toLocaleString(locale)} ${c('currency')}`;
  const traffic = trafficQuery.data ?? [];
  const registrations = registrationsQuery.data ?? [];

  const dayLabel = useMemo(
    () => (iso: string) =>
      new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
    [locale],
  );

  if (!canAccess('/dashboard')) {
    return (
      <div className="card">
        <EmptyState icon={<ShieldAlert size={26} />} title={e('forbidden')} />
      </div>
    );
  }

  const updatedChip = (statsQuery.dataUpdatedAt > 0 || statsQuery.isError) && (
    <span
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold"
      style={{
        background: statsQuery.isError ? 'var(--color-danger-bg)' : 'var(--color-surface-2)',
        border: `1px solid ${statsQuery.isError ? 'var(--color-danger-border)' : 'var(--color-border)'}`,
        color: statsQuery.isError ? 'var(--color-danger)' : 'var(--color-text-secondary)',
      }}
    >
      <span
        className={`status-dot ${refreshing ? 'animate-pulse-status' : ''}`}
        style={{ background: statsQuery.isError ? 'var(--color-danger)' : 'var(--color-success)' }}
      />
      {statsQuery.isError
        ? t('live.error')
        : t('refreshedAt', {
            time: new Date(statsQuery.dataUpdatedAt).toLocaleTimeString(locale, {
              hour: '2-digit',
              minute: '2-digit',
            }),
          })}
    </span>
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10 animate-fade-in">
      <PageHeader
        icon={<Layers size={18} />}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            {updatedChip}
            <Button variant="secondary" size="sm" onClick={refreshAll} loading={refreshing}>
              {c('refresh')}
            </Button>
          </>
        }
      />

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      {statsQuery.error ? (
        <div className="card flex flex-wrap items-center gap-4 p-5">
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>
              {c('error')}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {statsQuery.error instanceof Error ? statsQuery.error.message : e('network')}
            </p>
          </div>
          <Button variant="secondary" size="sm" className="max-sm:w-full" onClick={() => statsQuery.refetch()}>
            {c('retry')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Reveal index={0} className="h-full">
            <PremiumStatCard
              variant="hero"
              label={t('hero.totalRevenue')}
              value={pay ? <AnimatedCounter value={Math.round(pay.totalRevenue)} format={money} /> : '—'}
              sublabel={
                <span className="font-semibold">
                  {pay ? t('hero.totalRevenueSub', { count: pay.totalCount }) : ''}
                </span>
              }
              icon={<Wallet size={18} />}
              loading={paymentStatsQuery.isLoading}
              href="/payments"
            />
          </Reveal>
          <Reveal index={1} className="h-full">
            <PremiumStatCard
              label={t('hero.smsBalance')}
              value={
                balancesQuery.isLoading
                  ? '—'
                  : smsProvider
                    ? <AnimatedCounter value={Math.round(smsProvider.balance)} format={money} />
                    : '—'
              }
              sublabel={
                <span style={{ color: smsProvider ? 'var(--color-text-muted)' : 'var(--color-warning)' }}>
                  {smsProvider
                    ? smsProvider.remaining_sms !== null
                      ? t('hero.smsBalanceSub', { count: smsProvider.remaining_sms })
                      : ''
                    : t('hero.smsBalanceUnknown')}
                </span>
              }
              icon={<MessageSquareText size={16} />}
              loading={balancesQuery.isLoading}
              href="/notifications?tab=sms"
            />
          </Reveal>
          <Reveal index={2} className="h-full">
            <PremiumStatCard
              label={t('hero.todayRevenue')}
              value={pay ? <AnimatedCounter value={Math.round(pay.todayRevenue ?? 0)} format={money} /> : '—'}
              sublabel={
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {pay ? t('hero.todayRevenueSub', { count: pay.todayCount ?? 0 }) : ''}
                </span>
              }
              icon={<TrendingUp size={16} />}
              loading={paymentStatsQuery.isLoading}
              href="/payments"
            />
          </Reveal>
          <Reveal index={3} className="h-full">
            <PremiumStatCard
              label={t('hero.listingsTotal')}
              value={stats ? <AnimatedCounter value={stats.totalListings} /> : '—'}
              sublabel={
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {stats
                    ? t('hero.listingsTotalSub', { pending: stats.pendingListings, today: stats.todayNewListings })
                    : ''}
                </span>
              }
              icon={<Building2 size={16} />}
              loading={statsQuery.isLoading}
              href="/listings"
            />
          </Reveal>
        </div>
      )}

      {/* ── Bento row 1: traffic chart + today ───────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Reveal index={4} className="lg:col-span-2">
          <div className="card p-0 h-full flex flex-col">
            <div className="p-6 pb-2">
              <CardHeader
                icon={<TrendingUp size={18} />}
                title={an('charts.traffic')}
                subtitle={t('trend.window', { days: WINDOW_DAYS })}
                action={
                  <Link
                    href="/analytics"
                    className="text-xs font-semibold hover:underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    {n('analytics')} →
                  </Link>
                }
              />
            </div>
            <div className="px-6 pb-6 flex-1">
              {trafficQuery.isLoading ? (
                <div className="skeleton h-[220px] w-full" />
              ) : traffic.length === 0 ? (
                <EmptyState size="sm" title={c('noData')} />
              ) : (
                <LineChart
                  labels={traffic.map((point) => dayLabel(point.date))}
                  series={[
                    { key: 'visitors', label: an('summary.visitors'), values: traffic.map((p) => p.visitors) },
                    { key: 'views', label: an('summary.views'), values: traffic.map((p) => p.views) },
                  ]}
                />
              )}
            </div>
          </div>
        </Reveal>
        <Reveal index={5}>
          <TodayCard stats={stats} traffic={traffic} />
        </Reveal>
      </div>

      {/* ── Bento row 2: queues + balances + risk ───────────────────────── */}
      <section id="triage" className="scroll-mt-[76px] grid lg:grid-cols-2 gap-6">
        <Reveal index={7}>
          <BalancesCard
            data={balancesQuery.data}
            isError={balancesQuery.isError}
            onRetry={() => void balancesQuery.refetch()}
          />
        </Reveal>
        <Reveal index={8}>
          <RiskCard stats={stats} />
        </Reveal>
      </section>

      {/* ── Bento row 3: registrations chart + listing flow + mode ───────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Reveal index={9}>
          <div className="card p-0 h-full flex flex-col">
            <div className="p-6 pb-2">
              <CardHeader
                icon={<Activity size={18} />}
                title={an('charts.registrations')}
                subtitle={t('trend.window', { days: WINDOW_DAYS })}
              />
            </div>
            <div className="px-6 pb-6 flex-1">
              {registrationsQuery.isLoading ? (
                <div className="skeleton h-[180px] w-full" />
              ) : registrations.length === 0 ? (
                <EmptyState size="sm" title={c('noData')} />
              ) : (
                <LineChart
                  area
                  labels={registrations.map((point) => dayLabel(point.date))}
                  series={[
                    {
                      key: 'registrations',
                      label: an('summary.registrations'),
                      values: registrations.map((p) => p.count),
                    },
                  ]}
                />
              )}
            </div>
          </div>
        </Reveal>
        <Reveal index={10}>
          <ListingFlowCard stats={stats} />
        </Reveal>
        <Reveal index={11}>
          <MonetizationCard
            enabled={monetizationOn}
            loading={monetizationQuery.isLoading}
            error={monetizationQuery.isError}
            onRetry={() => void monetizationQuery.refetch()}
            canToggle={can('monetizationToggle')}
            toggling={toggleMonetization.isPending}
            onToggle={async () => {
              const ok = await confirm({
                title: t('monetization'),
                message: monetizationOn ? t('monetizationOffConfirm') : t('monetizationOnConfirm'),
                isDestructive: monetizationOn,
                confirmLabel: monetizationOn ? t('monetizationDisable') : t('monetizationEnable'),
              });
              if (ok) toggleMonetization.mutate();
            }}
          />
        </Reveal>
      </div>

      {/* ── Reference band: every counter ───────────────────────────────── */}
      <Reveal index={12}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3
              className="text-sm font-bold flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
            >
              <Building2 size={15} style={{ color: 'var(--accent)' }} />
              {t('allMetrics')}
            </h3>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
              {STAT_COUNT}
            </span>
          </div>
          <StatBand stats={stats} error={statsQuery.isError} onRetry={() => void statsQuery.refetch()} />
        </div>
      </Reveal>
    </div>
  );
}
