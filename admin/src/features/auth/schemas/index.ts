import { z } from 'zod';

/**
 * The login form's contract, and the single source of truth for what the form
 * may submit — `LoginFormValues` is what `useLogin` accepts.
 *
 * The bounds mirror the backend's `AdminLoginRequest` (username 3..64,
 * lowercased server-side) so a typo fails in the field rather than as a 422
 * from the API, and the username is trimmed and lowercased here for the same
 * reason: the backend does it too, and a form that shows something different
 * from what it sends is a support ticket waiting to happen.
 *
 * The messages are English fallbacks. The login form is expected to translate
 * by issue path rather than render these verbatim — an untranslated string is
 * still readable, which an i18n key would not be.
 */
export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters.')
    .max(64, 'Username must be at most 64 characters.'),
  password: z.string().min(1, 'Password is required.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
