import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings2, Plus, Trash2, X, Check, Clock, ChevronLeft, ChevronRight, Bell, ArrowRight } from 'lucide-react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { hapticTap, hapticSuccess } from '../utils/haptic';
import type { DailyLog, JournalSettings, JournalTask } from '../App';

const MODULE_COLOR = '#6B5E9E';
const JOURNAL_NOTIF_ID = 9001;

// ── 20 preset task emojis ─────────────────────────────────────────────────────
const TASK_EMOJIS = ['✅','📚','🏃','💧','🧘','💪','🍎','😴','💊','📝','🎯','🧹','🛁','💰','🎵','🧠','🌅','🤸','🍵','❤️'];

// ── Notification helpers ───────────────────────────────────────────────────────
async function scheduleReminder(time: string) {
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return;
    }
    const pending = await LocalNotifications.getPending();
    const toCancel = pending.notifications.filter(n => n.id === JOURNAL_NOTIF_ID);
    if (toCancel.length) await LocalNotifications.cancel({ notifications: toCancel });

    const [hour, minute] = time.split(':').map(Number);
    const at = new Date();
    at.setHours(hour, minute, 0, 0);
    if (at <= new Date()) at.setDate(at.getDate() + 1);

    await LocalNotifications.schedule({
      notifications: [{
        id: JOURNAL_NOTIF_ID,
        title: 'Daily Journal Check-in',
        body: "Time for your daily check-in! How was your day?",
        schedule: { at, repeats: true, every: 'day' },
        smallIcon: 'ic_stat_notify',
      }],
    });
  } catch {}
}

async function cancelReminder() {
  try { await LocalNotifications.cancel({ notifications: [{ id: JOURNAL_NOTIF_ID }] }); } catch {}
}

// ── Date helpers ───────────────────────────────────────────────────────────────
function getWeekDays(offset: number = 0): string[] {
  const today = new Date();
  today.setDate(today.getDate() + offset * 7);
  const day = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() + day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function getMonthDays(year: number, month: number): string[] {
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return d.toISOString().split('T')[0];
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '1rem', padding: '0.875rem', boxShadow: 'var(--shadow-xs)' }}>
      <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.3rem' }}>{label}</p>
      <p style={{ fontSize: '1.25rem', fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</p>
    </div>
  );
}

