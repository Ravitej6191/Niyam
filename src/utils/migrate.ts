import type { AppState, JournalTask } from '../App';

export const DEFAULT_JOURNAL_TASKS: JournalTask[] = [
  { id: 'eat_healthy',    label: 'Eat healthy',    emoji: '🥗', isDefault: true, active: true },
  { id: 'meditate',       label: 'Meditate',       emoji: '🧘', isDefault: true, active: true },
  { id: 'stay_hydrated',  label: 'Stay hydrated',  emoji: '💧', isDefault: true, active: true },
  { id: 'read',           label: 'Read a book',    emoji: '📚', isDefault: true, active: true },
  { id: 'exercise',       label: 'Exercise',       emoji: '🏃', isDefault: true, active: true },
];

export const DEFAULT_APP_STATE: AppState = {
  habits: [],
  expenses: [],
  budgets: [],
  notes: [],
  savedCounts: [],
  focusSessions: [],
  reminders: [],
  moods: [],
  breathingSessions: [],
  journalLogs: [],
  journalSettings: {
    reminderEnabled: false,
    reminderTime: '21:30',
    tasks: DEFAULT_JOURNAL_TASKS,
  },
  lastSeenAchievements: 0,
  userProfile: {
    name: 'User',
    avatar: 'default',
    joinDate: new Date().toISOString(),
    bio: '',
    location: '',
    preferences: { notifications: true, language: 'en', currency: 'INR' },
  },
  settings: {
    theme: 'system',
    fontSize: 'medium',
    currency: 'INR',
    language: 'en',
    notifications: { habits: true, budgets: true, reminders: true, achievements: true },
    privacy: { analytics: false, crashReports: true, dataSharing: false },
    advanced: { autoBackup: false, compactView: false, animations: true },
  },
};

/** Loose shape of persisted data: any field may be missing (older versions) or extra (e.g. `_rev`). */
export type SavedData = Partial<AppState> & Record<string, unknown>;

export function migrateData(savedData: SavedData): AppState {
  const migrated = { ...DEFAULT_APP_STATE };
  migrated.habits = (savedData.habits || []).map((h) => ({ ...h, bestStreak: h.bestStreak ?? h.streak ?? 0 }));
  migrated.expenses = savedData.expenses || [];
  migrated.budgets = savedData.budgets || [];
  migrated.notes = savedData.notes || [];
  migrated.savedCounts = savedData.savedCounts || [];
  migrated.focusSessions = savedData.focusSessions || [];
  migrated.reminders = savedData.reminders || [];
  migrated.moods = savedData.moods || [];
  migrated.breathingSessions = savedData.breathingSessions || [];
  migrated.journalLogs = savedData.journalLogs || [];
  migrated.journalSettings = savedData.journalSettings
    ? { ...DEFAULT_APP_STATE.journalSettings, ...savedData.journalSettings,
        tasks: savedData.journalSettings.tasks?.length
          ? savedData.journalSettings.tasks
          : DEFAULT_JOURNAL_TASKS }
    : DEFAULT_APP_STATE.journalSettings;
  migrated.lastSeenAchievements = savedData.lastSeenAchievements ?? 0;
  if (savedData.userProfile) {
    migrated.userProfile = {
      name: savedData.userProfile.name || 'User',
      avatar: savedData.userProfile.avatar || 'default',
      joinDate: savedData.userProfile.joinDate || new Date().toISOString(),
      bio: savedData.userProfile.bio || '',
      location: savedData.userProfile.location || '',
      preferences: {
        notifications: savedData.userProfile.preferences?.notifications ?? true,
        language: savedData.userProfile.preferences?.language || 'en',
        currency: savedData.userProfile.preferences?.currency || 'INR',
      },
    };
  }
  if (savedData.settings) {
    migrated.settings = {
      theme: savedData.settings.theme || 'system',
      fontSize: savedData.settings.fontSize || 'medium',
      currency: savedData.settings.currency || 'INR',
      language: savedData.settings.language || 'en',
      notifications: { ...DEFAULT_APP_STATE.settings.notifications, ...savedData.settings.notifications },
      privacy: { ...DEFAULT_APP_STATE.settings.privacy, ...savedData.settings.privacy },
      advanced: { ...DEFAULT_APP_STATE.settings.advanced, ...savedData.settings.advanced },
    };
  }
  return migrated;
}
