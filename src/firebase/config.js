import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Helper to get configuration from environment variables or localStorage
export function getFirebaseConfig() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const localConfigStr = window.localStorage.getItem('firebase_config');
      if (localConfigStr) {
        const parsed = JSON.parse(localConfigStr);
        if (parsed && parsed.apiKey && parsed.projectId) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.error('Failed to read localStorage firebase_config', e);
  }

  // Fallback to import.meta.env or hardcoded defaults
  const getEnv = (key, fallback) => {
    let val = null;
    try {
      if (typeof import.meta !== 'undefined' && import.meta && import.meta.env) {
        val = import.meta.env[key];
      }
    } catch {}
    return (val && typeof val === 'string' && val.trim().length > 0) ? val.trim() : fallback;
  };

  const envConfig = {
    apiKey: getEnv('VITE_FIREBASE_API_KEY', "AIzaSyBoXS3jXEeuuFjMLHM8jHZX0zxH86QCSzA"),
    authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', "bitlabs-6e41f.firebaseapp.com"),
    projectId: getEnv('VITE_FIREBASE_PROJECT_ID', "bitlabs-6e41f"),
    storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', "bitlabs-6e41f.firebasestorage.app"),
    messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', "234543492061"),
    appId: getEnv('VITE_FIREBASE_APP_ID', "1:234543492061:web:fd0dd8887a41c65779a434"),
  };

  if (envConfig.apiKey && envConfig.projectId) {
    return envConfig;
  }

  return null;
}

const config = getFirebaseConfig();

let app = null;
let db = null;
let auth = null;
let isRealFirebase = false;

if (config) {
  try {
    app = getApps().length === 0 ? initializeApp(config) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    isRealFirebase = true;
    console.log('Firebase initialized successfully.');
  } catch (error) {
    console.error('Firebase initialization failed:', error);
  }
} else {
  console.log('No Firebase credentials found. Running in Offline Simulator Mode (BroadcastChannel).');
}

export { app, db, auth, isRealFirebase };
