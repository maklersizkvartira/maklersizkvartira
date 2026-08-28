'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuthStore } from '@/store/auth.store';
import {
  ACTION_MIN_ROLE,
  atLeast,
  canAccessRoute,
  canPerform,
  rank,
  type GuardedAction,
} from '@/shared/lib/permissions';
import type { AdminRole } from '@/shared/api/types';

/**
 * One reading of the signed-in account's rank, shared by the sidebar and every
 * page guard.
 *
 * The three booleans below are the whole surface, and they are a ladder rather
 * than a set of independent flags: an ADMIN *is* a moderator for every purpose
 * the backend cares about, because authorisation there is a single `>=`. The
 * version this replaces had an `isOperator` whose JSDoc promised "isAdmin OR
 * one of operator/support/analyst/viewer" while the code computed
 * `!isAdmin && [...].includes(role)` — the exact opposite for an admin — and
 * neither reading corresponded to anything the API enforces. It is gone.
 */
interface RoleContextValue {
  /** The account's role, or null when nobody is signed in. */
  role: AdminRole | null;
  /** 1 / 2 / 3, or 0 for signed-out and for any role we do not recognise. */
  rank: number;
  /** MODERATOR or above — i.e. any staff account at all. */
  isModerator: boolean;
  /** ADMIN or above. */
  isAdmin: boolean;
  /** SUPERADMIN. */
  isSuperadmin: boolean;
  /** Does this account outrank, or match, `min`? */
  atLeast: (min: AdminRole) => boolean;
  /** May it perform a specific gated action? See `ACTION_MIN_ROLE`. */
  can: (action: GuardedAction) => boolean;
  /** May it open this pathname? Locale prefixes are handled for you. */
  canAccess: (pathname: string) => boolean;
}

const SIGNED_OUT: RoleContextValue = {
  role: null,
  rank: 0,
  isModerator: false,
  isAdmin: false,
  isSuperadmin: false,
  atLeast: () => false,
  can: () => false,
  canAccess: () => false,
};

const RoleContext = createContext<RoleContextValue>(SIGNED_OUT);

export function RoleProvider({ children }: { children: ReactNode }) {
  const admin = useAuthStore((s) => s.admin);

  const value = useMemo<RoleContextValue>(() => {
    const role = admin?.role ?? null;
    if (!role) return SIGNED_OUT;

    return {
      role,
      rank: rank(role),
      isModerator: atLeast(role, 'MODERATOR'),
      isAdmin: atLeast(role, 'ADMIN'),
      isSuperadmin: atLeast(role, 'SUPERADMIN'),
      atLeast: (min) => atLeast(role, min),
      can: (action) => canPerform(role, action),
      canAccess: (pathname) => canAccessRoute(role, pathname),
    };
  }, [admin]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  return useContext(RoleContext);
}

export { ACTION_MIN_ROLE };
export type { GuardedAction };
