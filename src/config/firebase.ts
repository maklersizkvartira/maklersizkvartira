/**
 * Firebase — used for one thing only: obtaining a Google ID token.
 *
 * The token is sent to `POST /auth/google`, where the backend verifies its
 * signature against Google's published certificates before trusting a single
 * claim in it. The previous implementation posted the email address straight
 * from the client and the server believed it, which meant anyone could sign
 * in as anyone by typing their address into a request.
 *
 * The SDK is loaded on demand rather than imported at the top of the file. A
 * static import put ~94KB of Firebase (28KB gzipped) on the critical path of
 * every first paint — for a button that most visitors never press, on a page
 * most of them never open. `AuthPage` is a lazy route now as well, which is
 * belt and braces: `preloadGoogleAuth()` starts the fetch as the page mounts,
 * so the download still overlaps with the visitor reading the form.
 * Everything below that a caller needs synchronously (is it configured, was
 * the popup dismissed) stays synchronous.
 *
 * The config values are publishable by design; Firebase config is not a secret.
 */

import type { Auth } from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Google sign-in is simply unavailable when Firebase is not configured. */
export const isGoogleAuthConfigured = Boolean(config.apiKey && config.projectId);

let authPromise: Promise<Auth> | null = null;

/** Loads the SDK once and memoises the initialised Auth instance. */
function getFirebaseAuth(): Promise<Auth> {
  if (!isGoogleAuthConfigured) {
    return Promise.reject(new Error('Google sign-in is not configured'));
  }
  if (!authPromise) {
    authPromise = Promise.all([import('firebase/app'), import('firebase/auth')])
      .then(([{ initializeApp }, { getAuth }]) => getAuth(initializeApp(config)))
      .catch((error) => {
        // A failed chunk fetch must not poison every later attempt: clearing
        // the memo lets the next click retry instead of rejecting instantly.
        authPromise = null;
        throw error;
      });
  }
  return authPromise;
}

/**
 * Warms the SDK chunk without opening anything.
 *
 * Called when the auth dialog opens, so the network fetch overlaps with the
 * user reading the form instead of starting after they click.
 */
export function preloadGoogleAuth(): void {
  if (!isGoogleAuthConfigured) return;
  void getFirebaseAuth().catch(() => undefined);
}

/**
 * Opens the Google popup and returns the raw ID token.
 *
 * Nothing else from the Firebase result is used or trusted: the backend reads
 * the identity out of the verified token itself.
 */
export async function getGoogleIdToken(): Promise<string> {
  const [auth, { GoogleAuthProvider, signInWithPopup }] = await Promise.all([
    getFirebaseAuth(),
    import('firebase/auth'),
  ]);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth, provider);
  return credential.user.getIdToken();
}

export class GooglePopupClosed extends Error {}

export function isPopupClosed(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? '';
  return (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/user-cancelled'
  );
}
