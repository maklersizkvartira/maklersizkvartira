import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { isSameOrigin } from '../../same-origin';

/**
 * Issues the admin panel's second factor.
 *
 * S1: this route used to carry a live bot token, the real operations
 * supergroup id and the HMAC key as `||` fallbacks, and it handed the whole
 * challenge to the browser in a cookie — username, expiry and an HMAC over
 * the code. Every input to the check was attacker-supplied, so with the key
 * in the repository anyone could mint a cookie for a code they chose and walk
 * past the second factor without a Telegram message ever being sent.
 *
 * The replacement stored the challenge in a `globalThis` Map and gave the
 * browser an opaque id. FINDING A: that Map does not exist in this
 * deployment. `admin/vercel.json` sets `"framework": "nextjs"` and
 * `next.config.ts` sets no `output`, so the panel ships to Vercel as
 * serverless functions — `send` and `verify` are two distinct functions, each
 * scaling to many instances and torn down when idle. A verify landing on any
 * instance that did not serve the send found nothing and answered "code
 * expired", which is indistinguishable from a real expiry, so the operator
 * retried forever and never logged in. That is not a rare race: a cold
 * instance on the verify path is the common case, and it would have taken the
 * panel down on the first deploy.
 *
 * So the challenge is stateless: {username, code, expiresAt} sealed with
 * AES-256-GCM into the cookie itself, under a key derived from SECRET_KEY.
 * Encryption rather than an HMAC over the code, because an HMAC is a verifier:
 * with it in hand an attacker tries all 900 000 codes offline in a second and
 * the second factor is over. A sealed challenge gives an attacker nothing to
 * test a guess against — the only oracle is this deployment answering a verify
 * request, one guess at a time, over the network, inside 60 seconds.
 *
 * FINDING D — the outage of 06.09.2026 (commit fc02143). Removing those
 * hardcoded fallbacks was right; making the route answer
 * `503 {"error":"2fa_not_configured"}` without them was not. SECRET_KEY,
 * TELEGRAM_2FA_BOT_TOKEN and TELEGRAM_2FA_CHANNEL_ID had never been set in the
 * Vercel project — the panel had been living on the literals — so from the
 * first request after the deploy every login died at step 1 on `if
 * (!sendData.ok)`. The people locked out were the only people who could have
 * set those variables, and the only door to the settings that would have fixed
 * it was the door that was shut. So this file now holds one rule above all
 * others: THE SECOND FACTOR MAY NEVER BE THE REASON NOBODY CAN GET IN. When it
 * cannot be delivered it stands aside, loudly, in the log — it does not refuse,
 * and it does not park the operator at step 2 waiting for a code that no
 * configured bot can send. Everything below follows from that.
 */

/** The cookie the browser carries between `send` and `verify`. */
const CHALLENGE_COOKIE = '2fa_challenge';

/** How long a code is good for. Mirrored in the JSON body as `expiresIn`,
 *  which is what drives the countdown on the login page. */
const CHALLENGE_TTL_SECONDS = 60;

/** A username longer than this is not one of ours — the panel's accounts are
 *  short — and it would be interpolated into a Telegram message and sealed
 *  into a cookie. Refusing it outright (rather than truncating) keeps the
 *  value `verify` decrypts byte-identical to the value that was posted. */
const USERNAME_MAX = 64;

/* ── the sealed challenge ────────────────────────────────────────────────
 *
 * These constants and helpers are duplicated in ../verify/route.ts, which
 * carries the matching `openChallenge`. That is deliberate: the two routes are
 * separate serverless functions and share no runtime, so the pair stays in
 * lockstep by review — and a change to one without the other shows up
 * immediately as every verify failing.
 */

const IV_BYTES = 12; // GCM's standard nonce length; the 16-byte tag follows it
const HKDF_SALT = 'uyiz.admin.2fa.challenge.v1';
const HKDF_INFO = 'aes-256-gcm challenge cookie';

/** One cookie may carry SEVERAL sealed copies of the same challenge, one per
 *  key `send` could not rule out — see `sealingKeys`. They are joined by `.`,
 *  which the base64url alphabet does not contain, so the split is unambiguous. */
const PART_SEPARATOR = '.';

