/**
 * Site-level SEO constants.
 *
 * `SITE_URL` is the one place the canonical origin is written down for
 * everything that goes through the TypeScript module graph. Canonical tags,
 * hreflang alternates, Open Graph URLs, JSON-LD `@id`s and the page sitemap
 * derive from it, so a domain change is a one-line change here and cannot
 * leave half the site pointing at the old host.
 *
 * Three copies of the origin live outside that graph and cannot import this
 * file. If the domain ever moves again, they move in the same commit:
 *
 *   scripts/generate-sitemap.mjs   a plain Node script, no bundler
 *   index.html                     the pre-hydration fallback head
 *   backend_python/app/core/config.py  builds sitemap-listings.xml
 *
 * Setting VITE_SITE_URL (frontend) and SITE_URL (backend) in the deployment
 * environment overrides all of them, which is the safer arrangement: then no
 * hard-coded default is load-bearing.
 */

const RAW_SITE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL) ||
  'https://uyiz.uz';

/** No trailing slash: every path in this codebase starts with one. */
export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, '');

export const SITE_NAME = 'Uyiz';

/** Legal entity name used in Organization structured data. */
export const ORGANISATION_NAME = 'Uyiz';

export const OG_IMAGE_PATH = '/brand/og-image.png';
export const LOGO_PATH = '/logo-org.png';

export const CONTACT = {
  phones: ['+998937188885', '+998777850737'],
  email: 'support@uyiz.uz',
  telegram: 'https://t.me/uyiz',
  instagram: 'https://www.instagram.com/uyiz.uz/',
} as const;

/** Where the platform operates, for LocalBusiness / areaServed. */
export const COUNTRY = { name: "O'zbekiston", code: 'UZ' } as const;

/**
 * Titles longer than this are truncated in the SERP, so the distinguishing
 * part of a title has to come before it. Enforced by the audit script.
 */
export const TITLE_MAX = 60;
export const DESCRIPTION_MIN = 70;
export const DESCRIPTION_MAX = 160;

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
