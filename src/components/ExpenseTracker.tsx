import { hapticTap, hapticSuccess } from '../utils/haptic';
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { toast } from 'sonner';
import {
  Utensils, Car, ShoppingBag, Film, Zap, HeartPulse, Plane, BookOpen, Package,
  ArrowLeft, Plus, Trash2, Pencil, TrendingUp, TrendingDown, CreditCard,
  AlertTriangle, Target, Search, X,
} from 'lucide-react';
import type { Expense, Budget } from '../App';

const CATEGORY_ICONS: Record<string, React.FC<{ size?: number; color?: string; strokeWidth?: number }>> = {
  'utensils': Utensils, 'car': Car, 'shopping-bag': ShoppingBag, 'film': Film,
  'zap': Zap, 'heart-pulse': HeartPulse, 'plane': Plane, 'book-open': BookOpen, 'package': Package,
};
function CatIcon({ icon, color, size = 16 }: { icon: string; color: string; size?: number }) {
  const C = CATEGORY_ICONS[icon] || Package;
  return <C size={size} color={color} strokeWidth={1.8} />;
}

interface Props {
  expenses: Expense[]; budgets: Budget[];
  onUpdate: (expenses: Expense[], budgets: Budget[]) => void;
  onBack: () => void; currency: string;
}

const CATS = [
  { name: 'Food & Dining',     emoji: '🍽️', color: '#C9935A', icon: 'utensils'     },
  { name: 'Transportation',    emoji: '🚗',  color: '#7B96B0', icon: 'car'          },
  { name: 'Shopping',          emoji: '🛍️', color: '#9F8ABD', icon: 'shopping-bag' },
  { name: 'Entertainment',     emoji: '🎬',  color: '#B78E79', icon: 'film'         },
  { name: 'Bills & Utilities', emoji: '⚡',  color: '#919F90', icon: 'zap'          },
  { name: 'Healthcare',        emoji: '💊',  color: '#9E7663', icon: 'heart-pulse'  },
  { name: 'Travel',            emoji: '✈️', color: '#7B9BB0', icon: 'plane'        },
  { name: 'Education',         emoji: '📚',  color: '#A0AE9F', icon: 'book-open'    },
  { name: 'Other',             emoji: '📦',  color: '#8A9099', icon: 'package'      },
];
const BDG_COLORS = ['#B78E79','#9F8ABD','#7B96B0','#C9935A','#919F90','#9E7663','#A0AE9F'];
const RUB: React.CSSProperties = { fontFamily: "'Rubik', sans-serif" };

function getBP(b: { period: 'weekly' | 'monthly' }) {
  const t = new Date(); t.setHours(0,0,0,0);
  let s: Date, e: Date;
  if (b.period === 'weekly') {
    const d = t.getDay() === 0 ? -6 : 1 - t.getDay();
    s = new Date(t); s.setDate(t.getDate() + d);
    e = new Date(s); e.setDate(s.getDate() + 6);
  } else {
    s = new Date(t.getFullYear(), t.getMonth(), 1);
    e = new Date(t.getFullYear(), t.getMonth() + 1, 0);
  }
  return { startDate: s, endDate: e };
}

type Tab = 'overview' | 'expenses' | 'budgets' | 'charts';

// ── SVG Donut Chart ──────────────────────────────────────────────────────────
function DonutChart({ slices, total }: { slices: { name: string; color: string; total: number }[]; total: number }) {
  if (total === 0 || slices.length === 0) return null;
  const cx = 70, cy = 70, R = 58, r = 36;
  let cumAngle = -Math.PI / 2;
  const paths = slices.map(item => {
    const sweep = (item.total / total) * 2 * Math.PI;
    const startA = cumAngle;
    const endA = cumAngle + sweep;
    cumAngle = endA;
    const large = sweep > Math.PI ? 1 : 0;
    const osx = cx + R * Math.cos(startA); const osy = cy + R * Math.sin(startA);
    const oex = cx + R * Math.cos(endA);   const oey = cy + R * Math.sin(endA);
    const iex = cx + r * Math.cos(endA);   const iey = cy + r * Math.sin(endA);
    const isx = cx + r * Math.cos(startA); const isy = cy + r * Math.sin(startA);
    return { d: `M ${osx} ${osy} A ${R} ${R} 0 ${large} 1 ${oex} ${oey} L ${iex} ${iey} A ${r} ${r} 0 ${large} 0 ${isx} ${isy} Z`, color: item.color };
  });
  return (
    <svg viewBox="0 0 140 140" style={{ width: 120, height: 120, flexShrink: 0, overflow: 'visible' }}>
      {paths.map((p, i) => <path key={i} d={p.d} fill={p.color}/>)}
    </svg>
  );
}

