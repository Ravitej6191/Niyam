import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Check, Flame, X, Zap } from 'lucide-react';
import { hapticTap, hapticSuccess } from '../utils/haptic';
import type { Habit } from '../App';

const PRIMARY_RAW = '#7B96B0';

const HABIT_ICONS = [
  { id:'zap',      emoji:'⚡' },
  { id:'flame',    emoji:'🔥' },
  { id:'target',   emoji:'🎯' },
  { id:'book',     emoji:'📖' },
  { id:'droplet',  emoji:'💧' },
  { id:'moon',     emoji:'🌙' },
  { id:'heart',    emoji:'❤️' },
  { id:'sun',      emoji:'☀️' },
  { id:'music',    emoji:'🎵' },
  { id:'dumbbell', emoji:'💪' },
  { id:'pencil',   emoji:'✏️' },
  { id:'run',      emoji:'🏃' },
];
function getIcon(id:string, size:number) {
  const f = HABIT_ICONS.find(i=>i.id===id);
  return <span style={{ fontSize:size, lineHeight:1, display:'block' }}>{f ? f.emoji : '⚡'}</span>;
}
function Spinner() {
  return <div style={{ width:18, height:18, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', animation:'spin 0.7s linear infinite' }} />;
}

interface Props { habits: Habit[]; onUpdate: (habits: Habit[]) => void; onBack: () => void; }

export default function HabitTracker({ habits, onUpdate, onBack }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit|null>(null);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('zap');
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('zap');
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const addHabit = async () => {
    hapticTap();
    const t = newName.trim();
    if (!t) { setError('Habit name cannot be empty'); return; }
    if (t.length > 30) { setError('Max 30 characters'); return; }
    if (habits.length >= 20) { setError('Maximum 20 habits reached'); return; }
    if (habits.some(h => h.name.toLowerCase() === t.toLowerCase())) { setError('Habit already exists'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 160));
    onUpdate([...habits, { id:Date.now().toString(), name:t, icon:newIcon, completions:{}, streak:0, bestStreak:0, createdAt:new Date().toISOString() }]);
    setNewName(''); setNewIcon('zap'); setError(''); setLoading(false); setShowAdd(false);
    hapticSuccess(); toast.success('Habit added — complete it daily for +10 XP');
  };

  const openEdit = (h: Habit) => { setEditingHabit(h); setEditName(h.name); setEditIcon(h.icon||'zap'); setEditError(''); setShowEdit(true); };
  const saveEdit = async () => {
    const t = editName.trim();
    if (!t) { setEditError('Name cannot be empty'); return; }
    if (t.length > 30) { setEditError('Max 30 characters'); return; }
    if (habits.some(h => h.name.toLowerCase() === t.toLowerCase() && h.id !== editingHabit?.id)) { setEditError('Name already exists'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 160));
    onUpdate(habits.map(h => h.id === editingHabit?.id ? {...h, name:t, icon:editIcon} : h));
    setShowEdit(false); setEditingHabit(null); setEditError(''); setLoading(false);
    toast.success('Habit updated');
  };

  const toggleHabit = (id: string, date: string) => {
    if (date > today) return;
    hapticTap();
    const updated = habits.map(habit => {
      if (habit.id !== id) return habit;
      const comps = {...habit.completions};
      const was = comps[date];
      comps[date] = !was;
      let streak = 0;
      const base = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(base); d.setDate(base.getDate()-i);
        const ds = d.toISOString().split('T')[0];
        if (comps[ds]) streak++; else break;
      }
      const bestStreak = Math.max(habit.bestStreak??0, streak);
      if (!was) {
        if (streak > habit.streak && [7,14,30,50,100].includes(streak)) {
          hapticSuccess(); toast.success(`🔥 ${streak}-day streak! +10 XP`);
        } else {
          toast.success('Done · +10 XP', { duration: 2000 });
        }
      }
      return {...habit, completions:comps, streak, bestStreak};
    });
    onUpdate(updated);
  };

  const deleteHabit = (id: string) => {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    hapticTap();
    const prev = [...habits];
    onUpdate(habits.filter(h => h.id !== id));
    toast.success(`"${habit.name}" deleted`, {
      action: { label: 'Undo', onClick: () => onUpdate(prev) },
      duration: 5000,
    });
  };

  const last7 = Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-(6-i));
    return { date:d.toISOString().split('T')[0], name:d.toLocaleDateString('en-US',{weekday:'short'}), num:d.getDate() };
  });

  const completedToday = habits.filter(h => h.completions[today]).length;
  const pct = habits.length > 0 ? Math.round((completedToday/habits.length)*100) : 0;

  return (
    <div style={{ minHeight:'100dvh', background:'var(--background)', fontFamily:"'Rubik',sans-serif" }}>
      {/* Header */}
      <header style={{ position:'sticky', top:0, zIndex:40, background:'var(--card)', borderBottom:'1px solid var(--border)', padding:'calc(env(safe-area-inset-top,0px) + 1rem) 1rem 0.875rem', backdropFilter:'blur(12px)' }}>
        <div style={{ maxWidth:600, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: habits.length > 0 ? '0.875rem' : 0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <motion.button whileTap={{scale:0.88}} onClick={onBack} aria-label="Go back"
                style={{ width:36, height:36, borderRadius:10, background:'var(--muted)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', minHeight:36 }}>
                <svg width="18" height="18" fill="none" stroke="var(--muted-foreground)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
              </motion.button>
              <div>
                <h1 style={{ fontSize:'1.0625rem', fontWeight:700, color:'var(--foreground)', lineHeight:1.1 }}>Habits</h1>
                <p style={{ fontSize:'0.75rem', color:'var(--muted-foreground)', lineHeight:1 }}>{completedToday}/{habits.length} done today</p>
              </div>
            </div>
            <motion.button whileTap={{scale:0.94}} onClick={() => { setShowAdd(true); setError(''); setNewName(''); setNewIcon('zap'); }}
              style={{ display:'flex', alignItems:'center', gap:'0.375rem', padding:'0 0.875rem', height:38, borderRadius:'0.625rem', background:PRIMARY_RAW, border:'none', color:'#fff', fontSize:'0.8125rem', fontWeight:600, cursor:'pointer', minHeight:44 }}>
              <Plus size={15} strokeWidth={2.5}/> Add
            </motion.button>
          </div>
          {habits.length > 0 && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:'0.6875rem', color:'var(--muted-foreground)', fontWeight:500 }}>Today's progress</span>
                <span style={{ fontSize:'0.6875rem', fontWeight:600, color:PRIMARY_RAW }}>{pct}%</span>
              </div>
              <div style={{ height:3, borderRadius:99, background:'var(--muted)', overflow:'hidden' }}>
                <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:0.8,ease:'easeOut'}}
                  style={{ height:'100%', borderRadius:99, background:PRIMARY_RAW }} />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth:600, margin:'0 auto', padding:'1rem' }}>
        {habits.length === 0 ? (
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} style={{ textAlign:'center', padding:'4rem 1.5rem' }}>
            <div style={{ width:64, height:64, borderRadius:'1rem', background:`${PRIMARY_RAW}14`, border:`1px solid ${PRIMARY_RAW}22`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem' }}>
              <Zap size={28} color={PRIMARY_RAW} strokeWidth={1.5}/>
            </div>
            <h2 style={{ fontSize:'1.0625rem', fontWeight:700, color:'var(--foreground)', marginBottom:'0.5rem' }}>No habits yet</h2>
            <p style={{ fontSize:'0.875rem', color:'var(--muted-foreground)', maxWidth:'18rem', margin:'0 auto', lineHeight:1.6 }}>
              Start small — one habit a day earns +10 XP and builds your streak.
            </p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {habits.map((habit, idx) => {
              const weekRate = (last7.filter(d => habit.completions[d.date]).length / 7) * 100;
              const iconEl = getIcon(habit.icon, 20);
              return (
                <motion.div key={habit.id} layout initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.95}} transition={{delay:idx*0.04}} style={{ marginBottom:'0.625rem' }}>
                  <div style={{ borderRadius:'1rem', padding:'1rem', background:'var(--card)', border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)' }}>
                    {/* Row */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.875rem' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                        <div style={{ width:40, height:40, borderRadius:'0.75rem', background:`${PRIMARY_RAW}14`, border:`1.5px solid ${PRIMARY_RAW}20`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {iconEl}
                        </div>
                        <div>
                          <p style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--foreground)', lineHeight:1.2 }}>{habit.name}</p>
                          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginTop:2 }}>
                            {habit.streak > 0 && (
                              <span style={{ fontSize:'0.75rem', fontWeight:600, color:PRIMARY_RAW, display:'flex', alignItems:'center', gap:3 }}>
                                <Flame size={12} color={PRIMARY_RAW} strokeWidth={2}/> {habit.streak}d
                              </span>
                            )}
                            <span style={{ fontSize:'0.6875rem', color:'var(--muted-foreground)' }}>{Math.round(weekRate)}% this week</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:2 }}>
                        <motion.button whileTap={{scale:0.88}} onClick={() => openEdit(habit)}
                          style={{ width:36,height:36,borderRadius:8,border:'none',background:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',minHeight:36 }}>
                          <Pencil size={15} color="var(--muted-foreground)" strokeWidth={1.8}/>
                        </motion.button>
                        <motion.button whileTap={{scale:0.88}} onClick={() => deleteHabit(habit.id)}
                          style={{ width:36,height:36,borderRadius:8,border:'none',background:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',minHeight:36 }}>
                          <Trash2 size={15} color="var(--destructive)" strokeWidth={1.8}/>
                        </motion.button>
                      </div>
                    </div>
                    {/* 7-day grid */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'0.3rem', marginBottom:'0.625rem' }}>
                      {last7.map(day => {
                        const done = habit.completions[day.date];
                        const isToday = day.date === today;
                        const future = day.date > today;
                        return (
                          <div key={day.date} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                            <span style={{ fontSize:'0.5rem', fontWeight:500, color:'var(--muted-foreground)' }}>{day.name}</span>
                            <motion.button whileTap={future ? undefined : {scale:0.84}} onClick={() => !future && toggleHabit(habit.id, day.date)} disabled={future}
                              style={{ width:'100%', aspectRatio:'1', maxWidth:34, borderRadius:6,
                                border:`1.5px solid ${future ? 'var(--border)' : done ? PRIMARY_RAW : isToday ? `${PRIMARY_RAW}55` : 'var(--border)'}`,
                                background: done ? PRIMARY_RAW : isToday ? `${PRIMARY_RAW}09` : 'transparent',
                                opacity: future ? 0.3 : 1, cursor: future ? 'not-allowed' : 'pointer',
                                display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.14s', minHeight:0 }}>
                              {done ? (
                                <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:'spring',stiffness:400}}>
                                  <Check size={11} color="white" strokeWidth={3}/>
                                </motion.div>
                              ) : (
                                <span style={{ fontSize:'0.5rem', color:'var(--muted-foreground)' }}>{day.num}</span>
                              )}
                            </motion.button>
                          </div>
                        );
                      })}
                    </div>
                    {/* Week progress */}
                    <div style={{ height:2, borderRadius:99, background:'var(--muted)', overflow:'hidden' }}>
                      <motion.div initial={{width:0}} animate={{width:`${weekRate}%`}} transition={{duration:0.8,ease:'easeOut'}}
                        style={{ height:'100%', borderRadius:99, background:PRIMARY_RAW }} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </main>

      {/* Sheets */}
      <AnimatePresence>
        {showAdd && <HabitSheet title="New Habit" name={newName} onNameChange={v=>{setNewName(v);setError('');}} icon={newIcon} onIconChange={setNewIcon} error={error} loading={loading} onCancel={()=>setShowAdd(false)} onSave={addHabit} saveLabel="Add Habit"/>}
      </AnimatePresence>
      <AnimatePresence>
        {showEdit && <HabitSheet title="Edit Habit" name={editName} onNameChange={v=>{setEditName(v);setEditError('');}} icon={editIcon} onIconChange={setEditIcon} error={editError} loading={loading} onCancel={()=>setShowEdit(false)} onSave={saveEdit} saveLabel="Save Changes"/>}
      </AnimatePresence>
    </div>
  );
}

function HabitSheet({ title, name, onNameChange, icon, onIconChange, error, loading, onCancel, onSave, saveLabel }: {
  title:string; name:string; onNameChange:(v:string)=>void; icon:string; onIconChange:(v:string)=>void;
  error:string; loading:boolean; onCancel:()=>void; onSave:()=>void; saveLabel:string;
}) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onCancel}
        style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)' }} />
      <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:340,damping:38}}
        style={{ position:'relative', width:'100%', maxWidth:520, borderRadius:'1.5rem 1.5rem 0 0', background:'var(--card)', borderTop:'1px solid var(--border)', borderLeft:'1px solid var(--border)', borderRight:'1px solid var(--border)', maxHeight:'92dvh', overflowY:'auto', paddingBottom:'calc(env(safe-area-inset-bottom,0px) + 1.5rem)' }}>
        <div style={{ display:'flex', justifyContent:'center', paddingTop:'0.75rem' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'var(--border-strong)' }} />
        </div>
        <div style={{ padding:'0.875rem 1.25rem 0' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
            <h2 style={{ fontSize:'1.0625rem', fontWeight:600, color:'var(--foreground)' }}>{title}</h2>
            <motion.button whileTap={{scale:0.88}} onClick={onCancel} aria-label="Close"
              style={{ width:36,height:36,borderRadius:8,background:'var(--muted)',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',minHeight:36 }}>
              <X size={14} color="var(--muted-foreground)" strokeWidth={2.5}/>
            </motion.button>
          </div>
          {/* Name */}
          <div style={{ marginBottom:'1rem' }}>
            <label style={{ display:'block', fontSize:'0.6875rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--muted-foreground)', marginBottom:'0.375rem' }}>Habit Name</label>
            <input value={name} onChange={e=>onNameChange(e.target.value)} placeholder="e.g. Drink 8 glasses of water" maxLength={30} autoFocus enterKeyHint="done" onKeyDown={e=>e.key==='Enter'&&!loading&&onSave()}
              style={{ width:'100%', height:48, padding:'0 1rem', borderRadius:'0.625rem', border:`1.5px solid ${error?'var(--destructive)':'var(--input-border)'}`, background:'var(--input-bg)', color:'var(--foreground)', fontSize:'0.9375rem', outline:'none' }} />
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:'0.25rem' }}>
              {error && <p style={{ fontSize:'0.75rem', color:'var(--destructive)' }}>{error}</p>}
              <p style={{ fontSize:'0.6875rem', color:'var(--muted-foreground)', marginLeft:'auto' }}>{name.length}/30</p>
            </div>
          </div>
          {/* Icon */}
          <div style={{ marginBottom:'1.25rem' }}>
            <label style={{ display:'block', fontSize:'0.6875rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--muted-foreground)', marginBottom:'0.5rem' }}>Icon</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'0.4rem' }}>
              {HABIT_ICONS.map(({id:iconId}) => {
                const sel = icon === iconId;
                return (
                  <motion.button key={iconId} whileTap={{scale:0.88}} onClick={()=>onIconChange(iconId)}
                    style={{ height:48, borderRadius:'0.625rem', border:`2px solid ${sel?PRIMARY_RAW:'var(--border)'}`, background: sel?`${PRIMARY_RAW}14`:'var(--card)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.14s', minHeight:44 }}>
                    {getIcon(iconId, 22)}
                  </motion.button>
                );
              })}
            </div>
          </div>
          {/* Buttons */}
          <div style={{ display:'flex', gap:'0.75rem' }}>
            <button onClick={onCancel} disabled={loading}
              style={{ flex:1, height:48, borderRadius:'0.875rem', border:'1.5px solid var(--border)', background:'none', color:'var(--foreground)', fontSize:'0.9375rem', fontWeight:500, cursor:'pointer' }}>
              Cancel
            </button>
            <motion.button whileTap={{scale:0.97}} onClick={onSave} disabled={loading}
              style={{ flex:1, height:48, borderRadius:'0.875rem', border:'none', background:PRIMARY_RAW, color:'#fff', fontSize:'0.9375rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {loading ? <Spinner/> : saveLabel}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
