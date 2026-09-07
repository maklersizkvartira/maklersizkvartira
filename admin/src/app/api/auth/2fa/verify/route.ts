import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { isSameOrigin } from '../../same-origin';

/**
 * Checks the code the operator typed against the challenge `send` sealed.
 *
 * S1: the old version recomputed `HMAC(SECRET_KEY, "<cookie.username>:<posted
 * code>:<cookie.expiresAt>")` and compared it to an HMAC that also came out of
 * the cookie. Every input was the client's, and the key was hardcoded, so the
 * check verified nothing.
 *
 * The version after that kept the challenge in a `globalThis` Map. FINDING A:
 * there is no such shared Map on Vercel — `send` and `verify` are separate
 * serverless functions, each with many instances, all torn down when idle — so
 * a verify that landed anywhere but on the instance that had served the send
 * answered "code expired" and the operator could never log in. The challenge
 * is now carried by the cookie itself, sealed with AES-256-GCM under a key
 * derived from SECRET_KEY, and this route opens it.
 *
 * What the sealing buys, and what it does not:
 *
 *  - Forgery: a cookie this deployment did not write fails GCM's auth tag and
 *    is refused. That is the whole forgery guard, and it is free.
 *  - Offline brute force: an HMAC over the code would have been a verifier —
 *    hand an attacker one and they try all 900 000 codes on a laptop. There is
 *    no verifier here: the sealed blob reveals nothing to test a guess
 *    against, so guessing means asking this route, one request at a time.
 *  - Single use: the cookie is cleared on EVERY outcome below. Serverless
 *    cannot keep the old try-counter — nothing persists between two requests —
 *    so destroying the challenge is what replaces it. A browser therefore gets
 *    exactly one guess per code actually delivered to Telegram: one in a
 *    million. Be honest about the limit: a scripted client keeps its own copy
 *    of the cookie and can keep posting guesses until the 60 seconds run out,
 *    which is still an online-only attack against a code that expires, but it
 *    is not literally one guess. Bounding that needs shared state (the backend
 *    or a KV), and the real fix is making the backend require the second
 *    factor at all — see the note at the bottom of this file.
 */

const CHALLENGE_COOKIE = '2fa_challenge';

/** A code is six digits. Anything longer is not a typo, and the value is used
 *  to build a Buffer, so cap it before it gets there. */
const CODE_MAX = 12;

/* ── the sealed challenge ────────────────────────────────────────────────
 *
 * Duplicated verbatim from ../send/route.ts — the two routes are separate
 * serverless functions and share no runtime. See the note there. */

const IV_BYTES = 12;
const TAG_BYTES = 16;
const HKDF_SALT = 'uyiz.admin.2fa.challenge.v1';
const HKDF_INFO = 'aes-256-gcm challenge cookie';

function challengeKey(secretKey: string): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', secretKey, HKDF_SALT, HKDF_INFO, 32));
}

type ChallengePayload = { u: string; c: string; e: number };

/** Open a cookie `send` sealed, or null.
 *
 *  Everything that can go wrong here — a truncated cookie, a bad auth tag, a
 *  cookie sealed under a previous SECRET_KEY, plaintext that is not the JSON
 *  we wrote — is the same answer to the caller: no challenge. `decipher.final()`
 *  throwing on a bad tag is the forgery guard, so the catch must return null
 *  and must never be widened into "accept anyway". */
function openChallenge(secretKey: string, cookie: string): ChallengePayload | null {
  try {
    const raw = Buffer.from(cookie, 'base64url');
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      challengeKey(secretKey),
      raw.subarray(0, IV_BYTES),
    );
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const plain = Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
    const parsed = JSON.parse(plain) as Partial<ChallengePayload>;
    if (typeof parsed?.u !== 'string' || typeof parsed?.c !== 'string' || typeof parsed?.e !== 'number') {
      return null;
    }
    return { u: parsed.u, c: parsed.c, e: parsed.e };
  } catch {
    return null;
  }
}

/** Every response this route sends clears the cookie — see the single-use
 *  paragraph above. It is set with the same attributes `send` used, because a
 *  browser only replaces a cookie when name, path and domain all match. */