// ── SVG Monthly Bar Chart ────────────────────────────────────────────────────
function MonthlyBarChart({ expenses, fmt }: { expenses: Expense[]; fmt: (n: number) => string }) {
  const today = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    const total = expenses.filter(e => e.date.startsWith(key)).reduce((s, e) => s + e.amount, 0);
    return { key, label, total, isCurrent: i === 5 };
  });
  const maxVal = Math.max(...months.map(m => m.total), 1);
  const barW = 30, gap = 12, chartH = 100, pad = 4;
  const totalW = pad * 2 + months.length * (barW + gap) - gap;

  return (
    <div>
      <svg viewBox={`0 0 ${totalW} ${chartH + 24}`} style={{ width: '100%', overflow: 'visible' }}>
        {months.map((m, i) => {
          const barH = Math.max(4, (m.total / maxVal) * chartH);
          const x = pad + i * (barW + gap);
          const y = chartH - barH;
          return (
            <g key={m.key}>
              <rect x={x} y={y} width={barW} height={barH} rx={5}
                fill={m.isCurrent ? '#C9935A' : '#C9935A44'}/>
              <text x={x + barW / 2} y={chartH + 14} textAnchor="middle"
                fontSize="9" fill="var(--muted-foreground)" fontFamily="'Rubik', sans-serif">{m.label}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.125rem' }}>
        {months.map(m => (
          <div key={m.key} style={{ flex: 1, textAlign: 'center' }}>
            {m.total > 0 && (
              <p style={{ fontSize: '0.5625rem', fontWeight: m.isCurrent ? 700 : 500, color: m.isCurrent ? '#C9935A' : 'var(--muted-foreground)' }}>
                {fmt(m.total)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExpenseTracker({ expenses, budgets, onUpdate, onBack, currency }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [showAddExp, setShowAddExp]       = useState(false);
  const [showAddBdg, setShowAddBdg]       = useState(false);
  const [showEditExp, setShowEditExp]     = useState(false);
  const [showEditBdg, setShowEditBdg]     = useState(false);
  const [bdgWarn, setBdgWarn] = useState<{ show: boolean; msg: string; expense: Expense | null; isEdit: boolean }>({ show: false, msg: '', expense: null, isEdit: false });

  const defE = () => ({ amount: '', description: '', category: '', date: new Date().toISOString().split('T')[0] });
  const defB = () => ({ name: '', amount: '', period: 'monthly' as const, category: '', color: '#B78E79' });

  const [newE, setNewE] = useState(defE());
  const [editE, setEditE] = useState<Expense | null>(null);
  const [editedE, setEditedE] = useState(defE());
  const [newB, setNewB] = useState(defB());
  const [editB, setEditB] = useState<Budget | null>(null);
  const [editedB, setEditedB] = useState(defB());
  const [expErr, setExpErr] = useState('');
  const [bdgErr, setBdgErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [catF, setCatF] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  const sym = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹' }[currency] || '$';

  const bdgAnalysis = useMemo(() => budgets.map(b => {
    const { startDate, endDate } = getBP(b);
    const today = new Date();
    const rel = expenses.filter(e => {
      const d = new Date(e.date); d.setHours(0,0,0,0);
      return d >= startDate && d <= endDate && (!b.category || e.category === b.category);
    });
    const spent = rel.reduce((s, e) => s + e.amount, 0);
    const rem = b.amount - spent;
    const pct = b.amount > 0 ? Math.min(100, (spent / b.amount) * 100) : 0;
    const dLeft = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / 86400000));
    const totDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    const elapsed = Math.min(totDays, Math.ceil((today.getTime() - startDate.getTime()) / 86400000) + 1);
    const dailyAvg = elapsed > 0 ? spent / elapsed : 0;
    const projected = dailyAvg * totDays;
    return {
      ...b, spent, remaining: rem, percentage: pct, isOverBudget: spent > b.amount,
      daysLeft: dLeft, expenseCount: rel.length, dailyAverage: dailyAvg,
      projectedSpending: projected, onTrack: projected <= b.amount,
      periodStart: startDate.toISOString().split('T')[0], periodEnd: endDate.toISOString().split('T')[0],
    };
  }), [budgets, expenses]);

  const summary = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const ms = new Date(today.getFullYear(), today.getMonth(), 1);
    const lms = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lme = new Date(today.getFullYear(), today.getMonth(), 0);
    const monthly = expenses.filter(e => new Date(e.date) >= ms);
    const lastM = expenses.filter(e => { const d = new Date(e.date); return d >= lms && d <= lme; });
    const mTotal = monthly.reduce((s, e) => s + e.amount, 0);
    const lmTotal = lastM.reduce((s, e) => s + e.amount, 0);
    const allTime = expenses.reduce((s, e) => s + e.amount, 0);
    const mom = lmTotal > 0 ? ((mTotal - lmTotal) / lmTotal) * 100 : null;
    const catTotals = CATS.map(c => ({ ...c, total: monthly.filter(e => e.category === c.name).reduce((s, e) => s + e.amount, 0) })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
    const sorted = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { mTotal, lmTotal, allTime, mom, catTotals, recent: sorted.slice(0, 5) };
  }, [expenses]);

  const filtered = useMemo(() => {
    let f = expenses;
    if (search.trim()) f = f.filter(e => e.description.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase()));
    if (catF !== 'all') f = f.filter(e => e.category === catF);
    return [...f].sort((a, b) => sortBy === 'date' ? new Date(b.date).getTime() - new Date(a.date).getTime() : b.amount - a.amount);
  }, [expenses, search, catF, sortBy]);

  const checkBudget = (expense: Expense, exId?: string) => {
    const warns: string[] = [];
    bdgAnalysis.forEach(b => {
      const { startDate, endDate } = getBP(b);
      const d = new Date(expense.date); d.setHours(0,0,0,0);
      if (d < startDate || d > endDate || (b.category && expense.category !== b.category)) return;
      let base = b.spent;
      if (exId) { const old = expenses.find(e => e.id === exId); if (old) { const od = new Date(old.date); od.setHours(0,0,0,0); if (od >= startDate && od <= endDate && (!b.category || old.category === b.category)) base -= old.amount; } }
      const ns = base + expense.amount;
      if (ns > b.amount) warns.push(`"${b.name}" will be over budget by ${fmt(ns - b.amount)}`);
      else if ((ns / b.amount) >= 0.9) warns.push(`"${b.name}" will reach ${Math.round((ns / b.amount) * 100)}%`);
    });
    return warns;
  };

  const MAX_EXPENSE = 1000000; // 10 lakh
  const validateE = (a: string, d: string, c: string) => {
    const n = parseFloat(a);
    if (!a || isNaN(n) || n <= 0) { setExpErr('Enter a valid amount'); return false; }
    if (n > MAX_EXPENSE) { setExpErr(`Max amount is ${fmt(MAX_EXPENSE)}`); return false; }
    if (!/^\d+(\.\d{1,2})?$/.test(a.trim())) { setExpErr('Use up to 2 decimal places'); return false; }
    if (!d.trim()) { setExpErr('Description is required'); return false; }
    if (!c) { setExpErr('Select a category'); return false; }
    return true;
  };

  const addExpense = () => {
    if (!validateE(newE.amount, newE.description, newE.category)) return;
    const cat = CATS.find(c => c.name === newE.category);
    const e: Expense = { id: Date.now().toString(), amount: parseFloat(newE.amount), description: newE.description.trim(), category: newE.category, date: newE.date, color: cat?.color || '#8A9099' };
    const w = checkBudget(e);
    if (w.length) { setBdgWarn({ show: true, msg: w.join('\n'), expense: e, isEdit: false }); return; }
    doAddExpense(e);
  };
  const doAddExpense = (e: Expense) => {
    setLoading(true);
    setTimeout(() => { onUpdate([...expenses, e], budgets); setNewE(defE()); setExpErr(''); setLoading(false); setShowAddExp(false); setBdgWarn(p => ({ ...p, show: false })); hapticSuccess(); toast.success(`${fmt(e.amount)} logged`); }, 280);
  };
  const openEditExp = (e: Expense) => { setEditE(e); setEditedE({ amount: e.amount.toString(), description: e.description, category: e.category, date: e.date }); setExpErr(''); setShowEditExp(true); };
  const updateExpense = () => {
    if (!editE || !validateE(editedE.amount, editedE.description, editedE.category)) return;
    const cat = CATS.find(c => c.name === editedE.category);
    const u: Expense = { ...editE, amount: parseFloat(editedE.amount), description: editedE.description.trim(), category: editedE.category, date: editedE.date, color: cat?.color || '#8A9099' };
    const w = checkBudget(u, editE.id);
    if (w.length) { setBdgWarn({ show: true, msg: w.join('\n'), expense: u, isEdit: true }); return; }
    doUpdateExpense(u);
  };
  const doUpdateExpense = (u: Expense) => {
    setLoading(true);
    setTimeout(() => { onUpdate(expenses.map(e => e.id === u.id ? u : e), budgets); setShowEditExp(false); setEditE(null); setExpErr(''); setLoading(false); setBdgWarn(p => ({ ...p, show: false })); toast.success('Expense updated'); }, 280);
  };
  const delExpense = (id: string) => { const e = expenses.find(x => x.id === id); const prev = [...expenses]; onUpdate(expenses.filter(x => x.id !== id), budgets); toast.success(`"${e?.description}" deleted`, { action: { label: 'Undo', onClick: () => onUpdate(prev, budgets) }, duration: 5000 }); };

  const MAX_BUDGET = 1000000; // 10 lakh
  const validateB = (n: string, a: string) => {
    const v = parseFloat(a);
    if (!a || isNaN(v) || v <= 0) { setBdgErr('Enter a valid amount'); return false; }
    if (v > MAX_BUDGET) { setBdgErr(`Max budget is ${fmt(MAX_BUDGET)}`); return false; }
    if (!/^\d+(\.\d{1,2})?$/.test(a.trim())) { setBdgErr('Use up to 2 decimal places'); return false; }
    if (!n.trim()) { setBdgErr('Name is required'); return false; }
    if (budgets.some(b => b.name.toLowerCase() === n.trim().toLowerCase() && (!editB || b.id !== editB.id))) { setBdgErr('Name already exists'); return false; }
    return true;
  };
  const addBudget = async () => {
    if (!validateB(newB.name, newB.amount)) return;
    setLoading(true); await new Promise(r => setTimeout(r, 280));
    const b: Budget = { id: Date.now().toString(), name: newB.name.trim(), amount: parseFloat(newB.amount), period: newB.period, category: newB.category || undefined, startDate: new Date().toISOString(), color: newB.color };
    onUpdate(expenses, [...budgets, b]); setNewB(defB()); setBdgErr(''); setLoading(false); setShowAddBdg(false); hapticSuccess(); toast.success(`"${b.name}" created`);
  };
  const openEditBdg = (b: Budget) => { setEditB(b); setEditedB({ name: b.name, amount: b.amount.toString(), period: b.period, category: b.category || '', color: b.color }); setBdgErr(''); setShowEditBdg(true); };
  const updateBudget = async () => {
    if (!editB || !validateB(editedB.name, editedB.amount)) return;
    setLoading(true); await new Promise(r => setTimeout(r, 280));
    const u: Budget = { ...editB, name: editedB.name.trim(), amount: parseFloat(editedB.amount), period: editedB.period, category: editedB.category || undefined, color: editedB.color };
    onUpdate(expenses, budgets.map(b => b.id === editB.id ? u : b)); setShowEditBdg(false); setEditB(null); setBdgErr(''); setLoading(false); toast.success('Budget updated');
  };
  const delBudget = (id: string) => { const b = budgets.find(x => x.id === id); const prev = [...budgets]; onUpdate(expenses, budgets.filter(x => x.id !== id)); toast.success(`"${b?.name}" deleted`, { action: { label: 'Undo', onClick: () => onUpdate(expenses, prev) }, duration: 5000 }); };


  return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', ...RUB }}>

      {/* ── Header ── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--card)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)', padding: 'calc(env(safe-area-inset-top,0px) + 1rem) 1rem 0' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <motion.button whileTap={{ scale: 0.88 }} onClick={onBack} aria-label="Go back"
                style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--muted)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 36 }}>
                <ArrowLeft size={18} color="var(--muted-foreground)" strokeWidth={2}/>
              </motion.button>
              <div>
                <h1 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.1 }}>Expenses</h1>
                <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{expenses.length} logged · {budgets.length} budget{budgets.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Btn onClick={() => { setBdgErr(''); setNewB(defB()); setShowAddBdg(true); }} variant="outline">
                <Target size={14} strokeWidth={2}/> Budget
              </Btn>
              <Btn onClick={() => {
                if (budgets.length === 0) { toast.error('Create a budget first'); setBdgErr(''); setNewB(defB()); setShowAddBdg(true); return; }
                setNewE(defE()); setExpErr(''); setShowAddExp(true);
              }}>
                <Plus size={14} strokeWidth={2.5}/> Add
              </Btn>
            </div>
          </div>
          {/* Tab bar — segmented pill control */}
          <div style={{ display: 'flex', gap: '0.375rem', padding: '0 0 0.875rem', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {([
              { id: 'overview', label: 'Overview' },
              { id: 'expenses', label: `Expenses${expenses.length > 0 ? ` · ${expenses.length}` : ''}` },
              { id: 'budgets',  label: `Budgets${budgets.length > 0 ? ` · ${budgets.length}` : ''}` },
              { id: 'charts',   label: 'Charts' },
            ] as { id: Tab; label: string }[]).map(t => (
              <motion.button key={t.id} onClick={() => { hapticTap(); setTab(t.id); }}
                whileTap={{ scale: 0.95 }}
                style={{ flexShrink: 0, height: 44, padding: '0 1.125rem', borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: tab === t.id ? '#C9935A' : 'var(--muted)',
                  color: tab === t.id ? 'white' : 'var(--muted-foreground)',
                  fontWeight: tab === t.id ? 700 : 500, fontSize: '0.8125rem',
                  boxShadow: tab === t.id ? '0 4px 12px rgba(201,147,90,0.35)' : 'none',
                  transition: 'background 0.18s, color 0.18s, box-shadow 0.18s', minHeight: 44, ...RUB }}>
                {t.label}
              </motion.button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '1rem' }}>
        <AnimatePresence mode="wait">

          {/* ══ OVERVIEW ══ */}
          {tab === 'overview' && (
            <motion.div key="ov" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {/* Hero */}
              <div style={{ borderRadius: '1.25rem', background: 'linear-gradient(135deg, #C8A491, #9E7663)', padding: '1.5rem', marginBottom: '0.75rem', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 28px rgba(183,142,121,0.28)' }}>
                <svg style={{ position: 'absolute', top: -30, right: -30, pointerEvents: 'none' }} width="150" height="150" viewBox="0 0 150 150" fill="none">
                  <circle cx="110" cy="40" r="75" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
                  <circle cx="110" cy="40" r="50" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
                </svg>
                <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: '0.375rem' }}>This Month</p>
                <p style={{ fontSize: '2.75rem', fontWeight: 700, color: 'white', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '0.5rem' }}>{fmt(summary.mTotal)}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  {summary.mom !== null ? (
                    <>{summary.mom > 0 ? <TrendingUp size={14} color="rgba(255,255,255,0.8)" strokeWidth={2}/> : <TrendingDown size={14} color="rgba(255,255,255,0.8)" strokeWidth={2}/>}
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{summary.mom > 0 ? '+' : ''}{summary.mom.toFixed(1)}% vs last month</span></>
                  ) : <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' }}>First month tracked</span>}
                </div>
              </div>
              {/* Stat cards */}
              {(() => {
                const totalRemaining = bdgAnalysis.reduce((s, b) => s + b.remaining, 0);
                const isOver = totalRemaining < 0;
                const remainingColor = bdgAnalysis.length === 0 ? '#919F90' : isOver ? 'var(--destructive)' : '#919F90';
                const remainingSub = bdgAnalysis.length === 0 ? 'no budgets set' : isOver ? `${fmt(Math.abs(totalRemaining))} over budget` : 'across all budgets';
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.75rem' }}>
                    {[
                      { label: 'All-Time', value: fmt(summary.allTime), sub: `${expenses.length} transactions`, color: '#7B96B0' },
                      { label: 'Remaining', value: bdgAnalysis.length === 0 ? '—' : fmt(Math.max(0, totalRemaining)), sub: remainingSub, color: remainingColor },
                    ].map(s => (
                      <div key={s.label} style={{ borderRadius: '1rem', background: 'var(--card)', border: '1px solid var(--border)', padding: '1rem', boxShadow: 'var(--shadow-xs)' }}>
                        <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.375rem' }}>{s.label}</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 700, color: s.color, letterSpacing: '-0.025em' }}>{s.value}</p>
                        <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{s.sub}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {/* Budget summary */}
              {bdgAnalysis.length > 0 && (
                <div style={{ borderRadius: '1.125rem', background: 'var(--card)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '0.75rem', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '0.875rem 1rem 0.625rem', borderBottom: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Budget Status</p>
                  </div>
                  <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    {bdgAnalysis.map(b => (
                      <div key={b.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 9, height: 9, borderRadius: '50%', background: b.color, flexShrink: 0 }}/>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>{b.name}</span>
                            {b.isOverBudget && <span style={{ fontSize: '0.5rem', fontWeight: 700, background: 'var(--destructive-pale)', color: 'var(--destructive)', padding: '2px 5px', borderRadius: 99 }}>OVER</span>}
                          </div>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: b.isOverBudget ? 'var(--destructive)' : 'var(--foreground)' }}>{fmt(b.spent)}<span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>/{fmt(b.amount)}</span></span>
                        </div>
                        <div style={{ height: 4, borderRadius: 99, background: 'var(--muted)', overflow: 'hidden' }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${b.percentage}%` }} transition={{ duration: 0.8 }}
                            style={{ height: '100%', borderRadius: 99, background: b.isOverBudget ? 'var(--destructive)' : b.color }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Category breakdown */}
              {summary.catTotals.length > 0 && (
                <div style={{ borderRadius: '1.125rem', background: 'var(--card)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '0.75rem', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '0.875rem 1rem 0.625rem', borderBottom: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>By Category</p>
                  </div>
                  <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {summary.catTotals.map(c => {
                      const pct = summary.mTotal > 0 ? (c.total / summary.mTotal) * 100 : 0;
                      return (
                        <div key={c.name}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                              <div style={{ width: 28, height: 28, borderRadius: '0.5rem', background: `${c.color}16`, border: `1px solid ${c.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <CatIcon icon={c.icon} color={c.color} size={13}/>
                              </div>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)' }}>{c.name}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: c.color }}>{fmt(c.total)}</span>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginLeft: 4 }}>{Math.round(pct)}%</span>
                            </div>
                          </div>
                          <div style={{ height: 4, borderRadius: 99, background: 'var(--muted)', overflow: 'hidden' }}>
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7 }}
                              style={{ height: '100%', borderRadius: 99, background: c.color }}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Recent */}
              {summary.recent.length > 0 && (
                <div style={{ borderRadius: '1.125rem', background: 'var(--card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '0.875rem 1rem 0.625rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Recent</p>
                    <button onClick={() => { hapticTap(); setTab('expenses'); }} style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#C9935A', background: 'none', border: 'none', cursor: 'pointer', minHeight: 44, padding: '0 0.25rem', ...RUB }}>See all →</button>
                  </div>
                  {summary.recent.map((e, i) => {
                    const cat = CATS.find(c => c.name === e.category);
                    return (
                      <motion.button key={e.id} whileTap={{ scale: 0.99 }} onClick={() => openEditExp(e)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: i < summary.recent.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', textAlign: 'left', minHeight: 44 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '0.75rem', background: `${cat?.color || '#8A9099'}16`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <CatIcon icon={cat?.icon || 'package'} color={cat?.color || '#8A9099'} size={16}/>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{e.description}</p>
                          <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{e.category} · {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        </div>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--foreground)', flexShrink: 0 }}>{fmt(e.amount)}</span>
                      </motion.button>
                    );
                  })}
                </div>
              )}
              {expenses.length === 0 && budgets.length === 0 && (
                <div style={{ textAlign: 'center', padding: '4rem 1.5rem', background: 'var(--card)', borderRadius: '1.125rem', border: '1px solid var(--border)' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '1rem', background: 'rgba(201,147,90,0.10)', border: '1px solid rgba(201,147,90,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                    <CreditCard size={28} color="#C9935A" strokeWidth={1.5}/>
                  </div>
                  <p style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>No budgets yet</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1.5rem', lineHeight: 1.6 }}>Create a budget first, then start tracking your spending.</p>
                  <Btn onClick={() => { setBdgErr(''); setNewB(defB()); setShowAddBdg(true); }}>Create Budget</Btn>
                </div>
              )}
            </motion.div>
          )}

          {/* ══ EXPENSES ══ */}
          {tab === 'expenses' && (
            <motion.div key="ex" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 150px' }}>
                  <Search size={14} color="var(--muted-foreground)" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}/>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                    style={{ ...INP(), paddingLeft: '2.25rem', height: 42 }}/>
                  {search && <button onClick={() => { hapticTap(); setSearch(''); }} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, minWidth: 32, minHeight: 32, padding: 0 }}><X size={13} color="var(--muted-foreground)"/></button>}
                </div>
                <select value={catF} onChange={e => setCatF(e.target.value)} style={{ ...SEL, height: 42, width: 130, fontSize: '0.8125rem' }}>
                  <option value="all">🗂️ All</option>
                  {CATS.map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as 'date' | 'amount')} style={{ ...SEL, height: 42, width: 100, fontSize: '0.8125rem' }}>
                  <option value="date">📅 Date</option>
                  <option value="amount">💰 Amount</option>
                </select>
              </div>
              {filtered.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <AnimatePresence>
                    {filtered.map((e, i) => {
                      const cat = CATS.find(c => c.name === e.category);
                      return (
                        <motion.div key={e.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ delay: i * 0.02 }}
                          style={{ borderRadius: '0.875rem', background: 'var(--card)', border: '1px solid var(--border)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: 'var(--shadow-xs)' }}>
                          <div style={{ width: 40, height: 40, borderRadius: '0.75rem', background: `${cat?.color || '#8A9099'}16`, border: `1px solid ${cat?.color || '#8A9099'}24`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <CatIcon icon={cat?.icon || 'package'} color={cat?.color || '#8A9099'} size={17}/>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{e.description}</p>
                            <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>{e.category} · {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.125rem', flexShrink: 0 }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>{fmt(e.amount)}</span>
                            <motion.button whileTap={{ scale: 0.88 }} onClick={() => { hapticTap(); openEditExp(e); }} style={{ width: 36, height: 36, borderRadius: 7, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 36 }}><Pencil size={14} color="var(--muted-foreground)" strokeWidth={1.8}/></motion.button>
                            <motion.button whileTap={{ scale: 0.88 }} onClick={() => { hapticTap(); delExpense(e.id); }} style={{ width: 36, height: 36, borderRadius: 7, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 36 }}><Trash2 size={14} color="var(--destructive)" strokeWidth={1.8}/></motion.button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '4rem 1.5rem', background: 'var(--card)', borderRadius: '1.125rem', border: '1px solid var(--border)' }}>
                  {expenses.length > 0 ? (
                    <>
                      <Search size={28} color="var(--muted-foreground)" strokeWidth={1.5} style={{ margin: '0 auto 0.75rem', display: 'block' }}/>
                      <p style={{ fontWeight: 600, color: 'var(--foreground)' }}>No results</p>
                      <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: 4 }}>Adjust filters</p>
                    </>
                  ) : (
                    <>
                      <div style={{ width: 64, height: 64, borderRadius: '1rem', background: 'rgba(201,147,90,0.10)', border: '1px solid rgba(201,147,90,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                        <CreditCard size={28} color="#C9935A" strokeWidth={1.5}/>
                      </div>
                      <p style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>No expenses yet</p>
                      <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', lineHeight: 1.6 }}>Log your first expense to start tracking where your money goes.</p>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ══ BUDGETS ══ */}
          {tab === 'budgets' && (
            <motion.div key="bd" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {bdgAnalysis.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {bdgAnalysis.map((b, i) => (
                    <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      style={{ borderRadius: '1.125rem', background: 'var(--card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ height: 4, background: `linear-gradient(90deg, ${b.color}, ${b.color}88)` }}/>
                      <div style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                          <div>
                            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>{b.name}</p>
                            <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginTop: 1 }}>{b.period} · {b.category || 'All categories'}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <motion.button whileTap={{ scale: 0.88 }} onClick={() => { hapticTap(); openEditBdg(b); }} style={{ width: 36, height: 36, borderRadius: 7, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 36 }}><Pencil size={14} color="var(--muted-foreground)" strokeWidth={1.8}/></motion.button>
                            <motion.button whileTap={{ scale: 0.88 }} onClick={() => { hapticTap(); delBudget(b.id); }} style={{ width: 36, height: 36, borderRadius: 7, background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 36 }}><Trash2 size={14} color="var(--destructive)" strokeWidth={1.8}/></motion.button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: b.isOverBudget ? 'var(--destructive)' : b.color, letterSpacing: '-0.025em' }}>{fmt(b.spent)}</span>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)' }}>of {fmt(b.amount)}</p>
                            <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: b.remaining < 0 ? 'var(--destructive)' : 'var(--success)' }}>{b.remaining >= 0 ? `${fmt(b.remaining)} left` : `${fmt(Math.abs(b.remaining))} over`}</p>
                          </div>
                        </div>
                        <div style={{ height: 6, borderRadius: 99, background: 'var(--muted)', overflow: 'hidden', marginBottom: '0.75rem' }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${b.percentage}%` }} transition={{ duration: 0.9 }}
                            style={{ height: '100%', borderRadius: 99, background: b.isOverBudget ? 'var(--destructive)' : `linear-gradient(90deg, ${b.color}cc, ${b.color})` }}/>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem' }}>
                          {[{ l: 'Used', v: `${Math.round(b.percentage)}%`, warn: b.isOverBudget }, { l: 'Expenses', v: b.expenseCount }, { l: 'Days left', v: b.daysLeft }, { l: 'Daily avg', v: fmt(b.dailyAverage) }].map(s => (
                            <div key={s.l} style={{ background: 'var(--muted)', borderRadius: '0.5rem', padding: '0.375rem 0.25rem', textAlign: 'center' }}>
                              <p style={{ fontSize: '0.5rem', color: 'var(--muted-foreground)', marginBottom: 1 }}>{s.l}</p>
                              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: s.warn ? 'var(--destructive)' : 'var(--foreground)' }}>{s.v}</p>
                            </div>
                          ))}
                        </div>
                        {!b.onTrack && !b.isOverBudget && (
                          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(201,147,90,0.08)', border: '1px solid rgba(201,147,90,0.22)', borderRadius: '0.625rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <AlertTriangle size={13} color="var(--warning)" strokeWidth={2}/>
                            <p style={{ fontSize: '0.75rem', color: 'var(--warning)', ...RUB }}>At this pace: {fmt(b.projectedSpending)} by period end</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '4rem 1.5rem', background: 'var(--card)', borderRadius: '1.125rem', border: '1px solid var(--border)' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '1rem', background: 'rgba(145,159,144,0.10)', border: '1px solid rgba(145,159,144,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                    <Target size={28} color="#919F90" strokeWidth={1.5}/>
                  </div>
                  <p style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>No budgets yet</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1.25rem' }}>Create spending limits to stay on track.</p>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Btn onClick={() => { setBdgErr(''); setNewB(defB()); setShowAddBdg(true); }}>Create Budget</Btn>
                  </div>
                </div>
              )}
            </motion.div>
          )}
          {/* ══ CHARTS ══ */}
          {tab === 'charts' && (
            <motion.div key="ch" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {expenses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 1.5rem', background: 'var(--card)', borderRadius: '1.125rem', border: '1px solid var(--border)' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '1rem', background: 'rgba(201,147,90,0.10)', border: '1px solid rgba(201,147,90,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                    <TrendingUp size={28} color="#C9935A" strokeWidth={1.5}/>
                  </div>
                  <p style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>No data yet</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Log some expenses to see your charts.</p>
                </div>
              ) : (
                <>
                  {/* Donut chart — current month by category */}
                  {summary.catTotals.length > 0 && (
                    <div style={{ borderRadius: '1.125rem', background: 'var(--card)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '0.75rem', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ padding: '0.875rem 1rem 0.625rem', borderBottom: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>This Month · By Category</p>
                      </div>
                      <div style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                          <DonutChart slices={summary.catTotals} total={summary.mTotal}/>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {summary.catTotals.map(c => {
                              const pct = summary.mTotal > 0 ? Math.round((c.total / summary.mTotal) * 100) : 0;
                              return (
                                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }}/>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--foreground)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{c.name}</span>
                                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: c.color, flexShrink: 0 }}>{pct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bar chart — last 6 months */}
                  <div style={{ borderRadius: '1.125rem', background: 'var(--card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ padding: '0.875rem 1rem 0.625rem', borderBottom: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Monthly Spending · Last 6 Months</p>
                    </div>
                    <div style={{ padding: '1.25rem 1rem 1rem' }}>
                      <MonthlyBarChart expenses={expenses} fmt={fmt}/>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ══ SHEETS ══ */}
      <AnimatePresence>
        {showAddExp && <Sheet title="Add Expense" onClose={() => { setShowAddExp(false); setNewE(defE()); setExpErr(''); }}>
          <FLD label={`Amount (${sym})`}><input type="number" inputMode="decimal" value={newE.amount} onChange={e => { const v = e.target.value; const n = parseFloat(v); setNewE({ ...newE, amount: v }); if (v !== '' && !isNaN(n) && n > MAX_EXPENSE) { setExpErr(`Max amount is ${fmt(MAX_EXPENSE)}`); } else { setExpErr(''); } }} placeholder="0.00" step="0.01" min="0" max="1000000" style={INP(!!expErr)} autoFocus enterKeyHint="next" onKeyDown={e => ['-','e','E','+'].includes(e.key) && e.preventDefault()}/>{expErr && <p style={{ fontSize: '0.75rem', color: 'var(--destructive)', marginTop: '0.375rem' }}>{expErr}</p>}</FLD>
          <FLD label="Description"><input value={newE.description} onChange={e => { setNewE({ ...newE, description: e.target.value }); setExpErr(''); }} placeholder="What did you spend on?" maxLength={100} style={INP()} enterKeyHint="done"/></FLD>
          <FLD label="Category"><select value={newE.category} onChange={e => { setNewE({ ...newE, category: e.target.value }); setExpErr(''); }} style={SEL}><option value="" disabled>🗂️ Select category</option>{CATS.map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}</select></FLD>
          <FLD label="Date"><input type="date" value={newE.date} onChange={e => setNewE({ ...newE, date: e.target.value })} max={new Date().toISOString().split('T')[0]} style={INP()}/></FLD>
          <SheetActions cancel={() => { setShowAddExp(false); setNewE(defE()); setExpErr(''); }} confirm={addExpense} confirmLabel="Add Expense" loading={loading}/>
        </Sheet>}
      </AnimatePresence>
      <AnimatePresence>
        {showEditExp && <Sheet title="Edit Expense" onClose={() => { setShowEditExp(false); setEditE(null); setExpErr(''); }}>
          <FLD label={`Amount (${sym})`}><input type="number" inputMode="decimal" value={editedE.amount} onChange={e => { const v = e.target.value; const n = parseFloat(v); setEditedE({ ...editedE, amount: v }); if (v !== '' && !isNaN(n) && n > MAX_EXPENSE) { setExpErr(`Max amount is ${fmt(MAX_EXPENSE)}`); } else { setExpErr(''); } }} step="0.01" min="0" max="1000000" style={INP(!!expErr)} enterKeyHint="next" onKeyDown={e => ['-','e','E','+'].includes(e.key) && e.preventDefault()}/>{expErr && <p style={{ fontSize: '0.75rem', color: 'var(--destructive)', marginTop: '0.375rem' }}>{expErr}</p>}</FLD>
          <FLD label="Description"><input value={editedE.description} onChange={e => { setEditedE({ ...editedE, description: e.target.value }); setExpErr(''); }} maxLength={100} style={INP()} enterKeyHint="done"/></FLD>
          <FLD label="Category"><select value={editedE.category} onChange={e => setEditedE({ ...editedE, category: e.target.value })} style={SEL}>{CATS.map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}</select></FLD>
          <FLD label="Date"><input type="date" value={editedE.date} onChange={e => setEditedE({ ...editedE, date: e.target.value })} max={new Date().toISOString().split('T')[0]} style={INP()}/></FLD>
          <SheetActions cancel={() => { setShowEditExp(false); setEditE(null); setExpErr(''); }} confirm={updateExpense} confirmLabel="Update" loading={loading}/>
        </Sheet>}
      </AnimatePresence>
      <AnimatePresence>
        {showAddBdg && <Sheet title="Create Budget" onClose={() => { setShowAddBdg(false); setNewB(defB()); setBdgErr(''); }}>
          <FLD label="Name"><input value={newB.name} onChange={e => { setNewB({ ...newB, name: e.target.value }); setBdgErr(''); }} placeholder="e.g. Monthly Groceries" maxLength={50} style={INP()} autoFocus enterKeyHint="next"/></FLD>
          <FLD label={`Amount (${sym})`}><input type="number" inputMode="decimal" value={newB.amount} onChange={e => { const v = e.target.value; const n = parseFloat(v); setNewB({ ...newB, amount: v }); if (v !== '' && !isNaN(n) && n > MAX_BUDGET) { setBdgErr(`Max budget is ${fmt(MAX_BUDGET)}`); } else { setBdgErr(''); } }} placeholder="0.00" step="0.01" min="0" max="1000000" style={INP(!!bdgErr)} enterKeyHint="done" onKeyDown={e => ['-','e','E','+'].includes(e.key) && e.preventDefault()}/>{bdgErr && <p style={{ fontSize: '0.75rem', color: 'var(--destructive)', marginTop: '0.375rem' }}>{bdgErr}</p>}</FLD>
          <FLD label="Period"><select value={newB.period} onChange={e => setNewB({ ...newB, period: e.target.value as 'weekly'|'monthly' })} style={SEL}><option value="monthly">📅 Monthly</option><option value="weekly">📆 Weekly</option></select></FLD>
          <FLD label="Category (optional)"><select value={newB.category || 'all'} onChange={e => setNewB({ ...newB, category: e.target.value === 'all' ? '' : e.target.value })} style={SEL}><option value="all">🗂️ All categories</option>{CATS.map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}</select></FLD>
          <FLD label="Color"><div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>{BDG_COLORS.map(c => <button key={c} onClick={() => { hapticTap(); setNewB({ ...newB, color: c }); }} style={{ width: 34, height: 34, minWidth: 44, minHeight: 44, borderRadius: '50%', background: c, border: newB.color === c ? `3px solid var(--foreground)` : '2px solid transparent', cursor: 'pointer', outline: newB.color === c ? `2px solid ${c}` : 'none', outlineOffset: 2, transition: 'all 0.15s' }}/>)}</div></FLD>
          <SheetActions cancel={() => { setShowAddBdg(false); setNewB(defB()); setBdgErr(''); }} confirm={addBudget} confirmLabel="Create Budget" loading={loading} color={newB.color}/>
        </Sheet>}
      </AnimatePresence>
      <AnimatePresence>
        {showEditBdg && <Sheet title="Edit Budget" onClose={() => { setShowEditBdg(false); setEditB(null); setBdgErr(''); }}>
          <FLD label="Name"><input value={editedB.name} onChange={e => { setEditedB({ ...editedB, name: e.target.value }); setBdgErr(''); }} maxLength={50} style={INP()} enterKeyHint="next"/></FLD>
          <FLD label={`Amount (${sym})`}><input type="number" inputMode="decimal" value={editedB.amount} onChange={e => { const v = e.target.value; const n = parseFloat(v); setEditedB({ ...editedB, amount: v }); if (v !== '' && !isNaN(n) && n > MAX_BUDGET) { setBdgErr(`Max budget is ${fmt(MAX_BUDGET)}`); } else { setBdgErr(''); } }} step="0.01" min="0" max="1000000" style={INP(!!bdgErr)} enterKeyHint="done" onKeyDown={e => ['-','e','E','+'].includes(e.key) && e.preventDefault()}/>{bdgErr && <p style={{ fontSize: '0.75rem', color: 'var(--destructive)', marginTop: '0.375rem' }}>{bdgErr}</p>}</FLD>
          <FLD label="Period"><select value={editedB.period} onChange={e => setEditedB({ ...editedB, period: e.target.value as 'weekly'|'monthly' })} style={SEL}><option value="monthly">📅 Monthly</option><option value="weekly">📆 Weekly</option></select></FLD>
          <FLD label="Category (optional)"><select value={editedB.category || 'all'} onChange={e => setEditedB({ ...editedB, category: e.target.value === 'all' ? '' : e.target.value })} style={SEL}><option value="all">🗂️ All categories</option>{CATS.map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}</select></FLD>
          <FLD label="Color"><div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>{BDG_COLORS.map(c => <button key={c} onClick={() => { hapticTap(); setEditedB({ ...editedB, color: c }); }} style={{ width: 34, height: 34, minWidth: 44, minHeight: 44, borderRadius: '50%', background: c, border: editedB.color === c ? `3px solid var(--foreground)` : '2px solid transparent', cursor: 'pointer', outline: editedB.color === c ? `2px solid ${c}` : 'none', outlineOffset: 2, transition: 'all 0.15s' }}/>)}</div></FLD>
          <SheetActions cancel={() => { setShowEditBdg(false); setEditB(null); setBdgErr(''); }} confirm={updateBudget} confirmLabel="Update" loading={loading}/>
        </Sheet>}
      </AnimatePresence>

      <AlertDialog open={bdgWarn.show} onOpenChange={o => { if (!o) setBdgWarn(p => ({ ...p, show: false })); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Budget Alert</AlertDialogTitle>
            <AlertDialogDescription style={{ whiteSpace: 'pre-line' }}>{bdgWarn.msg}{'\n\nDo you still want to ' + (bdgWarn.isEdit ? 'update' : 'add') + ' this expense?'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBdgWarn(p => ({ ...p, show: false }))}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (bdgWarn.expense) { bdgWarn.isEdit ? doUpdateExpense(bdgWarn.expense) : doAddExpense(bdgWarn.expense); } }}>
              {bdgWarn.isEdit ? 'Update Anyway' : 'Add Anyway'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Helpers ───────────────────────────────────
function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}/>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 340, damping: 38 }}
        style={{ position: 'relative', width: '100%', maxWidth: 520, borderRadius: '1.5rem 1.5rem 0 0', background: 'var(--card)', borderTop: '1px solid var(--border)', maxHeight: '92dvh', overflowY: 'auto', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 1.5rem)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.75rem', marginBottom: '0.25rem' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)' }}/>
        </div>
        <div style={{ padding: '0.875rem 1.25rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', fontFamily: "'Rubik',sans-serif" }}>{title}</h2>
            <motion.button whileTap={{ scale: 0.88 }} onClick={onClose} style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--muted)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 36 }}>
              <X size={14} color="var(--muted-foreground)" strokeWidth={2.5}/>
            </motion.button>
          </div>
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function Btn({ onClick, children, variant = 'primary', disabled = false, color }: any) {
  return (
    <motion.button whileTap={{ scale: 0.96 }} onClick={onClick} disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', padding: '0 1.125rem', height: 42, borderRadius: '0.75rem',
        border: variant === 'outline' ? '1.5px solid var(--border)' : 'none',
        background: variant === 'primary' ? (color || '#C9935A') : variant === 'outline' ? 'transparent' : 'var(--muted)',
        color: variant === 'primary' ? 'white' : 'var(--foreground)', fontSize: '0.875rem', fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, minHeight: 44, ...RUB }}>
      {children}
    </motion.button>
  );
}
function FLD({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.375rem' }}>{label}</label>
      {children}
    </div>
  );
}
const INP = (err?: boolean): React.CSSProperties => ({ width: '100%', height: 50, padding: '0 1rem', borderRadius: '0.75rem', border: `1.5px solid ${err ? 'var(--destructive)' : 'var(--input-border)'}`, background: 'var(--input-bg)', color: 'var(--foreground)', fontSize: '0.9375rem', outline: 'none', ...RUB });
const SEL: React.CSSProperties = { height: 50, borderRadius: '0.75rem', border: '1.5px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--foreground)', paddingLeft: '1rem', width: '100%', ...RUB };

function SheetActions({ cancel, confirm, confirmLabel, loading, color }: { cancel: () => void; confirm: () => void; confirmLabel: string; loading: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
      <button onClick={cancel} style={{ flex: 1, height: 48, borderRadius: '0.875rem', border: '1.5px solid var(--border)', background: 'none', color: 'var(--foreground)', fontSize: '0.9375rem', fontWeight: 500, cursor: 'pointer', fontFamily: "'Rubik',sans-serif" }}>Cancel</button>
      <motion.button whileTap={{ scale: 0.97 }} onClick={confirm} disabled={loading}
        style={{ flex: 1, height: 48, borderRadius: '0.875rem', border: 'none', background: color || '#C9935A', color: 'white', fontSize: '0.9375rem', fontWeight: 700, cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Rubik',sans-serif" }}>
        {loading ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/> : confirmLabel}
      </motion.button>
    </div>
  );
}
