# Uyiz.uz

A rental marketplace for Uzbekistan. Owners and professional agents both post
listings, and renters contact whoever published them directly. Posting a
listing is free, listings publish immediately — there is no machine gate in
front of them — and moderation is complaint-driven: a listing's reliability
percentage moves only when an admin confirms a report against it.

- **Frontend** — React 19 + TypeScript + Vite + Tailwind v4, in `src/`
- **Backend** — Python 3.13 + FastAPI + SQLAlchemy 2 (async) + PostgreSQL, in `backend_python/`
- **Admin CRM** — Next.js + TypeScript + Tailwind v4, in `admin/`

Three interface languages (Uzbek, Russian, English) and a light/dark theme run
through all three.

---

## 1. What the product does

A renter searches, opens a listing and calls the number on it. The platform's
job is that the listing exists, that it is findable, and that the contact on it
is real.

**Anyone may post, and posting is free.** An owner renting out their own flat
and an agency renting out thirty are the same kind of account here. Nothing in
the product treats a professional as a warning sign. What the product does warn
about is fraud, and that advice is unchanged: never send money before you have
seen the place and have the keys and the paperwork in hand.

**Listings publish immediately.** A submitted listing goes straight to
`APPROVED` with `published_at` set and appears in the catalogue. There is no
machine verdict in front of publication and no queue to wait in. A listing
needs at least one photo; that is the only gate.

**Moderation is complaint-driven.** Every listing starts at a reliability score
of 100. Filing a report changes nothing on its own. When an admin *confirms* a
report (`RESOLVED`, as opposed to `REJECTED` for a dismissal) the score is
recomputed from scratch as `100 − Σ penalties` of that listing's confirmed
reports, floored at 10 — 25 for a critical report, 15 high, 10 medium, 5 low.
Because it is recomputed rather than decremented, un-confirming a report puts
the score back. `risk_score` is kept as `100 − trust_score` so the admin
filters keep working.

**Top is requested, not bought.** Instead of an automated check, a poster is
offered "Top" after publishing, with an explanation of what it does. Pressing
it files a request — the UI says so plainly: *sent, pending review* — and
nothing about the listing changes yet. A moderator approves or rejects it in
the admin panel's Top queue, and only an approval sets `is_featured`, the
promotion weight and `featured_until`. Top is free to ask for.

**The assistant is Uyiz AI.** A server-side OpenAI agent that holds a real
conversation, filters the live listing database against what the user is
actually describing, and hands out the support numbers or files a callback
request when someone wants to talk to a person. See `UYIZ-AI.md`.

Public site: **https://uyiz.uz**. Admin panel: **https://admin.uyiz.uz**.
Support: **support@uyiz.uz**.

---

## 2. Before you deploy: rotate every secret

The previous build committed live credentials. **All of these must be treated as
compromised and rotated at the provider before this goes to production.** They
are in the git history, so deleting the files is not enough.

| Secret | Where it leaked | Action |
|---|---|---|
| DevSMS API token | committed in `.env.example` | rotate in the DevSMS dashboard |
| Telegram bot token | committed in `.env.example` | `/revoke` then `/newtoken` with @BotFather |
| OpenAI API key | `.env` (untracked, but present on disk) | revoke and reissue |
| PostgreSQL password | `backend/.env` | rotate the Railway database credentials |
| Gemini API key | **shipped to every visitor** in the JS bundle | revoke immediately |
| Firebase config | `.env` | publishable by design; no action needed |

Then generate the two new secrets the backend requires:

```bash
# JWT signing key
python -c "import secrets; print(secrets.token_urlsafe(48))"

# AES-256 key for the admin password-reveal feature
python -c "import base64,secrets; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
```

`PASSWORD_REVEAL_KEY` must **not** live on the database host. Its whole purpose
is that a stolen database dump is useless without it.

---

## 3. Running it locally

### Backend

