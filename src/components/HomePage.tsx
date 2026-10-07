import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, CreditCard, FileText, Hash, Headphones, Bell,
  Flame, CheckCircle2, AlertTriangle, ChevronRight,
  Clock, TrendingUp, Star, ArrowUpRight, Smile, Wind, RefreshCw, BookOpen,
} from 'lucide-react';
import { hapticTap } from '../utils/haptic';
import type { Screen, AppState, AppStats } from '../App';
import { getLevelProgress } from '../xp';

// ── Weather ───────────────────────────────────────────────────
type WeatherState =
  | { status: 'loading' }
  | { status: 'ok'; temp: number; city: string }
  | { status: 'error' };

// Module-level cache — survives component remounts, cleared after 10 min
type WeatherOk = Extract<WeatherState, { status: 'ok' }>;
let _weatherCache: { data: WeatherOk; at: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function useWeather(): WeatherState {
  const cached = _weatherCache && Date.now() - _weatherCache.at < CACHE_TTL ? _weatherCache.data : null;
  const [weather, setWeather] = useState<WeatherState>(cached ?? { status: 'loading' });

  useEffect(() => {
    // Still fresh — no fetch needed
    if (_weatherCache && Date.now() - _weatherCache.at < CACHE_TTL) return;

    (async () => {
      try {
        // Request permission (shows native dialog on Android)
        const perm = await Geolocation.requestPermissions({ permissions: ['coarseLocation'] });
        if (perm.coarseLocation !== 'granted') { setWeather({ status: 'error' }); return; }

        // Coarse fix is plenty for weather + city name
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 });
        // Privacy: round to 2 decimals (~1 km) before sending to third-party services
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;

        const [wRes, gRes] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`),
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&accept-language=en`),
        ]);
        const wData = await wRes.json();
        const gData = await gRes.json();
        const temp = Math.round(wData.current.temperature_2m);
        const city = gData.address?.city || gData.address?.town || gData.address?.village || gData.address?.county || '';
        const result: WeatherOk = { status: 'ok', temp, city };
        _weatherCache = { data: result, at: Date.now() };
        setWeather(result);
      } catch {
        setWeather({ status: 'error' });
      }
    })();
  }, []);

  return weather;
}

const PULL_THRESHOLD = 68;

interface HomePageProps {
  onNavigate: (screen: Screen) => void;
  appState: AppState;
  stats: AppStats;
  avatarUrl?: string;
  onRefresh?: () => Promise<void>;
}

function getBudgetPeriod(budget: { period: 'weekly' | 'monthly' }) {
  const today = new Date(); today.setHours(0,0,0,0);
  let startDate: Date, endDate: Date;
  if (budget.period === 'weekly') {
    const diff = today.getDay() === 0 ? -6 : 1 - today.getDay();
    startDate = new Date(today); startDate.setDate(today.getDate() + diff);
    endDate = new Date(startDate); endDate.setDate(startDate.getDate() + 6);
  } else {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    endDate   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  }
  return { startDate, endDate };
}

