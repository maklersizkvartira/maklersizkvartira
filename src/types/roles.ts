/**
 * Role capability checks.
 *
 * The UI used to compare `role === 'OWNER'` in a dozen places. Adding the
 * DEVELOPER role — which is meant to be able to do everything an owner can,
 * plus everything staff can — turned every one of those comparisons into a
 * place the new role would silently fail.
 *
 * These helpers are the single place that answers "may this account do X",
 * so a future role is added once rather than found by bug report.
 */

import type { UserRole } from './index';

type MaybeRole = UserRole | null | undefined;

/** May publish and manage listings of their own. */
export const canPublishListings = (role: MaybeRole): boolean =>
  role === 'OWNER' || role === 'DEVELOPER';

/** Sees material that is not public: pending, rejected and hidden listings. */
export const isStaffRole = (role: MaybeRole): boolean =>
  role === 'MODERATOR' || role === 'ADMIN' || role === 'DEVELOPER';

/** Bypasses ownership entirely — may act on any listing. */
export const hasFullAccess = (role: MaybeRole): boolean =>
  role === 'ADMIN' || role === 'DEVELOPER';
