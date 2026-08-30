/**
 * Type-safe environment variables for the Uyiz admin panel.
 *
 * There is exactly one: the REST base URL. The Uyiz backend exposes no
 * WebSocket surface, so there is deliberately no WS_URL here — if you find
 * yourself adding one, check that the backend really grew a socket first.
 */

export const env = {
  // The /api/v1 suffix is part of the base URL, not of every call site.
  //
  // The fallback still names the old brand because the Railway service itself
  // was NOT renamed with the Uyiz rebrand: that hostname is the live API and
  // renaming the service would break every deployed client at once. It is an
  // infrastructure identifier, not a brand surface.
  API_URL:
    process.env.NEXT_PUBLIC_API_URL ??
    'https://maklersizkvartira-production.up.railway.app/api/v1',
} as const;