const MODULES = [
  {
    key: 'habits', screen: 'habits' as Screen,
    title: 'Habits',
    sub: 'Build streaks',
    icon: Zap,
    // Steel dark card — premium, bold
    cardBg: 'linear-gradient(145deg, #414751 0%, #2C3038 100%)',
    cardBgAlt: '#353A43',
    iconBg: '#7B96B0',
    iconBgDark: '#5A7899',
    textColor: '#F2EDE7',
    subColor: 'rgba(232,235,237,0.65)',
    accentLine: '#7B96B0',
    border: 'rgba(123,150,176,0.18)',
    dark: true,
  },
  {
    key: 'expenses', screen: 'expenses' as Screen,
    title: 'Expenses',
    sub: 'Track spending',
    icon: CreditCard,
    // Rich amber/warm card
    cardBg: 'linear-gradient(145deg, #C9935A 0%, #A87040 100%)',
    cardBgAlt: '#B88050',
    iconBg: 'rgba(255,255,255,0.22)',
    iconBgDark: 'rgba(255,255,255,0.15)',
    textColor: '#FFFFFF',
    subColor: 'rgba(255,255,255,0.7)',
    accentLine: 'rgba(255,255,255,0.4)',
    border: 'rgba(201,147,90,0.0)',
    dark: true,
  },
  {
    key: 'notes', screen: 'notes' as Screen,
    title: 'Notes',
    sub: 'Capture ideas',
    icon: FileText,
    // Deep sage/rosemary dark card
    cardBg: 'linear-gradient(145deg, #5C7A5B 0%, #3E5A3D 100%)',
    cardBgAlt: '#4E6C4D',
    iconBg: 'rgba(255,255,255,0.22)',
    iconBgDark: 'rgba(255,255,255,0.15)',
    textColor: '#FFFFFF',
    subColor: 'rgba(255,255,255,0.68)',
    accentLine: 'rgba(255,255,255,0.4)',
    border: 'rgba(92,122,91,0.0)',
    dark: true,
  },
  {
    key: 'focus', screen: 'focus' as Screen,
    title: 'Focus',
    sub: 'Deep work',
    icon: Headphones,
    // Terracotta hero card
    cardBg: 'linear-gradient(145deg, #B78E79 0%, #9E7663 100%)',
    cardBgAlt: '#A87D6B',
    iconBg: 'rgba(255,255,255,0.22)',
    iconBgDark: 'rgba(255,255,255,0.15)',
    textColor: '#FFFFFF',
    subColor: 'rgba(255,255,255,0.7)',
    accentLine: 'rgba(255,255,255,0.4)',
    border: 'rgba(183,142,121,0.0)',
    dark: true,
  },
  {
    key: 'counter', screen: 'counter' as Screen,
    title: 'Counter',
    sub: 'Count anything',
    icon: Hash,
    // Deep ocean-steel dark card
    cardBg: 'linear-gradient(145deg, #4C6E8A 0%, #304F6B 100%)',
    cardBgAlt: '#3D6078',
    iconBg: 'rgba(255,255,255,0.22)',
    iconBgDark: 'rgba(255,255,255,0.15)',
    textColor: '#FFFFFF',
    subColor: 'rgba(255,255,255,0.68)',
    accentLine: 'rgba(255,255,255,0.4)',
    border: 'rgba(76,110,138,0.0)',
    dark: true,
  },
  {
    key: 'reminders', screen: 'reminders' as Screen,
    title: 'Reminders',
    sub: 'Stay on track',
    icon: Bell,
    // Muted purple card
    cardBg: 'linear-gradient(145deg, #9F8ABD 0%, #7D6A9E 100%)',
    cardBgAlt: '#9080AD',
    iconBg: 'rgba(255,255,255,0.22)',
    iconBgDark: 'rgba(255,255,255,0.15)',
    textColor: '#FFFFFF',
    subColor: 'rgba(255,255,255,0.7)',
    accentLine: 'rgba(255,255,255,0.4)',
    border: 'rgba(159,138,189,0.0)',
    dark: true,
  },
  {
    key: 'mood', screen: 'mood' as Screen,
    title: 'Mood',
    sub: 'Track how you feel',
    icon: Smile,
    // Dusty rose card
    cardBg: 'linear-gradient(145deg, #C17B8E 0%, #A05E73 100%)',
    cardBgAlt: '#B07080',
    iconBg: 'rgba(255,255,255,0.22)',
    iconBgDark: 'rgba(255,255,255,0.15)',
    textColor: '#FFFFFF',
    subColor: 'rgba(255,255,255,0.7)',
    accentLine: 'rgba(255,255,255,0.4)',
    border: 'rgba(193,123,142,0.0)',
    dark: true,
  },
  {
    key: 'breathing', screen: 'breathing' as Screen,
    title: 'Breathe',
    sub: 'Calm your mind',
    icon: Wind,
    // Seafoam card
    cardBg: 'linear-gradient(145deg, #6E9E8A 0%, #4E7F6A 100%)',
    cardBgAlt: '#5E8E78',
    iconBg: 'rgba(255,255,255,0.22)',
    iconBgDark: 'rgba(255,255,255,0.15)',
    textColor: '#FFFFFF',
    subColor: 'rgba(255,255,255,0.7)',
    accentLine: 'rgba(255,255,255,0.4)',
    border: 'rgba(110,158,138,0.0)',
    dark: true,
  },
  {
    key: 'journal', screen: 'journal' as Screen,
    title: 'Journal',
    sub: 'Daily check-in',
    icon: BookOpen,
    // Deep violet card
    cardBg: 'linear-gradient(145deg, #6B5E9E 0%, #4A3F7E 100%)',
    cardBgAlt: '#5A4E8E',
    iconBg: 'rgba(255,255,255,0.22)',
    iconBgDark: 'rgba(255,255,255,0.15)',
    textColor: '#FFFFFF',
    subColor: 'rgba(255,255,255,0.7)',
    accentLine: 'rgba(255,255,255,0.4)',
    border: 'rgba(107,94,158,0.0)',
    dark: true,
  },
] as const;


