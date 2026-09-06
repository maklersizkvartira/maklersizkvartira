'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { MessageSquareWarning } from 'lucide-react';

import { http } from '@/shared/lib/http';
import { api, type PaginationParams } from '@/shared/api/endpoints';
import type { AdminSmsRow, SmsOverview } from '@/shared/api/types';
import { maskPhone } from '@/shared/lib/mask';
import { useAdminList, type AdminFilters } from '@/shared/hooks/useAdminList';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { ListErrorBanner, ListState } from '@/shared/ui/ListState';
import { Pagination } from '@/shared/ui/Pagination';
import { StatusPill } from '@/shared/ui/StatusPill';
import { SmsBalanceCard } from './SmsBalanceCard';
import { SmsCountersCard } from './SmsCountersCard';

/**
 * Everything to do with SMS, on one page.
 *
 * It used to be the outbound log and nothing else, which put the two questions
 * a reader actually arrives with — "why did this code not arrive" and "are we
 * about to run out of credit" — on opposite sides of the product: the first
 * here, the second in a terminal running `scripts/check_sms`. Both are answered
 * above the table now, from `GET /admin/sms/overview`.
 *
 * The two halves are two requests on purpose. The overview crosses the network
 * to DevSMS and the log does not, so a provider that is slow or down must not
 * be able to hold up, or blank out, the rows that explain what happened. They
 * fail, retry and reload independently; the Refresh in the header is the one
 * control that moves both.
 *
 * Failures are the reason anyone opens the log — a code that never arrived is
 * the single most common support call this product gets — so the table is
 * built around making them findable, not around browsing successes.
 *
 * `GET /admin/sms` takes page and pageSize and NOTHING else: no status filter,
 * no phone search, no date range. The chips below therefore narrow the page
 * that already arrived, never the log, and they say so by showing the range
 * they are counting over ("1-25 of 4 812") directly above themselves. Anything
 * that looked like a search box here would be a lie about what the API can do.
 */

const PAGE_SIZE = 25;

/**
 * How often the overview re-reads itself.
 *
 * Two minutes — the same rhythm the dashboard reads `/admin/balances` on, so
 * the two screens showing the same credit never disagree about how old it is.
 * Background polling is off, and the log is not polled at all: rows appear only
 * when somebody signs up, and a table that reshuffles under a reader who is
 * halfway through a failure is worse than a stale one with a Refresh button.
 */
const OVERVIEW_POLL_MS = 120_000;

/** Wire values, in the order the chips should read.
 *
 *  `SKIPPED` is what the backend records when SMS delivery is switched off,
 *  and `UNKNOWN` is what it records when the provider answered something it
 *  could not classify — both real, both worth being able to filter the log by.
 *  Neither had a chip, and neither had a message key: the pill and the chip
 *  printed the raw English wire value into an Uzbek screen, directly under a
 *  counters card that had just spelled the same two words properly. */
const STATUSES = ['SENT', 'FAILED', 'QUEUED', 'SKIPPED', 'UNKNOWN'] as const;

const KNOWN_STATUSES = new Set<string>([
  'QUEUED',
  'SENT',
  'FAILED',
  'SKIPPED',
  'UNKNOWN',
]);

