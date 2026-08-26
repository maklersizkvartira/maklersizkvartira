/**
 * Site-level SEO constants.
 *
 * `SITE_URL` is the one place the canonical origin is written down. Canonical
 * tags, hreflang alternates, Open Graph URLs, JSON-LD `@id`s and both sitemaps
 * derive from it, so a domain change is a one-line change and cannot leave
 * half the site pointing at the old host.
 */

const RAW_SITE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL) ||
  'https://maklersizuy.uz';

/** No trailing slash: every path in this codebase starts with one. */
export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, '');

export const SITE_NAME = 'Maklersiz Uy';

/** Legal entity name used in Organization structured data. */
export const ORGANISATION_NAME = 'Maklersiz Uy';

export const OG_IMAGE_PATH = '/brand/og-image.png';
export const LOGO_PATH = '/logo-org.png';

export const CONTACT = {
  phones: ['+998937188885', '+998777850737'],
  email: 'support@maklersizuy.uz',
  telegram: 'https://t.me/maklersizuy',
  instagram: 'https://www.instagram.com/maklersizuy.uz/',
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
