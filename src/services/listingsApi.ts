/**
 * Listings API.
 *
 * Every call returns real data or throws. The previous client silently
 * substituted mock listings whenever the backend failed, which made outages
 * and contract breaks invisible in the UI.
 */

import { http } from './http';
import type { Listing, TopRequestStatus } from '../types';

export interface ListingQuery {
  search?: string;
  region?: string;
  district?: string;
  metroStation?: string;
  universityName?: string;
  rooms?: number;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  propertyType?: string;
  /**
   * Renting or buying. Omitting it asks for rentals — the server defaults to
   * RENT, deliberately, so that every prerendered page and every cached bundle
   * written before selling existed keeps returning what it was written for.
   * 'ALL' is the only way to get both, and almost nothing wants both.
   */
  dealType?: 'RENT' | 'SALE' | 'ALL';
  rentalType?: 'ALL' | 'FULL' | 'ROOMMATE';
  /** Matches rooms marked for this gender plus the ones open to anyone. */
  roommateGender?: 'GIRLS' | 'BOYS' | 'ANY';
  audience?: 'ALL' | 'STUDENT' | 'FAMILY';
  /** Omitted means "either"; the server has no 'ALL' value for this one. */
  sellerType?: 'OWNER' | 'AGENT';
  onlyVerified?: boolean;
  minTrustScore?: number;
  furnished?: boolean;
  parking?: boolean;
  internet?: boolean;
  airConditioning?: boolean;
  washingMachine?: boolean;
  petsAllowed?: boolean;
  /**
   * The seventh amenity, and the one this interface did not carry for as long
   * as the chip existed. The store turns every selected chip straight into a
   * field of the same name and spreads it onto the query object, and a spread
   * is exempt from the excess-property check — so a key nothing here declares
   * still travelled, and for months it was a chip that lit up, incremented the
   * badge, drew a removable pill above the map and changed nothing, because
   * the server's filter model had six amenities and the map offered seven.
   * This interface is the only written record of what the API accepts, so an
   * amenity missing from it is a filter nobody can see is missing.
   */
  utilitiesIncluded?: boolean;
  sortBy?: 'RECOMMENDED' | 'NEWEST' | 'PRICE_LOW' | 'PRICE_HIGH' | 'TRUST' | 'POPULAR';
  page?: number;
  pageSize?: number;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ListingPage {
  data: Listing[];
  totalCount: number;
  meta: PageMeta;
}

/**
 * @deprecated Nothing decides this any more.
 *
 * A listing publishes the moment it is created, so `POST /listings` answers
 * with a constant allow for one more release — long enough for a cached
 * bundle that still reads the field not to crash on its absence. No caller
 * branches on it.
 */
export interface ModerationResult {
  allowed: boolean;
  status: string;
  trustScore: number;
  riskScore: number;
  reasons: string[];
  provider: string;
}

/** Durations the owner may ask Top for. An admin can grant a different one. */
export const TOP_DAYS_OPTIONS = [7, 14, 30] as const;
export const DEFAULT_TOP_DAYS = 7;
/** Enough for a sentence of context for the moderator, not an essay. */
export const MAX_TOP_NOTE_LENGTH = 200;

/** The owner's request to have one listing promoted, as the API returns it. */
export interface TopRequest {
  id: string;
  listingId: string;
  status: TopRequestStatus;
  requestedDays: number;
  note: string | null;
  rejectionReason: string | null;
  grantedUntil: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/**
 * Fields whose value `'ALL'` is the client's sentinel for "this filter is off".
 *
 * Named rather than inferred, because the same four characters mean three
 * different things on this object and only a key can tell them apart.
 *
 * `dealType` is absent because 'ALL' there is a real request: the server's
 * `deal_type` accepts `"ALL"` and skips the WHERE for it, but its *default* is
 * RENT — so a caller asking for both once got the key deleted here and rentals
 * back, with nothing anywhere saying the question had been changed. The map
 * arrives through this path.
 *
 * `search` is absent for the opposite reason: its content is the visitor's own
 * words, and a visitor's word must never be read as one of ours. Typing `ALL`
 * into the map's search box deleted the parameter while the chip row and the
 * filter badge went on claiming the search was applied.
 *
 * `propertyType`, `roommateGender` and `sellerType` are the load-bearing
 * entries: their server enums have no 'ALL' member at all, so a caller passing
 * it would get a 422 and an empty screen rather than a silently wide one. The
 * other four are plain strings server-side and are safe here only because
 * every control that writes them is a dropdown whose neutral option is
 * literally 'ALL'. The day one of them becomes a text box it comes out of this
 * set, the same way `search` did.
 */
const SENTINEL_KEYS = new Set([
  'region',
  'district',
  'metroStation',
  'universityName',
  'propertyType',
  'rentalType',
  'roommateGender',
  'audience',
  'sellerType',
]);

/** Drops empty values and off-sentinels so the query carries only real filters. */
function toQuery(query: ListingQuery): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (value === 'ALL' && SENTINEL_KEYS.has(key)) continue;
    output[key] = value as string | number | boolean;
  }
  return output;
}

