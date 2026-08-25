/**
 * Maps backend error codes onto translated messages.
 *
 * The server already returns a localised `message`, but the client keeps its
 * own mapping so that (a) validation done before the request round-trips
 * reads identically to validation done by the server, and (b) an unexpected
 * code still produces a sentence rather than a raw identifier.
 */

import { useCallback } from 'react';

import { ApiError } from '../../services/http';
import { useTranslation, type TranslationKey } from '../../i18n';

const CODE_TO_KEY: Record<string, TranslationKey> = {
  // Credentials
  invalid_credentials: 'auth.errors.passwordRequired',
  password_mismatch: 'auth.errors.passwordMismatch',
  password_too_short: 'auth.errors.passwordTooShort',
  password_too_simple: 'auth.errors.passwordTooSimple',
  current_password_invalid: 'auth.errors.passwordRequired',

  // Phone
  phone_required: 'auth.errors.phoneRequired',
  phone_invalid: 'auth.errors.phoneInvalid',
  phone_invalid_length: 'auth.errors.phoneInvalid',
  phone_unknown_operator: 'auth.errors.phoneInvalid',

  // OTP
  otp_not_found: 'auth.errors.codeRequired',
  otp_expired: 'auth.errors.codeRequired',
  otp_invalid: 'auth.errors.codeIncomplete',
  otp_too_many_attempts: 'auth.errors.codeRequired',

  // Transport
  network: 'common.error.network',
  timeout: 'common.error.network',
  rate_limited: 'common.error.rateLimited',
  forbidden: 'common.error.forbidden',
  not_found: 'common.error.notFound',
  validation_error: 'common.error.validation',
};

/**
 * Firebase throws its own codes, and its `message` is an English sentence with
 * the code in brackets — which is what a visitor saw when Google sign-in
 * failed. These are the failures that actually happen in production, and each
 * one has a different fix, so they must not collapse into "something went
 * wrong".
 */
const FIREBASE_CODE_TO_KEY: Record<string, TranslationKey> = {
  // The site's domain is not in the Firebase authorised list. Invisible from
  // the outside and the single most common cause: adding a www subdomain, or
  // a new Vercel domain, without adding it there too.
  'auth/unauthorized-domain': 'auth.errors.googleDomain',
  'auth/operation-not-allowed': 'auth.errors.googleDisabled',
  'auth/popup-blocked': 'auth.errors.googlePopupBlocked',
  'auth/network-request-failed': 'common.error.network',
  'auth/too-many-requests': 'common.error.rateLimited',
  'auth/invalid-api-key': 'auth.errors.googleUnavailable',
  'auth/configuration-not-found': 'auth.errors.googleUnavailable',
  'auth/internal-error': 'auth.errors.googleUnavailable',
  'auth/account-exists-with-different-credential': 'auth.errors.googleOtherAccount',
};

export function useAuthErrors() {
  const { t } = useTranslation();

  /**
   * Prefers the server's own localised sentence, because it can carry
   * specifics the client cannot know (attempts remaining, lockout minutes).
   */
  const messageFor = useCallback(
    (error: unknown): string => {
      if (error instanceof ApiError) {
        if (error.message) return error.message;
        const key = CODE_TO_KEY[error.code];
        if (key) return t(key, (error.params as Record<string, string | number>) ?? undefined);
        return t('common.error.generic');
      }
      const code = (error as { code?: string } | null)?.code;
      if (code) {
        const key = FIREBASE_CODE_TO_KEY[code];
        // The raw code is worth keeping in the console: the message a visitor
        // reads is deliberately not the one that identifies the misconfiguration.
        if (import.meta.env.DEV) console.warn('auth provider error:', code);
        if (key) return t(key);
      }
      if (error instanceof Error && error.message) return error.message;
      return t('common.error.generic');
    },
    [t],
  );

  /** The field a validation error belongs to, so the form can focus it. */
  const fieldFor = useCallback((error: unknown): string | undefined => {
    if (!(error instanceof ApiError)) return undefined;
    if (error.field) return error.field;
    if (error.code.startsWith('password')) return 'password';
    if (error.code.startsWith('phone')) return 'phone';
    if (error.code.startsWith('otp')) return 'code';
    return undefined;
  }, []);

  return { messageFor, fieldFor };
}
