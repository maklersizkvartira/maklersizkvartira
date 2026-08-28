'use client';

import { useMemo, useState } from 'react';
// `useParams` has no next-intl counterpart and reads the raw segment, which is
// exactly what is wanted for `[id]`. Link and useRouter below must still come
// from `@/i18n/routing` so the locale prefix survives every hop.
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, Copy, Eye, EyeOff, KeyRound, LogOut, Trash2 } from 'lucide-react';

import { Link, useRouter } from '@/i18n/routing';
import { ApiError, http } from '@/shared/lib/http';
import { api } from '@/shared/api/endpoints';
import type {
  AdminSetPasswordPayload,
  AdminUserDetail,
  AdminUserPatch,
  AdminUserRow,
  RevealPasswordResponse,
  UserRole,
  UserStatus,
} from '@/shared/api/types';
import { useRole } from '@/providers/role-provider';
import { useConfirm } from '@/providers/confirm-provider';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { StatusPill } from '@/shared/ui/StatusPill';
import { Modal } from '@/shared/ui/Modal';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { Spinner } from '@/shared/ui/Spinner';
import { EmptyState } from '@/shared/ui/EmptyState';
import { toast } from '@/shared/ui/Toast';
import { maskPhone } from '@/shared/lib/mask';

/**
 * One account: the row, its last 50 audit events and its live sessions.
 *
 * `GET /admin/users/{id}` is one of the three routes whose extras are SIBLINGS
 * of `data` rather than nested inside it, so it is read with `http.raw.get` —
 * `http.get` would unwrap `data` and throw `activity` and `sessions` away.
 *
 * Every button below is gated on `ACTION_MIN_ROLE`, which mirrors the backend's
 * own rank check. A moderator may read this page and may change nothing on it.
 */

const ROLES: UserRole[] = ['STUDENT', 'TENANT', 'OWNER', 'MODERATOR', 'ADMIN', 'DEVELOPER'];

const STATUSES: UserStatus[] = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'BANNED',
  'REGISTRATION_REQUIRED',
];

const KNOWN_ROLES = new Set<string>(ROLES);
const KNOWN_STATUSES = new Set<string>(STATUSES);