export const ListingsApi = {
  /**
   * `signal` is what lets the catalogue cancel a query the visitor has already
   * moved on from — without it, a superseded filter tap holds a connection
   * open for a result that will be thrown away.
   */
  list: (query: ListingQuery = {}, signal?: AbortSignal) =>
    http.get<ListingPage>('/listings', { query: toQuery(query), signal }),

  featured: (limit = 8) =>
    http.get<{ data: Listing[] }>('/listings/featured', { query: { limit } }),

  byId: async (id: string): Promise<Listing> => {
    const response = await http.get<{ data: Listing }>(`/listings/${encodeURIComponent(id)}`);
    return response.data;
  },

  mine: async (): Promise<Listing[]> => {
    const response = await http.get<{ data: Listing[] }>('/listings/my');
    return response.data;
  },

  favorites: async (): Promise<Listing[]> => {
    const response = await http.get<{ data: Listing[] }>('/listings/favorites');
    return response.data;
  },

  /**
   * A 201 here means the listing is live. The `moderation` key is the
   * deprecated constant described on `ModerationResult` and is not read.
   */
  create: (payload: Record<string, unknown>) =>
    http.post<{ data: Listing; moderation: ModerationResult }>('/listings', payload),

  update: async (id: string, changes: Record<string, unknown>): Promise<Listing> => {
    const response = await http.put<{ data: Listing }>(
      `/listings/${encodeURIComponent(id)}`,
      changes,
    );
    return response.data;
  },

  remove: (id: string) => http.delete<{ message: string }>(`/listings/${encodeURIComponent(id)}`),

  /** Records a view, a favourite toggle, or a revealed contact. */
  recordStat: async (
    id: string,
    stat: 'views' | 'favorites' | 'contacts',
    delta: 1 | -1 = 1,
  ): Promise<Listing> => {
    const response = await http.post<{ data: Listing }>(
      `/listings/${encodeURIComponent(id)}/stats`,
      { stat, delta },
    );
    return response.data;
  },

  report: (
    id: string,
    reason: string,
    description = '',
  ) =>
    http.post<{ message: string }>(`/listings/${encodeURIComponent(id)}/report`, {
      reason,
      description,
    }),

  /**
   * Ask for this listing to be promoted to the top of the results.
   *
   * The request is free and it is not a purchase: it lands in the admin
   * queue, and the listing only moves once a moderator approves it. A second
   * request while one is still pending comes back as 409 `top_request_pending`.
   */
  requestTop: async (
    id: string,
    input: { days: number; note?: string | null },
  ): Promise<TopRequest> => {
    const response = await http.post<{ data: TopRequest }>(
      `/listings/${encodeURIComponent(id)}/top`,
      { days: input.days, note: input.note?.trim() || null },
    );
    return response.data;
  },
};

export const MetaApi = {
  languages: () =>
    http.get<{ data: Array<{ code: string; labelNative: string; labelEn: string }> }>(
      '/meta/languages',
      { anonymous: true },
    ),

  /** Server-owned exchange rate; the old build hardcoded 12800 in three files. */
  fxRate: async (): Promise<number> => {
    const response = await http.get<{ data: { rate: number } }>('/meta/fx-rate', {
      anonymous: true,
    });
    return response.data.rate;
  },

  track: (sessionId: string, pagePath: string, referrer?: string) =>
    http
      .post('/traffic/track', { sessionId, pagePath, referrer }, { anonymous: true })
      .catch(() => {
        /* analytics must never break the page */
      }),
};

