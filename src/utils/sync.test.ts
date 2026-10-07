import { describe, it, expect } from 'vitest';
import { PART_KEYS, splitState, mergeStates, largestPart, byteSize } from './sync';

const base = () => ({
  habits: [] as { id: string; name?: string }[],
  expenses: [] as { id: string; amount?: number }[],
  budgets: [], notes: [] as { id: string; title?: string }[], savedCounts: [], focusSessions: [],
  reminders: [], moods: [], breathingSessions: [],
  journalLogs: [] as { date: string; pct?: number }[],
  userProfile: { name: 'User' },
  settings: { theme: 'system' },
  lastSeenAchievements: 0,
});

describe('splitState', () => {
  it('moves every collection into parts and keeps the rest in main', () => {
    const { main, parts } = splitState(base());
    expect(Object.keys(main).sort()).toEqual(['lastSeenAchievements', 'settings', 'userProfile']);
    expect(Object.keys(parts).sort()).toEqual([...PART_KEYS].sort());
  });

  it('treats missing or non-array collections as empty', () => {
    const { parts } = splitState({ notes: 'oops' });
    expect(parts.notes).toEqual([]);
    expect(parts.habits).toEqual([]);
  });
});

describe('mergeStates', () => {
  it('keeps additions from both sides', () => {
    const remote = { ...base(), notes: [{ id: 'a' }] };
    const local = { ...base(), notes: [{ id: 'b' }] };
    expect(mergeStates(remote, local).notes.map(n => n.id)).toEqual(['a', 'b']);
  });

  it('prefers this device for the same record', () => {
    const remote = { ...base(), notes: [{ id: 'a', title: 'remote' }] };
    const local = { ...base(), notes: [{ id: 'a', title: 'local' }] };
    expect(mergeStates(remote, local).notes).toEqual([{ id: 'a', title: 'local' }]);
  });

  it('keys journal logs by date', () => {
    const remote = { ...base(), journalLogs: [{ date: '2026-01-01', pct: 50 }] };
    const local = { ...base(), journalLogs: [{ date: '2026-01-01', pct: 100 }, { date: '2026-01-02', pct: 20 }] };
    expect(mergeStates(remote, local).journalLogs).toEqual([
      { date: '2026-01-01', pct: 100 },
      { date: '2026-01-02', pct: 20 },
    ]);
  });

  it('takes the larger lastSeenAchievements', () => {
    const remote = { ...base(), lastSeenAchievements: 7 };
    const local = { ...base(), lastSeenAchievements: 3 };
    expect(mergeStates(remote, local).lastSeenAchievements).toBe(7);
  });

  it('does not mutate its inputs', () => {
    const remote = { ...base(), notes: [{ id: 'a' }] };
    const local = { ...base(), notes: [{ id: 'b' }] };
    mergeStates(remote, local);
    expect(remote.notes).toHaveLength(1);
    expect(local.notes).toHaveLength(1);
  });
});

describe('largestPart', () => {
  it('reports the heaviest collection', () => {
    const s = { ...base(), notes: [{ id: '1', title: 'x'.repeat(5000) }], habits: [{ id: 'h' }] };
    const big = largestPart(s);
    expect(big.key).toBe('notes');
    expect(big.bytes).toBeGreaterThan(5000);
    expect(big.bytes).toBe(byteSize({ items: s.notes }));
  });
});
