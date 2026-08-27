# SEO — how it works, and what to do next

This document is the operating manual for the search side of maklersizuy.uz:
the architecture that was built, why it is shaped the way it is, and the work
that is deliberately left.

> **Looking for what to actually do next? See [`SEO-QADAMLAR.md`](./SEO-QADAMLAR.md)** —
> deploy, Search Console, Bing/Yandex and analytics, step by step, in Uzbek.
> This file is the reference behind it.

---

## 1. What the site was, and why it could not rank

The frontend is a Vite + React single-page app, not Next.js. It had **no
router**: every screen lived at `/` behind a query parameter (`/?view=listings`,
`/?listing=<uuid>`), the host answered every URL with the same empty
`<div id="root">`, and `index.html` hard-coded

```html
<link rel="canonical" href="https://maklersizuy.uz/" />
```

on all of them. So the whole site was one page as far as a crawler was
concerned, that page contained zero indexable words before JavaScript ran, and
every URL that did exist declared itself a copy of the home page. There was
also not a single internal `<a href>` anywhere in `src/` — every destination
was a `<button onClick>` — so nothing below the entry point was discoverable by
crawling at all.

Everything below follows from fixing those four things.

---

## 2. URL architecture

Uzbek is the default and lives at the bare root. Russian and English live under
`/ru` and `/en`. **The URL is the only source of truth for which language a
page is in** — a stored preference may redirect a visitor to their prefix, but
it never changes what a given address renders. That rule is what makes the
hreflang tags true.

| Path | What it is |
| --- | --- |
| `/` | Home — brand, categories, hub links, FAQ |
| `/elonlar` | The full catalogue |
| `/xarita` | Map |
| `/kvartira-ijaraga`, `/uy-ijaraga`, `/xona-ijaraga`, `/studiya-ijaraga` | Property-type landing pages |
| `/sheriklikka-ijara`, `/talabalar-uchun-ijara`, `/oilalar-uchun-ijara`, `/arzon-ijara` | Audience / price landing pages |
| `/toshkent`, `/samarqand`, … (14) | Region hubs |
| `/toshkent/kvartira-ijaraga` (14 × 2) | Region × property type |
| `/toshkent/chilonzor` (12) | Tashkent district hubs |
| `/toshkent/chilonzor/kvartira-ijaraga` (12 × 2) | District × property type |
| `/e/<slug>-<uuid>` | One listing |
| `/blog`, `/blog/<slug>` (10) | Guides |
| `/yordam`, `/yordam/<slug>` (4) | Help centre, terms, privacy, safety |
| `/profil`, `/saqlanganlar`, `/elon-berish`, … | Signed-in screens — `noindex`, disallowed in robots.txt |

**107 indexable pages × 3 languages = 321 URLs**, plus every listing.

The route table lives in `src/seo/routes.ts` and the facet taxonomy in
`src/seo/taxonomy.ts`. `findSlugCollisions()` proves a district slug can never
be mistaken for a category slug, which is what keeps `/toshkent/<x>`
unambiguous.

### Why there are no "sotib olish" pages

The keyword brief asked for `uy sotiladi`, `kvartira sotib olish` and similar
sale intents. **The product has no sale side.** There is no sale concept
anywhere in the data model — `price` is monthly rent, the only transaction axis
is `FULL` vs `ROOMMATE`, and nothing in the API can express a property for
sale. Building sale landing pages would mean publishing pages with no matching
inventory: thin content that ranks briefly, converts nobody, and teaches Google
the domain is unreliable.

The rent architecture is built out completely instead, and it is where all the
current inventory is. When the product adds a sale side, the taxonomy takes a
second transaction axis and the same generator produces the sale tree — see
§8.

---

## 3. The build pipeline

```
npm run build
  ├─ tsc --noEmit                            type check
  ├─ vite build                       →  dist/            the client bundle
  ├─ vite build --ssr src/entry-server.tsx
  │                                   →  .prerender/      the renderer
  ├─ node scripts/prerender.mjs       →  dist/**/index.html
  └─ node scripts/generate-sitemap.mjs
                                      →  dist/sitemap*.xml, dist/robots.txt
```

