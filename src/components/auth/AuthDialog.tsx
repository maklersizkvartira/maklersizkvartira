/**
 * The complete authentication flow.
 *
 *   LOGIN     phone + password
 *   REGISTER  role -> name + phone + password + confirm  -> SMS
 *   VERIFY    6-digit code -> account created, signed in
 *   FORGOT    phone -> SMS
 *   RESET     code + new password
 *
 * Registration deliberately creates nothing until the code is confirmed, so
 * an abandoned signup never squats on somebody else's phone number.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Home,
  KeyRound,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';

import {
  getGoogleIdToken,
  isGoogleAuthConfigured,
  isPopupClosed,
  preloadGoogleAuth,
} from '../../config/firebase';
import { useTranslation } from '../../i18n';
import { AuthApi, type ApiUser } from '../../services/authApi';
import { ApiError } from '../../services/http';
import { useAppStore } from '../../stores/useAppStore';
import { Logo } from '../brand/Logo';
import { CodeInput } from './CodeInput';
import { WelcomeCelebration } from './WelcomeCelebration';
import { useAuthErrors } from './useAuthErrors';
import {
  Button,
  Field,
  FormError,
  PasswordInput,
  PasswordStrength,
  TextInput,
} from '../ui/Field';

type Step = 'LOGIN' | 'ROLE' | 'REGISTER' | 'VERIFY' | 'FORGOT' | 'RESET' | 'DONE';
type SignupRole = 'STUDENT' | 'OWNER';

const PHONE_PREFIX = '+998 ';

/** Formats keystrokes as `+998 90 123 45 67` while keeping the caret sane. */
function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^998/, '').slice(0, 9);
  if (!digits) return PHONE_PREFIX;
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return PHONE_PREFIX + parts.filter(Boolean).join(' ');
}

function phoneDigits(formatted: string): string {
  return formatted.replace(/\D/g, '');
}

function isPhoneComplete(formatted: string): boolean {
  return phoneDigits(formatted).replace(/^998/, '').length === 9;
}

/** Mirrors the server's scoring so the meter moves without a round-trip. */
function scorePassword(password: string): number {
  if (!password) return 0;
  let score = Math.min(password.length * 4, 40);
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 15;
  if (/\d/.test(password)) score += 15;
  if (/[^\w\s]/.test(password)) score += 20;
  if (new Set(password).size < password.length / 2) score -= 15;
  return Math.max(0, Math.min(100, score));
}

const GoogleButton: React.FC<{
  busy: boolean;
  label: string;
  onClick: () => void;
}> = ({ busy, label, onClick }) => (
  <button
    type="button"
    disabled={busy}
    onClick={onClick}
    className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3.5 text-sm font-bold text-content transition-colors hover:bg-surface-2 disabled:opacity-60"
  >
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
    {label}
  </button>
);

