/**
 * Listings API.
 *
 * Every call returns real data or throws. The previous client silently
 * substituted mock listings whenever the backend failed, which made outages
 * and contract breaks invisible in the UI.
 */

import { http } from './http';
import type { Listing } from '../types';

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

export interface ModerationResult {
  allowed: boolean;
  status: string;
  trustScore: number;
  riskScore: number;
  reasons: string[];
  provider: string;
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
  list: (query: ListingQuery = {}) =>
    http.get<ListingPage>('/listings', { query: toQuery(query) }),

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

  /** Preview moderation before publishing, so the owner can fix the text. */
  scan: async (input: {
    title: string;
    description: string;
    price?: number;
    rooms?: number;
  }): Promise<ModerationResult> => {
    const response = await http.post<{ aiAnalysis: ModerationResult }>('/listings/scan', input);
    return response.aiAnalysis;
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