export const AssistantApi = {
  createSession: () =>
    http.post<{ sessionKey: string; limit: number; remaining: number }>(
      '/smart/assistant/session',
    ),

  /**
   * One turn of the conversation.
   *
   * There is deliberately no client message id in this payload, and adding one
   * is not a small change: `AssistantRequest` is a `CamelModel`, which is
   * `extra="forbid"`, so an unrecognised field 422s the whole send rather than
   * being ignored. The widget's idempotency key therefore stays in the browser
   * and the duplicate a retry would otherwise cause is settled against
   * `history` instead — see `planRetry` in AiMascot.tsx. Real server-side
   * idempotency needs the route and the schema to accept the key first.
   */
  send: (sessionKey: string, message: string, userName?: string) =>
    http.post<{
      status: string;
      reply: string;
      listings: Listing[];
      need: Record<string, unknown>;
      /**
       * How far the search had to loosen to find these rows:
       * EXACT / PARTIAL / NEARBY / ANY, or NONE for a conversational turn.
       * The reply text already explains it; this is here for the UI to badge
       * a widened result without re-parsing prose.
       */
      matchQuality?: 'NONE' | 'EXACT' | 'PARTIAL' | 'NEARBY' | 'ANY' | 'AGENT';
      /**
       * Tools the assistant actually ran this turn, in order. Only the ones
       * that changed something are listed — a search is not an action.
       * The chat badges these so a save is visible as a save, rather than
       * being a claim buried in the prose.
       */
      actions?: string[];
      /**
       * Which tools ran, in order, with a translated label each. The reply is
       * not streamed, so these arrive after the work is finished — they are a
       * record for the admin view and for debugging a surprising answer, not
       * a live progress bar. Rendering them as one would claim the chat is
       * doing something it has already done.
       */
      steps?: Array<{ tool: string; label: string }>;
      /**
       * The reply is a yes/no question about something irreversible, and the
       * action is held server-side until the next message answers it.
       */
      awaitingConfirmation?: boolean;
      /**
       * An operator has taken this conversation over from the admin desk, so
       * the model is no longer answering it. `reply` is `''` on such a turn:
       * the server stored the visitor's message and stopped there, and the
       * operator's own answer arrives through the history poll instead.
       * Appending a bubble for the empty reply would put a blank box on
       * screen every time the visitor writes to a person.
       *
       * There is deliberately no `operatorName` beside it. The server stopped
       * sending one: a staff member's legal name has no business reaching an
       * anonymous visitor, and the banner names the team instead.
       */
      handledByHuman?: boolean;
      sessionKey: string;
      used: number;
      limit: number;
      remaining: number;
    }>('/smart/assistant', { sessionKey, message, userName }),

  // `signal` is here for the chat widget's background poll: the widget
  // re-reads the transcript every few seconds while the panel is open, and a
  // request left in flight after the panel closes resolves into a component
  // that is no longer listening.
  //
  // The widget also calls this on demand, without a signal, before it retries
  // a failed message: `send` is not idempotent server-side, and http.ts aborts
  // at 20s while a multi-tool turn regularly commits and keeps going, so a
  // retry that has not checked the transcript first is a duplicated message
  // in the normal case rather than the exotic one.
  history: (sessionKey: string, options?: { signal?: AbortSignal }) =>
    http.get<{
      messages: Array<{
        /**
         * The transcript row's own id, and the only safe way to tell an
         * already-rendered message from a new one (H-FIX-1).
         *
         * The widget used to count: it advanced a cursor by the number of
         * rows a turn had written and then used that number as an absolute
         * index into this array. An operator writing between two five-second
         * polls breaks that by construction — their message was skipped
         * forever and the visitor's own message was rendered a second time.
         * Identity does not slide the way a count does.
         */
        id: string;
        /** `admin` appears once an operator has taken the conversation over. */
        role: string;
        content: string;
        createdAt: string;
      }>;
      /**
       * An operator is holding this thread right now.
       *
       * It is on the *history* response and not only on `send` because the
       * banner has to appear while the visitor is reading, not only after
       * they happen to type something (H-FIX-3). No operator name comes with
       * it, on purpose — see `send` above.
       */
      handledByHuman?: boolean;
      limit: number;
      remaining: number;
    }>('/smart/assistant/history', {
      query: { session_key: sessionKey },
      signal: options?.signal,
    }),

  close: (sessionKey: string, userName?: string, userPhone?: string) =>
    http.post<{ status: string }>('/smart/assistant/close', {
      sessionKey,
      userName,
      userPhone,
    }),
};
