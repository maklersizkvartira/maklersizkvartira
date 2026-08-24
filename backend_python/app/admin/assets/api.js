/**
 * Admin API client.
 *
 * Tokens are short-lived (30 min access, 1 day refresh) and rotate on every
 * refresh. A rejected refresh drops straight back to the login screen rather
 * than leaving the panel half-authenticated.
 */

import { state as i18nState } from './i18n.js';

const API_BASE = '/api/v1';
const ACCESS_KEY = 'maklersiz.admin.access';
const REFRESH_KEY = 'maklersiz.admin.refresh';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

export const tokens = {
  get access() {
    try {
      return localStorage.getItem(ACCESS_KEY);
    } catch (error) {
      return null;
    }
  },
  get refresh() {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch (error) {
      return null;
    }
  },
  save(access, refresh) {
    try {
      localStorage.setItem(ACCESS_KEY, access);
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    } catch (error) {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch (error) {
      /* ignore */
    }
  },
};

let onUnauthorized = null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

let refreshInFlight = null;

async function refreshTokens() {
  const refreshToken = tokens.refresh;
  if (!refreshToken) return null;
  try {
    const response = await fetch(`${API_BASE}/admin/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      tokens.clear();
      return null;
    }
    const data = await response.json();
    tokens.save(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch (error) {
    return null;
  }
}

function buildQuery(params) {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.append(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function request(path, options = {}) {
  const { method = 'GET', body, params, anonymous = false } = options;

  const send = async (token) => {
    const headers = { Accept: 'application/json', 'X-Language': i18nState.language };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (!anonymous && token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_BASE}${path}${buildQuery(params)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let response;
  try {
    response = await send(tokens.access);
    if (response.status === 401 && !anonymous && tokens.refresh) {
      if (!refreshInFlight) {
        refreshInFlight = refreshTokens().finally(() => {
          refreshInFlight = null;
        });
      }
      const fresh = await refreshInFlight;
      if (fresh) {
        response = await send(fresh);
      } else {
        tokens.clear();
        onUnauthorized?.();
        throw new ApiError(401, 'unauthorized', 'Session expired');
      }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'network', 'Network request failed');
  }

  if (response.status === 204) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    /* empty body */
  }

  if (!response.ok) {
    if (response.status === 401 && !anonymous) {
      tokens.clear();
      onUnauthorized?.();
    }
    throw new ApiError(
      response.status,
      payload?.code || 'error',
      payload?.message || '',
    );
  }
  return payload;
}

export const Api = {
  login: (username, password) =>
    request('/admin/auth/login', {
      method: 'POST',
      body: { username, password },
      anonymous: true,
    }),
  me: () => request('/admin/auth/me'),
  logout: () => request('/admin/auth/logout', { method: 'POST' }),

  stats: () => request('/admin/stats'),
  chartRegistrations: (days = 7) => request('/admin/chart/registrations', { params: { days } }),
  chartTraffic: (days = 7) => request('/admin/chart/traffic', { params: { days } }),
  chartDistricts: (limit = 10) => request('/admin/chart/districts', { params: { limit } }),
  chartActivity: (days = 7) => request('/admin/chart/activity', { params: { days } }),

  users: (params) => request('/admin/users', { params }),
  user: (id) => request(`/admin/users/${id}`),
  updateUser: (id, changes) => request(`/admin/users/${id}`, { method: 'PATCH', body: changes }),
  revealPassword: (id) => request(`/admin/users/${id}/reveal-password`, { method: 'POST' }),
  setUserPassword: (id, body) =>
    request(`/admin/users/${id}/set-password`, { method: 'POST', body }),
  revokeSessions: (id) => request(`/admin/users/${id}/revoke-sessions`, { method: 'POST' }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),

  listings: (params) => request('/admin/listings', { params }),
  moderateListing: (id, body) =>
    request(`/admin/listings/${id}/status`, { method: 'PATCH', body }),
  featureListing: (id, body) =>
    request(`/admin/listings/${id}/feature`, { method: 'PATCH', body }),
  deleteListing: (id) => request(`/admin/listings/${id}`, { method: 'DELETE' }),

  audit: (params) => request('/admin/audit', { params }),
  auditActions: () => request('/admin/audit/actions'),

  reports: (params) => request('/admin/reports', { params }),
  resolveReport: (id, body) => request(`/admin/reports/${id}`, { method: 'PATCH', body }),

  verifications: (params) => request('/admin/verifications', { params }),
  reviewVerification: (id, body) =>
    request(`/admin/verifications/${id}`, { method: 'PATCH', body }),

  aiSessions: (params) => request('/admin/ai/sessions', { params }),
  aiMessages: (id) => request(`/admin/ai/sessions/${id}/messages`),

  sms: (params) => request('/admin/sms', { params }),
  loginAttempts: (params) => request('/admin/security/login-attempts', { params }),

  staff: () => request('/admin/staff'),
  createStaff: (body) => request('/admin/staff', { method: 'POST', body }),
  toggleStaff: (id, isActive) =>
    request(`/admin/staff/${id}/active`, { method: 'PATCH', params: { is_active: isActive } }),
};
