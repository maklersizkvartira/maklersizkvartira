import { NextRequest, NextResponse } from 'next/server';
import { REFRESH_COOKIE, refreshCookieOptions } from '../cookie';

/**
 * Park the refresh token the login response returned into an httpOnly cookie.
 *
 * The backend hands both tokens back in the JSON body and sets no cookies of
 * its own, so this hop is what gets the long-lived half out of JavaScript's
 * reach. It is the only moment the refresh token is visible to page code, and
 * it is discarded immediately afterwards.
 */
export async function POST(req: NextRequest) {
  const { refresh } = (await req.json().catch(() => ({}))) as { refresh?: string };

  if (!refresh) {
    return NextResponse.json({ code: 'refresh_missing' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(REFRESH_COOKIE, refresh, refreshCookieOptions());
  return res;
}
