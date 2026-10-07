/**
 * Salted PBKDF2-SHA256 hashing for local secrets (app PIN, note passwords).
 * Needs WebCrypto, which is available in Capacitor's https://localhost WebView and on
 * localhost during development.
 */

const ITERATIONS = 150_000;
const enc = new TextEncoder();

export interface SecretRecord { v: 2; salt: string; hash: string; iter: number }

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

async function derive(secret: string, salt: BufferSource, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return toB64(new Uint8Array(bits));
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hashSecret(secret: string): Promise<SecretRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { v: 2, salt: toB64(salt), hash: await derive(secret, salt, ITERATIONS), iter: ITERATIONS };
}

export async function checkSecret(secret: string, record: SecretRecord): Promise<boolean> {
  return safeEqual(await derive(secret, fromB64(record.salt), record.iter), record.hash);
}

/** Parse a stored record; returns null for anything that isn't a v2 record (e.g. legacy formats). */
export function parseSecretRecord(raw: string | null): SecretRecord | null {
  if (!raw || raw[0] !== '{') return null;
  try {
    const r = JSON.parse(raw) as Partial<SecretRecord>;
    return r.v === 2 && typeof r.salt === 'string' && typeof r.hash === 'string' && typeof r.iter === 'number'
      ? (r as SecretRecord)
      : null;
  } catch {
    return null;
  }
}