/** A hostile cookie can name as many parts as it likes, and each one costs
 *  `verify` a GCM check against every candidate key. This deployment never
 *  writes more than three, so eight is generous and still bounded. */
const MAX_PARTS = 8;

/** Derive the sealing key from the resolved key material.
 *
 *  HKDF, not scrypt: the material is a high-entropy random key, not a
 *  password, so there is nothing for a work factor to defend — scrypt would
 *  only add ~100 ms of CPU to every serverless invocation of both routes. The
 *  salt and info strings are what keep this key application-specific, so a
 *  challenge cookie can never be mistaken for, or reused as, anything else
 *  signed or encrypted with the same SECRET_KEY. */
function challengeKey(material: string): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', material, HKDF_SALT, HKDF_INFO, 32));
}

/* ── the sealing-key ladder ──────────────────────────────────────────────
 *
 * Duplicated verbatim in ../verify/route.ts for the same reason as the crypto
 * above: two serverless functions, no shared runtime, kept in step by review.
 * If you change the order, the labels or the material strings here, change
 * them there in the same commit — the two must agree or no cookie opens.
 *
 * FINDING D: the old `readSecretKey` returned null and both routes answered
 * 503. A key that can be absent is a key that can lock the panel, so this
 * ladder ALWAYS returns at least one candidate. Every tier below the first is
 * weaker than SECRET_KEY and says so.
 *
 * Note what is deliberately NOT here: JWT_SECRET. It was considered as a
 * second tier, but this project does not have it — `src/env.ts` declares
 * exactly one variable (NEXT_PUBLIC_API_URL) and the sibling auth routes
 * (`refresh`, `set-refresh`, `logout`) verify no token themselves, they relay
 * to the backend. The name exists on the Railway API, not in this Vercel
 * project, so reading it here would be a tier that is never populated and a
 * standing invitation to set it and wonder why nothing changed.
 */

type KeyTier = 'secret_key' | 'vercel_deployment' | 'vercel_url_sha' | 'vercel_url' | 'ephemeral';

type KeyCandidate = { tier: KeyTier; material: string };

/** The random key of last resort, shared through `globalThis`.
 *
 *  A module-level `randomBytes` would NOT do: `send` and `verify` are separate
 *  modules, so each would get its own key and every verify would fail — the
 *  same shape of trap as FINDING A. Under `next dev` and `next start` both
 *  routes run in one process and one `globalThis`, so a symbol key here is
 *  genuinely shared. Across serverless instances it is not, which is exactly
 *  why `send` refuses to build a challenge on this tier outside development
 *  (see `POST`) rather than issue a code nobody can verify. */
const EPHEMERAL_KEY = Symbol.for('uyiz.admin.2fa.ephemeral-sealing-key');

function ephemeralMaterial(): string {
  const host = globalThis as unknown as { [EPHEMERAL_KEY]?: string };
  const existing = host[EPHEMERAL_KEY];
  if (existing) return existing;
  const created = crypto.randomBytes(32).toString('hex');
  host[EPHEMERAL_KEY] = created;
  return created;
}

/** Every key this deployment could have sealed a challenge under, best first.
 *
 *  `send` seals under candidate[0], or under all the deployment tiers when it
 *  is already down among them (see `sealingKeys`); `verify` opens with every
 *  candidate it has. Both sides cast wide on purpose: a cookie that cannot be
 *  opened is a lockout at step 2, and a GCM tag check costs microseconds.
 *
 *  Each tier's material carries a distinct prefix so two tiers can never
 *  derive the same key by coincidence. SECRET_KEY's material is the raw value,
 *  unprefixed, so it keeps deriving exactly the key it derived before. */
