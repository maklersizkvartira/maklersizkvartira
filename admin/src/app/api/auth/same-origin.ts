import type { NextRequest } from 'next/server';

/**
 * Whether this request came from the panel itself.
 *
 * These three routes are state-changing and take no CSRF token, and one of
 * them — `set-refresh` — writes whatever string it is handed straight into the
 * httpOnly refresh cookie. `sameSite: 'lax'` stops the cookie being SENT on a
 * cross-site POST; it does nothing to stop a cross-site POST from arriving and
 * setting one. A cross-origin `fetch` with `Content-Type: application/json`
 * would be stopped by the preflight, but a plain HTML form can POST
 * `text/plain` with no preflight at all, and `req.json()` parses the body
 * whatever the content type says — so any page on the web could plant its own
 * refresh token in an administrator's browser and have them work inside an
 * attacker-controlled session, with everything they did visible from it.
 *
 * `Origin` is set by the browser on every POST and cannot be forged by page
 * script. When it is absent (a same-origin navigation in some older browsers,
 * or a server-to-server call) `Referer` is the fallback; when neither is
 * present the request is refused, because every legitimate caller here is a
 * `fetch` from this panel's own pages and browsers always send at least one.
 */
export function isSameOrigin(req: NextRequest): boolean {
  const self = req.nextUrl.origin;
  const origin = req.headers.get('origin');
  if (origin) return origin === self;

  const referer = req.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).origin === self;
    } catch {
      return false;
    }
  }
  return false;
}
