# Railway environment setup

## Which service? (read this first)

A Railway project has **two services**, and they are not interchangeable:

| Service | What it is | What you put there |
|---|---|---|
| **Postgres** | the database Railway manages for you | **nothing.** Leave every variable exactly as Railway generated it |
| **API** (this repo) | the container built from the `Dockerfile` | the whole block below |

Pasting the block onto **Postgres** is the mistake that looks like a broken
deploy: the API service still has no variables, so it exits with
`Refusing to start in production without: …`, while Postgres itself gets a
`DATABASE_URL=${{Postgres.DATABASE_URL}}` line that **points at itself**. That
circular reference is why the Variables list shows `DATABASE_URL` blank while
the edit box shows raw `${{...}}` text.

If that has already happened: open the **Postgres** service → Variables,
delete every variable you added by hand (Railway's own `PG*`,
`POSTGRES_*`, `RAILWAY_*` and `DATABASE_URL` entries stay), then paste the
block into the **API** service instead.

---

Paste the block below into your API service → **Variables** → **Raw Editor**,
replace the `PASTE_...` placeholders, then Deploy.

A `PASTE_...` value left in place is now **ignored** rather than used, so the
app still starts — it just reports that feature as off in the startup log.

The app **refuses to start** without `ENVIRONMENT`, `DATABASE_URL`,
`JWT_SECRET` and `PASSWORD_REVEAL_KEY`, or if `OTP_DEBUG_RETURN_CODE` is true,
or if `CORS_ORIGINS` contains `*`. That is deliberate — a misconfigured deploy
fails loudly instead of running on guessable keys.

---

## The block

```env
# ── Runtime ──────────────────────────────────────────────────────────────
ENVIRONMENT=production
LOG_LEVEL=INFO
TRUSTED_PROXY_COUNT=1
WEB_CONCURRENCY=2

# ── Database ─────────────────────────────────────────────────────────────
# EASIEST: do not set DATABASE_URL at all. In the API service use
# "Variables → Add all from Postgres" (or add PGHOST/PGPORT/PGUSER/
# PGPASSWORD/PGDATABASE), and the app assembles the URL from those.
#
# The reference form below also works, but "Postgres" must match your DB
# service's exact name — if it does not, Railway leaves the ${{...}} text
# unsubstituted and the app cannot connect.
# DATABASE_URL=${{Postgres.DATABASE_URL}}
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=5

# ── Secrets — generate these yourself, never commit them ─────────────────
# JWT_SECRET:
#   python -c "import secrets; print(secrets.token_urlsafe(48))"
# PASSWORD_REVEAL_KEY:
#   python -c "import base64,secrets; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
JWT_SECRET=PASTE_GENERATED_JWT_SECRET
PASSWORD_REVEAL_KEY=PASTE_GENERATED_REVEAL_KEY
PASSWORD_REVEAL_ENABLED=true

# ── CORS — exact origins only, never "*" ─────────────────────────────────
# Every browser origin that calls this API. That is BOTH deployments: the
# site, and the admin panel, which is its own Vercel project on its own
# domain and has no proxy in front of it. Leave the admin origin out and the
# panel loads fine and then fails on every request. See the section below.
CORS_ORIGINS=https://maklersizuy.uz,https://www.maklersizuy.uz,https://admin.maklersizuy.uz

# ── Auth policy ──────────────────────────────────────────────────────────
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=30
ADMIN_ACCESS_TOKEN_TTL_MINUTES=30
ADMIN_REFRESH_TOKEN_TTL_DAYS=1
PASSWORD_MIN_LENGTH=8
MAX_FAILED_LOGINS=5
LOCKOUT_MINUTES=15

# ── OTP ──────────────────────────────────────────────────────────────────
OTP_LENGTH=6
OTP_TTL_MINUTES=5
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_MAX_PER_PHONE_PER_DAY=10
OTP_DEBUG_RETURN_CODE=false

# ── Rate limits ──────────────────────────────────────────────────────────
RATE_LIMIT_GLOBAL_PER_MINUTE=240
RATE_LIMIT_AUTH_PER_MINUTE=10
RATE_LIMIT_OTP_PER_HOUR=12
RATE_LIMIT_LISTING_CREATE_PER_HOUR=5
RATE_LIMIT_AI_PER_DAY=10

# ── SMS (DevSMS) ─────────────────────────────────────────────────────────
SMS_ENABLED=true
DEVSMS_API_URL=https://devsms.uz/api
DEVSMS_SENDER=4546
DEVSMS_API_TOKEN=PASTE_DEVSMS_TOKEN
# The company name inside a verification SMS. The provider screens it on every
# send and twenty consecutive rejections suspend the account for a day, so it
# is a variable: if screening ever objects, change it without a deploy.
DEVSMS_SERVICE_NAME=MaklersizUy

# ── Telegram operations group ────────────────────────────────────────────
TELEGRAM_GROUP_ID=-1003935734144
TELEGRAM_BOT_TOKEN=PASTE_ROTATED_TELEGRAM_TOKEN

# ── AI (server-side only) ────────────────────────────────────────────────
OPENAI_API_KEY=PASTE_ROTATED_OPENAI_KEY
# The everyday model: classification, moderation, and the assistant's first
# call of each turn — the majority of requests by volume.
OPENAI_MODEL=gpt-4o-mini
# The reasoning tier, used only once a turn has already called a tool and has
# something to make sense of. Leave EMPTY to run everything on OPENAI_MODEL;
# set it to a stronger model when you want better answers on the harder turns
# without paying for one on "salom". Nothing else has to change.
OPENAI_MODEL_SMART=
# Tool round trips one turn may take before the loop gives up and answers with
# what it has. Four covers "search, open one, save it" with room to spare.
AI_MAX_TOOL_STEPS=4
# Numbers the assistant may hand out when someone asks to speak to a person.
# Comma-separated, highest priority first.
SUPPORT_PHONES=+998937188885,+998777850737

# ── Google sign-in ───────────────────────────────────────────────────────
# Public config, not a secret. Empty disables Google sign-in rather than
# accepting unverified identities.
FIREBASE_PROJECT_ID=maklersiz-uy

# ── Misc ─────────────────────────────────────────────────────────────────
USD_TO_UZS_RATE=12700
```