function keyCandidates(): KeyCandidate[] {
  const candidates: KeyCandidate[] = [];

  // (a) The intended path. Under 32 characters is treated as absent: this is
  //     key material, not a password, and a short one is not one.
  const secretKey = (process.env.SECRET_KEY ?? '').trim();
  if (secretKey.length >= 32) {
    candidates.push({ tier: 'secret_key', material: secretKey });
  }

  // (c) Vercel's own deployment identifiers. WEAKER THAN (a), on purpose and
  //     with eyes open: none of these is a secret. They are not in the
  //     repository — that is the constraint they satisfy — but anyone who can
  //     name the deployment can reconstruct the key, and they rotate on every
  //     deploy, which quietly invalidates any challenge in flight across a
  //     redeploy (the operator asks for a new code; that is a 60-second
  //     annoyance, not a lockout). This tier exists for one reason: so the
  //     panel is REACHABLE when SECRET_KEY was never set. Set SECRET_KEY.
  //
  //     Only deployment-constant values are used. Per Vercel's system
  //     environment variable reference, VERCEL_DEPLOYMENT_ID, VERCEL_URL and
  //     VERCEL_GIT_COMMIT_SHA are all documented "available at both build and
  //     runtime" and are properties of the deployment, so the two functions of
  //     one deployment read the same values. VERCEL_REGION is deliberately
  //     absent: it is the one runtime-only variable and its whole purpose is
  //     to differ between instances, so a key derived from it would differ
  //     between the instance that sent and the instance that verified.
  //
  //     Caveat, stated rather than assumed: all of these appear only when the
  //     project has "Enable access to System Environment Variables" ticked,
  //     and this was verified from the documentation, not against the live
  //     deployment. That is precisely why `verify` tries every candidate
  //     instead of recomputing one — if this tier is missing on one side, or
  //     present on one side and not the other, the worst outcome is a cookie
  //     that does not open and a fresh code, never a permanent refusal.
  const deploymentId = (process.env.VERCEL_DEPLOYMENT_ID ?? '').trim();
  const vercelUrl = (process.env.VERCEL_URL ?? '').trim();
  const commitSha = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').trim();
  if (deploymentId) {
    candidates.push({ tier: 'vercel_deployment', material: `uyiz.2fa.vercel.deployment:${deploymentId}` });
  }
  if (vercelUrl && commitSha) {
    candidates.push({ tier: 'vercel_url_sha', material: `uyiz.2fa.vercel.url+sha:${vercelUrl}:${commitSha}` });
  }
  if (vercelUrl) {
    candidates.push({ tier: 'vercel_url', material: `uyiz.2fa.vercel.url:${vercelUrl}` });
  }

  // (d) Nothing else exists. Development, or a self-hosted single process.
  candidates.push({ tier: 'ephemeral', material: `uyiz.2fa.ephemeral:${ephemeralMaterial()}` });

  return candidates;
}

let loggedKeyTier = false;

/** The keys `send` seals with, and the tier it is running on. Logged once per
 *  process so an operator reading the function log can see which rung of the
 *  ladder this deployment landed on without adding any instrumentation.
 *
 *  Usually one key. The exception closes the last way FINDING D could come
 *  back: `verify` trying every candidate rescues a cookie whose sealing tier
 *  `verify` ALSO has, but not one sealed under a tier only `send` can see —
 *  if `send` read VERCEL_DEPLOYMENT_ID and `verify` somehow did not, every
 *  correct code would come back "muddati tugagan" and a fresh code would fail
 *  the same way. So when the ladder is already down among the deployment
 *  tiers, the challenge is sealed under ALL of them and the cookie carries
 *  every copy: the two routes then only have to share ONE identifier, in
 *  either direction, for the login to complete.
 *
 *  That costs nothing, and it is confined to the tiers where it costs nothing.
 *  Those materials are all reconstructible by the same person — anyone who
 *  knows the deployment — so adding a second copy tells an attacker nothing
 *  the first did not. It is deliberately NOT done when SECRET_KEY is present:
 *  sealing a second copy under a guessable key would hand away exactly the
 *  secrecy SECRET_KEY was set to buy. On that tier the cookie carries one copy
 *  and one only. */
