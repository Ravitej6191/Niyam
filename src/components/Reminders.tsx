import { hapticSuccess } from '../utils/haptic';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ArrowLeft, Bell, BellOff, Plus, X, Pencil, Trash2, BellRing, Volume2, ChevronRight } from 'lucide-react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import type { Reminder } from '../App';

const PRIMARY_RAW = '#9F8ABD';
const IS_NATIVE   = Capacitor.isNativePlatform();

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr   = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
}
function formatDays(days: number[]) {
  if (days.length === 7) return 'Every day';
  if (days.length === 0) return 'One-time';
  if (days.length === 5 && [1,2,3,4,5].every(d => days.includes(d))) return 'Weekdays';
  if (days.length === 2 && [0,6].every(d => days.includes(d))) return 'Weekends';
  return days.sort().map(d => DAY_LABELS[d]).join(', ');
}

// ─── Notification helpers ─────────────────────────────────────────────────────

// Each reminder × day slot gets a unique integer ID.
// Reminder IDs are Date.now() strings; last 6 digits × 10 + slot (0-7) → safe int.
// Slot 7 is reserved for one-time reminders (no repeat days).
function notifId(reminderId: string, slot: number): number {
  return parseInt(reminderId.slice(-6), 10) * 10 + slot;
}

async function syncReminder(r: Reminder): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    // Always cancel all 8 possible slots first to avoid stale notifications
    await LocalNotifications.cancel({
      notifications: [0,1,2,3,4,5,6,7].map(s => ({ id: notifId(r.id, s) })),
    });
    if (!r.enabled) return;

    const [hour, minute] = r.time.split(':').map(Number);

    if (r.days.length === 0) {
      // One-time: next occurrence of this time today or tomorrow
      const at = new Date();
      at.setHours(hour, minute, 0, 0);
      if (at <= new Date()) at.setDate(at.getDate() + 1);
      await LocalNotifications.schedule({
        notifications: [{
          id:    notifId(r.id, 7),
          title: r.title,
          body:  r.note ?? '',
          schedule: { at, allowWhileIdle: true },
          iconColor: PRIMARY_RAW,
        }],
      });
    } else {
      // Repeating: one notification per selected weekday
      // Capacitor weekday: 1 = Sunday … 7 = Saturday  (our days: 0 = Sun … 6 = Sat)
      await LocalNotifications.schedule({
        notifications: r.days.map(day => ({
          id:    notifId(r.id, day),
          title: r.title,
          body:  r.note ?? '',
          schedule: {
            on:      { weekday: day + 1, hour, minute },
            repeats: true,
            allowWhileIdle: true,
          },
          iconColor: PRIMARY_RAW,
        })),
      });
    }
  } catch (e) {
    console.warn('[Reminders] schedule failed:', e);
  }
}

async function cancelReminder(reminderId: string): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    await LocalNotifications.cancel({
      notifications: [0,1,2,3,4,5,6,7].map(s => ({ id: notifId(reminderId, s) })),
    });
  } catch {}
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { reminders: Reminder[]; onUpdate:(r:Reminder[])=>void; onBack:()=>void; }

