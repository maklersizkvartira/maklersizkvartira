/**
 * Account settings.
 *
 * The previous page could swap an avatar and a role and nothing else: a typo
 * in a name was permanent, there was no way to change a password, and no way
 * to see — let alone end — a session on a device the user no longer holds.
 * Those endpoints existed all along; only the UI was missing.
 *
 * A password is never rendered, never persisted, and never kept in state
 * beyond the submit that sends it.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Globe,
  GraduationCap,
  Home,
  KeyRound,
  LogOut,
  Monitor,
  Palette,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCog,
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { AuthApi } from '../../services/authApi';
import { useAppStore, type SignupRole } from '../../stores/useAppStore';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthErrors } from '../auth/useAuthErrors';
import { LanguageSwitcher } from '../layout/LanguageSwitcher';
import { ThemeToggle } from '../layout/ThemeToggle';
import { Button, Field, FormError, PasswordInput, TextInput } from '../ui/Field';
import { canPublishListings } from '../../types/roles';

const MAX_AVATAR_MB = 2;
const MIN_PASSWORD_LENGTH = 8;

interface SessionRow {
  id: string;
  createdAt: string;
  expiresAt: string;
  ip?: string;
  userAgent?: string;
}

// ---------------------------------------------------------------------------
const Section: React.FC<{
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, icon: Icon, action, children }) => {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 rounded-lg bg-brand-soft p-1.5 text-brand-text">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id={headingId} className="text-sm font-black text-content">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
};

/** A label/value row used by the read-only parts of the profile card. */
const DataRow: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({
  label,
  value,
  hint,
}) => (
  <div className="border-t border-line pt-3">
    <div className="text-xs font-semibold text-subtle">{label}</div>
    <div className="text-base font-bold text-content">{value}</div>
    {hint && <p className="mt-0.5 text-xs text-subtle">{hint}</p>}
  </div>
);