function sealingKeys(): { tier: KeyTier; materials: string[] } {
  const candidates = keyCandidates();
  const best = candidates[0];

  const materials =
    best.tier === 'secret_key' || best.tier === 'ephemeral'
      ? [best.material]
      : candidates.filter((c) => c.tier !== 'ephemeral').map((c) => c.material);

  if (!loggedKeyTier) {
    loggedKeyTier = true;
    if (best.tier === 'secret_key') {
      console.info('[2fa] challenge sealing key: SECRET_KEY — the intended path.');
    } else if (best.tier === 'ephemeral') {
      console.error(
        '[2fa] challenge sealing key: a PER-PROCESS RANDOM key. Nothing else was ' +
          'available — no SECRET_KEY and no Vercel deployment identifiers. This works ' +
          'only while one process serves both routes (next dev, next start). Set ' +
          'SECRET_KEY (openssl rand -hex 32). See admin/.env.example.',
      );
    } else {
      console.error(
        '[2fa] challenge sealing key: DERIVED FROM THE VERCEL DEPLOYMENT (tier %s) ' +
          'because SECRET_KEY is unset or shorter than 32 characters. The second ' +
          'factor works, but this key is weaker than the intended one: it is not a ' +
          'secret — anyone who knows the deployment can reconstruct it — and it ' +
          'rotates on every deploy. Set SECRET_KEY in the Vercel project ' +
          '(openssl rand -hex 32). See admin/.env.example.',
        best.tier,
      );
    }
  }
  return { tier: best.tier, materials };
}

type ChallengePayload = {
  /** username, already lowercased and trimmed */
  u: string;
  /** the six-digit code */
  c: string;
  /** epoch milliseconds */
  e: number;
};

/** iv ‖ authTag ‖ ciphertext, base64url so it is a legal cookie value. */
function sealChallenge(material: string, payload: ChallengePayload): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', challengeKey(material), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

/** The cookie value: one sealed copy per key, joined. Each copy gets its own
 *  random IV, so the copies do not reveal each other. Three copies of a ~45
 *  byte payload is under 350 characters — nowhere near a cookie's 4 KB. */
function sealChallengeCookie(materials: string[], payload: ChallengePayload): string {
  return materials
    .slice(0, MAX_PARTS)
    .map((material) => sealChallenge(material, payload))
    .join(PART_SEPARATOR);
}

/* ── the same-origin guard, made proxy-tolerant ──────────────────────────
 *
 * Duplicated verbatim in ../verify/route.ts.
 *
 * `isSameOrigin` compares the browser's Origin against `req.nextUrl.origin`.
 * The three sibling auth routes have shipped with exactly that and are fine,
 * but it is new on these two, and behind a proxy `nextUrl.origin` can be the
 * internal origin rather than the host the browser typed — which would be a
 * 403 on every login. After FINDING D no new refusal on this path gets to be
 * taken on trust, so the comparison is also allowed to succeed against the
 * host the proxy forwarded.
 *
 * This is NOT weakened to "allow when the header is absent". A request still
 * has to name an origin (Origin, else Referer) and that origin still has to
 * match a host this deployment is actually being served as. An attacker's page
 * carries its own host in Origin and matches neither side, which is the entire
 * property the guard is here for.
 *
 * The residual case a reader will spot: a caller that sets BOTH Origin and
 * x-forwarded-host to its own host passes. That is not the attack this guard
 * defends against. Page script cannot set x-forwarded-host on a cross-site
 * request — it is not CORS-safelisted, and the plain HTML form POST described
 * in ../../same-origin.ts sets no headers at all — and the proxy in front of
 * this deployment writes that header itself from the real Host. A
 * server-to-server caller can of course send anything, and gains nothing by
 * it: it holds no administrator's cookies to ride, which is the whole of what
 * CSRF is.
 */
