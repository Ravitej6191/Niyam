import { describe, it, expect } from 'vitest';
import { hashSecret, checkSecret, parseSecretRecord, safeEqual } from './secret';

describe('secret hashing', () => {
  it('round-trips and rejects a wrong secret', async () => {
    const rec = await hashSecret('hunter22');
    expect(await checkSecret('hunter22', rec)).toBe(true);
    expect(await checkSecret('hunter23', rec)).toBe(false);
  });

  it('salts every hash differently', async () => {
    const a = await hashSecret('same');
    const b = await hashSecret('same');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('parses only well-formed v2 records', async () => {
    const rec = await hashSecret('x');
    expect(parseSecretRecord(JSON.stringify(rec))).toEqual(rec);
    expect(parseSecretRecord(btoa('legacy'))).toBeNull();
    expect(parseSecretRecord('{"v":1}')).toBeNull();
    expect(parseSecretRecord('{broken')).toBeNull();
    expect(parseSecretRecord(null)).toBeNull();
  });

  it('safeEqual compares by value', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
  });
});