**Prerendering.** `src/entry-server.tsx` renders every static page once per
language to real HTML with `react-dom/server` — no new package; it ships with
`react-dom`. It composes its own shell from direct imports rather than
rendering `App.tsx`, because twelve of `App`'s thirteen views are `React.lazy`
and `renderToStaticMarkup` is synchronous: prerendering the real app would have
produced 346 pages that each said "Yuklanmoqda".

The client mounts with `createRoot`, not `hydrateRoot`, so React discards the
static markup and re-renders. That is the intended trade — no hydration
mismatch class of bug, at the cost of one extra paint, during which the visitor
sees real content instead of a spinner.

**The head is built once, in one place.** `buildHead()` in `src/seo/meta.ts`
serves the prerenderer, the runtime `useSeoHead` hook and the audit script. The
HTML a crawler fetches and the DOM it renders after JavaScript therefore cannot
describe different pages — that divergence is what makes an SPA look like it is
cloaking without anyone intending it.

**Chunking.** `vite.config.ts` splits `firebase`, `maplibre`, `motion`,
`confetti` and `phosphor` out of the catch-all `vendor` chunk. The catch-all is
what makes a lazy import stop being lazy: anything it sweeps into `vendor`
rides along on the entry's modulepreload, which is how a 250KB-gzipped map
library ended up in front of the home page's first paint for visitors who never
open the map. Anything added to `package.json` that is loaded by one screen
needs a line there too.

**Verification.** `npm run seo:audit` reads `dist/` and fails on duplicate
titles or descriptions, a missing or non-absolute canonical, a missing or
duplicated `<h1>`, a missing `alt`, a broken internal link, malformed JSON-LD,
an `<html lang>` that disagrees with the URL, an hreflang pointing at a page
that was never generated, a sitemap listing a `noindex` page, and more.

Two of its checks exist because the bug they catch actually shipped, and
neither the type checker nor any tag-level check saw it: a page whose prose is
one language while its `lang` and canonical claim another, and a page whose
navigation is byte-identical to its own translation — which is what an
untranslated chrome looks like when the headings are translated and the labels
are not. It currently reports **zero errors**.

---

## 4. Sitemaps and robots.txt

`dist/sitemap.xml` is a sitemap **index** with two children, split by how often
they change:

- `sitemap-pages.xml` — generated at build time, 321 URLs, each with the full
  `xhtml:link` hreflang set.
- `sitemap-listings.xml` — served by FastAPI (`backend_python/app/routers/seo.py`)
  and proxied onto `maklersizuy.uz` by a Vercel rewrite, because listings
  appear and expire between deploys.

Both are on the site's own hostname. A sitemap that publishes URLs for a host
it is not served from is only honoured when both hosts are verified in Search
Console, and a `*.up.railway.app` subdomain is not a thing to publish canonical
URLs from.

The listing sitemap route sits at the app root, deliberately outside
`API_PREFIX`, because the security middleware puts `Cache-Control: no-store` on
everything under the prefix — a sitemap no crawler may cache is refetched in
full on every pass. It is also in `_EXEMPT_PATHS`, because behind the proxy
every request arrives from one Vercel egress IP and the 240/min global ceiling
would 429 it for everybody at once.

**The Railway hostname is hard-coded** in `vercel.json`. If the API moves,
change it there:

```json
{ "source": "/sitemap-listings.xml",
  "destination": "https://<api-host>/sitemap-listings.xml" }
```

Python and TypeScript generate listing slugs with the same algorithm
(`app/routers/seo.py:slugify` and `src/seo/slugs.ts`), verified to agree
character for character. If one drifts, every listing becomes two pages that
each claim the other is the original.

---

## 5. What you have to do in Google Search Console

1. **Add the property.** Search Console → Add property → **Domain**
   (`maklersizuy.uz`), which covers `www`, non-`www`, http and https in one
   place. Verify with the DNS TXT record your registrar's panel offers.
   *If DNS is not available to you*, use the URL-prefix property for
   `https://maklersizuy.uz/` and verify with the HTML meta tag — paste it into
   the static block of `index.html`, above `<!--seo-head-start-->`, so the
   prerenderer does not overwrite it.
2. **Decide www vs non-www**, once, and make the other 301 to it at the DNS/host
   level. Vercel does this for you when you set the canonical domain in the
   project's Domains tab. Everything in the code assumes `https://maklersizuy.uz`
   with no `www` and no trailing slash.
