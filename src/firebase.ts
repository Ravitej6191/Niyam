import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  doc,
  getDoc,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { firebaseConfig } from './firebase.config';
import { PART_KEYS, MAX_DOC_BYTES, byteSize, splitState } from './utils/sync';

// ── Init ─────────────────────────────────────────────────────────────────────
export const firebaseApp = initializeApp(firebaseConfig);

// Auth instance (shared with @capacitor-firebase/authentication)
export const auth = getAuth(firebaseApp);

// Firestore with offline persistence — reads work without internet
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache(),
});

// ── Errors ───────────────────────────────────────────────────────────────────

/** Another device wrote since we last loaded. Caller should reload, merge and retry. */
export class CloudConflictError extends Error {
  constructor() {
    super('Cloud data changed on another device');
    this.name = 'CloudConflictError';
  }
}

/** A single collection no longer fits in one Firestore document. */
export class CloudTooLargeError extends Error {
  constructor(public part: string, public bytes: number) {
    super(`"${part}" is ${bytes} bytes, over the Firestore document limit`);
    this.name = 'CloudTooLargeError';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export interface CloudSnapshot {
  data: Record<string, unknown>;
  /** Revision counter used for optimistic concurrency. 0 for documents written before sharding. */
  rev: number;
}

/** Last JSON written/loaded per shard, so unchanged shards aren't rewritten (saves write quota). */
const lastSynced = new Map<string, string>();
const syncKey = (uid: string, key: string) => `${uid}/${key}`;

const mainRef = (uid: string) => doc(db, 'users', uid);
const partRef = (uid: string, key: string) => doc(db, 'users', uid, 'parts', key);

/** Load all app data for a user. Returns null if no data yet. */
export async function loadUserData(uid: string): Promise<CloudSnapshot | null> {
  const main = await getDoc(mainRef(uid));
  if (!main.exists()) return null;

  const data: Record<string, unknown> = { ...main.data() };
  const rev = typeof data._rev === 'number' ? data._rev : 0;
  delete data._rev;

  const parts = await Promise.all(PART_KEYS.map(k => getDoc(partRef(uid, k))));
  parts.forEach((snap, i) => {
    const items = snap.exists() ? snap.data().items : undefined;
    // A shard overrides any legacy inline array left in the main document
    if (Array.isArray(items)) {
      data[PART_KEYS[i]] = items;
      lastSynced.set(syncKey(uid, PART_KEYS[i]), JSON.stringify(items));
    } else {
      lastSynced.delete(syncKey(uid, PART_KEYS[i]));
    }
  });
  return { data, rev };
}

/**
 * Write all app data atomically. Succeeds only if the cloud revision still equals
 * `baseRev` (what this device last loaded/saved); otherwise throws CloudConflictError.
 * Returns the new revision.
 */
export async function saveUserData(uid: string, data: object, baseRev: number): Promise<number> {
  const { main, parts } = splitState(data);

  for (const key of PART_KEYS) {
    const bytes = byteSize({ items: parts[key] });
    if (bytes > MAX_DOC_BYTES) throw new CloudTooLargeError(key, bytes);
  }
  const mainBytes = byteSize(main);
  if (mainBytes > MAX_DOC_BYTES) throw new CloudTooLargeError('profile', mainBytes);

  const pending = new Map<string, string>();
  const nextRev = await runTransaction(db, async tx => {
    pending.clear(); // transactions may retry
    const snap = await tx.get(mainRef(uid));
    const remoteRev = snap.exists() && typeof snap.data()._rev === 'number' ? snap.data()._rev : 0;
    if (remoteRev !== baseRev) {
      for (const key of PART_KEYS) lastSynced.delete(syncKey(uid, key));
      throw new CloudConflictError();
    }

    tx.set(mainRef(uid), { ...main, _rev: baseRev + 1 });
    for (const key of PART_KEYS) {
      const json = JSON.stringify(parts[key]);
      if (lastSynced.get(syncKey(uid, key)) === json) continue;
      tx.set(partRef(uid, key), { items: parts[key] });
      pending.set(key, json);
    }
    return baseRev + 1;
  });
  pending.forEach((json, key) => lastSynced.set(syncKey(uid, key), json));
  return nextRev;
}

/** Delete all cloud data for a user (used on "Clear All Data"). */
export async function deleteUserData(uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(mainRef(uid));
  for (const key of PART_KEYS) batch.delete(partRef(uid, key));
  await batch.commit();
  for (const key of PART_KEYS) lastSynced.delete(syncKey(uid, key));
}