export default function HomePage({ onNavigate, appState, stats, avatarUrl, onRefresh }: HomePageProps) {
  // ── Pull-to-refresh ──────────────────────────────────────────────────────────
  const containerRef    = useRef<HTMLDivElement>(null);
  const touchStartY     = useRef(0);
  const pullTriggered   = useRef(false);
  const [pullY, setPullY]       = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (refreshing || !onRefresh) return;
    if (window.scrollY > 2) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta <= 0) return;
    e.preventDefault();
    const clamped = Math.min(PULL_THRESHOLD, delta * 0.45);
    setPullY(clamped);
    if (clamped >= PULL_THRESHOLD && !pullTriggered.current) {
      pullTriggered.current = true;
      hapticTap();
    }
  }, [refreshing, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', handleTouchMove);
  }, [handleTouchMove]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    pullTriggered.current = false;
  };

  const handleTouchEnd = async () => {
    if (pullY >= PULL_THRESHOLD && onRefresh && !refreshing) {
      setRefreshing(true);
      setPullY(0);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    } else {
      setPullY(0);
    }
  };

  const fmt = (v: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: appState.settings.currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v);

  const greet = () => {
    const h = new Date().getHours();
    if (h < 5) return 'Still up?';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
  };

  const todayKey = new Date().toISOString().split('T')[0];

  const ms = useMemo(() => {
    const completedToday = appState.habits.filter(h => h.completions[todayKey]).length;
    const habitPct = appState.habits.length ? Math.round((completedToday / appState.habits.length) * 100) : 0;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const monthlySpent = appState.expenses.filter(e => new Date(e.date) >= monthStart).reduce((s,e) => s+e.amount, 0);
    const overBudgetCount = appState.budgets.filter(b => {
      const { startDate, endDate } = getBudgetPeriod(b);
      const spent = appState.expenses.filter(e => {
        const d = new Date(e.date); d.setHours(0,0,0,0);
        return d >= startDate && d <= endDate && (!b.category || e.category === b.category);
      }).reduce((s,e) => s+e.amount, 0);
      return spent > b.amount;
    }).length;
    const todayFocus = appState.focusSessions.filter(s => s.completedAt.startsWith(todayKey) && s.type === 'focus').length;
    const activeReminders = appState.reminders.filter(r => r.enabled).length;
    return { completedToday, habitPct, monthlySpent, overBudgetCount, todayFocus, activeReminders };
  }, [appState, todayKey]);

  const hasContent = stats.totalHabits > 0 || stats.totalExpenses > 0 || stats.totalNotes > 0
    || stats.totalFocusSessions > 0 || (appState.moods?.length ?? 0) > 0
    || (appState.breathingSessions?.length ?? 0) > 0 || appState.savedCounts.length > 0
    || appState.reminders.length > 0;
  const topHabit   = [...appState.habits].sort((a,b) => b.streak - a.streak)[0];
  const levelName  = getLevelProgress(stats.totalXP).current.name;
  const navigate   = (s: Screen) => { hapticTap(); onNavigate(s); };

  // Declare these BEFORE the pool block — they are referenced inside it
  const todayMood     = appState.moods?.find(m => m.date === todayKey);
  const moodEmojis    = ['', '😞', '😕', '😐', '🙂', '😄'];
  const moodLabels    = ['', 'Low', 'Down', 'Neutral', 'Good', 'Great'];
  const todayBreathing = appState.breathingSessions?.filter(s => s.completedAt.startsWith(todayKey)).length ?? 0;

  const weather = useWeather();

  // Stable per-session shuffle seed — picked once when HomePage mounts
  const [hlSeed] = useState(() => Math.floor(Math.random() * 65536));

  // Seeded hash: gives each item a consistent but randomly-ordered numeric score
  const hlScore = (key: string) => {
    let h = hlSeed;
    for (let i = 0; i < key.length; i++) h = (Math.imul(h ^ 0xdeadbeef, 0x9e3779b9) ^ key.charCodeAt(i)) >>> 0;
    return h;
  };

  // Full pool of potential highlight items (only available ones are included)
  type HItem = { key: string; icon: React.ReactNode; color: string; title: string; value: string; nav: Screen };
  const hlPool: HItem[] = [];
  if (topHabit && topHabit.streak >= 2)
    hlPool.push({ key: 'streak',    icon: <Flame size={14} strokeWidth={2.5}/>,       color: '#C9935A', title: topHabit.name,     value: `${topHabit.streak}-day streak`,                                              nav: 'habits'    });
  if (appState.habits.length > 0)
    hlPool.push({ key: 'habits',    icon: <CheckCircle2 size={14} strokeWidth={2.5}/>, color: '#7B96B0', title: "Today's Habits",  value: `${ms.completedToday} of ${appState.habits.length} done`,                    nav: 'habits'    });
  if (stats.totalExpenses > 0)
    hlPool.push({ key: 'expenses',  icon: <TrendingUp size={14} strokeWidth={2.5}/>,   color: '#C9935A', title: 'This Month',      value: `${fmt(ms.monthlySpent)} spent`,                                              nav: 'expenses'  });
  if (stats.totalFocusSessions > 0)
    hlPool.push({ key: 'focus',     icon: <Clock size={14} strokeWidth={2.5}/>,        color: '#B78E79', title: 'Focus Sessions',  value: `${stats.totalFocusSessions} total`,                                          nav: 'focus'     });
  if (stats.totalNotes > 0)
    hlPool.push({ key: 'notes',     icon: <FileText size={14} strokeWidth={2.5}/>,     color: '#919F90', title: 'Notes',           value: `${stats.totalNotes} note${stats.totalNotes !== 1 ? 's' : ''} written`,       nav: 'notes'     });
  if (todayMood)
    hlPool.push({ key: 'mood',      icon: <Smile size={14} strokeWidth={2.5}/>,        color: '#C17B8E', title: "Today's Mood",    value: `${moodEmojis[todayMood.mood]} Feeling ${moodLabels[todayMood.mood]}`,        nav: 'mood'      });
  if ((appState.breathingSessions?.length ?? 0) > 0) {
    const bc = appState.breathingSessions?.length ?? 0;
    hlPool.push({ key: 'breathing', icon: <Wind size={14} strokeWidth={2.5}/>,         color: '#6E9E8A', title: 'Breathing',       value: `${bc} session${bc !== 1 ? 's' : ''} total`,                                  nav: 'breathing' });
  }
  if (appState.savedCounts.length > 0) {
    const top = [...appState.savedCounts].sort((a, b) => b.value - a.value)[0];
    hlPool.push({ key: 'counter',   icon: <Hash size={14} strokeWidth={2.5}/>,         color: '#4C6E8A', title: top.label,         value: `${top.value.toLocaleString()} counted`,                                      nav: 'counter'   });
  }
  if (ms.activeReminders > 0)
    hlPool.push({ key: 'remind',    icon: <Bell size={14} strokeWidth={2.5}/>,         color: '#9F8ABD', title: 'Reminders',       value: `${ms.activeReminders} active`,                                               nav: 'reminders' });

  // Shuffle with seeded hash and show up to 4
  const highlights = [...hlPool].sort((a, b) => hlScore(a.key) - hlScore(b.key)).slice(0, 4);

  const todayJournalLog = appState.journalLogs?.find(l => l.date === todayKey);
  const moduleValues: Record<string, string> = {
    habits: appState.habits.length === 0 ? 'No habits yet' : `${ms.completedToday}/${appState.habits.length} today`,
    expenses: appState.expenses.length === 0 ? 'No expenses yet' : fmt(ms.monthlySpent),
    notes: appState.notes.length === 0 ? 'No notes yet' : `${appState.notes.length} note${appState.notes.length !== 1 ? 's' : ''}`,
    focus: ms.todayFocus > 0 ? `${ms.todayFocus} today` : `${stats.totalFocusSessions} total`,
    counter: appState.savedCounts.length === 0 ? 'Nothing counted' : `${appState.savedCounts.length} saved`,
    reminders: appState.reminders.length === 0 ? 'No reminders' : `${ms.activeReminders} active`,
    mood: todayMood ? `${moodEmojis[todayMood.mood]} logged today` : 'Log today\'s mood',
    breathing: todayBreathing > 0 ? `${todayBreathing} session${todayBreathing !== 1 ? 's' : ''} today` : `${appState.breathingSessions?.length ?? 0} total`,
    journal: todayJournalLog && todayJournalLog.completedIds.length > 0
      ? todayJournalLog.completionPct === 100 ? '🎉 Perfect day!' : `${todayJournalLog.completionPct}% complete`
      : 'Start today\'s check-in',
  };
  const moduleProgress: Record<string, number | undefined> = {
    habits: appState.habits.length > 0 ? ms.habitPct : undefined,
  };

  return (
    <div ref={containerRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
      style={{ minHeight: '100dvh', background: 'var(--background)', position: 'relative', overflow: 'hidden' }}>

      {/* ── Pull-to-refresh indicator ── */}
      <AnimatePresence>
        {(pullY > 6 || refreshing) && (
          <motion.div
            key="ptr"
            initial={{ opacity: 0, y: -32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -32 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            style={{
              position: 'fixed',
              top: 'calc(env(safe-area-inset-top,0px) + 0.625rem)',
              left: 0, right: 0, zIndex: 50,
              display: 'flex', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 999, padding: '0.375rem 0.875rem',
              boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
              opacity: refreshing ? 1 : pullY / PULL_THRESHOLD,
            }}>
              <motion.div
                animate={refreshing ? { rotate: 360 } : { rotate: (pullY / PULL_THRESHOLD) * 180 }}
                transition={refreshing ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : { duration: 0 }}>
                <RefreshCw size={14} color="var(--primary)" strokeWidth={2.5} />
              </motion.div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', fontFamily: "'Rubik', sans-serif" }}>
                {refreshing ? 'Syncing…' : 'Pull to refresh'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="dot-bg" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.35 }} />

      <div style={{ position: 'relative', zIndex: 1, paddingBottom: '1.5rem' }}>
        {/* ── Header ── */}
        <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22,1,0.36,1] }}
          style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 3.25rem)', paddingLeft: '1.25rem', paddingRight: '1.25rem', paddingBottom: '0.875rem', maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.3rem' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
                {greet()},&nbsp;<span style={{ color: 'var(--primary)' }}>{appState.userProfile.name}</span>
              </h1>
            </div>
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate('account')}
              style={{ flexShrink: 0, width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--primary-border)', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 44, boxShadow: '0 2px 12px var(--primary-pale)' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer"/>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              )}
            </motion.button>
          </div>

          {/* Status chips */}
          {hasContent && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', marginTop: '0.875rem', scrollbarWidth: 'none' }}>
              {stats.longestStreak >= 3 && (
                <Chip icon={<Flame size={11} strokeWidth={2.5}/>} label={`${stats.longestStreak}d streak`} style={{ background: 'rgba(201,147,90,0.12)', border: '1px solid rgba(201,147,90,0.28)', color: '#A07038' }}/>
              )}
              {ms.habitPct === 100 && appState.habits.length > 0 && (
                <Chip icon={<CheckCircle2 size={11} strokeWidth={2.5}/>} label="All done today!" style={{ background: 'rgba(145,159,144,0.12)', border: '1px solid rgba(145,159,144,0.28)', color: '#5A7259' }}/>
              )}
              {ms.overBudgetCount > 0 && (
                <Chip icon={<AlertTriangle size={11} strokeWidth={2.5}/>} label={`${ms.overBudgetCount} over budget`} style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.22)', color: 'var(--destructive)' }}/>
              )}
              <Chip icon={<Star size={11} strokeWidth={2.5}/>} label={levelName} style={{ background: 'var(--primary-pale)', border: '1px solid var(--primary-border)', color: 'var(--primary-dark)' }}/>
            </motion.div>
          )}
        </motion.header>

        <div style={{ maxWidth: 600, margin: '0 auto', paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>

          {/* Weather / section header */}
          <div style={{ marginBottom: '0.75rem', minHeight: '1.25rem' }}>
            {weather.status === 'ok' ? (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {weather.temp}°C
                </span>
                {weather.city ? (
                  <>
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted-foreground)', opacity: 0.4, flexShrink: 0 }}/>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>{weather.city}</span>
                  </>
                ) : null}
              </motion.div>
            ) : (
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
                Modules
              </p>
            )}
          </div>

          {/* ── ROW 1: Habits (featured full-width with progress) + Focus ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '5fr 3fr', gap: '0.625rem', marginBottom: '0.625rem' }}>
            <HeroCard mod={MODULES[0]} value={moduleValues.habits} progress={moduleProgress.habits}
              badge={ms.completedToday > 0 ? `${ms.completedToday} done` : undefined}
              onClick={() => navigate('habits')} delay={0.08}/>
            <TallCard mod={MODULES[3]} value={moduleValues.focus} onClick={() => navigate('focus')} delay={0.12}/>
          </div>

          {/* ── ROW 2: Expenses (full-width color card) ── */}
          <div style={{ marginBottom: '0.625rem' }}>
            <WideCard mod={MODULES[1]} value={moduleValues.expenses} warn={ms.overBudgetCount > 0}
              extra={ms.overBudgetCount > 0 ? `${ms.overBudgetCount} over budget` : undefined}
              onClick={() => navigate('expenses')} delay={0.16}/>
          </div>

          {/* ── ROW 3: Notes (50%) + Counter (50%) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>
            <MedCard mod={MODULES[2]} value={moduleValues.notes} onClick={() => navigate('notes')} delay={0.20}/>
            <MedCard mod={MODULES[4]} value={moduleValues.counter} onClick={() => navigate('counter')} delay={0.24}/>
          </div>

          {/* ── ROW 4: Reminders (full-width) ── */}
          <div style={{ marginBottom: '0.625rem' }}>
            <BannerCard mod={MODULES[5]} value={moduleValues.reminders} onClick={() => navigate('reminders')} delay={0.28}/>
          </div>

          {/* ── ROW 5: Mood + Breathing ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>
            <MedCard mod={MODULES[6]} value={moduleValues.mood} onClick={() => navigate('mood')} delay={0.32}/>
            <MedCard mod={MODULES[7]} value={moduleValues.breathing} onClick={() => navigate('breathing')} delay={0.36}/>
          </div>

          {/* ── ROW 6: Journal (full-width banner) ── */}
          <div style={{ marginBottom: '1.375rem' }}>
            <BannerCard mod={MODULES[8]} value={moduleValues.journal} onClick={() => navigate('journal')} delay={0.40}/>
          </div>

          {/* ── Highlights (randomised each session from full pool) ── */}
          <AnimatePresence>
            {hasContent && highlights.length > 0 && (
              <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }}>
                <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.625rem' }}>
                  Highlights
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {highlights.map(h => (
                    <HRow key={h.key} icon={h.icon} color={h.color} title={h.title} value={h.value} onClick={() => navigate(h.nav)}/>
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* ── Daily motivational quote (shown when no content yet) ── */}
          {!hasContent && <DailyQuote />}
        </div>
      </div>
    </div>
  );
}

// ── Daily Motivational Quote ──────────────────────────────────
const QUOTES = [
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Small daily improvements are the key to staggering long-term results.', author: 'Robin Sharma' },
  { text: 'You don\'t have to be great to start, but you have to start to be great.', author: 'Zig Ziglar' },
  { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Your future is created by what you do today, not tomorrow.', author: 'Robert Kiyosaki' },
  { text: 'Energy and persistence conquer all things.', author: 'Benjamin Franklin' },
  { text: 'The harder you work for something, the greater you\'ll feel when you achieve it.', author: 'Anonymous' },
  { text: 'Don\'t watch the clock; do what it does. Keep going.', author: 'Sam Levenson' },
  { text: 'Believe you can and you\'re halfway there.', author: 'Theodore Roosevelt' },
  { text: 'Push yourself, because no one else is going to do it for you.', author: 'Anonymous' },
  { text: 'Great things never come from comfort zones.', author: 'Anonymous' },
];

function DailyQuote() {
  const [q] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
      style={{ marginTop: '0.5rem', padding: '1.75rem 1.5rem 2rem', textAlign: 'center', position: 'relative' }}>
      {/* Large decorative quote mark */}
      <div style={{ fontSize: '5rem', lineHeight: 0.8, color: 'var(--primary)', opacity: 0.18, fontFamily: 'Georgia, serif', userSelect: 'none', marginBottom: '0.75rem' }}>"</div>
      <p style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.65, letterSpacing: '-0.01em', maxWidth: '20rem', margin: '0 auto 1rem' }}>
        {q.text}
      </p>
      <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
        — {q.author}
      </p>
      {/* Subtle bottom hint */}
      <p style={{ marginTop: '1.75rem', fontSize: '0.8125rem', color: 'var(--muted-foreground)', opacity: 0.7 }}>
        Tap any module above to begin your journey.
      </p>
    </motion.div>
  );
}

