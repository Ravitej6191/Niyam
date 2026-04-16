/**
 * Centralized XP engine — single source of truth for all gamification logic.
 * Import from this module everywhere; never hardcode XP values or level thresholds in UI.
 */
import type { AppState } from './App';

// ── XP awards per action ──────────────────────────────────────────────────────
export const XP_AWARDS = {
  HABIT_COMPLETION:    10,
  FOCUS_SESSION:        5,
  BREATHING_SESSION:    3,
  NOTE_WRITTEN:         3,
  MOOD_LOGGED:          2,
  EXPENSE_LOGGED:       2,
  COUNTER_SAVED:        1,
  JOURNAL_DAY_LOGGED:   4,
  JOURNAL_PERFECT_DAY:  6, // bonus on top for 100% completion
} as const;

// ── Level definitions — add entries here to expand ───────────────────────────
export interface LevelDef {
  level:    number;
  name:     string;
  minXP:    number;
  icon:     string; // lucide icon key
  color:    string;
  gradient: string;
}

export const LEVELS: readonly LevelDef[] = [
  { level: 1, name: 'Seedling', minXP: 0,    icon: 'leaf',    color: '#919F90', gradient: 'linear-gradient(135deg, #A0AE9F, #6E8470)' },
  { level: 2, name: 'Monk',     minXP: 100,  icon: 'star',    color: '#B78E79', gradient: 'linear-gradient(135deg, #C8A491, #9E7663)' },
  { level: 3, name: 'Warrior',  minXP: 300,  icon: 'sword',   color: '#7B96B0', gradient: 'linear-gradient(135deg, #8DAAC4, #5A7899)' },
  { level: 4, name: 'Master',   minXP: 700,  icon: 'crown',   color: '#C9935A', gradient: 'linear-gradient(135deg, #D4A870, #A87040)' },
  { level: 5, name: 'Champion', minXP: 1500, icon: 'gem',     color: '#9F8ABD', gradient: 'linear-gradient(135deg, #B0A0D4, #7A6AAE)' },
] as const;

// ── UI metadata for each XP source (mirrors XP_AWARDS keys) ─────────────────
export const XP_SOURCES = [
  { key: 'habits',    label: 'Habit completed',    award: XP_AWARDS.HABIT_COMPLETION,  color: '#7B96B0', icon: 'check-circle-2' },
  { key: 'focus',     label: 'Focus session',       award: XP_AWARDS.FOCUS_SESSION,     color: '#B78E79', icon: 'headphones'     },
  { key: 'breathing', label: 'Breathing session',   award: XP_AWARDS.BREATHING_SESSION, color: '#6E9E8A', icon: 'wind'           },
  { key: 'notes',     label: 'Note written',        award: XP_AWARDS.NOTE_WRITTEN,      color: '#919F90', icon: 'sticky-note'    },
  { key: 'moods',     label: 'Mood logged',         award: XP_AWARDS.MOOD_LOGGED,       color: '#C17B8E', icon: 'smile'          },
  { key: 'expenses',  label: 'Expense logged',      award: XP_AWARDS.EXPENSE_LOGGED,    color: '#C9935A', icon: 'credit-card'    },
  { key: 'counters',  label: 'Counter saved',       award: XP_AWARDS.COUNTER_SAVED,     color: '#414751', icon: 'hash'           },
  { key: 'journal',   label: 'Journal day logged',  award: XP_AWARDS.JOURNAL_DAY_LOGGED, color: '#6B5E9E', icon: 'book-open'    },
] as const;

