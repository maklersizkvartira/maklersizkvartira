import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/env';
import { REFRESH_COOKIE, refreshCookieOptions } from '../cookie';

/**
 * End the session on both sides in one round trip.
 *
 * The backend's logout needs the access token, which only the browser holds, so
 * the client forwards it in the Authorization header and this route relays it.
 * That call bumps the account's `token_version`, which kills every access token
 * issued to it anywhere — the point being that signing out on one machine signs
 * you out on all of them.
 *
 * The cookie is cleared whatever the backend says. A logout that half-fails and
 * leaves a usable refresh token behind is worse than one that reports an error,
 * so the teardown is unconditional and the upstream status is only reported.
 */
export async function POST(req: NextRequest) {
  const authorization = req.headers.get('authorization');

  let revoked = false;
  if (authorization) {
    try {
      const upstream = await fetch(`${env.API_URL}/admin/auth/logout`, {
        method: 'POST',
        headers: { Authorization: authorization, Accept: 'application/json' },
        cache: 'no-store',
      });
      revoked = upstream.ok;
    } catch {
      // Offline, or the API is down. The tokens expire on their own; the local
      // teardown below still happens.
    }
  }

  const res = NextResponse.json({ ok: true, revoked });
  res.cookies.set(REFRESH_COOKIE, '', { ...refreshCookieOptions(), maxAge: 0 });
  return res;
}
