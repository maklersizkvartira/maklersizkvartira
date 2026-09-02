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

/**
 * THIS MUST EQUAL THE VERCEL PRIMARY DOMAIN, EXACTLY.
 *
 * Not "the brand domain" and not "a domain that works" — the one host that
 * answers 200. A canonical pointing at a URL that answers 308 is a conflicting
 * instruction: Search Console files every such page under "Page with redirect
 * — not indexed", and hreflang annotations whose targets redirect are discarded
 * wholesale, which silently breaks the uz/ru/en cluster. Nothing looks wrong
 * while that happens. The build is green, `seo:audit` passes (it compares paths
 * with the host stripped, on purpose), and visitors land on the right page.
 *
 * uyiz.uz was made Primary on 2026-09-02, with www.uyiz.uz redirecting to it,
 * which is why this line reads as it does. If that is ever reversed in the
 * Vercel dashboard, this constant and the two copies named above have to move
 * with it in the same change — the two layers may never disagree.
 *
 * VERIFY, don't assume:  curl -sI https://uyiz.uz/  ->  200, not 308.
 *
 * The old host keeps its own 301s to here (vercel.json), and those may not be
 * added until this origin is live and serving its own canonical. A
 * `permanent: true` redirect aimed at a host that is not yet answering takes
 * the site down AND is cached by every browser that sees it once, so the
 * outage outlives the fix. The redirect rules live in vercel.json rather than
 * beside this note because that file is validated against a strict schema: an
 * extra key, even an underscore-prefixed one meant as a comment, makes Vercel
 * reject the whole configuration and refuse to build.
 *
 * The default below is not load-bearing in production. VITE_SITE_URL (Vercel)
 * and SITE_URL (Railway) override it, and they are what the deployed site
 * actually reads — an edit here with the dashboard variable left on the old
 * value changes nothing that a crawler can see.
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
