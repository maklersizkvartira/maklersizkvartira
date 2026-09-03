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
 *
 * The layout is a two-column rail on lg and one column below it. Who you are
 * — avatar, badge, verification standing — does not change while you edit, so
 * it stays pinned in the rail and the editable sections get the wide column.
 * Rendered as a single narrow stack at every width, the page read as a phone
 * screen stretched across a monitor.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Camera,
  ChevronRight,
  Globe,
  GraduationCap,
  Home,
  KeyRound,
  Laptop,
  LogOut,
  Monitor,
  Palette,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  UserCog,
} from 'lucide-react';

import { useTranslation } from '../../i18n';
import { AuthApi, type AuthSession } from '../../services/authApi';
import { useAppStore, type SignupRole } from '../../stores/useAppStore';
import { useTheme } from '../../theme/ThemeProvider';
import { useHaptics } from '../../hooks/useHaptics';
import { cn } from '../../lib/cn';
import { useAuthErrors } from '../auth/useAuthErrors';
import { LanguageSwitcher } from '../layout/LanguageSwitcher';
import { ThemeToggle } from '../layout/ThemeToggle';
import { Card, CardEmpty, SectionCard } from '../ui/Card';
import { Button, Field, FormError, PasswordInput, TextInput } from '../ui/Field';
import { Sheet } from '../ui/Sheet';
import { canPublishListings, isSwitchableRole, roleLabelKey } from '../../types/roles';

const MAX_AVATAR_MB = 5;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Cards are roomier than the shared `md`/`lg` steps on this page: it is a
 * settings screen read one section at a time, and the extra breathing room on
 * a phone is what stops six stacked panels from reading as one wall.
 */
const CARD_PADDING = 'p-4 sm:p-6';

// ---------------------------------------------------------------------------
// User agents
// ---------------------------------------------------------------------------
interface DeviceLabel {
  device: string;
  /** Empty when the string carries no recognisable engine. */
  browser: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * A user agent is a compatibility fossil, not a description: every desktop
 * browser still claims to be Mozilla, most claim to be Safari, and every
 * Chromium fork claims to be Chrome. The order below matters — each impostor
 * is matched before the name it impersonates, which is what keeps Edge from
 * reporting as Chrome and Chrome from reporting as Safari.
 *
 * Only platform and engine names are produced, never a translated phrase:
 * "iPhone" and "Chrome" are proper nouns and read the same in all three
 * locales, while the icon carries phone / tablet / desktop.
 */
function describeUserAgent(raw: string | undefined, unknownDevice: string): DeviceLabel {
  const ua = raw?.trim() ?? '';
  if (!ua) return { device: unknownDevice, browser: '', icon: Monitor };

  let device = unknownDevice;
  let icon: React.ComponentType<{ className?: string }> = Monitor;

  if (/iPhone|iPod/i.test(ua)) {
    device = 'iPhone';
    icon = Smartphone;
  } else if (/iPad/i.test(ua)) {
    device = 'iPad';
    icon = Tablet;
  } else if (/Android/i.test(ua)) {
    device = 'Android';
    // Android tablets are identified by the absence of "Mobile", not by a
    // token of their own.
    icon = /Mobile/i.test(ua) ? Smartphone : Tablet;
  } else if (/CrOS/i.test(ua)) {
    device = 'Chromebook';
    icon = Laptop;
  } else if (/Windows/i.test(ua)) {
    device = 'Windows';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    device = 'macOS';
    icon = Laptop;
  } else if (/Linux/i.test(ua)) {
    device = 'Linux';
  }

  let browser = '';
  if (/Edg[A-Z]?\//i.test(ua)) browser = 'Edge';
  else if (/YaBrowser/i.test(ua)) browser = 'Yandex';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox|FxiOS/i.test(ua)) browser = 'Firefox';
  else if (/Chrome|CriOS|Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua)) browser = 'Safari';

  return { device, browser, icon };
}

