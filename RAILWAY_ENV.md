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
CORS_ORIGINS=https://maklersizuy.uz,https://www.maklersizuy.uz

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

# ── SMS (DevSMS) — OFF until the provider is connected ───────────────────
# With this false the app does not call DevSMS at all. Read "Working without
# SMS" below: public signup cannot complete while it is off.
SMS_ENABLED=false
DEVSMS_SENDER=4546
# DEVSMS_API_TOKEN=PASTE_ROTATED_DEVSMS_TOKEN

# ── Telegram operations group ────────────────────────────────────────────
TELEGRAM_GROUP_ID=-1003935734144
TELEGRAM_BOT_TOKEN=PASTE_ROTATED_TELEGRAM_TOKEN

# ── AI (server-side only) ────────────────────────────────────────────────
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=PASTE_ROTATED_OPENAI_KEY

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

## Working without SMS

`SMS_ENABLED=false` means no code is ever delivered, and
`OTP_DEBUG_RETURN_CODE` cannot be enabled in production (the guard refuses to
start). So **public signup cannot be completed** while SMS is off: a visitor
reaches the verification screen and waits for a code that never arrives.

Until DevSMS is connected, create accounts directly instead. In the Railway
service shell:

```bash
python -m scripts.create_account --phone "+998777850737" --password "MaklersizUy!" --name "Test Akkaunt" --role OWNER
```

The account is created ACTIVE with the phone already marked verified, so it
signs in with phone + password and is never asked for a code. Re-running the
same command with a different `--password` resets it.

`--role OWNER` can post listings; `--role STUDENT` can only browse and save.

Two constraints the password must satisfy (the same policy real users get):
at least 8 characters with two character classes, and it may not contain the
account name or the phone number. `MaklersizUy!` passes with the name
"Test Akkaunt", but would be rejected if the name were "Maklersiz Uy".

Seeded accounts appear in the admin activity feed as a WARNING-level row, so
they are not invisible.

When DevSMS is ready: set `SMS_ENABLED=true`, add the rotated
`DEVSMS_API_TOKEN`, redeploy. Normal signup starts working immediately and
the seeded accounts keep working unchanged.

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

   It prints the password **once**. Save it, then sign in at
   `https://<your-service>.up.railway.app/admin` and change it.

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
```

Firebase web config is publishable by design — the backend verifies the ID
token's signature against Google's certificates before trusting any claim in
it, so these values being public is not a risk.

Never put a server secret behind a `VITE_` prefix: everything so prefixed is
compiled into the bundle and served to every visitor. That is exactly how the
Gemini key leaked.
