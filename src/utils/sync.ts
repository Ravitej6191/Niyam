/**
 * Pure helpers for cloud sync — no Firebase imports so they can be unit-tested.
 *
 * Cloud layout (see firebase.ts):
 *   users/{uid}               → everything except PART_KEYS, plus `_rev`
 *   users/{uid}/parts/{key}   → { items: [...] } for each collection in PART_KEYS
 *
 * Sharding keeps each collection under Firestore's 1 MiB per-document limit
 * independently, instead of the whole app state sharing a single document.
 */

/** Collections stored in their own sub-document. */
export const PART_KEYS = [
  'habits',
  'expenses',
  'budgets',
  'notes',
  'savedCounts',
  'focusSessions',
  'reminders',
  'moods',
  'breathingSessions',
  'journalLogs',
] as const;

export type PartKey = (typeof PART_KEYS)[number];

/** Firestore's hard limit is 1,048,576 bytes; stay safely below it. */
export const MAX_DOC_BYTES = 1_000_000;
/** Warn the user once a single part crosses this size. */
export const WARN_DOC_BYTES = 800_000;

const encoder = new TextEncoder();
export const byteSize = (value: unknown): number => encoder.encode(JSON.stringify(value)).length;

export function splitState(data: object): { main: Record<string, unknown>; parts: Record<PartKey, unknown[]> } {
  const source = data as Record<string, unknown>;
  const main: Record<string, unknown> = {};
  const parts = {} as Record<PartKey, unknown[]>;
  for (const key of Object.keys(source)) {
    if ((PART_KEYS as readonly string[]).includes(key)) continue;
    main[key] = source[key];
  }
  for (const key of PART_KEYS) {
    const v = source[key];
    parts[key] = Array.isArray(v) ? v : [];
  }
  return { main, parts };
}

/** Largest shard in bytes, with the key it belongs to. */
export function largestPart(data: object): { key: PartKey; bytes: number } {
  const { parts } = splitState(data);
  let best: { key: PartKey; bytes: number } = { key: PART_KEYS[0], bytes: 0 };
  for (const key of PART_KEYS) {
    const bytes = byteSize({ items: parts[key] });
    if (bytes > best.bytes) best = { key, bytes };
  }
  return best;
}

type Keyed = Record<string, unknown>;

function mergeById<T>(remote: T[] | undefined, local: T[] | undefined, keyOf: (item: T) => unknown): T[] {
  const out: T[] = [];
  const index = new Map<unknown, number>();
  for (const item of remote ?? []) {
    index.set(keyOf(item), out.length);
    out.push(item);
  }
  for (const item of local ?? []) {
    const k = keyOf(item);
    const at = index.get(k);
    if (at === undefined) {
      index.set(k, out.length);
      out.push(item);
    } else {
      out[at] = item; // same record edited on both sides → this device's version wins
    }
  }
  return out;
}

/**
 * Merge a remote snapshot with this device's state after a write conflict (or when
 * reconnecting after working offline). Records are unioned by id so neither side's
 * additions are lost; for the same record, `local` wins. Deletions made on one side
 * can be resurrected by the other — that's the deliberate trade-off versus losing data.
 */
export function mergeStates<S extends object>(remote: S, local: S): S {
  const r = remote as Keyed;
  const l = local as Keyed;
  const merged: Keyed = { ...r, ...l };
  for (const key of PART_KEYS) {
    const keyOf = key === 'journalLogs'
      ? (x: unknown) => (x as { date: string }).date
      : (x: unknown) => (x as { id: string }).id;
    merged[key] = mergeById(r[key] as unknown[] | undefined, l[key] as unknown[] | undefined, keyOf);
  }
  merged.lastSeenAchievements = Math.max(
    Number(r.lastSeenAchievements ?? 0),
    Number(l.lastSeenAchievements ?? 0),
  );
  return merged as S;
}
