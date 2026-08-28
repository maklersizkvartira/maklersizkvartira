'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import {
  Users,
  UserCheck,
  Home,
  GraduationCap,
  UserCog,
  UserX,
  UserPlus,
  CalendarPlus,
  Building2,
  BadgeCheck,
  Ban,
  Clock,
  Star,
  FilePlus2,
  Eye,
  Flag,
  ShieldCheck,
  Bot,
  UserSearch,
  MessageSquare,
  MessagesSquare,
  Send,
  SendHorizonal,
  Footprints,
  LockKeyhole,
} from 'lucide-react';

import { http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type {
  ActivityPoint,
  AdminStats,
  DistrictPoint,
  PublicSettings,
  RegistrationPoint,
  TrafficPoint,
} from '@/shared/api/types';
import { useRole } from '@/providers/role-provider';
import { PageHeader } from '@/shared/ui/PageHeader';
import { KpiCard } from '@/shared/ui/KpiCard';
import { Button } from '@/shared/ui/Button';
import { StatusPill } from '@/shared/ui/StatusPill';
import { toast } from '@/shared/ui/Toast';
import { LineChart } from '@/features/dashboard/components/LineChart';
import { BarChart } from '@/features/dashboard/components/BarChart';
import { severityColor } from '@/features/dashboard/components/chart-shared';

/**
 * The overview screen: the 26 counters from `GET /admin/stats` and the four
 * chart routes beside them.
 *
 * Every number here is a plain count from the backend — there is no trend
 * endpoint, so no KpiCard is given a `change` percentage. Inventing one from
 * the "today" and "week" counters would be arithmetic the API never did.
 */

/** How many days of history the three time charts ask for. The backend caps
 *  `days` at 90 and the translated chart titles say "7 kun", so the two have to
 *  move together — change the messages if you change this. */
const CHART_DAYS = 7;
/** `limit` on the districts chart; the backend allows 1..30. */
const DISTRICT_LIMIT = 10;

/** ISO date → a short axis label in the reader's locale. */
function useDayFormatter() {
  const locale = useLocale();
  return useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    [locale],
  );
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const c = useTranslations('common');
  const locale = useLocale();
  const { can } = useRole();
  const queryClient = useQueryClient();
  const dayFormat = useDayFormatter();

  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: ({ signal }) => http.get<AdminStats>(api.stats, { signal }),
  });

  const registrationsQuery = useQuery({
    queryKey: ['chart', 'registrations', CHART_DAYS],
    queryFn: ({ signal }) =>
      http.get<RegistrationPoint[]>(api.charts.registrations(CHART_DAYS), { signal }),
  });

  const trafficQuery = useQuery({
    queryKey: ['chart', 'traffic', CHART_DAYS],
    queryFn: ({ signal }) => http.get<TrafficPoint[]>(api.charts.traffic(CHART_DAYS), { signal }),
  });

  const districtsQuery = useQuery({
    queryKey: ['chart', 'districts', DISTRICT_LIMIT],
    queryFn: ({ signal }) =>
      http.get<DistrictPoint[]>(api.charts.districts(DISTRICT_LIMIT), { signal }),
  });

  const activityQuery = useQuery({
    queryKey: ['chart', 'activity', CHART_DAYS],
    queryFn: ({ signal }) => http.get<ActivityPoint[]>(api.charts.activity(CHART_DAYS), { signal }),
  });

  /**
   * `GET /settings` is the one unauthenticated, un-enveloped, snake_case route
   * in the API — hence `http.raw.get` and `skipAuth`.
   */
  const monetizationQuery = useQuery({
    queryKey: ['public-settings'],
    queryFn: ({ signal }) =>
      http.raw.get<PublicSettings>(api.settings.publicRead, { signal, skipAuth: true }),
  });

  const toggleMonetization = useMutation({
    mutationFn: () => http.post(api.settings.toggleMonetization),
    // The toggle route answers with an acknowledgement and no new value, so the
    // only way to learn the result is to read /settings again.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public-settings'] }),
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  const stats = statsQuery.data;
  const loading = statsQuery.isLoading;

  /**
   * `tenants` is deliberately absent: the backend fills it with the same query
   * as `students`, so showing both would print one number under two labels.
   */
  const kpis: { key: string; label: string; value: number; icon: React.ReactNode }[] = stats
    ? [
        { key: 'totalUsers', label: t('kpi.totalUsers'), value: stats.totalUsers, icon: <Users size={18} /> },
        { key: 'activeUsers', label: t('kpi.activeUsers'), value: stats.activeUsers, icon: <UserCheck size={18} /> },
        { key: 'owners', label: t('kpi.owners'), value: stats.owners, icon: <Home size={18} /> },
        { key: 'students', label: t('kpi.students'), value: stats.students, icon: <GraduationCap size={18} /> },
        { key: 'pendingUsers', label: t('kpi.pendingUsers'), value: stats.pendingUsers, icon: <UserCog size={18} /> },
        { key: 'suspendedUsers', label: t('kpi.suspendedUsers'), value: stats.suspendedUsers, icon: <UserX size={18} /> },
        { key: 'todayNewUsers', label: t('kpi.todayNewUsers'), value: stats.todayNewUsers, icon: <UserPlus size={18} /> },
        { key: 'weekNewUsers', label: t('kpi.weekNewUsers'), value: stats.weekNewUsers, icon: <CalendarPlus size={18} /> },
        { key: 'totalListings', label: t('kpi.totalListings'), value: stats.totalListings, icon: <Building2 size={18} /> },
        { key: 'approvedListings', label: t('kpi.approvedListings'), value: stats.approvedListings, icon: <BadgeCheck size={18} /> },
        { key: 'rejectedListings', label: t('kpi.rejectedListings'), value: stats.rejectedListings, icon: <Ban size={18} /> },
        { key: 'pendingListings', label: t('kpi.pendingListings'), value: stats.pendingListings, icon: <Clock size={18} /> },
        { key: 'featuredListings', label: t('kpi.featuredListings'), value: stats.featuredListings, icon: <Star size={18} /> },
        { key: 'todayNewListings', label: t('kpi.todayNewListings'), value: stats.todayNewListings, icon: <FilePlus2 size={18} /> },
        { key: 'totalViews', label: t('kpi.totalViews'), value: stats.totalViews, icon: <Eye size={18} /> },
        { key: 'openReports', label: t('kpi.openReports'), value: stats.openReports, icon: <Flag size={18} /> },
        { key: 'pendingVerifications', label: t('kpi.pendingVerifications'), value: stats.pendingVerifications, icon: <ShieldCheck size={18} /> },
        { key: 'aiSessions', label: t('kpi.aiSessions'), value: stats.aiSessions, icon: <Bot size={18} /> },
        { key: 'guests', label: t('kpi.guests'), value: stats.guests, icon: <UserSearch size={18} /> },
        { key: 'aiQueries', label: t('kpi.aiQueries'), value: stats.aiQueries, icon: <MessageSquare size={18} /> },
        { key: 'todayAiQueries', label: t('kpi.todayAiQueries'), value: stats.todayAiQueries, icon: <MessagesSquare size={18} /> },
        { key: 'smsToday', label: t('kpi.smsToday'), value: stats.smsToday, icon: <Send size={18} /> },
        { key: 'smsFailedToday', label: t('kpi.smsFailedToday'), value: stats.smsFailedToday, icon: <SendHorizonal size={18} /> },
        { key: 'visitorsToday', label: t('kpi.visitorsToday'), value: stats.visitorsToday, icon: <Footprints size={18} /> },
        { key: 'failedLoginsToday', label: t('kpi.failedLoginsToday'), value: stats.failedLoginsToday, icon: <LockKeyhole size={18} /> },
      ]
    : [];

  const numberFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const registrations = registrationsQuery.data ?? [];
  const traffic = trafficQuery.data ?? [];
  const districts = districtsQuery.data ?? [];
  const activity = activityQuery.data ?? [];

  const day = (iso: string) => dayFormat.format(new Date(iso));

  const monetizationOn = monetizationQuery.data?.is_monetization_enabled === true;

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            {statsQuery.dataUpdatedAt > 0 && (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {t('refreshedAt', {
                  time: new Date(statsQuery.dataUpdatedAt).toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => statsQuery.refetch()}
              loading={statsQuery.isFetching}
            >
              {c('refresh')}
            </Button>
          </>
        }
      />

      {/* ── Monetization ─────────────────────────────────────────────────────
          Read from the public /settings route; the toggle behind it is
          SUPERADMIN-only on the backend, so anyone below that rank sees the
          state without a button that would only ever 403. */}
      <div className="card p-5 mb-6 flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {t('monetization')}
            </p>
            {!monetizationQuery.isLoading && (
              <StatusPill
                status={monetizationOn ? 'ACTIVE' : 'ARCHIVED'}
                label={monetizationOn ? t('monetizationOn') : t('monetizationOff')}
                pulse={monetizationOn}
              />
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t('monetizationHint')}
          </p>
        </div>
        {can('monetizationToggle') && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toggleMonetization.mutate()}
            loading={toggleMonetization.isPending}
            disabled={monetizationQuery.isLoading}
          >
            {t('toggleMonetization')}
          </Button>
        )}
      </div>

      {/* ── Counters ─────────────────────────────────────────────────────── */}
      {statsQuery.error ? (
        <div className="card p-6 mb-6 flex flex-wrap items-center gap-4">
          <p className="text-sm flex-1" style={{ color: 'var(--color-danger)' }}>
            {c('error')}
          </p>
          <Button variant="secondary" size="sm" onClick={() => statsQuery.refetch()}>
            {c('retry')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {loading
            ? Array.from({ length: 10 }, (_, i) => (
                <KpiCard key={i} icon={null} label="" value="" loading />
              ))
            : kpis.map((kpi) => (
                <KpiCard
                  key={kpi.key}
                  icon={kpi.icon}
                  label={kpi.label}
                  value={numberFormat.format(kpi.value)}
                />
              ))}
        </div>
      )}

      {/* ── Charts ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title={t('charts.registrations')}
          note={t('charts.utcNote')}
          loading={registrationsQuery.isLoading}
          empty={registrations.length === 0}
          emptyLabel={t('charts.noData')}
        >
          <LineChart
            labels={registrations.map((point) => day(point.date))}
            series={[
              {
                key: 'registrations',
                label: t('charts.count'),
                values: registrations.map((point) => point.count),
              },
            ]}
            area
          />
        </ChartCard>

        <ChartCard
          title={t('charts.traffic')}
          note={t('charts.utcNote')}
          loading={trafficQuery.isLoading}
          empty={traffic.length === 0}
          emptyLabel={t('charts.noData')}
        >
          <LineChart
            labels={traffic.map((point) => day(point.date))}
            series={[
              {
                key: 'visitors',
                label: t('charts.visitors'),
                values: traffic.map((point) => point.visitors),
              },
              {
                key: 'views',
                label: t('charts.views'),
                values: traffic.map((point) => point.views),
              },
            ]}
          />
        </ChartCard>

        <ChartCard
          title={t('charts.districts')}
          loading={districtsQuery.isLoading}
          empty={districts.length === 0}
          emptyLabel={t('charts.noData')}
        >
          <BarChart
            horizontal
            showValues
            labels={districts.map((point) => point.district)}
            series={[
              {
                key: 'listings',
                label: t('charts.count'),
                values: districts.map((point) => point.count),
              },
            ]}
          />
        </ChartCard>

        <ChartCard
          title={t('charts.activity')}
          note={t('charts.utcNote')}
          loading={activityQuery.isLoading}
          empty={activity.length === 0}
          emptyLabel={t('charts.noData')}
        >
          {/* Severity is a state, so the series take the status colours rather
              than the neutral chart slots — see SEVERITY_VARS. */}
          <BarChart
            stacked
            labels={activity.map((point) => day(point.date))}
            series={[
              { key: 'INFO', label: 'INFO', values: activity.map((p) => p.info), color: severityColor('INFO') },
              { key: 'NOTICE', label: 'NOTICE', values: activity.map((p) => p.notice), color: severityColor('NOTICE') },
              { key: 'WARNING', label: 'WARNING', values: activity.map((p) => p.warning), color: severityColor('WARNING') },
              { key: 'CRITICAL', label: 'CRITICAL', values: activity.map((p) => p.critical), color: severityColor('CRITICAL') },
            ]}
          />
        </ChartCard>
      </div>
    </div>
  );
}

/* ─── Chart shell ───────────────────────────────────────────────────────── */

function ChartCard({
  title,
  note,
  loading,
  empty,
  emptyLabel,
  children,
}: {
  title: string;
  note?: string;
  loading: boolean;
  empty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </h2>
        {note && (
          <span className="text-[10px] shrink-0" style={{ color: 'var(--color-text-muted)' }}>
            {note}
          </span>
        )}
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 240 }} />
      ) : empty ? (
        <p
          className="flex items-center justify-center text-sm"
          style={{ height: 240, color: 'var(--color-text-muted)' }}
        >
          {emptyLabel}
        </p>
      ) : (
        children
      )}
    </div>
  );
}
