import { hapticTap, hapticSuccess } from '../utils/haptic';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ArrowLeft, Wind } from 'lucide-react';
import type { BreathingSession } from '../App';

interface Props {
  sessions: BreathingSession[];
  onUpdate: (sessions: BreathingSession[]) => void;
  onBack: () => void;
}

const PRIMARY = '#6E9E8A';
const RUB: React.CSSProperties = { fontFamily: "'Rubik', sans-serif" };

type Pattern = 'box' | '478';
type PhaseLabel = 'Inhale' | 'Hold' | 'Exhale';

interface PhaseStep {
  label: PhaseLabel;
  duration: number; // seconds
  targetScale: number; // circle scale at end of this phase
}

const PATTERNS: Record<Pattern, { name: string; desc: string; color: string; phases: PhaseStep[]; totalRounds: number }> = {
  box: {
    name: 'Box',
    desc: '4-4-4-4 · Balance',
    color: '#6E9E8A',
    totalRounds: 6,
    phases: [
      { label: 'Inhale', duration: 4, targetScale: 1.0 },
      { label: 'Hold',   duration: 4, targetScale: 1.0 },
      { label: 'Exhale', duration: 4, targetScale: 0.35 },
      { label: 'Hold',   duration: 4, targetScale: 0.35 },
    ],
  },
  '478': {
    name: '4-7-8',
    desc: '4-7-8 · Calm & Sleep',
    color: '#7B96B0',
    totalRounds: 4,
    phases: [
      { label: 'Inhale', duration: 4, targetScale: 1.0 },
      { label: 'Hold',   duration: 7, targetScale: 1.0 },
      { label: 'Exhale', duration: 8, targetScale: 0.35 },
    ],
  },
};

function fmtDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function getPatternTotalSec(p: Pattern) {
  const pat = PATTERNS[p];
  return pat.phases.reduce((s, ph) => s + ph.duration, 0) * pat.totalRounds;
}

