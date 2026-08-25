/**
 * Which backend this panel talks to.
 *
 * Loaded before the app, as a plain script, because the panel has no build
 * step — there is no bundler here to inline an environment variable, so the
 * choice has to be made at run time from what the browser can see.
 *
 * Two deployments, one file:
 *
 *  * Served by the backend at /admin — same origin, so a relative path is
 *    correct and nothing has to be kept in sync.
 *  * Served from its own domain (Vercel) — the backend is elsewhere and has
 *    to be named. That domain must also appear in the backend's
 *    CORS_ORIGINS, or the browser will refuse every request before it is
 *    sent.
 */
(function () {
  var host = window.location.hostname;

  var LOCAL = host === 'localhost' || host === '127.0.0.1' || host === '';
  // The backend serves the panel from its own domain, so a page already on
  // that host needs nothing absolute.
  var SAME_HOST_AS_API = /\.up\.railway\.app$/.test(host);

  window.MAKLERSIZ_ADMIN_API =
    LOCAL || SAME_HOST_AS_API
      ? '/api/v1'
      : 'https://maklersizkvartira-production.up.railway.app/api/v1';
})();
