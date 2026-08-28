'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ShieldCheck, UserPlus } from 'lucide-react';

import { ApiError, http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type { AdminStaffRow, CreateStaffPayload } from '@/shared/api/types';
import { useAuthStore } from '@/store/auth.store';
import { useConfirm } from '@/providers/confirm-provider';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { EmptyState } from '@/shared/ui/EmptyState';
import { StatusPill } from '@/shared/ui/StatusPill';
import { toast } from '@/shared/ui/Toast';
import { CreateStaffSheet } from './CreateStaffSheet';

/**
 * Every account that can sign in to this panel.
 *
 * `GET /admin/staff` answers with a bare array and no `meta` — it is the whole
 * table, oldest first — so this screen deliberately does not go through
 * `useAdminList` or render a `<Pagination>`. There is nothing to page through
 * and no server-side filter to debounce.
 *
 * The API offers exactly two verbs: create, and flip `is_active`. There is no
 * role edit, no password edit, no email edit and no delete, so this screen
 * shows no control for any of them. A disabled button for a route that does
 * not exist would be a promise the backend cannot keep.
 */

/**
 * `password_too_short` → `tooShort`. The `users.passwordPolicy.*` messages are
 * the only translated password copy in the bundle; a code that does not
 * normalise into that set falls through to the backend's own message, which is
 * already in the request's language.
 */
const PASSWORD_POLICY_KEYS = new Set([
  'tooShort',
  'tooSimple',
  'tooCommon',
  'containsPhone',
  'containsName',
  'repeatedCharacter',
  'whitespace',
  'tooLong',
]);

function policyKey(code: string | undefined): string | null {
  if (!code) return null;
  const camel = code
    .replace(/^password_/, '')
    .replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
  return PASSWORD_POLICY_KEYS.has(camel) ? camel : null;
}

export function StaffScreen() {
  const t = useTranslations('staff');
  const c = useTranslations('common');
  const tu = useTranslations('users');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  // The signed-in account, so its own row can have its toggle disabled.
  // `PATCH /admin/staff/{id}/active` answers 400 `cannot_modify_self` for it,
  // and a control whose only outcome is an error is not a control.
  const selfId = useAuthStore((s) => s.admin?.id ?? null);

  const [createOpen, setCreateOpen] = useState(false);

  const dateTimeFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );
  const showDate = (iso: string | null) => (iso ? dateTimeFormat.format(new Date(iso)) : c('never'));

  const staff = useQuery({
    queryKey: ['staff'],
    queryFn: ({ signal }) => http.get<AdminStaffRow[]>(api.staff.list, { signal }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff'] });

  const create = useMutation({
    mutationFn: (payload: CreateStaffPayload) =>
      http.post<AdminStaffRow>(api.staff.create, payload),
    onSuccess: () => {
      toast.success(c('success'));
      setCreateOpen(false);
      void invalidate();
    },
    onError: (error: Error) => {
      const key = error instanceof ApiError ? policyKey(error.code) : null;
      toast.error(
        c('error'),
        key ? tu(`passwordPolicy.${key}` as Parameters<typeof tu>[0]) : error.message,
      );
    },
  });

  const setActive = useMutation({
    // No body at all, and `is_active` is a REQUIRED snake_case query parameter.
    // `api.staff.setActive` builds it; spelling it `isActive` by hand would be
    // dropped by FastAPI and the row would never change.
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      http.patch(api.staff.setActive(id, isActive)),
    onSuccess: () => {
      toast.success(c('success'));
      void invalidate();
    },
    onError: (error: Error) => {
      const code = error instanceof ApiError ? error.code : null;
      toast.error(c('error'), code === 'cannot_modify_self' ? t('cannotModifySelf') : error.message);
    },
  });

  const toggle = async (row: AdminStaffRow) => {
    const next = !row.isActive;
    // Enabling is harmless; disabling revokes every live session for that
    // account and bumps its token version, so it gets a confirmation.
    if (!next) {
      const ok = await confirm({
        title: t('deactivate'),
        message: `@${row.username}`,
        isDestructive: true,
        confirmLabel: t('deactivate'),
        cancelLabel: c('cancel'),
      });
      if (!ok) return;
    }
    setActive.mutate({ id: row.id, isActive: next });
  };

  const columns: Column<AdminStaffRow>[] = [
    {
      key: 'username',
      header: t('columns.username'),
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
            @{row.username}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
            {row.fullName}
          </p>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('columns.role'),
      render: (row) => t(`role.${row.role}` as Parameters<typeof t>[0]),
    },
    {
      key: 'isActive',
      header: t('columns.active'),
      render: (row) => (
        <StatusPill
          status={row.isActive ? 'ACTIVE' : 'SUSPENDED'}
          label={row.isActive ? c('yes') : c('no')}
        />
      ),
    },
    {
      key: 'lastLoginAt',
      header: t('columns.lastLogin'),
      render: (row) => showDate(row.lastLoginAt),
    },
    {
      key: 'createdAt',
      header: t('columns.created'),
      render: (row) => showDate(row.createdAt),
    },
    {
      key: 'actions',
      header: c('actions'),
      align: 'right',
      // Deliberately NOT hidden on the card list: deactivation is the only
      // lifecycle control this API has, and a phone is where it gets used.
      render: (row) => {
        const isSelf = row.id === selfId;
        return (
          <button
            type="button"
            disabled={isSelf || setActive.isPending}
            onClick={(e) => {
              e.stopPropagation();
              void toggle(row);
            }}
            title={isSelf ? t('cannotModifySelf') : undefined}
            className="inline-flex items-center justify-center px-4 h-11 lg:h-8 w-full lg:w-auto
                       text-xs font-semibold rounded-[var(--radius-md)] transition-all
                       active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed
                       disabled:active:scale-100"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              color: row.isActive ? 'var(--color-danger)' : 'var(--color-text-primary)',
            }}
          >
            {row.isActive ? t('deactivate') : t('activate')}
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button
            size="md"
            icon={<UserPlus size={15} />}
            className="max-sm:w-full max-sm:h-11"
            onClick={() => setCreateOpen(true)}
          >
            {t('create')}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={staff.data}
        keyOf={(row) => row.id}
        loading={staff.isLoading}
        loadingRows={6}
        empty={
          <EmptyState
            icon={<ShieldCheck size={26} />}
            title={c('noData')}
            description={staff.error?.message}
            action={
              staff.error ? (
                <Button variant="secondary" onClick={() => staff.refetch()}>
                  {c('retry')}
                </Button>
              ) : undefined
            }
          />
        }
      />

      <CreateStaffSheet
        // Remounted per opening so a cancelled draft never reappears half
        // filled the next time the sheet is raised.
        key={createOpen ? 'open' : 'closed'}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        pending={create.isPending}
        onSubmit={(payload) => create.mutate(payload)}
      />
    </div>
  );
}