/**
 * Password-policy rejections the `users.passwordPolicy.*` messages cover.
 *
 * The backend's error `code` is snake_case and prefixed; anything that does not
 * normalise into this set falls through to `error.message`, which the API has
 * already translated into the request's language. Guessing wrong therefore
 * costs a slightly less specific sentence, never a blank or a crash.
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

export default function UserDetailPage() {
  const t = useTranslations('users');
  const c = useTranslations('common');
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { can } = useRole();

  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [revealed, setRevealed] = useState<RevealPasswordResponse | null>(null);
  const [hidden, setHidden] = useState(true);

  const dateTimeFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );
  const showDate = (iso: string | null) => (iso ? dateTimeFormat.format(new Date(iso)) : c('never'));

  const detail = useQuery({
    queryKey: ['user', id],
    queryFn: ({ signal }) => http.raw.get<AdminUserDetail>(api.users.detail(id), { signal }),
    enabled: Boolean(id),
  });

  const roleLabel = (role: string) =>
    KNOWN_ROLES.has(role) ? t(`role.${role}` as Parameters<typeof t>[0]) : role;
  const statusLabel = (status: string) =>
    KNOWN_STATUSES.has(status) ? t(`status.${status}` as Parameters<typeof t>[0]) : status;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['user', id] });

  const patch = useMutation({
    mutationFn: (body: AdminUserPatch) => http.patch<AdminUserRow>(api.users.patch(id), body),
    onSuccess: () => {
      toast.success(c('success'));
      setEditOpen(false);
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  const reveal = useMutation({
    mutationFn: () => http.raw.post<RevealPasswordResponse>(api.users.revealPassword(id)),
    onSuccess: (data) => {
      setRevealed(data);
      setHidden(true);
    },
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  const setPassword = useMutation({
    mutationFn: (body: AdminSetPasswordPayload) => http.post(api.users.setPassword(id), body),
    onSuccess: () => {
      toast.success(c('success'));
      setPasswordOpen(false);
      void invalidate();
    },
    onError: (error: Error) => {
      const key = error instanceof ApiError ? policyKey(error.code) : null;
      toast.error(
        c('error'),
        key ? t(`passwordPolicy.${key}` as Parameters<typeof t>[0]) : error.message,
      );
    },
  });

  const revokeSessions = useMutation({
    mutationFn: () => http.post(api.users.revokeSessions(id)),
    onSuccess: () => {
      toast.success(c('success'));
      void invalidate();
    },
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  const remove = useMutation({
    mutationFn: () => http.delete(api.users.remove(id)),
    onSuccess: () => {
      toast.success(c('success'));
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      router.replace('/users');
    },
    onError: (error: Error) => toast.error(c('error'), error.message),
  });

  if (detail.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" label={c('loading')} />
      </div>
    );
  }

  if (detail.error || !detail.data) {
    return (
      <div className="card">
        <EmptyState
          title={c('error')}
          description={detail.error?.message}
          action={
            <Button variant="secondary" onClick={() => detail.refetch()}>
              {c('retry')}
            </Button>
          }
        />
      </div>
    );
  }

  // Destructured after the guard: `data`, `activity` and `sessions` are
  // siblings in this response, and narrowing `detail.data` once here is what
  // lets all three be read without a `?.` on every line.
  const { data: user, activity, sessions } = detail.data;

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href="/users" className="inline-flex items-center gap-1.5 hover:opacity-80">
            <ArrowLeft size={13} /> {t('title')}
          </Link>
        }
        title={user.name}
        subtitle={maskPhone(user.phone)}
        actions={
          <>
            {can('userPatch') && (
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                {t('actions.edit')}
              </Button>
            )}
            {can('userSetPassword') && (
              <Button
                variant="secondary"
                size="sm"
                icon={<KeyRound size={14} />}
                onClick={() => setPasswordOpen(true)}
              >
                {t('actions.setPassword')}
              </Button>
            )}
            {can('userRevokeSessions') && (
              <Button
                variant="secondary"
                size="sm"
                icon={<LogOut size={14} />}
                loading={revokeSessions.isPending}
                onClick={async () => {
                  if (await confirm({ message: t('revokeConfirm'), isDestructive: true })) {
                    revokeSessions.mutate();
                  }
                }}
              >
                {t('actions.revokeSessions')}
              </Button>
            )}
            {can('userDelete') && (
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={14} />}
                loading={remove.isPending}
                onClick={async () => {
                  if (
                    await confirm({
                      message: t('deleteConfirm'),
                      isDestructive: true,
                      confirmLabel: c('delete'),
                      cancelLabel: c('cancel'),
                    })
                  ) {
                    remove.mutate();
                  }
                }}
              >
                {t('actions.delete')}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Profile ──────────────────────────────────────────────────── */}
        <section className="card p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            {t('detail.profile')}
          </h2>

          <div className="flex items-center gap-3 mb-5">
            <Avatar src={user.avatar} name={user.name} size="xl" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                {user.name}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                {user.email ?? user.authType}
              </p>
            </div>
          </div>

          <dl className="space-y-2.5">
            <Field label={t('columns.role')} value={roleLabel(user.role)} />
            <Field
              label={t('columns.status')}
              value={<StatusPill status={user.status} label={statusLabel(user.status)} />}
            />
            <Field label={t('columns.phone')} value={maskPhone(user.phone)} />
            <Field label={t('columns.trust')} value={String(user.trustScore)} />
            <Field label={t('columns.listings')} value={String(user.listingsCount)} />
            <Field label={t('columns.lastLogin')} value={showDate(user.lastLoginAt)} />
            <Field label={t('columns.created')} value={showDate(user.createdAt)} />
          </dl>

          {/* ── Reveal password ───────────────────────────────────────────
              A CRITICAL audit row is written on every call, naming the admin
              who made it — hence the confirmation before, and the backend's own
              warning shown after. */}
          {can('userRevealPassword') && (
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                {t('revealPassword.title')}
              </p>

              {!user.passwordRevealable || !user.hasPassword ? (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {t('revealPassword.unavailable')}
                </p>
              ) : revealed ? (
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 text-xs px-2.5 py-2 rounded-[var(--radius-sm)] truncate"
                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-primary)' }}
                  >
                    {hidden ? '••••••••••••' : revealed.password}
                  </code>
                  <button
                    className="icon-btn w-8 h-8"
                    onClick={() => setHidden((h) => !h)}
                    aria-label={hidden ? t('revealPassword.reveal') : t('revealPassword.hide')}
                  >
                    {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    className="icon-btn w-8 h-8"
                    onClick={() => {
                      void navigator.clipboard?.writeText(revealed.password);
                      toast.success(c('copied'));
                    }}
                    aria-label={c('copy')}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={reveal.isPending}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: t('revealPassword.title'),
                        message: t('revealPassword.warning'),
                        isDestructive: true,
                      })
                    ) {
                      reveal.mutate();
                    }
                  }}
                >
                  {t('revealPassword.reveal')}
                </Button>
              )}

              {revealed && (
                <p className="text-[11px] mt-2" style={{ color: 'var(--color-warning)' }}>
                  {revealed.warning}
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Activity ─────────────────────────────────────────────────── */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            {t('detail.activity')}
          </h2>

          {activity.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
              {t('detail.noActivity')}
            </p>
          ) : (
            <ul className="space-y-0">
              {activity.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start gap-3 py-2.5"
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                >
                  <Badge status={row.severity} className="shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {row.summary ?? row.action}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {showDate(row.createdAt)}
                      {row.ip ? ` · ${row.ip}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Sessions ─────────────────────────────────────────────────── */}
        <section className="card p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            {t('detail.sessions')}
          </h2>

          {sessions.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
              {t('detail.noSessions')}
            </p>
          ) : (
            <ul>
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5"
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                >
                  <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    {session.ip ?? c('unknown')}
                  </span>
                  <span className="text-xs flex-1 min-w-0 truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {session.userAgent ?? c('unknown')}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {c('from')}: {showDate(session.createdAt)} · {c('to')}: {showDate(session.expiresAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Edit ───────────────────────────────────────────────────────────
          Only the three fields this screen has translated labels for. Adding a
          field here means adding its label to `users.columns` first. */}
      <EditModal
        // Remount on every saved change so the form's initial state is the row
        // that came back, not the one it was first opened with.
        key={user.updatedAt}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        user={user}
        pending={patch.isPending}
        onSubmit={(body) => patch.mutate(body)}
        labels={{
          title: t('actions.edit'),
          role: t('columns.role'),
          status: t('columns.status'),
          trust: t('columns.trust'),
          save: c('save'),
          cancel: c('cancel'),
          close: c('close'),
        }}
        roleOptions={ROLES.map((role) => ({ value: role, label: roleLabel(role) }))}
        statusOptions={STATUSES.map((status) => ({ value: status, label: statusLabel(status) }))}
      />

      <SetPasswordModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        pending={setPassword.isPending}
        onSubmit={(body) => setPassword.mutate(body)}
        labels={{
          title: t('setPassword.title'),
          newPassword: t('setPassword.newPassword'),
          mustChange: t('setPassword.mustChange'),
          revokeSessions: t('setPassword.revokeSessions'),
          submit: t('setPassword.submit'),
          cancel: c('cancel'),
          close: c('close'),
        }}
      />
    </div>
  );
}

/* ─── Pieces ─────────────────────────────────────────────────────────────── */

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </dt>
      <dd className="text-sm text-right min-w-0 truncate" style={{ color: 'var(--color-text-primary)' }}>
        {value}
      </dd>
    </div>
  );
}

function EditModal({
  open,
  onClose,
  user,
  pending,
  onSubmit,
  labels,
  roleOptions,
  statusOptions,
}: {
  open: boolean;
  onClose: () => void;
  user: AdminUserRow;
  pending: boolean;
  onSubmit: (body: AdminUserPatch) => void;
  labels: Record<'title' | 'role' | 'status' | 'trust' | 'save' | 'cancel' | 'close', string>;
  roleOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
}) {
  const [role, setRole] = useState<string>(user.role);
  const [status, setStatus] = useState<string>(user.status);
  const [trust, setTrust] = useState<string>(String(user.trustScore));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={labels.title}
      closeLabel={labels.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {labels.cancel}
          </Button>
          <Button
            loading={pending}
            onClick={() =>
              onSubmit({
                role: role as UserRole,
                status: status as UserStatus,
                // 0..100 on the backend; anything outside is a 422, not a clamp.
                trustScore: Math.min(100, Math.max(0, Number(trust) || 0)),
              })
            }
          >
            {labels.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {labels.role}
          </span>
          <Select value={role} onChange={setRole} options={roleOptions} className="mt-1.5" />
        </label>

        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {labels.status}
          </span>
          <Select value={status} onChange={setStatus} options={statusOptions} className="mt-1.5" />
        </label>

        <Input
          label={labels.trust}
          type="number"
          min={0}
          max={100}
          value={trust}
          onChange={(e) => setTrust(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function SetPasswordModal({
  open,
  onClose,
  pending,
  onSubmit,
  labels,
}: {
  open: boolean;
  onClose: () => void;
  pending: boolean;
  onSubmit: (body: AdminSetPasswordPayload) => void;
  labels: Record<
    'title' | 'newPassword' | 'mustChange' | 'revokeSessions' | 'submit' | 'cancel' | 'close',
    string
  >;
}) {
  const [value, setValue] = useState('');
  const [mustChange, setMustChange] = useState(true);
  const [revoke, setRevoke] = useState(true);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={labels.title}
      closeLabel={labels.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {labels.cancel}
          </Button>
          <Button
            loading={pending}
            // The backend's floor is 8 characters; blocking here saves a round
            // trip, it does not replace the server-side policy check.
            disabled={value.length < 8}
            onClick={() =>
              onSubmit({ newPassword: value, mustChange, revokeSessions: revoke })
            }
          >
            {labels.submit}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={labels.newPassword}
          type="password"
          autoComplete="new-password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <input type="checkbox" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
          {labels.mustChange}
        </label>

        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <input type="checkbox" checked={revoke} onChange={(e) => setRevoke(e.target.checked)} />
          {labels.revokeSessions}
        </label>
      </div>
    </Modal>
  );
}
