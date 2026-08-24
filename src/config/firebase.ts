/**
 * Firebase — used for one thing only: obtaining a Google ID token.
 *
 * The token is sent to `POST /auth/google`, where the backend verifies its
 * signature against Google's published certificates before trusting a single
 * claim in it. The previous implementation posted the email address straight
 * from the client and the server believed it, which meant anyone could sign
 * in as anyone by typing their address into a request.
 *
 * The values here are publishable by design; Firebase config is not a secret.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  type Auth,
} from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Google sign-in is simply unavailable when Firebase is not configured. */
export const isGoogleAuthConfigured = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function getFirebaseAuth(): Auth {
  if (!isGoogleAuthConfigured) {
    throw new Error('Google sign-in is not configured');
  }
  if (!app) app = initializeApp(config);
  if (!auth) auth = getAuth(app);
  return auth;
}

/**
 * Opens the Google popup and returns the raw ID token.
 *
 * Nothing else from the Firebase result is used or trusted: the backend reads
 * the identity out of the verified token itself.
 */
export async function getGoogleIdToken(): Promise<string> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(getFirebaseAuth(), provider);
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