// ── Card Variants ─────────────────────────────────────────────
type Mod = typeof MODULES[number];

// Hero: wide card with large typography, progress bar
function HeroCard({ mod, value, progress, badge, onClick, delay }: {
  mod: Mod; value: string; progress?: number; badge?: string; onClick: () => void; delay: number;
}) {
  const Icon = mod.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 200, damping: 24 }}
      whileTap={{ scale: 0.965 }} onClick={onClick}
      style={{ borderRadius: '1.25rem', background: mod.cardBg, border: `1px solid ${mod.border}`, padding: '1.25rem', cursor: 'pointer', position: 'relative', overflow: 'hidden', minHeight: 148,
        boxShadow: mod.dark ? '0 8px 28px rgba(30,35,41,0.22)' : '0 4px 16px rgba(65,71,81,0.08)' }}>
      {/* Decorative glow blob */}
      <div style={{ position: 'absolute', top: -24, right: -24, width: 88, height: 88, borderRadius: '50%', background: mod.iconBg, opacity: 0.18, filter: 'blur(18px)', pointerEvents: 'none' }}/>
      {/* Grid texture overlay */}
      {mod.dark && <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none', borderRadius: '1.25rem' }}/>}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: '0.75rem', background: mod.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${mod.iconBg}50` }}>
            <Icon size={20} color="white" strokeWidth={2.5}/>
          </div>
          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
            {badge && <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 99, padding: '2px 9px', fontSize: '0.625rem', fontWeight: 700, color: mod.textColor }}>{badge}</div>}
            <ArrowUpRight size={14} color={mod.subColor} strokeWidth={2.5}/>
          </div>
        </div>
        <p style={{ fontSize: '1.0625rem', fontWeight: 700, color: mod.textColor, marginBottom: '0.2rem', letterSpacing: '-0.01em' }}>{mod.title}</p>
        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: mod.subColor, lineHeight: 1.3, flex: 1 }}>{value}</p>
        {progress !== undefined && (
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: mod.subColor, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Progress</span>
              <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: mod.textColor }}>{progress}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 99, background: mod.dark ? 'rgba(255,255,255,0.15)' : `${mod.iconBg}22`, overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1.0, delay: delay + 0.25, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: 99, background: mod.dark ? 'white' : mod.iconBg }}/>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Tall: taller compact card for secondary info