3. **Submit the sitemap.** Sitemaps → add `sitemap.xml` (the index — do not
   submit the children separately). Come back in 48 hours and check that both
   children are read and that the discovered URL count is in the low hundreds
   plus your listing count.
4. **Request indexing for the ten pages that matter**, by hand, once: `/`,
   `/elonlar`, `/kvartira-ijaraga`, `/uy-ijaraga`, `/toshkent`,
   `/toshkent/kvartira-ijaraga`, `/toshkent/chilonzor/kvartira-ijaraga`,
   `/sheriklikka-ijara`, `/talabalar-uchun-ijara`, `/ru/toshkent/kvartira-ijaraga`.
   URL Inspection → Test live URL → Request indexing. This seeds the crawl; the
   rest follows the internal links.
5. **Use "Test live URL" as the real proof.** For each of those, open
   *View crawled page → Screenshot* and *More info → JavaScript console*.
   The rendered HTML must contain the heading and the body prose. If it shows
   a spinner, something in the prerender step failed — check the build log for
   `prerender: N pages failed to render their body`.
6. **Watch Pages (Indexing) weekly for the first month.** The two reports that
   matter early are *"Duplicate without user-selected canonical"* (should be
   empty — if not, a canonical is wrong) and *"Crawled – currently not
   indexed"* (normal for empty facet pages; a problem if a district page with
   listings is in there).
7. **Check Core Web Vitals after ~28 days of field data.** It needs real
   traffic before it says anything.
8. **Set the international targeting** you need under Legacy tools if the
   hreflang report shows "no return tags" — it should not, the sitemap declares
   reciprocal alternates for every URL.
9. **Register Bing Webmaster Tools too.** It imports directly from Search
   Console now, so it costs five minutes, and Yandex matters in this market —
   add `webmaster.yandex.uz` as well and submit the same sitemap.

---

## 6. Analytics

GA4 is wired but **off unless you configure it**. Set
`VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` on Vercel and redeploy. With it unset,
nothing is fetched, no global is defined and no cookie is written.

It loads when the page is idle rather than during the first render, skips
crawler user agents (whose sessions would otherwise arrive as a wave of 100%
bounces and wreck exactly the numbers the SEO work is judged by), and sends
page views explicitly on navigation because automatic ones fire only once in a
single-page app.

The event worth building reports on is **`contact_reveal`** — the moment a
search visitor asks for the owner's phone number. It is the only honest way to
tell a landing page that ranks from a landing page that works. `listing_view`,
`listing_favorite`, `search_submit` and `filter_apply` are defined in
`src/services/analytics.ts` and can be wired to their call sites the same way.

**Consent is your decision.** EU visitors need a lawful basis before this is
switched on; `setAnalyticsConsent(false)` disables it at runtime.

---

## 7. Before you deploy

- [ ] Set `VITE_API_URL` on Vercel. Without it the build cannot prune empty
      facets from the sitemap and the API preconnect hint is skipped.
- [ ] Set `VITE_SITE_URL` only if the domain changes.
- [ ] Confirm the Railway hostname in `vercel.json`'s sitemap rewrite.
- [ ] `npm run build && npm run seo:audit` — must end with `No errors.`
- [ ] Set the canonical domain in Vercel → Domains, and confirm the other
      variant 301s to it.
- [ ] After deploying, fetch these by hand and read the raw response:
      `curl -s https://maklersizuy.uz/toshkent/chilonzor/kvartira-ijaraga | head -40`
      — the title, description, canonical and hreflang must be in the HTML,
      not injected later.
- [ ] `curl -I https://maklersizuy.uz/bunday-sahifa-yoq` — must be **404**, not 200.
- [ ] `curl -s https://maklersizuy.uz/sitemap-listings.xml | head` — must be XML
      from the API, not the SPA shell. If it is HTML, the rewrite is wrong or
      a file of that name exists in `dist/` and is winning.
- [ ] Run PageSpeed Insights on `/` and on one district page.

---

## 8. What is deliberately left

Ordered by how much they are worth.

1. **Listing photos are base64 `data:` URIs.** The API accepts and stores
   whole images inside the JSON payload (`schemas/listing.py`). They cannot be
   crawled, cannot appear in Google Images, cannot be an `og:image`, cannot be
   cached by a CDN, and they inflate every list response by megabytes. The code
   already degrades safely — `crawlableImages()` drops them and the brand image
   stands in — but **this is the single biggest remaining win**, for both search
   and performance. It needs object storage (Cloudflare R2, S3, Vercel Blob)
   and a migration; it is a project, not a patch.
