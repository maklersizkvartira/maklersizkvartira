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

/** Roles a person may choose for themselves on the profile page. */
export const isSwitchableRole = (role: MaybeRole): boolean =>
  role === 'STUDENT' || role === 'OWNER' || role === 'TENANT';

/**
 * Translation key for a role name.
 *
 * The header used to print "owner or student" from a boolean, so a granted
 * role showed up as one of the two roles it is not.
 *
 * `as const` matters: `t()` accepts only known keys, so a widened `string`
 * return would not type-check — and that strictness is what catches a label
 * that was never translated.
 */
const ROLE_LABEL_KEYS = {
  DEVELOPER: 'common.role.developer',
  ADMIN: 'common.role.admin',
  MODERATOR: 'common.role.moderator',
  OWNER: 'common.role.owner',
  TENANT: 'common.role.tenant',
  STUDENT: 'common.role.student',
} as const satisfies Record<UserRole, string>;

export const roleLabelKey = (
  role: MaybeRole,
): (typeof ROLE_LABEL_KEYS)[UserRole] | 'common.role.guest' =>
  role && role in ROLE_LABEL_KEYS ? ROLE_LABEL_KEYS[role] : 'common.role.guest';