export default function BreathingExercise({ sessions, onUpdate, onBack }: Props) {
  const [pattern, setPattern] = useState<Pattern>('box');
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [round, setRound] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [done, setDone] = useState(false);
  const [circleScale, setCircleScale] = useState(0.35);
  const [circleTransition, setCircleTransition] = useState({ duration: 0.5, ease: 'linear' as const });
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const patternRef   = useRef(pattern);
  const phaseRef     = useRef(phaseIdx);
  const roundRef     = useRef(round);
  const countRef     = useRef(countdown);
  const onUpdateRef  = useRef(onUpdate);
  const sessionsRef  = useRef(sessions);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

  useEffect(() => { patternRef.current = pattern; }, [pattern]);
  useEffect(() => { phaseRef.current = phaseIdx; }, [phaseIdx]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { countRef.current = countdown; }, [countdown]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const advanceToPhase = useCallback((pat: Pattern, pIdx: number) => {
    hapticTap();
    const step = PATTERNS[pat].phases[pIdx];
    setPhaseIdx(pIdx);
    setCountdown(step.duration);
    setCircleScale(step.targetScale);
    setCircleTransition({ duration: step.duration, ease: 'linear' });
  }, []);

  const start = useCallback(() => {
    hapticTap();
    setDone(false);
    setRound(0);
    advanceToPhase(pattern, 0);
    setRunning(true);
  }, [pattern, advanceToPhase]);

  const stop = useCallback(() => {
    clearTimer();
    setRunning(false);
    setPhaseIdx(0);
    setRound(0);
    setCountdown(0);
    setCircleScale(0.35);
    setCircleTransition({ duration: 0.6, ease: 'linear' });
    setDone(false);
  }, [clearTimer]);

  // Countdown tick
  useEffect(() => {
    if (!running) return;
    clearTimer();
    intervalRef.current = setInterval(() => {
      const newCount = countRef.current - 1;
      if (newCount > 0) {
        setCountdown(newCount);
      } else {
        // Advance phase
        const pat = patternRef.current;
        const phases = PATTERNS[pat].phases;
        const nextPhaseIdx = phaseRef.current + 1;
        if (nextPhaseIdx >= phases.length) {
          // Round completed
          const nextRound = roundRef.current + 1;
          if (nextRound >= PATTERNS[pat].totalRounds) {
            // All done
            clearTimer();
            setRunning(false);
            setDone(true);
            setCircleScale(0.35);
            setCircleTransition({ duration: 1.5, ease: 'linear' });
            hapticSuccess();
            // Save session — use refs to avoid stale closure
            const sess: BreathingSession = {
              id: Date.now().toString(),
              pattern: pat,
              rounds: PATTERNS[pat].totalRounds,
              completedAt: new Date().toISOString(),
            };
            onUpdateRef.current([...sessionsRef.current, sess]);
            toast.success(`+3 XP — ${PATTERNS[pat].name} breathing complete!`);
          } else {
            setRound(nextRound);
            roundRef.current = nextRound;
            advanceToPhase(pat, 0);
          }
        } else {
          advanceToPhase(pat, nextPhaseIdx);
        }
      }
    }, 1000);
    return () => clearTimer();
  }, [running, clearTimer, advanceToPhase]);


  const pat = PATTERNS[pattern];
  const currentPhase = pat.phases[phaseIdx];
  const totalSessions = sessions.length;
  const todaySessions = sessions.filter(s => s.completedAt.startsWith(new Date().toISOString().split('T')[0])).length;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', ...RUB }}>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--card)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)', padding: 'calc(env(safe-area-inset-top,0px) + 1rem) 1rem 0.875rem' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => { if (running) { setShowExitConfirm(true); } else { stop(); onBack(); } }} aria-label="Go back"
              style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--muted)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 36 }}>
              <ArrowLeft size={18} color="var(--muted-foreground)" strokeWidth={2}/>
            </motion.button>
            <div>
              <h1 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.1 }}>Breathing</h1>
              <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{totalSessions} total · {todaySessions} today</p>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '1rem 1rem 2rem' }}>

        {/* Pattern picker */}
        {!running && !done && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {(Object.keys(PATTERNS) as Pattern[]).map(p => {
              const isActive = pattern === p;
              const pc = PATTERNS[p].color;
              return (
                <motion.button key={p} whileTap={{ scale: 0.96 }}
                  onClick={() => { hapticTap(); setPattern(p); }}
                  style={{ flex: 1, padding: '0.875rem 0.75rem', borderRadius: '1rem', border: `2px solid ${isActive ? pc : 'var(--border)'}`, background: isActive ? `${pc}12` : 'var(--card)', cursor: 'pointer', textAlign: 'left', boxShadow: isActive ? `0 0 0 3px ${pc}20` : 'none', transition: 'all 0.18s' }}>
                  <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: isActive ? pc : 'var(--foreground)', marginBottom: 2 }}>{PATTERNS[p].name}</p>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{PATTERNS[p].desc}</p>
                  <p style={{ fontSize: '0.625rem', color: isActive ? pc : 'var(--muted-foreground)', marginTop: 4, fontWeight: 600 }}>{PATTERNS[p].totalRounds} rounds · {fmtDuration(getPatternTotalSec(p))}</p>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Main animation area */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 0 1.5rem', position: 'relative' }}>

          {/* Outer glow ring */}
          <div style={{ position: 'relative', width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

            {/* Background ring */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${pat.color}22` }}/>

            {/* Animated breathing circle */}
            <motion.div
              animate={{ scale: circleScale, opacity: running || done ? 1 : 0.6 }}
              transition={circleTransition}
              style={{ width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${pat.color}55 0%, ${pat.color}18 70%, transparent 100%)`, border: `3px solid ${pat.color}88`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {/* Inner circle */}
              <div style={{ width: 100, height: 100, borderRadius: '50%', background: `radial-gradient(circle, ${pat.color}40 0%, ${pat.color}15 100%)`, border: `2px solid ${pat.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.125rem' }}>
                {running && (
                  <>
                    <p style={{ fontSize: '1.75rem', fontWeight: 800, color: pat.color, lineHeight: 1, letterSpacing: '-0.04em' }}>{countdown}</p>
                  </>
                )}
                {done && <p style={{ fontSize: '1.5rem' }}>✓</p>}
                {!running && !done && <Wind size={24} color={pat.color} strokeWidth={1.5}/>}
              </div>
            </motion.div>
          </div>

          {/* Phase / state label */}
          <div style={{ marginTop: '1.25rem', textAlign: 'center', minHeight: 52 }}>
            <AnimatePresence mode="wait">
              {running && (
                <motion.div key={`${phaseIdx}-${round}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                  <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: pat.color, marginBottom: '0.25rem' }}>
                    Round {round + 1} of {pat.totalRounds}
                  </p>
                  <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {currentPhase?.label}
                  </p>
                </motion.div>
              )}
              {done && (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
                  <p style={{ fontSize: '1.125rem', fontWeight: 700, color: pat.color }}>Session complete</p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: 4 }}>+3 XP earned</p>
                </motion.div>
              )}
              {!running && !done && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Take a moment to settle in</p>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: 4 }}>
                    {pat.phases.map(ph => `${ph.label} ${ph.duration}s`).join(' · ')}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Control button */}
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
            {!running && !done && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={start}
                style={{ height: 52, padding: '0 2.5rem', borderRadius: '1rem', border: 'none', background: pat.color, color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxShadow: `0 6px 20px ${pat.color}50`, ...RUB }}>
                Start
              </motion.button>
            )}
            {running && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={stop}
                style={{ height: 52, padding: '0 2.5rem', borderRadius: '1rem', border: 'none', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', ...RUB }}>
                Stop
              </motion.button>
            )}
            {done && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={start}
                style={{ height: 52, padding: '0 2rem', borderRadius: '1rem', border: 'none', background: pat.color, color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', boxShadow: `0 6px 20px ${pat.color}50`, ...RUB }}>
                Another round
              </motion.button>
            )}
          </div>
        </div>

        {/* Phase guide */}
        {!running && (
          <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1.25rem' }}>
            {pat.phases.map((ph, i) => (
              <div key={i} style={{ flex: 1, borderRadius: '0.75rem', background: 'var(--card)', border: '1px solid var(--border)', padding: '0.625rem 0.5rem', textAlign: 'center', boxShadow: 'var(--shadow-xs)' }}>
                <p style={{ fontSize: '1.0625rem', fontWeight: 800, color: pat.color, lineHeight: 1 }}>{ph.duration}</p>
                <p style={{ fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginTop: 2 }}>{ph.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Exit confirmation */}
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
                style={{ background: 'var(--card)', borderRadius: '1.25rem', padding: '1.5rem', maxWidth: 320, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', ...RUB }}
              >
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${PRIMARY}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <Wind size={22} color={PRIMARY} strokeWidth={2} />
                </div>
                <h3 style={{ textAlign: 'center', fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>End this session?</h3>
                <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  Progress won't be saved. Finish all rounds to earn +3 XP.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowExitConfirm(false)}
                    style={{ flex: 1, height: 44, borderRadius: '0.75rem', background: 'var(--muted)', border: 'none', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', color: 'var(--foreground)', cursor: 'pointer' }}>
                    Keep Going
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setShowExitConfirm(false); stop(); onBack(); }}
                    style={{ flex: 1, height: 44, borderRadius: '0.75rem', background: '#ef4444', border: 'none', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', color: '#fff', cursor: 'pointer' }}>
                    Stop
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session history */}
        {sessions.length > 0 && (
          <div style={{ borderRadius: '1.125rem', background: 'var(--card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: '0.875rem 1rem 0.625rem', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Past Sessions</p>
            </div>
            {[...sessions].reverse().slice(0, 8).map((s, i, arr) => {
              const p = PATTERNS[s.pattern];
              const dt = new Date(s.completedAt);
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '0.5rem', background: `${p.color}16`, border: `1px solid ${p.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Wind size={14} color={p.color} strokeWidth={1.8}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>{p.name} · {s.rounds} rounds</p>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>
                      {dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: p.color }}>+3 XP</span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
