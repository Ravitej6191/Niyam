import { hapticTap, hapticSuccess } from '../utils/haptic';
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ArrowLeft, Flame, Smile, Trash2 } from 'lucide-react';
import type { MoodEntry } from '../App';

interface Props {
  moods: MoodEntry[];
  onUpdate: (moods: MoodEntry[]) => void;
  onBack: () => void;
}

const PRIMARY = '#C17B8E';
const RUB: React.CSSProperties = { fontFamily: "'Rubik', sans-serif" };

const MOODS = [
  { value: 1 as const, emoji: '😞', label: 'Terrible', color: '#E07070' },
  { value: 2 as const, emoji: '😕', label: 'Bad',       color: '#D4965A' },
  { value: 3 as const, emoji: '😐', label: 'Okay',      color: '#B0A060' },
  { value: 4 as const, emoji: '🙂', label: 'Good',      color: '#6A9E7A' },
  { value: 5 as const, emoji: '😄', label: 'Great',     color: '#6E9E8A' },
];

function getMoodDef(v: number) {
  return MOODS.find(m => m.value === v) ?? MOODS[2];
}

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(d: string) {
  const dt = new Date(d + 'T12:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const ddt = new Date(dt); ddt.setHours(0,0,0,0);
  const diff = Math.round((today.getTime() - ddt.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function computeStreak(moods: MoodEntry[]): number {
  if (!moods.length) return 0;
  const sortedDates = [...new Set(moods.map(m => m.date))].sort().reverse();
  let streak = 0;
  const cur = new Date(); cur.setHours(0,0,0,0);
  for (const d of sortedDates) {
    const dt = new Date(d + 'T12:00:00'); dt.setHours(0,0,0,0);
    const diff = Math.round((cur.getTime() - dt.getTime()) / 86400000);
    if (diff === streak) streak++;
    else break;
  }
  return streak;
}

export default function MoodTracker({ moods, onUpdate, onBack }: Props) {
  const today = todayKey();
  const todayEntry = moods.find(m => m.date === today);
  const [selectedMood, setSelectedMood] = useState<1|2|3|4|5 | null>(todayEntry?.mood ?? null);
  const [note, setNote] = useState(todayEntry?.note ?? '');
  const [noteOpen, setNoteOpen] = useState(false);

  const streak = useMemo(() => computeStreak(moods), [moods]);

  const sorted = useMemo(() =>
    [...moods].sort((a, b) => b.date.localeCompare(a.date)),
    [moods]);

  const avgMood = useMemo(() => {
    if (!moods.length) return null;
    return moods.reduce((s, m) => s + m.mood, 0) / moods.length;
  }, [moods]);

  const handleLog = () => {
    if (!selectedMood) return;
    hapticSuccess();
    const existing = moods.find(m => m.date === today);
    let updated: MoodEntry[];
    if (existing) {
      updated = moods.map(m => m.date === today ? { ...m, mood: selectedMood, note: note.trim() || undefined } : m);
      toast.success('Mood updated');
    } else {
      const entry: MoodEntry = { id: Date.now().toString(), date: today, mood: selectedMood, note: note.trim() || undefined };
      updated = [entry, ...moods];
      toast.success('+2 XP — mood logged!');
    }
    onUpdate(updated);
    setNoteOpen(false);
  };

  const handleDelete = (id: string) => {
    hapticTap();
    const deleted = moods.find(m => m.id === id);
    const prevMoods = moods;
    const isToday = deleted?.date === today;
    onUpdate(moods.filter(m => m.id !== id));
    if (isToday) {
      setSelectedMood(null);
      setNote('');
    }
    toast.success('Entry removed', {
      action: {
        label: 'Undo',
        onClick: () => {
          onUpdate(prevMoods);
          if (isToday && deleted) {
            setSelectedMood(deleted.mood);
            setNote(deleted.note ?? '');
          }
        },
      },
      duration: 5000,
    });
  };

  const alreadyLogged = !!todayEntry;
  const canSave = selectedMood !== null && (selectedMood !== todayEntry?.mood || note !== (todayEntry?.note ?? ''));

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', ...RUB }}>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--card)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)', padding: 'calc(env(safe-area-inset-top,0px) + 1rem) 1rem 0.875rem' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <motion.button whileTap={{ scale: 0.88 }} onClick={onBack} aria-label="Go back"
              style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--muted)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 36 }}>
              <ArrowLeft size={18} color="var(--muted-foreground)" strokeWidth={2}/>
            </motion.button>
            <div>
              <h1 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.1 }}>Mood</h1>
              <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{moods.length} entr{moods.length !== 1 ? 'ies' : 'y'} · {streak > 0 ? `${streak}d streak` : 'Start today'}</p>
            </div>
          </div>
          {streak >= 2 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(193,123,142,0.12)', border: '1px solid rgba(193,123,142,0.28)', borderRadius: 99, padding: '0.25rem 0.625rem' }}>
              <Flame size={12} color={PRIMARY} strokeWidth={2.5}/>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: PRIMARY }}>{streak}d</span>
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '1rem' }}>

        {/* Today's log card */}
        <div style={{ borderRadius: '1.25rem', background: 'var(--card)', border: '1px solid var(--border)', padding: '1.25rem', marginBottom: '0.875rem', boxShadow: 'var(--shadow-sm)' }}>
          <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.625rem' }}>
            {alreadyLogged ? 'Today · logged' : "How are you feeling today?"}
          </p>

          {/* Emoji buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.375rem', marginBottom: '1rem' }}>
            {MOODS.map(m => {
              const isSelected = selectedMood === m.value;
              return (
                <motion.button key={m.value} whileTap={{ scale: 0.88 }}
                  onClick={() => { hapticTap(); setSelectedMood(m.value); }}
                  style={{ flex: 1, height: 64, borderRadius: '0.875rem', border: `2px solid ${isSelected ? m.color : 'var(--border)'}`, background: isSelected ? `${m.color}16` : 'var(--muted)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', transition: 'border-color 0.15s, background 0.15s' }}>
                  <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{m.emoji}</span>
                  <span style={{ fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: isSelected ? m.color : 'var(--muted-foreground)' }}>{m.label}</span>
                </motion.button>
              );
            })}
          </div>

          {/* Optional note */}
          <AnimatePresence>
            {selectedMood && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                {!noteOpen ? (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => setNoteOpen(true)}
                    style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.75rem', border: '1px dashed var(--border)', background: 'none', color: 'var(--muted-foreground)', fontSize: '0.8125rem', cursor: 'pointer', textAlign: 'left', marginBottom: '0.75rem', minHeight: 44, ...RUB }}>
                    Add a note…
                  </motion.button>
                ) : (
                  <>
                    <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="What's on your mind?"
                      maxLength={500}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: '0.875rem', lineHeight: 1.5, resize: 'none', outline: 'none', marginBottom: '0.25rem', boxSizing: 'border-box', ...RUB }}
                      rows={3}/>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', textAlign: 'right', marginBottom: '0.75rem' }}>{note.length}/500</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button whileTap={{ scale: 0.96 }} onClick={handleLog}
            disabled={!canSave}
            style={{ width: '100%', height: 44, borderRadius: '0.75rem', border: 'none', background: canSave ? PRIMARY : 'var(--muted)', color: canSave ? '#fff' : 'var(--muted-foreground)', fontWeight: 700, fontSize: '0.9375rem', cursor: canSave ? 'pointer' : 'default', transition: 'background 0.18s, color 0.18s', ...RUB }}>
            {alreadyLogged ? 'Update' : 'Log Today · +2 XP'}
          </motion.button>
        </div>

        {/* Stats strip */}
        {moods.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.875rem' }}>
            {[
              { label: 'Logged', value: moods.length.toString() },
              { label: 'Avg Mood', value: avgMood !== null ? avgMood.toFixed(1) : '—' },
              { label: 'Streak', value: `${streak}d` },
            ].map(s => (
              <div key={s.label} style={{ borderRadius: '0.875rem', background: 'var(--card)', border: '1px solid var(--border)', padding: '0.75rem', textAlign: 'center', boxShadow: 'var(--shadow-xs)' }}>
                <p style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginTop: 3 }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* History */}
        {sorted.length > 0 && (
          <div style={{ borderRadius: '1.125rem', background: 'var(--card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: '0.875rem 1rem 0.625rem', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>History</p>
            </div>
            <div>
              <AnimatePresence>
                {sorted.map((entry, i) => {
                  const m = getMoodDef(entry.mood);
                  return (
                    <motion.div key={entry.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem 1rem', borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '0.75rem', background: `${m.color}16`, border: `1px solid ${m.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem' }}>
                        {m.emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <p style={{ fontSize: '0.875rem', fontWeight: 700, color: m.color }}>{m.label}</p>
                          <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{formatDate(entry.date)}</p>
                        </div>
                        {entry.note && <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{entry.note}</p>}
                      </div>
                      <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleDelete(entry.id)} aria-label="Delete entry"
                        style={{ width: 36, height: 36, borderRadius: 8, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, minHeight: 36 }}>
                        <Trash2 size={15} color="var(--destructive)" strokeWidth={1.8}/>
                      </motion.button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Empty state */}
        {moods.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 1.5rem', background: 'var(--card)', borderRadius: '1.125rem', border: '1px solid var(--border)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '1rem', background: 'rgba(193,123,142,0.10)', border: '1px solid rgba(193,123,142,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Smile size={28} color={PRIMARY} strokeWidth={1.5}/>
            </div>
            <p style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>A daily check-in goes a long way</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', lineHeight: 1.6 }}>A few seconds each day. Build your streak and earn +2 XP.</p>
          </div>
        )}
      </main>
    </div>
  );
}
