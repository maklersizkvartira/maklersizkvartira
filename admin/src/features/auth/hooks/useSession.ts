'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getMe } from '../api';
import { useAuthStore } from '@/store/auth.store';
import { ApiError, getAccessToken, refreshSession } from '@/shared/lib/http';

/**
 * Restore the session on a cold load, and report where that got to.
 *
 * The access token lives in memory, so a refresh or a direct link to a deep
 * page starts with nothing. The refresh cookie is still there though, and
 * `refreshSession()` will trade it for a new pair — that exchange is what this
 * hook drives, followed by `/admin/auth/me` to learn who we are and what rank
 * they hold.
 *
 * The exchange goes through the http client's `refreshSession` rather than a
 * bare POST of its own. Rotation is one-shot and a replay revokes the whole
 * token family, so there must be exactly one refresh code path in the panel —
 * the one that holds the cross-tab lock.
 *
 * The layout should render a splash while `status` is 'idle' or 'loading',
 * send the browser to /login on 'unauthenticated', and offer `retry` on
 * 'error' — which means the API never answered, not that the session is gone.
 */
export function useSession() {
  const admin = useAuthStore((s) => s.admin);
  const status = useAuthStore((s) => s.status);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setStatus = useAuthStore((s) => s.setStatus);

  // React runs effects twice in development's strict mode, and a doubled
  // refresh is not a doubled no-op here: rotation is one-shot, and replaying a
  // spent refresh token revokes the whole family and signs the admin out.
  const started = useRef(false);

  const bootstrap = useCallback(async () => {
    if (useAuthStore.getState().status === 'authenticated') return;

    setStatus('loading');

    try {
      if (!getAccessToken()) {
        const outcome = await refreshSession();
        if (!outcome.ok) {
          // A backend that never answered is not a rejected session. Clearing
          // here would redirect to /login, which the middleware bounces back to
          // /dashboard for as long as the cookie exists — the tab would sit on
          // the splash with no way out.
          if (outcome.reason === 'unreachable') setStatus('error');
          else clearAuth();
          return;
        }
      }

      const account = await getMe();
      setAuth(account, getAccessToken()!);
    } catch (error) {
      // Only the server actually refusing the session ends it.
      //
      // This used to clear on everything except status 0, so a 500 from
      // `/admin/auth/me`, a 502 from an API restarting behind the proxy or a
      // 503 during a deploy all read as "you are signed out" — while the
      // refresh cookie was still perfectly valid. `clearAuth` sends the shell
      // to /login, the middleware sees that cookie and bounces it straight
      // back to /dashboard, and the bootstrap has already run: the tab sat on
      // the splash for ever, with no error, no retry and no reachable sign-in
      // page. A transient 5xx locked an administrator out of the panel until
      // they knew to hand-edit the URL.
      //
      // 401 and 403 are the two the server uses to say no. Everything else —
      // including status 0, the client's own marker for a request that never
      // reached the server at all — is an outage, and an outage is retryable.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        clearAuth();
      } else {
        setStatus('error');
      }
    }
  }, [clearAuth, setAuth, setStatus]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void bootstrap();
  }, [bootstrap]);

  /**
   * Try the bootstrap again after an 'error'. Driven by a button rather than a
   * timer: the backend being down is exactly when a self-restarting loop would
   * hammer it, and the admin knows better than we do when it is back.
   */
  const retry = useCallback(() => {
    if (useAuthStore.getState().status === 'loading') return;
    void bootstrap();
  }, [bootstrap]);

  return { admin, status, role: admin?.role ?? null, retry };
}
