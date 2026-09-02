/**
 * Audits the built site in dist/ and fails the run on anything broken.
 *
 * It reads the HTML that will actually be served, not the source that
 * produced it. Almost every SEO regression this codebase could have — a title
 * repeated across a hundred pages, a canonical left pointing at "/", a
 * generated link to a page that was never generated, an `index` directive on
 * a private screen — is invisible in the source and obvious in the output.
 *
 *   node scripts/seo-audit.mjs            report and exit non-zero on errors
 *   node scripts/seo-audit.mjs --warn     report everything, always exit 0
 *
 * No HTML parser: regular expressions are enough for tags this build writes
 * itself, and a parser would be a dependency for one script.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const WARN_ONLY = process.argv.includes('--warn');

const TITLE_MAX = 65;
const DESCRIPTION_MIN = 70;
const DESCRIPTION_MAX = 165;

const errors = [];
const warnings = [];

const fail = (page, message) => errors.push(`${page}: ${message}`);
const warn = (page, message) => warnings.push(`${page}: ${message}`);

// ---------------------------------------------------------------------------
// Tiny HTML readers
// ---------------------------------------------------------------------------
const one = (html, pattern) => {
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
};

const all = (html, pattern) => [...html.matchAll(pattern)].map((match) => match[1]);

const readers = {
  title: (html) => one(html, /<title>([\s\S]*?)<\/title>/i),
  description: (html) =>
    one(html, /<meta\s+name="description"\s+content="([^"]*)"/i),
  robots: (html) => one(html, /<meta\s+name="robots"\s+content="([^"]*)"/i),
  canonical: (html) =>
    one(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i),
  lang: (html) => one(html, /<html\s+lang="([^"]*)"/i),
  ogImage: (html) => one(html, /<meta\s+property="og:image"\s+content="([^"]*)"/i),
  h1s: (html) => all(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi),
  hreflangs: (html) =>
    [...html.matchAll(/<link\s+rel="alternate"\s+hreflang="([^"]*)"\s+href="([^"]*)"/gi)].map(
      (match) => ({ hreflang: match[1], href: match[2] }),
    ),
  jsonLd: (html) =>
    all(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi),
  hrefs: (html) => all(html, /<a\b[^>]*\shref="(\/[^"#?]*)"/gi),
  imgs: (html) => [...html.matchAll(/<img\b([^>]*)>/gi)].map((match) => match[1]),
};

const stripTags = (value) => (value ?? '').replace(/<[^>]*>/g, '').trim();

/** Readable text only: script bodies are not prose and skew every ratio. */
const bodyText = (html) =>
  html
    .slice(html.indexOf('<body'))
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const countOf = (text, pattern) => (text.match(pattern) || []).length;

// ---------------------------------------------------------------------------
async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

/** `dist/ru/toshkent/index.html` -> `/ru/toshkent`. */
function urlOf(file) {
  const relative = path.relative(DIST, file).split(path.sep).join('/');
  if (relative === 'index.html') return '/';
  if (relative === '404.html') return '/404';
  return `/${relative.replace(/\/index\.html$/, '').replace(/\.html$/, '')}`;
}

/** Does this path resolve to a file the host will serve? */
function resolves(urlPath, files) {
  if (files.has(urlPath)) return true;
  // Listing URLs are rewritten to the `/e` shell; only the shell is on disk.
  if (/^(\/(ru|en))?\/e\/[^/]+$/.test(urlPath)) {
    const prefix = urlPath.startsWith('/ru/') ? '/ru' : urlPath.startsWith('/en/') ? '/en' : '';
    return files.has(`${prefix}/e`);
  }
  return false;
}