function spent(res: NextResponse): NextResponse {
  res.cookies.set(CHALLENGE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}

let warnedNotConfigured = false;

/** SECRET_KEY with no fallback: the challenge is sealed under a key derived
 *  from it, so a missing or short key means no cookie here can be opened at
 *  all. Fail closed and say so rather than degrade to a published key. */
function readSecretKey(): string | null {
  const secretKey = process.env.SECRET_KEY ?? '';
  if (secretKey.length < 32) {
    if (!warnedNotConfigured) {
      warnedNotConfigured = true;
      console.error(
        '[2fa] refusing to verify: SECRET_KEY must be set and at least 32 characters. ' +
          'See admin/.env.example.',
      );
    }
    return null;
  }
  return secretKey;
}

export async function POST(req: NextRequest) {
  // FINDING B: the guard its three sibling auth routes carry. It comes first
  // so that a cross-site request cannot reach the cookie-clearing below and
  // spend an administrator's pending challenge from another tab.
  if (!isSameOrigin(req)) {
    return NextResponse.json({ ok: false, error: 'forbidden_origin' }, { status: 403 });
  }

  const secretKey = readSecretKey();
  if (!secretKey) {
    return NextResponse.json({ ok: false, error: '2fa_not_configured' }, { status: 503 });
  }

  // Type-check the body: `code` reaches Buffer.from and `username` reaches
  // toLowerCase, and JSON can carry a number or an array into either.
  const body = (await req.json().catch(() => null)) as
    | { username?: unknown; code?: unknown }
    | null;
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  const postedUsername = typeof body?.username === 'string' ? body.username.trim() : '';

  if (!postedUsername || !code || code.length > CODE_MAX) {
    return NextResponse.json(
      { ok: false, message: 'Foydalanuvchi nomi va kod kiritilishi shart' },
      { status: 400 },
    );
  }

  const cookie = req.cookies.get(CHALLENGE_COOKIE)?.value;
  const challenge = cookie ? openChallenge(secretKey, cookie) : null;
  if (!challenge) {
    return spent(
      NextResponse.json(
        { ok: false, message: 'Tasdiqlash muddati tugagan. Qaytadan kod so‘rang.' },
        { status: 400 },
      ),
    );
  }

  if (Date.now() > challenge.e) {
    return spent(
      NextResponse.json(
        { ok: false, message: 'Kod muddati (1 daqiqa) tugagan. Qaytadan kod jo‘nating.' },
        { status: 400 },
      ),
    );
  }

  // The username is the sealed one, never the posted one. Comparing them only
  // rejects a request that names a different admin than the code was sent for,
  // instead of quietly proceeding as the sealed user.
  if (challenge.u !== postedUsername.toLowerCase()) {
    return spent(
      NextResponse.json({ ok: false, message: 'Foydalanuvchi mos kelmadi' }, { status: 400 }),
    );
  }

  // timingSafeEqual needs equal lengths — it throws otherwise — so the length
  // is compared first and short-circuits. The lengths of two six-digit codes
  // never differ in practice, and a length that does differ is already a wrong
  // code, so nothing is leaked by answering it early.
  const expected = Buffer.from(challenge.c, 'utf8');
  const supplied = Buffer.from(code, 'utf8');
  const matches =
    expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);

  if (!matches) {
    return spent(
      NextResponse.json({ ok: false, message: 'Kiritilgan tasdiqlash kodi noto‘g‘ri!' }, { status: 400 }),
    );
  }

  return spent(NextResponse.json({ ok: true }));
}

/* A deliberate limitation, stated here so the next reader does not have to
 * infer it: passing this route is not what logs anybody in. The whole flow is
 * orchestrated by the browser — login/page.tsx calls verifyCredentials, then
 * 2fa/send, then 2fa/verify, and then doLogin against the backend — and the
 * backend has no second factor of its own. Anyone holding the password can
 * call doLogin directly and never touch these routes. This file closes a real
 * forgery hole and is worth having, but it is defence in depth, not a gate;
 * making 2FA a gate means the backend refusing to issue a token without it. */