function TallCard({ mod, value, onClick, delay }: {
  mod: Mod; value: string; onClick: () => void; delay: number;
}) {
  const Icon = mod.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 200, damping: 24 }}
      whileTap={{ scale: 0.965 }} onClick={onClick}
      style={{ borderRadius: '1.25rem', background: mod.cardBg, border: `1px solid ${mod.border}`, padding: '1.25rem 1rem', cursor: 'pointer', position: 'relative', overflow: 'hidden', minHeight: 148, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        boxShadow: mod.dark ? '0 8px 28px rgba(30,35,41,0.22)' : '0 4px 16px rgba(65,71,81,0.08)' }}>
      <div style={{ position: 'absolute', bottom: -16, left: -16, width: 64, height: 64, borderRadius: '50%', background: mod.iconBg, opacity: 0.16, filter: 'blur(14px)', pointerEvents: 'none' }}/>
      {mod.dark && <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '16px 16px', pointerEvents: 'none', borderRadius: '1.25rem' }}/>}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ width: 40, height: 40, borderRadius: '0.75rem', background: mod.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', boxShadow: `0 4px 14px ${mod.iconBg}50` }}>
          <Icon size={20} color="white" strokeWidth={2.5}/>
        </div>
        <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: mod.textColor, marginBottom: '0.25rem', letterSpacing: '-0.01em' }}>{mod.title}</p>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: mod.subColor, lineHeight: 1.3 }}>{value}</p>
      </div>
      <ArrowUpRight size={13} color={mod.subColor} strokeWidth={2.5} style={{ position: 'relative', zIndex: 1, alignSelf: 'flex-end' }}/>
    </motion.div>
  );
}

