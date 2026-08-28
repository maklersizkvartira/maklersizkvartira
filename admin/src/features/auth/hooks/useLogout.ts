'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/i18n/routing';
import { useAuthStore } from '@/store/auth.store';
import { getAccessToken } from '@/shared/lib/http';

/**
 * Sign the current staff account out, everywhere.
 *
 * Three things have to happen and all three matter:
 *
 * 1. `/api/auth/logout` relays the access token to the backend, which bumps
 *    `token_version` and so invalidates every access token the account holds —
 *    including any issued to another device — and clears the refresh cookie in
 *    the same response.
 * 2. The store drops the in-memory access token.
 * 3. `queryClient.clear()` empties the cache. The query client is a module
 *    singleton that survives sign-out, so skipping this hands the next admin to
 *    sign in on this tab the previous one's users, listings and audit rows
 *    straight out of memory — data they may have no rank to see.
 *
 * Nothing here throws. A logout that fails halfway and leaves the UI signed in
 * is the worst possible outcome, so the local teardown runs unconditionally.
 */
export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useCallback(async () => {
    const token = getAccessToken();
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch {
      // Offline. The refresh cookie outlives us by at most a day and the
      // access token by half an hour; there is nothing further to do here.
    }
    clearAuth();
    queryClient.clear();
    router.replace('/login');
  }, [clearAuth, queryClient, router]);
}
