import { hapticTap } from '../utils/haptic';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Leaf, Zap, Flame, Gem, Crown, Coins, BarChart2, Target,
  FileText, BookOpen, Calendar, CalendarDays, Star, Headphones,
  Brain, Sword, Lock, TrendingUp, CheckCircle2,
  Hash, CreditCard, StickyNote, Check, Wind, Smile, NotebookPen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ALL_ACHIEVEMENTS, type AppStats, type AppState } from '../App';
import { LEVELS, XP_SOURCES, getLevelProgress, computeXPBreakdown } from '../xp';

interface Props { stats: AppStats; appState: AppState; }

const ICON_MAP: Record<string, LucideIcon> = {
  'leaf': Leaf, 'zap': Zap, 'flame': Flame, 'gem': Gem, 'crown': Crown,
  'coins': Coins, 'bar-chart': BarChart2, 'target': Target, 'file-text': FileText,
  'book-open': BookOpen, 'calendar': Calendar, 'calendar-days': CalendarDays,
  'star': Star, 'headphones': Headphones, 'brain': Brain,
  'sword': Sword, 'trending-up': TrendingUp, 'check-circle-2': CheckCircle2,
  'hash': Hash, 'credit-card': CreditCard, 'sticky-note': StickyNote,
  'wind': Wind, 'smile': Smile, 'notebook-pen': NotebookPen,
};

const SOURCE_ICONS: Record<string, LucideIcon> = {
  habits: CheckCircle2, focus: Headphones, breathing: Wind,
  notes: StickyNote, moods: Smile, expenses: CreditCard, counters: Hash,
  journal: BookOpen,
};

const LEVEL_ICONS: Record<string, LucideIcon> = {
  leaf: Leaf, star: Star, sword: Sword, crown: Crown, gem: Gem,
};

const CAT_COLORS: Record<string, string> = {
  xp: '#C9935A', habits: '#7B96B0', focus: '#B78E79',
  notes: '#919F90', expenses: '#C9935A', general: '#9F8ABD',
  mood: '#C17B8E', breathing: '#6E9E8A', counter: '#414751', reminders: '#9F8ABD',
  journal: '#6B5E9E',
};

const FILTERS = [
  { id: 'all',       label: 'All'       },
  { id: 'xp',        label: 'XP'        },
  { id: 'habits',    label: 'Habits'    },
  { id: 'focus',     label: 'Focus'     },
  { id: 'notes',     label: 'Notes'     },
  { id: 'expenses',  label: 'Finance'   },
  { id: 'mood',      label: 'Mood'      },
  { id: 'breathing', label: 'Breathing' },
  { id: 'counter',   label: 'Counter'   },
  { id: 'reminders', label: 'Alerts'    },
  { id: 'journal',   label: 'Journal'   },
  { id: 'general',   label: 'General'   },
] as const;
type FilterId = typeof FILTERS[number]['id'];

// ── Circular SVG ring ─────────────────────────────────────────────────────────
const R = 42, CIRC = 2 * Math.PI * R;