```bash
cd backend_python
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Linux/macOS: .venv/bin/python

# A database to develop against
docker run -d --name uyiz-pg \
  -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=uyiz \
  -p 55432:5432 postgres:16-alpine

cp .env.example .env        # then set DATABASE_URL to the container above
alembic upgrade head
python -m scripts.create_admin --username admin --name "Bosh administrator"
python run_dev.py           # http://127.0.0.1:5000
```

`run_dev.py` exists because uvicorn on Windows builds a `ProactorEventLoop`,
which psycopg's async mode cannot use. On Linux `uvicorn app.main:app` is
equivalent.

In development the SMS code is returned in the API response as `debugCode`, so
the signup flow is testable without spending SMS credit. The production guard
refuses to start if `OTP_DEBUG_RETURN_CODE` is true.

### Frontend

```bash
npm install
npm run dev                 # http://localhost:3000, proxies /api
```

### Admin CRM

```bash
cd admin
npm install
npm run dev                 # http://localhost:3000 (3001 if the site has 3000)
```

It talks to the API cross-origin — there is no proxy — so whichever port it
lands on has to be in the backend's `CORS_ORIGINS`. Both 3000 and 3001 are in
the development default already.

### Tests

```bash
npm run backend:test        # 83 integration tests against a real PostgreSQL
npm run typecheck           # tsc --noEmit
npm run build               # typecheck + production bundle

# End-to-end smoke check in a real browser: renders in both themes, all three
# languages, no console errors. Needs the preview server and the API running.
npx playwright install chromium
npm run verify:ui
```

The backend tests are integration tests against a real database on purpose:
every bug that mattered in the old backend — forgeable tokens, a login that
ignored the password, unauthenticated admin routes — lived in the seams
between layers, where unit tests with a mocked database would have stepped
straight over them.

Note: the suite truncates tables between tests, so do not run two copies
against the same database at once.

---

## 4. Architecture

```
src/                        React SPA
  i18n/                     uz / ru / en dictionaries + runtime (no dependency)
    locales/uz/             source of truth; ru + en are type-checked against it
  theme/ThemeProvider.tsx   light / dark / system
  services/                 http.ts (transport) + authApi + listingsApi
  stores/useAppStore.ts     zustand; server is the only source of truth
  components/
    listings/               the main showcase page + card
    auth/AuthDialog.tsx     register -> SMS -> verify -> signed in
    ui/Field.tsx            shared form primitives

backend_python/
  app/
    core/                   config, security, tokens, deps, audit, rate limit,
                            middleware, errors (localised), phone normalisation
    models/                 15 tables
    schemas/                Pydantic v2, camelCase on the wire
    routers/                auth, listings, ai, admin, meta
    services/               auth, listings, admin, sms, telegram, uyiz_ai,
                            google_auth
  alembic/                  migrations
  scripts/                  create_admin, migrate_legacy
  tests/                    integration tests

admin/                      Next.js admin CRM, deployed on its own
  src/                      app router, components, API client
```

### Theming

Components never write raw colours. They use semantic tokens defined once in
`src/index.css` — `bg-surface`, `text-content`, `text-muted`, `border-line`,
`bg-brand` / `text-on-brand`, and the status pairs. Dark mode is a palette swap
under `.dark`, so there is no long tail of `dark:` variants to keep in sync and
no component can be accidentally light-only.

### i18n

1,073 keys per language (3,219 strings). Uzbek is the source of truth; the
`Dictionary` type widens its literal types to `string` while keeping its key
shape, so a missing or misspelled Russian key is a **compile error**, not a
runtime fallback. Interpolation uses `{placeholders}` — never string
concatenation, because word order differs across the three languages.

The backend is localised too: every API error carries a stable `code` plus a
message rendered in the caller's language (`X-Language` header, falling back to
`Accept-Language`).

---

## 5. Security model

### Authentication

Registration is three steps, and **nothing is written to `users` until the SMS
code is confirmed** — so an abandoned signup cannot squat on someone's number:

```
POST /auth/register      name + phone + password   -> staged, SMS sent
POST /auth/verify-code   phone + code              -> account created, tokens
POST /auth/login         phone + password          -> tokens
```

- **Passwords**: Argon2id (m=64 MiB, t=3, p=4). Login compares hashes. A policy
  check rejects short, common, repeated, or name/phone-derived passwords.
- **Access tokens**: short-lived signed JWTs carrying subject type, role and a
  `token_version`. Bumping that version retires every outstanding token at once,
  which is how a password change or a suspension takes effect immediately.
- **Refresh tokens**: opaque 256-bit secrets stored only as SHA-256, rotated on
  every use, grouped into a family. Replaying a spent token revokes the whole
  family and writes a CRITICAL audit entry.
- **Lockout**: 5 failed attempts locks the account for 15 minutes. The counters
  survive the failure that caused them (see `commit_then_raise`) — without that,
  the rollback would discard the very bookkeeping that implements brute-force
  protection.
- **Enumeration**: "unknown phone" and "wrong password" return an identical
  code, message and status, and the password check runs against a dummy hash
  when the account does not exist so the timing matches.
- **Google sign-in**: the ID token's signature is verified against Google's
  published certificates before any claim in it is trusted.

### The admin password-reveal feature

You asked for admins to be able to see users' passwords. That is implemented,
and built to contain the blast radius:

- Authentication **only ever** reads the Argon2id hash.
- A second, independent AES-256-GCM copy exists purely for reveal. Its key lives
  in `PASSWORD_REVEAL_KEY` in the environment, never in the database — **a
  stolen database dump alone reveals nothing.**
- Reveal requires an ADMIN-or-above token, is rate-limited, and writes a
  CRITICAL audit row naming the admin, the target and the IP.
- The plaintext is decrypted on demand and never logged, cached, or written to
  any list endpoint or the audit table.
- Turning the feature off later is one setting (`PASSWORD_REVEAL_ENABLED=false`)
  plus clearing the column; authentication is unaffected because it never reads it.

It remains true that this is strictly weaker than hashing alone. If you ever
decide you don't need it, the off switch is already there.

### Everything else

Explicit CORS allowlist (never `*` with credentials) · CSP, HSTS, nosniff,
frame-deny, referrer policy · per-IP and per-identity rate limits with
DB-backed caps for anything that must survive a restart · Pydantic validation
with `extra="forbid"` so unknown fields are rejected rather than mass-assigned ·
ownership checks on every listing write · owner phone hidden from anonymous
browsing · SMS codes stored hashed, single-use, attempt-capped · HTML-escaped
Telegram output · no stack traces or SQL in responses · runs as an unprivileged
container user · migrations via Alembic, which never drops data.

### System-wide audit log

Every state change writes to `audit_logs`: who, what, to which entity, from
where, and a redacted before/after diff. That table is what the admin panel's
**"Barcha harakatlar"** feed reads — filterable by action, section, severity,
actor, entity, IP and date. Secrets are stripped before the row is written.

---

## 6. Admin CRM

A Next.js app in `admin/`, behind a separate staff login (username + password →
admin JWT, with an optional per-account CIDR allowlist).

Dashboard · Listings moderation · **Top requests** (the approval queue: a
poster asks, a moderator grants the days and the promotion weight, and only
then is the listing actually promoted) · Reports (confirming one is what moves
a listing's reliability percentage) · Verifications · Users (search, filter,
detail, password reveal, force-reset, revoke sessions, suspend, delete) ·
**All activity** · Security (sign-in attempts) · Uyiz AI transcripts · SMS
ledger · Staff management.

```bash
cd admin && npm run dev
```

It is a **separate Vercel project** from the site: same repository, Root
Directory `admin`, its own domain. The root `.vercelignore` excludes `admin/`
so the site's build never tries to compile it, and the site's `.vercelignore`
is irrelevant to the admin project because that one deploys from `admin/` as
its root.

