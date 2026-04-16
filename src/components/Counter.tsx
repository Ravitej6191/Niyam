import { hapticTap } from '../utils/haptic';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hash } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { toast } from 'sonner';
import type { SavedCount } from '../App';

interface CounterProps {
  savedCounts: SavedCount[];
  onUpdate: (savedCounts: SavedCount[]) => void;
  onBack: () => void;
}

const MAX_VALUE = 999999999;

type CounterView = 'list' | 'counting';

export default function Counter({ savedCounts, onUpdate, onBack }: CounterProps) {
  // Which counter is active: null means "new unsaved counter", or the id of a SavedCount
  const [activeCounterId, setActiveCounterId] = useState<string | null>(null);
  // temporary count for the current session (before saving)
  const [sessionValue, setSessionValue] = useState(0);
  const [view, setView] = useState<CounterView>('list');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [labelError, setLabelError] = useState('');
  const [showDeleteId, setShowDeleteId] = useState<string | null>(null);
  const [stepSize, setStepSize] = useState(1);

  const activeCounter = activeCounterId ? savedCounts.find(c => c.id === activeCounterId) ?? null : null;
  const currentValue = activeCounter ? activeCounter.value : sessionValue;

  const increment = () => { hapticTap();
    if (currentValue >= MAX_VALUE) return;
    const next = Math.min(MAX_VALUE, currentValue + stepSize);
    if (activeCounter) {
      onUpdate(savedCounts.map(c => c.id === activeCounter.id ? { ...c, value: next } : c));
    } else {
      setSessionValue(next);
    }
  };

  const decrement = () => { hapticTap();
    if (currentValue <= 0) return;
    const next = Math.max(0, currentValue - stepSize);
    if (activeCounter) {
      onUpdate(savedCounts.map(c => c.id === activeCounter.id ? { ...c, value: next } : c));
    } else {
      setSessionValue(next);
    }
  };

  const resetCounter = () => {
    if (activeCounter) {
      onUpdate(savedCounts.map(c => c.id === activeCounter.id ? { ...c, value: 0 } : c));
      toast.success(`"${activeCounter.label}" reset to 0`);
    } else {
      setSessionValue(0);
    }
  };

  const openCounter = (counter: SavedCount) => {
    setActiveCounterId(counter.id);
    setView('counting');
  };

  const openNewCounter = () => {
    // Start a brand-new unsaved counter
    setActiveCounterId(null);
    setSessionValue(0);
    setView('counting');
  };

  const saveSessionAsNew = () => {
    setNewLabel('');
    setLabelError('');
    setShowNewDialog(true);
  };

  const confirmSaveNew = () => {
    const label = newLabel.trim();
    if (!label) { setLabelError('Name is required'); return; }
    if (label.length > 50) { setLabelError('Max 50 characters'); return; }
    if (savedCounts.some(c => c.label.toLowerCase() === label.toLowerCase())) {
      setLabelError('A counter with this name already exists'); return;
    }
    const newCounter: SavedCount = {
      id: Date.now().toString(),
      label,
      value: sessionValue,
      date: new Date().toISOString(),
    };
    const updated = [newCounter, ...savedCounts];
    onUpdate(updated);
    setActiveCounterId(newCounter.id);
    setSessionValue(0);
    setShowNewDialog(false);
    setView('counting');
    toast.success(`"${label}" created`);
  };

  const deleteCounter = (id: string) => {
    const counter = savedCounts.find(c => c.id === id);
    if (!counter) { setShowDeleteId(null); return; }
    onUpdate(savedCounts.filter(c => c.id !== id));
    if (activeCounterId === id) { setView('list'); setActiveCounterId(null); }
    setShowDeleteId(null);
    toast.success(`"${counter.label}" deleted`);
  };

  const closeCounter = () => {
    setView('list');
    setActiveCounterId(null);
    setSessionValue(0);
  };

  const formatCount = (n: number) => n.toLocaleString();

  // ── LIST VIEW ──────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-background" style={{ minHeight: '100dvh' }}>
        <header style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: 'var(--card)', borderBottom: '1px solid var(--border)',
          padding: 'calc(env(safe-area-inset-top, 0px) + 1rem) 1rem 0.875rem',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ maxWidth: 672, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <motion.button whileTap={{ scale: 0.88 }} onClick={onBack} aria-label="Go back"
                style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--muted)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 36 }}>
                <svg width="18" height="18" fill="none" stroke="var(--muted-foreground)" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              <div>
                <h1 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.1 }}>Counter</h1>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', lineHeight: 1 }}>{savedCounts.length} counter{savedCounts.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <motion.button whileTap={{ scale: 0.94 }} onClick={openNewCounter}
                style={{ padding: '0.5rem 0.875rem', borderRadius: '0.75rem', border: '1.5px solid var(--border)', background: 'none', color: 'var(--foreground)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: "'Rubik', sans-serif", minHeight: 44 }}>
                Quick Count
              </motion.button>
              <motion.button whileTap={{ scale: 0.94 }} onClick={saveSessionAsNew}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.75rem', border: 'none', background: '#4C6E8A', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Rubik', sans-serif", minHeight: 44 }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New
              </motion.button>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-4">
          {savedCounts.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
              <div style={{ width: 56, height: 56, borderRadius: '1rem', background: 'rgba(76,110,138,0.1)', border: '1px solid rgba(76,110,138,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Hash size={28} color="#4C6E8A" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-semibold mb-1">No counters yet</h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Track anything that has a number — reps, pages, glasses of water, cold showers.
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <AnimatePresence>
                {savedCounts.map((counter, i) => (
                  <motion.div key={counter.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.04 }}>
                    <Card className="p-4 cursor-pointer active:scale-[0.99] transition-all border border-border/60"
                      onClick={() => openCounter(counter)}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{counter.label}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Last updated {new Date(counter.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-3">
                          <span className="text-2xl font-bold text-foreground tabular-nums">{formatCount(counter.value)}</span>
                          <button onClick={e => { e.stopPropagation(); setShowDeleteId(counter.id); }}
                            aria-label="Delete counter"
                            className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-destructive transition-colors flex-shrink-0"
                            style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </main>

        {/* New counter name dialog */}
        {showNewDialog && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNewDialog(false)} />
            <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
              className="relative w-full max-w-sm mx-3 mb-4 sm:mb-0 bg-card rounded-2xl border border-border shadow-2xl p-5">
              <h2 className="text-base font-semibold mb-1">Name Your Counter</h2>
              <p className="text-sm text-muted-foreground mb-4">Give it a name so you can find and continue it later.</p>
              <div style={{ '--ring': '#4C6E8A', '--input': 'rgba(76,110,138,0.4)' } as React.CSSProperties}>
                <Input value={newLabel} onChange={e => { setNewLabel(e.target.value); setLabelError(''); }}
                  placeholder="e.g. Push-ups, Pages read, Cups of water…"
                  className="h-11 mb-1" maxLength={50} autoFocus enterKeyHint="done"
                  onKeyDown={e => e.key === 'Enter' && confirmSaveNew()} />
              </div>
              {labelError && <p className="text-sm text-destructive mb-3">{labelError}</p>}
              {sessionValue > 0 && <p className="text-xs text-muted-foreground mb-3">Starting value: <span className="font-semibold">{formatCount(sessionValue)}</span></p>}
              <div className="flex gap-3 mt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowNewDialog(false)}>Cancel</Button>
                <Button className="flex-1" style={{ background: '#4C6E8A', borderColor: '#4C6E8A' }} onClick={confirmSaveNew}>Create</Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete confirm */}
        {showDeleteId && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteId(null)} />
            <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
              className="relative w-full max-w-sm mx-3 mb-4 sm:mb-0 bg-card rounded-2xl border border-border shadow-2xl p-5">
              <h2 className="text-base font-semibold mb-1">Delete Counter?</h2>
              <p className="text-sm text-muted-foreground mb-4">
                "{savedCounts.find(c => c.id === showDeleteId)?.label}" and its count will be permanently deleted.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowDeleteId(null)}>Cancel</Button>
                <Button variant="destructive" className="flex-1" onClick={() => deleteCounter(showDeleteId)}>Delete</Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  // ── COUNTING VIEW ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-background" style={{ minHeight: '100dvh' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--card)', borderBottom: '1px solid var(--border)',
        padding: 'calc(env(safe-area-inset-top, 0px) + 1rem) 1rem 0.875rem',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 672, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <motion.button whileTap={{ scale: 0.88 }} onClick={closeCounter} aria-label="Go back"
              style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--muted)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 36 }}>
              <svg width="18" height="18" fill="none" stroke="var(--muted-foreground)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
            <div>
              <h1 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.1 }}>{activeCounter?.label ?? 'Quick Count'}</h1>
              {activeCounter && <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', lineHeight: 1 }}>Changes saved automatically</p>}
            </div>
          </div>
          {!activeCounter && (
            <motion.button whileTap={{ scale: 0.94 }} onClick={saveSessionAsNew}
              style={{ padding: '0.5rem 0.875rem', borderRadius: '0.75rem', border: '1.5px solid var(--border)', background: 'none', color: 'var(--foreground)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: "'Rubik', sans-serif", minHeight: 44 }}>
              Save Counter
            </motion.button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <div className="flex flex-col items-center py-8">
          {/* Count display */}
          <motion.div
            key={currentValue}
            initial={{ scale: 1.15, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="font-bold text-foreground tabular-nums mb-2 select-none"
            style={{
              fontSize: currentValue.toString().length > 6
                ? currentValue.toString().length > 8 ? '3rem' : '4rem'
                : '5rem',
              lineHeight: 1.1,
            }}
          >
            {formatCount(currentValue)}
          </motion.div>

          {currentValue >= MAX_VALUE && (
            <p className="text-sm text-muted-foreground mb-4">Maximum reached</p>
          )}

          {/* +/- buttons */}
          <div className="flex items-center gap-8 mt-8 mb-10">
            <motion.button whileTap={{ scale: 0.92 }}
              onClick={decrement} disabled={currentValue <= 0}
              aria-label="Decrement"
              className="w-20 h-20 rounded-full border-2 border-border bg-card text-3xl font-light text-foreground disabled:opacity-30 flex items-center justify-center shadow-sm active:shadow-none transition-all select-none">
              −
            </motion.button>
            <motion.button whileTap={{ scale: 0.92 }}
              onClick={increment} disabled={currentValue >= MAX_VALUE}
              aria-label="Increment"
              className="w-24 h-24 rounded-full text-white text-4xl font-light disabled:opacity-30 flex items-center justify-center shadow-lg active:shadow-sm transition-all select-none"
              style={{ background: '#4C6E8A' }}>
              +
            </motion.button>
          </div>

          {/* Reset */}
          <Button variant="outline" onClick={resetCounter} disabled={currentValue === 0} className="w-32" aria-label="Reset counter">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset
          </Button>

          {/* Step size selector */}
          <div className="mt-8 w-full">
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.5rem', textAlign: 'center' }}>Step Size</p>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              {[1, 5, 10, 25, 50, 100].map(s => (
                <button key={s} onClick={() => { hapticTap(); setStepSize(s); }}
                  aria-label={`Step size ${s}`}
                  style={{ flex: 1, minHeight: 44, borderRadius: '0.625rem', border: `1.5px solid ${stepSize === s ? '#4C6E8A' : 'var(--border)'}`, background: stepSize === s ? 'rgba(76,110,138,0.1)' : 'var(--card)', color: stepSize === s ? '#4C6E8A' : 'var(--muted-foreground)', fontSize: '0.8125rem', fontWeight: stepSize === s ? 700 : 400, cursor: 'pointer', fontFamily: "'Rubik', sans-serif", transition: 'all 0.15s' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Other counters quick-switch */}
          {savedCounts.length > 1 && (
            <div className="mt-10 w-full">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Other Counters</p>
              <div className="grid grid-cols-1 gap-2">
                {savedCounts.filter(c => c.id !== activeCounterId).map(c => (
                  <button key={c.id} onClick={() => { setActiveCounterId(c.id); }}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-border/60 bg-card hover:bg-accent/30 transition-colors text-left">
                    <span className="text-sm font-medium text-foreground truncate">{c.label}</span>
                    <span className="text-sm font-bold text-muted-foreground tabular-nums ml-3">{formatCount(c.value)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Save dialog (for quick count) */}
      {showNewDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNewDialog(false)} />
          <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-sm mx-3 mb-4 sm:mb-0 bg-card rounded-2xl border border-border shadow-2xl p-5">
            <h2 className="text-base font-semibold mb-1">Name Your Counter</h2>
            <p className="text-sm text-muted-foreground mb-4">Save with a name to continue later.</p>
            <div style={{ '--ring': '#4C6E8A', '--input': 'rgba(76,110,138,0.4)' } as React.CSSProperties}>
              <Input value={newLabel} onChange={e => { setNewLabel(e.target.value); setLabelError(''); }}
                placeholder="e.g. Push-ups, Pages read…" className="h-11 mb-1" maxLength={50} autoFocus enterKeyHint="done"
                onKeyDown={e => e.key === 'Enter' && confirmSaveNew()} />
            </div>
            {labelError && <p className="text-sm text-destructive mb-1">{labelError}</p>}
            {sessionValue > 0 && <p className="text-xs text-muted-foreground mb-1">Current count: <span className="font-semibold">{formatCount(sessionValue)}</span></p>}
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowNewDialog(false)}>Cancel</Button>
              <Button className="flex-1" style={{ background: '#4C6E8A', borderColor: '#4C6E8A' }} onClick={confirmSaveNew}>Save</Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
