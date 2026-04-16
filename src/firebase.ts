import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { firebaseConfig } from './firebase.config';

// ── Init ─────────────────────────────────────────────────────────────────────
export const firebaseApp = initializeApp(firebaseConfig);

// Auth instance (shared with @capacitor-firebase/authentication)
export const auth = getAuth(firebaseApp);

// Firestore with offline persistence — data loads even without internet
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache(),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Load all app data for a user from Firestore. Returns null if no data yet. */
export async function loadUserData(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

/** Overwrite all app data for a user in Firestore. */
export async function saveUserData(uid: string, data: object): Promise<void> {
  await setDoc(doc(db, 'users', uid), data);
}

/** Delete all cloud data for a user (used on "Clear All Data"). */
export async function deleteUserData(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid));
}
