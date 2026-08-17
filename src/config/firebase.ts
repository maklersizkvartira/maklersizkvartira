import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, UserCredential } from 'firebase/auth';

// Firebase configuration using environment variables with safe default fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyMaklersizUzSecretKeyForTestingGoogleAuth2026",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "maklersiz-uz.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "maklersiz-uz",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "maklersiz-uz.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef1234567890"
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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
  try {
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
  } catch (error: any) {
    console.error("Firebase Google Auth Error:", error);
    throw error;
  }
};
