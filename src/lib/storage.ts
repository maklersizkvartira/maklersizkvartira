/**
 * Browser storage, with the brand rename's key migration built in.
 *
 * Every key this app owns moved from the `maklersiz.` prefix to `uyiz.` when
 * the brand changed. A bare rename would have been a mass sign-out — the
 * refresh token lives only in localStorage and there is no server-side session
 * to fall back on — plus a reset theme and a reset language for every
 * returning visitor. So a read that misses the new key falls back to the old
 * one, writes the value forward and deletes the old copy. The migration
 * happens on the first read, per browser, and nobody is signed out by it.
 *
 * The old key is removed only *after* the value has been written forward, so a
 * write that throws (quota, a browser blocking site data) leaves the original
 * where it is rather than destroying it on the way past.
 *
 * Every call is wrapped: `localStorage` is not merely empty in Safari's
 * private mode or with site data blocked, it throws on access, and a throw
 * here would take down whichever module asked — the HTTP layer, the theme
 * bootstrap, the language resolver — all of which run before the first paint.
 */

type StorageKind = 'local' | 'session';

function backing(kind: StorageKind): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

interface BrandStorage {
  /**
   * Reads `key`. If nothing is stored under it but `legacyKey` holds a value,
   * the value is moved to `key` and returned.
   */
  read(key: string, legacyKey?: string): string | null;
  write(key: string, value: string): void;
  /** Removes `key`, and `legacyKey` with it so the migration cannot re-run. */
  remove(key: string, legacyKey?: string): void;
}

function makeStorage(kind: StorageKind): BrandStorage {
  return {
    read(key, legacyKey) {
      const store = backing(kind);
      if (!store) return null;
      try {
        const current = store.getItem(key);
        if (current !== null) return current;

        if (!legacyKey) return null;
        const legacy = store.getItem(legacyKey);
        if (legacy === null) return null;

        store.setItem(key, legacy);
        store.removeItem(legacyKey);
        return legacy;
      } catch {
        return null;
      }
    },

    write(key, value) {
      const store = backing(kind);
      if (!store) return;
      try {
        store.setItem(key, value);
      } catch {
        /* storage unavailable or full — the value lives for this page view */
      }
    },

    remove(key, legacyKey) {
      const store = backing(kind);
      if (!store) return;
      try {
        store.removeItem(key);
        if (legacyKey) store.removeItem(legacyKey);
      } catch {
        /* ignore */
      }
    },
  };
}

export const localStore = makeStorage('local');
export const sessionStore = makeStorage('session');
