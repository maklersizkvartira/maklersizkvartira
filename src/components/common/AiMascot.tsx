/**
 * Uyiz AI — the floating assistant.
 *
 * It converses, filters the listings database down to what the visitor
 * describes, and can hand them off to a person; the file is named for the role
 * rather than the product so the next rename is a copy change, not a move.
 *
 * The session key is issued by the server and kept in sessionStorage. The
 * previous build minted its own key (`sk-<random>-<timestamp>`) and stored it
 * in localStorage, which was both guessable and shared across tabs, so one
 * visitor could read another's conversation. The server now owns the key, the
 * transcript and the daily quota; this component only renders them.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronRight,
  Headset,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';

import { useTranslation, type TranslationKey } from '../../i18n';
import { AssistantApi } from '../../services/listingsApi';
import { ApiError } from '../../services/http';
import { useAppStore, type Filters } from '../../stores/useAppStore';
import type { Listing } from '../../types';
import { ListingCard } from '../listings/ListingCard';
import { Button } from '../ui/Field';
import { sessionStore } from '../../lib/storage';

const SESSION_STORAGE_KEY = 'uyiz.assistant.session';
/** What the key was called before the brand changed; migrated on first read. */
const LEGACY_SESSION_STORAGE_KEY = 'maklersiz.assistant.session';

const AUDIENCES = ['ALL', 'STUDENT', 'FAMILY'] as const;
const RENTAL_TYPES = ['ALL', 'FULL', 'ROOMMATE'] as const;
/** Renting or buying. Same three values the store's `Filters.dealType` holds. */
const DEAL_TYPES = ['RENT', 'SALE', 'ALL'] as const;

interface ChatMessage {
  id: number;
  /** `admin` is a person from the team who has taken the conversation over. */
  from: 'ai' | 'me' | 'admin';
  text: string;
  listings?: Listing[];
  /** Tool names the assistant ran that changed something, e.g. `add_favorite`. */
  actions?: string[];
  /** Waiting on a yes/no about something irreversible. */
  awaitingConfirmation?: boolean;
  /**
   * Written here rather than by the server — the greeting and the three
   * failure notices. The background poll reconciles server-backed rows only,
   * so a bubble the transcript on the server has never contained must never be
   * adopted as one — a local notice would swallow a real message.
   */
  local?: boolean;
  /**
   * The id of the transcript row on the server this bubble *is*, once the poll
   * has confirmed it (H-FIX-1).
   *
   * Undefined means one of two things, and the difference is the whole point:
   * either the bubble is `local` and the server will never have it, or it is
   * optimistic — drawn the instant the visitor pressed send, before the
   * server had heard of it. An optimistic bubble is what the poll adopts when
   * the row for it finally arrives, instead of appending a second copy.
   */
  serverId?: string;
  /**
   * `failed` when the send threw (H-FIX-4).
   *
   * http.ts aborts after 20s and a multi-tool turn regularly runs longer, so
   * this is a routine outcome rather than an exotic one. Leaving the bubble
   * looking delivered next to an error notice tells the visitor two
   * contradictory things at once; and because the server may well have
   * committed the message anyway, the poll clears this again the moment the
   * real row shows up.
   */
  status?: 'failed';
  /**
   * This send's idempotency key, minted in the browser before the request
   * leaves it and carried unchanged through every retry of the same sentence
   * (H-FIX-9).
   *
   * It never reaches the server — `AssistantRequest` is `extra="forbid"`, so
   * an unknown field would 422 every message — and it is not meant to. Its job
   * is here: it names one *attempt by the visitor* rather than one bubble, so
   * a retry re-uses the bubble it already drew instead of deleting it and
   * drawing another. That is what makes a failed send recoverable without
   * destroying the text (the retry used to `filter` the bubble out first and
   * could then no-op, losing the message outright), and it is what `planRetry`
   * keys on when it decides whether the sentence is already on the server.
   *
   * Absent on the greeting, on the failure notices, and on anything replayed
   * from the server's own transcript — none of those was ever sent from here.
   */
  clientId?: string;
}

/** One row of the server transcript, as `AssistantApi.history` returns it. */
export interface TranscriptRow {
  id?: string;
  role: string;
  content: string;
  createdAt: string;
}

/**
 * Tool name to translation key. Anything not listed here ran but has nothing
 * worth announcing — a search speaks for itself through the cards below it.
 */
const ACTION_LABELS: Record<string, TranslationKey> = {
  add_favorite: 'assistant.chat.actions.addFavorite',
  remove_favorite: 'assistant.chat.actions.removeFavorite',
  request_support_callback: 'assistant.chat.actions.requestSupportCallback',
  capture_lead: 'assistant.chat.actions.captureLead',
  my_listings: 'assistant.chat.actions.myListings',
  listing_performance: 'assistant.chat.actions.listingPerformance',
  list_favorites: 'assistant.chat.actions.listFavorites',
};

type Phase = 'idle' | 'loading' | 'ready' | 'error';

let messageSequence = 0;

// The key is per-tab on purpose: a conversation is not something to restore in
// a browser the visitor has since handed to someone else.
function readStoredSession(): string | null {
  return sessionStore.read(SESSION_STORAGE_KEY, LEGACY_SESSION_STORAGE_KEY);
}

