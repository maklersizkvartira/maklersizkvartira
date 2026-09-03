/**
 * The complete authentication flow, as three full-screen pages.
 *
 *   /login            phone + password
 *   /register         role -> name + phone + password -> SMS code -> account
 *   /forget-password  phone -> SMS code -> new password -> signed in
 *
 * It used to be a bottom sheet over whatever page you happened to be on, and
 * that shape was the source of most of what people complained about. A modal
 * has no address, so signing in could not be linked to or bookmarked and
 * Android's Back button dismissed the page underneath instead of the sheet. A
 * phone keyboard covers roughly two thirds of a bottom sheet, which left the
 * field being typed into and the button that submits it both off screen. And
 * every step of a three-screen registration lived in state that any stray tap
 * on the backdrop threw away.
 *
 * As routes, the browser does that work: /login and /register are two history
 * entries, so Back moves between them; the keyboard resizes a page instead of
 * covering a sheet; and the address is something a support message can carry.
 *
 * WHAT MOVES THE ADDRESS BAR, AND WHAT DOES NOT. The three modes are routes,
 * so switching between them goes through the store's `setCurrentView`. The
 * steps *inside* a mode — the role question, the SMS code, the new password —
 * are local state, because they are the same task and each one holds
 * something (a typed code, a half-entered password) that a history entry
 * could not carry back anyway.
 *
 * THE CODE STEP OF THE RESET IS SERVER-CHECKED. It did not used to be: the
 * only endpoint that could judge a code also consumed it, and the reset needs
 * that code alive for the call two screens later that actually sets the
 * password. So the step accepted any six digits and the mistake surfaced on
 * the password screen, where there is nothing to correct. `POST
 * /auth/check-code` exists for this now — it judges without spending — and
 * `handleResetCode` calls it.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Home,
  KeyRound,
  Search,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

import {
  getGoogleIdToken,
  isGoogleAuthConfigured,
  isPopupClosed,
  preloadGoogleAuth,
} from '../../config/firebase';
import { useTranslation } from '../../i18n';
import { AppLink } from '../../router/AppLink';
import { helpPath } from '../../seo/routes';
import { AuthApi, type ApiUser } from '../../services/authApi';
import { ApiError } from '../../services/http';
import { VIEW_PATHS } from '../../router/views';
import { useAppStore } from '../../stores/useAppStore';
import type { SignupRole } from '../../types';
import { Logo } from '../brand/Logo';
import { CodeInput } from './CodeInput';
import { useAuthErrors } from './useAuthErrors';
import {
  Button,
  Field,
  FormError,
  PasswordInput,
  PasswordStrength,
  TextInput,
} from '../ui/Field';

type Step =
  | 'LOGIN'
  | 'ROLE'
  | 'REGISTER'
  | 'VERIFY'
  | 'FORGOT'
  | 'RESET_CODE'
  | 'RESET_PASSWORD';

/**
 * The fields each step actually renders.
 *
 * The banner is shown unless the error already belongs to a field that is on
 * screen, and that question needs this table to answer honestly. `fieldFor`
 * routes every `otp_*` code to a field called 'code', which only the two
 * six-box screens have — so on the registration form a rate limit or a daily
 * cap set `fieldError` to a field that was not there, no input rendered the
 * message, and the banner suppressed itself out of politeness to it. The
 * visitor pressed the button and nothing whatsoever happened.
 */
const STEP_FIELDS: Record<string, ReadonlySet<string>> = {
  LOGIN: new Set(['phone', 'password']),
  ROLE: new Set(),
  REGISTER: new Set(['name', 'phone', 'password', 'confirmPassword']),
  VERIFY: new Set(),
  FORGOT: new Set(['phone']),
  RESET_CODE: new Set(),
  RESET_PASSWORD: new Set(['password', 'confirmPassword']),
};

/** Which step each route opens on. */
const ENTRY_STEP: Record<string, Step> = {
  LOGIN: 'LOGIN',
  REGISTER: 'ROLE',
  FORGOT_PASSWORD: 'FORGOT',
};

const PHONE_PREFIX = '+998 ';

/** Phone, code, password — the three screens `auth.reset.stepOf` counts. */
const RESET_STEPS = 3;

/**
 * The national part of whatever was typed or pasted, at most nine digits.
 *
 * `998` is both Uzbekistan's country code and the opening of a real
 * subscriber number — operator 99, subscriber number starting with 8 — so it
 * cannot be stripped by pattern alone. Two rules keep both cases right:
 *
 *  * The field renders `+998 ` as literal text, so that prefix is removed as
 *    text, before any digit is looked at.
 *  * What remains is only treated as carrying a country code when it is
 *    longer than a national number, which is what a pasted `+998901234567`
 *    is and what a typed `99 812 34 56` is not.
 *
 * The old version stripped a leading `998` from the digits unconditionally.
 * Anybody on a 99 8xx xx xx number watched their third digit disappear as
 * they pressed it, and the field then quietly held a different number that
 * passed validation.
 */