// ── Lifetime XP computation ───────────────────────────────────────────────────
// Computed from all historical data — never resets.
// XP only grows: completing more actions = more XP.
export function computeLifetimeXP(state: AppState): number {
  const habitCompletions = state.habits.reduce(
    (sum, h) => sum + Object.values(h.completions).filter(Boolean).length, 0
  );
  const focusSessions  = state.focusSessions.filter(s => s.type === 'focus').length;
  const journalLogged  = state.journalLogs?.length ?? 0;
  const journalPerfect = state.journalLogs?.filter(l => l.completionPct === 100).length ?? 0;
  return (
    habitCompletions                       * XP_AWARDS.HABIT_COMPLETION   +
    focusSessions                          * XP_AWARDS.FOCUS_SESSION      +
    (state.breathingSessions?.length ?? 0) * XP_AWARDS.BREATHING_SESSION  +
    state.notes.length                     * XP_AWARDS.NOTE_WRITTEN       +
    (state.moods?.length ?? 0)             * XP_AWARDS.MOOD_LOGGED        +
    state.expenses.length                  * XP_AWARDS.EXPENSE_LOGGED     +
    state.savedCounts.length               * XP_AWARDS.COUNTER_SAVED      +
    journalLogged                          * XP_AWARDS.JOURNAL_DAY_LOGGED +
    journalPerfect                         * XP_AWARDS.JOURNAL_PERFECT_DAY
  );
}

// ── Per-source breakdown (for UI display) ────────────────────────────────────
export interface XPBreakdown {
  habits:    { count: number; xp: number };
  focus:     { count: number; xp: number };
  breathing: { count: number; xp: number };
  notes:     { count: number; xp: number };
  moods:     { count: number; xp: number };
  expenses:  { count: number; xp: number };
  counters:  { count: number; xp: number };
  journal:   { count: number; xp: number };
}

export function computeXPBreakdown(state: AppState): XPBreakdown {
  const habits        = state.habits.reduce((s, h) => s + Object.values(h.completions).filter(Boolean).length, 0);
  const focus         = state.focusSessions.filter(s => s.type === 'focus').length;
  const breathing     = state.breathingSessions?.length ?? 0;
  const moods         = state.moods?.length ?? 0;
  const journalLogged  = state.journalLogs?.length ?? 0;
  const journalPerfect = state.journalLogs?.filter(l => l.completionPct === 100).length ?? 0;
  return {
    habits:    { count: habits,                   xp: habits                   * XP_AWARDS.HABIT_COMPLETION  },
    focus:     { count: focus,                    xp: focus                    * XP_AWARDS.FOCUS_SESSION     },
    breathing: { count: breathing,                xp: breathing                * XP_AWARDS.BREATHING_SESSION },
    notes:     { count: state.notes.length,       xp: state.notes.length       * XP_AWARDS.NOTE_WRITTEN      },
    moods:     { count: moods,                    xp: moods                    * XP_AWARDS.MOOD_LOGGED       },
    expenses:  { count: state.expenses.length,    xp: state.expenses.length    * XP_AWARDS.EXPENSE_LOGGED    },
    counters:  { count: state.savedCounts.length, xp: state.savedCounts.length * XP_AWARDS.COUNTER_SAVED     },
    journal:   { count: journalLogged,            xp: journalLogged * XP_AWARDS.JOURNAL_DAY_LOGGED + journalPerfect * XP_AWARDS.JOURNAL_PERFECT_DAY },
  };
}

// ── Level resolution ──────────────────────────────────────────────────────────
export function getCurrentLevel(xp: number): LevelDef & { idx: number } {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return { ...LEVELS[i], idx: i };
  }
  return { ...LEVELS[0], idx: 0 };
}

// ── Progress to next level ────────────────────────────────────────────────────
export interface LevelProgress {
  current:         LevelDef;
  next:            LevelDef | null;
  progressPct:     number;         // 0–100
  xpIntoLevel:     number;
  xpNeededForNext: number | null;
}

export function getLevelProgress(xp: number): LevelProgress {
  const info    = getCurrentLevel(xp);
  const current = LEVELS[info.idx];
  const next    = LEVELS[info.idx + 1] ?? null;
  if (!next) {
    return { current, next: null, progressPct: 100, xpIntoLevel: xp - current.minXP, xpNeededForNext: null };
  }
  const span = next.minXP - current.minXP;
  const into = xp - current.minXP;
  return { current, next, progressPct: Math.min(100, (into / span) * 100), xpIntoLevel: into, xpNeededForNext: span };
}
