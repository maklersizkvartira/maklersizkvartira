import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, UserCredential } from 'firebase/auth';

// Google OAuth Web Credentials Provided by User
export const GOOGLE_CLIENT_ID = "63173300413-jfijmf1cng9dtlopjdpabb1e881go6pl.apps.googleusercontent.com";
export const GOOGLE_PROJECT_ID = "maklersiz-uy";

// Firebase configuration using environment variables with project credentials fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyMaklersizUzSecretKeyForTestingGoogleAuth2026",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${GOOGLE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || GOOGLE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${GOOGLE_PROJECT_ID}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "63173300413",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:63173300413:web:maklersizuygoogleauth"
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Custom Google Auth Provider Settings
googleProvider.setCustomParameters({
  prompt: 'select_account',
  client_id: GOOGLE_CLIENT_ID
});

// Google Auth Helper
export const signInWithGooglePopup = async (): Promise<{
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    phoneNumber: string | null;
  };
  idToken: string;
}> => {
  const result: UserCredential = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return {
    user: {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      phoneNumber: result.user.phoneNumber,
    },
    idToken,
  };
};
