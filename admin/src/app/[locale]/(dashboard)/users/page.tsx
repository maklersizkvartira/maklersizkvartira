'use client';

import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Users as UsersIcon } from 'lucide-react';

import { useRouter } from '@/i18n/routing';
import { http } from '@/shared/lib/http';
import { api, type UserListParams } from '@/shared/api/endpoints';
import type { AdminUserRow, UserRole, UserSort, UserStatus } from '@/shared/api/types';
import { useAdminList, countActiveFilters, type AdminFilters } from '@/shared/hooks/useAdminList';
import { PageHeader } from '@/shared/ui/PageHeader';
import { FilterBar } from '@/shared/ui/FilterBar';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { ListErrorBanner, ListState } from '@/shared/ui/ListState';
import { Pagination } from '@/shared/ui/Pagination';
import { StatusPill } from '@/shared/ui/StatusPill';
import { Avatar } from '@/shared/ui/Avatar';

/**
 * Every account on the platform. The list engine (`useAdminList`) owns the
 * debounce, the page reset and keepPreviousData; this file is filters, columns
 * and copy.
 *
 * The filter keys below are camelCase because `GET /admin/users` reads them
 * through a `Depends()` model with a camelCase alias generator. A snake_case
 * spelling would not error — FastAPI drops unknown query keys silently and
 * answers 200 with an unfiltered list. See the note at the top of endpoints.ts.
 */

/** Wire values, in the order the filter dropdown should offer them. */
const ROLES: UserRole[] = ['STUDENT', 'TENANT', 'OWNER', 'MODERATOR', 'ADMIN', 'DEVELOPER'];

const STATUSES: UserStatus[] = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'BANNED',
  'REGISTRATION_REQUIRED',
];

const SORTS: UserSort[] = ['NEWEST', 'OLDEST', 'NAME', 'TRUST', 'LAST_LOGIN'];

const PAGE_SIZE = 20;

const KNOWN_ROLES = new Set<string>(ROLES);
const KNOWN_STATUSES = new Set<string>(STATUSES);

/** Every filter as a string so one `<Select>` shape drives them all; '' means
 *  "not set" and `useAdminList`/`qs()` both drop it before it reaches the URL. */
interface UserFilters extends AdminFilters {
  search: string;
  role: string;
  status: string;
  hasListings: string;
  sortBy: string;
}

const INITIAL: UserFilters = {
  search: '',
  role: '',
  status: '',
  hasListings: '',
  sortBy: 'NEWEST',
};

export default function UsersPage() {
  const t = useTranslations('users');
  const c = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }),
    [locale],
  );

  const list = useAdminList<AdminUserRow, UserFilters>({
    queryKey: ['users'],
    initialFilters: INITIAL,
    fetcher: async ({ page, filters, signal }) => {
      const params: UserListParams = {
        page,
        pageSize: PAGE_SIZE,
        search: filters.search || undefined,
        role: (filters.role || undefined) as UserRole | undefined,
        status: (filters.status || undefined) as UserStatus | undefined,
        // Tri-state: '' is "no filter", not "false".
        hasListings: filters.hasListings === '' ? undefined : filters.hasListings === 'true',
        sortBy: (filters.sortBy || undefined) as UserSort | undefined,
      };
      const { data, meta } = await http.page<AdminUserRow>(api.users.list(params), { signal });
      return { rows: data, meta };
    },
  });

  const showDate = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : c('never'));

  /* ── Enum labels ──────────────────────────────────────────────────────────
     Both fall back to the wire value. next-intl throws on a missing key rather
     than rendering an empty string, so a role or status the backend adds before
     the messages catch up must not reach `t()` unguarded. */
  const roleLabel = (role: string) =>
    KNOWN_ROLES.has(role) ? t(`role.${role}` as Parameters<typeof t>[0]) : role;
  const statusLabel = (status: string) =>
    KNOWN_STATUSES.has(status) ? t(`status.${status}` as Parameters<typeof t>[0]) : status;

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'name',
      header: t('columns.name'),
      render: (row) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar src={row.avatar} name={row.name} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
              {row.name}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
              {row.email ?? row.authType}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: t('columns.phone') },
    {
      key: 'role',
      header: t('columns.role'),
      // A role the messages do not cover yet prints its wire value rather than
      // throwing — next-intl treats a missing key as an error, not a blank.
      render: (row) => roleLabel(row.role),
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: (row) => <StatusPill status={row.status} label={statusLabel(row.status)} />,
    },
    { key: 'trustScore', header: t('columns.trust'), align: 'right' },
    { key: 'listingsCount', header: t('columns.listings'), align: 'right' },
    {
      key: 'lastLoginAt',
      header: t('columns.lastLogin'),
      hideOnCard: true,
      render: (row) => showDate(row.lastLoginAt),
    },
    {
      key: 'createdAt',
      header: t('columns.created'),
      hideOnCard: true,
      render: (row) => showDate(row.createdAt),
    },
  ];

  const activeCount = countActiveFilters(list.filters, INITIAL);

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <FilterBar
        label={c('filters')}
        resetLabel={c('reset')}
        activeCount={activeCount}
        onReset={list.resetFilters}
      >
        <Input
          value={list.filters.search}
          onChange={(e) => list.setFilter('search', e.target.value)}
          placeholder={t('filters.search')}
          aria-label={t('filters.search')}
        />
        <Select
          value={list.filters.role}
          onChange={(value) => list.setFilter('role', value, { immediate: true })}
          placeholder={t('filters.role')}
          options={[
            { value: '', label: c('all') },
            ...ROLES.map((role) => ({ value: role, label: roleLabel(role) })),
          ]}
        />
        <Select
          value={list.filters.status}
          onChange={(value) => list.setFilter('status', value, { immediate: true })}
          placeholder={t('filters.status')}
          options={[
            { value: '', label: c('all') },
            ...STATUSES.map((status) => ({ value: status, label: statusLabel(status) })),
          ]}
        />
        <Select
          value={list.filters.hasListings}
          onChange={(value) => list.setFilter('hasListings', value, { immediate: true })}
          placeholder={t('filters.hasListings')}
          options={[
            { value: '', label: c('all') },
            { value: 'true', label: c('yes') },
            { value: 'false', label: c('no') },
          ]}
        />
        <Select
          value={list.filters.sortBy}
          onChange={(value) => list.setFilter('sortBy', value, { immediate: true })}
          placeholder={c('sortBy')}
          options={SORTS.map((sort) => ({
            value: sort,
            label: t(`sort.${sort}` as Parameters<typeof t>[0]),
          }))}
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

      <div style={{ opacity: list.isFetching && !list.isLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
        <DataTable
          columns={columns}
          rows={list.rows}
          keyOf={(row) => row.id}
          loading={list.isLoading}
          loadingRows={PAGE_SIZE}
          onRowClick={(row) => router.push(`/users/${row.id}`)}
          empty={
            <ListState
              icon={<UsersIcon size={26} />}
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
    </div>
  );
}