// Wide: full-width colored card (Expenses)
function WideCard({ mod, value, warn, extra, onClick, delay }: {
  mod: Mod; value: string; warn?: boolean; extra?: string; onClick: () => void; delay: number;
}) {
  const Icon = mod.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 200, damping: 24 }}
      whileTap={{ scale: 0.98 }} onClick={onClick}
      style={{ borderRadius: '1.25rem', background: mod.cardBg, border: `1px solid ${mod.border}`, padding: '1.25rem', cursor: 'pointer', position: 'relative', overflow: 'hidden', minHeight: 84,
        boxShadow: '0 8px 28px rgba(201,147,90,0.35)' }}>
      {/* Big decorative circle */}
      <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', top: -10, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }}/>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: 40, height: 40, borderRadius: '0.75rem', background: mod.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={20} color="white" strokeWidth={2.5}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: mod.subColor, marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{mod.title}</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: mod.textColor, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</p>
          {extra && <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: warn ? '#FFCCCC' : mod.subColor, marginTop: '0.25rem' }}>{extra}</p>}
        </div>
        <ArrowUpRight size={16} color={mod.subColor} strokeWidth={2.5} style={{ flexShrink: 0 }}/>
      </div>
    </motion.div>
  );
}

// Med: medium-sized card for 2-column row
function MedCard({ mod, value, onClick, delay }: {
  mod: Mod; value: string; onClick: () => void; delay: number;
}) {
  const Icon = mod.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 200, damping: 24 }}
      whileTap={{ scale: 0.965 }} onClick={onClick}
      style={{ borderRadius: '1.125rem', background: mod.cardBg, border: `1px solid ${mod.border}`, padding: '1rem', cursor: 'pointer', position: 'relative', overflow: 'hidden', minHeight: 110,
        boxShadow: mod.dark ? '0 8px 28px rgba(30,35,41,0.26)' : '0 3px 12px rgba(65,71,81,0.07)' }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 70, height: 70, borderRadius: '50%', background: mod.dark ? 'rgba(255,255,255,0.15)' : mod.iconBg, opacity: mod.dark ? 0.22 : 0.14, filter: 'blur(16px)', pointerEvents: 'none' }}/>
      {mod.dark && <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '16px 16px', pointerEvents: 'none', borderRadius: '1.125rem' }}/>}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ width: 40, height: 40, borderRadius: '0.75rem', background: mod.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.625rem', boxShadow: `0 4px 14px ${mod.iconBg}50` }}>
          <Icon size={20} color="white" strokeWidth={2.5}/>
        </div>
        <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: mod.textColor, marginBottom: '0.2rem', letterSpacing: '-0.01em' }}>{mod.title}</p>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: mod.subColor, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{value}</p>
      </div>
    </motion.div>
  );
}