2. **Listing pages are client-rendered.** `/e/<slug>-<uuid>` is served from a
   shell that declares no canonical, so Google treats the requested URL as
   canonical and indexes what it renders — which works, but is slower to index
   than static HTML. The fix is for FastAPI to serve those pages server-side.
   Worth doing once listing count justifies it.
3. **Metro-station landing pages.** `/toshkent/metro/bodomzor` is a real search
   ("Bodomzor yaqinida kvartira") and the data is already on every listing. Not
   built because it would triple the page count before there is inventory to
   fill it.
4. **A Content-Security-Policy.** The other security headers are set in
   `vercel.json`. CSP is not, because the map view reaches `api-maps.yandex.ru`
   and pulls MapLibre's stylesheet from `unpkg.com` at runtime
   (`src/components/map/maplibre.ts`), map tiles come from a third host, and
   Firebase auth touches several Google origins. Shipping a policy without
   testing every one would white-screen the map. Self-host the MapLibre CSS
   first — an un-pinned `unpkg.com` link with no integrity hash on an indexable
   public view is a supply-chain exposure in its own right — then add CSP in
   report-only mode for a week before enforcing it.
5. **`Maklersizuy.Admin/` is an orphaned gitlink** with no `.gitmodules`. It
   will warn on a fresh clone, including Vercel's. `git rm --cached Maklersizuy.Admin`
   fixes it. Unrelated to SEO; noticed while auditing the deploy.
6. **The blog needs a third wave.** Ten guides is a foundation, not a content
   strategy — see §9.

---

## 9. The next three to six months

**Month 1 — get indexed and measure.** Search Console setup (§5), then watch
coverage. Expect landing pages to start appearing in 2–4 weeks and to rank for
long-tail district queries before anything else. Do not add pages in this
period; find out what the existing ones do first.

**Month 2 — fix the image problem.** Item 1 in §8. It unlocks Google Images
traffic, which for a property marketplace is not a rounding error, and it will
move Core Web Vitals more than anything else available.

**Months 2–3 — write for the questions, not the keywords.** Two guides a month,
each answering something a person actually types: how the deposit works, what a
kadastr check involves, what a landlord may and may not ask for, how much
notice either side owes. These are the pages that earn links; a listings grid
never will.

**Month 3 — expand geography where inventory justifies it.** Watch the facet
counts. When Samarkand or Fergana district pages would have listings on them,
generate them — the taxonomy takes one entry per district. Do not generate them
before then.

**Months 3–6 — local signals.** A Google Business Profile, a presence on the
Uzbek listing aggregators, and the thing that matters most in this market:
Telegram. Every guide should be posted there with a link back. Uzbek property
search runs through Telegram channels, and links from them are how a new domain
becomes a known one.

**Throughout — the honest part.** No amount of technical work outranks a site
with more and better listings. The SEO architecture makes every listing
findable; it cannot invent them. The single highest-leverage growth lever
remains supply.

---

## 10. Where things live

| File | What it owns |
| --- | --- |
| `src/seo/routes.ts` | Path ↔ route resolution, canonical paths, legacy URL redirects |
| `src/seo/taxonomy.ts` | Which facets get a page; slug-collision guard |
| `src/seo/pages.ts` | The full static page list, shared by prerender and sitemap |
| `src/seo/meta.ts` | `buildHead()` — the single source of every page's head |
| `src/seo/jsonld.ts` | Structured data builders |
| `src/seo/links.ts` | The internal link graph |
| `src/seo/content/` | All copy, per language: templates, place profiles, guides |
| `src/seo/useSeoHead.ts` | Applies the head at runtime |
| `src/router/` | Language prefixes, `<AppLink>`, the view vocabulary |
| `src/entry-server.tsx` | The build-time renderer |
| `scripts/prerender.mjs` | Writes `dist/**/index.html` |
| `scripts/generate-sitemap.mjs` | Writes the sitemaps and robots.txt |
| `scripts/seo-audit.mjs` | Verifies the built output |
| `backend_python/app/routers/seo.py` | Listing sitemap, facet counts |