export const AuthDialog: React.FC = () => {
  const { t } = useTranslation();
  const { messageFor, fieldFor } = useAuthErrors();
  const showAuth = useAppStore((state) => state.showAuth);
  const authModalTab = useAppStore((state) => state.authModalTab);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const login = useAppStore((state) => state.login);

  const [step, setStep] = useState<Step>('LOGIN');
  const [role, setRole] = useState<SignupRole | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(PHONE_PREFIX);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [resendIn, setResendIn] = useState(0);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [signedInUser, setSignedInUser] = useState<ApiUser | null>(null);
  const [celebrateName, setCelebrateName] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (successTimer.current) {
      clearTimeout(successTimer.current);
      successTimer.current = null;
    }
    setRole(null);
    setName('');
    setPhone(PHONE_PREFIX);
    setPassword('');
    setConfirmPassword('');
    setCode('');
    setError(null);
    setFieldError(undefined);
    setResendIn(0);
    setDevCode(null);
    setSignedInUser(null);
  }, []);

  const close = useCallback(() => {
    setShowAuth(false);
    reset();
  }, [setShowAuth, reset]);

  useEffect(() => {
    // The Firebase SDK is a lazy chunk now, so start fetching it as the
    // dialog opens: the download overlaps with the user reading the form
    // instead of beginning after they press the Google button.
    if (showAuth) preloadGoogleAuth();
    if (showAuth) {
      setStep(authModalTab === 'REGISTER' ? 'ROLE' : 'LOGIN');
      reset();
    }
  }, [showAuth, authModalTab, reset]);

  // Resend cooldown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // Focus management: trap Tab inside the dialog, restore focus on close.
  useEffect(() => {
    if (!showAuth) return;
    previouslyFocused.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      (previouslyFocused.current as HTMLElement | null)?.focus?.();
    };
  }, [showAuth, close]);

  if (!showAuth) return null;

  const fail = (caught: unknown) => {
    setError(messageFor(caught));
    // Always overwrite: leaving a previous field name set would keep routing
    // the message to a field that is no longer on screen, and the banner --
    // which only renders when no field owns the error -- would stay silent.
    setFieldError(fieldFor(caught));
    if (caught instanceof ApiError && caught.code === 'otp_invalid') setCode('');
  };

  const succeed = (user: ApiUser, celebrate = false) => {
    setSignedInUser(user);
    setStep('DONE');
    login(user);

    // Signing in is routine and the dialog should get out of the way. Joining
    // happens once, so it gets the welcome instead of a 1.8-second checkmark
    // — and the dialog stays open underneath until that has been dismissed.
    if (celebrate) {
      setCelebrateName(user.name);
      return;
    }
    // Tracked so a reopened dialog is not closed by the previous run's timer.
    successTimer.current = setTimeout(close, 1800);
  };

  // -- Handlers -------------------------------------------------------------
  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldError(undefined);

    if (!isPhoneComplete(phone)) {
      setError(t('auth.errors.phoneInvalid'));
      setFieldError('phone');
      return;
    }
    if (!password) {
      setError(t('auth.errors.passwordRequired'));
      setFieldError('password');
      return;
    }

    setBusy(true);
    try {
      succeed(await AuthApi.login(phoneDigits(phone), password));
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldError(undefined);

    if (name.trim().length < 2) {
      setError(t('auth.errors.nameTooShort'));
      setFieldError('name');
      return;
    }
    if (/\d/.test(name)) {
      setError(t('auth.errors.nameHasDigits'));
      setFieldError('name');
      return;
    }
    if (!isPhoneComplete(phone)) {
      setError(t('auth.errors.phoneInvalid'));
      setFieldError('phone');
      return;
    }
    if (password.length < 8) {
      setError(t('auth.errors.passwordTooShort', { min: 8 }));
      setFieldError('password');
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.errors.passwordMismatch'));
      setFieldError('confirmPassword');
      return;
    }

    setBusy(true);
    try {
      const pending = await AuthApi.register({
        name: name.trim(),
        phone: phoneDigits(phone),
        password,
        confirmPassword,
        role: role ?? 'STUDENT',
        language: useAppStore.getState().language,
      });
      setMaskedPhone(pending.phone);
      setResendIn(pending.resendAfter);
      setDevCode(pending.debugCode ?? null);
      setStep('VERIFY');
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (submittedCode?: string) => {
    const value = submittedCode ?? code;
    if (value.length < 6) {
      setError(t('auth.errors.codeIncomplete'));
      setFieldError(undefined);
      return;
    }
    setError(null);
    setFieldError(undefined);
    setBusy(true);
    try {
      succeed(await AuthApi.verifyCode(phoneDigits(phone), value), true);
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setError(null);
    setFieldError(undefined);
    setBusy(true);
    try {
      // The reset step consumes a PASSWORD_RESET code; asking for a REGISTER
      // one here produced a code the verify call would always reject.
      const pending = await AuthApi.resendCode(
        phoneDigits(phone),
        step === 'RESET' ? 'PASSWORD_RESET' : 'REGISTER',
      );
      setResendIn(pending.resendAfter);
      setDevCode(pending.debugCode ?? null);
      setCode('');
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      const idToken = await getGoogleIdToken();
      succeed(
        await AuthApi.loginWithGoogle(
          idToken,
          role ?? 'STUDENT',
          useAppStore.getState().language,
        ),
      );
    } catch (caught) {
      // Closing the popup is a normal user action, not an error worth showing.
      if (!isPopupClosed(caught)) fail(caught);
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isPhoneComplete(phone)) {
      setError(t('auth.errors.phoneInvalid'));
      setFieldError('phone');
      return;
    }
    setBusy(true);
    try {
      const pending = await AuthApi.forgotPassword(phoneDigits(phone));
      setMaskedPhone(pending.phone);
      setResendIn(pending.resendAfter);
      setDevCode(pending.debugCode ?? null);
      setStep('RESET');
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (code.length < 6) {
      setError(t('auth.errors.codeIncomplete'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.errors.passwordMismatch'));
      setFieldError('confirmPassword');
      return;
    }
    setBusy(true);
    try {
      await AuthApi.resetPassword(phoneDigits(phone), code, password, confirmPassword);
      succeed(await AuthApi.login(phoneDigits(phone), password));
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  };

  // -- Shared pieces --------------------------------------------------------
  const phoneField = (
    <Field
      label={t('auth.fields.phone')}
      hint={step === 'REGISTER' ? t('auth.fields.phoneHint') : undefined}
      error={fieldError === 'phone' ? error ?? undefined : undefined}
      required
    >
      {({ id, describedBy, invalid }) => (
        <TextInput
          id={id}
          aria-describedby={describedBy}
          invalid={invalid}
          valid={isPhoneComplete(phone)}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(formatPhone(event.target.value))}
          onFocus={() => {
            if (!phone.trim()) setPhone(PHONE_PREFIX);
          }}
          placeholder={t('auth.fields.phonePlaceholder')}
          icon={<Smartphone className="h-4 w-4" />}
        />
      )}
    </Field>
  );

  const header = (title: string, subtitle: string, onBack?: () => void) => (
    <div className="mb-6 space-y-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 inline-flex items-center gap-1 rounded-lg px-1 py-1 text-xs font-bold text-brand-text transition-colors hover:bg-brand-soft"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {t('common.action.back')}
        </button>
      )}
      <h2 id="auth-dialog-title" className="text-2xl font-black tracking-tight text-content">
        {title}
      </h2>
      <p className="text-sm text-muted">{subtitle}</p>
    </div>
  );

  // -- Steps ----------------------------------------------------------------
  const renderStep = () => {
    switch (step) {
      case 'LOGIN':
        return (
          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            {header(t('auth.login.title'), t('auth.login.subtitle'))}
            {phoneField}
            <Field
              label={t('auth.fields.password')}
              error={fieldError === 'password' ? error ?? undefined : undefined}
              required
            >
              {({ id, describedBy, invalid }) => (
                <PasswordInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('auth.fields.passwordPlaceholder')}
                />
              )}
            </Field>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setStep('FORGOT');
                  setError(null);
                }}
                className="text-xs font-bold text-brand-text hover:underline"
              >
                {t('auth.login.forgotPassword')}
              </button>
            </div>

            {!fieldError && <FormError message={error} />}

            <Button type="submit" loading={busy} fullWidth>
              {busy ? t('auth.login.submitting') : t('auth.login.submit')}
            </Button>

            {isGoogleAuthConfigured && (
              <>
                <div className="relative py-1 text-center">
                  <span className="absolute inset-0 flex items-center" aria-hidden="true">
                    <span className="w-full border-t border-line" />
                  </span>
                  <span className="relative bg-surface px-3 text-[11px] font-bold uppercase text-subtle">
                    {t('auth.login.orDivider')}
                  </span>
                </div>
                <GoogleButton
                  busy={busy}
                  label={t('auth.login.withGoogle')}
                  onClick={handleGoogle}
                />
              </>
            )}

            <p className="text-center text-xs text-muted">
              {t('auth.login.noAccount')}{' '}
              <button
                type="button"
                onClick={() => {
                  setStep('ROLE');
                  setError(null);
                }}
                className="font-bold text-brand-text hover:underline"
              >
                {t('auth.login.createOne')}
              </button>
            </p>
          </form>
        );

      case 'ROLE':
        return (
          <div className="space-y-3">
            {header(t('auth.register.title'), t('auth.role.question'))}
            {(
              [
                {
                  value: 'OWNER' as const,
                  icon: Home,
                  title: t('auth.role.owner.title'),
                  description: t('auth.role.owner.description'),
                },
                {
                  value: 'STUDENT' as const,
                  icon: Search,
                  title: t('auth.role.student.title'),
                  description: t('auth.role.student.description'),
                },
              ]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setRole(option.value);
                  setStep('REGISTER');
                }}
                className="w-full rounded-2xl border-2 border-line bg-surface p-4 text-left transition-all hover:border-brand hover:bg-brand-soft active:scale-[0.99]"
              >
                <div className="flex items-center gap-3.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft-2 text-brand-text">
                    <option.icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-base font-black text-content">
                      {option.title}
                    </span>
                    <span className="block text-xs text-muted">{option.description}</span>
                  </span>
                </div>
              </button>
            ))}
            <p className="pt-1 text-center text-xs text-subtle">{t('auth.role.hint')}</p>
            <p className="text-center text-xs text-muted">
              {t('auth.register.haveAccount')}{' '}
              <button
                type="button"
                onClick={() => setStep('LOGIN')}
                className="font-bold text-brand-text hover:underline"
              >
                {t('auth.register.signInInstead')}
              </button>
            </p>
          </div>
        );

      case 'REGISTER':
        return (
          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            {header(t('auth.register.title'), t('auth.register.subtitle'), () => setStep('ROLE'))}

            <div className="flex items-center justify-between rounded-xl border border-brand/25 bg-brand-soft px-3.5 py-2.5">
              <span className="text-xs font-bold text-brand-text">
                {t('auth.role.selected', {
                  role: role === 'OWNER' ? t('common.role.owner') : t('common.role.student'),
                })}
              </span>
              <button
                type="button"
                onClick={() => setStep('ROLE')}
                className="text-xs font-bold text-brand-text underline"
              >
                {t('auth.role.change')}
              </button>
            </div>

            <Field
              label={t('auth.fields.name')}
              hint={t('auth.fields.nameHint')}
              error={fieldError === 'name' ? error ?? undefined : undefined}
              required
            >
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('auth.fields.namePlaceholder')}
                />
              )}
            </Field>

            {phoneField}

            <Field
              label={t('auth.fields.password')}
              error={fieldError === 'password' ? error ?? undefined : undefined}
              required
            >
              {({ id, describedBy, invalid }) => (
                <PasswordInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('auth.fields.passwordPlaceholder')}
                />
              )}
            </Field>

            {password && <PasswordStrength score={scorePassword(password)} />}

            <Field
              label={t('auth.fields.confirmPassword')}
              error={fieldError === 'confirmPassword' ? error ?? undefined : undefined}
              required
            >
              {({ id, describedBy, invalid }) => (
                <PasswordInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={t('auth.fields.confirmPlaceholder')}
                />
              )}
            </Field>

            {!fieldError && <FormError message={error} />}

            <Button type="submit" loading={busy} fullWidth>
              {busy ? t('auth.register.submitting') : t('auth.register.submit')}
            </Button>

            <p className="text-center text-[11px] leading-relaxed text-subtle">
              {t('auth.register.terms')}
            </p>
          </form>
        );

      case 'VERIFY':
      case 'RESET': {
        const isReset = step === 'RESET';
        return (
          <form
            onSubmit={isReset ? handleReset : (event) => {
              event.preventDefault();
              void handleVerify();
            }}
            className="space-y-5"
            noValidate
          >
            {header(
              isReset ? t('auth.reset.title') : t('auth.verify.title'),
              isReset
                ? t('auth.reset.subtitle')
                : t('auth.verify.subtitle', { phone: maskedPhone }),
              () => setStep(isReset ? 'FORGOT' : 'REGISTER'),
            )}

            <div className="flex justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
                <ShieldCheck className="h-7 w-7" aria-hidden="true" />
              </span>
            </div>

            <CodeInput
              label={t('auth.fields.code')}
              value={code}
              onChange={setCode}
              onComplete={isReset ? undefined : (value) => void handleVerify(value)}
              disabled={busy}
              invalid={Boolean(error)}
            />

            {devCode && (
              <p className="rounded-lg bg-warning-soft px-3 py-2 text-center text-xs font-bold text-warning">
                {t('auth.verify.devCode', { code: devCode })}
              </p>
            )}

            {isReset && (
              <>
                <Field label={t('auth.fields.newPassword')} required>
                  {({ id, describedBy }) => (
                    <PasswordInput
                      id={id}
                      aria-describedby={describedBy}
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={t('auth.fields.passwordPlaceholder')}
                    />
                  )}
                </Field>
                {password && <PasswordStrength score={scorePassword(password)} />}
                <Field
                  label={t('auth.fields.confirmPassword')}
                  error={fieldError === 'confirmPassword' ? error ?? undefined : undefined}
                  required
                >
                  {({ id, describedBy, invalid }) => (
                    <PasswordInput
                      id={id}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder={t('auth.fields.confirmPlaceholder')}
                    />
                  )}
                </Field>
              </>
            )}

            {!fieldError && <FormError message={error} />}

            <Button type="submit" loading={busy} fullWidth>
              {busy
                ? t('auth.verify.submitting')
                : isReset
                  ? t('auth.reset.submit')
                  : t('auth.verify.submit')}
            </Button>

            <div className="space-y-2 text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendIn > 0 || busy}
                className="text-xs font-bold text-brand-text hover:underline disabled:cursor-not-allowed disabled:text-subtle disabled:no-underline"
              >
                {resendIn > 0
                  ? t('auth.verify.resendIn', { seconds: resendIn })
                  : t('auth.verify.resend')}
              </button>
              <p className="text-[11px] text-subtle">{t('auth.verify.pasteHint')}</p>
            </div>
          </form>
        );
      }

      case 'FORGOT':
        return (
          <form onSubmit={handleForgot} className="space-y-4" noValidate>
            {header(t('auth.forgot.title'), t('auth.forgot.subtitle'), () => setStep('LOGIN'))}
            <div className="flex justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
                <KeyRound className="h-7 w-7" aria-hidden="true" />
              </span>
            </div>
            {phoneField}
            {!fieldError && <FormError message={error} />}
            <Button type="submit" loading={busy} fullWidth>
              {t('auth.forgot.submit')}
            </Button>
            <button
              type="button"
              onClick={() => setStep('LOGIN')}
              className="w-full text-center text-xs font-bold text-brand-text hover:underline"
            >
              {t('auth.forgot.backToLogin')}
            </button>
          </form>
        );

      case 'DONE':
        return (
          <div className="space-y-4 px-2 py-8 text-center">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-brand/40 bg-brand-soft-2 text-brand">
                <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
              </span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-extrabold text-brand-text">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {t('auth.success.badge')}
            </span>
            <h3 className="text-xl font-black text-content">
              {t('auth.success.registered', { name: signedInUser?.name ?? '' })}
            </h3>
            <p className="mx-auto max-w-xs text-xs leading-relaxed text-muted">
              {t('auth.success.registeredBody')}
            </p>
            <div className="mx-auto h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-3">
              <div className="h-full w-full animate-pulse bg-brand" />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (celebrateName !== null) {
    return (
      <WelcomeCelebration
        name={celebrateName}
        onDone={() => {
          setCelebrateName(null);
          close();
        }}
      />
    );
  }

  return createPortal(
    <div
      className="auth-overlay fixed inset-0 z-[100] flex items-end justify-center p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
        onClick={(event) => event.stopPropagation()}
        className="auth-sheet relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-line bg-surface p-5 shadow-raised sm:rounded-3xl sm:p-7"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-surface-3 sm:hidden" />
        <button
          type="button"
          onClick={close}
          aria-label={t('common.a11y.closeDialog')}
          className="absolute right-4 top-4 rounded-full p-2 text-subtle transition-colors hover:bg-surface-2 hover:text-content"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {step !== 'DONE' && (
          <div className="mb-5">
            <Logo size="md" />
          </div>
        )}

        {renderStep()}
      </div>
    </div>,
    document.body,
  );
};

export default AuthDialog;