function ProgressRing({ pct }: { pct: number; color?: string }) {
  return (
    <div style={{ position: 'relative', width: 108, height: 108, flexShrink: 0 }}>
      <svg width="108" height="108" viewBox="0 0 108 108" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="54" cy="54" r={R} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="8"/>
        <motion.circle
          cx="54" cy="54" r={R} fill="none" stroke="white" strokeWidth="8"
          strokeDasharray={CIRC}
          initial={{ strokeDashoffset: CIRC }}
          animate={{ strokeDashoffset: CIRC * (1 - pct / 100) }}
          transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
          strokeLinecap="round"
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '1.875rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>
          {Math.round(pct)}
        </span>
        <span style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 1 }}>
          %
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Journey({ stats, appState }: Props) {
  const [achFilter, setAchFilter] = useState<FilterId>('all');

  const lp      = getLevelProgress(stats.totalXP);
  const xpBreak = computeXPBreakdown(appState);

  const unlockedIds   = new Set(ALL_ACHIEVEMENTS.filter(a => a.check(stats, appState)).map(a => a.id));
  const totalUnlocked = unlockedIds.size;
  const totalAch      = ALL_ACHIEVEMENTS.length;
  const achPct        = Math.round((totalUnlocked / totalAch) * 100);

  const filtered = ALL_ACHIEVEMENTS.filter(a => achFilter === 'all' || a.category === achFilter);
  const unlocked = filtered.filter(a => unlockedIds.has(a.id));
  const locked   = filtered.filter(a => !unlockedIds.has(a.id));

  const LevelIcon = LEVEL_ICONS[lp.current.icon] ?? Star;

  // Horizontal roadmap line progress (0–100%)
  const nSegments = LEVELS.length - 1;
  const roadmapLinePct = lp.next
    ? ((lp.current.idx / nSegments) + (lp.progressPct / 100) * (1 / nSegments)) * 100
    : 100;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', fontFamily: "'Rubik', sans-serif" }}>

      {/* ── Sticky header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        padding: 'calc(env(safe-area-inset-top,0px) + 1rem) 1rem 0.875rem',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.125rem' }}>
              Growth & Progress
            </p>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
              Journey
            </h1>
          </motion.div>
        </div>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '1.25rem', paddingBottom: '2rem' }}>

        {/* ══════════════════════════════════════════════════════════════════════
            LEVEL HERO — circular ring + stats row
        ══════════════════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          style={{
            borderRadius: '1.5rem', background: lp.current.gradient,
            padding: '1.5rem', marginBottom: '1rem', position: 'relative', overflow: 'hidden',
            boxShadow: `0 12px 40px ${lp.current.color}38`,
          }}
        >
          {/* decorative rings */}
          <svg style={{ position: 'absolute', top: -24, right: -24, pointerEvents: 'none', opacity: 0.7 }} width="160" height="160" viewBox="0 0 160 160" fill="none">
            <circle cx="120" cy="40" r="80" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5"/>
            <circle cx="120" cy="40" r="54" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5"/>
            <circle cx="120" cy="40" r="30" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5"/>
          </svg>
          <div className="shimmer" style={{ position: 'absolute', inset: 0, borderRadius: '1.5rem', pointerEvents: 'none' }}/>

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Ring + info row */}
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <ProgressRing pct={lp.progressPct} color={lp.current.color}/>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Level badge */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(255,255,255,0.18)', borderRadius: 99, padding: '3px 10px 3px 5px', marginBottom: '0.5rem' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LevelIcon size={11} color="white" strokeWidth={2.5}/>
                  </div>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Lv {lp.current.level} · {lp.current.name}
                  </span>
                </div>

                {/* XP number */}
                <p style={{ fontSize: '2.75rem', fontWeight: 700, color: 'white', letterSpacing: '-0.05em', lineHeight: 1, marginBottom: '0.125rem' }}>
                  {stats.totalXP.toLocaleString()}
                </p>
                <p style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Lifetime XP
                </p>

                {/* Next level hint */}
                {lp.next ? (
                  <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.75)', fontWeight: 600, marginTop: '0.5rem' }}>
                    {(lp.next.minXP - stats.totalXP).toLocaleString()} XP → {lp.next.name}
                  </p>
                ) : (
                  <p style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.75)', fontWeight: 700, marginTop: '0.5rem' }}>
                    Max level reached 🏆
                  </p>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div style={{
              display: 'flex', marginTop: '1.25rem',
              borderTop: '1px solid rgba(255,255,255,0.14)',
              paddingTop: '1rem', gap: '0.25rem',
            }}>
              {[
                { label: 'Habit days',  value: xpBreak.habits.count   },
                { label: 'Sessions',    value: xpBreak.focus.count     },
                { label: 'Notes',       value: xpBreak.notes.count     },
                { label: 'Tracked',     value: xpBreak.expenses.count  },
              ].map((item, i, arr) => (
                <div key={item.label} style={{
                  flex: 1, textAlign: 'center',
                  borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.14)' : 'none',
                }}>
                  <p style={{ fontSize: '1.375rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>
                    {item.value}
                  </p>
                  <p style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.55)', marginTop: 3, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ══════════════════════════════════════════════════════════════════════
            XP BREAKDOWN — 2-column mini cards
        ══════════════════════════════════════════════════════════════════════ */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.625rem' }}>
            XP Breakdown
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {XP_SOURCES.map((src, i) => {
              const SrcIcon = SOURCE_ICONS[src.key];
              const data    = xpBreak[src.key as keyof typeof xpBreak];
              const pct     = stats.totalXP > 0 ? Math.min(100, (data.xp / stats.totalXP) * 100) : 0;
              return (
                <motion.div key={src.key}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + i * 0.05 }}
                  style={{
                    borderRadius: '1rem', padding: '0.875rem',
                    background: 'var(--card)', border: `1px solid ${src.color}22`,
                    boxShadow: data.xp > 0 ? `0 2px 12px ${src.color}0e` : 'none',
                    position: 'relative', overflow: 'hidden',
                  }}>
                  {/* Subtle bg tint */}
                  <div style={{ position: 'absolute', inset: 0, background: `${src.color}06`, borderRadius: '1rem', pointerEvents: 'none' }}/>

                  <div style={{ position: 'relative' }}>
                    {/* Icon + count */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '0.625rem', background: `${src.color}18`, border: `1px solid ${src.color}2a`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <SrcIcon size={16} color={src.color} strokeWidth={1.8}/>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                          {data.count}
                        </p>
                        <p style={{ fontSize: '0.45rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                          actions
                        </p>
                      </div>
                    </div>

                    {/* Label + XP */}
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.125rem' }}>
                      {src.label}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.625rem', color: 'var(--muted-foreground)' }}>
                        +{src.award} per action
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: src.color }}>
                        {data.xp} XP
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div style={{ height: 4, borderRadius: 99, background: 'var(--muted)', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.9, delay: 0.25 + i * 0.07, ease: 'easeOut' }}
                        style={{ height: '100%', borderRadius: 99, background: src.color }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ══════════════════════════════════════════════════════════════════════
            LEVEL ROADMAP — horizontal path with connecting line
        ══════════════════════════════════════════════════════════════════════ */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.875rem' }}>
            Level Roadmap
          </p>

          <div style={{
            borderRadius: '1.125rem', background: 'var(--card)', border: '1px solid var(--border)',
            padding: '1.25rem 1rem 1rem', boxShadow: 'var(--shadow-sm)',
          }}>
            {/* Node row with connecting line */}
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>

              {/* Background line */}
              <div style={{
                position: 'absolute', top: 23, left: '12.5%', right: '12.5%', height: 3,
                borderRadius: 99, background: 'var(--muted)', overflow: 'hidden',
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${roadmapLinePct}%` }}
                  transition={{ duration: 1.4, delay: 0.4, ease: 'easeOut' }}
                  style={{ height: '100%', borderRadius: 99, background: lp.current.gradient }}
                />
              </div>

              {/* Level nodes */}
              {LEVELS.map((lv) => {
                const LvIc     = LEVEL_ICONS[lv.icon] ?? Star;
                const reached  = stats.totalXP >= lv.minXP;
                const isCurrent = lp.current.name === lv.name;
                return (
                  <div key={lv.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, flex: 1 }}>
                    {/* Circle node */}
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: reached ? lv.gradient : 'var(--background)',
                      border: isCurrent
                        ? `3px solid white`
                        : `2px solid ${reached ? lv.color + '55' : 'var(--border)'}`,
                      boxShadow: isCurrent
                        ? `0 0 0 5px ${lv.color}25, 0 6px 20px ${lv.color}40`
                        : reached ? `0 4px 12px ${lv.color}20` : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.3s', position: 'relative',
                    }}>
                      {reached && !isCurrent ? (
                        <Check size={18} color="white" strokeWidth={2.5}/>
                      ) : (
                        <LvIc size={18} color={reached ? 'white' : 'var(--muted-foreground)'} strokeWidth={2}/>
                      )}
                      {isCurrent && (
                        <motion.div
                          style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `2px solid ${lv.color}` }}
                          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.15, 0.6] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                    </div>

                    {/* Label */}
                    <p style={{
                      fontSize: '0.625rem', fontWeight: isCurrent ? 700 : 500, marginTop: '0.5rem', textAlign: 'center',
                      color: reached ? 'var(--foreground)' : 'var(--muted-foreground)',
                    }}>
                      {lv.name}
                    </p>
                    <p style={{ fontSize: '0.5rem', color: 'var(--muted-foreground)', textAlign: 'center', marginTop: 1 }}>
                      {lv.minXP === 0 ? 'Start' : `${lv.minXP} XP`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* ══════════════════════════════════════════════════════════════════════
            ACHIEVEMENTS
        ══════════════════════════════════════════════════════════════════════ */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>

          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
            <div>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.2rem' }}>
                Achievements
              </p>
              <p style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {totalUnlocked}
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--muted-foreground)' }}>/{totalAch} unlocked</span>
              </p>
            </div>
            {/* Donut ring for achievement % */}
            <div style={{ position: 'relative', width: 52, height: 52 }}>
              <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="26" cy="26" r="20" fill="none" stroke="var(--muted)" strokeWidth="5"/>
                <motion.circle cx="26" cy="26" r="20" fill="none"
                  stroke="var(--primary)" strokeWidth="5"
                  strokeDasharray={2 * Math.PI * 20}
                  initial={{ strokeDashoffset: 2 * Math.PI * 20 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 20 * (1 - achPct / 100) }}
                  transition={{ duration: 1.2, delay: 0.5, ease: 'easeOut' }}
                  strokeLinecap="round"
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--primary)' }}>{achPct}%</span>
              </div>
            </div>
          </div>

          {/* Category filter chips with count badges */}
          <div className="hide-scrollbar" style={{ display: 'flex', gap: '0.375rem', overflowX: 'auto', marginBottom: '1rem' }}>
            {FILTERS.map(f => {
              const catUnlocked = f.id === 'all'
                ? totalUnlocked
                : ALL_ACHIEVEMENTS.filter(a => a.category === f.id && unlockedIds.has(a.id)).length;
              const catTotal = f.id === 'all'
                ? totalAch
                : ALL_ACHIEVEMENTS.filter(a => a.category === f.id).length;
              const active = achFilter === f.id;
              return (
                <button key={f.id} onClick={() => { hapticTap(); setAchFilter(f.id); }}
                  style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0 0.75rem', minHeight: 44, borderRadius: 999, border: 'none', cursor: 'pointer',
                    fontSize: '0.8125rem', fontWeight: 600, fontFamily: "'Rubik', sans-serif",
                    background: active ? 'var(--steel)' : 'var(--muted)',
                    color:      active ? 'white'        : 'var(--muted-foreground)',
                    transition: 'all 0.15s',
                  }}>
                  <span>{f.label}</span>
                  {catUnlocked > 0 && (
                    <span style={{
                      fontSize: '0.5625rem', fontWeight: 700,
                      background: active ? 'rgba(255,255,255,0.25)' : 'var(--primary-pale)',
                      color: active ? 'white' : 'var(--primary)',
                      borderRadius: 99, padding: '1px 5px',
                    }}>
                      {catUnlocked}/{catTotal}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Unlocked */}
          {unlocked.length > 0 && (
            <section style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--success)', marginBottom: '0.625rem' }}>
                Unlocked · {unlocked.length}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                <AnimatePresence>
                  {unlocked.map((ach, i) => (
                    <motion.div key={ach.id} layout
                      initial={{ opacity: 0, scale: 0.88, y: 14 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.88 }}
                      transition={{ delay: i * 0.04, type: 'spring', stiffness: 260, damping: 22 }}>
                      <AchCard ach={ach} unlocked/>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* Locked */}
          {locked.length > 0 && (
            <section>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.625rem' }}>
                Locked · {locked.length}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                {locked.map((ach, i) => (
                  <motion.div key={ach.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}>
                    <AchCard ach={ach} unlocked={false}/>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {filtered.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', padding: '4rem 0', fontSize: '0.875rem' }}>
              No achievements in this category.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ── Achievement card ──────────────────────────────────────────────────────────
function AchCard({ ach, unlocked }: { ach: typeof ALL_ACHIEVEMENTS[0]; unlocked: boolean }) {
  const IconComponent = ICON_MAP[ach.icon] || Star;
  const catColor      = CAT_COLORS[ach.category] || '#B78E79';
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: '1.125rem', padding: '1rem',
      background: unlocked ? 'var(--card)' : 'var(--muted)',
      border: `1px solid ${unlocked ? catColor + '30' : 'var(--border)'}`,
      boxShadow: unlocked ? `0 4px 16px ${catColor}16` : 'none',
      height: '100%',
    }}>
      {/* Glow blob top-right */}
      {unlocked && (
        <div style={{
          position: 'absolute', top: -16, right: -16, width: 72, height: 72,
          borderRadius: '50%', background: catColor, opacity: 0.12,
          filter: 'blur(18px)', pointerEvents: 'none',
        }}/>
      )}

      <div style={{ position: 'relative' }}>
        {/* Icon */}
        <div style={{ marginBottom: '0.625rem', position: 'relative', width: 'fit-content' }}>
          {unlocked ? (
            <div style={{
              width: 44, height: 44, borderRadius: '0.875rem',
              background: `radial-gradient(circle at 35% 35%, ${catColor}f0, ${catColor}80)`,
              boxShadow: `0 6px 18px ${catColor}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
            }}>
              <IconComponent size={20} color="white" strokeWidth={1.8}/>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '0.875rem', background: 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, transparent 50%)', pointerEvents: 'none' }}/>
            </div>
          ) : (
            <div style={{
              width: 44, height: 44, borderRadius: '0.875rem',
              background: 'var(--background)', border: '1.5px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Lock size={17} color="var(--muted-foreground)" strokeWidth={1.8}/>
            </div>
          )}
        </div>

        {/* Category chip */}
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          background: `${catColor}14`, borderRadius: 99,
          padding: '1px 6px', marginBottom: '0.3rem',
        }}>
          <span style={{ fontSize: '0.45rem', fontWeight: 700, color: catColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {ach.category}
          </span>
        </div>

        <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: unlocked ? 'var(--foreground)' : 'var(--muted-foreground)', lineHeight: 1.25, marginBottom: '0.2rem' }}>
          {ach.title}
        </p>
        <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', opacity: unlocked ? 0.85 : 0.55, lineHeight: 1.4 }}>
          {ach.description}
        </p>
      </div>

      {/* Bottom accent line */}
      {unlocked && (
        <motion.div
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
          transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5,
            background: `linear-gradient(90deg, ${catColor}, ${catColor}00)`,
            transformOrigin: 'left', borderBottomLeftRadius: '1.125rem',
          }}
        />
      )}
    </div>
  );
}
