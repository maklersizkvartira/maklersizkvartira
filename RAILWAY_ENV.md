# Railway environment setup

Paste the block below into your API service → **Variables** → **Raw Editor**,
replace the four `PASTE_...` placeholders, then Deploy.

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
# Reference variable: Railway substitutes the real URL, so no password is
# ever typed or stored twice. Rename "Postgres" if your DB service is named
# differently (check the service tab in the same project).
DATABASE_URL=${{Postgres.DATABASE_URL}}
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=5

# ── Secrets (generated for you, already validated) ───────────────────────
JWT_SECRET=yjoDWO6RZTaxjmIdNgfOUXdz_wBng7cYXLfvrXlnigJATA587QGRS1vFezj-ERbn
PASSWORD_REVEAL_KEY=t3ekbO7cfLUHS56fvkRGS0PqUwq3y0dbVvGkHmx8WrY=
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
| `DATABASE_URL` | no action if you use the `${{Postgres.DATABASE_URL}}` reference above; otherwise rotate the DB password in the Postgres service |

Also revoke the **Gemini** key (`AQ.Ab8RN6Ka…`) — it was shipped to every
visitor in the old JS bundle. Nothing needs it any more; AI moderation runs
server-side through `OPENAI_API_KEY`.

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
