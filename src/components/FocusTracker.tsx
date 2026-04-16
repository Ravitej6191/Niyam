import { hapticTap, hapticSuccess, hapticError } from '../utils/haptic';
import { App } from '@capacitor/app';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ArrowLeft, Headphones, Play, Pause, Square, Clock, Zap, X } from 'lucide-react';
import type { FocusSession } from '../App';

const FOCUS_COLOR = '#B78E79';

interface FocusTrackerProps {
  sessions: FocusSession[];
  onUpdate: (sessions: FocusSession[]) => void;
  onBack: () => void;
}

type View = 'home' | 'timer';
type TimerState = 'idle' | 'running' | 'paused' | 'completed';

// Persisted across app close so elapsed time survives background kills
const FOCUS_DRAFT_KEY = 'niyam-focus-draft';
interface FocusDraft {
  startMs: number;
  pausedMs: number;       // Accumulated ms paused (excluding any ongoing pause)
  pauseStartMs?: number;  // Set when paused, so recovery knows a pause was in progress
  totalSec: number;
  label: string;
}

const PRESETS = [
  { label: '25 min', minutes: 25, desc: 'Pomodoro' },
  { label: '45 min', minutes: 45, desc: 'Deep Work' },
  { label: '60 min', minutes: 60, desc: 'Flow State' },
  { label: '90 min', minutes: 90, desc: 'Ultra Focus' },
];

function fmtTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}
function fmtDur(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function FocusTracker({ sessions, onUpdate, onBack }: FocusTrackerProps) {
  const [view, setView]                 = useState<View>('home');
  const [selectedMin, setSelectedMin]   = useState(25);
  const [customMin, setCustomMin]       = useState('');
  const [timerState, setTimerState]     = useState<TimerState>('idle');
  const [secondsLeft, setSecondsLeft]   = useState(25 * 60);
  const [totalSec, setTotalSec]         = useState(25 * 60);
  const [sessionLabel, setSessionLabel] = useState('Focus Session');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [customMinErr, setCustomMinErr] = useState('');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionsRef = useRef(sessions);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

  // Always-current refs — used by interval completion handler and Capacitor back button
  const sessionLabelRef = useRef(sessionLabel);
  useEffect(() => { sessionLabelRef.current = sessionLabel; }, [sessionLabel]);
  const totalSecRef     = useRef(totalSec);
  useEffect(() => { totalSecRef.current = totalSec; }, [totalSec]);
  const onUpdateRef     = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; });
  const viewRef         = useRef<View>('home');
  useEffect(() => { viewRef.current = view; }, [view]);
  const timerStateRef   = useRef<TimerState>('idle');
  useEffect(() => { timerStateRef.current = timerState; }, [timerState]);

  // Elapsed-time tracking refs — survive re-renders, reset on startTimer/stopTimer
  const startMsRef    = useRef(0);   // wall-clock ms when timer started
  const pauseStartRef = useRef(0);   // wall-clock ms when current pause began (0 = not paused)
  const pausedMsRef   = useRef(0);   // total accumulated paused ms (excl. current pause)

  // ── Derived stats ───────────────────────────────────────────────────────────
  const todayKey        = new Date().toISOString().split('T')[0];
  const todaySessions   = sessions.filter(s => s.completedAt.startsWith(todayKey) && s.type === 'focus');
  const totalTodayMin   = todaySessions.reduce((s, f) => s + f.durationMinutes, 0);
  const totalAllTimeMin = sessions.filter(s => s.type === 'focus').reduce((s, f) => s + f.durationMinutes, 0);
  const recent = [...sessions]
    .filter(s => s.type === 'focus')
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 8);

  // ── On mount: recover any session that was running when app was killed ──────
  useEffect(() => {
    const raw = localStorage.getItem(FOCUS_DRAFT_KEY);
    if (!raw) return;
    try {
      const draft: FocusDraft = JSON.parse(raw);
      // If app closed while paused, treat all pause time (including final pause) as paused
      let totalPausedMs = draft.pausedMs;
      if (draft.pauseStartMs) {
        totalPausedMs += Date.now() - draft.pauseStartMs;
      }
      const elapsedMs  = Date.now() - draft.startMs - totalPausedMs;
      const elapsedMin = Math.floor(elapsedMs / 60000);
      const cappedMin  = Math.min(Math.max(elapsedMin, 0), Math.round(draft.totalSec / 60));
      if (cappedMin >= 1) {
        const recovered: FocusSession = {
          id: Date.now().toString(),
          label: draft.label,
          durationMinutes: cappedMin,
          completedAt: new Date().toISOString(),
          type: 'focus',
        };
        onUpdateRef.current([recovered, ...sessionsRef.current]);
        toast.success(`Recovered ${fmtDur(cappedMin)} focus session`);
      }
    } catch { /* ignore corrupt draft */ }
    localStorage.removeItem(FOCUS_DRAFT_KEY);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Countdown — pure updater with no side effects inside ────────────────────
  useEffect(() => {
    if (timerState === 'running') {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setTimerState('completed');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerState]);

  // ── Save session on completion (separate from updater to avoid double-fires) ─
  useEffect(() => {
    if (timerState !== 'completed') return;
    localStorage.removeItem(FOCUS_DRAFT_KEY); // full session saved below — no need to recover
    const newSession: FocusSession = {
      id: Date.now().toString(),
      label: sessionLabelRef.current,
      durationMinutes: Math.round(totalSecRef.current / 60),
      completedAt: new Date().toISOString(),
      type: 'focus',
    };
    onUpdateRef.current([newSession, ...sessionsRef.current]);
    hapticSuccess();
    toast.success('Focus session complete! +5 XP');
  }, [timerState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer controls ──────────────────────────────────────────────────────────
  const startTimer = () => {
    const mins = customMin ? parseInt(customMin, 10) : selectedMin;
    if (!mins || mins < 1 || mins > 300) { hapticError(); toast.error('Pick a valid duration (1–300 min)'); return; }
    const label   = sessionLabel.trim() || 'Focus Session';
    if (label !== sessionLabel) setSessionLabel(label);
    const sec     = mins * 60;
    const startMs = Date.now();
    setTotalSec(sec);
    setSecondsLeft(sec);
    // Reset pause tracking
    startMsRef.current    = startMs;
    pauseStartRef.current = 0;
    pausedMsRef.current   = 0;
    // Persist draft so app-close recovery can save elapsed time
    const draft: FocusDraft = { startMs, pausedMs: 0, totalSec: sec, label };
    localStorage.setItem(FOCUS_DRAFT_KEY, JSON.stringify(draft));
    hapticTap();
    setTimerState('running');
    setView('timer');
  };

  const pauseResume = () => {
    hapticTap();
    const now = Date.now();
    if (timerStateRef.current === 'running') {
      // Pausing — record when pause started so recovery can account for it
      pauseStartRef.current = now;
      try {
        const raw = localStorage.getItem(FOCUS_DRAFT_KEY);
        if (raw) {
          const draft: FocusDraft = JSON.parse(raw);
          draft.pauseStartMs = now;
          localStorage.setItem(FOCUS_DRAFT_KEY, JSON.stringify(draft));
        }
      } catch { /* ignore */ }
      setTimerState('paused');
    } else {
      // Resuming — accumulate the pause duration
      if (pauseStartRef.current > 0) {
        pausedMsRef.current += now - pauseStartRef.current;
        pauseStartRef.current = 0;
      }
      try {
        const raw = localStorage.getItem(FOCUS_DRAFT_KEY);
        if (raw) {
          const draft: FocusDraft = JSON.parse(raw);
          draft.pausedMs = pausedMsRef.current;
          delete draft.pauseStartMs;
          localStorage.setItem(FOCUS_DRAFT_KEY, JSON.stringify(draft));
        }
      } catch { /* ignore */ }
      setTimerState('running');
    }
  };

  const stopTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    // ── Save partial session if at least 1 minute was actually focused ──────
    if (startMsRef.current > 0) {
      try {
        const raw = localStorage.getItem(FOCUS_DRAFT_KEY);
        if (raw) {
          const draft: FocusDraft = JSON.parse(raw);
          // Add any ongoing pause duration
          let currentPausedMs = pausedMsRef.current;
          if (pauseStartRef.current > 0) {
            currentPausedMs += Date.now() - pauseStartRef.current;
          }
          const elapsedMs  = Date.now() - startMsRef.current - currentPausedMs;
          const elapsedMin = Math.floor(elapsedMs / 60000);
          const cappedMin  = Math.min(Math.max(elapsedMin, 0), Math.round(draft.totalSec / 60));
          if (cappedMin >= 1) {
            const partial: FocusSession = {
              id: Date.now().toString(),
              label: draft.label,
              durationMinutes: cappedMin,
              completedAt: new Date().toISOString(),
              type: 'focus',
            };
            onUpdateRef.current([partial, ...sessionsRef.current]);
            hapticSuccess();
            toast.success(`Saved ${fmtDur(cappedMin)} focus session`);
          }
        }
      } catch { /* ignore */ }
    }
    localStorage.removeItem(FOCUS_DRAFT_KEY);
    startMsRef.current    = 0;
    pauseStartRef.current = 0;
    pausedMsRef.current   = 0;
    setTimerState('idle');
    setView('home');
    setSecondsLeft(totalSec); // reset display to planned duration
    setShowExitConfirm(false);
  };

  // Back from timer — if running/paused, show confirmation
  const handleTimerBack = () => {
    if (timerState === 'completed') {
      stopTimer();
    } else if (timerState === 'running' || timerState === 'paused') {
      hapticTap();
      setShowExitConfirm(true);
    } else {
      stopTimer();
    }
  };

  // ── Hardware back button ─────────────────────────────────────────────────────
  const _backRef = useRef<() => void>(() => {});
  useEffect(() => {
    _backRef.current = () => {
      viewRef.current === 'timer' ? handleTimerBack() : onBack();
    };
  });
  useEffect(() => {
    let rm: (() => void) | undefined;
    App.addListener('backButton', () => _backRef.current())
      .then(h => { rm = () => h.remove(); });
    return () => rm?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── App foreground/background handling ──────────────────────────────────────
  // Android throttles setInterval in backgrounded WebViews, so when the app
  // returns to the foreground we recalculate secondsLeft from the actual wall
  // clock rather than trusting the (potentially lagged) interval count.
  useEffect(() => {
    let rm: (() => void) | undefined;
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return; // nothing to do on background
      if (timerStateRef.current !== 'running') return;
      if (startMsRef.current === 0) return;

      const currentPausedMs = pausedMsRef.current; // pauseStart==0 here (timer is running)
      const elapsedMs  = Date.now() - startMsRef.current - currentPausedMs;
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const remaining  = Math.max(0, totalSecRef.current - elapsedSec);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setTimerState('completed');
      }
    }).then(h => { rm = () => h.remove(); });
    return () => rm?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const progress   = totalSec > 0 ? ((totalSec - secondsLeft) / totalSec) * 100 : 0;
  const circ       = 2 * Math.PI * 90;
  const dashOffset = circ - (progress / 100) * circ;

  // ─── Timer view ──────────────────────────────────────────────────────────────
  if (view === 'timer') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--background)', fontFamily: "'Rubik', sans-serif" }}>
        <header style={{ padding: 'calc(env(safe-area-inset-top,0px) + 1rem) 1rem 0.875rem', flexShrink: 0 }}>
          <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <motion.button whileTap={{ scale: 0.88 }} onClick={handleTimerBack}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', borderRadius: '0.75rem', background: 'var(--muted)', border: 'none', cursor: 'pointer', minHeight: 44, color: 'var(--muted-foreground)', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 500 }}>
              <ArrowLeft size={15} strokeWidth={2} />
              Back
            </motion.button>
            <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--foreground)', maxWidth: '12rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{sessionLabel}</p>
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => { hapticTap(); setShowExitConfirm(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', borderRadius: '0.75rem', background: 'var(--muted)', border: 'none', cursor: 'pointer', minHeight: 44, color: 'var(--muted-foreground)', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 500 }}>
              <Square size={15} strokeWidth={2} />
              Stop
            </motion.button>
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem 4rem' }}>
          {/* Ring */}
          <div style={{ position: 'relative', marginBottom: '2.5rem' }}>
            <svg width="220" height="220" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
              <circle cx="110" cy="110" r="90" fill="none" stroke="var(--border)" strokeWidth="6" />
              <motion.circle
                cx="110" cy="110" r="90" fill="none"
                stroke={timerState === 'completed' ? 'var(--success)' : FOCUS_COLOR}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={circ}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: 0.4, ease: 'linear' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {timerState === 'completed' ? (
                <div style={{ textAlign: 'center' }}>
                  <Zap size={40} color="var(--success)" strokeWidth={1.5} style={{ display: 'block', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--success)' }}>Done!</p>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: '3.25rem', fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--foreground)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtTime(secondsLeft)}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 6, fontWeight: 400 }}>
                    {timerState === 'paused' ? 'Paused' : 'Remaining'}
                  </span>
                </>
              )}
            </div>
          </div>

          {timerState !== 'completed' ? (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={pauseResume}
              style={{ width: 72, height: 72, borderRadius: '50%', background: FOCUS_COLOR, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 24px rgba(183,142,121,0.38)' }}
            >
              {timerState === 'running'
                ? <Pause size={26} color="white" fill="white" strokeWidth={0} />
                : <Play  size={26} color="white" fill="white" strokeWidth={0} />
              }
            </motion.button>
          ) : (
            <motion.button
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.96 }} onClick={stopTimer}
              style={{ padding: '0.875rem 2rem', borderRadius: '0.875rem', background: FOCUS_COLOR, border: 'none', color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Back to Focus
            </motion.button>
          )}

          {timerState !== 'completed' && (
            <p style={{ marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
              {Math.round(progress)}% complete
            </p>
          )}
        </div>

        {/* Exit confirmation dialog */}
        <AnimatePresence>
          {showExitConfirm && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
              onClick={() => setShowExitConfirm(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }}
                onClick={e => e.stopPropagation()}
                style={{ background: 'var(--card)', borderRadius: '1.25rem', padding: '1.5rem', maxWidth: 320, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
              >
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <X size={22} color="#ef4444" strokeWidth={2} />
                </div>
                <h3 style={{ textAlign: 'center', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>Stop Session?</h3>
                <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  Time focused so far will be saved to your stats. Full sessions earn +5 XP.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowExitConfirm(false)}
                    style={{ flex: 1, height: 44, borderRadius: '0.75rem', background: 'var(--muted)', border: 'none', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', color: 'var(--foreground)', cursor: 'pointer' }}>
                    Keep Going
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={stopTimer}
                    style={{ flex: 1, height: 44, borderRadius: '0.75rem', background: '#ef4444', border: 'none', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', color: '#fff', cursor: 'pointer' }}>
                    Stop
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Home view ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', fontFamily: "'Rubik', sans-serif" }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--card)', borderBottom: '1px solid var(--border)',
        padding: 'calc(env(safe-area-inset-top,0px) + 1rem) 1rem 0.875rem',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <motion.button whileTap={{ scale: 0.88 }} onClick={onBack} aria-label="Go back"
            style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--muted)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 36 }}>
            <ArrowLeft size={18} color="var(--muted-foreground)" strokeWidth={2} />
          </motion.button>
          <div>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.1 }}>Focus</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
              {sessions.filter(s => s.type === 'focus').length} sessions total
            </p>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '1rem' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Today', value: fmtDur(totalTodayMin), sub: `${todaySessions.length} session${todaySessions.length !== 1 ? 's' : ''}` },
            { label: 'All Time', value: fmtDur(totalAllTimeMin), sub: `${sessions.filter(s => s.type === 'focus').length} sessions` },
          ].map(s => (
            <div key={s.label} style={{ borderRadius: '1rem', padding: '1rem', background: 'var(--card)', border: '1px solid var(--border)' }} className="card-sm">
              <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.25rem' }}>{s.label}</p>
              <p style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{s.value}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Session name */}
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.375rem' }}>Session Name</p>
          <input
            value={sessionLabel}
            onChange={e => setSessionLabel(e.target.value)}
            placeholder="e.g. Deep Work, Study, Writing…"
            maxLength={100}
            enterKeyHint="done"
            style={{ width: '100%', height: 48, padding: '0 1rem', borderRadius: '0.75rem', border: '1.5px solid var(--border)', background: 'var(--input-bg)', color: 'var(--foreground)', fontSize: '0.9375rem', fontFamily: 'inherit', outline: 'none' }}
          />
          <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', textAlign: 'right', marginTop: '0.25rem' }}>{sessionLabel.length}/100</p>
        </div>

        {/* Presets */}
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>Duration</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.625rem' }}>
            {PRESETS.map(p => {
              const active = selectedMin === p.minutes && !customMin;
              return (
                <motion.button key={p.minutes} whileTap={{ scale: 0.92 }}
                  onClick={() => { setSelectedMin(p.minutes); setCustomMin(''); }}
                  style={{
                    padding: '0.625rem 0', borderRadius: '0.75rem', border: `1.5px solid ${active ? FOCUS_COLOR : 'var(--border)'}`,
                    background: active ? FOCUS_COLOR : 'var(--card)', color: active ? '#fff' : 'var(--foreground)',
                    cursor: 'pointer', textAlign: 'center', minHeight: 44, fontFamily: 'inherit',
                    transition: 'all 0.15s ease',
                  }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.label}</div>
                  <div style={{ fontSize: '0.6875rem', opacity: 0.7, marginTop: 1 }}>{p.desc}</div>
                </motion.button>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <input
              type="number" inputMode="numeric" value={customMin}
              onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); if (v !== '' && parseInt(v) > 300) { setCustomMin('300'); setCustomMinErr('Max 300 minutes'); } else { setCustomMin(v); setCustomMinErr(''); } }}
              onKeyDown={e => ['-', 'e', 'E', '+', '.'].includes(e.key) && e.preventDefault()}
              placeholder="Custom minutes…"
              min={1} max={300} enterKeyHint="go"
              style={{ flex: 1, height: 44, padding: '0 1rem', borderRadius: '0.75rem', border: `1.5px solid ${customMinErr ? 'var(--destructive)' : customMin ? FOCUS_COLOR : 'var(--border)'}`, background: 'var(--input-bg)', color: 'var(--foreground)', fontSize: '0.9375rem', fontFamily: 'inherit', outline: 'none' }}
            />
            <span style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', fontWeight: 500, whiteSpace: 'nowrap' }}>min</span>
          </div>
          {customMinErr && <p style={{ fontSize: '0.75rem', color: 'var(--destructive)', marginTop: '0.375rem' }}>{customMinErr}</p>}
        </div>

        {/* Start button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={startTimer}
          style={{ width: '100%', height: 54, borderRadius: '0.875rem', background: FOCUS_COLOR, border: 'none', color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem', boxShadow: '0 4px 16px rgba(183,142,121,0.28)', fontFamily: 'inherit' }}
        >
          <Headphones size={20} strokeWidth={2} />
          Start Session
        </motion.button>

        {/* Recent */}
        {recent.length > 0 ? (
          <div>
            <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.625rem' }}>Recent Sessions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <AnimatePresence>
                {recent.map((s, i) => (
                  <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', borderRadius: '0.875rem', background: 'var(--card)', border: '1px solid var(--border)' }} className="card-sm">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '0.75rem', background: `${FOCUS_COLOR}16`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Headphones size={17} color={FOCUS_COLOR} strokeWidth={1.8} />
                      </div>
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--foreground)', lineHeight: 1.2 }}>{s.label}</p>
                        <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: 2 }}>
                          {new Date(s.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: FOCUS_COLOR }}>{fmtDur(s.durationMinutes)}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
            <div style={{ width: 64, height: 64, borderRadius: '1rem', background: `${FOCUS_COLOR}16`, border: `1px solid ${FOCUS_COLOR}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Clock size={28} color={FOCUS_COLOR} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>Nothing here yet</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Pick a duration and start your first session</p>
          </div>
        )}
      </main>
    </div>
  );
}
