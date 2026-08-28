'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ScrollText } from 'lucide-react';

import { http } from '@/shared/lib/http';
import { api, type AuditListParams } from '@/shared/api/endpoints';
import type {
  ActorType,
  AuditActionsResponse,
  AuditLogRow,
  AuditSeverity,
} from '@/shared/api/types';
import { useAdminList, countActiveFilters, type AdminFilters } from '@/shared/hooks/useAdminList';
import { PageHeader } from '@/shared/ui/PageHeader';
import { FilterBar } from '@/shared/ui/FilterBar';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { Badge } from '@/shared/ui/Badge';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { ListErrorBanner, ListState } from '@/shared/ui/ListState';
import { Pagination } from '@/shared/ui/Pagination';
import { AuditDetailSheet } from '@/features/audit/components/AuditDetailSheet';
import { severityAccent, severityVariant } from '@/features/audit/components/severity';

/**
 * Every action in the system, in one feed.
 *
 * `GET /admin/audit` accepts eleven filters and the panel this replaces
 * exposed two of them, which meant "find out who reset that password" was a
 * job for a database console. All eleven are here.
 *
 * Every key below is camelCase because the route reads them through a
 * `Depends(AuditFilters)` model with a camelCase alias generator. A snake_case
 * spelling is not an error — FastAPI drops the key and answers 200 with an
 * unfiltered feed, which reads exactly like "no rows matched that IP".
 */

const PAGE_SIZE = 25;

const SEVERITIES: AuditSeverity[] = ['INFO', 'NOTICE', 'WARNING', 'CRITICAL'];

/**
 * `AuditLog.actor_type` is upper-cased by the route before it compares, and
 * these four are the whole `ActorType` enum. They have no entry in the message
 * catalogue, so the option labels are the wire values — four English words
 * that are also what the `Actor type` column prints.
 */
const ACTOR_TYPES: ActorType[] = ['USER', 'ADMIN', 'SYSTEM', 'ANONYMOUS'];

interface AuditFilterState extends AdminFilters {
  search: string;
  action: string;
  actionGroup: string;
  actorType: string;
  actorId: string;
  entityType: string;
  entityId: string;
  severity: string;
  ip: string;
  dateFrom: string;
  dateTo: string;
}

const INITIAL: AuditFilterState = {
  search: '',
  action: '',
  actionGroup: '',
  actorType: '',
  actorId: '',
  entityType: '',
  entityId: '',
  severity: '',
  ip: '',
  dateFrom: '',
  dateTo: '',
};

/**
 * `<input type="date">` hands back a bare `YYYY-MM-DD`, which pydantic would
 * read as midnight with no zone and Postgres would then interpret in the
 * session's timezone. Pinning the instant to UTC here means the boundary the
 * reader picked is the boundary the query uses, whatever the server is set to.
 * The reader is told which zone that is — see the note under the two inputs.
 */
function utcStart(day: string): string | undefined {
  return day ? `${day}T00:00:00Z` : undefined;
}

function utcEnd(day: string): string | undefined {
  return day ? `${day}T23:59:59Z` : undefined;
}

