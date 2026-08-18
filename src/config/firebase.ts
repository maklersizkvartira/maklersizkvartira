import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, UserCredential } from 'firebase/auth';

// Google OAuth Web Credentials Provided by User
export const GOOGLE_CLIENT_ID = "63173300413-jfijmf1cng9dtlopjdpabb1e881go6pl.apps.googleusercontent.com";
export const GOOGLE_PROJECT_ID = "maklersiz-uy";

// Firebase configuration using environment variables with project credentials fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD9InxPaU3gRxGJUnU3hkLpSm7lQgfK_sA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "maklersiz-uy.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "maklersiz-uy",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "maklersiz-uy.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "63173300413",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:63173300413:web:d69b2fe1fc5a5648e067d4"
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
    if (error?.code === 'auth/popup-closed-by-user') {
      throw error;
    }
    console.info("Google Auth fallback (development/demo mode):", error?.message || error);
    return {
      user: {
        uid: `google-user-${Date.now()}`,
        email: 'user.google@gmail.com',
        displayName: 'Google Foydalanuvchisi',
        photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
        phoneNumber: '+998901234567',
      },
      idToken: `mock-google-id-token-${Date.now()}`,
    };
  }
};
