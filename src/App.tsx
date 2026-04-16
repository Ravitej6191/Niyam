import React, { useState, useEffect, useRef, useMemo } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, loadUserData, saveUserData, deleteUserData } from './firebase';
import { computeLifetimeXP } from './xp';
import { toast } from 'sonner';
import { ThemeProvider } from './components/ThemeProvider';
import { Toaster } from './components/ui/sonner';
import SplashScreen from './components/SplashScreen';
import AuthGate from './components/AuthGate';
import BottomNavigation from './components/BottomNavigation';
import HomePage from './components/HomePage';
import HabitTracker from './components/HabitTracker';
import ExpenseTracker from './components/ExpenseTracker';
import Notes from './components/Notes';
import Counter from './components/Counter';
import Account from './components/Account';
import Achievements from './components/Achievements';
import FocusTracker from './components/FocusTracker';
import Reminders from './components/Reminders';
import MoodTracker from './components/MoodTracker';
import BreathingExercise from './components/BreathingExercise';
import JournalTracker from './components/JournalTracker';
import PinLock, { isPinSet, removePin } from './components/PinLock';
import { checkBiometricAvailable, isBiometricEnabled, promptBiometric, setBiometricEnabled } from './utils/biometric';

export type Screen = 'splash' | 'home' | 'habits' | 'expenses' | 'notes' | 'counter' | 'account' | 'achievements' | 'focus' | 'reminders' | 'mood' | 'breathing' | 'journal';
export type TabScreen = 'home' | 'journal' | 'achievements' | 'account';

export interface Habit {
  id: string;
  name: string;
  icon: string;
  completions: { [date: string]: boolean };
  streak: number;
  bestStreak: number;
  createdAt: string;
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  color: string;
}

export interface Budget {
  id: string;
  name: string;
  amount: number;
  period: 'weekly' | 'monthly';
  category?: string;
  startDate: string;
  color: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  lastEdited: string;
  isPinned?: boolean;
  tags?: string[];
}

export interface SavedCount {
  id: string;
  label: string;
  value: number;
  date: string;
}

export interface FocusSession {
  id: string;
  label: string;
  durationMinutes: number;
  completedAt: string;
  type: 'focus' | 'break';
}

export interface Reminder {
  id: string;
  title: string;
  note?: string;
  time: string; // HH:MM
  days: number[]; // 0=Sun, 1=Mon ... 6=Sat
  enabled: boolean;
  createdAt: string;
}

export interface MoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mood: 1 | 2 | 3 | 4 | 5;
  note?: string;
}

export interface BreathingSession {
  id: string;
  pattern: 'box' | '478';
  rounds: number;
  completedAt: string;
}

export interface JournalTask {
  id: string;
  label: string;
  emoji: string;
  isDefault: boolean;
  active: boolean;
}

export interface DailyLog {
  date: string;        // 'YYYY-MM-DD'
  completedIds: string[];
  completionPct: number; // 0–100
  totalTasks: number;
  note?: string;
}

export interface JournalSettings {
  reminderEnabled: boolean;
  reminderTime: string;  // 'HH:MM'
  tasks: JournalTask[];
}

export interface UserProfile {
  name: string;
  avatar: string;
  joinDate: string;
  bio?: string;
  location?: string;
  preferences: {
    notifications: boolean;
    language: string;
    currency: string;
  };
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'INR';
  language: 'en' | 'es' | 'fr' | 'de' | 'hi';
  notifications: {
    habits: boolean;
    budgets: boolean;
    reminders: boolean;
    achievements: boolean;
  };
  privacy: {
    analytics: boolean;
    crashReports: boolean;
    dataSharing: boolean;
  };
  advanced: {
    autoBackup: boolean;
    compactView: boolean;
    animations: boolean;
  };
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  check: (stats: AppStats, appState: AppState) => boolean;
  category: 'xp' | 'habits' | 'focus' | 'notes' | 'expenses' | 'general' | 'mood' | 'breathing' | 'counter' | 'reminders' | 'journal';
}

export interface AppStats {
  totalHabits: number;
  longestStreak: number;
  totalExpenses: number;
  totalSpent: number;
  totalNotes: number;
  daysUsing: number;
  achievementsUnlocked: number;
  totalFocusSessions: number;
  // Lifetime XP — never resets, computed from all historical data
  totalXP: number;
}