// ---------------------------------------------------------------------------
export const ProfilePage: React.FC = () => {
  const { t, formatDate, formatNumber } = useTranslation();
  const { messageFor } = useAuthErrors();
  const { preference } = useTheme();

  const currentUser = useAppStore((state) => state.currentUser);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const updateAvatar = useAppStore((state) => state.updateAvatar);
  const switchRole = useAppStore((state) => state.switchRole);
  const logout = useAppStore((state) => state.logout);
  const pushToast = useAppStore((state) => state.pushToast);

  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(currentUser?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [roleBusy, setRoleBusy] = useState<SignupRole | null>(null);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [confirmSignOutAll, setConfirmSignOutAll] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);

  // Resync the draft only when the stored name itself changes — keying this on
  // the user object would wipe what the user is typing every time an unrelated
  // field (avatar, role) comes back from the server.
  const storedName = currentUser?.name;
  useEffect(() => {
    if (storedName !== undefined) setName(storedName);
  }, [storedName]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      setSessions(await AuthApi.sessions());
    } catch (caught) {
      setSessions([]);
      setSessionsError(messageFor(caught));
    } finally {
      setSessionsLoading(false);
    }
  }, [messageFor]);

  const signedIn = Boolean(currentUser);
  useEffect(() => {
    if (signedIn) void loadSessions();
  }, [signedIn, loadSessions]);

  // The theme is a device-local choice, but mirroring it onto the account lets
  // a second device open in the same appearance. Failures are silent: an
  // unsaved preference is not worth interrupting the user for.
  const syncedTheme = useRef<string | null>(null);
  useEffect(() => {
    if (!currentUser) return;
    if (syncedTheme.current === null) syncedTheme.current = currentUser.theme;
    if (syncedTheme.current === preference) return;
    syncedTheme.current = preference;
    void AuthApi.updateProfile({ theme: preference }).catch(() => undefined);
  }, [preference, currentUser]);

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-black text-content">{t('auth.guard.title')}</h1>
        <p className="text-muted">{t('auth.guard.body')}</p>
        <Button fullWidth onClick={() => setShowAuth(true, 'LOGIN')}>
          {t('auth.guard.cta')}
        </Button>
      </div>
    );
  }

  const isOwner = canPublishListings(currentUser.role);
  const nameChanged = name.trim() !== currentUser.name && name.trim().length > 0;

  // -- Handlers -------------------------------------------------------------
  const handleSaveName = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    setNameError(null);

    if (trimmed.length < 2) {
      setNameError(t('auth.errors.nameTooShort'));
      return;
    }
    if (/\d/.test(trimmed)) {
      setNameError(t('auth.errors.nameHasDigits'));
      return;
    }

    setSavingName(true);
    try {
      const updated = await AuthApi.updateProfile({ name: trimmed });
      // The store exposes no generic profile setter; only the session slice
      // needs to change, so it is written directly rather than re-running the
      // whole `login()` side effect chain.
      useAppStore.setState({ currentUser: updated });
      pushToast('account.profile.nameSaved', 'success');
    } catch (caught) {
      setNameError(messageFor(caught));
    } finally {
      setSavingName(false);
    }
  };

  const handlePickAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setAvatarError(null);
    if (!file.type.startsWith('image/')) {
      setAvatarError(t('account.profile.avatarWrongType'));
      return;
    }
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      setAvatarError(t('account.profile.avatarTooLarge', { size: MAX_AVATAR_MB }));
      return;
    }

    setAvatarBusy(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setAvatarError(t('account.profile.avatarReadFailed'));
      setAvatarBusy(false);
    };
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setAvatarError(t('account.profile.avatarReadFailed'));
        setAvatarBusy(false);
        return;
      }
      void updateAvatar(reader.result)
        .catch((caught: unknown) => setAvatarError(messageFor(caught)))
        .finally(() => setAvatarBusy(false));
    };
    reader.readAsDataURL(file);
  };

  const handleSwitchRole = async (role: SignupRole) => {
    if (currentUser.role === role || roleBusy) return;
    setRoleBusy(role);
    try {
      await switchRole(role);
    } catch {
      pushToast('account.role.switchFailed', 'error');
    } finally {
      setRoleBusy(null);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);

    if (!currentPassword || !newPassword) {
      setPasswordError(t('auth.errors.passwordRequired'));
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(t('auth.errors.passwordTooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('auth.errors.passwordMismatch'));
      return;
    }

    setPasswordBusy(true);
    try {
      await AuthApi.changePassword(currentPassword, newPassword, confirmPassword);
      pushToast('auth.changePassword.success', 'success');
      setPasswordOpen(false);
      // Other devices were just revoked — show the list the server now has.
      void loadSessions();
    } catch (caught) {
      setPasswordError(messageFor(caught));
    } finally {
      // Wiped on both paths: nothing typed here outlives the request.
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordBusy(false);
    }
  };

  const handleSignOut = async (allDevices: boolean) => {
    setSignOutBusy(true);
    try {
      // `AuthApi.logout(true)` revokes the other devices; the store's own
      // `logout()` then clears local state and navigates home.
      if (allDevices) await AuthApi.logout(true);
      await logout();
      setCurrentView('HOME');
    } catch {
      pushToast('account.signOut.failed', 'error');
    } finally {
      setSignOutBusy(false);
      setConfirmSignOutAll(false);
    }
  };

  // -- Render ---------------------------------------------------------------
  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-black text-content">{t('account.page.title')}</h1>
        <p className="text-sm text-muted">{t('account.page.subtitle')}</p>
      </header>

      {/* -- Identity ------------------------------------------------------ */}
      <Section title={t('account.profile.title')} icon={UserCog}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={avatarBusy}
            aria-label={t('account.profile.avatarChange')}
            aria-busy={avatarBusy || undefined}
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-brand/30 bg-surface-2 transition-opacity disabled:opacity-60"
          >
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={t('account.profile.avatarAlt', { name: currentUser.name })}
                className="h-full w-full object-cover"
              />
            ) : (
              <span
                className={`flex h-full w-full items-center justify-center ${
                  isOwner ? 'bg-brand text-on-brand' : 'bg-info text-white'
                }`}
              >
                {isOwner ? (
                  <Home className="h-8 w-8" aria-hidden="true" />
                ) : (
                  <GraduationCap className="h-8 w-8" aria-hidden="true" />
                )}
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/60 py-1 text-[10px] font-bold text-white">
              <Camera className="h-3 w-3" aria-hidden="true" />
              {t('account.profile.avatarBadge')}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePickAvatar}
          />

          <div className="min-w-0 flex-1 space-y-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand-text">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {isOwner ? t('account.profile.badgeOwner') : t('account.profile.badgeStudent')}
            </span>
            <p className="text-xs text-subtle">
              {isOwner
                ? t('account.profile.captionOwner')
                : t('account.profile.captionStudent')}
            </p>
            <p className="text-xs text-subtle">
              {t('account.profile.avatarHint', { size: MAX_AVATAR_MB })}
            </p>
          </div>
        </div>

        <FormError message={avatarError} />

        <form onSubmit={handleSaveName} className="space-y-3" noValidate>
          <Field label={t('auth.fields.name')} error={nameError ?? undefined} required>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={name}
                autoComplete="name"
                placeholder={t('auth.fields.namePlaceholder')}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
          <Button
            type="submit"
            variant="secondary"
            loading={savingName}
            disabled={!nameChanged}
            fullWidth
          >
            {savingName ? t('common.action.saving') : t('common.action.save')}
          </Button>
        </form>

        <div className="space-y-3 text-sm">
          <DataRow
            label={t('account.profile.phone')}
            value={currentUser.phone}
            hint={t('account.profile.phoneLocked')}
          />
          <DataRow
            label={t('account.profile.memberSince')}
            value={formatDate(currentUser.createdAt)}
          />
          <div className="grid grid-cols-2 gap-3">
            <DataRow
              label={t('account.profile.trustScore')}
              value={formatNumber(currentUser.trustScore)}
            />
            <DataRow
              label={t('account.profile.verificationLevel')}
              value={t('common.badge.verificationLevel', {
                level: currentUser.verificationLevel,
              })}
            />
          </div>
          <DataRow
            label={t('account.profile.xpPoints')}
            value={
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-warning" aria-hidden="true" />
                {formatNumber(currentUser.xpPoints)}
              </span>
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${
              currentUser.isVerified
                ? 'bg-success-soft text-success'
                : 'bg-warning-soft text-warning'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {currentUser.isVerified
              ? t('account.profile.verified')
              : t('account.profile.notVerified')}
          </span>
          {!currentUser.isVerified && (
            <Button
              variant="ghost"
              className="px-3 py-2"
              onClick={() => setCurrentView('VERIFICATION')}
            >
              {t('account.profile.verify')}
            </Button>
          )}
        </div>
      </Section>

      {/* -- Role ---------------------------------------------------------- */}
      <Section
        title={t('account.role.title')}
        description={t('account.role.subtitle')}
        icon={UserCog}
      >
        <div role="radiogroup" aria-label={t('account.role.title')} className="grid grid-cols-2 gap-2">
          {(
            [
              { value: 'OWNER', icon: Home, titleKey: 'account.role.owner.title', descriptionKey: 'account.role.owner.description' },
              { value: 'STUDENT', icon: GraduationCap, titleKey: 'account.role.student.title', descriptionKey: 'account.role.student.description' },
            ] as const
          ).map((option) => {
            const active = currentUser.role === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={roleBusy !== null}
                onClick={() => void handleSwitchRole(option.value)}
                className={`rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  active
                    ? 'border-brand bg-brand-soft text-brand-text shadow-card'
                    : 'border-line bg-surface-2 text-muted hover:bg-surface-3 hover:text-content'
                }`}
              >
                <span className="flex items-center gap-2 text-xs font-black">
                  <option.icon className="h-4 w-4" aria-hidden="true" />
                  {t(option.titleKey)}
                </span>
                <span className="mt-0.5 block text-[10px] font-medium opacity-80">
                  {roleBusy === option.value
                    ? t('account.role.switching')
                    : t(option.descriptionKey)}
                </span>
                {active && (
                  <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-wide">
                    {t('account.role.active')}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isOwner && (
          <Button fullWidth onClick={() => setCurrentView('CREATE_LISTING')}>
            {t('account.role.createListing')}
          </Button>
        )}
      </Section>

      {/* -- Preferences --------------------------------------------------- */}
      <Section title={t('account.preferences.title')} icon={Palette}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-bold text-content">
              <Globe className="h-4 w-4 text-muted" aria-hidden="true" />
              {t('common.language.label')}
            </div>
            <p className="mt-0.5 text-xs text-muted">{t('account.preferences.languageHint')}</p>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="space-y-2 border-t border-line pt-4">
          <div className="flex items-center gap-1.5 text-sm font-bold text-content">
            <Palette className="h-4 w-4 text-muted" aria-hidden="true" />
            {t('common.theme.label')}
          </div>
          <ThemeToggle compact={false} />
          <p className="text-xs text-muted">{t('account.preferences.themeHint')}</p>
        </div>
      </Section>

      {/* -- Security ------------------------------------------------------ */}
      <Section title={t('account.security.title')} icon={KeyRound}>
        <div className="space-y-1">
          <div className="text-sm font-bold text-content">
            {t('account.security.passwordTitle')}
          </div>
          <p className="text-xs text-muted">{t('account.security.passwordDescription')}</p>
          <p className="text-xs text-subtle">{t('account.security.passwordNeverShown')}</p>
        </div>

        <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs font-semibold text-warning">
          <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('auth.changePassword.warning')}</span>
        </p>

        {!passwordOpen ? (
          <Button variant="secondary" fullWidth onClick={() => setPasswordOpen(true)}>
            {t('auth.changePassword.title')}
          </Button>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-3" noValidate>
            <FormError message={passwordError} />

            <Field label={t('auth.fields.currentPassword')} required>
              {({ id, describedBy, invalid }) => (
                <PasswordInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={currentPassword}
                  autoComplete="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              )}
            </Field>

            <Field
              label={t('auth.fields.newPassword')}
              hint={t('auth.fields.passwordPlaceholder')}
              required
            >
              {({ id, describedBy, invalid }) => (
                <PasswordInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={newPassword}
                  autoComplete="new-password"
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              )}
            </Field>

            <Field label={t('auth.fields.confirmPassword')} required>
              {({ id, describedBy, invalid }) => (
                <PasswordInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={confirmPassword}
                  autoComplete="new-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              )}
            </Field>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setPasswordOpen(false);
                  setPasswordError(null);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                {t('common.action.cancel')}
              </Button>
              <Button type="submit" className="flex-1" loading={passwordBusy}>
                {t('auth.changePassword.submit')}
              </Button>
            </div>
          </form>
        )}
      </Section>

      {/* -- Sessions ------------------------------------------------------ */}
      <Section
        title={t('account.sessions.title')}
        description={t('account.sessions.subtitle')}
        icon={Monitor}
        action={
          <button
            type="button"
            onClick={() => void loadSessions()}
            disabled={sessionsLoading}
            aria-label={t('account.sessions.reload')}
            title={t('account.sessions.reload')}
            className="rounded-lg border border-line bg-surface p-2 text-muted transition-colors hover:border-brand hover:text-content disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${sessionsLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </button>
        }
      >
        {sessionsLoading ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1].map((row) => (
              <div key={row} className="h-16 animate-shimmer rounded-xl" />
            ))}
          </div>
        ) : sessionsError ? (
          <div className="space-y-3">
            <FormError message={t('account.sessions.loadFailed')} />
            <Button variant="secondary" fullWidth onClick={() => void loadSessions()}>
              {t('common.action.retry')}
            </Button>
          </div>
        ) : sessions.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-3 py-6 text-center text-sm text-muted">
            {t('account.sessions.empty')}
          </p>
        ) : (
          <>
            <p className="text-xs font-bold text-subtle">
              {t('account.sessions.count', { count: sessions.length })}
            </p>
            <ul className="space-y-2">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="rounded-xl border border-line bg-surface-2 p-3 text-xs"
                >
                  <div className="flex items-center gap-2 font-bold text-content">
                    <Monitor className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <span className="truncate">
                      {session.userAgent || t('account.sessions.unknownDevice')}
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-muted">
                    <div>
                      <dt className="text-subtle">{t('account.sessions.ip')}</dt>
                      <dd className="font-semibold text-content">
                        {session.ip || t('account.sessions.unknownIp')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-subtle">{t('account.sessions.started')}</dt>
                      <dd className="font-semibold text-content">
                        {formatDate(session.createdAt, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-subtle">{t('account.sessions.expires')}</dt>
                      <dd className="font-semibold text-content">
                        {formatDate(session.expiresAt, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      {/* -- Sign out ------------------------------------------------------ */}
      <Section title={t('account.signOut.title')} icon={LogOut}>
        <Button
          variant="secondary"
          fullWidth
          loading={signOutBusy && !confirmSignOutAll}
          onClick={() => void handleSignOut(false)}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t('account.signOut.thisDevice')}
        </Button>

        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-xs text-muted">{t('account.signOut.allDevicesHint')}</p>
          {confirmSignOutAll ? (
            <div className="space-y-2 rounded-xl border border-danger/30 bg-danger-soft p-3">
              <p className="text-xs font-bold text-danger">{t('account.signOut.confirmAll')}</p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setConfirmSignOutAll(false)}
                >
                  {t('common.action.cancel')}
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  loading={signOutBusy}
                  onClick={() => void handleSignOut(true)}
                >
                  {t('common.action.confirm')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" fullWidth onClick={() => setConfirmSignOutAll(true)}>
              {t('account.signOut.allDevices')}
            </Button>
          )}
        </div>
      </Section>
    </div>
  );
};

export default ProfilePage;
