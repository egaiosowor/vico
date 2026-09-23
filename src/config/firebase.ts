import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
} from '@env';

const firebaseConfig = {
  apiKey: FIREBASE_API_KEY || 'AIzaSyPlaceholderKey',
  authDomain: FIREBASE_AUTH_DOMAIN || 'nightwatch-app.firebaseapp.com',
  projectId: FIREBASE_PROJECT_ID || 'nightwatch-app',
  storageBucket: FIREBASE_STORAGE_BUCKET || 'nightwatch-app.appspot.com',
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId: FIREBASE_APP_ID || '1:123456789012:web:abcdef1234567890',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let authInstance: any;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // If already initialized
  const { getAuth } = require('firebase/auth');
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const db = getFirestore(app);

export const ensureFirebaseAuth = async (): Promise<void> => {
  try {
    const { signInAnonymously } = await import('firebase/auth');
    if (!authInstance?.currentUser) {
      await signInAnonymously(authInstance);
    }
  } catch (err: any) {
    // If anonymous sign-in is disabled in Firebase Console or offline, log note gracefully
    console.warn('[Firebase] Auth initialization note:', err?.message || err);
  }
};

export default app;