export interface AppState {
  habits: Habit[];
  expenses: Expense[];
  budgets: Budget[];
  notes: Note[];
  savedCounts: SavedCount[];
  focusSessions: FocusSession[];
  reminders: Reminder[];
  moods: MoodEntry[];
  breathingSessions: BreathingSession[];
  journalLogs: DailyLog[];
  journalSettings: JournalSettings;
  userProfile: UserProfile;
  settings: AppSettings;
  lastSeenAchievements: number;
}

const DEFAULT_JOURNAL_TASKS: JournalTask[] = [
  { id: 'eat_healthy',    label: 'Eat healthy',    emoji: '🥗', isDefault: true, active: true },
  { id: 'meditate',       label: 'Meditate',       emoji: '🧘', isDefault: true, active: true },
  { id: 'stay_hydrated',  label: 'Stay hydrated',  emoji: '💧', isDefault: true, active: true },
  { id: 'read',           label: 'Read a book',    emoji: '📚', isDefault: true, active: true },
  { id: 'exercise',       label: 'Exercise',       emoji: '🏃', isDefault: true, active: true },
];

const DEFAULT_APP_STATE: AppState = {
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

function migrateData(savedData: any): AppState {
  const migrated = { ...DEFAULT_APP_STATE };
  migrated.habits = (savedData.habits || []).map((h: any) => ({ ...h, bestStreak: h.bestStreak ?? h.streak ?? 0 }));
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
      notifications: { habits: true, budgets: true, reminders: true, achievements: true, ...savedData.settings.notifications },
      privacy: { analytics: false, crashReports: true, dataSharing: false, ...savedData.settings.privacy },
      advanced: { autoBackup: false, compactView: false, animations: true, ...savedData.settings.advanced },
    };
  }
  return migrated;
}

