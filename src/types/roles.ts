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
 *
 * `sellerTypeOf` is the one export here that reads a listing rather than an
 * account, and it belongs beside the others because it is the other half of
 * the same question: `canPublishAsAgent` decides who may post as an agent, and
 * it decides which posts came from one.
 */

import type { Listing, SellerType, UserRole } from './index';

type MaybeRole = UserRole | null | undefined;

/**
 * May publish and manage listings.
 *
 * "Of their own" is no longer the right phrase: an AGENT publishes on behalf
 * of the owners they represent, which is the same capability and a different
 * relationship. The relationship is recorded per listing (`sellerType`), not
 * here.
 */
export const canPublishListings = (role: MaybeRole): boolean =>
  role === 'OWNER' || role === 'AGENT' || role === 'DEVELOPER';

/** May publish a listing marked as coming from an agent rather than an owner. */
export const canPublishAsAgent = (role: MaybeRole): boolean => role === 'AGENT';

/**
 * Who is offering the flat: the owner in person, or an agent acting for them.
 *
 * `sellerType` is optional on the wire — a row written before the column
 * existed carries nothing, and so does a response from a container that
 * predates it — and every one of those listings was published by an owner,
 * which is exactly what the column now defaults to server-side.
 *
 * The default lives in one place rather than at each call site because the
 * grid card and the detail page have to reach the same verdict about the same
 * listing: a card badge reading "from the owner" above a page that names an
 * agency is worse than either surface saying nothing at all.
 *
 * It lives in this module rather than in ListingCard because the detail page
 * needs the verdict and renders no card: importing a one-line predicate from
 * there pulled a component, nine icons and a module-level carousel ticker into
 * the graph of a page that never mounts one.
 */
export function sellerTypeOf(listing: Pick<Listing, 'sellerType'>): SellerType {
  return listing.sellerType === 'AGENT' ? 'AGENT' : 'OWNER';
}

/** Sees material that is not public: pending, rejected and hidden listings. */
export const isStaffRole = (role: MaybeRole): boolean =>
  role === 'MODERATOR' || role === 'ADMIN' || role === 'DEVELOPER';

/** Bypasses ownership entirely — may act on any listing. */
export const hasFullAccess = (role: MaybeRole): boolean =>
  role === 'ADMIN' || role === 'DEVELOPER';

/** Roles a person may choose for themselves on the profile page. */
export const isSwitchableRole = (role: MaybeRole): boolean =>
  role === 'STUDENT' || role === 'OWNER' || role === 'AGENT' || role === 'TENANT';

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
  AGENT: 'common.role.agent',
  TENANT: 'common.role.tenant',
  STUDENT: 'common.role.student',
} as const satisfies Record<UserRole, string>;

export const roleLabelKey = (
  role: MaybeRole,
): (typeof ROLE_LABEL_KEYS)[UserRole] | 'common.role.guest' =>
  role && role in ROLE_LABEL_KEYS ? ROLE_LABEL_KEYS[role] : 'common.role.guest';
