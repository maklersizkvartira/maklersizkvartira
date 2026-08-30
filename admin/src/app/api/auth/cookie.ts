/**
 * The one definition of the refresh cookie.
 *
 * Three routes set or clear it and they have to agree exactly — a `maxAge` that
 * drifted out of step with the backend's token lifetime is how the previous
 * version ended up advertising a 7-day cookie for a token the API only honours
 * for one day, which showed up as an admin being signed out mid-session with no
 * explanation.
 */

/**
 * Deliberately NOT renamed by the Uyiz rebrand: the name carries no brand, so
 * there is nothing to rebrand, and moving it would sign every admin out at once
 * — `proxy.ts` gates every protected route on `cookies.has('refresh_token')` by
 * literal, and the three routes under `/api/auth` set and clear this exact
 * name. The three cross-tab names in `shared/lib/http.ts` are the ones that did
 * move.
 */
export const REFRESH_COOKIE = 'refresh_token';

/**
 * The backend's refresh TTL is ONE DAY, not the seven that the CRM this panel
 * came from used. Outliving the token buys nothing and costs a confusing
 * failure: the browser keeps presenting a credential the server has already
 * forgotten.
 *
 * `httpOnly` keeps it out of JavaScript's reach, which is the entire point of
 * routing refresh through the server. `sameSite: 'lax'` still sends it on the
 * top-level navigation that follows a sign-in while blocking cross-site POSTs.
 */
export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24,
  };
}