function nationalDigits(input: string): string {
  const typed = input.startsWith('+998') ? input.slice(4) : input;
  const digits = typed.replace(/\D/g, '');
  const national = digits.length > 9 && digits.startsWith('998') ? digits.slice(3) : digits;
  return national.slice(0, 9);
}

/** Formats keystrokes as `+998 90 123 45 67` while keeping the caret sane. */
function formatPhone(input: string): string {
  const digits = nationalDigits(input);
  if (!digits) return PHONE_PREFIX;
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return PHONE_PREFIX + parts.filter(Boolean).join(' ');
}

function phoneDigits(formatted: string): string {
  return `998${nationalDigits(formatted)}`;
}

function isPhoneComplete(formatted: string): boolean {
  return nationalDigits(formatted).length === 9;
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

/**
 * Whether a failure is a verdict on the six digits themselves.
 *
 * The `otp_` prefix is not the test: the server uses it for resend throttling
 * too (`otp_cooldown`, `otp_daily_limit`, `otp_retry`), and treating those as
 * a rejected code wiped a code the visitor had correctly typed and painted
 * all six boxes red for pressing "resend" one second early.
 */
const CODE_THROTTLE_CODES = new Set(['otp_cooldown', 'otp_daily_limit', 'otp_retry']);

function isCodeError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.code.startsWith('otp') &&
    !CODE_THROTTLE_CODES.has(error.code)
  );
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
    className="flex min-h-11 w-full touch-manipulation items-center justify-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3.5 text-sm font-bold text-content transition-colors hover:bg-surface-2 disabled:opacity-60"
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

