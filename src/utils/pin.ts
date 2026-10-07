/** PIN storage and brute-force lockout. UI lives in components/PinLock.tsx. */
import { hashSecret, checkSecret, parseSecretRecord, safeEqual } from './secret';

const PIN_KEY = 'niyam-pin-v2';
const LEGACY_PIN_KEY = 'niyam-pin-hash'; // v1: btoa(pin + constant salt) — upgraded on next successful unlock
const LEGACY_SALT = ':niyam-v6-lock';
const FAIL_KEY = 'niyam-pin-fails';

// The PIN is stored as a salted PBKDF2-SHA256 hash. Failed attempts and lockouts are
// persisted so restarting the app doesn't reset the brute-force counter.
// Note: this is an app-level lock; anyone with root/physical access to app storage can
// still attempt an offline guess of a 4-digit PIN, so it protects against casual access.

interface FailState { count: number; until: number }

function readFails(): FailState {
  try {
    const raw = localStorage.getItem(FAIL_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<FailState>;
      return { count: Number(p.count) || 0, until: Number(p.until) || 0 };
    }
  } catch { /* fall through */ }
  return { count: 0, until: 0 };
}

const writeFails = (f: FailState) => {
  try { localStorage.setItem(FAIL_KEY, JSON.stringify(f)); } catch { /* ignore */ }
};

/** Milliseconds until another attempt is allowed (0 when not locked out). */
export const getLockRemainingMs = (): number => Math.max(0, readFails().until - Date.now());
/** Wrong attempts since the last successful unlock. */
export const getFailedAttempts = (): number => readFails().count;

function recordFailure(): void {
  const { count } = readFails();
  const next = count + 1;
  // Every 5th miss locks out: 30s, 60s, 2m, 4m … capped at 15 minutes
  const lockMs = next % 5 === 0
    ? Math.min(30_000 * 2 ** (next / 5 - 1), 15 * 60_000)
    : 0;
  writeFails({ count: next, until: lockMs ? Date.now() + lockMs : 0 });
}

export const isPinSet = (): boolean =>
  !!localStorage.getItem(PIN_KEY) || !!localStorage.getItem(LEGACY_PIN_KEY);

export async function setPin(pin: string): Promise<void> {
  localStorage.setItem(PIN_KEY, JSON.stringify(await hashSecret(pin)));
  localStorage.removeItem(LEGACY_PIN_KEY);
  writeFails({ count: 0, until: 0 });
}

/** Checks a PIN. Always false while locked out; failures count towards the lockout. */
export async function verifyPin(pin: string): Promise<boolean> {
  if (getLockRemainingMs() > 0) return false;

  let ok = false;
  const stored = parseSecretRecord(localStorage.getItem(PIN_KEY));
  if (stored) {
    ok = await checkSecret(pin, stored);
  } else {
    const legacy = localStorage.getItem(LEGACY_PIN_KEY);
    if (legacy && safeEqual(legacy, btoa(pin + LEGACY_SALT))) {
      ok = true;
      await setPin(pin); // transparently upgrade to the salted hash
    }
  }

  if (ok) writeFails({ count: 0, until: 0 });
  else recordFailure();
  return ok;
}

export const removePin = (): void => {
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem(LEGACY_PIN_KEY);
  localStorage.removeItem(FAIL_KEY);
};