export default function Reminders({ reminders, onUpdate, onBack }: Props) {
  const [showSheet, setShowSheet]   = useState(false);
  const [editId, setEditId]         = useState<string|null>(null);
  const defaultForm = ()            => ({ title:'', note:'', time:'08:00', days:[1,2,3,4,5] as number[] });
  const [form, setForm]             = useState(defaultForm());
  const [formError, setFormError]   = useState('');
  const [permGranted, setPermGranted] = useState<boolean | null>(null); // null = unknown

  // On mount: request permission + sync every reminder
  useEffect(() => {
    if (!IS_NATIVE) return;
    (async () => {
      try {
        const res     = await LocalNotifications.requestPermissions();
        const granted = res.display === 'granted';
        setPermGranted(granted);
        if (!granted) return;
        for (const r of reminders) await syncReminder(r);
      } catch {}
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Web fallback: in-app toast while app is open (dev / browser only)
  useEffect(() => {
    if (IS_NATIVE) return;
    const check = () => {
      const now  = new Date();
      const hhmm = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
      reminders.forEach(r => {
        if (r.enabled && r.time === hhmm && r.days.includes(now.getDay()))
          toast(r.title, { description: r.note ?? undefined, duration: 10_000 });
      });
    };
    const iv = setInterval(check, 60_000);
    return () => clearInterval(iv);
  }, [reminders]);

  const openAdd  = () => { setForm(defaultForm()); setFormError(''); setEditId(null); setShowSheet(true); };
  const openEdit = (r: Reminder) => { setForm({ title:r.title, note:r.note??'', time:r.time, days:[...r.days] }); setFormError(''); setEditId(r.id); setShowSheet(true); };

  const save = async () => {
    const title = form.title.trim();
    if (!title)             { setFormError('Title is required'); return; }
    if (title.length > 60)  { setFormError('Max 60 characters'); return; }
    if (!form.time)         { setFormError('Please set a time'); return; }

    if (editId) {
      const existing = reminders.find(r => r.id === editId);
      if (!existing) return;
      const updated: Reminder = { ...existing, title, note: form.note.trim() || undefined, time: form.time, days: form.days };
      onUpdate(reminders.map(r => r.id === editId ? updated : r));
      await syncReminder(updated);
      toast.success('Reminder updated');
    } else {
      const newR: Reminder = { id: Date.now().toString(), title, note: form.note.trim() || undefined, time: form.time, days: form.days, enabled: true, createdAt: new Date().toISOString() };
      onUpdate([...reminders, newR]);
      await syncReminder(newR);
      hapticSuccess();
      toast.success('Reminder set');
    }
    setShowSheet(false);
  };

  const toggle = async (id: string) => {
    const r = reminders.find(r => r.id === id);
    if (!r) return;
    const updated = { ...r, enabled: !r.enabled };
    onUpdate(reminders.map(x => x.id === id ? updated : x));
    await syncReminder(updated);
  };

  const del = async (id: string) => {
    const removed = reminders.find(r => r.id === id);
    if (!removed) return;
    const prev = reminders;
    onUpdate(reminders.filter(r => r.id !== id));
    await cancelReminder(id);
    toast.success(`"${removed.title}" deleted`, {
      action: {
        label: 'Undo',
        onClick: () => {
          onUpdate(prev);
          syncReminder(removed);
        },
      },
    });
  };

  // Deep-link to Android's per-app notification settings so the user can pick a sound
  const openNotifSettings = async () => {
    if (!IS_NATIVE) {
      toast.info('Change the notification sound in Settings → Apps → Niyam → Notifications');
      return;
    }
    try {
      const { id } = await App.getInfo(); // id = package name e.g. com.niyam.app
      await App.openUrl({
        url: `intent:#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;S.android.provider.Settings.EXTRA_APP_PACKAGE=${id};end`,
      });
    } catch {
      toast.info('Go to Settings → Apps → Niyam → Notifications to change the alarm sound', { duration: 7000 });
    }
  };

  const sorted = [...reminders].sort((a,b) => a.time.localeCompare(b.time));

  return (
    <div style={{ minHeight:'100dvh', background:'var(--background)', fontFamily:"'Rubik',sans-serif" }}>
      <header style={{ position:'sticky',top:0,zIndex:40,background:'var(--card)',borderBottom:'1px solid var(--border)',padding:'calc(env(safe-area-inset-top,0px) + 1rem) 1rem 0.875rem',backdropFilter:'blur(12px)' }}>
        <div style={{ maxWidth:600,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <div style={{ display:'flex',alignItems:'center',gap:'0.75rem' }}>
            <motion.button whileTap={{scale:0.88}} onClick={onBack} aria-label="Go back"
              style={{ width:36,height:36,borderRadius:10,background:'var(--muted)',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',minHeight:36 }}>
              <ArrowLeft size={18} color="var(--muted-foreground)" strokeWidth={2}/>
            </motion.button>
            <div>
              <h1 style={{ fontSize:'1.0625rem',fontWeight:600,color:'var(--foreground)',lineHeight:1.1 }}>Reminders</h1>
              <p style={{ fontSize:'0.75rem',color:'var(--muted-foreground)',lineHeight:1 }}>{reminders.filter(r=>r.enabled).length} active</p>
            </div>
          </div>
          <motion.button whileTap={{scale:0.94}} onClick={openAdd}
            style={{ display:'flex',alignItems:'center',gap:'0.375rem',padding:'0 0.875rem',height:38,borderRadius:'0.625rem',background:PRIMARY_RAW,border:'none',color:'#fff',fontSize:'0.8125rem',fontWeight:600,cursor:'pointer',minHeight:44 }}>
            <Plus size={15} strokeWidth={2.5}/> Add
          </motion.button>
        </div>
      </header>

      {/* Permission banner — shown only on native if permission was denied */}
      {IS_NATIVE && permGranted === false && (
        <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
          style={{ maxWidth:600,margin:'0.75rem auto 0',padding:'0 1rem' }}>
          <div style={{ display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.75rem 1rem',borderRadius:'0.875rem',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)' }}>
            <BellRing size={18} color="#ef4444" strokeWidth={2}/>
            <p style={{ fontSize:'0.8125rem',color:'var(--foreground)',flex:1,lineHeight:1.4 }}>
              Notification permission denied. Enable it in <strong>Settings → Apps → Niyam → Notifications</strong> to receive alarms.
            </p>
          </div>
        </motion.div>
      )}

      <main style={{ maxWidth:600,margin:'0 auto',padding:'1rem' }}>

        {/* Alarm Sound — opens Android notification settings */}
        <motion.button whileTap={{scale:0.97}} onClick={openNotifSettings}
          style={{ width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.875rem 1rem',borderRadius:'0.875rem',background:'var(--card)',border:'1px solid var(--border)',cursor:'pointer',marginBottom:'1rem',textAlign:'left' }}>
          <div style={{ display:'flex',alignItems:'center',gap:'0.75rem' }}>
            <div style={{ width:40,height:40,borderRadius:'0.75rem',background:`${PRIMARY_RAW}14`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <Volume2 size={17} color={PRIMARY_RAW} strokeWidth={2}/>
            </div>
            <div>
              <p style={{ fontSize:'0.9375rem',fontWeight:600,color:'var(--foreground)',lineHeight:1.2 }}>Alarm Sound</p>
              <p style={{ fontSize:'0.75rem',color:'var(--muted-foreground)',marginTop:1 }}>Tap to change in system settings</p>
            </div>
          </div>
          <ChevronRight size={16} color="var(--muted-foreground)" strokeWidth={2}/>
        </motion.button>

        {sorted.length === 0 ? (
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} style={{ textAlign:'center', padding:'4rem 1.5rem' }}>
            <div style={{ width:64,height:64,borderRadius:'1rem',background:`${PRIMARY_RAW}14`,border:`1px solid ${PRIMARY_RAW}22`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1rem' }}>
              <Bell size={28} color={PRIMARY_RAW} strokeWidth={1.5}/>
            </div>
            <h2 style={{ fontSize:'1.0625rem',fontWeight:700,color:'var(--foreground)',marginBottom:'0.5rem' }}>No reminders set</h2>
            <p style={{ fontSize:'0.875rem',color:'var(--muted-foreground)',maxWidth:'18rem',margin:'0 auto',lineHeight:1.6 }}>
              Add a reminder to get nudged at the right time.
            </p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {sorted.map((r,i) => (
              <motion.div key={r.id} layout initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.96}} transition={{delay:i*0.04}} style={{ marginBottom:'0.5rem' }}>
                <div style={{ borderRadius:'1rem',padding:'1rem 1.125rem',background:'var(--card)',border:'1px solid var(--border)',opacity:r.enabled?1:0.55,transition:'opacity 0.2s',boxShadow:'var(--shadow-sm)' }}>
                  <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'0.75rem' }}>
                    <div style={{ display:'flex',alignItems:'flex-start',gap:'0.875rem',flex:1,minWidth:0 }}>
                      <div>
                        <p style={{ fontSize:'1.5rem',fontWeight:700,color:r.enabled?PRIMARY_RAW:'var(--muted-foreground)',letterSpacing:'-0.025em',lineHeight:1,fontVariantNumeric:'tabular-nums' }}>{fmtTime12(r.time)}</p>
                        <p style={{ fontSize:'0.6875rem',color:'var(--muted-foreground)',marginTop:3 }}>{formatDays(r.days)}</p>
                      </div>
                      <div style={{ flex:1,minWidth:0,paddingTop:2 }}>
                        <p style={{ fontSize:'0.9375rem',fontWeight:600,color:'var(--foreground)',lineHeight:1.3,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis' }}>{r.title}</p>
                        {r.note && <p style={{ fontSize:'0.75rem',color:'var(--muted-foreground)',marginTop:2,lineHeight:1.4,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis' }}>{r.note}</p>}
                      </div>
                    </div>
                    <div style={{ display:'flex',alignItems:'center',gap:2,flexShrink:0 }}>
                      <motion.button whileTap={{scale:0.88}} onClick={()=>toggle(r.id)}
                        style={{ width:36,height:36,borderRadius:8,border:'none',background:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',minHeight:36 }}>
                        {r.enabled ? <Bell size={16} color={PRIMARY_RAW} strokeWidth={2}/> : <BellOff size={16} color="var(--muted-foreground)" strokeWidth={1.8}/>}
                      </motion.button>
                      <motion.button whileTap={{scale:0.88}} onClick={()=>openEdit(r)}
                        style={{ width:36,height:36,borderRadius:8,border:'none',background:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',minHeight:36 }}>
                        <Pencil size={15} color="var(--muted-foreground)" strokeWidth={1.8}/>
                      </motion.button>
                      <motion.button whileTap={{scale:0.88}} onClick={()=>del(r.id)}
                        style={{ width:36,height:36,borderRadius:8,border:'none',background:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',minHeight:36 }}>
                        <Trash2 size={15} color="var(--destructive)" strokeWidth={1.8}/>
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </main>

      {/* Sheet */}
      <AnimatePresence>
        {showSheet && (
          <div style={{ position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'flex-end',justifyContent:'center' }}>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setShowSheet(false)}
              style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)' }}/>
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:340,damping:38}}
              style={{ position:'relative',width:'100%',maxWidth:520,borderRadius:'1.5rem 1.5rem 0 0',background:'var(--card)',borderTop:'1px solid var(--border)',borderLeft:'1px solid var(--border)',borderRight:'1px solid var(--border)',maxHeight:'92dvh',overflowY:'auto',paddingBottom:'calc(env(safe-area-inset-bottom,0px) + 1.5rem)' }}>
              <div style={{ display:'flex',justifyContent:'center',paddingTop:'0.75rem' }}><div style={{ width:36,height:4,borderRadius:2,background:'var(--border-strong)' }}/></div>
              <div style={{ padding:'0.875rem 1.25rem 0' }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem' }}>
                  <h2 style={{ fontSize:'1.0625rem',fontWeight:600,color:'var(--foreground)' }}>{editId?'Edit Reminder':'New Reminder'}</h2>
                  <motion.button whileTap={{scale:0.88}} onClick={()=>setShowSheet(false)} aria-label="Close"
                    style={{ width:36,height:36,borderRadius:8,background:'var(--muted)',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',minHeight:36 }}>
                    <X size={14} color="var(--muted-foreground)" strokeWidth={2.5}/>
                  </motion.button>
                </div>
                {/* Title */}
                <Field label="Title">
                  <input value={form.title} onChange={e=>{setForm({...form,title:e.target.value});setFormError('');}} placeholder="e.g. Morning meditation" maxLength={60} autoFocus enterKeyHint="next"
                    style={inp(!!formError&&!form.title.trim())}/>
                </Field>
                {/* Note */}
                <Field label="Note (optional)">
                  <input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Optional…" maxLength={120} style={inp(false)} enterKeyHint="done"/>
                </Field>
                {/* Time */}
                <Field label="Time">
                  <input type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})} style={inp(!!formError&&!form.time)}/>
                </Field>
                {/* Days */}
                <Field label="Repeat">
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.3rem',marginBottom:'0.5rem' }}>
                    {DAY_LABELS.map((d,idx)=>{
                      const sel = form.days.includes(idx);
                      return (
                        <motion.button key={d} whileTap={{scale:0.88}} onClick={()=>{const days=sel?form.days.filter(x=>x!==idx):[...form.days,idx].sort();setForm({...form,days});}}
                          style={{ height:44,borderRadius:'0.5rem',border:`1.5px solid ${sel?PRIMARY_RAW:'var(--border)'}`,background:sel?PRIMARY_RAW:'var(--card)',color:sel?'#fff':'var(--muted-foreground)',fontSize:'0.625rem',fontWeight:600,cursor:'pointer',minHeight:44,transition:'all 0.14s' }}>
                          {d}
                        </motion.button>
                      );
                    })}
                  </div>
                  <div style={{ display:'flex',gap:'0.4rem' }}>
                    {[{label:'Every day',days:[0,1,2,3,4,5,6]},{label:'Weekdays',days:[1,2,3,4,5]},{label:'Weekends',days:[0,6]}].map(p=>(
                      <motion.button key={p.label} whileTap={{scale:0.94}} onClick={()=>setForm({...form,days:p.days})}
                        style={{ flex:1,height:44,borderRadius:'0.5rem',border:'1px solid var(--border)',background:'var(--muted)',color:'var(--muted-foreground)',fontSize:'0.625rem',fontWeight:500,cursor:'pointer',minHeight:44 }}>
                        {p.label}
                      </motion.button>
                    ))}
                  </div>
                </Field>
                {formError && <p style={{ fontSize:'0.75rem',color:'var(--destructive)',marginBottom:'0.75rem' }}>{formError}</p>}
                <div style={{ display:'flex',gap:'0.75rem',marginTop:'0.25rem' }}>
                  <button onClick={()=>setShowSheet(false)}
                    style={{ flex:1,height:48,borderRadius:'0.875rem',border:'1.5px solid var(--border)',background:'none',color:'var(--foreground)',fontSize:'0.9375rem',fontWeight:500,cursor:'pointer' }}>
                    Cancel
                  </button>
                  <motion.button whileTap={{scale:0.97}} onClick={save}
                    style={{ flex:1,height:48,borderRadius:'0.875rem',border:'none',background:'#9F8ABD',color:'#fff',fontSize:'0.9375rem',fontWeight:600,cursor:'pointer' }}>
                    {editId?'Update':'Create'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function inp(err: boolean): React.CSSProperties {
  return { width:'100%',height:48,padding:'0 1rem',borderRadius:'0.625rem',border:`1.5px solid ${err?'var(--destructive)':'var(--input-border)'}`,background:'var(--input-bg)',color:'var(--foreground)',fontSize:'0.9375rem',outline:'none',fontFamily:"'Rubik',sans-serif" };
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:'0.875rem' }}>
      <label style={{ display:'block',fontSize:'0.6875rem',fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--muted-foreground)',marginBottom:'0.375rem' }}>{label}</label>
      {children}
    </div>
  );
}
