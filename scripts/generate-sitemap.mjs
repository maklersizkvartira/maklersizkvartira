/**
 * Generates the sitemaps and robots.txt into dist/.
 *
 * The shipped `public/sitemap.xml` listed two URLs, one of which (`/search`)
 * had never existed. It is replaced by a sitemap index with two children,
 * split by how often they change:
 *
 *   sitemap-pages.xml     static, written here at build time — the home page,
 *                         every category, every region, every Tashkent
 *                         district, the guides and the help centre, each in
 *                         all three languages with hreflang alternates.
 *   sitemap-listings.xml  dynamic, served by the API and proxied onto this
 *                         domain by a Vercel rewrite, because listings appear
 *                         and expire between deploys and a build-time copy
 *                         would be stale the day after it shipped.
 *
 * Both live on uyiz.uz. A sitemap that lists URLs for a host it is not served
 * from is only honoured when both hosts are verified in Search Console, and
 * publishing canonical URLs from a *.up.railway.app subdomain is not a thing
 * to build on.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ENTRY = path.join(ROOT, '.prerender', 'entry-server.js');

/*
 * The origin, again.
 *
 * This script is plain Node and cannot import src/seo/config.ts, so the
 * default is duplicated here on purpose. It must match `RAW_SITE_URL` there
 * and the absolute URLs in index.html; if the canonical tags and the sitemap
 * ever disagree about the host, nothing in the build catches it — the audit
 * strips the host before comparing. Setting VITE_SITE_URL makes both
 * defaults moot, which is how it should be deployed.
 */
// The host that answers 200 — the Vercel Primary Domain, not merely the brand.
// A <loc> pointing at a URL that redirects is dropped as "Page with redirect".
// See the long note in src/seo/config.ts; the two defaults flip together.
const SITE_URL = (process.env.VITE_SITE_URL || 'https://uyiz.uz').replace(/\/+$/, '');

/** Private and duplicate surfaces. Also `noindex` in the page head itself: */
/* robots.txt only stops the crawl, and a URL linked from elsewhere can still
   be indexed without ever being fetched. */
