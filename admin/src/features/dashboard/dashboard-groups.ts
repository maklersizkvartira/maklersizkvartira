import type { AdminStats } from '@/shared/api/types';

/**
 * The single source of truth for how the 26 dashboard counters are grouped,
 * which of them are worth an alarm colour, and which of them are meaningless
 * without a denominator.
 *
 * It lives in one file because the numbers appear in more than one place: the
 * triage hero shows three of the queue counts, the flow card shows six listing
 * counts, and the reference band at the bottom shows all 26. That duplication
 * is deliberate — the band is the complete index you look a number up in, the
 * cards above are views onto the numbers that need an action today — and this
 * comment exists so the next reader does not "fix" it by deleting one of them.
 *
 * `tenants` is excluded here exactly as it is excluded from the KPI labels:
 * the backend fills it with the same `role == STUDENT` query as `students`, so
 * printing both shows one number twice under two names.
 */

/** Every AdminStats field the panel is willing to render. */
export type StatKey = Exclude<keyof AdminStats, 'tenants'>;

/** The tone vocabulary the `.tone-*` classes in globals.css implement. */
export type ToneName = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

export interface StatItem {
  key: StatKey;
  /**
   * A failure count is close to meaningless on its own: "12 SMS failed" is a
   * catastrophe out of 14 and a rounding error out of 4000. Rows that carry a
   * denominator print `value / total` instead of a bare integer.
   */
  outOf?: StatKey;
}

export type GroupKey = 'people' | 'listings' | 'ai' | 'ops';

export interface StatGroup {
  key: GroupKey;
  items: readonly StatItem[];
}

/**
 * 8 + 7 + 4 + 7 = 26. The order inside a group is the order a moderator would
 * read it: the whole first, then its parts, then today's slice.
 */
export const GROUPS = [
  {
    key: 'people',
    items: [
      { key: 'totalUsers' },
      { key: 'activeUsers', outOf: 'totalUsers' },
      { key: 'owners' },
      { key: 'students' },
      { key: 'pendingUsers', outOf: 'totalUsers' },
      { key: 'suspendedUsers', outOf: 'totalUsers' },
      { key: 'todayNewUsers' },
      { key: 'weekNewUsers' },
    ],
  },
  {
    key: 'listings',
    items: [
      { key: 'totalListings' },
      { key: 'approvedListings', outOf: 'totalListings' },
      { key: 'pendingListings', outOf: 'totalListings' },
      { key: 'rejectedListings', outOf: 'totalListings' },
      { key: 'featuredListings', outOf: 'totalListings' },
      { key: 'todayNewListings' },
      { key: 'totalViews' },
    ],
  },
  {
    key: 'ai',
    items: [
      { key: 'aiSessions' },
      { key: 'guests', outOf: 'aiSessions' },
      { key: 'aiQueries' },
      { key: 'todayAiQueries' },
    ],
  },
  {
    key: 'ops',
    items: [
      { key: 'openReports' },
      { key: 'pendingVerifications' },
      { key: 'pendingTopRequests' },
      { key: 'visitorsToday' },
      { key: 'failedLoginsToday' },
      { key: 'smsToday' },
      { key: 'smsFailedToday', outOf: 'smsToday' },
    ],
  },
] as const satisfies readonly StatGroup[];

/* ─── Completeness, checked by the compiler ────────────────────────────────
   Both directions, so neither a 27th field the backend adds nor a field it
   removes can slip past silently. If this line ever goes red, the fix is to
   place the new key in a group above — not to widen the type. */
type ListedKey = (typeof GROUPS)[number]['items'][number]['key'];
type MissingKey = Exclude<StatKey, ListedKey>;
type ExtraKey = Exclude<ListedKey, StatKey>;

export const STAT_GROUPS_ARE_COMPLETE: [MissingKey, ExtraKey] extends [never, never]
  ? true
  : false = true;

/**
 * The same table with its literal types widened.
 *
 * `as const` is what makes the completeness assertion above possible, but it
 * also gives every entry that has no `outOf` a different shape from the ones
 * that do, so `item.outOf` is not readable off the union. Components render
 * from this; only the type check reads `GROUPS` directly.
 */
export const STAT_GROUPS: readonly StatGroup[] = GROUPS;

/** Total number of counters the band renders. Printed beside its heading. */
export const STAT_COUNT = GROUPS.reduce((sum, group) => sum + group.items.length, 0);

/* ─── Attention thresholds ─────────────────────────────────────────────────
   These are UI HEURISTICS CHOSEN HERE, not backend truth. The API has no
   notion of "too many pending listings"; nothing downstream reads them; a
   product owner who disagrees should edit the numbers in this object and
   nothing else.

   Two steps rather than one, and no warn-at-1 on the queues that are never
   empty on a healthy platform: a panel that shows amber every single morning
   teaches a moderator to stop seeing amber, which is worse than showing
   nothing. `openReports` is the one exception — an unactioned abuse report is
   work by definition, so it warns at the first one, and only turns red once a
   handful have piled up. */
export interface Threshold {
  warn: number;
  danger: number;
}

export const ATTENTION_THRESHOLDS = {
  openReports: { warn: 1, danger: 5 },
  pendingListings: { warn: 5, danger: 20 },
  pendingVerifications: { warn: 5, danger: 20 },
  // Same shape as the other two review queues: an owner waiting on a Top
  // decision is waiting on a person, and a handful of them is a normal day.
  pendingTopRequests: { warn: 5, danger: 20 },
  smsFailedToday: { warn: 3, danger: 10 },
  failedLoginsToday: { warn: 5, danger: 20 },
  suspendedUsers: { warn: 1, danger: 25 },
  rejectedListings: { warn: 1, danger: 50 },
  pendingUsers: { warn: 10, danger: 50 },
} as const satisfies Partial<Record<StatKey, Threshold>>;

export type AttentionKey = keyof typeof ATTENTION_THRESHOLDS;

/** Is this counter one the panel is willing to colour at all? */
export function hasThreshold(key: StatKey): key is AttentionKey {
  return key in ATTENTION_THRESHOLDS;
}

/**
 * The one global rule, in one function: zero never shouts.
 *
 * A clear board renders neutral everywhere — grey bars, muted numerals, no
 * rail, no bloom — because "nothing to do" is the correct morning answer and
 * a row of red zeroes hides it.
 */
export function attentionTone(key: StatKey, value: number): ToneName {
  if (value <= 0 || !hasThreshold(key)) return 'neutral';
  const { warn, danger } = ATTENTION_THRESHOLDS[key];
  if (value >= danger) return 'danger';
  if (value >= warn) return 'warning';
  return 'neutral';
}

/**
 * `attentionTone`, but a non-zero count that sits below its warn threshold
 * reads as ordinary work rather than as nothing at all: the brand accent, not
 * grey. The distinction the queue rows need is three-way — nothing here /
 * normal volume / too much — and neutral cannot carry the middle one.
 */
export function workTone(key: StatKey, value: number): ToneName {
  if (value <= 0) return 'neutral';
  const tone = attentionTone(key, value);
  return tone === 'neutral' ? 'accent' : tone;
}

/** Worst of a set of tones, for a card that summarises several counters. */
export function worstTone(tones: readonly ToneName[]): ToneName {
  if (tones.includes('danger')) return 'danger';
  if (tones.includes('warning')) return 'warning';
  if (tones.includes('accent')) return 'accent';
  return 'neutral';
}