export const AuthPage: React.FC = () => {
  const { t } = useTranslation();
  const { messageFor, fieldFor } = useAuthErrors();
  const currentView = useAppStore((state) => state.currentView);
  const currentUser = useAppStore((state) => state.currentUser);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setShowAuth = useAppStore((state) => state.setShowAuth);
  const navigate = useAppStore((state) => state.navigate);
  const pushToast = useAppStore((state) => state.pushToast);
  const login = useAppStore((state) => state.login);

  const mode = currentView as 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';

  const [step, setStep] = useState<Step>(() => ENTRY_STEP[mode] ?? 'LOGIN');
  const [role, setRole] = useState<SignupRole | null>(null);
  const [agency, setAgency] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(PHONE_PREFIX);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [codeRejected, setCodeRejected] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);

  /**
   * Which submit is allowed to write to the form.
   *
   * Every handler bumps it on entry and compares before touching state, so a
   * slow reply that lands after the visitor has moved on — pressed Back, or
   * switched from sign-in to registration — cannot resurrect its own error on
   * a screen that has nothing to do with it, or leave `busy` stuck true.
   */
  const submission = useRef(0);

  /**
   * False once this instance is gone.
   *
   * `submission` only sees changes this instance made. A visitor who leaves
   * the flow entirely — the back-home link, a Back press, a tap on a toast —
   * unmounts it with a request still in the air, and without this the reply
   * still ran `succeed()`, which reaches the store: a stale sign-in navigated
   * the app out from under somebody who was already reading a listing.
   */
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);

  /**
   * The heading of whichever step is on screen.
   *
   * Every step swap unmounts the control that caused it, so focus fell to
   * `<body>`: a keyboard visitor had to Tab from the top of the document
   * again, and a screen reader announced nothing at all — the page had
   * changed completely and said so to nobody. Moving focus to the heading is
   * both the announcement and a sane place to Tab onwards from.
   */
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusedStep = useRef<Step | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    setFieldError(undefined);
    setCodeRejected(false);
  }, []);

  /**
   * Reset what belongs to a mode when the route changes.
   *
   * The phone number deliberately survives: somebody who typed it on the
   * sign-in screen and then realised they have no account should not type it
   * again on the registration one. The passwords deliberately do not — the
   * value in the sign-in field followed the visitor into "choose a new
   * password", which pre-filled the very password they had come to replace.
   */
  useEffect(() => {
    submission.current += 1;
    setStep(ENTRY_STEP[mode] ?? 'LOGIN');
    setRole(null);
    setAgency('');
    setPassword('');
    setConfirmPassword('');
    setCode('');
    setBusy(false);
    setError(null);
    setFieldError(undefined);
    setCodeRejected(false);
    // All three belong to one particular send, and a send belongs to one
    // mode: a registration's masked number, its debug code and its cooldown
    // have no business on the reset screens.
    setMaskedPhone('');
    setDevCode(null);
    setResendAt(0);
    setResendIn(0);
  }, [mode]);

  useEffect(() => {
    // The Firebase SDK is a lazy chunk, so start fetching it as the page
    // opens: the download overlaps with the visitor reading the form instead
    // of beginning after they press the Google button.
    preloadGoogleAuth();
  }, []);

  useEffect(() => {
    // Not on the first step of a visit: arriving somewhere is not a change,
    // and pulling focus out of the document flow on load would scroll the
    // logo away before the visitor has seen the page they asked for.
    // Not on the two code screens. `CodeInput` autoFocuses its first box, and
    // parent effects run after child ones — so moving focus to the heading
    // here undid it, and the one screen whose entire purpose is a keyboard
    // opened without one.
    if (
      focusedStep.current !== null &&
      focusedStep.current !== step &&
      step !== 'VERIFY' &&
      step !== 'RESET_CODE'
    ) {
      headingRef.current?.focus();
    }
    focusedStep.current = step;
  }, [step]);

  /**
   * Somebody already signed in has no business on a sign-in form.
   *
   * They arrive here by pressing Back onto /login after signing in, or by
   * opening a stale link. `setShowAuth(false)` is the same exit the "continue
   * as a guest" button uses: their errand if they had one, the home page
   * otherwise.
   */
  useEffect(() => {
    if (currentUser) setShowAuth(false);
  }, [currentUser, setShowAuth]);

  /**
   * The resend cooldown, anchored to a deadline rather than counted down.
   *
   * A chain of `setTimeout(…, 1000)` calls stops being fired at all while the
   * tab is backgrounded, so a visitor who switched to their SMS app — which
   * is every visitor on this screen — came back to a button still claiming it
   * had forty seconds to wait.
   */
  useEffect(() => {
    if (!resendAt) return;
    const tick = () => setResendIn(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [resendAt]);

  const startCooldown = (seconds: number) => {
    setResendAt(Date.now() + seconds * 1000);
    setResendIn(seconds);
  };

  const fail = (caught: unknown) => {
    setError(messageFor(caught));
    // Always overwritten: a field name left over from the previous screen
    // routes the message to an input that is no longer rendered, and the
    // banner — which only shows when no field owns the error — stays silent.
    setFieldError(fieldFor(caught));
    setCodeRejected(isCodeError(caught));
    if (isCodeError(caught) && caught instanceof ApiError) {
      setCode('');
      // A code that has run out of attempts or expired is dead, and the only
      // way forward is a new one. Leaving the cooldown running hid the button
      // that would have sent it behind a timer for a code nobody can use.
      if (caught.code === 'otp_too_many_attempts' || caught.code === 'otp_expired') {
        setResendAt(0);
        setResendIn(0);
      }
    }
  };

  /**
   * Sign in and leave.
   *
   * `login` pushes the welcome toast and navigates to whatever the visitor
   * was trying to reach, so there is no success screen to hold them on: the
   * page they asked for arriving *is* the confirmation. Joining is the
   * exception — that happens once, and asks the shell for the welcome, which
   * is rendered above the destination rather than over a page that is on its
   * way out.
   */
  const succeed = (user: ApiUser, celebrate = false) => {
    login(user, { celebrate });
  };

  // -- Handlers -------------------------------------------------------------
  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();

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

    const mine = ++submission.current;
    setBusy(true);
    try {
      const user = await AuthApi.login(phoneDigits(phone), password);
      if (!alive.current || mine !== submission.current) return;
      succeed(user);
    } catch (caught) {
      if (!alive.current || mine !== submission.current) return;
      fail(caught);
    } finally {
      if (alive.current && mine === submission.current) setBusy(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();

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

    const mine = ++submission.current;
    setBusy(true);
    try {
      const pending = await AuthApi.register({
        name: name.trim(),
        phone: phoneDigits(phone),
        password,
        confirmPassword,
        role: role ?? 'STUDENT',
        // Only an agent has one, and it is optional even for them.
        agencyName: role === 'AGENT' ? agency.trim() || null : null,
        language: useAppStore.getState().language,
      });
      if (!alive.current || mine !== submission.current) return;
      setMaskedPhone(pending.phone);
      startCooldown(pending.resendAfter);
      setDevCode(pending.debugCode ?? null);
      setCode('');
      setStep('VERIFY');
    } catch (caught) {
      if (!alive.current || mine !== submission.current) return;
      fail(caught);
    } finally {
      if (alive.current && mine === submission.current) setBusy(false);
    }
  };

  const handleVerify = async (submittedCode?: string) => {
    const value = submittedCode ?? code;
    if (value.length < 6) {
      setError(t('auth.errors.codeIncomplete'));
      setFieldError(undefined);
      // Not `codeRejected`: nothing has been judged. Reddening six boxes for
      // digits the visitor simply has not typed yet reads as "these are
      // wrong" when the message says "there are not enough of them".
      setCodeRejected(false);
      return;
    }
    clearError();

    const mine = ++submission.current;
    setBusy(true);
    try {
      const user = await AuthApi.verifyCode(phoneDigits(phone), value);
      if (!alive.current || mine !== submission.current) return;
      succeed(user, true);
    } catch (caught) {
      if (!alive.current || mine !== submission.current) return;
      fail(caught);
    } finally {
      if (alive.current && mine === submission.current) setBusy(false);
    }
  };

  const handleResend = async () => {
    // Both guards live here rather than on the button's `disabled`, because
    // the button has to stay focusable — see `resendBlock`.
    if (resendIn > 0 || busy) return;
    clearError();

    const mine = ++submission.current;
    setBusy(true);
    try {
      // The reset screens spend a PASSWORD_RESET code; asking for a REGISTER
      // one here produced a code the reset call would always reject. Both
      // reset steps are named because the password screen can send the
      // visitor back to the code screen, and neither may fall through.
      const pending = await AuthApi.resendCode(
        phoneDigits(phone),
        step === 'RESET_CODE' || step === 'RESET_PASSWORD' ? 'PASSWORD_RESET' : 'REGISTER',
      );
      if (!alive.current || mine !== submission.current) return;
      setMaskedPhone(pending.phone);
      startCooldown(pending.resendAfter);
      setDevCode(pending.debugCode ?? null);
      setCode('');
    } catch (caught) {
      if (!alive.current || mine !== submission.current) return;
      fail(caught);
    } finally {
      if (alive.current && mine === submission.current) setBusy(false);
    }
  };

  const handleGoogle = async () => {
    clearError();
    const mine = ++submission.current;
    setBusy(true);
    try {
      const idToken = await getGoogleIdToken();
      const user = await AuthApi.loginWithGoogle(
        idToken,
        role ?? 'STUDENT',
        useAppStore.getState().language,
      );
      if (!alive.current || mine !== submission.current) return;
      succeed(user);
    } catch (caught) {
      if (!alive.current || mine !== submission.current) return;
      // Closing the popup is a normal user action, not an error worth showing.
      if (!isPopupClosed(caught)) fail(caught);
    } finally {
      if (alive.current && mine === submission.current) setBusy(false);
    }
  };

  const handleForgot = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();
    if (!isPhoneComplete(phone)) {
      setError(t('auth.errors.phoneInvalid'));
      setFieldError('phone');
      return;
    }

    const mine = ++submission.current;
    setBusy(true);
    try {
      const pending = await AuthApi.forgotPassword(phoneDigits(phone));
      if (!alive.current || mine !== submission.current) return;
      setMaskedPhone(pending.phone);
      startCooldown(pending.resendAfter);
      setDevCode(pending.debugCode ?? null);
      setCode('');
      setStep('RESET_CODE');
    } catch (caught) {
      if (!alive.current || mine !== submission.current) return;
      fail(caught);
    } finally {
      if (alive.current && mine === submission.current) setBusy(false);
    }
  };

  /**
   * The code step, and the reason this file has a server call in it at all.
   *
   * It used to check the length and nothing else, so any six digits opened
   * the password screen and the real verdict arrived one screen later, where
   * a wrong code is not something the visitor can fix. `/auth/check-code`
   * judges the code without consuming it, leaving it alive for
   * `/auth/reset-password` — the one call that is allowed to spend it.
   */
  const handleResetCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length < 6) {
      setError(t('auth.errors.codeIncomplete'));
      setFieldError(undefined);
      // Not `codeRejected`: nothing has been judged. Reddening six boxes for
      // digits the visitor simply has not typed yet reads as "these are
      // wrong" when the message says "there are not enough of them".
      setCodeRejected(false);
      return;
    }
    clearError();

    const mine = ++submission.current;
    setBusy(true);
    try {
      await AuthApi.checkCode(phoneDigits(phone), code, 'PASSWORD_RESET');
      if (!alive.current || mine !== submission.current) return;
      setStep('RESET_PASSWORD');
    } catch (caught) {
      if (!alive.current || mine !== submission.current) return;
      fail(caught);
    } finally {
      if (alive.current && mine === submission.current) setBusy(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();

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

    const mine = ++submission.current;
    setBusy(true);
    try {
      await AuthApi.resetPassword(phoneDigits(phone), code, password, confirmPassword);
    } catch (caught) {
      if (!alive.current || mine !== submission.current) return;
      fail(caught);
      // The code is checked on the previous screen now, so reaching this with
      // a bad one means it expired or was spent in the meantime. Either way
      // it belongs to the step that collected it.
      if (isCodeError(caught)) {
        setCode('');
        setStep('RESET_CODE');
      }
      setBusy(false);
      return;
    }

    // Past this line the password HAS been changed, whatever happens next.
    // Signing in is a second request and it can fail on its own — a dropped
    // connection, a rate limit — and reporting that as a failed reset sent
    // people back to request another code for a password that was already
    // theirs.
    try {
      const user = await AuthApi.login(phoneDigits(phone), password);
      if (!alive.current || mine !== submission.current) return;
      succeed(user);
    } catch {
      if (!alive.current || mine !== submission.current) return;
      // A toast rather than the form's own banner: the next line changes the
      // route, and the effect that watches the route clears everything the
      // previous mode had put on screen — including this message. A toast
      // outlives the navigation, which is the whole point of it here.
      pushToast('auth.reset.signInFailed', 'warning');
      setPassword('');
      setConfirmPassword('');
      setCode('');
      setCurrentView('LOGIN');
    } finally {
      if (alive.current && mine === submission.current) setBusy(false);
    }
  };

  // -- Shared pieces --------------------------------------------------------
  /**
   * The error banner, shown unless a field on this very screen is already
   * showing the same sentence. Every step renders it the same way now; the
   * two code screens used to need their own unconditional copy, and they get
   * one for free because they have no fields of their own.
   */
  const banner =
    fieldError && STEP_FIELDS[step]?.has(fieldError) ? null : <FormError message={error} />;

  /**
   * Move between the three routes.
   *
   * `back` is what stops the in-page back controls from being forward moves.
   * `setCurrentView` always pushes, so "back to sign in" on the reset screen
   * stacked a THIRD entry on top of the two it came from: the browser's own
   * Back then returned the visitor to the screen they had just left, and
   * hopping between /login and /register a few times buried the page they
   * arrived from under a pile of them.
   */
  const goToMode =
    (target: 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD', back = false) =>
    () => {
      clearError();
      const path = VIEW_PATHS[target];
      if (back && path) navigate(path, { replace: true });
      else setCurrentView(target);
    };

  /**
   * Going back a step is a correction, so it clears what the last screen
   * complained about. Left in place, a password error followed the visitor
   * onto the code screen, which shows its banner unconditionally.
   */
  const backTo = (target: Step) => () => {
    clearError();
    setStep(target);
  };

  const phoneField = (
    <Field
      label={t('auth.fields.phone')}
      hint={step === 'REGISTER' ? t('auth.fields.phoneHint') : undefined}
      error={fieldError === 'phone' ? error ?? undefined : undefined}
    >
      {({ id, describedBy, invalid }) => (
        <TextInput
          id={id}
          aria-describedby={describedBy}
          invalid={invalid}
          valid={isPhoneComplete(phone)}
          type="tel"
          inputMode="numeric"
          // The phone number IS the username here, and saying so is what lets
          // a password manager offer to save the pair and fill it next time.
          // With `tel` alone it had a password with nothing to attach it to.
          autoComplete={step === 'LOGIN' ? 'username' : 'tel'}
          name={step === 'LOGIN' ? 'username' : 'phone'}
          // No autoFocus. A script-driven focus with no user activation does
          // not open a soft keyboard on either mobile engine, so all it bought
          // was a focus ring on a field the visitor still had to tap — while
          // scrolling the logo and the heading off the top and moving a screen
          // reader past both of them. The code screens keep theirs, because
          // there the box IS the screen.
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

  const stepBack = (onBack: () => void) => (
    <button
      type="button"
      onClick={onBack}
      disabled={busy}
      aria-label={t('layout.header.backAria')}
      className="press -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand-text transition-colors hover:bg-brand-soft disabled:opacity-60"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      {t('common.action.back')}
    </button>
  );

  /**
   * The heading block.
   *
   * Centred, under a logo that is the largest thing on the screen — the
   * reference the owner supplied puts the mark, then the title, then the form,
   * down the middle of an otherwise empty page, and on a phone that vertical
   * rhythm is what makes a form with four controls read as one short task.
   */
  const header = (title: string, subtitle: string) => (
    <div className="space-y-1.5 text-center">
      <h1
        id="auth-title"
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-black tracking-tight text-content outline-none"
      >
        {title}
      </h1>
      <p className="text-sm text-muted">{subtitle}</p>
    </div>
  );

  /** "Step 2 of 3", so the reset never feels like an open-ended interrogation. */
  const resetProgress = (current: number) => (
    <p className="text-center text-[11px] font-black uppercase tracking-wider text-subtle">
      {t('auth.reset.stepOf', { current, total: RESET_STEPS })}
    </p>
  );

  const codeTile = (Icon: React.ComponentType<{ className?: string }>) => (
    <div className="flex justify-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-text">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
    </div>
  );

  /**
   * `aria-disabled`, not `disabled`.
   *
   * The countdown is written inside this button, and a disabled button is out
   * of the focus order — so the one piece of information somebody waiting for
   * a code needs ("42 seconds") was the one piece a screen reader could not
   * reach. It stays focusable and refuses the press in the handler instead,
   * and the label is a live region so the wait is heard as well as seen.
   */
  const resendWaiting = resendIn > 0 || busy;
  const resendBlock = (
    <div className="space-y-2 text-center">
      <button
        type="button"
        onClick={handleResend}
        aria-disabled={resendWaiting || undefined}
        className={`press min-h-11 px-3 text-xs font-bold ${
          resendWaiting
            ? 'cursor-not-allowed text-subtle'
            : 'text-brand-text hover:underline'
        }`}
      >
        <span aria-live="polite">
          {resendIn > 0
            ? t('auth.verify.resendIn', { seconds: resendIn })
            : t('auth.verify.resend')}
        </span>
      </button>
      <p className="text-[11px] text-subtle">{t('auth.verify.pasteHint')}</p>
    </div>
  );

  const devCodeBanner = devCode ? (
    <p className="rounded-lg bg-warning-soft px-3 py-2 text-center text-xs font-bold text-warning">
      {t('auth.verify.devCode', { code: devCode })}
    </p>
  ) : null;

  const divider = (
    <div className="relative py-1 text-center">
      <span className="absolute inset-0 flex items-center" aria-hidden="true">
        <span className="w-full border-t border-line" />
      </span>
      <span className="relative bg-canvas px-3 text-[11px] font-bold uppercase text-subtle">
        {t('auth.login.orDivider')}
      </span>
    </div>
  );

  /**
   * The way out.
   *
   * A modal had an X in its corner; a page needs to offer the same escape or
   * the only exit from a sign-in form is the browser's Back button. It is
   * also the honest answer to "do I have to make an account to look around?",
   * which on a listings site is no.
   */
  /**
   * Whether the personal-data policy has been accepted.
   *
   * Not persisted and not prefilled: a consent that survives a reload is a
   * consent nobody gave on this visit.
   */
  const [consented, setConsented] = useState(false);

  const guestExit = (
    <Button
      type="button"
      variant="secondary"
      fullWidth
      disabled={busy}
      onClick={() => setShowAuth(false)}
    >
      {t('auth.page.guest')}
    </Button>
  );

  const terms = (
    <p className="text-center text-[11px] leading-relaxed text-subtle">
      {t('auth.page.terms')}
    </p>
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
            >
              {({ id, describedBy, invalid }) => (
                <PasswordInput
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  autoComplete="current-password"
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('auth.fields.passwordPlaceholder')}
                />
              )}
            </Field>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={goToMode('FORGOT_PASSWORD')}
                className="min-h-11 text-xs font-bold text-brand-text hover:underline disabled:opacity-60"
              >
                {t('auth.login.forgotPassword')}
              </button>
            </div>

            {banner}

            <Button type="submit" loading={busy} fullWidth>
              {busy ? t('auth.login.submitting') : t('auth.login.submit')}
            </Button>

            {isGoogleAuthConfigured && (
              <>
                {divider}
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
                disabled={busy}
                onClick={goToMode('REGISTER')}
                // A 12px link in a paragraph is a 16px tap target. Everything
                // else on these screens is `min-h-11`; these three — the only
                // route between signing in and signing up — were not, and they
                // sit directly under a sentence a thumb lands on just as often.
                className="inline-flex min-h-11 items-center rounded-lg px-1.5 align-middle font-bold text-brand-text hover:underline disabled:opacity-60"
              >
                {t('auth.login.createOne')}
              </button>
            </p>

            {terms}
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
                  // Third, and no longer absent. Agents were signing up as
                  // owners and explaining themselves in the listing text,
                  // because the question had only two answers and neither was
                  // theirs — which is what the complaints were about.
                  value: 'AGENT' as const,
                  icon: Briefcase,
                  title: t('auth.role.agent.title'),
                  description: t('auth.role.agent.description'),
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
            {/* A registration that failed with nothing to attach the message
                to — a rate limit, a dead provider — used to disappear for a
                screen and then surface on REGISTER, attached to nothing the
                visitor had just done. */}
            {banner}
            <p className="pt-1 text-center text-xs text-subtle">{t('auth.role.hint')}</p>
            <p className="text-center text-xs text-muted">
              {t('auth.register.haveAccount')}{' '}
              <button
                type="button"
                onClick={goToMode('LOGIN', true)}
                className="inline-flex min-h-11 items-center rounded-lg px-1.5 align-middle font-bold text-brand-text hover:underline"
              >
                {t('auth.register.signInInstead')}
              </button>
            </p>
            {guestExit}
          </div>
        );

      case 'REGISTER':
        return (
          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            {stepBack(backTo('ROLE'))}
            {header(t('auth.register.title'), t('auth.register.subtitle'))}

            <div className="flex items-center justify-between rounded-xl border border-brand/25 bg-brand-soft px-3.5 py-2.5">
              <span className="text-xs font-bold text-brand-text">
                {t('auth.role.selected', {
                  role: t(
                    role === 'OWNER'
                      ? 'common.role.owner'
                      : role === 'AGENT'
                        ? 'common.role.agent'
                        : 'common.role.student',
                  ),
                })}
              </span>
              <button
                type="button"
                onClick={backTo('ROLE')}
                className="inline-flex min-h-11 items-center rounded-lg px-1.5 align-middle font-bold text-brand-text hover:underline text-xs underline"
              >
                {t('auth.role.change')}
              </button>
            </div>

            <Field
              label={t('auth.fields.name')}
              hint={t('auth.fields.nameHint')}
              error={fieldError === 'name' ? error ?? undefined : undefined}
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

            {role === 'AGENT' && (
              <Field
                label={t('auth.fields.agency')}
                hint={t('auth.fields.agencyHint')}
              >
                {({ id, describedBy }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    autoComplete="organization"
                    value={agency}
                    onChange={(event) => setAgency(event.target.value)}
                    placeholder={t('auth.fields.agencyPlaceholder')}
                    icon={<Briefcase className="h-4 w-4" />}
                  />
                )}
              </Field>
            )}

            {phoneField}

            <Field
              label={t('auth.fields.password')}
              error={fieldError === 'password' ? error ?? undefined : undefined}
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

            {banner}

            {/* Consent is a decision, not a footnote.
                This used to be a sentence under the button saying the account
                had already agreed — true only in the sense that pressing the
                button was the agreement. A personal-data policy the visitor
                is asked to accept has to be something they can decline, and
                something they can read first: both documents are links, and
                the button below does not work until the box is ticked. */}
            <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface-2 p-3">
              <input
                type="checkbox"
                checked={consented}
                onChange={(event) => setConsented(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
              />
              <span className="text-[11px] leading-relaxed text-subtle">
                {t('auth.register.consentPrefix')}{' '}
                <AppLink
                  to={helpPath('maxfiylik-siyosati')}
                  className="font-bold text-brand-text hover:underline"
                >
                  {t('auth.register.consentPrivacy')}
                </AppLink>{' '}
                {t('auth.register.consentAnd')}{' '}
                <AppLink
                  to={helpPath('foydalanish-shartlari')}
                  className="font-bold text-brand-text hover:underline"
                >
                  {t('auth.register.consentTerms')}
                </AppLink>
                {t('auth.register.consentSuffix')}
              </span>
            </label>

            <Button type="submit" loading={busy} fullWidth disabled={!consented}>
              {busy ? t('auth.register.submitting') : t('auth.register.submit')}
            </Button>
          </form>
        );

      case 'VERIFY':
        return (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleVerify();
            }}
            className="space-y-5"
            noValidate
          >
            {stepBack(backTo('REGISTER'))}
            {header(t('auth.verify.title'), t('auth.verify.subtitle', { phone: maskedPhone }))}
            {codeTile(ShieldCheck)}

            <CodeInput
              label={t('auth.fields.code')}
              value={code}
              onChange={setCode}
              onComplete={(value) => void handleVerify(value)}
              disabled={busy}
              describedBy={error ? 'auth-code-error' : undefined}
              // Only a verdict on the CODE turns the boxes red. A rate-limited
              // resend and a dropped connection used to paint them too, which
              // told the visitor to correct six digits that were fine.
              invalid={codeRejected}
            />

            {devCodeBanner}

            <div id="auth-code-error">{banner}</div>

            <Button type="submit" loading={busy} fullWidth>
              {busy ? t('auth.verify.submitting') : t('auth.verify.submit')}
            </Button>

            {resendBlock}
          </form>
        );

      case 'FORGOT':
        return (
          <form onSubmit={handleForgot} className="space-y-4" noValidate>
            {stepBack(goToMode('LOGIN', true))}
            {header(t('auth.forgot.title'), t('auth.forgot.subtitle'))}
            {resetProgress(1)}
            {codeTile(KeyRound)}
            {phoneField}
            {banner}
            <Button type="submit" loading={busy} fullWidth>
              {t('auth.forgot.submit')}
            </Button>
            <button
              type="button"
              onClick={goToMode('LOGIN', true)}
              className="press min-h-11 w-full text-center text-xs font-bold text-brand-text hover:underline"
            >
              {t('auth.forgot.backToLogin')}
            </button>
          </form>
        );

      case 'RESET_CODE':
        return (
          <form onSubmit={handleResetCode} className="space-y-5" noValidate>
            {stepBack(backTo('FORGOT'))}
            {header(
              t('auth.reset.codeTitle'),
              t('auth.reset.codeSubtitle', { phone: maskedPhone }),
            )}
            {resetProgress(2)}
            {codeTile(ShieldCheck)}

            {/* No `onComplete`: the six digits go to the server on a
                deliberate press, so a mistyped digit stays correctable
                instead of being spent the instant the last box fills. */}
            <CodeInput
              label={t('auth.fields.code')}
              value={code}
              onChange={setCode}
              disabled={busy}
              invalid={codeRejected}
              describedBy={error ? 'auth-code-error' : undefined}
            />

            {devCodeBanner}
            <div id="auth-code-error">{banner}</div>

            <Button type="submit" loading={busy} fullWidth>
              {busy ? t('auth.reset.checking') : t('auth.reset.continue')}
            </Button>

            {resendBlock}
          </form>
        );

      case 'RESET_PASSWORD':
        return (
          <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
            {stepBack(backTo('RESET_CODE'))}
            {header(t('auth.reset.passwordTitle'), t('auth.reset.passwordSubtitle'))}
            {resetProgress(3)}

            {/* Hidden, and load-bearing. A password manager will not offer to
                update the entry it filled on /login twenty seconds ago unless
                the new password sits beside the username it belongs to, and
                there was no username field on this screen at all. */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={phone}
              readOnly
              hidden
              aria-hidden="true"
              tabIndex={-1}
            />

            <Field
              label={t('auth.fields.newPassword')}
              // The server's own password complaints come back as `password*`
              // codes, which `fieldFor` routes to this field.
              error={fieldError === 'password' ? error ?? undefined : undefined}
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

            {banner}

            <Button type="submit" loading={busy} fullWidth>
              {busy ? t('auth.reset.submitting') : t('auth.reset.submit')}
            </Button>
          </form>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      {/*
        The only chrome. App.tsx renders no header, footer or tab bar on this
        route, so this link is the whole of the way back out — and on a phone
        it sits where a back button is expected rather than where a nav bar
        used to be.

        It says "home" and it means it, which is why it does not go through
        `setShowAuth(false)` like the guest button below: that one honours the
        errand the visitor was on, and this one is for somebody who has given
        up on it. Dropping the errand is the point, not an oversight.
      */}
      <div className="gutter-safe pt-3">
        <button
          type="button"
          onClick={() => {
            useAppStore.setState({ authReturnTo: null });
            navigate('/');
          }}
          className="press -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-muted transition-colors hover:bg-surface-2 hover:text-content"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('auth.page.backHome')}
        </button>
      </div>

      {/*
        A `section`, not a `main`: App.tsx already renders the page's one
        `<main id="main-content">` around every view, and a second one nested
        inside it is invalid and leaves a screen reader with two "main"
        landmarks to choose between.

        `justify-center` with `py-6` rather than a fixed top offset — the block
        sits in the middle of a tall screen and simply scrolls when the
        keyboard is up and there is no middle left to sit in.
      */}
      {/*
        The bottom inset is spelled out here because nothing else on this route
        carries it: `BottomNav` is what holds `pb-safe-plus` for the rest of
        the app, and CHROMELESS suppresses it. The page ships `viewport-fit=
        cover` and there is a Capacitor build, so without this the last control
        sat under the home indicator in the installed app.
      */}
      <section
        className="gutter-safe flex flex-1 items-center justify-center pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-6"
        aria-labelledby="auth-title"
      >
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center">
            <Logo size="xl" />
          </div>
          {renderStep()}
        </div>
      </section>
    </div>
  );
};

export default AuthPage;
