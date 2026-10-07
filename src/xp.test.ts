import { describe, it, expect } from 'vitest';
import { computeLifetimeXP, getCurrentLevel, getLevelProgress, LEVELS, XP_AWARDS } from './xp';
import { DEFAULT_APP_STATE } from './utils/migrate';
import type { AppState } from './App';

describe('computeLifetimeXP', () => {
  it('is zero for an empty state', () => {
    expect(computeLifetimeXP(DEFAULT_APP_STATE)).toBe(0);
  });

  it('adds up awards across modules, with the perfect-journal bonus', () => {
    const state = {
      ...DEFAULT_APP_STATE,
      habits: [{ id: 'h', completions: { a: true, b: true, c: false } }],
      journalLogs: [{ date: '2026-01-01', completionPct: 100 }],
      moods: [{ id: 'm' }],
    } as unknown as AppState;
    expect(computeLifetimeXP(state)).toBe(
      2 * XP_AWARDS.HABIT_COMPLETION +
      XP_AWARDS.JOURNAL_DAY_LOGGED + XP_AWARDS.JOURNAL_PERFECT_DAY +
      XP_AWARDS.MOOD_LOGGED,
    );
  });
});

describe('levels', () => {
  it('resolves level boundaries', () => {
    expect(getCurrentLevel(0).level).toBe(1);
    expect(getCurrentLevel(99).level).toBe(1);
    expect(getCurrentLevel(100).level).toBe(2);
    expect(getCurrentLevel(99_999).level).toBe(LEVELS.length);
  });

  // Regression: Achievements.tsx reads progress.current.idx for the roadmap line
  it('exposes idx on the current level', () => {
    expect(getLevelProgress(350).current.idx).toBe(2);
  });

  it('reports progress within a level and caps at the top level', () => {
    const mid = getLevelProgress(200); // level 2 spans 100-300
    expect(mid.progressPct).toBe(50);
    expect(mid.next?.level).toBe(3);
    const top = getLevelProgress(5000);
    expect(top.next).toBeNull();
    expect(top.progressPct).toBe(100);
  });
});