function isSameOriginTolerant(req: NextRequest): boolean {
  if (isSameOrigin(req)) return true;

  // x-forwarded-host may be a comma-separated chain; the first entry is the
  // host the browser actually asked for.
  const forwarded = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (!forwarded) return false;

  const claimed = req.headers.get('origin') ?? req.headers.get('referer');
  if (!claimed) return false;

  try {
    return new URL(claimed).host.toLowerCase() === forwarded;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // FINDING B: this route was reachable by anyone on the web. The guard the
  // three sibling auth routes carry stops the cross-site form POST described
  // in ../../same-origin.ts, which could post a code to the operations channel
  // under the victim's name and — because a `SameSite=Lax` cookie is still
  // STORED from a cross-site POST response — overwrite the pending challenge
  // an administrator was in the middle of typing.
  if (!isSameOriginTolerant(req)) {
    return NextResponse.json({ ok: false, error: 'forbidden_origin' }, { status: 403 });
  }

  // `req.json()` will hand back whatever JSON says, including a number or an
  // array, and every later use of `username` is a string method. Check the
  // type here or the handler throws a 500 with a stack in the function log.
  const body = (await req.json().catch(() => null)) as { username?: unknown } | null;
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  if (!username) {
    return NextResponse.json({ ok: false, error: 'username_required' }, { status: 400 });
  }
  if (username.length > USERNAME_MAX) {
    return NextResponse.json({ ok: false, error: 'username_invalid' }, { status: 400 });
  }

  // FINDING D: every path from here to the end answers 200. The only question
  // is whether a challenge was really delivered — `twoFactorRequired` — and
  // the login page signs the operator in on the credentials the backend
  // already verified when it was not. See the note at the bottom of
  // ../verify/route.ts: this factor is defence in depth, not the gate, so
  // standing aside costs a layer and costs nobody the panel.
  const config = readTelegramConfig();
  if (!config) {
    console.error(
      '[2fa] SECOND FACTOR DISABLED: no Telegram bot token and/or no chat id is ' +
        'configured, so there is nowhere to deliver a code. Logins are proceeding on ' +
        'password alone. Set TELEGRAM_2FA_BOT_TOKEN (or TELEGRAM_BOT_TOKEN) and ' +
        'TELEGRAM_2FA_CHANNEL_ID (or TELEGRAM_ADMIN_CHANNEL_ID / TELEGRAM_GROUP_ID) ' +
        'in the Vercel project. See admin/.env.example.',
    );
    return standAside('2fa_not_configured');
  }

  const sealing = sealingKeys();

  // The one case where a key exists but cannot be relied on to reach the
  // route that has to open it: a random per-process key in production, where
  // `send` and `verify` may be different instances of different functions. A
  // code sealed under it would verify only by luck, and a code that cannot be
  // verified is FINDING D wearing a different hat — the operator sits at step
  // 2 retyping a correct code forever. Stand aside instead.
  if (sealing.tier === 'ephemeral' && process.env.NODE_ENV === 'production') {
    console.error(
      '[2fa] SECOND FACTOR DISABLED: the only sealing key available is a per-process ' +
        'random one, which two production instances do not share, so a code issued now ' +
        'could not be verified. Logins are proceeding on password alone. Set SECRET_KEY ' +
        '(openssl rand -hex 32) in the deployment environment. See admin/.env.example.',
    );
    return standAside('2fa_key_unavailable');
  }

  // Generate a random 6-digit verification code. randomInt, not Math.random:
  // this value is a credential and Math.random is a predictable PRNG.
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = Date.now() + CHALLENGE_TTL_SECONDS * 1000;

  // FINDING C: `username` arrives in the request body and lands inside a
  // `parse_mode: 'HTML'` message, so an unescaped value let a caller close the
  // <code> tag and post arbitrary clickable HTML — a phishing link signed by
  // the trusted 2FA bot, sitting in the staff supergroup next to real codes.
  // Escaping an interpolated value is not a change to the message formatting
  // ADDENDUM-3 S1.5 asked to preserve; the template below is byte-identical.
  const safeUsername = escapeHtml(username);

  const message =
    `🔐━━━━━━━━━━━━━━━━━━━━━━🔐\n` +
    `   🛡️ <b>UYIZ.UZ — 2FA XAVFSIZLIK KODI</b> 🛡️\n` +
    `🔐━━━━━━━━━━━━━━━━━━━━━━🔐\n\n` +
    `⚡ <b>Tasdiqlash kodi:</b> <code>${code}</code>\n` +
    `👤 <b>Admin:</b> <code>${safeUsername}</code>\n` +
    `⏱ <b>Amal qilish muddati:</b> 1 daqiqa (60 soniya)\n` +
    `📍 <b>Tizim:</b> Admin Panelga kirish\n\n` +
    `⚠️ <i>DIQQAT: Ushbu kod faqat admin kirishi uchun. Agar bu so‘rovni siz yubormagan bo‘lsangiz, zudlik bilan parolingizni yangilang!</i>\n` +
    `🔐━━━━━━━━━━━━━━━━━━━━━━🔐`;

  let anySent = false;
  let sendDescription: string | undefined;

  try {
    const resp = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    const data = (await resp.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    anySent = data?.ok ?? false;
    sendDescription = data?.description;
  } catch (err: unknown) {
    sendDescription = err instanceof Error ? err.message : String(err);
  }

  // FINDING D, the case that actually took the panel down in spirit: a code
  // was generated and the cookie was set, but Telegram never delivered
  // anything. The old flow still advanced to step 2 and asked for a code that
  // was sitting in nobody's chat. A factor that cannot be delivered stands
  // aside; it does not become a puzzle.
  //
  // FINDING B again: the failure detail stays in the function log. It is
  // either Telegram's own error string or an error from a fetch whose URL
  // embeds the bot token, and the browser has no use for either.
  if (!anySent) {
    console.error('[2fa] telegram sendMessage failed: %s', sendDescription ?? 'no response');
    console.error(
      '[2fa] SECOND FACTOR SKIPPED for this login: the code could not be delivered, so ' +
        'requiring it would lock the operator out of the panel. Login is proceeding on ' +
        'password alone. Check the bot token, and that the bot is an ADMINISTRATOR in ' +
        'the target group and that the chat id carries its leading -100.',
    );
    return standAside('2fa_send_failed');
  }

  const res = NextResponse.json({
    ok: true,
    twoFactorRequired: true,
    expiresIn: CHALLENGE_TTL_SECONDS,
    sentToTelegram: true,
  });

  // The whole challenge, sealed. The browser can carry it and hand it back;
  // it cannot read the code out of it, and it cannot change the username or
  // push the expiry out, because GCM's auth tag makes any edit fail to open.
  res.cookies.set(CHALLENGE_COOKIE, sealChallengeCookie(sealing.materials, {
    u: username.toLowerCase(),
    c: code,
    e: expiresAt,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CHALLENGE_TTL_SECONDS,
  });

  return res;
}

/** The factor could not be delivered, so it steps out of the way.
 *
 *  `ok: true` with `twoFactorRequired: false` — 200, not 503, because the
 *  login page treats a non-ok body as a hard error and that is what stranded
 *  every administrator at step 1 on 06.09.2026. NO cookie is set: there is no
 *  challenge to carry, and `verify` is never reached on this path. Any cookie
 *  from an earlier send is left to expire on its own within the minute; it is
 *  a sealed blob whose code nobody has, and it buys no session by itself.
 *
 *  `reason` is a fixed machine-readable string. The diagnosis lives in the
 *  function log, never in this body — the log can name Telegram's error and
 *  the browser cannot be trusted with it. */
function standAside(reason: string): NextResponse {
  return NextResponse.json({
    ok: true,
    twoFactorRequired: false,
    sentToTelegram: false,
    error: reason,
  });
}

/** Escape the three characters Telegram's HTML parse mode treats as markup.
 *
 *  Telegram's own documentation lists exactly these: `&`, `<` and `>`. `&`
 *  must go first or it would re-escape the ampersands the other two produce. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Put a Telegram chat id into the form the Bot API actually accepts.
 *
 *  Mirrors `normalise_chat_id` in backend_python/app/core/config.py rule for
 *  rule, because this project has already lost a day to it once: a supergroup
 *  id is negative and begins -100, it very often loses the sign when it is
 *  copied out of a client or a log, and a positive id is read by Telegram as a
 *  USER id — the send comes back "Bad Request: chat not found" with nothing
 *  anywhere saying why. `@channelusername` and an already-signed id are
 *  returned untouched. */
function normaliseChatId(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  if (value.startsWith('@') || value.startsWith('-')) return value;
  if (/^\d+$/.test(value) && value.startsWith('100') && value.length >= 13) return `-${value}`;
  return value;
}

/** Where the code is delivered, or null if there is nowhere to deliver it.
 *
 *  Two names are read for each half, most specific first. The 2FA-specific
 *  names are the ones to set — a bot that only posts login codes can be
 *  revoked without silencing the ops notifications — but falling back to the
 *  project's general Telegram names means an existing deployment that already
 *  has a bot and a group keeps its second factor instead of silently losing
 *  it. There is still no hardcoded literal anywhere in this file: the names
 *  are read or the factor stands aside. */
function readTelegramConfig(): { botToken: string; chatId: string } | null {
  const botToken = (process.env.TELEGRAM_2FA_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  const chatId = normaliseChatId(
    process.env.TELEGRAM_2FA_CHANNEL_ID ??
      process.env.TELEGRAM_ADMIN_CHANNEL_ID ??
      process.env.TELEGRAM_GROUP_ID,
  );
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}
