import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { env } from '@/env';
import { REFRESH_COOKIE, refreshCookieOptions } from '../cookie';

/**
 * Trade the httpOnly refresh cookie for a fresh access token.
 *
 * This route exists so the refresh token never touches JavaScript. The browser
 * posts here with no body; the cookie rides along automatically; we call the
 * backend server-side and hand back only the access token. The new refresh
 * token replaces the cookie and is never serialised into the response.
 *
 * Rotation on the backend is mandatory and single-use. Replaying a spent
 * refresh token answers 401 `refresh_reused` and revokes the entire token
 * family, signing the admin out of every device — so the cookie MUST be
 * replaced on every success, and on failure it MUST be cleared rather than
 * left in place for a second attempt that would look like a replay.
 */
export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ code: 'refresh_missing' }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${env.API_URL}/admin/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
  } catch {
    // The backend is unreachable. The cookie is still valid, so leave it be —
    // clearing it here would turn a blip into a forced sign-out.
    return NextResponse.json({ code: 'network_error' }, { status: 502 });
  }

  const body = (await upstream.json().catch(() => null)) as
    | { accessToken?: string; refreshToken?: string; code?: string }
    | null;

  if (!upstream.ok || !body?.accessToken || !body?.refreshToken) {
    // Expired, revoked, or already spent. Drop the cookie: it cannot buy
    // anything any more, and keeping it invites a reuse that revokes the family.
    //
    // `refresh_reused` is not worth special-casing into "keep the cookie". By
    // the time we see it the backend has already revoked every token in the
    // family, so the cookie is dead either way — and a dead cookie left in
    // place is worse than none, because `proxy.ts` bounces /login back to
    // /dashboard for as long as one exists. The race itself is prevented on the
    // client, by the cross-tab lock in `shared/lib/http`.
    const failed = NextResponse.json(
      { code: body?.code ?? 'refresh_invalid' },
      { status: upstream.status === 401 ? 401 : 502 },
    );
    failed.cookies.set(REFRESH_COOKIE, '', { ...refreshCookieOptions(), maxAge: 0 });
    return failed;
  }

  const res = NextResponse.json({ access: body.accessToken });
  res.cookies.set(REFRESH_COOKIE, body.refreshToken, refreshCookieOptions());
  return res;
}
