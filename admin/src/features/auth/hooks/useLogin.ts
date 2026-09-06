'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/i18n/routing';
import { login } from '../api';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/shared/lib/http';
import type { LoginFormValues } from '../schemas';

/**
 * Sign a staff account in.
 *
 * The two halves of the token pair are stored very differently on purpose. The
 * access token goes into memory only, where a reload loses it and no script can
 * read it out of storage. The refresh token is handed to our own Next.js route,
 * which writes it as an httpOnly cookie — so the long-lived credential is the
 * one JS cannot touch, and the short-lived one is the only thing the page ever
 * holds. That is strictly better than the usual localStorage pair, and it is
 * why the refresh path goes through `/api/auth/refresh` rather than calling the
 * backend directly.
 *
 * The cache is cleared before the redirect because the query client is a
 * module singleton: without this, signing in as a second admin in the same tab
 * paints the previous admin's rows until each query happens to refetch.
 */
export function useLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (payload: LoginFormValues) => login(payload),
    onSuccess: async (result) => {
      queryClient.clear();
      setAuth(result.admin, result.accessToken);

      // Checked, not fired and forgotten.
      //
      // The cookie this writes is the whole session: the access token lives in
      // memory and is gone on the next reload, and `proxy.ts` gates every
      // protected route on the cookie's presence. So a `set-refresh` that
      // failed — offline for the half-second after the login POST returned, a
      // 403 from the new same-origin guard, a 500 — used to be swallowed, and
      // the redirect went ahead anyway: the middleware saw no cookie and sent
      // the admin straight back to the login form, with correct credentials,
      // no error, and nothing on screen to explain it. Throwing here puts the
      // mutation into its error state, which the form already renders.
      const parked = await fetch('/api/auth/set-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: result.refreshToken }),
      }).catch(() => null);

      if (!parked?.ok) {
        throw new ApiError(
          parked?.status ?? 0,
          'session_not_stored',
          'The session could not be stored in this browser.',
        );
      }

      router.replace('/dashboard');
    },
  });
}
