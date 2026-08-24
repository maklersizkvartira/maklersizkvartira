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
