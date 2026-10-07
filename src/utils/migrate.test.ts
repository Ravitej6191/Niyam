import { describe, it, expect } from 'vitest';
import { migrateData, DEFAULT_APP_STATE } from './migrate';
import type { SavedData } from './migrate';

describe('migrateData', () => {
  it('fills every collection and setting from an empty object', () => {
    const m = migrateData({});
    expect(m.habits).toEqual([]);
    expect(m.journalSettings.tasks.length).toBeGreaterThan(0);
    expect(m.settings).toEqual(DEFAULT_APP_STATE.settings);
    expect(m.userProfile.name).toBe('User');
  });

  it('back-fills bestStreak from the legacy streak field', () => {
    const m = migrateData({ habits: [{ id: 'h', streak: 4, completions: {} }] } as unknown as SavedData);
    expect(m.habits[0].bestStreak).toBe(4);
  });

  it('drops unknown fields such as the cloud revision counter', () => {
    const m = migrateData({ _rev: 9, notes: [] });
    expect('_rev' in m).toBe(false);
  });

  it('merges partial settings over the defaults', () => {
    const m = migrateData({ settings: { theme: 'dark', notifications: { habits: false } } } as unknown as SavedData);
    expect(m.settings.theme).toBe('dark');
    expect(m.settings.notifications).toEqual({ ...DEFAULT_APP_STATE.settings.notifications, habits: false });
  });

  it('restores default journal tasks when the saved list is empty', () => {
    const m = migrateData({ journalSettings: { tasks: [] } } as unknown as SavedData);
    expect(m.journalSettings.tasks).toEqual(DEFAULT_APP_STATE.journalSettings.tasks);
  });
});