export default function AuditPage() {
  const t = useTranslations('audit');
  const c = useTranslations('common');
  const ta = useTranslations('auditActions');
  const td = useTranslations('dashboard');
  const locale = useLocale();

  const [selected, setSelected] = useState<AuditLogRow | null>(null);

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }),
    [locale],
  );

  /**
   * The action dropdown's options. Distinct action names across the whole
   * table with their row counts — it changes only when a brand-new kind of
   * event is recorded for the first time, so it is fetched once per session
   * and never revalidated.
   *
   * `groups` is a SIBLING of `data` in this response, which is why it is read
   * with `http.raw.get`; `http.get` would unwrap `data` and lose it.
   */
  const actionsQuery = useQuery({
    queryKey: ['audit-actions'],
    queryFn: ({ signal }) => http.raw.get<AuditActionsResponse>(api.audit.actions, { signal }),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const list = useAdminList<AuditLogRow, AuditFilterState>({
    queryKey: ['audit'],
    initialFilters: INITIAL,
    fetcher: async ({ page, filters, signal }) => {
      const params: AuditListParams = {
        page,
        pageSize: PAGE_SIZE,
        search: filters.search || undefined,
        action: filters.action || undefined,
        actionGroup: (filters.actionGroup || undefined) as AuditListParams['actionGroup'],
        actorType: (filters.actorType || undefined) as ActorType | undefined,
        actorId: filters.actorId || undefined,
        entityType: filters.entityType || undefined,
        entityId: filters.entityId || undefined,
        severity: (filters.severity || undefined) as AuditSeverity | undefined,
        ip: filters.ip || undefined,
        dateFrom: utcStart(filters.dateFrom),
        dateTo: utcEnd(filters.dateTo),
      };
      const { data, meta } = await http.page<AuditLogRow>(api.audit.list(params), { signal });
      return { rows: data, meta };
    },
  });

  /**
   * `auditActions` covers the backend's AuditAction enum as it stood when the
   * catalogue was written. An action added since renders its raw constant —
   * ugly, but readable, and never a next-intl MISSING_MESSAGE crash.
   */
  const actionLabel = (action: string) => {
    const key = action as Parameters<typeof ta>[0];
    return ta.has(key) ? ta(key) : action;
  };

  const severityLabel = (severity: string) => {
    const key = `severity.${severity}` as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : severity;
  };

  const columns: Column<AuditLogRow>[] = [
    {
      key: 'createdAt',
      header: t('columns.time'),
      width: '170px',
      render: (row) => (
        <div className="flex items-center gap-2.5 min-w-0 justify-end lg:justify-start">
          {/* Severity as a colour before it is a word — a page of 25 rows is
              scanned down this edge, not read. The Severity column keeps the
              written label so colour is never the only carrier. */}
          <span
            aria-hidden="true"
            className="shrink-0 rounded-full"
            style={{ width: 3, height: 26, background: severityAccent(row.severity) }}
          />
          <span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
            {timeFormat.format(new Date(row.createdAt))}
          </span>
        </div>
      ),
    },
    {
      key: 'action',
      header: t('columns.action'),
      render: (row) => (
        <div className="min-w-0">
          <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {actionLabel(row.action)}
          </p>
          {row.summary && (
            <p className="text-xs line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
              {row.summary}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'actor',
      header: t('columns.actor'),
      render: (row) => row.actorLabel ?? row.actorType,
    },
    {
      key: 'entity',
      header: t('columns.entity'),
      render: (row) => row.entityLabel ?? row.entityType ?? '—',
    },
    {
      key: 'ip',
      header: t('columns.ip'),
      hideOnCard: true,
      render: (row) => (
        <span className="font-mono text-xs">{row.ip ?? '—'}</span>
      ),
    },
    {
      key: 'severity',
      header: t('columns.severity'),
      render: (row) => (
        <Badge variant={severityVariant(row.severity)} label={severityLabel(row.severity)} />
      ),
    },
  ];

  const activeCount = countActiveFilters(list.filters, INITIAL);

  /** The count beside each name is what makes this dropdown usable: sixty
   *  action constants ordered by how often they actually happen. */
  const actionOptions = [
    { value: '', label: c('all') },
    ...(actionsQuery.data?.data ?? []).map((row) => ({
      value: row.action,
      label: `${actionLabel(row.action)} (${row.count})`,
    })),
  ];

  const groupOptions = [
    { value: '', label: c('all') },
    // The groups are lowercase prefix buckets on the wire ('auth', 'sms') and
    // have no entry in the message catalogue, so they show as they arrive.
    ...(actionsQuery.data?.groups ?? []).map((group) => ({ value: group, label: group })),
  ];

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <FilterBar
        label={c('filters')}
        resetLabel={c('reset')}
        activeCount={activeCount}
        onReset={list.resetFilters}
        leading={
          <Input
            value={list.filters.search}
            onChange={(e) => list.setFilter('search', e.target.value)}
            placeholder={c('search')}
            aria-label={c('search')}
            fullWidth
          />
        }
      >
        <Select
          value={list.filters.action}
          onChange={(value) => list.setFilter('action', value, { immediate: true })}
          placeholder={t('filters.action')}
          options={actionOptions}
          className="sm:w-56"
        />
        <Select
          value={list.filters.actionGroup}
          onChange={(value) => list.setFilter('actionGroup', value, { immediate: true })}
          placeholder={t('filters.actionGroup')}
          options={groupOptions}
          className="sm:w-40"
        />
        <Select
          value={list.filters.severity}
          onChange={(value) => list.setFilter('severity', value, { immediate: true })}
          placeholder={t('filters.severity')}
          options={[
            { value: '', label: c('all') },
            ...SEVERITIES.map((severity) => ({
              value: severity,
              label: severityLabel(severity),
            })),
          ]}
          className="sm:w-40"
        />
        <Select
          value={list.filters.actorType}
          onChange={(value) => list.setFilter('actorType', value, { immediate: true })}
          placeholder={t('filters.actorType')}
          options={[
            { value: '', label: c('all') },
            ...ACTOR_TYPES.map((actorType) => ({ value: actorType, label: actorType })),
          ]}
          className="sm:w-40"
        />
        <Input
          value={list.filters.entityType}
          onChange={(e) => list.setFilter('entityType', e.target.value)}
          placeholder={t('filters.entityType')}
          aria-label={t('filters.entityType')}
          className="sm:w-36"
        />
        <Input
          value={list.filters.entityId}
          onChange={(e) => list.setFilter('entityId', e.target.value)}
          placeholder={t('filters.entityId')}
          aria-label={t('filters.entityId')}
          className="sm:w-44"
        />
        <Input
          value={list.filters.actorId}
          onChange={(e) => list.setFilter('actorId', e.target.value)}
          placeholder={t('filters.actorId')}
          aria-label={t('filters.actorId')}
          className="sm:w-44"
        />
        <Input
          value={list.filters.ip}
          onChange={(e) => list.setFilter('ip', e.target.value)}
          placeholder={t('filters.ip')}
          aria-label={t('filters.ip')}
          inputMode="numeric"
          className="sm:w-36"
        />

        {/* The two date bounds travel together, and so does the sentence that
            says which zone they are in — the feed is bucketed in UTC while
            everyone reading it is five hours ahead in Tashkent, so a row that
            "should" be in yesterday's range otherwise looks like a bug. */}
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              fullWidth
              value={list.filters.dateFrom}
              onChange={(e) => list.setFilter('dateFrom', e.target.value)}
              aria-label={t('filters.dateFrom')}
              title={t('filters.dateFrom')}
              className="min-w-0"
            />
            <Input
              type="date"
              fullWidth
              value={list.filters.dateTo}
              onChange={(e) => list.setFilter('dateTo', e.target.value)}
              aria-label={t('filters.dateTo')}
              title={t('filters.dateTo')}
              className="min-w-0"
            />
          </div>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {td('charts.utcNote')}
          </p>
        </div>
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
        <DataTable
          columns={columns}
          rows={list.rows}
          keyOf={(row) => row.id}
          loading={list.isLoading}
          loadingRows={PAGE_SIZE}
          onRowClick={(row) => setSelected(row)}
          empty={
            <ListState
              icon={<ScrollText size={26} />}
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
        onPage={list.setPage}
        summary={(page, total) => c('pagination.pageOf', { page, total })}
        navLabel={c('pagination.label')}
        previousLabel={c('pagination.previousPage')}
        nextLabel={c('pagination.nextPage')}
      />

      <AuditDetailSheet
        row={selected}
        onClose={() => setSelected(null)}
        actionLabel={selected ? actionLabel(selected.action) : ''}
      />
    </div>
  );
}