The panel is a browser client like any other: it calls the API cross-origin
with a bearer token, so **its origin must be in the backend's `CORS_ORIGINS`**
(see RAILWAY_ENV.md). The backend no longer serves any admin UI itself —
`/admin` on the API host is gone, and only `/api/v1/admin/*` remains.

---

## 7. Migrating existing data

```bash
cd backend_python
python -m scripts.migrate_legacy --dry-run   # reports, writes nothing
python -m scripts.migrate_legacy
```

Users and listings are copied from the old Prisma tables. Every imported account
is set to `REGISTRATION_REQUIRED`: the old passwords were stored in plaintext and
must be considered compromised, so they are discarded. The owner re-registers on
the same phone number and reclaims the same account, with their listings intact.

---

## 8. Deployment

Railway builds the root `Dockerfile`, which runs `alembic upgrade head` and then
uvicorn. Health check: `/health`. Required environment variables are documented
in `backend_python/.env.example`; the app **refuses to start in production**
without `JWT_SECRET`, a real `DATABASE_URL`, and `PASSWORD_REVEAL_KEY`, or with
`OTP_DEBUG_RETURN_CODE` enabled, or with `*` in `CORS_ORIGINS`.

The frontend is a static bundle (`npm run build` → `dist/`) deployed separately.
Point `VITE_API_URL` at the API, or leave it empty to use the same origin.

The admin panel is a third deployment: a Vercel project pointed at this same
repository with **Root Directory `admin`**. It needs the API's public URL in
its own environment, and its origin added to the API's `CORS_ORIGINS` — a
missing origin there is the failure that looks like "the admin panel loads but
every request fails".

### Domains

The site is `https://uyiz.uz`, the panel `https://admin.uyiz.uz`, and the API
keeps its Railway hostname — that one is invisible to visitors, and renaming
the service would have to land in four coupled places in the same deploy.

`maklersizuy.uz` was the previous domain. **Keep it attached and 301-ing to
`uyiz.uz`, path for path, for at least twelve months.** Dropping it discards
every ranking and inbound link the site has. `SEO.md` §6 has the full migration
order, and `SEO-QADAMLAR.md` is the same thing as a checklist in Uzbek.

Ordering matters in one place: `CORS_ORIGINS` on Railway must already contain
`https://uyiz.uz` and `https://admin.uyiz.uz` **before** DNS points at them.
Matching is exact and `*` is refused in production, so a new origin that goes
live first loads the app and then fails every request with an opaque network
error and nothing wrong in the API logs.

---

## 9. Known gaps

Stated plainly rather than faked in the UI:

- **Direct messaging has no backend.** The chat screen keeps its layout but says
  so and directs users to the phone number or Telegram handle on the listing.
  Building it needs a conversations/messages API and probably WebSockets.
- **Referral counts and leaderboards** were hardcoded fiction. The referral code
  is real; the counters are gone until there is a table behind them.
- **XP/gamification** was awarded client-side, so it meant nothing. The ladder
  copy remains; the awards are gone until the server grants them.
- **AI listing copywriting and price estimation** ran Gemini in the browser with
  a key visible to every visitor. Removed. Bringing the copywriter back would
  need a backend endpoint; nothing else depends on it.
- **Publish-time AI moderation is gone**, deliberately, not pending. Listings
  publish on submission and the reliability percentage moves only on an
  admin-confirmed report. `POST /listings/scan` survives one more release as a
  deprecated constant-allow stub so cached old frontend bundles do not crash;
  it is due for deletion after that.
- **`listings.video_url` is a retired column.** Video is out of the product —
  the form field, the schemas, the types and the player are all gone — but the
  column is kept dormant rather than dropped, because a rolling deploy would
  500 on the container still running the old code.
- **Image uploads** are still base64 inside the JSON body (capped at 12 images,
  ~6 MB). Object storage with presigned uploads would be the next improvement.
