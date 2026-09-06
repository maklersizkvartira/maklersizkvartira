import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

// The Uyiz admin API has no staff self-registration and no admin password
// reset — an account is created by a superadmin and its password is set there —
// so /login is the only unauthenticated page left.
const PUBLIC_PATHS = ['/login', '/api/auth'];
const DASHBOARD_ROOT = '/dashboard';

// Kept in sync with routing.locales; uz leads because it is the default.
const LOCALE_PREFIX = /^\/(uz|ru|en)(\/|$)/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasRefreshToken = request.cookies.has('refresh_token');

  // Skip localization and the auth check for the API and Next's own internals.
  //
  // Static files are NOT tested for here any more. The third arm used to be
  // `pathname.includes('.')`, which was meant to catch assets but matches route
  // pathnames just as happily: `/uz/users/some.id`, or any future slug carrying
  // a dot, returned early and so skipped BOTH the auth redirect and
  // `intlMiddleware` — a signed-out visitor was never bounced to /login and
  // next-intl never resolved a locale for the request. The `matcher` below
  // already excludes `_next/static`, `_next/image` and every asset extension
  // this panel serves, which made the substring test redundant as well as
  // wrong. A new asset type belongs in that matcher, never back here.
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    return NextResponse.next();
  }

  // Helper to check if a pathname matches public paths (ignoring locale prefix)
  const isPublicPath = (path: string) => {
    const normalizedPath = path.replace(LOCALE_PREFIX, '/');
    return PUBLIC_PATHS.some((p) => normalizedPath === p || normalizedPath.startsWith(p + '/'));
  };

  const isRootPath = (path: string) => {
    const normalizedPath = path.replace(LOCALE_PREFIX, '/');
    return normalizedPath === '/';
  };

  const isPublic = isPublicPath(pathname);

  if (isPublic) {
    const normalizedPath = pathname.replace(LOCALE_PREFIX, '/');
    if (normalizedPath === '/login') {
      if (request.nextUrl.searchParams.has('reauth')) {
        const response = intlMiddleware(request);
        response.cookies.delete('refresh_token');
        return response;
      }
    }
    return intlMiddleware(request);
  }

  // Root path — redirect based on auth status
  if (isRootPath(pathname)) {
    const locale = pathname.match(LOCALE_PREFIX)?.[1] ?? routing.defaultLocale;
    const target = hasRefreshToken ? `/${locale}${DASHBOARD_ROOT}` : `/${locale}/login`;
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Protected routes
  if (!hasRefreshToken) {
    const locale = pathname.match(LOCALE_PREFIX)?.[1] ?? routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    const normalizedPath = pathname.replace(LOCALE_PREFIX, '/');
    loginUrl.searchParams.set('redirect', normalizedPath);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, static images
     */
    // `\\.` , not `\.`: this is a normal string literal, so a single backslash
    // is dropped before the regex ever sees it and the dot would match any
    // character.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp)).*)',
  ],
};