// ---------------------------------------------------------------------------
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
const SessionRow: React.FC<{
  session: AuthSession;
  confirming: boolean;
  onAskRevoke: () => void;
  onCancelRevoke: () => void;
  onRevoke: () => void;
}> = ({ session, confirming, onAskRevoke, onCancelRevoke, onRevoke }) => {
  const { t, formatDate } = useTranslation();
  const { device, browser, icon: Icon } = describeUserAgent(
    session.userAgent,
    t('account.sessions.unknownDevice'),
  );
  const isCurrent = Boolean(session.current);
  const stamp: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' };

  return (
    <li
      className={cn(
        'rounded-xl border p-3',
        isCurrent ? 'border-success/40 bg-success-soft/40' : 'border-line bg-surface-2',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-muted">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* The raw string stays reachable: it is the only thing that can
                settle "is that really my laptop?" when the parsed label is
                too coarse. */}
            <span
              className="truncate text-sm font-bold text-content"
              title={session.userAgent || undefined}
            >
              {device}
            </span>
            {isCurrent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-black text-success">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                {t('account.sessions.current')}
              </span>
            )}
          </div>

          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <div className="min-w-0">
              <dt className="text-subtle">{t('account.sessions.browser')}</dt>
              <dd className="truncate font-semibold text-content">{browser || device}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-subtle">{t('account.sessions.ip')}</dt>
              <dd className="truncate font-semibold text-content">
                {session.ip || t('account.sessions.unknownIp')}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-subtle">{t('account.sessions.started')}</dt>
              <dd className="font-semibold text-content">
                {formatDate(session.createdAt, stamp)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-subtle">{t('account.sessions.expires')}</dt>
              <dd className="font-semibold text-content">
                {formatDate(session.expiresAt, stamp)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {confirming ? (
        <div className="mt-3 space-y-2 rounded-xl border border-danger/30 bg-danger-soft p-3">
          <p className="text-xs font-bold text-danger">{t('account.sessions.revokeConfirm')}</p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="press flex-1 px-3 py-2 text-xs"
              onClick={onCancelRevoke}
            >
              {t('common.action.cancel')}
            </Button>
            <Button
              variant="danger"
              className="press flex-1 px-3 py-2 text-xs"
              onClick={onRevoke}
            >
              {t('common.action.confirm')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          fullWidth
          // Signing the current device out from a list of devices is the sign
          // out button in disguise, and pressing it here would look like the
          // list had failed rather than like you had left.
          disabled={isCurrent}
          title={isCurrent ? t('account.signOut.thisDevice') : undefined}
          className="press mt-3 px-3 py-2 text-xs"
          onClick={onAskRevoke}
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          {t('account.sessions.revoke')}
        </Button>
      )}
    </li>
  );
};

// ---------------------------------------------------------------------------
const MenuRow: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  isDanger?: boolean;
  onClick: () => void;
}> = ({
  icon: Icon,
  iconColor = 'text-content',
  iconBg = 'bg-surface-2',
  title,
  subtitle,
  badge,
  isDanger = false,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="press flex w-full items-center justify-between gap-3 p-3.5 sm:p-4 text-left transition-colors hover:bg-surface-2"
  >
    <div className="flex items-center gap-3.5 min-w-0">
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line/40',
          iconBg,
        )}
      >
        <Icon className={cn('h-5 w-5', iconColor)} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div
          className={cn(
            'text-sm font-bold truncate',
            isDanger ? 'text-danger' : 'text-content',
          )}
        >
          {title}
        </div>
        {subtitle && (
          <div className="truncate text-xs text-muted mt-0.5">{subtitle}</div>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {badge}
      <ChevronRight className="h-4 w-4 text-muted/60" aria-hidden="true" />
    </div>
  </button>
);

// ---------------------------------------------------------------------------
export const ProfilePage: React.FC = () => {
  const { t, formatDate, formatNumber } = useTranslation();
  const { messageFor } = useAuthErrors();
  const { preference } = useTheme();
  const haptics = useHaptics();

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

  // Seeded from the account and re-seeded whenever the server's copy changes,
  // so switching to AGENT (which clears the field server-side) or saving does
  // not leave the input showing a value that is no longer stored.
  const [agency, setAgency] = useState(currentUser.agencyName ?? '');
  const [agencyBusy, setAgencyBusy] = useState(false);
  useEffect(() => {
    setAgency(currentUser.agencyName ?? '');
  }, [currentUser.agencyName]);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

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
    setConfirmRevokeId(null);
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
      <div className="gutter-safe mx-auto max-w-md space-y-4 py-16 text-center">
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

  const handleSaveAgency = async () => {
    if (agencyBusy) return;
    setAgencyBusy(true);
    try {
      const updated = await AuthApi.updateProfile({ agencyName: agency.trim() });
      useAppStore.setState({ currentUser: updated });
      pushToast('account.role.agencySaved', 'success');
    } catch {
      pushToast('account.role.agencyFailed', 'error');
    } finally {
      setAgencyBusy(false);
    }
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
      const reissued = await AuthApi.changePassword(
        currentPassword,
        newPassword,
        confirmPassword,
      );
      // The change is done the moment that call resolves. Everything below is
      // about keeping this device signed in, so the outcome is reported here
      // and never downgraded to a failure by a later step.
      pushToast('auth.changePassword.success', 'success');
      setPasswordOpen(false);

      // The server revokes *every* session, this one included: it bumps the
      // account's token version, which kills the access token, and drops all
      // the refresh families, which kills the renewal. Unless it handed back a
      // replacement pair, this device has to earn one — with the password we
      // are still holding — before any authenticated call runs. Without that
      // the very next request (the session list below, or App's unread-chat
      // poll fifteen seconds later) 401s, the refresh is rejected too, and the
      // user is thrown out of the page seconds after a successful change and
      // asked to sign in with the password they just set.
      let session = reissued;
      if (!session) {
        try {
          session = await AuthApi.login(currentUser.phone, newPassword);
        } catch {
          session = null;
        }
      }

      if (session) {
        useAppStore.setState({ currentUser: session });
        // Other devices were just revoked — show the list the server now has.
        void loadSessions();
      } else {
        // No live token left on this device. Ending the session here, with the
        // reason said out loud, beats letting a background poll discover it and
        // fire the same sign-out as a surprise.
        await logout();
        setShowAuth(true, 'LOGIN');
        pushToast('layout.toast.sessionExpired', 'warning');
      }
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

  const handleRevokeSession = async (session: AuthSession) => {
    const index = sessions.findIndex((row) => row.id === session.id);
    if (index < 0) return;

    setConfirmRevokeId(null);
    // Optimistic, because a security action that waits on the network reads as
    // "nothing happened" and gets pressed a second time. The row is put back
    // at its old position if the server disagrees, so a failure never quietly
    // leaves a device the user believes is gone.
    setSessions((rows) => rows.filter((row) => row.id !== session.id));

    try {
      await AuthApi.revokeSession(session.id);
      haptics.success();
      pushToast('account.sessions.revoked', 'success');
    } catch {
      setSessions((rows) => {
        const restored = rows.slice();
        restored.splice(Math.min(index, restored.length), 0, session);
        return restored;
      });
      haptics.warn();
      pushToast('account.sessions.revokeFailed', 'error');
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

  type MobileProfileSection =
    | 'profile'
    | 'verification'
    | 'role'
    | 'preferences'
    | 'security'
    | 'sessions'
    | 'signOut'
    | null;

  const [activeMobileSection, setActiveMobileSection] = useState<MobileProfileSection>(null);

  // -- Shared Section Content Renderers -------------------------------------
  const renderProfileContent = () => (
    <div className="space-y-4">
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
          className="press"
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
      </div>
    </div>
  );

  const renderRoleContent = () => (
    <div className="space-y-4">
      {!isSwitchableRole(currentUser.role) ? (
        <div className="rounded-xl border border-brand/30 bg-brand-soft p-3">
          <p className="flex items-center gap-2 text-xs font-black text-brand-text">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {t('account.role.granted.title')}
          </p>
          <p className="mt-1 text-[11px] font-medium text-muted">
            {t('account.role.granted.description', {
              role: t(roleLabelKey(currentUser.role)),
            })}
          </p>
        </div>
      ) : (
        <div
          role="radiogroup"
          aria-label={t('account.role.title')}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {(
            [
              { value: 'OWNER', icon: Home, titleKey: 'account.role.owner.title', descriptionKey: 'account.role.owner.description' },
              { value: 'AGENT', icon: Briefcase, titleKey: 'account.role.agent.title', descriptionKey: 'account.role.agent.description' },
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
                className={cn(
                  'press min-h-11 rounded-xl border p-3 text-left transition-all',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  active
                    ? 'border-brand bg-brand-soft text-brand-text shadow-card'
                    : 'border-line bg-surface-2 text-muted hover:bg-surface-3 hover:text-content',
                )}
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
      )}

      {currentUser.role === 'AGENT' && (
        <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
          <div>
            <p className="text-xs font-black text-content">
              {t('account.role.agencyTitle')}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {t('account.role.agencySubtitle')}
            </p>
          </div>
          <Field label={t('account.role.agencyLabel')} hint={t('account.role.agencyHint')}>
            {({ id, describedBy }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                autoComplete="organization"
                value={agency}
                onChange={(event) => setAgency(event.target.value)}
                placeholder={t('account.role.agencyPlaceholder')}
                icon={<Briefcase className="h-4 w-4" />}
              />
            )}
          </Field>
          <Button
            variant="secondary"
            fullWidth
            loading={agencyBusy}
            disabled={agency.trim() === (currentUser.agencyName ?? '').trim()}
            onClick={() => void handleSaveAgency()}
            className="px-4 py-2.5 text-xs"
          >
            {t('common.action.save')}
          </Button>
        </div>
      )}

      {isOwner && (
        <Button
          fullWidth
          className="press"
          onClick={() => {
            setActiveMobileSection(null);
            setCurrentView('CREATE_LISTING');
          }}
        >
          {t('account.role.createListing')}
        </Button>
      )}
    </div>
  );

  const renderPreferencesContent = () => (
    <div className="space-y-4">
      <div className="flex min-h-11 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-bold text-content">
            <Globe className="h-4 w-4 text-muted" aria-hidden="true" />
            {t('common.language.label')}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {t('account.preferences.languageHint')}
          </p>
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
    </div>
  );

  const renderSecurityContent = () => (
    <div className="space-y-4">
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
        <Button
          variant="secondary"
          fullWidth
          className="press"
          onClick={() => setPasswordOpen(true)}
        >
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
              className="press flex-1"
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
            <Button type="submit" className="press flex-1" loading={passwordBusy}>
              {t('auth.changePassword.submit')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );

  const renderSessionsContent = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-subtle">
          {sessions.length > 0
            ? t('account.sessions.count', { count: sessions.length })
            : t('account.sessions.subtitle')}
        </p>
        <button
          type="button"
          onClick={() => void loadSessions()}
          disabled={sessionsLoading}
          aria-label={t('account.sessions.reload')}
          title={t('account.sessions.reload')}
          className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-colors hover:border-brand hover:text-content disabled:opacity-60"
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', sessionsLoading && 'animate-spin')}
            aria-hidden="true"
          />
        </button>
      </div>

      {sessionsLoading ? (
        <div
          className="space-y-2"
          aria-busy="true"
          aria-label={t('common.a11y.loading')}
        >
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-28 animate-shimmer rounded-xl" aria-hidden="true" />
          ))}
        </div>
      ) : sessionsError ? (
        <div className="space-y-3">
          <FormError message={t('account.sessions.loadError')} />
          <p className="text-xs text-subtle">{sessionsError}</p>
          <Button
            variant="secondary"
            fullWidth
            className="press"
            onClick={() => void loadSessions()}
          >
            {t('common.action.retry')}
          </Button>
        </div>
      ) : sessions.length === 0 ? (
        <CardEmpty
          icon={Monitor}
          title={t('account.sessions.empty')}
          className="border-line bg-surface-2 px-4 py-8 shadow-none"
        />
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              confirming={confirmRevokeId === session.id}
              onAskRevoke={() => {
                haptics.tap();
                setConfirmRevokeId(session.id);
              }}
              onCancelRevoke={() => setConfirmRevokeId(null)}
              onRevoke={() => void handleRevokeSession(session)}
            />
          ))}
        </ul>
      )}
    </div>
  );

  const renderSignOutContent = () => (
    <div className="space-y-4">
      <Button
        variant="secondary"
        fullWidth
        className="press"
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
            <p className="text-xs font-bold text-danger">
              {t('account.signOut.confirmAll')}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="press flex-1"
                onClick={() => setConfirmSignOutAll(false)}
              >
                {t('common.action.cancel')}
              </Button>
              <Button
                variant="danger"
                className="press flex-1"
                loading={signOutBusy}
                onClick={() => void handleSignOut(true)}
              >
                {t('common.action.confirm')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            fullWidth
            className="press text-danger hover:bg-danger-soft/50"
            onClick={() => setConfirmSignOutAll(true)}
          >
            {t('account.signOut.allDevices')}
          </Button>
        )}
      </div>
    </div>
  );

  const renderVerificationContent = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold',
            currentUser.isVerified
              ? 'bg-success-soft text-success'
              : 'bg-warning-soft text-warning',
          )}
        >
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          {currentUser.isVerified
            ? t('account.profile.verified')
            : t('account.profile.notVerified')}
        </span>
      </div>

      <div className="space-y-3 text-sm">
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

      {!currentUser.isVerified && (
        <Button
          variant="secondary"
          fullWidth
          className="press"
          onClick={() => {
            setActiveMobileSection(null);
            setCurrentView('VERIFICATION');
          }}
        >
          {t('account.profile.verify')}
        </Button>
      )}
    </div>
  );

  const renderAvatarCardContent = () => (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={avatarBusy}
          aria-label={t('account.profile.avatarChange')}
          aria-busy={avatarBusy || undefined}
          className="press relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-brand/30 bg-surface-2 transition-opacity disabled:opacity-60"
        >
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={t('account.profile.avatarAlt', { name: currentUser.name })}
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className={cn(
                'flex h-full w-full items-center justify-center',
                isOwner ? 'bg-brand text-on-brand' : 'bg-info text-white',
              )}
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

        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-base font-black text-content">{currentUser.name}</p>
          <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand-text">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {isOwner
              ? t('account.profile.badgeOwner')
              : t('account.profile.badgeStudent')}
          </span>
          <p className="text-xs text-subtle">
            {isOwner
              ? t('account.profile.captionOwner')
              : t('account.profile.captionStudent')}
          </p>
        </div>
      </div>

      <p className="text-xs text-subtle">
        {t('account.profile.avatarHint', { size: MAX_AVATAR_MB })}
      </p>

      <FormError message={avatarError} />
    </>
  );

  // -- Render ---------------------------------------------------------------
  return (
    // The bottom pad clears the fixed bottom nav, which only exists below lg.
    <div className="gutter-safe mx-auto w-full max-w-6xl py-6 pb-28 lg:pb-12">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePickAvatar}
      />

      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-black text-content">{t('account.page.title')}</h1>
        <p className="text-sm text-muted">{t('account.page.subtitle')}</p>
      </header>

      {/* =================================================================== */}
      {/* Mobile View (< lg): Native-like grouped menu & bottom sheets        */}
      {/* =================================================================== */}
      <div className="space-y-4 lg:hidden">
        {/* -- Header Identity Card -- */}
        <Card padding="none" className="p-4 space-y-3.5">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarBusy}
              aria-label={t('account.profile.avatarChange')}
              aria-busy={avatarBusy || undefined}
              className="press relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-brand/30 bg-surface-2 transition-opacity disabled:opacity-60"
            >
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={t('account.profile.avatarAlt', { name: currentUser.name })}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span
                  className={cn(
                    'flex h-full w-full items-center justify-center',
                    isOwner ? 'bg-brand text-on-brand' : 'bg-info text-white',
                  )}
                >
                  {isOwner ? (
                    <Home className="h-7 w-7" aria-hidden="true" />
                  ) : (
                    <GraduationCap className="h-7 w-7" aria-hidden="true" />
                  )}
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/60 py-0.5 text-[9px] font-bold text-white">
                <Camera className="h-2.5 w-2.5" aria-hidden="true" />
                {t('account.profile.avatarBadge')}
              </span>
            </button>

            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-lg font-black text-content">{currentUser.name}</p>
              <p className="text-xs font-semibold text-muted">{currentUser.phone}</p>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-text">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {isOwner
                    ? t('account.profile.badgeOwner')
                    : t('account.profile.badgeStudent')}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
                    currentUser.isVerified
                      ? 'bg-success-soft text-success'
                      : 'bg-warning-soft text-warning',
                  )}
                >
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {currentUser.isVerified
                    ? t('account.profile.verified')
                    : t('account.profile.notVerified')}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stats Pill Row */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-surface-2 p-2.5 text-center">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-subtle">{t('account.profile.trustScore')}</div>
              <div className="text-xs font-black text-content">{formatNumber(currentUser.trustScore)}</div>
            </div>
            <div className="min-w-0 border-x border-line">
              <div className="text-[10px] font-semibold text-subtle">{t('account.profile.xpPoints')}</div>
              <div className="flex items-center justify-center gap-1 text-xs font-black text-warning">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                <span>{formatNumber(currentUser.xpPoints)}</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-subtle">{t('account.profile.verificationLevel')}</div>
              <div className="text-xs font-black text-content">
                {t('common.badge.verificationLevel', { level: currentUser.verificationLevel })}
              </div>
            </div>
          </div>

          <FormError message={avatarError} />
        </Card>

        {/* Quick listing create action */}
        {isOwner && (
          <Button
            fullWidth
            className="press shadow-sm"
            onClick={() => setCurrentView('CREATE_LISTING')}
          >
            {t('account.role.createListing')}
          </Button>
        )}

        {/* Group 1: Profil va Shaxsiyat */}
        <Card padding="none" className="overflow-hidden divide-y divide-line">
          <MenuRow
            icon={UserCog}
            iconColor="text-brand-text"
            iconBg="bg-brand-soft"
            title={t('account.profile.title')}
            subtitle={`${currentUser.name} • ${currentUser.phone}`}
            onClick={() => {
              haptics.tap();
              setActiveMobileSection('profile');
            }}
          />
          <MenuRow
            icon={ShieldCheck}
            iconColor="text-success"
            iconBg="bg-success-soft"
            title={t('account.profile.verificationLevel')}
            subtitle={`${t('account.profile.trustScore')}: ${formatNumber(currentUser.trustScore)}`}
            badge={
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black',
                  currentUser.isVerified
                    ? 'bg-success-soft text-success'
                    : 'bg-warning-soft text-warning',
                )}
              >
                {currentUser.isVerified ? t('account.profile.verified') : t('account.profile.notVerified')}
              </span>
            }
            onClick={() => {
              haptics.tap();
              setActiveMobileSection('verification');
            }}
          />
          <MenuRow
            icon={currentUser.role === 'OWNER' ? Home : currentUser.role === 'AGENT' ? Briefcase : GraduationCap}
            iconColor="text-info"
            iconBg="bg-info-soft"
            title={t('account.role.title')}
            subtitle={
              currentUser.agencyName
                ? `${t(roleLabelKey(currentUser.role))} • ${currentUser.agencyName}`
                : t(roleLabelKey(currentUser.role))
            }
            onClick={() => {
              haptics.tap();
              setActiveMobileSection('role');
            }}
          />
        </Card>

        {/* Group 2: Sozlamalar va Xavfsizlik */}
        <Card padding="none" className="overflow-hidden divide-y divide-line">
          <MenuRow
            icon={Palette}
            iconColor="text-purple-500"
            iconBg="bg-purple-500/10"
            title={t('account.preferences.title')}
            subtitle={`${t('common.language.label')}, ${t('common.theme.label')}`}
            onClick={() => {
              haptics.tap();
              setActiveMobileSection('preferences');
            }}
          />
          <MenuRow
            icon={KeyRound}
            iconColor="text-amber-500"
            iconBg="bg-amber-500/10"
            title={t('account.security.title')}
            subtitle={t('account.security.passwordTitle')}
            onClick={() => {
              haptics.tap();
              setActiveMobileSection('security');
            }}
          />
          <MenuRow
            icon={Monitor}
            iconColor="text-cyan-500"
            iconBg="bg-cyan-500/10"
            title={t('account.sessions.title')}
            subtitle={t('account.sessions.subtitle')}
            badge={
              sessions.length > 0 ? (
                <span className="inline-flex items-center rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-muted">
                  {sessions.length}
                </span>
              ) : undefined
            }
            onClick={() => {
              haptics.tap();
              setActiveMobileSection('sessions');
            }}
          />
        </Card>

        {/* Group 3: Chiqish */}
        <Card padding="none" className="overflow-hidden">
          <MenuRow
            icon={LogOut}
            iconColor="text-danger"
            iconBg="bg-danger-soft"
            title={t('account.signOut.title')}
            subtitle={t('account.signOut.allDevicesHint')}
            isDanger
            onClick={() => {
              haptics.tap();
              setActiveMobileSection('signOut');
            }}
          />
        </Card>
      </div>

      {/* Mobile Bottom Sheets */}
      <Sheet
        open={activeMobileSection === 'profile'}
        onClose={() => setActiveMobileSection(null)}
        title={t('account.profile.title')}
        description={t('account.page.subtitle')}
      >
        <div className="p-4 sm:p-6">{renderProfileContent()}</div>
      </Sheet>

      <Sheet
        open={activeMobileSection === 'verification'}
        onClose={() => setActiveMobileSection(null)}
        title={t('account.profile.verificationLevel')}
      >
        <div className="p-4 sm:p-6">{renderVerificationContent()}</div>
      </Sheet>

      <Sheet
        open={activeMobileSection === 'role'}
        onClose={() => setActiveMobileSection(null)}
        title={t('account.role.title')}
        description={t('account.role.subtitle')}
      >
        <div className="p-4 sm:p-6">{renderRoleContent()}</div>
      </Sheet>

      <Sheet
        open={activeMobileSection === 'preferences'}
        onClose={() => setActiveMobileSection(null)}
        title={t('account.preferences.title')}
      >
        <div className="p-4 sm:p-6">{renderPreferencesContent()}</div>
      </Sheet>

      <Sheet
        open={activeMobileSection === 'security'}
        onClose={() => setActiveMobileSection(null)}
        title={t('account.security.title')}
        description={t('account.security.passwordDescription')}
      >
        <div className="p-4 sm:p-6">{renderSecurityContent()}</div>
      </Sheet>

      <Sheet
        open={activeMobileSection === 'sessions'}
        onClose={() => setActiveMobileSection(null)}
        title={t('account.sessions.title')}
        description={t('account.sessions.subtitle')}
      >
        <div className="p-4 sm:p-6">{renderSessionsContent()}</div>
      </Sheet>

      <Sheet
        open={activeMobileSection === 'signOut'}
        onClose={() => setActiveMobileSection(null)}
        title={t('account.signOut.title')}
      >
        <div className="p-4 sm:p-6">{renderSignOutContent()}</div>
      </Sheet>

      {/* =================================================================== */}
      {/* Desktop View (lg:grid): Two-column layout                           */}
      {/* =================================================================== */}
      <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-8 gap-6">
        {/* -- Main column: everything that can be edited ------------------ */}
        <div className="order-2 space-y-6 lg:order-1">
          {/* -- Profile fields ------------------------------------------- */}
          <SectionCard
            title={t('account.profile.title')}
            icon={UserCog}
            padding="none"
            className={CARD_PADDING}
          >
            {renderProfileContent()}
          </SectionCard>

          {/* -- Role ------------------------------------------------------ */}
          <SectionCard
            title={t('account.role.title')}
            description={t('account.role.subtitle')}
            icon={UserCog}
            padding="none"
            className={CARD_PADDING}
          >
            {renderRoleContent()}
          </SectionCard>

          {/* -- Preferences ----------------------------------------------- */}
          <SectionCard
            title={t('account.preferences.title')}
            icon={Palette}
            padding="none"
            className={CARD_PADDING}
          >
            {renderPreferencesContent()}
          </SectionCard>

          {/* -- Security --------------------------------------------------- */}
          <SectionCard
            title={t('account.security.title')}
            icon={KeyRound}
            padding="none"
            className={CARD_PADDING}
          >
            {renderSecurityContent()}
          </SectionCard>

          {/* -- Sessions --------------------------------------------------- */}
          <SectionCard
            title={t('account.sessions.title')}
            description={t('account.sessions.subtitle')}
            icon={Monitor}
            padding="none"
            className={CARD_PADDING}
            action={
              <button
                type="button"
                onClick={() => void loadSessions()}
                disabled={sessionsLoading}
                aria-label={t('account.sessions.reload')}
                title={t('account.sessions.reload')}
                className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-colors hover:border-brand hover:text-content disabled:opacity-60"
              >
                <RefreshCw
                  className={cn('h-4 w-4', sessionsLoading && 'animate-spin')}
                  aria-hidden="true"
                />
              </button>
            }
          >
            {renderSessionsContent()}
          </SectionCard>

          {/* -- Sign out --------------------------------------------------- */}
          <SectionCard
            title={t('account.signOut.title')}
            icon={LogOut}
            padding="none"
            className={CARD_PADDING}
          >
            {renderSignOutContent()}
          </SectionCard>
        </div>

        {/* -- Rail: who you are, which does not change while you edit ------ */}
        <aside className="order-1 space-y-6 lg:order-2 lg:sticky lg:top-24 lg:self-start">
          <Card padding="none" className={cn(CARD_PADDING, 'space-y-4')}>
            {renderAvatarCardContent()}
          </Card>

          <SectionCard
            title={t('account.profile.verificationLevel')}
            icon={ShieldCheck}
            padding="none"
            className={CARD_PADDING}
          >
            {renderVerificationContent()}
          </SectionCard>
        </aside>
      </div>
    </div>
  );
};

export default ProfilePage;
