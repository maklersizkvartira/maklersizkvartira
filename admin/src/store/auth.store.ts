import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { setAccessToken } from '@/shared/lib/http';
import type { AdminAccount } from '@/shared/api/types';

/**
 * Who is signed in, for the length of one tab.
 *
 * Nothing here is persisted. The store used to write the user through
 * `zustand/persist` into localStorage, which meant a signed-out browser still
 * rendered a populated sidebar and an `isAuthenticated: true` flag until the
 * first API call failed. The refresh token in the httpOnly cookie is the only
 * thing that survives a reload, and `status` is how the UI waits for the
 * bootstrap that turns it back into a session.
 */

export type AuthStatus =
  /** No session yet, and we have not tried the refresh cookie. Render a splash. */
  | 'idle'
  /** A refresh or a `/auth/me` call is in flight. */
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  /**
   * The bootstrap could not reach the API at all. Distinct from
   * 'unauthenticated' because the session may be perfectly valid: treating an
   * outage as a rejection sends the tab to /login, which the middleware bounces
   * straight back to /dashboard while the refresh cookie is still there. The
   * shell shows a retry instead of redirecting.
   */
  | 'error';

interface AuthStore {
  /** In memory only — see `setAccessToken` in `@/shared/lib/http`. */
  accessToken: string | null;
  admin: AdminAccount | null;
  status: AuthStatus;

  setAuth: (admin: AdminAccount, accessToken: string) => void;
  clearAuth: () => void;
  /** Refresh the cached account after `/auth/me` or a profile change. */
  setAdmin: (admin: AdminAccount) => void;
  /** Called by the http client's refresh path; leaves `admin` untouched. */
  updateAccessToken: (token: string) => void;
  setStatus: (status: AuthStatus) => void;
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    (set) => ({
      accessToken: null,
      admin: null,
      status: 'idle',

      setAuth: (admin, accessToken) => {
        // The http client reads the token from its own module cell, so it has
        // to be told separately — the store is the mirror, not the source.
        setAccessToken(accessToken);
        set({ admin, accessToken, status: 'authenticated' }, false, 'auth/setAuth');
      },

      clearAuth: () => {
        setAccessToken(null);
        set(
          { admin: null, accessToken: null, status: 'unauthenticated' },
          false,
          'auth/clearAuth',
        );
      },

      setAdmin: (admin) => set({ admin }, false, 'auth/setAdmin'),

      updateAccessToken: (token) => {
        setAccessToken(token);
        set({ accessToken: token }, false, 'auth/updateAccessToken');
      },

      setStatus: (status) => set({ status }, false, 'auth/setStatus'),
    }),
    { name: 'AuthStore' },
  ),
);
