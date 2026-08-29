'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

import type { AdminRole, CreateStaffPayload } from '@/shared/api/types';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';

/**
 * The only way to add a staff account, and the only staff form that exists —
 * the API has no role edit, no password edit, no email edit and no delete, so
 * everything a superadmin will ever decide about an account is decided here.
 *
 * A bottom sheet below md and a centred dialog above it, matching
 * `confirm-provider`. The shared `Modal` centres at every width, which puts a
 * four-field form under the reader's thumb reach on a phone.
 */

/** `CreateAdminRequest.username` — the backend does NOT lowercase for you, so
 *  an uppercase character is a 422 rather than a silently normalised name. */
const USERNAME_PATTERN = /^[a-z0-9._-]{3,64}$/;

/**
 * `CreateAdminRequest.password` is `min_length=12`, which bites before the
 * password policy runs. The policy's own floor is `PASSWORD_MIN_LENGTH` (8)
 * and the `staff.passwordHint` copy still quotes it, so the number below is
 * the one that actually decides whether the request succeeds.
 */
const PASSWORD_MIN = 12;

const ROLES: AdminRole[] = ['MODERATOR', 'ADMIN', 'SUPERADMIN'];

/** The client-ness of the page never changes, so there is nothing to notify. */
const subscribeNever = () => () => {};

interface CreateStaffSheetProps {
  open: boolean;
  onClose: () => void;
  pending: boolean;
  onSubmit: (payload: CreateStaffPayload) => void;
}

export function CreateStaffSheet({ open, onClose, pending, onSubmit }: CreateStaffSheetProps) {
  const t = useTranslations('staff');
  const c = useTranslations('common');
  const tu = useTranslations('users');

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>('MODERATOR');
  /** Errors appear once a field has been left, not while it is half-typed. */
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !mounted) return null;

  const usernameValid = USERNAME_PATTERN.test(username);
  const fullNameValid = fullName.trim().length >= 2;
  const passwordValid = password.length >= PASSWORD_MIN && password.length <= 128;
  const valid = usernameValid && fullNameValid && passwordValid;

  const submit = () => {
    if (!valid || pending) return;
    onSubmit({
      username,
      fullName: fullName.trim(),
      password,
      role: role as AdminRole,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center md:p-4">
      <button
        type="button"
        aria-label={c('close')}
        className="absolute inset-0 cursor-default"
        style={{ background: 'rgba(5,11,22,0.6)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('createTitle')}
        className="relative w-full flex flex-col overflow-hidden
                   md:max-w-md md:rounded-[24px] md:animate-scale-in
                   max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0
                   max-md:rounded-t-[28px] max-md:animate-slide-up-mobile"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-modal)',
          maxHeight: 'calc(100dvh - 32px)',
        }}
      >
        {/* Grab handle — the affordance that says "this sheet drags down". */}
        <div className="md:hidden w-12 h-1 rounded-full mx-auto mt-3 shrink-0"
             style={{ background: 'var(--color-border-medium)' }} />

        <div
          className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {t('createTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={c('close')}
            className="icon-btn flex w-11 h-11 md:w-8 md:h-8 -mt-1.5 -mr-1.5 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 flex flex-col gap-4">
          <Input
            label={t('username')}
            value={username}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            // Lowercased as it is typed rather than on submit: the pattern is
            // the backend's, and a name that silently changed shape at submit
            // is a name the reader did not choose.
            onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
            onBlur={() => setTouched((s) => ({ ...s, username: true }))}
            hint={t('usernameHint')}
            error={touched.username && !usernameValid ? t('usernameHint') : undefined}
          />

          <Input
            label={tu('columns.name')}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => setTouched((s) => ({ ...s, fullName: true }))}
            error={touched.fullName && !fullNameValid ? c('required') : undefined}
          />

          <Input
            label={t('password')}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((s) => ({ ...s, password: true }))}
            hint={tu('passwordPolicy.tooShort', { min: PASSWORD_MIN })}
            error={
              touched.password && !passwordValid
                ? tu('passwordPolicy.tooShort', { min: PASSWORD_MIN })
                : undefined
            }
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {t('roleLabel')}
            </span>
            <Select
              value={role}
              onChange={setRole}
              options={ROLES.map((value) => ({
                value,
                label: t(`role.${value}` as Parameters<typeof t>[0]),
              }))}
            />
          </label>
        </div>

        <div
          className="flex flex-col-reverse md:flex-row md:justify-end gap-2 px-5 py-4 shrink-0
                     max-md:pb-[calc(16px+env(safe-area-inset-bottom))]"
          style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}
        >
          <Button variant="ghost" size="lg" className="md:h-9" onClick={onClose}>
            {c('cancel')}
          </Button>
          <Button size="lg" className="md:h-9" loading={pending} disabled={!valid} onClick={submit}>
            {t('create')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
