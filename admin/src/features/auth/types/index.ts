/**
 * Auth types for the staff panel.
 *
 * There is no user model here any more. The admin panel authenticates staff
 * against `/admin/auth/*` and the account it gets back is an `AdminAccount`,
 * which is defined once in `@/shared/api/types` and re-exported below so
 * feature code can keep importing from `@/features/auth/types`.
 *
 * The endpoints this file used to describe — forgot-password, verify-code,
 * reset-password, PATCH /me — do not exist on this backend. A staff password is
 * changed by a SUPERADMIN through `POST /admin/users/{id}/set-password` or by
 * recreating the account; there is no self-service reset, deliberately.
 */

import type { AdminAccount, AdminRole, LoginPayload, TokenResponse } from '@/shared/api/types';

export type { AdminAccount, AdminRole, LoginPayload, TokenResponse };

/** What `useLogin` needs to finish a sign-in: the pair plus the account. */
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  admin: AdminAccount;
}
