import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
});

const { setPin, verifyPin, isPinSet, removePin, getLockRemainingMs, getFailedAttempts } = await import('./pin');

beforeEach(() => store.clear());
afterEach(() => vi.useRealTimers());

describe('PIN', () => {
  it('stores a salted hash, never the PIN itself', async () => {
    await setPin('1234');
    const raw = store.get('niyam-pin-v2')!;
    expect(raw).not.toContain('1234');
    expect(raw).not.toContain(btoa('1234'));
    expect(isPinSet()).toBe(true);
  });

  it('uses a fresh salt each time', async () => {
    await setPin('1234');
    const first = store.get('niyam-pin-v2');
    await setPin('1234');
    expect(store.get('niyam-pin-v2')).not.toBe(first);
  });

  it('accepts the right PIN and rejects a wrong one', async () => {
    await setPin('1234');
    expect(await verifyPin('1234')).toBe(true);
    expect(await verifyPin('0000')).toBe(false);
    expect(getFailedAttempts()).toBe(1);
  });

  it('clears the failure count after a successful unlock', async () => {
    await setPin('1234');
    await verifyPin('0000');
    await verifyPin('1234');
    expect(getFailedAttempts()).toBe(0);
  });

  it('locks out after 5 misses, persistently, even for the right PIN', async () => {
    await setPin('1234');
    for (let i = 0; i < 5; i++) await verifyPin('0000');
    expect(getLockRemainingMs()).toBeGreaterThan(25_000);
    expect(await verifyPin('1234')).toBe(false);
    // the lockout lives in storage, so restarting the app does not reset it
    expect(JSON.parse(store.get('niyam-pin-fails')!).until).toBeGreaterThan(Date.now());
  });

  it('resumes after the lockout expires and backs off longer the next time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await setPin('1234');
    for (let i = 0; i < 5; i++) await verifyPin('0000');
    const first = getLockRemainingMs();
    vi.advanceTimersByTime(first + 1000);
    expect(getLockRemainingMs()).toBe(0);

    for (let i = 0; i < 5; i++) await verifyPin('0000');
    const second = getLockRemainingMs();
    expect(second).toBeGreaterThan(first); // 60s tier after the 30s tier
  });

  it('upgrades a legacy btoa PIN on first successful unlock', async () => {
    store.set('niyam-pin-hash', btoa('4321' + ':niyam-v6-lock'));
    expect(isPinSet()).toBe(true);
    expect(await verifyPin('4321')).toBe(true);
    expect(store.has('niyam-pin-hash')).toBe(false);
    expect(store.has('niyam-pin-v2')).toBe(true);
    expect(await verifyPin('4321')).toBe(true);
  });

  it('rejects a wrong PIN against a legacy hash', async () => {
    store.set('niyam-pin-hash', btoa('4321' + ':niyam-v6-lock'));
    expect(await verifyPin('1111')).toBe(false);
    expect(store.has('niyam-pin-hash')).toBe(true);
  });

  it('removePin wipes the hash and the failure counter', async () => {
    await setPin('1234');
    await verifyPin('0000');
    removePin();
    expect(isPinSet()).toBe(false);
    expect(getFailedAttempts()).toBe(0);
  });
});