export const ALL_ACHIEVEMENTS: AchievementDef[] = [
  // ── XP Milestones ─────────────────────────────────────────────────────────
  { id: 'xp_100',  title: 'First Spark', description: 'Earned 100 lifetime XP',   icon: 'zap',          color: '#C9935A', category: 'xp', check: s => s.totalXP >= 100   },
  { id: 'xp_500',  title: 'Rising',      description: 'Earned 500 lifetime XP',   icon: 'trending-up',  color: '#7B96B0', category: 'xp', check: s => s.totalXP >= 500   },
  { id: 'xp_1000', title: 'Forged',      description: 'Earned 1 000 lifetime XP', icon: 'star',         color: '#B78E79', category: 'xp', check: s => s.totalXP >= 1000  },
  { id: 'xp_2500', title: 'Elite',       description: 'Earned 2 500 lifetime XP', icon: 'gem',          color: '#9F8ABD', category: 'xp', check: s => s.totalXP >= 2500  },
  { id: 'xp_5000', title: 'Legendary',   description: 'Earned 5 000 lifetime XP', icon: 'crown',        color: '#C9935A', category: 'xp', check: s => s.totalXP >= 5000  },
  // ── Habit streaks ─────────────────────────────────────────────────────────
  { id: 'first_habit',   title: 'First Step',    description: 'Created your first habit',  icon: 'leaf',  color: '#7B96B0', category: 'habits', check: s => s.totalHabits >= 1     },
  { id: 'habit_builder', title: 'Habit Builder', description: 'Tracking 5 habits at once', icon: 'zap',   color: '#7B96B0', category: 'habits', check: s => s.totalHabits >= 5     },
  { id: 'week_streak',   title: 'Week Warrior',  description: '7-day habit streak',        icon: 'flame', color: '#7B96B0', category: 'habits', check: s => s.longestStreak >= 7   },
  { id: 'month_streak',  title: 'Iron Will',     description: '30-day habit streak',       icon: 'gem',   color: '#9F8ABD', category: 'habits', check: s => s.longestStreak >= 30  },
  { id: 'streak_100',    title: 'Centurion',     description: '100-day habit streak',      icon: 'crown', color: '#C9935A', category: 'habits', check: s => s.longestStreak >= 100 },
  // ── Focus sessions ────────────────────────────────────────────────────────
  { id: 'first_focus', title: 'Deep Work',  description: 'Completed your first focus session', icon: 'headphones', color: '#B78E79', category: 'focus', check: (_, a) => a.focusSessions.filter(s => s.type === 'focus').length >= 1  },
  { id: 'focus_10',    title: 'Flow State', description: 'Completed 10 focus sessions',        icon: 'brain',      color: '#7B96B0', category: 'focus', check: (_, a) => a.focusSessions.filter(s => s.type === 'focus').length >= 10 },
  { id: 'focus_50',    title: 'Monk Mode',  description: 'Completed 50 focus sessions',        icon: 'target',     color: '#C9935A', category: 'focus', check: (_, a) => a.focusSessions.filter(s => s.type === 'focus').length >= 50 },
  // ── Notes ─────────────────────────────────────────────────────────────────
  { id: 'first_note', title: 'Note Taker', description: 'Wrote your first note', icon: 'file-text', color: '#919F90', category: 'notes', check: s => s.totalNotes >= 1  },
  { id: 'note_20',    title: 'Chronicler', description: 'Accumulated 20 notes',  icon: 'book-open', color: '#B78E79', category: 'notes', check: s => s.totalNotes >= 20 },
  // ── Expenses ──────────────────────────────────────────────────────────────
  { id: 'first_expense', title: 'Money Tracker', description: 'Logged your first expense', icon: 'coins',     color: '#C9935A', category: 'expenses', check: s => s.totalExpenses >= 1  },
  { id: 'expense_50',    title: 'Finance Pro',   description: 'Logged 50 expenses',        icon: 'bar-chart', color: '#C9935A', category: 'expenses', check: s => s.totalExpenses >= 50 },
  { id: 'budget_set',    title: 'Budget Setter', description: 'Created your first budget', icon: 'target',    color: '#C9935A', category: 'expenses', check: (_, a) => a.budgets.length >= 1 },
  // ── Mood ──────────────────────────────────────────────────────────────────
  { id: 'first_mood', title: 'In Touch',              description: 'Logged your first mood', icon: 'smile',       color: '#C17B8E', category: 'mood', check: (_, a) => (a.moods?.length ?? 0) >= 1  },
  { id: 'mood_7',     title: 'Self-Aware',            description: 'Logged mood 7 times',    icon: 'trending-up', color: '#C17B8E', category: 'mood', check: (_, a) => (a.moods?.length ?? 0) >= 7  },
  { id: 'mood_30',    title: 'Emotionally Balanced',  description: 'Logged mood 30 times',   icon: 'brain',       color: '#C17B8E', category: 'mood', check: (_, a) => (a.moods?.length ?? 0) >= 30 },
  // ── Breathing ─────────────────────────────────────────────────────────────
  { id: 'first_breath', title: 'First Breath', description: 'Completed your first breathing session', icon: 'wind', color: '#6E9E8A', category: 'breathing', check: (_, a) => (a.breathingSessions?.length ?? 0) >= 1  },
  { id: 'breath_10',    title: 'Calm Mind',   description: 'Completed 10 breathing sessions',         icon: 'wind', color: '#6E9E8A', category: 'breathing', check: (_, a) => (a.breathingSessions?.length ?? 0) >= 10 },
  { id: 'breath_30',    title: 'Zen Master',  description: 'Completed 30 breathing sessions',         icon: 'leaf', color: '#6E9E8A', category: 'breathing', check: (_, a) => (a.breathingSessions?.length ?? 0) >= 30 },
  // ── Counter ───────────────────────────────────────────────────────────────
  { id: 'first_counter', title: 'Keeping Count',   description: 'Saved your first counter', icon: 'hash', color: '#414751', category: 'counter',   check: (_, a) => a.savedCounts.length >= 1  },
  { id: 'counter_10',    title: 'Number Cruncher', description: 'Created 10 counters',      icon: 'zap',  color: '#414751', category: 'counter',   check: (_, a) => a.savedCounts.length >= 10 },
  // ── Reminders ─────────────────────────────────────────────────────────────
  { id: 'first_reminder', title: 'On Schedule', description: 'Created your first reminder', icon: 'calendar', color: '#9F8ABD', category: 'reminders', check: (_, a) => a.reminders.length >= 1 },
  // ── Journal ───────────────────────────────────────────────────────────────
  { id: 'journal_first',    title: 'Day One',        description: 'Logged your first journal day',    icon: 'book-open',   color: '#6B5E9E', category: 'journal', check: (_, a) => (a.journalLogs?.length ?? 0) >= 1  },
  { id: 'journal_7',        title: 'Week Keeper',    description: 'Logged journal for 7 days',        icon: 'book-open',   color: '#6B5E9E', category: 'journal', check: (_, a) => (a.journalLogs?.length ?? 0) >= 7  },
  { id: 'journal_30',       title: 'Monthly Habit',  description: 'Logged journal for 30 days',       icon: 'calendar',    color: '#6B5E9E', category: 'journal', check: (_, a) => (a.journalLogs?.length ?? 0) >= 30 },
  { id: 'journal_perfect_5', title: 'Perfectionist', description: '5 perfect journal days (100%)',   icon: 'star',        color: '#6B5E9E', category: 'journal', check: (_, a) => (a.journalLogs?.filter(l => l.completionPct === 100).length ?? 0) >= 5  },
  { id: 'journal_perfect_20', title: 'Daily Master', description: '20 perfect journal days (100%)', icon: 'crown',       color: '#6B5E9E', category: 'journal', check: (_, a) => (a.journalLogs?.filter(l => l.completionPct === 100).length ?? 0) >= 20 },
  // ── General ───────────────────────────────────────────────────────────────
  { id: 'app_7days',   title: 'Regular',     description: 'Using the app for 7 days',        icon: 'calendar',      color: '#7B96B0', category: 'general', check: s => s.daysUsing >= 7  },
  { id: 'app_30days',  title: 'Dedicated',   description: 'Using the app for 30 days',       icon: 'calendar-days', color: '#9F8ABD', category: 'general', check: s => s.daysUsing >= 30 },
  { id: 'all_rounder', title: 'All-Rounder', description: 'Used every module at least once', icon: 'star',          color: '#C9935A', category: 'general',
    check: (s, a) => s.totalHabits >= 1 && s.totalExpenses >= 1 && s.totalNotes >= 1 && a.savedCounts.length > 0 && (a.moods?.length ?? 0) > 0 && (a.breathingSessions?.length ?? 0) > 0 && (a.journalLogs?.length ?? 0) > 0 },
];

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [activeTab, setActiveTab] = useState<TabScreen>('home');
  const [moduleStack, setModuleStack] = useState<Screen[]>([]);
  const [splashDone, setSplashDone] = useState(false);

  // undefined = still checking auth; null = logged out; User = logged in
  const [firebaseUser, setFirebaseUser] = useState<User | null | undefined>(undefined);
  const [authReady, setAuthReady] = useState(false);

  const [appState, setAppState] = useState<AppState>(DEFAULT_APP_STATE);
  const [cloudSynced, setCloudSynced] = useState(false); // true after first Firestore load
  const [isGuest, setIsGuest] = useState(false); // true when user chose "Continue as Guest"
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [pinLocked, setPinLocked] = useState(false); // set to true after splash if PIN exists
  const [biometricSupported, setBiometricSupported] = useState(false);
  const isInBackground      = useRef(false); // true only after app has gone to background once
  const biometricInProgress = useRef(false); // prevents duplicate native prompts
  const lastSaveErrorRef    = useRef(0);     // throttle Firestore save-fail toasts

  const currentScreenRef   = useRef(currentScreen);
  useEffect(() => { currentScreenRef.current = currentScreen; }, [currentScreen]);

  // Refs used by the background-save listener so it always sees fresh values
  // without needing to re-register the Capacitor listener on every state change.
  const appStateRef      = useRef(appState);
  const cloudSyncedRef   = useRef(cloudSynced);
  const firebaseUserRef  = useRef(firebaseUser);
  const isGuestRef       = useRef(isGuest);
  useEffect(() => { appStateRef.current = appState; }, [appState]);
  useEffect(() => { cloudSyncedRef.current = cloudSynced; }, [cloudSynced]);
  useEffect(() => { firebaseUserRef.current = firebaseUser; }, [firebaseUser]);
  useEffect(() => { isGuestRef.current = isGuest; }, [isGuest]);

  // ── StatusBar — edge-to-edge overlay (Android/iOS) ──────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    StatusBar.setStyle({ style: Style.Default }).catch(() => {});
  }, []);

  // ── Splash timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  // ── Android back button — quit dialog on tabs, navigate back on modules ──────
  // Use an empty placeholder as initial value — navigateBack is defined later in the
  // component and can't be referenced here (const is not hoisted). The bare useEffect
  // (no dep array) updates the ref after every render so it always stays current.
  const navigateBackRef = useRef<() => void>(() => {});
  useEffect(() => { navigateBackRef.current = navigateBack; });

  useEffect(() => {
    const OTHER_TABS = ['journal', 'achievements', 'account'];
    let handle: any;
    CapApp.addListener('backButton', () => {
      const screen = currentScreenRef.current;
      if (screen === 'home') {
        // Home tab: show quit/exit dialog
        setShowQuitDialog(true);
      } else if (OTHER_TABS.includes(screen)) {
        // Other tabs: navigate back to home (don't exit)
        navigateBackRef.current();
      } else if (screen !== 'focus' && screen !== 'splash') {
        // FocusTracker registers its own backButton listener — skip it here to avoid double-fire.
        // All other module screens navigate back.
        navigateBackRef.current();
      }
    }).then(h => { handle = h; });
    return () => { handle?.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save immediately when app goes to background ────────────────────────────
  // The debounced save (1500ms) might not fire before Android suspends the app.
  // This listener triggers an immediate save + localStorage write on background.
  useEffect(() => {
    let rm: (() => void) | undefined;
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        // Only re-lock when genuinely returning from background (not initial launch)
        // and not while a biometric prompt is already showing (dialog causes its own events)
        if (isInBackground.current && !biometricInProgress.current && cloudSyncedRef.current) {
          isInBackground.current = false;
          if (isPinSet() || isBiometricEnabled()) {
            setPinLocked(true);
            if (isBiometricEnabled()) {
              biometricInProgress.current = true;
              promptBiometric().then(result => {
                biometricInProgress.current = false;
                if (result === 'success') setPinLocked(false);
              });
            }
          }
        }
        return;
      }
      // App going to background
      if (!biometricInProgress.current) {
        isInBackground.current = true;
      }
      const user   = firebaseUserRef.current;
      const synced = cloudSyncedRef.current;
      const state  = appStateRef.current;
      // Always write to localStorage — it's synchronous and survives background kill
      if (isGuestRef.current) {
        try { localStorage.setItem('niyamGuestData', JSON.stringify(state)); } catch {}
      } else {
        try { localStorage.setItem('niyamAppData', JSON.stringify(state)); } catch {}
      }
      // Best-effort Firestore save (may or may not complete before suspension)
      if (synced && user) {
        saveUserData(user.uid, state).catch(() => {});
      }
    }).then(h => { rm = () => h.remove(); });
    return () => rm?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Firebase auth listener ──────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);

      if (user) {
        // ── Load from Firestore ──────────────────────────────────────────────
        try {
          const cloudData = await loadUserData(user.uid);
          const googleFirstName = user.displayName?.split(' ')[0] || '';
          if (cloudData) {
            // Cloud has data → use it as source of truth
            const migrated = migrateData(cloudData);
            // If name is still the default placeholder, auto-fill from Google
            const needsName = !migrated.userProfile.name || migrated.userProfile.name === 'User';
            if (needsName && googleFirstName) {
              migrated.userProfile.name = googleFirstName;
              await saveUserData(user.uid, migrated);
            }
            setAppState(migrated);
          } else {
            // First-ever sign-in (no cloud data) → start fresh, pre-fill name from Google
            const fresh: AppState = {
              ...DEFAULT_APP_STATE,
              userProfile: {
                ...DEFAULT_APP_STATE.userProfile,
                name: googleFirstName || 'User',
                avatar: user.photoURL || 'default',
                joinDate: new Date().toISOString(),
              },
            };
            setAppState(fresh);
            await saveUserData(user.uid, fresh);
          }
        } catch (e) {
          console.warn('[Firebase] Firestore load failed, falling back to localStorage:', e);
          const localRaw = localStorage.getItem('niyamAppData');
          if (localRaw) {
            try { setAppState(migrateData(JSON.parse(localRaw))); } catch {}
          }
        }
        setCloudSynced(true);
      } else {
        // Logged out — clear cloud sync flag
        setCloudSynced(false);
      }
    });
    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Transition out of splash ────────────────────────────────────────────────
  useEffect(() => {
    if (splashDone && authReady) {
      setCurrentScreen('home');
      setActiveTab('home');
      checkBiometricAvailable().then(supported => {
        setBiometricSupported(supported);
        const pinSet = isPinSet();
        const bioEnabled = isBiometricEnabled() && supported;
        if (pinSet || bioEnabled) {
          setPinLocked(true);
          if (bioEnabled) {
            biometricInProgress.current = true;
            promptBiometric().then(result => {
              biometricInProgress.current = false;
              if (result === 'success') setPinLocked(false);
            });
          }
        }
      });
    }
  }, [splashDone, authReady]);

  // ── Save to Firestore + localStorage on state changes (logged-in users) ───────
  useEffect(() => {
    if (!cloudSynced || !firebaseUser) return;
    const id = setTimeout(async () => {
      try {
        await saveUserData(firebaseUser.uid, appState);
        localStorage.setItem('niyamAppData', JSON.stringify(appState));
      } catch (e) {
        console.warn('[Firebase] Firestore save failed:', e);
        try { localStorage.setItem('niyamAppData', JSON.stringify(appState)); } catch {}
        // Show toast at most once per 60s so offline users aren't spammed
        const now = Date.now();
        if (now - lastSaveErrorRef.current > 60_000) {
          lastSaveErrorRef.current = now;
          toast.error('Sync failed — data saved locally');
        }
      }
    }, 1500);
    return () => clearTimeout(id);
  }, [appState, cloudSynced, firebaseUser]);

  // ── Save guest data to localStorage only ────────────────────────────────────
  useEffect(() => {
    if (!isGuest) return;
    const id = setTimeout(() => {
      try { localStorage.setItem('niyamGuestData', JSON.stringify(appState)); } catch {}
    }, 1500);
    return () => clearTimeout(id);
  }, [appState, isGuest]);

  // ── Pull-to-refresh handler ─────────────────────────────────────────────────
  const handleRefresh = async () => {
    if (!firebaseUser || !cloudSynced) return;
    const cloudData = await loadUserData(firebaseUser.uid);
    if (cloudData) {
      setAppState(migrateData(cloudData));
      toast.success('Synced');
    }
  };

  // ── Font size ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    root.classList.add(`font-size-${appState.settings.fontSize}`);
  }, [appState.settings.fontSize]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const navigateToScreen = (screen: Screen) => {
    // Tab screens navigate directly (no module stack)
    if (screen === 'journal') {
      navigateToTab('journal');
      return;
    }
    if (['habits', 'expenses', 'notes', 'counter', 'focus', 'reminders', 'mood', 'breathing'].includes(screen)) {
      setModuleStack([activeTab as Screen]);
    }
    setCurrentScreen(screen);
  };

  const navigateToTab = (tab: TabScreen) => {
    setActiveTab(tab);
    setCurrentScreen(tab);
    setModuleStack([]);
    if (tab === 'achievements') {
      setAppState(prev => ({ ...prev, lastSeenAchievements: stats.achievementsUnlocked }));
    }
  };

  const navigateBack = () => {
    if (moduleStack.length > 0) {
      const [prev, ...rest] = moduleStack;
      setCurrentScreen(prev);
      setModuleStack(rest);
    } else {
      setCurrentScreen('home');
      setActiveTab('home');
    }
  };

  const updateAppState = (updates: Partial<AppState>) => {
    setAppState(prev => ({ ...prev, ...updates }));
  };

  const handleSignOut = async () => {
    if (isGuest) {
      // Guest sign-out: just clear guest state, return to login
      setIsGuest(false);
      setAppState(DEFAULT_APP_STATE);
      setCurrentScreen('home');
      setActiveTab('home');
      setModuleStack([]);
      return;
    }
    try {
      await signOut(auth);
      setAppState(DEFAULT_APP_STATE);
      setCurrentScreen('home');
      setActiveTab('home');
      setModuleStack([]);
      setCloudSynced(false);
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  };

  const handleEnterGuestMode = () => {
    // Load any persisted guest data
    const guestRaw = localStorage.getItem('niyamGuestData');
    let guestState = DEFAULT_APP_STATE;
    if (guestRaw) {
      try { guestState = migrateData(JSON.parse(guestRaw)); } catch {}
    }
    setIsGuest(true);
    setAppState(guestState);
    setCurrentScreen('home');
    setActiveTab('home');
    setModuleStack([]);
  };

  // Full data wipe: cloud + local + PIN + biometric → sign out → back to login
  const handleClearAllData = async () => {
    // 1. Remove PIN and biometric lock
    removePin();
    setBiometricEnabled(false);
    setPinLocked(false);

    // 2. Clear all localStorage
    try {
      localStorage.removeItem('niyamAppData');
      localStorage.removeItem('niyamGuestData');
      localStorage.removeItem('productivityAppData');
    } catch {}

    // 3. Delete Firestore document
    const user = firebaseUserRef.current;
    if (user) {
      try { await deleteUserData(user.uid); } catch {}
    }

    // 4. Sign out from Firebase (or clear guest)
    if (isGuestRef.current) {
      setIsGuest(false);
    } else {
      try { await signOut(auth); } catch {}
    }

    // 5. Reset in-memory state and navigate to login
    setAppState(DEFAULT_APP_STATE);
    setCloudSynced(false);
    setCurrentScreen('home');
    setActiveTab('home');
    setModuleStack([]);
  };

  // ── Achievement unlock detection ─────────────────────────────────────────────
  const prevUnlockedRef     = useRef<Set<string>>(new Set());
  const achievementsInitRef = useRef(false);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo((): AppStats => {
    const totalHabits       = appState.habits.length;
    const longestStreak     = totalHabits > 0 ? Math.max(0, ...appState.habits.map(h => h.bestStreak ?? h.streak)) : 0;
    const totalExpenses     = appState.expenses.length;
    const totalSpent        = appState.expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalNotes        = appState.notes.length;
    const totalFocusSessions = appState.focusSessions.filter(s => s.type === 'focus').length;
    const daysUsing         = Math.max(1, Math.ceil((Date.now() - new Date(appState.userProfile.joinDate).getTime()) / 86_400_000));
    const totalXP           = computeLifetimeXP(appState);
    const partialStats      = { totalHabits, longestStreak, totalExpenses, totalSpent, totalNotes, daysUsing, achievementsUnlocked: 0, totalFocusSessions, totalXP };
    const achievementsUnlocked = ALL_ACHIEVEMENTS.filter(a => a.check(partialStats, appState)).length;
    return { ...partialStats, achievementsUnlocked };
  }, [appState]);

  // Show toast when a new achievement is unlocked (skip on first snapshot / data load)
  useEffect(() => {
    const currentUnlocked = new Set(
      ALL_ACHIEVEMENTS.filter(a => a.check(stats, appState)).map(a => a.id)
    );
    if (!achievementsInitRef.current) {
      prevUnlockedRef.current = currentUnlocked;
      achievementsInitRef.current = true;
      return;
    }
    const newlyUnlocked = [...currentUnlocked].filter(id => !prevUnlockedRef.current.has(id));
    newlyUnlocked.forEach(id => {
      const ach = ALL_ACHIEVEMENTS.find(a => a.id === id);
      if (ach) toast.success(`Achievement unlocked: ${ach.title}`, { duration: 4000 });
    });
    prevUnlockedRef.current = currentUnlocked;
  }, [stats, appState]); // eslint-disable-line react-hooks/exhaustive-deps

  const isTabScreen = ['home', 'journal', 'achievements', 'account'].includes(currentScreen);
  const newAchievements = Math.max(0, stats.achievementsUnlocked - appState.lastSeenAchievements);

  // ── Render states ────────────────────────────────────────────────────────────
  // 1. Splash — shown first regardless of auth state.
  //    Covers the auth-resolving period so there is no component swap / jerk.
  //    currentScreen stays 'splash' until splashDone && authReady both fire.
  if (currentScreen === 'splash') {
    return (
      <div className="min-h-screen bg-background" style={{ minHeight: '100dvh' }}>
        <SplashScreen />
        <Toaster />
      </div>
    );
  }

  // 2. Splash done but not logged in and not in guest mode → sign-in card
  if (!firebaseUser && !isGuest) {
    return (
      <>
        <AuthGate ready={firebaseUser === null} onGuestMode={handleEnterGuestMode} />
        <Toaster />
      </>
    );
  }

  // 3. Logged-in / guest user, PIN / biometric locked (guests are never pin-locked)
  if (pinLocked && !isGuest) {
    const bioActive = isBiometricEnabled() && biometricSupported;
    return (
      <>
        <PinLock
          onUnlock={() => setPinLocked(false)}
          biometricEnabled={bioActive}
          onBiometricTap={() => {
            if (biometricInProgress.current) return;
            biometricInProgress.current = true;
            promptBiometric().then(result => {
              biometricInProgress.current = false;
              if (result === 'success') setPinLocked(false);
            });
          }}
        />
        <Toaster />
      </>
    );
  }

  // 4. Main app
  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'home': {
        const resolvedAvatarUrl = firebaseUser?.photoURL || (appState.userProfile.avatar.startsWith('data:') ? appState.userProfile.avatar : undefined);
        return <HomePage onNavigate={navigateToScreen} appState={appState} stats={stats} avatarUrl={resolvedAvatarUrl} onRefresh={!isGuest ? handleRefresh : undefined} />;
      }
      case 'achievements': return <Achievements stats={stats} appState={appState} />;
      case 'account': return (
        <Account
          userProfile={appState.userProfile}
          stats={stats}
          settings={appState.settings}
          appState={appState}
          onUpdate={updateAppState}
          firebaseUser={firebaseUser ?? null}
          onSignOut={handleSignOut}
          biometricSupported={biometricSupported}
          onClearAll={handleClearAllData}
          isGuest={isGuest}
        />
      );
      case 'habits': return <HabitTracker habits={appState.habits} onUpdate={(habits) => updateAppState({ habits })} onBack={navigateBack} />;
      case 'expenses': return <ExpenseTracker expenses={appState.expenses} budgets={appState.budgets} onUpdate={(expenses, budgets) => updateAppState({ expenses, budgets })} onBack={navigateBack} currency={appState.settings.currency} />;
      case 'notes': return <Notes notes={appState.notes} onUpdate={(notes) => updateAppState({ notes })} onBack={navigateBack} />;
      case 'counter': return <Counter savedCounts={appState.savedCounts} onUpdate={(savedCounts) => updateAppState({ savedCounts })} onBack={navigateBack} />;
      case 'focus': return <FocusTracker sessions={appState.focusSessions} onUpdate={(focusSessions) => updateAppState({ focusSessions })} onBack={navigateBack} />;
      case 'reminders': return <Reminders reminders={appState.reminders} onUpdate={(reminders) => updateAppState({ reminders })} onBack={navigateBack} />;
      case 'mood': return <MoodTracker moods={appState.moods} onUpdate={(moods) => updateAppState({ moods })} onBack={navigateBack} />;
      case 'breathing': return <BreathingExercise sessions={appState.breathingSessions} onUpdate={(breathingSessions) => updateAppState({ breathingSessions })} onBack={navigateBack} />;
      case 'journal': return (
        <JournalTracker
          journalLogs={appState.journalLogs}
          journalSettings={appState.journalSettings}
          onUpdateLogs={(journalLogs) => updateAppState({ journalLogs })}
          onUpdateSettings={(journalSettings) => updateAppState({ journalSettings })}
        />
      );
      default: { const resolvedAvatarUrl = firebaseUser?.photoURL || (appState.userProfile.avatar.startsWith('data:') ? appState.userProfile.avatar : undefined); return <HomePage onNavigate={navigateToScreen} appState={appState} stats={stats} avatarUrl={resolvedAvatarUrl} onRefresh={!isGuest ? handleRefresh : undefined} />; }
    }
  };

  return (
    <div className="min-h-screen bg-background transition-colors duration-300" style={{ minHeight: '100dvh' }}>
      <div className={isTabScreen ? 'pb-screen-safe' : 'pb-safe'}>
        {renderCurrentScreen()}
      </div>
      {isTabScreen && (
        <BottomNavigation activeTab={activeTab} onTabChange={navigateToTab} newAchievements={newAchievements} />
      )}
      <Toaster />

      {/* ── Quit confirmation dialog ── */}
      <AnimatePresence>
        {showQuitDialog && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
            onClick={() => setShowQuitDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 24 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--card)', borderRadius: '1.5rem', padding: '1.75rem 1.5rem 1.5rem', maxWidth: 320, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.32)', fontFamily: "'Rubik', sans-serif" }}
            >
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(65,71,81,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.125rem' }}>
                <svg width="24" height="24" fill="none" stroke="var(--foreground)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </div>
              <h3 style={{ textAlign: 'center', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>
                Exit Niyam?
              </h3>
              <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1.375rem', lineHeight: 1.55 }}>
                Your data is saved. Are you sure you want to quit?
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowQuitDialog(false)}
                  style={{ flex: 1, height: 46, borderRadius: '0.875rem', background: 'var(--muted)', border: 'none', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9375rem', color: 'var(--foreground)', cursor: 'pointer' }}>
                  Stay
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setShowQuitDialog(false); CapApp.exitApp(); }}
                  style={{ flex: 1, height: 46, borderRadius: '0.875rem', background: '#414751', border: 'none', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9375rem', color: '#fff', cursor: 'pointer' }}>
                  Exit
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="niyam-app-theme">
      <AppContent />
    </ThemeProvider>
  );
}