Do **not** set `PORT` — Railway injects it and the container reads `${PORT}`.

---

## The four placeholders

Each is a credential that must be **rotated first** — the old values are in
your public git history or were shipped to browsers, so they are compromised.

| Variable | Where to get a new one |
|---|---|
| `DEVSMS_API_TOKEN` | DevSMS dashboard → revoke the old token, issue a new one. Not needed yet — leave `SMS_ENABLED=false` until then |
| `TELEGRAM_BOT_TOKEN` | Telegram → @BotFather → `/revoke`, then `/token` |
| `OPENAI_API_KEY` | platform.openai.com → API keys → revoke old, create new |
| `DATABASE_URL` | nothing to paste — use "Add all from Postgres" in the API service, or the reference form |

Also revoke the **Gemini** key (`AQ.Ab8RN6Ka…`) — it was shipped to every
visitor in the old JS bundle. Nothing needs it any more; AI moderation runs
server-side through `OPENAI_API_KEY`.

---

## CORS: the admin panel needs its own entry

`CORS_ORIGINS` is a comma-separated allowlist of **browser origins**, matched
exactly. Scheme and host, no path, no trailing slash, no wildcards — `*` is
refused outright in production, because the API answers with credentials and
the two together are a standing invitation.

Two deployments call this API from a browser, and both must be listed:

| Origin | What it is |
|---|---|
| `https://maklersizuy.uz` (and the `www.` host, if you serve it) | the site — the Vite SPA on Vercel |
| `https://admin.<your domain>` | the admin panel — the Next.js app in `admin/`, a **separate** Vercel project with Root Directory `admin` |

The admin panel used to be served by this API itself, at `/admin`, which is
why it never needed an entry. It is its own deployment now, on its own
origin, with no proxy in front of it — so every request it makes is
cross-origin, and an origin that is not on this list is refused by the
browser before the API is even reached.

That failure looks like this: the panel loads and renders, then every call
fails with a network error and the console says the response is missing
`Access-Control-Allow-Origin`. The API's own logs show nothing wrong, because
nothing was wrong at the API. Add the origin and redeploy.

While Vercel's preview deployments each get a fresh URL, they are **not**
covered by this list — matching is exact, not by pattern. Test against the
production admin domain, or add the specific preview origin while you need it.

Locally nothing has to be set: the development default already allows
`localhost` (and `127.0.0.1`) on ports 3000 and 3001 for the panel, plus 5173.

---

## If the database will not connect

Do **not** edit variables inside the Postgres service. Railway generates them
and its own `DATABASE_URL` is a template over `PGUSER` / `POSTGRES_PASSWORD` /
`RAILWAY_PRIVATE_DOMAIN`, which is why the list shows it blank while the edit
box shows raw `${{...}}` text. That is normal.

Set the connection on the **API service** instead, in this order of
preference:

1. **Add all from Postgres** — in the API service's Variables tab. This
   injects `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, and the
   app builds the URL from them. Nothing to type, no name to get right.
2. **Reference** — `DATABASE_URL=${{<ServiceName>.DATABASE_URL}}`, where
   `<ServiceName>` is exactly what the Postgres service is called. Typing
   `${{` in the Variables editor opens an autocomplete list.
3. **Literal** — copy the resolved value out of the Postgres service and
   paste it. Any shape works: `postgres://`, `postgresql://`, with or without
   surrounding quotes; the app normalises it.

The startup log names the source it used, with the password stripped:

```
preflight: database=postgres.railway.internal:5432/railway (source: PG* variables)
```

An internal host (`*.railway.internal`) only resolves when the API and
Postgres are in the **same project**. Across projects use the Postgres
service's `DATABASE_PUBLIC_URL` instead.

---

## SMS

Verification codes go through DevSMS, which forwards to Eskiz.

**Codes use the provider's universal-OTP templates, not our own text.** Eskiz
only delivers messages matching a template approved in advance, so free text
is refused — per message, silently, and only for real users. The four
universal templates are approved already and the app picks one by purpose:

| Purpose | Template | Delivered text |
|---|---|---|
| Signing up | 3 | `... {name} xizmatiga ro'yxatdan o'tish uchun tasdiqlash kodi: {code}` |
| Signing in | 4 | `... xizmatiga kirish uchun ...` |
| Password reset | 2 | `... xizmatida parolni tiklash uchun ...` |
| Phone change | 1 | `... xizmatida amaliyotni tasdiqlash ...` |

The wording is Eskiz's, in Uzbek, whatever language the visitor is using —
that is a provider constraint, not a choice.

### Credit

Each message costs 200 so'm. **Running out stops signup dead** and nothing in
the app explains why: the code is generated, the send fails, the visitor sees
a generic error. The startup log prints the balance and shouts below fifty:

```
preflight: sms=on balance=10000 price=200 remaining=50
```

Top up at [devsms.uz](https://devsms.uz). Every attempt is also recorded in
`sms_logs` with its provider id, cost and status — the code itself is never
stored.

### Turning it off

Set `SMS_ENABLED=false`. Public signup then cannot complete, so seed accounts
directly instead:

```bash
python -m scripts.create_account --phone "+998777850737" --password "..." --name "..." --role OWNER
```

The account is created ACTIVE with the phone already verified, so it signs in
with phone + password and is never asked for a code. `--role DEVELOPER` grants
full access to every user-side capability, including an assistant with no
daily limit.


---

## After the first deploy

1. Watch the deploy log for `alembic upgrade head` followed by
   `Application startup complete`. If a required variable is missing the
   container exits with `Refusing to start in production without: …`.

2. Check health:

   ```
   https://<your-service>.up.railway.app/api/v1/health
   ```

   Expect `{"status":"ok","database":"up","environment":"production"}`.

3. Create the first admin (separate from the user accounts above — this is
   the CRM login). In the Railway service shell:

   ```bash
   python -m scripts.create_admin --username admin --name "Bosh administrator"
   ```

   It prints the password **once**. Save it, then sign in on the admin panel
   — its own Vercel deployment, not a path on this service — and change it.
   The API only exposes `/api/v1/admin/*`; there is no UI on this host.

4. If you have existing users/listings in the old Prisma tables:

   ```bash
   python -m scripts.migrate_legacy --dry-run   # reports, writes nothing
   python -m scripts.migrate_legacy
   ```

---

## Frontend (Vercel)

The SPA is deployed separately. It needs only:

```env
VITE_API_URL=https://<your-service>.up.railway.app/api/v1
VITE_FIREBASE_API_KEY=<your firebase web api key>
VITE_FIREBASE_AUTH_DOMAIN=maklersiz-uy.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=maklersiz-uy
VITE_FIREBASE_APP_ID=<your firebase app id>

# Yandex — optional, but this is what makes the map and the GPS button good
VITE_YANDEX_MAPS_API_KEY=<JavaScript API and Geocoder key>
```

## Admin panel (Vercel, separate project)

Same repository, **Root Directory `admin`**, its own domain. One variable:

```env
NEXT_PUBLIC_API_URL=https://<your-service>.up.railway.app/api/v1
```

The `/api/v1` suffix belongs to the base URL. Whatever domain this project
ends up on must also appear in the API's `CORS_ORIGINS` above.

## Yandex maps and geocoding

Without these the site still works: the map falls back to Leaflet with Carto
tiles, and the listing form's GPS button reverse-geocodes through Nominatim.
Both are noticeably worse here — Nominatim's Uzbek district coverage is patchy
and it rate-limits everyone sharing an IP to one request per second, which is
why the GPS button sometimes filled nothing in.

Two keys from [developer.tech.yandex.ru](https://developer.tech.yandex.ru/):

| Key | What it powers |
|---|---|
| **JavaScript API and Geocoder** | the map itself, and address lookup |
| Geocoder (separate key, optional) | set `VITE_YANDEX_GEOCODER_API_KEY` if you issue one; otherwise the maps key is used for both |

The free tier covers ordinary traffic. The key is compiled into the bundle and
is public by design — restrict it to your domain in the Yandex console, which
is what stops someone else spending your quota.

Firebase web config is publishable by design — the backend verifies the ID
token's signature against Google's certificates before trusting any claim in
it, so these values being public is not a risk.

Never put a server secret behind a `VITE_` prefix: everything so prefixed is
compiled into the bundle and served to every visitor. That is exactly how the
Gemini key leaked.