export function SmsScreen() {
  const t = useTranslations('sms');
  const c = useTranslations('common');
  const locale = useLocale();

  /** Page-local, so it lives in component state rather than in the list
   *  engine's filters — nothing here reaches the request. */
  const [status, setStatus] = useState<string>('');

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }),
    [locale],
  );

  const overview = useQuery({
    queryKey: ['sms-overview'],
    queryFn: ({ signal }) => http.get<SmsOverview>(api.smsOverview, { signal }),
    refetchInterval: OVERVIEW_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const list = useAdminList<AdminSmsRow, AdminFilters>({
    queryKey: ['sms'],
    fetcher: async ({ page, signal }) => {
      const params: PaginationParams = { page, pageSize: PAGE_SIZE };
      const { data, meta } = await http.page<AdminSmsRow>(api.sms(params), { signal });
      return { rows: data, meta };
    },
  });

  const refreshing = overview.isFetching || list.isFetching;

  const statusLabel = (value: string) =>
    KNOWN_STATUSES.has(value) ? t(`status.${value}` as Parameters<typeof t>[0]) : value;

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of list.rows) map.set(row.status, (map.get(row.status) ?? 0) + 1);
    return map;
  }, [list.rows]);

  const rows = status ? list.rows.filter((row) => row.status === status) : list.rows;

  const columns: Column<AdminSmsRow>[] = [
    {
      key: 'createdAt',
      header: t('columns.time'),
      width: '180px',
      render: (row) => (
        <div className="flex items-center gap-2.5 min-w-0 justify-end lg:justify-start">
          <span
            aria-hidden="true"
            className="shrink-0 rounded-full"
            style={{
              width: 3,
              height: 26,
              background:
                row.status === 'FAILED' ? 'var(--color-danger)' : 'var(--color-border-medium)',
            }}
          />
          <span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
            {timeFormat.format(new Date(row.createdAt))}
          </span>
        </div>
      ),
    },
    {
      key: 'phone',
      header: t('columns.phone'),
      // Masked with the same helper the backend logs with, so one number never
      // shows up in two shapes across two screens.
      render: (row) => maskPhone(row.phone),
    },
    { key: 'purpose', header: t('columns.purpose') },
    { key: 'provider', header: t('columns.provider') },
    {
      key: 'status',
      header: t('columns.status'),
      render: (row) => <StatusPill status={row.status} label={statusLabel(row.status)} />,
    },
    {
      key: 'error',
      header: t('columns.error'),
      // Never truncated: the provider's message is the whole reason the row is
      // being read, and a clipped one sends the reader to the server logs.
      render: (row) =>
        row.error ? (
          <span className="block text-xs break-words" style={{ color: 'var(--color-danger)' }}>
            {row.error}
          </span>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('overview.title')}
        subtitle={t('overview.subtitle')}
        actions={
          <Button
            variant="secondary"
            size="sm"
            className="max-sm:w-full"
            loading={refreshing}
            onClick={() => {
              void overview.refetch();
              list.refetch();
            }}
          >
            {c('refresh')}
          </Button>
        }
      />

      {/* The overview failing says nothing about the log, so it reports itself
          here and the table below still renders its own rows and its own
          error. `overview.data` stays undefined, and both cards print dashes
          rather than a skeleton that would shimmer for ever. */}
      <ListErrorBanner
        error={overview.error}
        title={t('overview.loadError')}
        retryLabel={c('retry')}
        onRetry={() => void overview.refetch()}
      />

      {/* Credit first, then health. On a phone they stack in that order for
          the same reason: an empty account stops registration outright, which
          outranks every rate on the page. */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <SmsBalanceCard data={overview.data} isError={overview.isError} />
        <div className="lg:col-span-2">
          <SmsCountersCard data={overview.data} isError={overview.isError} />
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {t('overview.logTitle')}
        </h2>
        <p className="mt-0.5 mb-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {t('subtitle')}
        </p>

        {/* The range the chips count over, stated before the chips themselves. */}
        {list.meta && list.meta.total > 0 && (
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
            {c('showing', {
              from: (list.meta.page - 1) * list.meta.pageSize + 1,
              to: (list.meta.page - 1) * list.meta.pageSize + list.rows.length,
              total: list.meta.total,
            })}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          <Facet
            active={status === ''}
            label={c('all')}
            count={list.rows.length}
            onClick={() => setStatus('')}
          />
          {STATUSES.filter((value) => counts.has(value)).map((value) => (
            <Facet
              key={value}
              active={status === value}
              label={statusLabel(value)}
              count={counts.get(value) ?? 0}
              danger={value === 'FAILED'}
              onClick={() => setStatus(status === value ? '' : value)}
            />
          ))}
        </div>

        {/* A refetch that fails leaves the previous page on screen and says
            nothing — `keepPreviousData` holds those rows. The empty-state
            branch below never runs in that case, so the warning goes here. */}
        <ListErrorBanner
          error={list.rows.length > 0 ? list.error : null}
          title={c('error')}
          retryLabel={c('retry')}
          onRetry={list.refetch}
        />

        <div
          style={{
            opacity: list.isFetching && !list.isLoading ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          <DataTable
            columns={columns}
            rows={rows}
            keyOf={(row) => row.id}
            loading={list.isLoading}
            loadingRows={PAGE_SIZE}
            empty={
              <ListState
                icon={<MessageSquareWarning size={26} />}
                emptyTitle={c('noData')}
                errorTitle={c('error')}
                retryLabel={c('retry')}
                error={list.error}
                onRetry={list.refetch}
              />
            }
          />
        </div>

        <Pagination
          meta={list.meta}
          onPage={(page) => {
            // A facet chosen on page 3 would otherwise silently survive into a
            // page that has no rows of that status at all.
            setStatus('');
            list.setPage(page);
          }}
          summary={(page, total) => c('pagination.pageOf', { page, total })}
          navLabel={c('pagination.label')}
          previousLabel={c('pagination.previousPage')}
          nextLabel={c('pagination.nextPage')}
        />
      </section>
    </div>
  );
}

/** A tap target first and a chip second — 44px on a phone, table-sized above. */
function Facet({
  active,
  label,
  count,
  danger = false,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  danger?: boolean;
  onClick: () => void;
}) {
  const accent = danger ? 'var(--color-danger)' : 'var(--accent)';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex items-center gap-2 px-4 h-11 sm:h-8 rounded-[var(--radius-md)]
                 text-xs font-semibold transition-all active:scale-[0.97]"
      style={{
        background: active ? 'var(--color-surface-3)' : 'var(--color-surface-2)',
        border: `1px solid ${active ? accent : 'var(--color-border)'}`,
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
      }}
    >
      {label}
      <span style={{ color: danger ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
        {count}
      </span>
    </button>
  );
}
