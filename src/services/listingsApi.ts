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
  rentalType?: 'ALL' | 'FULL' | 'ROOMMATE';
  /** Matches rooms marked for this gender plus the ones open to anyone. */
  roommateGender?: 'GIRLS' | 'BOYS' | 'ANY';
  audience?: 'ALL' | 'STUDENT' | 'FAMILY';
  onlyVerified?: boolean;
  minTrustScore?: number;
  furnished?: boolean;
  parking?: boolean;
  internet?: boolean;
  airConditioning?: boolean;
  washingMachine?: boolean;
  petsAllowed?: boolean;
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

/** Drops empty values so the query string carries only real filters. */
function toQuery(query: ListingQuery): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === 'ALL') continue;
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
      sessionKey: string;
      used: number;
      limit: number;
      remaining: number;
    }>('/smart/assistant', { sessionKey, message, userName }),

  history: (sessionKey: string) =>
    http.get<{
      messages: Array<{ role: string; content: string; createdAt: string }>;
      limit: number;
      remaining: number;
    }>('/smart/assistant/history', { query: { session_key: sessionKey } }),

  close: (sessionKey: string) =>
    http.post<{ status: string }>('/smart/assistant/close', { sessionKey }),
};
