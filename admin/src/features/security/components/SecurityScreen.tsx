'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ShieldAlert } from 'lucide-react';

import { http } from '@/shared/lib/http';
import { api, type LoginAttemptParams } from '@/shared/api/endpoints';
import type { AdminLoginAttemptRow } from '@/shared/api/types';
import { maskPhone } from '@/shared/lib/mask';
import { useAdminList, countActiveFilters, type AdminFilters } from '@/shared/hooks/useAdminList';
import { PageHeader } from '@/shared/ui/PageHeader';
import { FilterBar } from '@/shared/ui/FilterBar';
import { Select } from '@/shared/ui/Select';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { ListErrorBanner, ListState } from '@/shared/ui/ListState';
import { Pagination } from '@/shared/ui/Pagination';
import { StatusPill } from '@/shared/ui/StatusPill';

/**
 * The sign-in attempt log — every success and every failure, for both the
 * staff panel and the public site.
 *
 * ── The bug this screen exists to not repeat ──
 * `only_failed` is a bare route parameter, so it is snake_case. The panel this
 * replaces sent `onlyFailed`; FastAPI silently dropped the unknown key and
 * answered 200 with the full, unfiltered log, so the "failed only" checkbox
 * did nothing at all for the product's entire life and never once errored.
 * The spelling now lives in `LoginAttemptParams` and is built by
 * `api.security.loginAttempts` — never hand-appended to the path.
 *
 * ── Two threat pictures, one endpoint ──
 * `isAdminPortal` separates staff sign-ins from public-site sign-ins, and they
 * mean completely different things: a run of failures against /admin is
 * somebody probing the panel, the same run against the site is usually a
 * neighbour who forgot their password. The route has no server-side filter for
 * it, so the rows are GROUPED rather than filtered — grouping only reorganises
 * the page that arrived, where a filter control would imply it had searched
 * the whole log.
 */

const PAGE_SIZE = 25;

/** Failures from one address before it is worth pointing at. Three is where a
 *  fat-fingered password stops being the likeliest explanation. */
const REPEAT_THRESHOLD = 3;

interface SecurityFilters extends AdminFilters {
  onlyFailed: string;
}

const INITIAL: SecurityFilters = { onlyFailed: '' };

export function SecurityScreen() {
  const t = useTranslations('security');
  const c = useTranslations('common');
  const locale = useLocale();

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }),
    [locale],
  );

  const list = useAdminList<AdminLoginAttemptRow, SecurityFilters>({
    queryKey: ['login-attempts'],
    initialFilters: INITIAL,
    fetcher: async ({ page, filters, signal }) => {
      const params: LoginAttemptParams = {
        page,
        pageSize: PAGE_SIZE,
        // snake_case, and omitted rather than sent as `false` — the route's
        // own default is false, so an absent key and a false one agree.
        only_failed: filters.onlyFailed === 'true' ? true : undefined,
      };
      const { data, meta } = await http.page<AdminLoginAttemptRow>(
        api.security.loginAttempts(params),
        { signal },
      );
      return { rows: data, meta };
    },
  });

  /**
   * Failures per address across the rows currently on screen. It is a
   * page-local count by construction — the endpoint offers no aggregate — so
   * it is rendered as a marker beside an address, never as a total.
   */
  const failuresByIp = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of list.rows) {
      if (row.successful || !row.ip) continue;
      counts.set(row.ip, (counts.get(row.ip) ?? 0) + 1);
    }
    return counts;
  }, [list.rows]);

  const columns: Column<AdminLoginAttemptRow>[] = [
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
              background: row.successful ? 'var(--color-border-medium)' : 'var(--color-danger)',
            }}
          />
          <span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
            {timeFormat.format(new Date(row.createdAt))}
          </span>
        </div>
      ),
    },
    {
      key: 'identity',
      header: t('columns.phone'),
      // Public-site attempts are keyed by phone, staff attempts by username;
      // exactly one of the two is ever set on a row.
      render: (row) =>
        row.phone ? maskPhone(row.phone) : row.username ? `@${row.username}` : '—',
    },
    {
      key: 'ip',
      header: t('columns.ip'),
      render: (row) => {
        const repeats = row.ip ? (failuresByIp.get(row.ip) ?? 0) : 0;
        return (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs">
            {row.ip ?? '—'}
            {repeats >= REPEAT_THRESHOLD && (
              <span
                className="px-1.5 py-0.5 rounded-[var(--radius-xs)] text-[10px] font-bold"
                style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
                title={t('failed')}
              >
                ×{repeats}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'successful',
      header: t('columns.result'),
      render: (row) => (
        <StatusPill
          status={row.successful ? 'ACTIVE' : 'FAILED'}
          label={row.successful ? t('succeeded') : t('failed')}
        />
      ),
    },
    {
      key: 'failureReason',
      header: t('columns.reason'),
      render: (row) => row.failureReason ?? '—',
    },
    {
      key: 'userAgent',
      header: t('columns.userAgent'),
      render: (row) => (
        <span className="block max-w-[22rem] truncate text-xs" title={row.userAgent ?? undefined}>
          {row.userAgent ?? '—'}
        </span>
      ),
    },
  ];

  const adminRows = list.rows.filter((row) => row.isAdminPortal);
  const siteRows = list.rows.filter((row) => !row.isAdminPortal);

  const sections = [
    { key: 'admin', label: t('adminPortal'), rows: adminRows },
    { key: 'site', label: t('publicSite'), rows: siteRows },
  ].filter((section) => section.rows.length > 0);

  const emptyState = (
    <ListState
      icon={<ShieldAlert size={26} />}
      emptyTitle={c('noData')}
      errorTitle={c('error')}
      retryLabel={c('retry')}
      error={list.error}
      onRetry={list.refetch}
    />
  );

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <FilterBar
        label={c('filters')}
        resetLabel={c('reset')}
        activeCount={countActiveFilters(list.filters, INITIAL)}
        onReset={list.resetFilters}
      >
        <Select
          value={list.filters.onlyFailed}
          onChange={(value) => list.setFilter('onlyFailed', value, { immediate: true })}
          placeholder={t('onlyFailed')}
          options={[
            { value: '', label: c('all') },
            { value: 'true', label: t('onlyFailed') },
          ]}
          className="sm:w-48"
        />
      </FilterBar>

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
        {list.isLoading || sections.length === 0 ? (
          <DataTable
            columns={columns}
            rows={list.isLoading ? undefined : []}
            keyOf={(row) => row.id}
            loading={list.isLoading}
            loadingRows={PAGE_SIZE}
            empty={emptyState}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {sections.map((section) => (
              <section key={section.key}>
                <h2
                  className="text-xs font-bold uppercase tracking-[0.09em] mb-2.5"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {section.label} · {section.rows.length}
                </h2>
                <DataTable
                  columns={columns}
                  rows={section.rows}
                  keyOf={(row) => row.id}
                  empty={emptyState}
                />
              </section>
            ))}
          </div>
        )}
      </div>

      <Pagination
        meta={list.meta}
        onPage={list.setPage}
        summary={(page, total) => c('pagination.pageOf', { page, total })}
        navLabel={c('pagination.label')}
        previousLabel={c('pagination.previousPage')}
        nextLabel={c('pagination.nextPage')}
      />
    </div>
  );
}