// ---------------------------------------------------------------------------
async function main() {
  if (!existsSync(DIST)) {
    console.error('seo-audit: dist/ does not exist. Run `npm run build` first.');
    process.exit(1);
  }

  const files = await walk(DIST);
  const pages = new Map();

  for (const file of files) {
    const html = await readFile(file, 'utf8');
    pages.set(urlOf(file), { file, html, size: (await stat(file)).size });
  }

  const known = new Set(pages.keys());
  const titles = new Map();
  const descriptions = new Map();
  const canonicals = new Map();
  const linkedTo = new Set();
  /** Header navigation labels per URL, for the chrome-language check below. */
  const chrome = new Map();

  for (const [url, page] of pages) {
    const { html } = page;
    const title = stripTags(readers.title(html));
    const description = readers.description(html);
    const robots = readers.robots(html) ?? '';
    const canonical = readers.canonical(html);
    const indexable = !/noindex/i.test(robots);
    const isListingShell = /^(\/(ru|en))?\/e$/.test(url);
    const is404 = url === '/404';

    // -- Title ------------------------------------------------------------
    if (!title) fail(url, 'no <title>');
    else if (title.length > TITLE_MAX) {
      warn(url, `title is ${title.length} chars, over ${TITLE_MAX} (SERP truncates it)`);
    }
    if (title && indexable) {
      if (!titles.has(title)) titles.set(title, []);
      titles.get(title).push(url);
    }

    // -- Description ------------------------------------------------------
    if (!description) fail(url, 'no meta description');
    else if (indexable && description.length < DESCRIPTION_MIN) {
      warn(url, `description is only ${description.length} chars`);
    } else if (description.length > DESCRIPTION_MAX) {
      warn(url, `description is ${description.length} chars, over ${DESCRIPTION_MAX}`);
    }
    if (description && indexable) {
      if (!descriptions.has(description)) descriptions.set(description, []);
      descriptions.get(description).push(url);
    }

    // -- Robots and canonical ---------------------------------------------
    if (!robots) fail(url, 'no robots meta');
    // Two documents legitimately declare none: the listing shell, which is
    // served for thousands of different URLs, and the 404 document, whose
    // address is whatever the visitor mistyped. In both cases the requested
    // URL is the right canonical and naming one would be a lie.
    if (!canonical && !isListingShell && !is404) fail(url, 'no canonical');
    if (canonical && indexable) {
      if (!canonicals.has(canonical)) canonicals.set(canonical, []);
      canonicals.get(canonical).push(url);
    }
    if (canonical && !/^https:\/\//.test(canonical)) {
      fail(url, `canonical is not an absolute https URL: ${canonical}`);
    }

    // -- Language ---------------------------------------------------------
    const lang = readers.lang(html);
    const expected = url.startsWith('/ru') ? 'ru' : url.startsWith('/en') ? 'en' : 'uz';
    if (lang !== expected) {
      fail(url, `<html lang="${lang}"> but the URL says ${expected}`);
    }

    // -- hreflang ---------------------------------------------------------
    const hreflangs = readers.hreflangs(html);
    if (indexable && !isListingShell && !is404) {
      if (hreflangs.length === 0) fail(url, 'indexable but declares no hreflang alternates');
      else {
        const codes = new Set(hreflangs.map((item) => item.hreflang));
        for (const required of ['uz', 'ru', 'en', 'x-default']) {
          if (!codes.has(required)) fail(url, `hreflang is missing "${required}"`);
        }
        // Reciprocity: every alternate must point at a page that exists.
        for (const { href } of hreflangs) {
          const target = href.replace(/^https:\/\/[^/]+/, '') || '/';
          if (!resolves(target, known)) {
            fail(url, `hreflang points at ${target}, which was not generated`);
          }
        }
      }
    }

    // -- Headings ---------------------------------------------------------
    const h1s = readers.h1s(html).map(stripTags).filter(Boolean);
    if (page.html.includes('<!--seo-body-start--><!--seo-body-end-->')) {
      // Head-only shell: no body was rendered, so no H1 is expected.
    } else if (h1s.length === 0) {
      if (indexable) fail(url, 'no <h1> in the rendered HTML');
    } else if (h1s.length > 1) {
      fail(url, `${h1s.length} <h1> elements: ${h1s.map((h) => `"${h}"`).join(', ')}`);
    }

    // -- Open Graph -------------------------------------------------------
    const ogImage = readers.ogImage(html);
    if (!ogImage) fail(url, 'no og:image');
    else if (!/^https?:\/\//.test(ogImage)) {
      fail(url, `og:image is not absolute (${ogImage}); most unfurlers drop it`);
    }

    // -- Structured data --------------------------------------------------
    for (const block of readers.jsonLd(html)) {
      try {
        const parsed = JSON.parse(block.replace(/\\u003c/g, '<'));
        if (!parsed['@context']) fail(url, 'JSON-LD block has no @context');
      } catch (error) {
        fail(url, `JSON-LD does not parse: ${error.message}`);
      }
    }

    // -- Images -----------------------------------------------------------
    for (const attrs of readers.imgs(html)) {
      if (!/\balt=/.test(attrs)) fail(url, 'an <img> has no alt attribute');
    }

    // -- Is the page actually in the language it claims? -------------------
    //
    // The copy packs load per language, and a page rendered before its pack
    // arrives falls back to another language's prose while its `lang`,
    // canonical and hreflang all still say otherwise. That bug shipped once
    // and neither the type checker nor any of the checks above saw it: every
    // tag was present, unique and well-formed. Only the words were wrong.
    const prose = bodyText(html);
    if (prose.length >= 200) {
      const cyrillic = countOf(prose, /[Ѐ-ӿ]/g);
      const ratio = cyrillic / prose.length;
      if (expected === 'ru' && ratio < 0.15) {
        fail(url, `declares Russian but its text is ${(ratio * 100).toFixed(1)}% Cyrillic — the pack probably fell back`);
      }
      if (expected !== 'ru' && cyrillic > 20) {
        fail(url, `declares ${expected} but contains ${cyrillic} Cyrillic characters`);
      }
    }

    // Header navigation, kept for the cross-language comparison after the loop.
    const nav = one(html, /(<nav[^>]*class="ml-2[\s\S]*?<\/nav>)/i);
    if (nav) {
      chrome.set(url, all(nav, />([^<>]{2,40})<\/a>/g).map((t) => t.trim()).join('|'));
    }

    // -- Is the dead brand still in the output? ----------------------------
    //
    // A rebrand is the one change that half-lands without anything breaking.
    // Titles, canonicals and JSON-LD stay well-formed and unique whether they
    // say Uyiz or the name the site stopped using; every check above passes
    // and the old brand ships to production on whichever pages were missed.
    // A string search over the served HTML is the only thing that sees it.
    //
    // Two things are skipped because they carry the old name on purpose.
    //
    // The storage-migration shim in index.html reads the pre-rebrand keys: it
    // is script, not prose or markup.
    //
    // And the HOSTS the site is served from, which still carry the old name
    // until the new domain resolves (see src/seo/config.ts). Every canonical,
    // hreflang and og:url legitimately contains one of them, so counting those
    // would fire this check on all 346 pages and mean nothing — and a check
    // that always fails is one people learn to ignore, which is exactly when a
    // real miss ships.
    //
    // Every transition host is stripped, not just the configured origin. That
    // matters because the origin is `VITE_SITE_URL` in the deployment
    // environment and only falls back to the constant here — so this file
    // cannot know which of them a given build used, and index.html hard-codes
    // its og:image on one of them regardless. Stripping only the configured
    // one made the check pass locally, where the variable is unset, and report
    // 297 errors on Vercel, where it is set to a different host. What is left
    // after the strip is prose and names, which is what this is guarding.
    //
    // The API host too, for the same reason and a sharper one. The Railway
    // service is called `maklersizkvartira-production`, and prerender.mjs
    // injects a preconnect and a dns-prefetch at it whenever VITE_API_URL is
    // set. That is infrastructure — a hostname no visitor reads and no crawler
    // treats as content — but it put the retired brand into the served HTML of
    // every page, twice, on Vercel and never locally, because the variable is
    // only set there. The check was failing on all 326 pages the whole time
    // and nobody saw it: the build ran the audit with `--warn`.
    //
    // Renaming the Railway service would be the other fix, and a worse one:
    // the service name is also the host in vercel.json's sitemap rewrite and
    // in every deployment URL, so it is not a rename, it is a migration.
    const apiOrigin = (() => {
      if (!process.env.VITE_API_URL) return null;
      try {
        return new URL(process.env.VITE_API_URL).origin;
      } catch {
        return null;
      }
    })();

    // Delete this list the day both old domains stop resolving.
    const TRANSITION_HOSTS = [
      process.env.VITE_SITE_URL,
      apiOrigin,
      'https://maklersizuy.uz',
      'https://www.maklersizuy.uz',
      'https://maklersiz.uz',
      'https://www.maklersiz.uz',
      'https://admin.maklersizuy.uz',
    ]
      .filter(Boolean)
      .map((host) => host.replace(/\/+$/, ''))
      // Longest first, so "https://www.maklersizuy.uz" is consumed whole
      // rather than leaving "www." in front of a stripped shorter host.
      .sort((a, b) => b.length - a.length);

    let shipped = html.replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>/gi, ' ');
    for (const host of TRANSITION_HOSTS) shipped = shipped.split(host).join(' ');
    for (const term of ['maklersizuy', 'maklersiz']) {
      const count = countOf(shipped, new RegExp(term, 'gi'));
      if (count > 0) {
        fail(url, `the retired brand "${term}" appears ${count}× in the served HTML`);
        break;
      }
    }

    // -- Links ------------------------------------------------------------
    for (const href of readers.hrefs(html)) {
      const target = href.replace(/\/$/, '') || '/';
      linkedTo.add(target);
      if (!resolves(target, known)) {
        fail(url, `links to ${target}, which was not generated`);
      }
    }
  }

  // -- Cross-page checks ---------------------------------------------------
  for (const [title, urls] of titles) {
    if (urls.length > 1) {
      fail(urls[0], `duplicate title across ${urls.length} pages ("${title}") — e.g. ${urls.slice(1, 4).join(', ')}`);
    }
  }
  for (const [description, urls] of descriptions) {
    if (urls.length > 1) {
      fail(urls[0], `duplicate meta description across ${urls.length} pages — e.g. ${urls.slice(1, 4).join(', ')}`);
    }
  }
  for (const [canonical, urls] of canonicals) {
    if (urls.length > 1) {
      fail(urls[0], `${urls.length} indexable pages share the canonical ${canonical}`);
    }
  }

  // -- Is the CHROME translated, not just the prose? -----------------------
  //
  // The language-ratio check above passes on a page whose headings and body
  // are Russian but whose navigation, footer and buttons are Uzbek: the prose
  // outweighs the labels. That is exactly what shipped when the prerenderer
  // registered the SEO copy packs and forgot the i18n dictionaries.
  //
  // Comparing a page against its own translation needs no language detection:
  // if `/toshkent` and `/ru/toshkent` render the same navigation labels, one
  // of the two is not translated.
  for (const [url, labels] of chrome) {
    if (url.startsWith('/ru') || url.startsWith('/en') || !labels) continue;
    for (const prefix of ['/ru', '/en']) {
      const other = chrome.get(url === '/' ? prefix : `${prefix}${url}`);
      if (other && other === labels) {
        fail(url, `its navigation is identical to ${prefix}${url === '/' ? '' : url} — one of them is untranslated chrome`);
      }
    }
  }

  // -- Sitemap -------------------------------------------------------------
  const sitemapFile = path.join(DIST, 'sitemap-pages.xml');
  if (!existsSync(sitemapFile)) {
    errors.push('dist/sitemap-pages.xml: not generated');
  } else {
    const xml = await readFile(sitemapFile, 'utf8');
    const locs = all(xml, /<loc>([^<]+)<\/loc>/g);
    if (locs.length === 0) errors.push('sitemap-pages.xml: contains no URLs');

    const inSitemap = new Set();
    for (const loc of locs) {
      const target = loc.replace(/^https:\/\/[^/]+/, '') || '/';
      inSitemap.add(target);
      if (!resolves(target, known)) {
        errors.push(`sitemap-pages.xml: lists ${target}, which was not generated`);
      }
      const page = pages.get(target);
      if (page && /noindex/i.test(readers.robots(page.html) ?? '')) {
        errors.push(`sitemap-pages.xml: lists ${target}, which is noindex`);
      }
    }

    // Orphans: indexable, in the sitemap, and linked from nowhere.
    for (const target of inSitemap) {
      if (target === '/' || target === '/ru' || target === '/en') continue;
      if (!linkedTo.has(target)) {
        warnings.push(`${target}: in the sitemap but no page links to it (orphan)`);
      }
    }
  }

  if (!existsSync(path.join(DIST, 'sitemap.xml'))) {
    errors.push('dist/sitemap.xml: sitemap index not generated');
  }

  const robotsFile = path.join(DIST, 'robots.txt');
  if (!existsSync(robotsFile)) errors.push('dist/robots.txt: not generated');
  else {
    const robots = await readFile(robotsFile, 'utf8');
    if (!/^Sitemap:\s*https:\/\//m.test(robots)) {
      errors.push('robots.txt: no absolute Sitemap: line');
    }
    if (/^Disallow:\s*\/\s*$/m.test(robots)) {
      errors.push('robots.txt: "Disallow: /" blocks the entire site');
    }
  }

  // -- Report --------------------------------------------------------------
  console.log(`seo-audit: checked ${pages.size} generated pages`);
  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const message of warnings.slice(0, 40)) console.log(`  ! ${message}`);
    if (warnings.length > 40) console.log(`  … and ${warnings.length - 40} more`);
  }
  if (errors.length > 0) {
    console.log(`\n${errors.length} error(s):`);
    for (const message of errors.slice(0, 60)) console.log(`  x ${message}`);
    if (errors.length > 60) console.log(`  … and ${errors.length - 60} more`);
    if (!WARN_ONLY) process.exit(1);
  } else {
    console.log('\nNo errors.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
