import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

/**
 * Resolve the message bundle from the URL segment, not from a cookie.
 *
 * The previous version read NEXT_LOCALE and ignored the `[locale]` segment
 * entirely, so /ru/dashboard could render Uzbek text for anyone whose cookie
 * said otherwise. `requestLocale` is the segment the router actually matched,
 * which keeps the URL and the bundle in lockstep.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = routing.locales.includes(requested as (typeof routing.locales)[number])
    ? (requested as (typeof routing.locales)[number])
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
