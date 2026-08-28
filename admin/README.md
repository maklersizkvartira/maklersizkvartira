# Maklersiz Admin

Staff console for the **Maklersiz uy** rental marketplace: listing moderation,
reports, identity verifications, user and staff administration, and the audit,
security, SMS and Shield AI logs.

It is a Next.js 16 App Router project that talks to the maklersiz FastAPI
backend over REST. It holds no database of its own and there is no WebSocket
connection — every screen is a query against `NEXT_PUBLIC_API_URL`.

## Getting started

```bash
cp .env.example .env
npm install
npm run dev     # http://localhost:3000/uz
```

`NEXT_PUBLIC_API_URL` **must** include the `/api/v1` suffix — `src/shared/lib/http.ts`
appends bare endpoint paths to it, so a base URL without the suffix 404s on
every call.

## Localisation

Three locales live in `src/messages/{uz,ru,en}.json`, with Uzbek as the default
because the staff and the backend's own error strings are Uzbek-first. The
prefix is always present in the URL (`/uz/dashboard`, `/ru/dashboard`).

The three files must keep **identical key sets** — next-intl renders the raw key
path when a message is missing, so a key added to one file and forgotten in the
other two ships visible `dashboard.kpi.foo` text to moderators.

`src/i18n/request.ts` resolves the bundle from the URL segment, never from a
cookie; the language switcher changes the path, not a preference.

## Middleware

Next 16 renamed `middleware.ts` to `proxy.ts`. The auth gate and the next-intl
middleware both live in `src/proxy.ts` — a file named `middleware.ts` will not
run in this version.

## Deployment

This directory is deployed as its **own Vercel project**, separate from the
public site, with **Root Directory = `admin`**. Set `NEXT_PUBLIC_API_URL` in that
project's environment variables.

`vercel.json` sends `X-Robots-Tag: noindex, nofollow` along with `X-Frame-Options`,
`X-Content-Type-Options` and `Referrer-Policy` on every response. A staff console
has nothing to gain from search traffic and leaks user and listing identifiers
through indexed URLs, so keep those headers — the `robots` metadata in
`src/app/[locale]/layout.tsx` covers the HTML, the header covers everything else.
