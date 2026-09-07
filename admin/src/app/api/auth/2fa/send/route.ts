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

/** Derive the sealing key from SECRET_KEY.
 *
 *  HKDF, not scrypt: SECRET_KEY is a high-entropy random key, not a password,
 *  so there is nothing for a work factor to defend — scrypt would only add
 *  ~100 ms of CPU to every serverless invocation of both routes. The salt and
 *  info strings are what keep this key application-specific, so a challenge
 *  cookie can never be mistaken for, or reused as, anything else signed or
 *  encrypted with the same SECRET_KEY. */
function challengeKey(secretKey: string): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', secretKey, HKDF_SALT, HKDF_INFO, 32));
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
function sealChallenge(secretKey: string, payload: ChallengePayload): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', challengeKey(secretKey), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

export async function POST(req: NextRequest) {
  // FINDING B: this route was reachable by anyone on the web. The guard the
  // three sibling auth routes carry stops the cross-site form POST described
  // in ../../same-origin.ts, which could post a code to the operations channel
  // under the victim's name and — because a `SameSite=Lax` cookie is still
  // STORED from a cross-site POST response — overwrite the pending challenge
  // an administrator was in the middle of typing.
  if (!isSameOrigin(req)) {
    return NextResponse.json({ ok: false, error: 'forbidden_origin' }, { status: 403 });
  }

  const config = readConfig();
  if (!config) {
    return NextResponse.json({ ok: false, error: '2fa_not_configured' }, { status: 503 });
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
        chat_id: config.channelId,
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

  // FINDING B again: the failure detail stays in the function log. It is
  // either Telegram's own error string or an error from a fetch whose URL
  // embeds the bot token, and the browser has no use for either.
  if (!anySent) {
    console.error('[2fa] telegram sendMessage failed: %s', sendDescription ?? 'no response');
  }

  const res = NextResponse.json({
    ok: true,
    expiresIn: CHALLENGE_TTL_SECONDS,
    sentToTelegram: anySent,
  });

  // The whole challenge, sealed. The browser can carry it and hand it back;
  // it cannot read the code out of it, and it cannot change the username or
  // push the expiry out, because GCM's auth tag makes any edit fail to open.
  res.cookies.set(CHALLENGE_COOKIE, sealChallenge(config.secretKey, {
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

/** Escape the three characters Telegram's HTML parse mode treats as markup.
 *
 *  Telegram's own documentation lists exactly these: `&`, `<` and `>`. `&`
 *  must go first or it would re-escape the ampersands the other two produce. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let warnedNotConfigured = false;

/** The three names this route refuses to invent a value for.
 *
 *  A second factor that silently degrades to a key published in the
 *  repository is worse than one that is visibly off, so there is no `||`
 *  fallback anywhere in this file. A SECRET_KEY under 32 characters is
 *  treated as absent: it is the key material the challenge is sealed with. */
function readConfig(): { secretKey: string; botToken: string; channelId: string } | null {
  const secretKey = process.env.SECRET_KEY ?? '';
  const botToken = process.env.TELEGRAM_2FA_BOT_TOKEN ?? '';
  const channelId = process.env.TELEGRAM_2FA_CHANNEL_ID ?? '';
  if (secretKey.length < 32 || !botToken || !channelId) {
    if (!warnedNotConfigured) {
      warnedNotConfigured = true;
      console.error(
        '[2fa] refusing to run: SECRET_KEY (>=32 chars), TELEGRAM_2FA_BOT_TOKEN and ' +
          'TELEGRAM_2FA_CHANNEL_ID must all be set. See admin/.env.example.',
      );
    }
    return null;
  }
  return { secretKey, botToken, channelId };
}