// Banner: horizontal full-width card (Reminders)
function BannerCard({ mod, value, onClick, delay }: {
  mod: Mod; value: string; onClick: () => void; delay: number;
}) {
  const Icon = mod.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 200, damping: 24 }}
      whileTap={{ scale: 0.98 }} onClick={onClick}
      style={{ borderRadius: '1.25rem', background: mod.cardBg, border: `1px solid ${mod.border}`, padding: '1rem 1.25rem', cursor: 'pointer', position: 'relative', overflow: 'hidden', minHeight: 72,
        boxShadow: '0 8px 28px rgba(159,138,189,0.35)' }}>
      <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }}/>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
        <div style={{ width: 40, height: 40, borderRadius: '0.75rem', background: mod.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={20} color="white" strokeWidth={2.5}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: mod.textColor, letterSpacing: '-0.01em' }}>{mod.title}</p>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: mod.subColor }}>{value}</p>
        </div>
        <ArrowUpRight size={15} color={mod.subColor} strokeWidth={2.5} style={{ flexShrink: 0 }}/>
      </div>
    </motion.div>
  );
}

function Chip({ icon, label, style }: { icon: React.ReactNode; label: string; style: React.CSSProperties }) {
  return (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.7rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, ...style }}>
      {icon}<span>{label}</span>
    </div>
  );
}

function HRow({ icon, color, title, value, onClick }: { icon: React.ReactNode; color: string; title: string; value: string; onClick: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.984 }} onClick={onClick}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', borderRadius: '1rem', background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', minHeight: 44, boxShadow: 'var(--shadow-xs)' }}>
      <div style={{ width: 34, height: 34, borderRadius: '0.5625rem', flexShrink: 0, background: `${color}16`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 2 }}>{title}</p>
        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{value}</p>
      </div>
      <ChevronRight size={13} color="var(--muted-foreground)" strokeWidth={2.5} style={{ flexShrink: 0 }}/>
    </motion.button>
  );
}