const DISALLOWED = [
  // The sign-in flow. Thin content that would compete with the pages that
  // actually answer a search, and there is nothing on it for a crawler.
  '/login',
  '/register',
  '/forget-password',
  '/profil',
  '/saqlanganlar',
  '/mening-elonlarim',
  '/elon-berish',
  '/tasdiqlash',
  '/dostni-taklif-qilish',
  '/xabarlar',
  '/admin',
  '/api/',
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absolute(routePath) {
  return `${SITE_URL}${routePath === '/' ? '/' : routePath}`;
}

/**
 * How many public listings each facet has, straight from the API.
 *
 * Best-effort by design: an unreachable API means every page goes in, which is
 * the same behaviour as before this check existed. Failing the build because a
 * count could not be fetched would be a worse outcome than a slightly generous
 * sitemap.
 */
async function fetchFacets() {
  const apiUrl = process.env.VITE_API_URL;
  if (!apiUrl) {
    console.log('sitemap: VITE_API_URL is unset — including every page');
    return null;
  }
  try {
    const { origin } = new URL(apiUrl);
    const response = await fetch(`${origin}/api/v1/meta/seo-facets`, {
      signal: AbortSignal.timeout(15_000),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    return body?.data ?? null;
  } catch (error) {
    console.warn(`sitemap: could not read facet counts (${error.message}) — including every page`);
    return null;
  }
}

/**
 * Whether a generated page currently has anything to show.
 *
 * A page with an empty grid is thin content. It stays on the site — its links
 * still lead somewhere, and it fills up again as soon as an owner posts — but
 * there is no reason to invite a crawler to it, and the page marks itself
 * `noindex` at runtime for the same reason.
 */
function hasInventory(page, facets) {
  if (!facets) return true;
  const { region, district, category } = page.route;

  if (district && !(facets.districts?.[district.name] > 0)) return false;
  if (region && !district && !(facets.regions?.[region.name] > 0)) return false;

  if (category) {
    const filters = category.filters ?? {};
    if (filters.propertyType && !(facets.propertyTypes?.[filters.propertyType] > 0)) {
      return false;
    }
    if (filters.rentalType === 'ROOMMATE' && !(facets.roommate > 0)) return false;
  }
  return true;
}

function urlEntry({ loc, alternates, lastmod, changefreq, priority }) {
  const lines = [`  <url>`, `    <loc>${escapeXml(loc)}</loc>`];
  for (const alternate of alternates) {
    lines.push(
      `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}"/>`,
    );
  }
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) lines.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority !== undefined) lines.push(`    <priority>${priority.toFixed(1)}</priority>`);
  lines.push('  </url>');
  return lines.join('\n');
}

async function main() {
  if (!existsSync(ENTRY)) {
    throw new Error(
      `sitemap: ${path.relative(ROOT, ENTRY)} is missing. ` +
        'Run `vite build --ssr src/entry-server.tsx` first.',
    );
  }

  // The same bundle the prerenderer used, so the sitemap and the generated
  // files cannot disagree about a single address.
  const { INDEXABLE_PAGES, LANGUAGES, alternatePaths } = await import(
    pathToFileURL(ENTRY).href
  );

  // Build date, not content date: these pages are generated from copy that
  // changes when the code does.
  const lastmod = new Date().toISOString().slice(0, 10);

  const facets = await fetchFacets();
  const included = INDEXABLE_PAGES.filter((page) => hasInventory(page, facets));
  const pruned = INDEXABLE_PAGES.length - included.length;

  const entries = [];
  for (const page of included) {
    const paths = alternatePaths(page.path);

    const alternates = [
      ...LANGUAGES.map((code) => ({
        hreflang: code,
        href: absolute(paths[code]),
      })),
      { hreflang: 'x-default', href: absolute(paths.uz) },
    ];

    for (const code of LANGUAGES) {
      entries.push(
        urlEntry({
          loc: absolute(paths[code]),
          alternates,
          lastmod,
          changefreq: page.changefreq,
          // Translations sit slightly below the Uzbek original, which is the
          // primary market and the x-default.
          priority: code === 'uz' ? page.priority : Math.max(0.1, page.priority - 0.1),
        }),
      );
    }
  }

  const pagesXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');

  const indexXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <sitemap>',
    `    <loc>${SITE_URL}/sitemap-pages.xml</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    '  </sitemap>',
    '  <sitemap>',
    `    <loc>${SITE_URL}/sitemap-listings.xml</loc>`,
    '  </sitemap>',
    '</sitemapindex>',
    '',
  ].join('\n');

  const robotsTxt = [
    `# ${SITE_URL}`,
    '',
    'User-agent: *',
    'Allow: /',
    '',
    '# Signed-in surfaces and the API. Nothing here is useful in a search',
    '# result, and crawling it only spends crawl budget that the listing',
    '# pages need.',
    // Every private surface exists three times over — /profil, /ru/profil and
    // /en/profil are three different URLs and only the first was disallowed.
    // Derived from LANGUAGES rather than written out, so a fourth language
    // cannot quietly reopen them. /admin and /api/ are not language-prefixed.
    ...DISALLOWED.flatMap((rule) =>
      rule === '/api/' || rule === '/admin'
        ? [rule]
        : [rule, ...LANGUAGES.filter((code) => code !== 'uz').map((code) => `/${code}${rule}`)],
    ).map((rule) => `Disallow: ${rule}`),
    '',
    '# Filter and tracking parameters. The canonical page is the clean path;',
    '# these produce endless near-identical variants of it.',
    'Disallow: /*?view=',
    'Disallow: /*?listing=',
    'Disallow: /*?lang=',
    'Disallow: /*?utm_',
    '',
    '# Some crawlers hammer a listings site hard enough to matter. This is a',
    '# request, not a guarantee — Googlebot ignores it and is throttled in',
    '# Search Console instead.',
    'User-agent: AhrefsBot',
    'Crawl-delay: 10',
    '',
    'User-agent: SemrushBot',
    'Crawl-delay: 10',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');

  await mkdir(DIST, { recursive: true });
  await writeFile(path.join(DIST, 'sitemap-pages.xml'), pagesXml, 'utf8');
  await writeFile(path.join(DIST, 'sitemap.xml'), indexXml, 'utf8');
  await writeFile(path.join(DIST, 'robots.txt'), robotsTxt, 'utf8');

  console.log(
    `sitemap: ${entries.length} URLs across ${LANGUAGES.length} languages ` +
      `(${included.length} pages), plus robots.txt`,
  );
  if (pruned > 0) {
    // Named, not silent: a build that quietly drops thirty pages from the
    // sitemap looks identical to one that covered everything.
    console.log(
      `sitemap: left out ${pruned} page(s) whose facet currently has no listings`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
