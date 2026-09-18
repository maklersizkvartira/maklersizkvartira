'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Users as UsersIcon, Plus } from 'lucide-react';

import { useRouter } from '@/i18n/routing';
import { http } from '@/shared/lib/http';
import { api, type UserListParams } from '@/shared/api/endpoints';
import type { AdminUserRow, UserRole, UserSort, UserStatus } from '@/shared/api/types';
import { useAdminList, countActiveFilters, type AdminFilters } from '@/shared/hooks/useAdminList';
import { enumLabeller } from '@/shared/lib/enum-label';
import { USER_ROLES, USER_STATUSES } from '@/features/users/constants';
import { SectionHeader } from '@/features/hubs/SectionHeader';
import { Button } from '@/shared/ui/Button';
import { FilterBar } from '@/shared/ui/FilterBar';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { ListErrorBanner, ListState } from '@/shared/ui/ListState';
import { Pagination } from '@/shared/ui/Pagination';
import { StatusPill } from '@/shared/ui/StatusPill';
import { Avatar } from '@/shared/ui/Avatar';
import { TOUCH_SELECT } from '@/features/listings/components/moderation-kit';
import { AdjustBalanceModal } from '@/features/users/components/AdjustBalanceModal';

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

const SORTS: UserSort[] = ['NEWEST', 'OLDEST', 'NAME', 'TRUST', 'LAST_LOGIN'];

const PAGE_SIZE = 20;

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

export function UsersScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const t = useTranslations('users');
  const c = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();

  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [balanceModalUser, setBalanceModalUser] = useState<AdminUserRow | null>(null);

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
     next-intl throws on a missing key rather than rendering an empty string, so
     a role or status the backend adds before the messages catch up must not
     reach `t()` unguarded. `enumLabeller` asks the catalogue itself and prints a
     readable word when the answer is no; the value list is what keeps that
     fallback from also swallowing a missing translation for a role this build
     does know about — see `shared/lib/enum-label`. */
  const roleLabel = enumLabeller(t, 'role', USER_ROLES);
  const statusLabel = enumLabeller(t, 'status', USER_STATUSES);

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'name',
      header: t('columns.name'),
      width: '190px',
      render: (row) => (
        <div className="flex items-center gap-2.5 min-w-0 max-w-[210px]">
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
    { key: 'phone', header: t('columns.phone'), width: '125px' },
    {
      key: 'role',
      header: t('columns.role'),
      width: '85px',
      render: (row) => roleLabel(row.role),
    },
    {
      key: 'status',
      header: t('columns.status'),
      width: '95px',
      render: (row) => <StatusPill status={row.status} label={statusLabel(row.status)} />,
    },
    { key: 'trustScore', header: t('columns.trust'), width: '65px', align: 'right' },
    { key: 'listingsCount', header: t('columns.listings'), width: '65px', align: 'right' },
    {
      key: 'balance',
      header: t('columns.balance'),
      width: '145px',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <span
            className={`font-mono font-bold text-xs ${
              (row.balance || 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--color-text-muted)]'
            }`}
          >
            {(row.balance || 0).toLocaleString(locale)} {c('currency')}
          </span>
          <button
            type="button"
            title={t('adjustBalance')}
            onClick={(e) => {
              e.stopPropagation();
              setBalanceModalUser(row);
              setIsBalanceModalOpen(true);
            }}
            className="p-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:scale-110 active:scale-95 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
    {
      key: 'lastLoginAt',
      header: t('columns.lastLogin'),
      width: '115px',
      render: (row) => (
        <span className="text-xs whitespace-nowrap font-mono text-[var(--color-text-muted)]">
          {showDate(row.lastLoginAt)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: t('columns.created'),
      width: '110px',
      hideOnCard: true,
      render: (row) => (
        <span className="text-xs whitespace-nowrap font-mono text-[var(--color-text-muted)]">
          {showDate(row.createdAt)}
        </span>
      ),
    },
  ];

  const activeCount = countActiveFilters(list.filters, INITIAL);

  return (
    <div>
      <SectionHeader
        embedded={embedded}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setBalanceModalUser(null);
              setIsBalanceModalOpen(true);
            }}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {t('topUp')}
          </Button>
        }
      />

      <FilterBar
        label={c('filters')}
        resetLabel={c('reset')}
        activeCount={activeCount}
        onReset={list.resetFilters}
        // Search belongs in `leading`, not among the children: below sm the
        // children render only inside the open disclosure, and looking an
        // account up by name or phone is the one thing this screen is for.
        // `fullWidth` is what makes it stretch, in the row and in the panel.
        leading={
          <Input
            value={list.filters.search}
            onChange={(e) => list.setFilter('search', e.target.value)}
            placeholder={t('filters.search')}
            aria-label={t('filters.search')}
            fullWidth
          />
        }
      >
        {/* `Select` hardcodes a 36px trigger; TOUCH_SELECT lifts it to 44px on
            touch widths, the way Listings and Verifications already do. */}
        <Select
          className={TOUCH_SELECT}
          value={list.filters.role}
          onChange={(value) => list.setFilter('role', value, { immediate: true })}
          placeholder={t('filters.role')}
          options={[
            { value: '', label: c('all') },
            ...USER_ROLES.map((role) => ({ value: role, label: roleLabel(role) })),
          ]}
        />
        <Select
          className={TOUCH_SELECT}
          value={list.filters.status}
          onChange={(value) => list.setFilter('status', value, { immediate: true })}
          placeholder={t('filters.status')}
          options={[
            { value: '', label: c('all') },
            ...USER_STATUSES.map((status) => ({ value: status, label: statusLabel(status) })),
          ]}
        />
        <Select
          className={TOUCH_SELECT}
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
          className={TOUCH_SELECT}
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
          minWidth="965px"
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

      <AdjustBalanceModal
        open={isBalanceModalOpen}
        onClose={() => {
          setIsBalanceModalOpen(false);
          setBalanceModalUser(null);
        }}
        targetUser={balanceModalUser}
        onSuccess={() => {
          list.refetch();
        }}
      />
    </div>
  );
}
