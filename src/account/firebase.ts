import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

/**
 * Konfigurasi web Firebase project `musicverse-app` (lihat docs/firebase-r2/FIREBASE-PROJECT-LOCK.md di proyek Android).
 * Nilai ini PUBLIK menurut desain Firebase (bukan rahasia); keamanan ada di Authorized domains + Firestore Rules.
 * Bisa ditimpa lewat VITE_FIREBASE_* di environment deployment.
 * Analytics sengaja TIDAK dipasang: Kebijakan Privasi menyatakan situs tanpa analitik.
 */
const env = import.meta.env
const config = {
  apiKey: (env.VITE_FIREBASE_API_KEY ?? '').trim(),
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN ?? 'musicverse-app.firebaseapp.com').trim(),
  projectId: (env.VITE_FIREBASE_PROJECT_ID ?? 'musicverse-app').trim(),
  storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET ?? 'musicverse-app.firebasestorage.app').trim(),
  messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '841689535787').trim(),
  appId: (env.VITE_FIREBASE_APP_ID ?? '1:841689535787:web:33c2224c0cf4dd4bc1a16e').trim(),
}

/** Tanpa API key (VITE_FIREBASE_API_KEY) halaman akun menampilkan pesan konfigurasi, bukan crash. */
export const firebaseConfigured = config.apiKey.length > 0

let app: FirebaseApp | null = null

function getFirebaseApp(): FirebaseApp {
  if (!app) app = getApps().length ? getApp() : initializeApp(config)
  return app
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp())
}

export function getDb(): Firestore {
  return getFirestore(getFirebaseApp())
}