function writeStoredSession(key: string | null): void {
  if (key === null) sessionStore.remove(SESSION_STORAGE_KEY, LEGACY_SESSION_STORAGE_KEY);
  else sessionStore.write(SESSION_STORAGE_KEY, key);
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asOneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/**
 * Wire role to bubble author.
 *
 * The transcript used to fold everything that was not `user` into the AI
 * bubble, which was harmless while the server only ever sent two roles. Now
 * that an operator can answer in the same thread, that fold would put a
 * person's words behind the machine's avatar — the one attribution this
 * component must never get wrong.
 */
function roleToFrom(role: string): ChatMessage['from'] {
  if (role === 'user') return 'me';
  if (role === 'admin') return 'admin';
  return 'ai';
}

/**
 * A stable identity for one row of the server's transcript (H-FIX-1).
 *
 * The row's own id, which the history endpoint now returns. The fallback is
 * for a browser holding a bundle older than that endpoint: a timestamp and a
 * role are not unique in principle, but the transcript is written one row at a
 * time and two rows of the same role never share a microsecond, so it is
 * sound in practice — and it is still identity rather than a count, which is
 * the property the poll actually depends on.
 */
function serverMessageKey(entry: { id?: string; role: string; createdAt: string }): string {
  return entry.id || `${entry.createdAt}|${entry.role}`;
}

/**
 * A fresh idempotency key for one thing the visitor is trying to say.
 *
 * `crypto.randomUUID` is only defined in a secure context, and this widget
 * runs in in-app webviews and on the odd plain-http preview, so a fallback is
 * not decoration. The key has to be unique within one tab's log and nothing
 * more — it is never sent anywhere.
 */
function newClientId(): string {
  const source = typeof crypto !== 'undefined' ? crypto : undefined;
  if (typeof source?.randomUUID === 'function') return source.randomUUID();
  return `c${++messageSequence}-${Math.random().toString(36).slice(2)}`;
}

/**
 * The bubble a transcript row belongs to, or -1.
 *
 * Searched newest-first, which is the whole of it. A bubble that never reached
 * the server — a `limit_reached` turn the server declined to store, or a send
 * the visitor never retried — stays unbound for as long as the conversation
 * lasts, and matching oldest-first let that stale bubble adopt a *later*
 * identical message's row: the dead bubble lost its retry button and started
 * reading as delivered, while the message that really was sent sat orphaned
 * beside it. Two identical bubbles, one of them a lie. Only one send is ever
 * in flight (`sending` gates the composer), so the newest unbound match is the
 * one the row can actually be.
 */
function lastUnboundIndex(log: ChatMessage[], from: ChatMessage['from'], text: string): number {
  for (let index = log.length - 1; index >= 0; index -= 1) {
    const message = log[index];
    if (
      message.serverId === undefined
      && !message.local
      && message.from === from
      && message.text === text
    ) {
      return index;
    }
  }
  return -1;
}

/**
 * Fold transcript rows this tab has not rendered yet into the bubbles on
 * screen. Pure, and exported so the regression harness can drive it.
 *
 * Adopt rather than append when the row is a bubble already drawn: the
 * visitor's own optimistic message, or a reply the send call returned.
 * `local` bubbles — the greeting and the failure notices — are ours alone and
 * can never be a match; adopting one would swallow a real message.
 *
 * Clearing `status` on adoption is what makes a 20s timeout on a turn the
 * server did commit heal itself (H-FIX-4): the row arrives, and the bubble
 * marked failed becomes a delivered one.
 */
export function reconcileTranscript(log: ChatMessage[], fresh: TranscriptRow[]): ChatMessage[] {
  const next = [...log];
  const appended: ChatMessage[] = [];
  for (const entry of fresh) {
    const from = roleToFrom(entry.role);
    const optimistic = lastUnboundIndex(next, from, entry.content);
    if (optimistic >= 0) {
      next[optimistic] = {
        ...next[optimistic],
        serverId: serverMessageKey(entry),
        status: undefined,
      };
      continue;
    }
    appended.push({
      id: ++messageSequence,
      from,
      text: entry.content,
      serverId: serverMessageKey(entry),
    });
  }
  return appended.length > 0 ? [...next, ...appended] : next;
}

/**
 * Decide what a retry should do, having just re-read the transcript (H-FIX-9).
 *
 * The bug this closes: a retry POSTed the message again unconditionally, and
 * the route stores every message it is given — there is no server-side dedup.
 * The case the button is *placed in* is exactly the case where the server
 * already has the message: http.ts aborts at 20s and a multi-tool turn
 * regularly runs longer, so "the request timed out but the server processed
 * it" is the normal outcome, not an edge case. Tapping retry in the four
 * seconds before the next poll could adopt the bubble stored the sentence a
 * second time and answered it a second time — duplicated for the visitor and
 * for the operator reading the same thread.
 *
 * So: reconcile first, send only if the sentence is genuinely not there.
 *
 *  - `fresh` are the rows this tab has not rendered (the poll's own filter,
 *    computed by the caller so `seenRef` is advanced exactly once); folding
 *    them in adopts the bubble if the row has just arrived.
 *  - `all` is the whole read. A row can be in `seenRef` already — the poll
 *    filtered it moments ago — and still belong to this bubble, so a row that
 *    matches and that no bubble on screen claims is this bubble's row.
 *  - only when neither finds it does the sentence go back on the wire, under
 *    the same `clientId`, into the same bubble.
 *
 * The bubble is never removed on any path. `resend` true clears the failed
 * mark because the sentence is about to be in flight again; if it fails again
 * `failSend` re-marks that same bubble.
 */
export function planRetry(
  log: ChatMessage[],
  bubble: ChatMessage,
  fresh: TranscriptRow[],
  all: TranscriptRow[],
): { log: ChatMessage[]; resend: boolean } {
  const folded = reconcileTranscript(log, fresh);
  const mine = folded.find((entry) => entry.clientId === bubble.clientId);
  // The conversation was ended under the retry, or the bubble was replayed
  // from history and has no key: there is nothing on screen to answer for, and
  // sending would put a message the visitor cannot see back on the server.
  if (!mine || mine.clientId === undefined) return { log: folded, resend: false };
  if (mine.serverId !== undefined) return { log: folded, resend: false };

  const bound = new Set(
    folded.map((entry) => entry.serverId).filter((id): id is string => id !== undefined),
  );
  const orphan = all.find(
    (entry) =>
      roleToFrom(entry.role) === mine.from
      && entry.content === mine.text
      && !bound.has(serverMessageKey(entry)),
  );
  if (orphan) {
    return {
      log: folded.map((entry) =>
        entry.clientId === mine.clientId
          ? { ...entry, serverId: serverMessageKey(orphan), status: undefined }
          : entry,
      ),
      resend: false,
    };
  }

  return {
    log: folded.map((entry) =>
      entry.clientId === mine.clientId ? { ...entry, status: undefined } : entry,
    ),
    resend: true,
  };
}

/**
 * Which notice a finished send owes the visitor, or null if it succeeded.
 *
 * `limit_reached` is a failure and has to be treated as one (H-FIX-9): that
 * branch of the route returns *before* the row is written, so nothing is
 * stored — the operator desk never sees the question and the closing summary
 * will not contain it either. Leaving the bubble in delivered styling told the
 * visitor the opposite of what happened.
 */
export function sendFailureNoticeKey(status: string): TranslationKey | null {
  if (status === 'limit_reached') return 'assistant.chat.limitReached';
  if (status !== 'success') return 'assistant.chat.replyFailed';
  return null;
}

/**
 * Mark the bubble this send drew as unsent, and say why underneath it.
 *
 * Keyed on `clientId` rather than on the bubble's render id so a retry of the
 * same sentence marks the same bubble. Nothing is removed: a message that
 * failed is still the visitor's, and the retry affordance hangs off the mark.
 */
export function failSend(log: ChatMessage[], clientId: string, notice: string): ChatMessage[] {
  return [
    ...log.map((entry) =>
      entry.clientId === clientId ? { ...entry, status: 'failed' as const } : entry,
    ),
    { id: ++messageSequence, from: 'ai' as const, text: notice, local: true },
  ];
}

/**
 * One enum field the visitor actually stated, or `undefined` for one they did
 * not.
 *
 * `SearchIntent` on the server has no "unset" for these: a sentence that
 * mentioned no deal type, no audience and no rental type still arrives as
 * RENT / ALL / ALL, and `as_dict` emits all three on every single turn. So
 * `asOneOf` alone cannot tell a stated "sotuv" from a defaulted "RENT", and
 * mirroring the default is not following the visitor's search — it is
 * overwriting a choice they made in the catalogue's own filter bar. That is
 * the SALE catalogue that flipped itself back to Ijara because someone typed
 * "rahmat" into the widget. A value equal to the server's default therefore
 * counts as nothing said.
 *
 * The cost is known and deliberate: an explicit "ijara" cannot switch a SALE
 * catalogue back to RENT, because the wire carries no `dealTypeStated` flag
 * for the client to read. Silently ignoring a filter the visitor set by hand
 * is the worse of the two.
 */
function asStated<T extends string>(
  value: unknown,
  allowed: readonly T[],
  serverDefault: T,
): T | undefined {
  const choice = asOneOf(value, allowed);
  return choice === undefined || choice === serverDefault ? undefined : choice;
}

/**
 * The assistant returns only what it managed to extract from the sentence, so
 * a missing field leaves the user's existing filter alone instead of resetting
 * it to 'ALL' the way the previous version did.
 *
 * `matchQuality` says whether anything may be mirrored at all. It is "NONE"
 * exactly when the turn never looked at a listing — a greeting, a thank-you, a
 * question about the company — and such a turn still carries a full intent
 * dictionary, because the server emits every key whether or not it holds
 * anything. Acting on that dictionary sent the catalogue behind the widget
 * back to page 1 on every conversational message. Any other quality, "AGENT"
 * included, did search and may mirror; an unrecognised one is treated as a
 * search, because dropping the defaults above is the guard that actually
 * protects the visitor's filters and it applies either way.
 *
 * The result is empty far more often than it used to be. The caller must keep
 * checking for that and not call `setFilters` with an empty patch: the store
 * resets `page` to 1 and refetches for any patch at all, including one that
 * changes nothing.
 */
export function toFilterPatch(
  need: Record<string, unknown>,
  matchQuality: string | undefined,
): Partial<Filters> {
  const patch: Partial<Filters> = {};
  if (matchQuality === 'NONE') return patch;

  const region = asText(need.region);
  if (region) patch.region = region;

  const district = asText(need.district);
  if (district) {
    patch.district = district;
    // The free-text box mirrors the district so the listings page shows the
    // same intent the assistant just acted on.
    patch.search = district;
  }

  const metroStation = asText(need.metroStation);
  if (metroStation) patch.metroStation = metroStation;

  const rooms = asCount(need.rooms);
  if (rooms !== undefined) patch.rooms = rooms;

  const maxPrice = asCount(need.maxPrice);
  if (maxPrice !== undefined) patch.maxPrice = maxPrice;

  const audience = asStated(need.audience, AUDIENCES, 'ALL');
  if (audience) patch.audience = audience;

  const rentalType = asStated(need.rentalType, RENTAL_TYPES, 'ALL');
  if (rentalType) patch.rentalType = rentalType;

  // D-FIX-2. Without this the assistant could run a whole SALE search, show
  // the visitor flats for sale, and then leave the catalogue behind the widget
  // on `DEFAULT_FILTERS`' RENT — a page of monthly rentals for the search they
  // had just run. `dealType` is the first thing a search decides, so it is the
  // last thing that may be dropped on the way out — but only when the visitor
  // asked for it, which is what `asStated` decides.
  const dealType = asStated(need.dealType, DEAL_TYPES, 'RENT');
  if (dealType) patch.dealType = dealType;

  return patch;
}

export const AiMascot: React.FC = () => {
  const { t } = useTranslation();

  const currentUser = useAppStore((state) => state.currentUser);
  const setFilters = useAppStore((state) => state.setFilters);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [log, setLog] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [quota, setQuota] = useState<{ limit: number; remaining: number } | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  /**
   * Someone from the team is now answering this thread by hand.
   *
   * A plain boolean: no operator name is carried, because the server no
   * longer sends one and must not — an anonymous visitor has no business
   * learning a staff member's legal name (H-FIX-3). The composer deliberately
   * stays enabled: the visitor has to keep writing, they are simply writing to
   * a person instead of to the model.
   */
  const [handover, setHandover] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * The keys of every transcript row already on screen (H-FIX-1).
   *
   * This used to be a count, advanced by the number of rows each turn wrote
   * and then used as an absolute index into the server's array. Those are two
   * different numbers the moment anything writes to the thread that this tab
   * did not: an operator answering between two five-second polls slid the
   * index permanently, so their message was never rendered and the visitor's
   * own message was rendered twice. A set of ids cannot slide.
   */
  const seenRef = useRef<Set<string>>(new Set());
  /** The poll request currently in flight, so the effect cleanup can cancel it. */
  const pollAbortRef = useRef<AbortController | null>(null);
  /**
   * The log as last rendered, readable from an event handler.
   *
   * `retryFailed` has to *decide* something from what is on screen — whether
   * the sentence it is about to re-send is already in the transcript — and a
   * state updater is the wrong place for a decision: React may run one twice
   * and it cannot hand an answer back. This ref holds the last committed
   * render, which is exactly what the visitor was looking at when they tapped
   * retry.
   */
  const logRef = useRef<ChatMessage[]>(log);
  /**
   * The "one send at a time" rule, readable synchronously.
   *
   * `setSending(true)` only takes effect at the next render, so two taps
   * inside one tick both read `sending === false` and both go out. On a phone
   * a double-tap on the retry button is precisely how the duplicated message
   * this fix exists to prevent would be recreated, so the latch that guards it
   * has to be a ref rather than state (H-FIX-9). `sending` stays as well: it
   * is what the composer, the typing indicator and the poll render from.
   */
  const sendingRef = useRef(false);

  // A limit of 0 is the server saying this account has no ceiling. Read
  // literally it would mean "0 requests left" and lock the box shut.
  const metered = quota !== null && quota.limit > 0;
  /**
   * H-FIX-2: the daily quota must not close the composer during a handover.
   *
   * The server skips the quota entirely while an operator holds the thread —
   * but it still reports the exhausted numbers, so the widget was enforcing a
   * limit the server had deliberately abandoned and locking the visitor out of
   * a conversation with a live human.
   */
  const limitReached = metered && quota.remaining <= 0 && !handover;

  const append = useCallback((message: Omit<ChatMessage, 'id'>) => {
    setLog((previous) => [...previous, { ...message, id: ++messageSequence }]);
  }, []);

  const welcome = useCallback(
    (): ChatMessage => ({
      id: ++messageSequence,
      from: 'ai',
      text: currentUser?.name
        ? t('assistant.chat.welcomeNamed', { name: currentUser.name })
        : t('assistant.chat.welcome'),
      local: true,
    }),
    [currentUser?.name, t],
  );

  const startSession = useCallback(async () => {
    setPhase('loading');
    try {
      const existing = readStoredSession();
      if (existing) {
        try {
          const history = await AssistantApi.history(existing);
          setQuota({ limit: history.limit, remaining: history.remaining });
          setLog(
            history.messages.length > 0
              ? history.messages.map((entry) => ({
                  id: ++messageSequence,
                  from: roleToFrom(entry.role),
                  text: entry.content,
                  serverId: serverMessageKey(entry),
                }))
              : [welcome()],
          );
          // Everything replayed here is already on screen; the poll must not
          // deliver it a second time.
          seenRef.current = new Set(history.messages.map(serverMessageKey));
          setHandover(history.handledByHuman === true);
          setPhase('ready');
          return;
        } catch {
          // Expired or unknown key: drop it and ask the server for a fresh one.
          writeStoredSession(null);
        }
      }

      const created = await AssistantApi.createSession();
      writeStoredSession(created.sessionKey);
      setQuota({ limit: created.limit, remaining: created.remaining });
      setLog([welcome()]);
      // A brand-new session: nothing has been seen and nobody has taken it
      // over. Reached from the catch above too, where the previous session's
      // keys would otherwise still be in the set.
      seenRef.current = new Set();
      setHandover(false);
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, [welcome]);

  useEffect(() => {
    if (open && phase === 'idle') void startSession();
  }, [open, phase, startSession]);

  useEffect(() => {
    logRef.current = log;
  }, [log]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log, sending]);

  useEffect(() => {
    if (open && phase === 'ready') inputRef.current?.focus();
  }, [open, phase]);

  /**
   * Pull in anything the visitor did not cause.
   *
   * Once an operator takes the thread over in the admin panel their replies
   * arrive out of band, so the panel has to re-read the transcript on its own.
   * Four things this loop must not do, each of which the surrounding code
   * makes easy to get wrong:
   *
   *  - it appends and never replaces wholesale. `history.messages` carries
   *    only id, role, content and a timestamp, so writing the mapped array
   *    over `log` would silently delete every listing card, every action badge
   *    and every Ha/Yo‘q button pair already rendered underneath a bubble.
   *  - it decides what is new by identity, never by counting (H-FIX-1). See
   *    `seenRef`: a count is only correct as long as this tab is the only
   *    thing writing to the thread, which during a handover it is not.
   *  - it stands down while a send is in flight. `sendText` appends the
   *    visitor's bubble optimistically, before the server has the message; a
   *    tick landing inside that window would race the reconciliation below.
   *  - it reads the session key per tick. `endConversation` clears the key
   *    while an interval can still be scheduled, and a closure over the old
   *    one would keep fetching a conversation the visitor has ended.
   *  - it carries an abort signal (H-FIX-5). Clearing the interval cannot
   *    cancel a request already in flight, and one that resolves after the
   *    panel is gone writes state into a torn-down conversation.
   */
  useEffect(() => {
    if (!open || phase !== 'ready') return undefined;
    const intervalId = setInterval(async () => {
      if (sending) return;
      if (document.visibilityState !== 'visible') return;
      // One poll at a time. On a phone dropping to 3G a request can outlive
      // the five-second tick, and firing a second one would either pile
      // requests up or force us to abort a reply that was about to arrive —
      // during a handover that is the operator's message, delayed again.
      if (pollAbortRef.current) return;
      const sessionKey = readStoredSession();
      if (!sessionKey) return;
      const controller = new AbortController();
      pollAbortRef.current = controller;
      try {
        const history = await AssistantApi.history(sessionKey, { signal: controller.signal });
        setQuota({ limit: history.limit, remaining: history.remaining });
        // H-FIX-3: the banner has to appear while an operator takes the thread
        // over, not only once the visitor happens to type again.
        setHandover(history.handledByHuman === true);

        // Work out what is new *before* touching `log`, so the updater below
        // stays a pure function of its input: React may invoke it twice, and
        // an updater that also advanced `seenRef` would find every key already
        // seen on the second pass and drop the messages it had just accepted.
        const fresh = history.messages.filter((entry) => {
          const key = serverMessageKey(entry);
          if (seenRef.current.has(key)) return false;
          seenRef.current.add(key);
          return true;
        });
        if (fresh.length === 0) return;

        // Adoption, appending and the healing of a failed bubble all live in
        // `reconcileTranscript`, because the retry has to do exactly the same
        // fold before it decides whether to send anything (H-FIX-9) and two
        // copies of this rule would drift apart on the first change.
        setLog((previous) => reconcileTranscript(previous, fresh));
      } catch {
        /* a background refresh that fails, or is aborted, changes nothing */
      } finally {
        if (pollAbortRef.current === controller) pollAbortRef.current = null;
      }
    }, 5000);
    return () => {
      clearInterval(intervalId);
      pollAbortRef.current?.abort();
      pollAbortRef.current = null;
    };
  }, [open, phase, sending]);

  // Escape closes the confirmation first, then the panel — the usual layering.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showCloseConfirm) setShowCloseConfirm(false);
      else setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, showCloseConfirm]);

  /**
   * Put one sentence on the wire and account for how it ended.
   *
   * Split out of `sendText` so a retry can re-use it (H-FIX-9): a retry is the
   * same request under the same `clientId`, into the same bubble, and the
   * bubble is what every outcome below is written against. The caller owns
   * `sending` — a retry holds it across the reconciling read as well as the
   * send, so the poll stands down for the whole operation rather than racing
   * the middle of it.
   */
  const deliver = async (clientId: string, message: string, sessionKey: string) => {
    try {
      const response = await AssistantApi.send(sessionKey, message, currentUser?.name ?? undefined);
      setQuota({ limit: response.limit, remaining: response.remaining });

      // H-FIX-9. Both of these were returns that left the bubble in delivered
      // styling. `limit_reached` is the sharper of the two: that branch of the
      // route answers *before* it writes the row, so the message exists
      // nowhere but this screen — the operator desk never sees the question
      // and the closing summary cannot contain it. Saying "sent" for a message
      // only the visitor will ever see is the one thing the transcript must
      // not do.
      const failureNotice = sendFailureNoticeKey(response.status);
      if (failureNotice !== null) {
        setLog((previous) => failSend(previous, clientId, t(failureNotice)));
        return;
      }

      setHandover(response.handledByHuman === true);
      // A taken-over turn is stored and left there: the model does not answer
      // it, so `reply` is empty. Appending it anyway puts a blank bubble on
      // screen for every message the visitor sends to a person. Nothing is
      // counted here any more — the poll recognises both rows by id and adopts
      // the bubbles already on screen (H-FIX-1).
      if (response.handledByHuman && !response.reply) return;

      append({
        from: 'ai',
        text: response.reply,
        listings: response.listings?.length ? response.listings : undefined,
        actions: response.actions?.length ? response.actions : undefined,
        awaitingConfirmation: response.awaitingConfirmation ?? false,
      });

      // Only a turn that searched may move the catalogue, and only towards
      // what the visitor actually stated — `toFilterPatch` is given the turn's
      // `matchQuality` to decide both. The emptiness check is not a
      // micro-optimisation: `setFilters` puts the listings page back on page 1
      // and refires the fetch for any patch at all, so calling it with one
      // that changes nothing throws away the visitor's place in the results.
      if (response.need) {
        const patch = toFilterPatch(response.need, response.matchQuality);
        if (Object.keys(patch).length > 0) setFilters(patch);
      }
    } catch (error) {
      // H-FIX-4. The message may well have reached the server — http.ts aborts
      // after 20s and an agent turn that runs several tools regularly takes
      // longer — so the bubble is marked, not removed, and the next poll
      // clears the mark if the row turns up.
      setLog((previous) =>
        failSend(
          previous,
          clientId,
          error instanceof ApiError && error.isNetwork
            ? t('assistant.chat.networkFailed')
            : t('assistant.chat.replyFailed'),
        ),
      );
    }
  };

  /**
   * Send one message. `override` exists for the yes/no shortcut buttons,
   * which put a word on the wire without it ever passing through the input —
   * the server reads consent from the message text either way, so a tapped
   * "Ha" and a typed one are the same request.
   */
  const sendText = async (override?: string) => {
    const message = (override ?? text).trim();
    // `limitReached` already stands down during a handover; the second clause
    // is written out anyway so this early return cannot quietly stop matching
    // the composer it guards (H-FIX-2).
    if (!message || sending || sendingRef.current || (limitReached && !handover)) return;

    const sessionKey = readStoredSession();
    if (!sessionKey) {
      setPhase('error');
      return;
    }

    // The idempotency key for this attempt, minted before the bubble is drawn
    // and kept for as many retries as it takes (H-FIX-9). Every outcome — the
    // failed mark, the retry, the poll's adoption — is written against it
    // rather than against a bubble that gets replaced.
    const clientId = newClientId();
    setLog((previous) => [
      ...previous,
      { id: ++messageSequence, from: 'me', text: message, clientId },
    ]);
    if (override === undefined) setText('');
    sendingRef.current = true;
    setSending(true);
    try {
      await deliver(clientId, message, sessionKey);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  /**
   * Try a failed message again — without duplicating it and without losing it
   * (H-FIX-9).
   *
   * Two bugs are closed here, and they pulled in opposite directions.
   *
   * The old version dropped the bubble from the log and then called `sendText`
   * with the text as an override. `sendText`'s own guard could refuse that
   * call — the quota goes to zero the moment the poll refreshes it, and the
   * *retry* button was disabled only while `sending` — so the visitor's
   * sentence was deleted from the transcript and nothing was sent: no bubble,
   * no notice, no way back to what they had written. Hence the same guard as
   * the composer, up front, and a bubble that is never removed.
   *
   * The other direction: re-sending duplicates the message on both sides,
   * because the route stores whatever it is handed and the button lives in the
   * one case where the server has usually stored it already (http.ts aborts at
   * 20s; a multi-tool turn runs longer and commits anyway). So the transcript
   * is re-read first and `planRetry` decides: a sentence that is already there
   * is adopted, the failed mark clears, and nothing goes on the wire.
   *
   * `sending` is held across the read as well as the send, which parks the
   * five-second poll for the duration and disables the composer, so nothing
   * else can write to the log while this decision is being made.
   */
  const retryFailed = async (failed: ChatMessage) => {
    const clientId = failed.clientId;
    if (clientId === undefined) return;
    if (sending || sendingRef.current || (limitReached && !handover)) return;

    const sessionKey = readStoredSession();
    if (!sessionKey) {
      setPhase('error');
      return;
    }

    sendingRef.current = true;
    setSending(true);
    try {
      let history;
      try {
        history = await AssistantApi.history(sessionKey);
      } catch {
        // Reconciling is not optional: without a transcript to check against,
        // sending again is a coin-flip on duplicating the message. The bubble
        // stays failed and the button stays live, so the next tap — once the
        // connection is back — can do the job properly.
        setLog((previous) => failSend(previous, clientId, t('assistant.chat.networkFailed')));
        return;
      }

      // `endConversation` can land while that read is in flight, and it clears
      // the session key. Folding the transcript back into a conversation the
      // visitor has ended — let alone sending into it — is the same class of
      // bug the poll's abort signal exists to prevent (H-FIX-5).
      if (readStoredSession() !== sessionKey) return;

      setQuota({ limit: history.limit, remaining: history.remaining });
      setHandover(history.handledByHuman === true);
      // The poll's own filter, and for the same reason it lives outside the
      // updater there: `seenRef` must advance exactly once per row.
      const fresh = history.messages.filter((entry) => {
        const key = serverMessageKey(entry);
        if (seenRef.current.has(key)) return false;
        seenRef.current.add(key);
        return true;
      });

      const snapshot = logRef.current;
      const plan = planRetry(snapshot, failed, fresh, history.messages);
      // The plan is decided against the render the visitor tapped on, but
      // applied against whatever `log` holds when React runs the updater — a
      // poll that resolved during the read above may have appended to it. Both
      // paths run the same pure function over the same rows.
      setLog((previous) =>
        previous === snapshot ? plan.log : planRetry(previous, failed, fresh, history.messages).log,
      );
      if (!plan.resend) return;

      await deliver(clientId, failed.text, sessionKey);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  /**
   * Ask before ending, but only when there is something to end.
   *
   * Both buttons opened the dialog unconditionally, so opening the assistant
   * and closing it again — reading the greeting and deciding not to ask
   * anything, which is most of the times it is opened — put "Suhbatni
   * yakunlaysizmi?" in front of somebody who had not started one. The dialog
   * exists because closing sends a summary to the team and clears the
   * history; with no messages there is no summary and nothing to clear.
   */
  const requestClose = () => {
    if (log.some((message) => message.from === 'me')) {
      setShowCloseConfirm(true);
      return;
    }
    void endConversation();
  };

  const endConversation = async () => {
    setShowCloseConfirm(false);
    setOpen(false);

    const sessionKey = readStoredSession();
    // Only a conversation the visitor actually took part in is worth summarising.
    if (sessionKey && log.some((message) => message.from === 'me')) {
      try {
        await AssistantApi.close(
          sessionKey,
          currentUser?.name ?? undefined,
          currentUser?.phone ?? undefined,
        );
      } catch {
        /* the summary is best-effort; the visitor is already gone */
      }
    }

    writeStoredSession(null);
    setLog([]);
    setQuota(null);
    setHandover(false);
    seenRef.current = new Set();
    setPhase('idle');
  };

  const openListing = (listing: Listing) => {
    // No seeding into `store.listings` on the way out.
    //
    // That was written for a detail view that read the listing out of the
    // catalogue array; it loads by id from the API instead, and has for some
    // time. So the prepend bought nothing and cost something: it pushed a row
    // into the array without touching `totalCount`, which is the catalogue's
    // count of what the *query* matched — leaving the results footer claiming
    // "showing 1–25 of 24" and hiding the load-more button a page early. The
    // very next filter or page request replaced the array anyway.
    setCurrentView('LISTING_DETAIL', listing.id);
    setOpen(false);
  };

  const typingDots = (
    <>
      <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:150ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:300ms]" />
    </>
  );

  return (
    <div className={`pointer-events-auto fixed z-40 ml-auto max-w-full sm:bottom-6 sm:left-auto sm:right-6 sm:w-105 md:w-120 ${open ? "bottom-20 left-2 right-2" : "bottom-24 right-4"}`}>
      {showCloseConfirm && (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-xs"
          onClick={() => setShowCloseConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistant-close-title"
            className="w-full max-w-xs space-y-4 rounded-3xl border border-line bg-surface p-6 text-center shadow-raised"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-brand/30 bg-brand text-on-brand font-black text-sm tracking-wider">
              AI
            </div>
            <div>
              <h3 id="assistant-close-title" className="text-base font-black text-content">
                {t('assistant.closeDialog.title')}
              </h3>
              <p className="mt-1 text-xs font-medium leading-relaxed text-muted">
                {t('assistant.closeDialog.description')}
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <Button
                variant="secondary"
                fullWidth
                className="py-3 text-xs"
                onClick={() => setShowCloseConfirm(false)}
              >
                {t('assistant.closeDialog.cancel')}
              </Button>
              <Button
                fullWidth
                className="py-3 text-xs"
                onClick={() => {
                  void endConversation();
                }}
              >
                {t('assistant.closeDialog.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {open ? (
        <div
          role="dialog"
          aria-label={t('assistant.mascot.panelLabel')}
          className="flex h-[70vh] max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-brand/40 bg-surface text-content shadow-raised sm:h-145 sm:rounded-3xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-line p-4 sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-brand/30 bg-brand text-on-brand font-black text-xs tracking-wider">
                AI
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="flex items-center gap-1 text-base font-extrabold text-content">
                    {t('assistant.mascot.name')}
                    <Sparkles className="h-4 w-4 text-warning" aria-hidden="true" />
                  </h4>
                  {metered && quota && (
                    <span
                      title={t('assistant.chat.quotaLabel', {
                        remaining: quota.remaining,
                        limit: quota.limit,
                      })}
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-black ${
                        quota.remaining <= 2
                          ? 'border-danger/30 bg-danger-soft text-danger'
                          : 'border-brand/30 bg-brand-soft text-brand-text'
                      }`}
                    >
                      {t('assistant.chat.quota', {
                        remaining: quota.remaining,
                        limit: quota.limit,
                      })}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted">{t('assistant.mascot.tagline')}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={requestClose}
                aria-label={t('assistant.chat.reset')}
                title={t('assistant.chat.reset')}
                className="rounded-xl p-2 text-subtle transition-colors hover:bg-surface-2 hover:text-content"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={requestClose}
                aria-label={t('assistant.chat.close')}
                title={t('assistant.chat.close')}
                className="rounded-xl p-2 text-subtle transition-colors hover:bg-surface-2 hover:text-content"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Transcript */}
          <div
            role="log"
            aria-live="polite"
            aria-label={t('assistant.chat.log')}
            className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4 sm:p-5"
          >
            {phase === 'loading' && (
              <div className="flex justify-center py-8">
                <div className="flex gap-2" aria-hidden="true">
                  {typingDots}
                </div>
                <span className="sr-only">{t('assistant.chat.loadingHistory')}</span>
              </div>
            )}

            {phase === 'error' && (
              <div className="space-y-3 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-center">
                <p className="text-xs font-semibold text-danger">
                  {t('assistant.chat.startFailed')}
                </p>
                <Button
                  variant="secondary"
                  className="py-2.5 text-xs"
                  onClick={() => {
                    void startSession();
                  }}
                >
                  {t('common.action.retry')}
                </Button>
              </div>
            )}

            {log.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.from === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                {message.from !== 'me' && (
                  <div
                    className={`mr-2.5 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-black text-[10px] tracking-wider sm:h-8 sm:w-8 sm:text-xs ${
                      message.from === 'admin'
                        ? 'border border-info/30 bg-info text-white'
                        : 'border border-brand/30 bg-brand text-on-brand'
                    }`}
                  >
                    {message.from === 'admin' ? (
                      <Headset className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      'AI'
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 text-sm leading-relaxed wrap-break-word sm:p-4 sm:text-base ${
                    // A message that never left the browser must not look like
                    // one that arrived (H-FIX-4): subdued, and outlined in the
                    // danger colour so it reads as unsent at a glance.
                    message.status === 'failed' ? 'border border-danger/50 opacity-70 ' : ''
                  }${
                    message.from === 'me'
                      ? 'rounded-tr-sm bg-brand font-medium text-on-brand'
                      : message.from === 'admin'
                        ? 'rounded-tl-sm border border-info/40 bg-info-soft text-content'
                        : 'rounded-tl-sm border border-line bg-surface-2 text-content'
                  }`}
                >
                  <span className="sr-only">
                    {message.from === 'me'
                      ? t('assistant.chat.you')
                      : message.from === 'admin'
                        ? t('assistant.chat.operator')
                        : t('assistant.mascot.name')}
                  </span>
                  {/* Named in the open, not only to a screen reader. Whether
                      the answer came from a person or from the model is the
                      one thing about it the visitor is owed on sight. */}
                  {message.from === 'admin' && (
                    <p className="mb-1 text-[11px] font-bold text-info">
                      {t('assistant.chat.operator')}
                    </p>
                  )}
                  <div className="whitespace-pre-line wrap-break-word">{message.text}</div>

                  {/* The unsent marker and the way out of it, in the bubble
                      itself rather than in a separate notice — at 360px a
                      second row of chrome is a row of text the visitor loses.
                      `flex-wrap` so the label and the button stack rather than
                      squeeze on the narrowest phones. */}
                  {message.status === 'failed' && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold">
                      <span className="inline-flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {t('assistant.chat.notSent')}
                      </span>
                      <button
                        type="button"
                        onClick={() => void retryFailed(message)}
                        // The same guard the composer carries, and for the
                        // same reason (H-FIX-9): with only `sending` here, a
                        // visitor whose quota ran out mid-timeout could tap a
                        // live button that no longer had anywhere to send.
                        disabled={sending || (limitReached && !handover)}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-surface/25 px-2.5 py-1 font-bold underline underline-offset-2 disabled:opacity-50"
                      >
                        <RotateCcw className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {t('assistant.chat.retrySend')}
                      </button>
                    </div>
                  )}

                  {/* An action the assistant took is shown as a fact, not left
                      as a claim inside the prose. Only tools that changed
                      something appear here. */}
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {message.actions
                        .filter((action) => ACTION_LABELS[action])
                        .map((action) => (
                          <span
                            key={action}
                            className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-text"
                          >
                            <Check className="h-3 w-3" aria-hidden="true" />
                            {t(ACTION_LABELS[action])}
                          </span>
                        ))}
                    </div>
                  )}

                  {/* The reply is a yes/no question and the action is parked on
                      the server until it is answered. Typing "ha" works just as
                      well; these are a shortcut, not a separate channel. */}
                  {message.awaitingConfirmation && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-xs font-semibold text-muted">
                        {t('assistant.chat.confirmHint')}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => sendText(t('assistant.chat.confirmYes'))}
                          disabled={sending}
                          className="rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-on-brand disabled:opacity-50"
                        >
                          {t('assistant.chat.confirmYes')}
                        </button>
                        <button
                          type="button"
                          onClick={() => sendText(t('assistant.chat.confirmNo'))}
                          disabled={sending}
                          className="rounded-full border border-line px-4 py-1.5 text-xs font-bold text-content disabled:opacity-50"
                        >
                          {t('assistant.chat.confirmNo')}
                        </button>
                      </div>
                    </div>
                  )}

                  {message.listings && message.listings.length > 0 && (
                    <div className="mt-3 space-y-3">
                      <p className="text-xs font-bold text-muted">
                        {t('assistant.chat.resultsTitle')}
                      </p>
                      {message.listings.map((listing) => (
                        <ListingCard key={listing.id} listing={listing} onOpen={openListing} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand/30 bg-brand text-on-brand font-black text-[9px] tracking-wider">
                  AI
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-line bg-surface-2 p-3">
                  <span aria-hidden="true" className="flex gap-1.5">
                    {typingDots}
                  </span>
                  <span className="sr-only">{t('assistant.chat.thinking')}</span>
                </div>
              </div>
            )}

            {log.length > 1 && !sending && (
              <button
                type="button"
                onClick={() => {
                  setCurrentView('LISTINGS');
                  setOpen(false);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-2.5 text-xs font-medium text-brand-text transition-colors hover:bg-brand-soft-2"
              >
                {t('assistant.chat.viewAllResults')}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}

            <div ref={logEndRef} />
          </div>

          {/* Composer */}
          {limitReached && (
            <p className="shrink-0 border-t border-line bg-warning-soft px-4 py-2 text-[11px] font-semibold text-warning">
              {t('assistant.chat.limitReached')}
            </p>
          )}
          {/* `!handover` for the same reason `limitReached` stands down
              during one (H-FIX-2): the server keeps reporting the exhausted
              numbers it has deliberately stopped enforcing, so without this
              the visitor reads "0 requests left today" directly above a
              working composer and a banner saying a colleague has joined. */}
          {!limitReached && !handover && metered && quota && quota.remaining <= 2 && (
            <p className="shrink-0 border-t border-line bg-warning-soft px-4 py-2 text-[11px] font-semibold text-warning">
              {t('assistant.chat.quotaWarning', { count: quota.remaining })}
            </p>
          )}

          {/* The composer below stays enabled on purpose — the visitor is
              now talking to a person and has to be able to answer them; that
              is also why the quota banner above stands down while this one is
              up (H-FIX-2). The line wraps rather than truncates: on a 360px
              screen it is two lines, and a half-read sentence about who is
              answering is worse than a taller banner. */}
          {handover && (
            <p
              role="status"
              className="shrink-0 border-t border-line bg-info-soft px-4 py-2 text-[11px] font-semibold leading-snug text-info"
            >
              {t('assistant.chat.handover')}
            </p>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void sendText();
            }}
            className="flex shrink-0 items-center gap-2 border-t border-line p-3"
          >
            {/* A plain input rather than <TextInput>: this one needs a ref for
                focus-on-open, and the shared control does not forward one. */}
            <input
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={limitReached || sending || phase !== 'ready'}
              aria-label={t('assistant.chat.inputLabel')}
              placeholder={
                limitReached
                  ? t('assistant.chat.inputDisabled')
                  : sending
                    ? t('assistant.chat.inputThinking')
                    : t('assistant.chat.inputPlaceholder')
              }
              // 16px is not a density choice here. At the 12px this box used
              // to be, iOS Safari zooms to about 133% the moment the composer
              // takes focus and does not zoom back — so asking the assistant
              // one question left the whole app scaled up and scrolling
              // sideways. Field.tsx spells the rule out for the shared input.
              className="min-w-0 flex-1 rounded-2xl border border-line bg-surface-2 px-3.5 py-2.5 text-base font-medium text-content transition-colors placeholder:text-subtle focus:border-brand focus:bg-surface focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <Button
              type="submit"
              disabled={limitReached || sending || phase !== 'ready' || !text.trim()}
              aria-label={t('assistant.chat.send')}
              className="shrink-0 px-3.5 py-3"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('assistant.mascot.open')}
          className="group ml-auto flex items-center gap-3 rounded-full border border-brand/40 bg-surface p-2 text-content shadow-raised transition-all duration-300 hover:border-brand active:scale-95 sm:px-4 sm:py-2.5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-brand/30 bg-brand text-on-brand font-black text-xs tracking-wider transition-transform group-hover:scale-110 sm:h-8 sm:w-8">
            AI
          </span>
          <span className="hidden items-center gap-1.5 text-xs font-black text-content sm:flex">
            <span>AI</span>
            <Sparkles className="h-3.5 w-3.5 text-brand-text" aria-hidden="true" />
          </span>
          <span className="ml-1 hidden h-7 w-7 items-center justify-center rounded-full bg-brand text-on-brand sm:flex">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </button>
      )}
    </div>
  );
};

export default AiMascot;
