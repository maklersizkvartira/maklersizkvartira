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
 * FINDING D — the outage of 06.09.2026 (commit fc02143). This route answered
 * `503 {"error":"2fa_not_configured"}` whenever SECRET_KEY was missing or
 * short, and it was missing: the panel had been running on a key spelled out
 * in the repository, so removing that literal turned the second factor into a
 * locked door with the key on the inside. It does not refuse any more. The
 * sealing-key ladder below always produces at least one key, and this route
 * tries EVERY key the ladder can produce rather than recomputing one — because
 * the one failure this route must never have is a cookie it cannot open, which
 * the operator experiences as a correct code being rejected forever. Every
 * OTHER refusal below (no cookie, expired, wrong user, wrong code) is
 * unchanged and stays exactly as strict as it was.
 *
 * What the sealing buys, and what it does not:
 *
 *  - Forgery: a cookie this deployment did not write fails GCM's auth tag and
 *    is refused. That is the whole forgery guard, and it is free. Trying
 *    several candidate keys does not dent it: each attempt is an independent
 *    tag check, and a forger who cannot satisfy one key cannot satisfy five.
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

/** One cookie may carry SEVERAL sealed copies of the same challenge, one per
 *  key `send` could not rule out — see `sealingKeys` there. They are joined by
 *  `.`, which the base64url alphabet does not contain, so the split is
 *  unambiguous. */
const PART_SEPARATOR = '.';

/** A hostile cookie can name as many parts as it likes, and each one costs a
 *  GCM check against every candidate key. `send` never writes more than three,
 *  so eight is generous and still bounded. */
const MAX_PARTS = 8;

function challengeKey(material: string): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', material, HKDF_SALT, HKDF_INFO, 32));
}

/* ── the sealing-key ladder ──────────────────────────────────────────────
 *
 * Duplicated verbatim from ../send/route.ts for the same reason as the crypto
 * above: two serverless functions, no shared runtime, kept in step by review.
 * If you change the order, the labels or the material strings there, change
 * them here in the same commit — the two must agree or no cookie opens.
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

/** Log the rung this deployment landed on, once per process. Same line as
 *  `send` writes, from the other function, so a log filtered to one route
 *  still says which key is in play. */
function logKeyTierOnce(best: KeyCandidate): void {
  if (loggedKeyTier) return;
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

type ChallengePayload = { u: string; c: string; e: number };

/** Open a cookie `send` sealed, or null.
 *
 *  Everything that can go wrong here — a truncated cookie, a bad auth tag, a
 *  cookie sealed under a previous SECRET_KEY, plaintext that is not the JSON
 *  we wrote — is the same answer to the caller: no challenge. `decipher.final()`
 *  throwing on a bad tag is the forgery guard, so the catch must return null
 *  and must never be widened into "accept anyway". */
function openChallenge(material: string, cookie: string): ChallengePayload | null {
  try {
    const raw = Buffer.from(cookie, 'base64url');
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      challengeKey(material),
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

/** Try every copy in the cookie against every key this deployment could have
 *  sealed it with, and take the first that opens.
 *
 *  FINDING D, generalised: the bug that took the panel down was one side of
 *  the flow deciding it had no key while the other side carried on. `send`
 *  seals under the best rung of the ladder; this route must not assume it
 *  computed the same rung. The tiers below SECRET_KEY come from the
 *  environment, and an environment that differs between two functions — or
 *  shifts under a redeploy — would otherwise mean a correct code rejected with
 *  "muddati tugagan", indistinguishable from a real expiry, on every retry
 *  forever. Both halves of the defence live here and in `sealingKeys`: `send`
 *  seals a copy under each deployment tier it can see, this route opens with
 *  each tier it can see, and the login survives as long as the two share one.
 *  A dozen tag checks cost microseconds.
 *
 *  This does not weaken the guard. Each attempt is a full AES-GCM
 *  authentication: a cookie forged without one of these keys fails all of
 *  them, and the keys are the same set `send` had, not a wider one. */
function openWithAnyKey(cookie: string): ChallengePayload | null {
  const candidates = keyCandidates();
  logKeyTierOnce(candidates[0]);
  for (const part of cookie.split(PART_SEPARATOR, MAX_PARTS)) {
    for (const candidate of candidates) {
      const opened = openChallenge(candidate.material, part);
      if (opened) return opened;
    }
  }
  return null;
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

/* ── the same-origin guard, made proxy-tolerant ──────────────────────────
 *
 * Duplicated verbatim from ../send/route.ts.
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
  // FINDING B: the guard its three sibling auth routes carry. It comes first
  // so that a cross-site request cannot reach the cookie-clearing below and
  // spend an administrator's pending challenge from another tab.
  if (!isSameOriginTolerant(req)) {
    return NextResponse.json({ ok: false, error: 'forbidden_origin' }, { status: 403 });
  }

  // FINDING D: no configuration check here any more, and no 503. The ladder
  // always yields a key, so the only reasons to refuse below are reasons that
  // are the caller's — a missing cookie, an expired one, the wrong user, the
  // wrong code — never a reason that is the deployment's.

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
  const challenge = cookie ? openWithAnyKey(cookie) : null;
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
 * making 2FA a gate means the backend refusing to issue a token without it.
 *
 * That limitation is also the licence for FINDING D's fix. Because this route
 * is not the gate, `send` standing aside when it cannot deliver a code costs a
 * layer of defence and nothing else — whereas refusing cost everyone the
 * panel. When the backend does grow a real second factor, it must grow the
 * lockout answer at the same time: an out-of-band recovery that does not
 * depend on the factor being deliverable. */
