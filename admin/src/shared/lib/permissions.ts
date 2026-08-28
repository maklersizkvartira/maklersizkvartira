/**
 * The one place the panel decides who may do what.
 *
 * The backend's authorisation is a single `>=` against a three-rung ladder —
 * no scopes, no per-object ACLs, no feature flags. Anything richer on the
 * client is a lie that eventually disagrees with the server, which is what
 * happened here before: three separate notions of "is this person an admin"
 * (a seven-way OR over CRM flags, a `useRole().isAdmin` boolean, and an inline
 * block inside the react-query retry predicate) drifted apart and let the
 * sidebar offer pages the API then refused.
 *
 * So: one ladder, one comparison, one route table. A guard that needs
 * something this file cannot express is a guard that does not match the
 * backend.
 */

import type { AdminRole } from '@/shared/api/types';

/**
 * Mirrors `routing.locales` in `@/i18n/routing`, which this file cannot import
 * without dragging next-intl's navigation helpers into every guard.
 *
 * It has to be an explicit list rather than "a two-letter first segment",
 * because `/ai` is a two-letter ROUTE. Guessing by length would read `/ai` as a
 * locale, find no page segment behind it, and hand the AI screen back as
 * ungated — visible to anyone, including a signed-out browser.
 */
const LOCALE_SEGMENTS = new Set(['uz', 'ru', 'en']);

/** The ladder. Higher number wins; the values match the backend's ordering. */
export const ADMIN_RANK = {
  MODERATOR: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
} as const satisfies Record<AdminRole, number>;

export type AdminRank = (typeof ADMIN_RANK)[AdminRole];

/**
 * Rank of a role. Anything unrecognised — including `null`, and including a
 * role string a future backend adds — ranks 0, which is below every gate.
 * Failing closed is the only safe default for a value that arrives over the
 * wire.
 */
export function rank(role: AdminRole | string | null | undefined): number {
  if (!role) return 0;
  return ADMIN_RANK[role as AdminRole] ?? 0;
}

/** Does `role` sit at or above `min` on the ladder? */
export function atLeast(
  role: AdminRole | string | null | undefined,
  min: AdminRole,
): boolean {
  return rank(role) >= ADMIN_RANK[min];
}

/**
 * Minimum role for each route the sidebar can link to and each page can guard,
 * in the order the sidebar should list them.
 *
 * Keys are locale-free pathnames — strip the `/uz` prefix before looking one
 * up, or use `minRoleForPath()`, which does it for you.
 *
 * A route with no entry here is ungated: `canAccessRoute` lets it through. That
 * is deliberate for /login and the error pages, and it means a NEW page has to
 * be added to this table to be protected. Adding the page is not enough.
 */
const ROUTE_TABLE = {
  '/dashboard': 'MODERATOR',
  '/listings': 'MODERATOR',
  '/reports': 'MODERATOR',
  '/verifications': 'MODERATOR',
  '/ai': 'MODERATOR',
  '/audit': 'MODERATOR',
  '/users': 'MODERATOR',
  '/sms': 'ADMIN',
  '/security': 'ADMIN',
  '/staff': 'SUPERADMIN',
} as const satisfies Record<string, AdminRole>;

export type GuardedRoute = keyof typeof ROUTE_TABLE;

/**
 * Widened so callers can index it with a pathname they computed at runtime —
 * `ROUTE_MIN_ROLE[item.href]` from a nav array, say — and get
 * `AdminRole | undefined` back. Indexing with one of the literal keys still
 * narrows to that route's exact role.
 */
export const ROUTE_MIN_ROLE = ROUTE_TABLE as typeof ROUTE_TABLE &
  Record<string, AdminRole | undefined>;

/**
 * Minimum role for the actions that are gated more tightly than the page they
 * live on. `/users` is readable by a moderator, but every button on it is not.
 */
export const ACTION_MIN_ROLE = {
  /** `PATCH /admin/users/{id}` */
  userPatch: 'ADMIN',
  /** `POST /admin/users/{id}/reveal-password` — audited at CRITICAL. */
  userRevealPassword: 'ADMIN',
  /** `POST /admin/users/{id}/set-password` */
  userSetPassword: 'ADMIN',
  /** `POST /admin/users/{id}/revoke-sessions` */
  userRevokeSessions: 'ADMIN',
  /** `DELETE /admin/users/{id}` */
  userDelete: 'SUPERADMIN',
  /** `PATCH /admin/listings/{id}/status` */
  listingModerate: 'MODERATOR',
  /** `PATCH /admin/listings/{id}/feature` */
  listingFeature: 'MODERATOR',
  /** `DELETE /admin/listings/{id}` */
  listingDelete: 'ADMIN',
  /** `POST /admin/settings/toggle-monetization` */
  monetizationToggle: 'SUPERADMIN',
  /** `POST /admin/staff` and `PATCH /admin/staff/{id}/active` */
  staffManage: 'SUPERADMIN',
} as const satisfies Record<string, AdminRole>;

export type GuardedAction = keyof typeof ACTION_MIN_ROLE;

/** May this role reach this route? Unknown routes are ungated. */
export function canAccessRoute(
  role: AdminRole | string | null | undefined,
  route: string,
): boolean {
  const min = minRoleForPath(route);
  return min === null ? true : atLeast(role, min);
}

/** May this role perform this action? */
export function canPerform(
  role: AdminRole | string | null | undefined,
  action: GuardedAction,
): boolean {
  return atLeast(role, ACTION_MIN_ROLE[action]);
}

/**
 * Minimum role for a real pathname, which arrives locale-prefixed
 * (`/uz/listings/abc-123`) and often carries a detail segment. Matches on the
 * first path segment after the locale, so a detail page inherits its list
 * page's gate — which is what the backend does too, since both hit the same
 * router prefix.
 *
 * Returns `null` for a path with no entry in the table, e.g. `/login`.
 */
export function minRoleForPath(pathname: string): AdminRole | null {
  const segments = pathname.split('/').filter(Boolean);
  // Drop a leading locale segment; `routing.localePrefix` is 'always', so one
  // is present on every in-app URL.
  const head = segments[0] && LOCALE_SEGMENTS.has(segments[0]) ? segments[1] : segments[0];
  if (!head) return null;
  return ROUTE_MIN_ROLE[`/${head}`] ?? null;
}

/**
 * Every route this role may open, in table order.
 *
 * Nothing calls it. The comment that used to sit here claimed the sidebar did,
 * which was worse than the unused function under it: `Sidebar.tsx` builds its
 * nav from `atLeast` and `ROUTE_MIN_ROLE`, so anyone who changed this to change
 * what the sidebar shows would have changed nothing and believed otherwise.
 * Kept, correctly described, because it is the only place that answers "what
 * can this role reach" without a pathname in hand.
 */
export function allowedRoutes(role: AdminRole | string | null | undefined): GuardedRoute[] {
  return (Object.keys(ROUTE_TABLE) as GuardedRoute[]).filter((route) =>
    atLeast(role, ROUTE_TABLE[route]),
  );
}