function Toggle({ enabled, onToggle, color }: { enabled: boolean; onToggle: (v: boolean) => void; color: string }) {
  return (
    <motion.div
      onClick={() => { hapticTap(); onToggle(!enabled); }}
      style={{ width: 44, height: 26, minWidth: 44, minHeight: 26, borderRadius: 13, background: enabled ? color : 'var(--muted)', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
      animate={{ background: enabled ? color : 'var(--muted)' }}
      transition={{ duration: 0.2 }}>
      <motion.div
        animate={{ x: enabled ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{ width: 22, height: 22, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
      />
    </motion.div>
  );
}

// ── Emoji picker popover ───────────────────────────────────────────────────────
function EmojiPickerPopover({ current, onSelect, onClose }: { current: string; onSelect: (e: string) => void; onClose: () => void }) {
  return (
    <>
      {/* backdrop to dismiss */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 290 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 6 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, zIndex: 300,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: '1rem', padding: '0.5rem',
          boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 3,
        }}>
        {TASK_EMOJIS.map(em => (
          <motion.button key={em} whileTap={{ scale: 0.82 }}
            onClick={(e) => { e.stopPropagation(); hapticTap(); onSelect(em); onClose(); }}
            style={{
              width: 38, height: 38, minWidth: 38, minHeight: 38,
              borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
              background: em === current ? `${MODULE_COLOR}22` : 'transparent',
              fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              outline: 'none', fontFamily: 'inherit', boxSizing: 'content-box',
            }}>
            {em}
          </motion.button>
        ))}
      </motion.div>
    </>
  );
}

// ── Emoji trigger button (shows current emoji + opens picker) ─────────────────
function EmojiButton({ value, onChange, pickerKey, openKey, setOpenKey }: {
  value: string;
  onChange: (e: string) => void;
  pickerKey: string;
  openKey: string | null;
  setOpenKey: (k: string | null) => void;
}) {
  const open = openKey === pickerKey;
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => { hapticTap(); setOpenKey(open ? null : pickerKey); }}
        style={{
          width: 44, height: 44, minWidth: 44, minHeight: 44,
          borderRadius: '0.625rem', border: `1.5px solid ${open ? MODULE_COLOR : 'var(--border)'}`,
          background: open ? `${MODULE_COLOR}12` : 'var(--background)',
          fontSize: '1.375rem', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
        }}>
        {value}
      </motion.button>
      <AnimatePresence>
        {open && (
          <EmojiPickerPopover
            current={value}
            onSelect={onChange}
            onClose={() => setOpenKey(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  journalLogs: DailyLog[];
  journalSettings: JournalSettings;
  onUpdateLogs: (logs: DailyLog[]) => void;
  onUpdateSettings: (settings: JournalSettings) => void;
}

type ViewTab = 'today' | 'week' | 'month';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const RUB: React.CSSProperties = { fontFamily: "'Rubik', sans-serif" };

export default function JournalTracker({ journalLogs, journalSettings, onUpdateLogs, onUpdateSettings }: Props) {
  const [viewTab, setViewTab]           = useState<ViewTab>('today');
  const [showSettings, setShowSettings] = useState(false);
  const [weekOffset, setWeekOffset]     = useState(0);
  const [monthOffset, setMonthOffset]   = useState(0);
  const [addingTask, setAddingTask]     = useState(false);
  const [newTaskLabel, setNewTaskLabel] = useState('');
  const [newTaskEmoji, setNewTaskEmoji] = useState('✅');
  const [reminderTime, setReminderTime] = useState(journalSettings.reminderTime || '21:30');
  const [quickLabel, setQuickLabel]     = useState('');
  const [quickEmoji, setQuickEmoji]     = useState('✅');
  // Single key tracks which emoji picker is open: 'quick' | 'settings' | null
  const [openEmojiKey, setOpenEmojiKey] = useState<string | null>(null);

  const todayKey    = new Date().toISOString().split('T')[0];
  const activeTasks = journalSettings.tasks.filter(t => t.active);

  const todayLog     = journalLogs.find(l => l.date === todayKey);
  const completedIds = todayLog?.completedIds ?? [];
  const doneCount    = completedIds.filter(id => activeTasks.some(t => t.id === id)).length;
  const completionPct = activeTasks.length > 0 ? Math.round((doneCount / activeTasks.length) * 100) : 0;
  const todayXP      = todayLog && completedIds.length > 0 ? (completionPct === 100 ? 10 : 4) : 0;

  const toggleTask = (taskId: string) => {
    hapticTap();
    const isDone = completedIds.includes(taskId);
    const newIds = isDone
      ? completedIds.filter(id => id !== taskId)
      : [...completedIds, taskId];
    const newDone = newIds.filter(id => activeTasks.some(t => t.id === id)).length;
    const newPct  = activeTasks.length > 0 ? Math.round((newDone / activeTasks.length) * 100) : 0;
    if (!isDone && newPct === 100) hapticSuccess();
    const newLog: DailyLog = { date: todayKey, completedIds: newIds, completionPct: newPct, totalTasks: activeTasks.length };
    onUpdateLogs([...journalLogs.filter(l => l.date !== todayKey), newLog]);
  };

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  const monthYear = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const monthDays = useMemo(() => getMonthDays(monthYear.getFullYear(), monthYear.getMonth()), [monthYear]);

  const logMap = useMemo(() => {
    const m: Record<string, DailyLog> = {};
    journalLogs.forEach(l => { m[l.date] = l; });
    return m;
  }, [journalLogs]);

  const monthStats = useMemo(() => {
    const logsInMonth   = monthDays.filter(d => logMap[d] && logMap[d].completedIds.length > 0).length;
    const avgCompletion = logsInMonth > 0
      ? Math.round(monthDays.filter(d => logMap[d]).reduce((s, d) => s + (logMap[d]?.completionPct ?? 0), 0) / logsInMonth)
      : 0;
    const perfectDays   = monthDays.filter(d => logMap[d]?.completionPct === 100).length;
    const consistency   = logsInMonth > 0 ? Math.round((logsInMonth / monthDays.length) * 100) : 0;
    return { logsInMonth, daysInMonth: monthDays.length, avgCompletion, perfectDays, consistency };
  }, [monthDays, logMap]);

  // Delete task from Today view — removes from settings + cleans all logs
  const deleteTaskFromView = (taskId: string) => {
    hapticTap();
    onUpdateSettings({ ...journalSettings, tasks: journalSettings.tasks.filter(t => t.id !== taskId) });
    onUpdateLogs(journalLogs.map(log => ({ ...log, completedIds: log.completedIds.filter(id => id !== taskId) })));
  };

  // Quick-add a task from Today view
  const addQuickTask = () => {
    if (!quickLabel.trim()) return;
    hapticTap();
    const newTask: JournalTask = { id: `custom_${Date.now()}`, label: quickLabel.trim(), emoji: quickEmoji, isDefault: false, active: true };
    onUpdateSettings({ ...journalSettings, tasks: [...journalSettings.tasks, newTask] });
    setQuickLabel('');
    setQuickEmoji('✅');
  };

  // Settings handlers
  const addTask = () => {
    if (!newTaskLabel.trim()) return;
    hapticTap();
    const newTask: JournalTask = { id: `custom_${Date.now()}`, label: newTaskLabel.trim(), emoji: newTaskEmoji, isDefault: false, active: true };
    onUpdateSettings({ ...journalSettings, tasks: [...journalSettings.tasks, newTask] });
    setNewTaskLabel('');
    setNewTaskEmoji('✅');
    setAddingTask(false);
  };

  const toggleTaskActive = (taskId: string) => {
    hapticTap();
    onUpdateSettings({ ...journalSettings, tasks: journalSettings.tasks.map(t => t.id === taskId ? { ...t, active: !t.active } : t) });
  };

  const deleteTask = (taskId: string) => {
    hapticTap();
    onUpdateSettings({ ...journalSettings, tasks: journalSettings.tasks.filter(t => t.id !== taskId) });
  };

  const toggleReminder = async (enabled: boolean) => {
    hapticTap();
    onUpdateSettings({ ...journalSettings, reminderEnabled: enabled });
    if (enabled) await scheduleReminder(reminderTime);
    else await cancelReminder();
  };

  const saveReminderTime = async (time: string) => {
    setReminderTime(time);
    onUpdateSettings({ ...journalSettings, reminderTime: time });
    if (journalSettings.reminderEnabled) await scheduleReminder(time);
  };

  const RING_R    = 30;
  const RING_CIRC = 2 * Math.PI * RING_R;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', ...RUB }}>

      {/* ── Sticky header (matches Journey / Account pattern) ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
        padding: 'calc(env(safe-area-inset-top,0px) + 1rem) 1rem 0',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.125rem' }}>
                Daily Habits
              </p>
              <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
                Journal
              </h1>
            </motion.div>
            <motion.button whileTap={{ scale: 0.88 }}
              onClick={() => { hapticTap(); setShowSettings(true); }}
              aria-label="Journal settings"
              style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, borderRadius: 10, background: 'var(--muted)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <Settings2 size={18} color="var(--muted-foreground)" strokeWidth={1.8}/>
            </motion.button>
          </div>

          {/* View-tab pills (Today / Week / Month) — sits inside sticky header */}
          <div style={{ display: 'flex', background: 'var(--muted)', borderRadius: '0.875rem', padding: 3, marginBottom: '0.875rem', gap: 2 }}>
            {(['today', 'week', 'month'] as ViewTab[]).map(tab => (
              <motion.button key={tab} onClick={() => { hapticTap(); setViewTab(tab); }}
                style={{
                  flex: 1, height: 32, borderRadius: '0.625rem', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: viewTab === tab ? 700 : 500,
                  background: viewTab === tab ? 'var(--card)' : 'transparent',
                  color: viewTab === tab ? MODULE_COLOR : 'var(--muted-foreground)',
                  boxShadow: viewTab === tab ? 'var(--shadow-xs)' : 'none',
                  transition: 'color 0.15s',
                }}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </motion.button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Scrollable content ── */}
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '1rem', paddingBottom: 'calc(var(--nav-height, 64px) + var(--safe-bottom, 0px) + 1rem)' }}>
        <AnimatePresence mode="wait">

          {/* ── TODAY view ── */}
          {viewTab === 'today' && (
            <motion.div key="today"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}>

              {/* Date label */}
              <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.875rem', paddingLeft: '0.125rem' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>

              {/* Completion ring hero card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}
                style={{
                  background: `linear-gradient(145deg, ${MODULE_COLOR} 0%, #4A3F7E 100%)`,
                  borderRadius: '1.5rem', padding: '1.5rem', marginBottom: '0.875rem',
                  position: 'relative', overflow: 'hidden',
                  boxShadow: `0 8px 32px ${MODULE_COLOR}44`,
                }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none', borderRadius: '1.5rem' }}/>
                <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }}/>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  {/* SVG progress ring */}
                  <div style={{ position: 'relative', flexShrink: 0, width: 80, height: 80 }}>
                    <svg width="80" height="80" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r={RING_R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="6"/>
                      <motion.circle cx="40" cy="40" r={RING_R} fill="none" stroke="white" strokeWidth="6"
                        strokeLinecap="round" strokeDasharray={`${RING_CIRC}`}
                        initial={{ strokeDashoffset: RING_CIRC }}
                        animate={{ strokeDashoffset: RING_CIRC * (1 - completionPct / 100) }}
                        transition={{ duration: 1.0, ease: 'easeOut' }}
                        style={{ transform: 'rotate(-90deg)', transformOrigin: '40px 40px' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'white', letterSpacing: '-0.03em' }}>{completionPct}%</span>
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'white', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
                      {completionPct === 100 ? '🎉 Perfect day!' : completionPct >= 50 ? '💪 Keep going!' : doneCount > 0 ? '📝 In progress' : 'Start your day!'}
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>
                      {doneCount} of {activeTasks.length} tasks done
                    </p>
                    {todayXP > 0 && (
                      <div style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.16)', borderRadius: 99, padding: '3px 10px' }}>
                        <span style={{ fontSize: '0.625rem', fontWeight: 800, color: 'white', letterSpacing: '0.04em' }}>+{todayXP} XP EARNED</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Task checklist */}
              {activeTasks.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  style={{ textAlign: 'center', paddingTop: '3rem', paddingBottom: '1.5rem' }}>
                  <div style={{ width: 72, height: 72, borderRadius: '1.25rem', background: `${MODULE_COLOR}14`, border: `1px solid ${MODULE_COLOR}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={MODULE_COLOR} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                  </div>
                  <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>No tasks yet</h2>
                  <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', maxWidth: '20rem', margin: '0 auto', lineHeight: 1.6 }}>
                    Each completed task earns +4 XP. Add one below!
                  </p>
                </motion.div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {activeTasks.map((task, idx) => {
                    const done = completedIds.includes(task.id);
                    return (
                      <motion.div key={task.id}
                        initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
                        onClick={() => toggleTask(task.id)} whileTap={{ scale: 0.975 }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.875rem 1rem', borderRadius: '0.875rem',
                          background: done ? `${MODULE_COLOR}10` : 'var(--card)',
                          border: `1.5px solid ${done ? MODULE_COLOR + '40' : 'var(--border)'}`,
                          cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
                          boxShadow: 'var(--shadow-xs)',
                        }}>
                        {/* Checkbox circle */}
                        <motion.div
                          animate={{ background: done ? MODULE_COLOR : 'transparent', borderColor: done ? MODULE_COLOR : 'var(--border)' }}
                          transition={{ duration: 0.15 }}
                          style={{ width: 22, height: 22, minWidth: 22, minHeight: 22, borderRadius: '50%', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <AnimatePresence>
                            {done && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                                <Check size={12} color="white" strokeWidth={3}/>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                        {/* Emoji */}
                        <span style={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>{task.emoji}</span>
                        {/* Label */}
                        <span style={{
                          flex: 1, fontSize: '0.9375rem', fontWeight: 600,
                          color: done ? 'var(--muted-foreground)' : 'var(--foreground)',
                          textDecoration: done ? 'line-through' : 'none',
                          transition: 'color 0.15s',
                          minWidth: 0,
                        }}>{task.label}</span>
                        {/* Delete button */}
                        <motion.button
                          whileTap={{ scale: 0.82 }}
                          onClick={e => { e.stopPropagation(); deleteTaskFromView(task.id); }}
                          aria-label="Delete task"
                          style={{
                            width: 32, height: 32, minWidth: 32, minHeight: 32,
                            borderRadius: '50%', background: 'rgba(192,57,43,0.09)',
                            border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, boxSizing: 'border-box',
                          }}>
                          <Trash2 size={13} color="var(--destructive)" strokeWidth={2.5}/>
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* ── Quick-add task row ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: activeTasks.length * 0.04 + 0.08 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  marginTop: '0.625rem',
                  padding: '0.625rem 0.75rem 0.625rem 0.75rem',
                  background: 'var(--card)',
                  border: '1.5px dashed var(--border)', borderRadius: '0.875rem',
                  boxShadow: 'var(--shadow-xs)',
                }}>
                {/* Emoji picker button */}
                <EmojiButton
                  value={quickEmoji}
                  onChange={setQuickEmoji}
                  pickerKey="quick"
                  openKey={openEmojiKey}
                  setOpenKey={setOpenEmojiKey}
                />
                {/* Text input */}
                <input
                  placeholder="Add a task…" value={quickLabel}
                  onChange={e => setQuickLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addQuickTask(); }}
                  style={{ flex: 1, height: 44, background: 'transparent', border: 'none', outline: 'none', fontSize: '0.9375rem', fontWeight: 500, color: 'var(--foreground)', fontFamily: 'inherit', minWidth: 0 }}
                />
                {/* Confirm button — only shows when text is typed */}
                <AnimatePresence>
                  {quickLabel.trim() && (
                    <motion.button
                      initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                      whileTap={{ scale: 0.88 }} onClick={addQuickTask}
                      style={{
                        width: 36, height: 36, minWidth: 36, minHeight: 36,
                        borderRadius: '50%', background: MODULE_COLOR, border: 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, boxSizing: 'border-box',
                      }}>
                      <ArrowRight size={16} color="white" strokeWidth={2.5}/>
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}

          {/* ── WEEK view ── */}
          {viewTab === 'week' && (
            <motion.div key="week"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}>

              {/* Week nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => { hapticTap(); setWeekOffset(w => w - 1); }}
                  style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <ChevronLeft size={16} color="var(--muted-foreground)" strokeWidth={2.5}/>
                </motion.button>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--muted-foreground)' }}>
                  {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : `${Math.abs(weekOffset)} weeks ago`}
                </span>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => { hapticTap(); setWeekOffset(w => Math.min(0, w + 1)); }}
                  style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: weekOffset >= 0 ? 0.35 : 1 }}>
                  <ChevronRight size={16} color="var(--muted-foreground)" strokeWidth={2.5}/>
                </motion.button>
              </div>

              {/* 7 day grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.375rem', marginBottom: '1.25rem' }}>
                {weekDays.map((date, idx) => {
                  const log      = logMap[date];
                  const isToday  = date === todayKey;
                  const isFuture = date > todayKey;
                  const pct      = log?.completionPct ?? 0;
                  const hasLog   = log && log.completedIds.length > 0;
                  return (
                    <motion.div key={date}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: isToday ? MODULE_COLOR : 'var(--muted-foreground)' }}>
                        {DAY_LABELS[idx]}
                      </span>
                      <div style={{
                        width: '100%', aspectRatio: '1', borderRadius: '0.75rem',
                        background: isFuture ? 'var(--muted)' : pct === 100 ? MODULE_COLOR : hasLog ? `${MODULE_COLOR}50` : 'var(--card)',
                        border: isToday ? `2px solid ${MODULE_COLOR}` : '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative', overflow: 'hidden',
                      }}>
                        {!isFuture && hasLog && pct > 0 && pct < 100 && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${pct}%`, background: `${MODULE_COLOR}25` }}/>
                        )}
                        <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: pct === 100 ? 'white' : isToday ? MODULE_COLOR : 'var(--foreground)', position: 'relative', zIndex: 1 }}>
                          {isFuture ? '' : !hasLog ? '—' : `${pct}%`}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.5rem', fontWeight: 600, color: 'var(--muted-foreground)' }}>
                        {new Date(date + 'T12:00:00').getDate()}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              {/* Week summary stats */}
              {(() => {
                const past     = weekDays.filter(d => d <= todayKey);
                const weekLogs = past.map(d => logMap[d]).filter(l => l && l.completedIds.length > 0) as DailyLog[];
                const logged   = weekLogs.length;
                const perfect  = weekLogs.filter(l => l.completionPct === 100).length;
                const avg      = logged > 0 ? Math.round(weekLogs.reduce((s, l) => s + l.completionPct, 0) / logged) : 0;
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    <StatCard label="Days Logged"  value={`${logged}`} color={MODULE_COLOR}/>
                    <StatCard label="Avg. Score"   value={logged ? `${avg}%` : '—'} color={MODULE_COLOR}/>
                    <StatCard label="Perfect Days" value={`${perfect}`} color={MODULE_COLOR}/>
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* ── MONTH view ── */}
          {viewTab === 'month' && (
            <motion.div key="month"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}>

              {/* Month nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => { hapticTap(); setMonthOffset(m => m - 1); }}
                  style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <ChevronLeft size={16} color="var(--muted-foreground)" strokeWidth={2.5}/>
                </motion.button>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--muted-foreground)' }}>
                  {monthYear.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => { hapticTap(); setMonthOffset(m => Math.min(0, m + 1)); }}
                  style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: monthOffset >= 0 ? 0.35 : 1 }}>
                  <ChevronRight size={16} color="var(--muted-foreground)" strokeWidth={2.5}/>
                </motion.button>
              </div>

              {/* Calendar grid */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '1rem', padding: '1rem', marginBottom: '0.875rem', boxShadow: 'var(--shadow-xs)' }}>
                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '0.5rem' }}>
                  {DAY_LABELS.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{d}</div>
                  ))}
                </div>
                {/* Calendar cells */}
                {(() => {
                  const firstDay = new Date(monthYear.getFullYear(), monthYear.getMonth(), 1).getDay();
                  const offset   = firstDay === 0 ? 6 : firstDay - 1;
                  const cells: (string | null)[] = [...Array(offset).fill(null), ...monthDays];
                  while (cells.length % 7 !== 0) cells.push(null);
                  const weeks: (string | null)[][] = [];
                  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
                  return weeks.map((week, wi) => (
                    <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '3px' }}>
                      {week.map((date, di) => {
                        if (!date) return <div key={di}/>;
                        const log      = logMap[date];
                        const hasLog   = log && log.completedIds.length > 0;
                        const isToday  = date === todayKey;
                        const isFuture = date > todayKey;
                        const pct      = log?.completionPct ?? 0;
                        return (
                          <div key={date} style={{
                            aspectRatio: '1', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isFuture || !hasLog ? 'transparent' : pct === 100 ? MODULE_COLOR : `${MODULE_COLOR}44`,
                            border: isToday ? `1.5px solid ${MODULE_COLOR}` : 'none',
                          }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: pct === 100 && hasLog ? 'white' : isToday ? MODULE_COLOR : 'var(--foreground)' }}>
                              {new Date(date + 'T12:00:00').getDate()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>

              {/* Month stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <StatCard label="Days Logged"    value={`${monthStats.logsInMonth} / ${monthStats.daysInMonth}`} color={MODULE_COLOR}/>
                <StatCard label="Avg. Completion" value={monthStats.logsInMonth ? `${monthStats.avgCompletion}%` : '—'} color={MODULE_COLOR}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <StatCard label="Perfect Days" value={`${monthStats.perfectDays}`} color={MODULE_COLOR}/>
                <StatCard label="Consistency"  value={monthStats.logsInMonth ? `${monthStats.consistency}%` : '—'} color={MODULE_COLOR}/>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ── Settings sheet ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={() => setShowSettings(false)}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--card)', borderRadius: '1.5rem 1.5rem 0 0',
                padding: '1.25rem 1rem calc(env(safe-area-inset-bottom,0px) + 1.5rem)',
                width: '100%', maxWidth: 600, maxHeight: '85dvh', overflowY: 'auto', ...RUB,
              }}>

              {/* Handle + header */}
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 1.25rem' }}/>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>Journal Settings</h3>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowSettings(false)}
                  style={{ width: 32, height: 32, minWidth: 32, minHeight: 32, borderRadius: '50%', background: 'var(--muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X size={15} color="var(--muted-foreground)" strokeWidth={2.5}/>
                </motion.button>
              </div>

              {/* ── Reminder section ── */}
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>Reminder</p>
                <div style={{ borderRadius: '1rem', background: 'var(--background)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.875rem 1rem', gap: '0.75rem' }}>
                    <Bell size={16} color={MODULE_COLOR} strokeWidth={2}/>
                    <span style={{ flex: 1, fontSize: '0.9375rem', fontWeight: 500, color: 'var(--foreground)' }}>Daily Reminder</span>
                    <Toggle enabled={journalSettings.reminderEnabled} onToggle={toggleReminder} color={MODULE_COLOR}/>
                  </div>
                  {journalSettings.reminderEnabled && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      style={{ borderTop: '1px solid var(--border)', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                      <Clock size={16} color="var(--muted-foreground)" strokeWidth={2}/>
                      <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>Reminder time</span>
                      <input type="time" value={reminderTime} onChange={e => saveReminderTime(e.target.value)}
                        style={{ fontSize: '0.9375rem', fontWeight: 600, color: MODULE_COLOR, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
                      />
                    </motion.div>
                  )}
                </div>
              </div>

              {/* ── Tasks section ── */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', paddingLeft: '0.25rem' }}>Daily Tasks</p>
                  <motion.button whileTap={{ scale: 0.88 }} onClick={() => { hapticTap(); setAddingTask(a => !a); setOpenEmojiKey(null); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: `${MODULE_COLOR}18`, border: 'none', borderRadius: 99, padding: '4px 10px', cursor: 'pointer', color: MODULE_COLOR, fontSize: '0.75rem', fontWeight: 700, fontFamily: 'inherit' }}>
                    <Plus size={12} strokeWidth={2.5}/> Add task
                  </motion.button>
                </div>

                {/* Add task input */}
                <AnimatePresence>
                  {addingTask && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      style={{ marginBottom: '0.5rem', background: 'var(--background)', border: `1.5px solid ${MODULE_COLOR}`, borderRadius: '0.875rem', padding: '0.75rem', overflow: 'visible' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                        {/* Emoji picker for settings form */}
                        <EmojiButton
                          value={newTaskEmoji}
                          onChange={setNewTaskEmoji}
                          pickerKey="settings"
                          openKey={openEmojiKey}
                          setOpenKey={setOpenEmojiKey}
                        />
                        <input placeholder="Task name…" value={newTaskLabel}
                          onChange={e => setNewTaskLabel(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addTask(); }}
                          style={{ flex: 1, height: 44, borderRadius: '0.5rem', border: '1px solid var(--border)', background: 'var(--card)', padding: '0 0.75rem', fontSize: '0.9375rem', fontWeight: 500, color: 'var(--foreground)', outline: 'none', fontFamily: 'inherit', minWidth: 0 }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <motion.button whileTap={{ scale: 0.93 }} onClick={() => { setAddingTask(false); setNewTaskLabel(''); setOpenEmojiKey(null); }}
                          style={{ flex: 1, height: 36, borderRadius: '0.625rem', background: 'var(--muted)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                          Cancel
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.93 }} onClick={addTask}
                          style={{ flex: 1, height: 36, borderRadius: '0.625rem', background: MODULE_COLOR, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.875rem', color: 'white' }}>
                          Add
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Task list */}
                <div style={{ borderRadius: '1rem', background: 'var(--background)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  {journalSettings.tasks.map((task, idx) => (
                    <React.Fragment key={task.id}>
                      {idx > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '0 1rem' }}/>}
                      <motion.div layout
                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem' }}>
                        <span style={{ fontSize: '1.125rem', lineHeight: 1, flexShrink: 0 }}>{task.emoji}</span>
                        <span style={{ flex: 1, fontSize: '0.9375rem', fontWeight: 500, color: task.active ? 'var(--foreground)' : 'var(--muted-foreground)', textDecoration: task.active ? 'none' : 'line-through', minWidth: 0 }}>
                          {task.label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                          <Toggle enabled={task.active} onToggle={() => toggleTaskActive(task.id)} color={MODULE_COLOR}/>
                          {!task.isDefault && (
                            <motion.button whileTap={{ scale: 0.82 }} onClick={() => deleteTask(task.id)}
                              style={{ width: 32, height: 32, minWidth: 32, minHeight: 32, borderRadius: '50%', background: 'rgba(192,57,43,0.10)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                              <Trash2 size={13} color="var(--destructive)" strokeWidth={2.5}/>
                            </motion.button>
                          )}
                        </div>
                      </motion.div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
