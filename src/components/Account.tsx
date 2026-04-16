import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Pencil, X, Download, Upload, Trash2, ChevronRight, Sun, Moon, Monitor, LogOut, Cloud, Lock, LockOpen, Fingerprint } from 'lucide-react';
import { isPinSet, setPin, removePin, verifyPin, PinNumpad } from './PinLock';
import { isBiometricEnabled, setBiometricEnabled } from '../utils/biometric';
import { Switch } from './ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import ThemeToggle from './ThemeToggle';
import type { User } from 'firebase/auth';
import type { UserProfile, AppSettings, AppStats, AppState } from '../App';

interface AccountProps {
  userProfile: UserProfile;
  stats: AppStats;
  settings: AppSettings;
  appState: AppState;
  onUpdate: (updates: Partial<AppState>) => void;
  firebaseUser: User | null;
  onSignOut: () => void;
  biometricSupported?: boolean;
  onClearAll: () => Promise<void>;
  isGuest?: boolean;
}

function Spinner() {
  return <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />;
}

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.875rem 1rem' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--foreground)', lineHeight: 1.2 }}>{label}</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2, lineHeight: 1.3 }}>{desc}</p>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}
function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '0 1rem' }} />;
}
const NSEL: React.CSSProperties = {
  height: 44, width: 128, paddingLeft: '0.75rem',
  borderRadius: '0.5rem', border: '1px solid var(--input-border)',
  backgroundColor: 'var(--input-bg)', color: 'var(--foreground)',
  fontSize: '0.875rem', fontFamily: "'Rubik', sans-serif",
};
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '0.875rem' }}>
      <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>{title}</p>
      <div style={{ borderRadius: '1rem', background: 'var(--card)', border: '1px solid var(--border)', overflow: 'hidden' }} className="card-sm">
        {children}
      </div>
    </div>
  );
}

export default function Account({ userProfile, stats, settings, appState, onUpdate, firebaseUser, onSignOut, biometricSupported, onClearAll, isGuest }: AccountProps) {
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editedProfile, setEditedProfile]     = useState(userProfile);
  const [profileError, setProfileError]       = useState('');
  const [exportLoading, setExportLoading]     = useState(false);
  const [importLoading, setImportLoading]     = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // PIN management
  type PinSheet = null | 'set' | 'change' | 'remove';
  type PinStep  = 'current' | 'new' | 'confirm';
  const [pinSheet, setPinSheet]   = useState<PinSheet>(null);
  const [pinStep, setPinStep]     = useState<PinStep>('new');
  const [pinDigits, setPinDigits] = useState('');
  const [pinFirst, setPinFirst]   = useState('');   // stores 'new' PIN during confirm step
  const [pinError, setPinError]   = useState('');
  const [pinShake, setPinShake]   = useState(false);
  const [pinEnabled, setPinEnabled] = useState(isPinSet());
  const [bioEnabled, setBioEnabled] = useState(isBiometricEnabled());

  const handleBiometricToggle = (v: boolean) => {
    setBiometricEnabled(v);
    setBioEnabled(v);
    toast.success(v ? 'Biometric lock enabled' : 'Biometric lock disabled');
  };

  const resetPinSheet = () => { setPinSheet(null); setPinDigits(''); setPinFirst(''); setPinError(''); setPinShake(false); };

  const handlePinDigit = (d: string) => {
    if (pinShake || pinDigits.length >= 4) return;
    const next = pinDigits + d;
    setPinDigits(next);
    if (next.length < 4) return;

    // Verify current PIN step (for change/remove flows)
    if (pinStep === 'current') {
      if (!verifyPin(next)) {
        setPinShake(true);
        setPinError('Incorrect PIN');
        setTimeout(() => { setPinDigits(''); setPinShake(false); setPinError(''); }, 600);
        return;
      }
      if (pinSheet === 'remove') {
        removePin();
        setPinEnabled(false);
        resetPinSheet();
        toast.success('App lock removed');
        return;
      }
      // Move to new PIN step for 'change'
      setPinStep('new');
      setPinDigits('');
      setPinError('');
      return;
    }

    // New PIN step — store and move to confirm
    if (pinStep === 'new') {
      setPinFirst(next);
      setPinStep('confirm');
      setPinDigits('');
      return;
    }

    // Confirm step — must match pinFirst
    if (next !== pinFirst) {
      setPinShake(true);
      setPinError('PINs do not match');
      setTimeout(() => { setPinDigits(''); setPinShake(false); setPinError(''); setPinStep('new'); setPinFirst(''); }, 700);
      return;
    }
    setPin(next);
    setPinEnabled(true);
    resetPinSheet();
    toast.success(pinSheet === 'change' ? 'PIN updated' : 'App lock enabled');
  };

  const handlePinDelete = () => {
    if (pinShake) return;
    setPinDigits(d => d.slice(0, -1));
  };

  const openPinSheet = (mode: PinSheet) => {
    setPinSheet(mode);
    setPinStep(mode === 'set' ? 'new' : 'current');
    setPinDigits(''); setPinFirst(''); setPinError(''); setPinShake(false);
  };

  const pinStepLabel: Record<PinStep, string> = {
    current: 'Enter current PIN',
    new:     'Enter new 4-digit PIN',
    confirm: 'Confirm new PIN',
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    onUpdate({ settings: { ...settings, [key]: value } });

  const updateFontSize = (fs: 'small' | 'medium' | 'large') => {
    const root = document.documentElement;
    root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    root.classList.add('font-size-' + fs);
    updateSetting('fontSize', fs);
  };

  const updateCurrency = (v: AppSettings['currency']) =>
    onUpdate({ settings: { ...settings, currency: v }, userProfile: { ...userProfile, preferences: { ...userProfile.preferences, currency: v } } });


  const saveProfile = () => {
    if (!editedProfile.name.trim()) { setProfileError('Name cannot be empty'); return; }
    if (editedProfile.name.trim().length > 30) { setProfileError('Max 30 characters'); return; }
    onUpdate({ userProfile: { ...editedProfile, name: editedProfile.name.trim() } });
    setShowEditProfile(false);
    setProfileError('');
    toast.success('Profile updated');
  };

  const exportData = async () => {
    setExportLoading(true);
    try {
      await new Promise(r => setTimeout(r, 600));
      const blob = new Blob([JSON.stringify({ ...appState, exportedAt: new Date().toISOString(), version: '6.0.0' }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `niyam-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch { toast.error('Export failed'); } finally { setExportLoading(false); }
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportLoading(true);
    try {
      const raw = JSON.parse(await file.text());
      if (!raw.habits || !Array.isArray(raw.habits)) throw new Error('Invalid format');
      await new Promise(r => setTimeout(r, 500));
      const migrated: Partial<AppState> = {
        habits: (raw.habits || []).map((h: any) => ({ ...h, bestStreak: h.bestStreak ?? h.streak ?? 0 })),
        expenses: raw.expenses || [], budgets: raw.budgets || [], notes: raw.notes || [],
        savedCounts: raw.savedCounts || [],
        focusSessions: raw.focusSessions || [], reminders: raw.reminders || [],
        moods: raw.moods || [], breathingSessions: raw.breathingSessions || [],
        journalLogs: raw.journalLogs || [],
        journalSettings: raw.journalSettings || undefined,
        lastSeenAchievements: raw.lastSeenAchievements ?? 0,
      };
      if (raw.userProfile) migrated.userProfile = { name: raw.userProfile.name || 'User', avatar: raw.userProfile.avatar || 'default', joinDate: raw.userProfile.joinDate || new Date().toISOString(), bio: raw.userProfile.bio || '', location: raw.userProfile.location || '', preferences: { notifications: true, language: 'en', currency: 'INR', ...raw.userProfile.preferences } };
      if (raw.settings) migrated.settings = { theme: 'system', fontSize: 'medium', currency: 'INR', language: 'en', notifications: { habits: true, budgets: true, reminders: true, achievements: true }, privacy: { analytics: false, crashReports: true, dataSharing: false }, advanced: { autoBackup: false, compactView: false, animations: true }, ...raw.settings };
      onUpdate(migrated);
      toast.success('Data imported successfully');
    } catch { toast.error('Import failed — check file format'); }
    finally { setImportLoading(false); e.target.value = ''; }
  };

  const clearAllData = async () => {
    await onClearAll();
  };

  const statItems = [
    { v: stats.totalHabits,  l: 'Habits',   c: 'var(--primary)' },
    { v: stats.longestStreak,l: 'Streak',   c: 'var(--warning)' },
    { v: stats.daysUsing,    l: 'Days',     c: 'var(--success)' },
    { v: stats.totalExpenses,l: 'Expenses', c: 'var(--mod-habits)' },
    { v: stats.totalNotes,   l: 'Notes',    c: '#8B5CF6' },
  ];

  // Google photo takes priority over custom avatar
  const googlePhoto = firebaseUser?.photoURL;
  const avatarSrc = googlePhoto || (userProfile.avatar.startsWith('data:') ? userProfile.avatar : null);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', fontFamily: "'Rubik', sans-serif" }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--card)', borderBottom: '1px solid var(--border)',
        padding: 'calc(env(safe-area-inset-top,0px) + 1rem) 1rem 0.875rem',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.125rem' }}>Your Space</p>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>Profile</h1>
          </motion.div>
        </div>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '1rem' }}>

        {/* ── Profile card ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={{ marginBottom: '0.875rem' }}>
          <div style={{ borderRadius: '1rem', background: 'var(--card)', border: '1px solid var(--border)', overflow: 'hidden' }} className="card-sm">
            <div style={{ padding: '1.5rem 1.25rem 1.125rem', textAlign: 'center', position: 'relative' }}>
              {/* Avatar */}
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: '0.875rem' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--border)', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {avatarSrc
                    ? <img src={avatarSrc} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                    : <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  }
                </div>
              </div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: userProfile.bio ? '0.25rem' : '0.75rem' }}>
                {userProfile.name}
              </h2>
              {userProfile.bio && <p style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginBottom: '0.25rem', lineHeight: 1.5, maxWidth: '20rem', margin: '0 auto 0.375rem' }}>{userProfile.bio}</p>}
              {userProfile.location && <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '0.625rem' }}>{userProfile.location}</p>}
              <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginBottom: '0.875rem' }}>
                Member since {new Date(userProfile.joinDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
              <motion.button whileTap={{ scale: 0.94 }}
                onClick={() => { setEditedProfile(userProfile); setProfileError(''); setShowEditProfile(true); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', borderRadius: '0.75rem', border: '1.5px solid var(--border)', background: 'none', color: 'var(--foreground)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>
                <Pencil size={14} strokeWidth={2} />
                Edit Profile
              </motion.button>
            </div>
            {/* Stats strip */}
            <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
              {statItems.map((s, i) => (
                <div key={s.l} style={{ flex: 1, textAlign: 'center', padding: '0.75rem 0.25rem', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <p style={{ fontSize: '1.0625rem', fontWeight: 700, color: s.c, lineHeight: 1.1 }}>{s.v}</p>
                  <p style={{ fontSize: '0.5625rem', color: 'var(--muted-foreground)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }}>{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Appearance ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Section title="Appearance">
            <Row label="Theme" desc="Light, dark, or system default">
              <ThemeToggle onChange={t => updateSetting('theme', t)} />
            </Row>
            <Divider />
            <Row label="Font Size" desc="Text size across the app">
              <select value={settings.fontSize} onChange={e => updateFontSize(e.target.value as 'small'|'medium'|'large')} style={NSEL}>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </Row>
            <Divider />
            <Row label="Animations" desc="Smooth transitions and motion">
              <Switch checked={settings.advanced.animations} onCheckedChange={v => updateSetting('advanced', { ...settings.advanced, animations: v })} />
            </Row>
          </Section>
        </motion.div>

        {/* ── Preferences ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Section title="Preferences">
            <Row label="Language" desc="More languages coming soon">
              <span style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', padding: '0.5rem 0.875rem', background: 'var(--muted)', borderRadius: '0.5rem', fontFamily: 'inherit' }}>English</span>
            </Row>
            <Divider />
            <Row label="Currency" desc="Used in Expense Tracker">
              <select value={settings.currency} onChange={e => updateCurrency(e.target.value as AppSettings['currency'])} style={NSEL}>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </Row>
          </Section>
        </motion.div>

        {/* ── Notifications ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Section title="Notifications">
            {([
              { key: 'habits'       as const, label: 'Habit Reminders',   desc: 'Daily habit check-in prompts'    },
              { key: 'budgets'      as const, label: 'Budget Alerts',      desc: 'When nearing spending limits'    },
              { key: 'reminders'    as const, label: 'General Reminders',  desc: 'Tips and motivational nudges'    },
              { key: 'achievements' as const, label: 'Achievements',       desc: 'Unlocked milestone alerts'       },
            ] as const).map((item, i, arr) => (
              <React.Fragment key={item.key}>
                <Row label={item.label} desc={item.desc}>
                  <Switch checked={settings.notifications[item.key]} onCheckedChange={v => updateSetting('notifications', { ...settings.notifications, [item.key]: v })} />
                </Row>
                {i < arr.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </Section>
        </motion.div>

        {/* ── Security ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <Section title="Security">
            <Row label="App Lock" desc={pinEnabled ? 'PIN required on every launch' : 'Lock app with a 4-digit PIN'}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {pinEnabled && (
                  <motion.button whileTap={{ scale: 0.94 }} onClick={() => openPinSheet('change')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', borderRadius: '0.75rem', border: '1.5px solid var(--border)', background: 'none', color: 'var(--foreground)', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>
                    <Pencil size={13} strokeWidth={2}/> Change
                  </motion.button>
                )}
                <motion.button whileTap={{ scale: 0.94 }} onClick={() => openPinSheet(pinEnabled ? 'remove' : 'set')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.75rem', border: 'none', background: pinEnabled ? '#DC2626' : 'var(--primary)', color: '#fff', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>
                  {pinEnabled ? <><LockOpen size={13} strokeWidth={2}/> Remove</> : <><Lock size={13} strokeWidth={2}/> Enable</>}
                </motion.button>
              </div>
            </Row>
            {biometricSupported && (
              <>
                <Divider />
                <Row
                  label="Biometric Lock"
                  desc={bioEnabled ? 'Fingerprint unlocks the app' : 'Use fingerprint as app lock'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Fingerprint size={16} color={bioEnabled ? 'var(--primary)' : 'var(--muted-foreground)'} strokeWidth={1.8} />
                    <Switch checked={bioEnabled} onCheckedChange={handleBiometricToggle} />
                  </div>
                </Row>
              </>
            )}
          </Section>
        </motion.div>

        {/* ── Data & Storage ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Section title="Data & Storage">
            <Row label="Export Backup" desc="Download a JSON backup of your data">
              <motion.button whileTap={{ scale: 0.94 }} onClick={exportData} disabled={exportLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.75rem', border: '1.5px solid var(--border)', background: 'none', color: 'var(--foreground)', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44, minWidth: 88, justifyContent: 'center' }}>
                {exportLoading ? <Spinner /> : <><Download size={14} strokeWidth={2} /> Export</>}
              </motion.button>
            </Row>
            <Divider />
            <Row label="Import Backup" desc="Restore from a backup file">
              <div style={{ position: 'relative' }}>
                <input ref={importInputRef} type="file" accept=".json" onChange={importData} disabled={importLoading} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', zIndex: 10 }} />
                <motion.button whileTap={{ scale: 0.94 }} disabled={importLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.75rem', border: '1.5px solid var(--border)', background: 'none', color: 'var(--foreground)', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44, minWidth: 88, justifyContent: 'center' }}>
                  {importLoading ? <Spinner /> : <><Upload size={14} strokeWidth={2} /> Import</>}
                </motion.button>
              </div>
            </Row>
          </Section>
        </motion.div>

        {/* ── Account ── */}
        {isGuest ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
            <Section title="Account">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.2 }}>Guest Mode</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2, lineHeight: 1.4 }}>Data is stored locally only. Sign in with Google to sync across devices.</p>
                </div>
              </div>
              <Divider />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', cursor: 'pointer' }}>
                    <LogOut size={16} color="#DC2626" strokeWidth={2} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: '#DC2626', lineHeight: 1.2 }}>Exit Guest Mode</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>Return to sign-in screen</p>
                    </div>
                  </div>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Exit guest mode?</AlertDialogTitle>
                    <AlertDialogDescription>You will be taken to the sign-in screen. Local guest data will remain on this device.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onSignOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Exit Guest Mode</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Section>
          </motion.div>
        ) : firebaseUser && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
            <Section title="Account">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem' }}>
                <Cloud size={16} color="var(--primary)" strokeWidth={2} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--foreground)', lineHeight: 1.2 }}>Cloud Sync</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {firebaseUser.email || 'Synced with Google'}
                  </p>
                </div>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-pale)', padding: '2px 8px', borderRadius: 100 }}>Active</span>
              </div>
              <Divider />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', cursor: 'pointer' }}>
                    <LogOut size={16} color="#DC2626" strokeWidth={2} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: '#DC2626', lineHeight: 1.2 }}>Sign Out</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>Your data stays safe in the cloud</p>
                    </div>
                  </div>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign out?</AlertDialogTitle>
                    <AlertDialogDescription>Your progress is saved to the cloud. Sign back in anytime to restore everything.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onSignOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sign Out</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Section>
          </motion.div>
        )}

        {/* ── Danger zone ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div style={{ borderRadius: '1rem', background: 'var(--card)', border: '1px solid rgba(220,38,38,0.2)', overflow: 'hidden' }} className="card-sm">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem' }}>
              <div>
                <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: '#DC2626' }}>Clear All Data</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>Permanently deletes all data, removes PIN lock, and signs you out</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button style={{ padding: '0.5rem 0.875rem', borderRadius: '0.75rem', border: 'none', background: '#DC2626', color: '#fff', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>
                    Clear
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                    <AlertDialogDescription>This cannot be undone. All habits, expenses, notes, and settings will be permanently deleted.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearAllData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, clear everything</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </motion.div>

        <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', textAlign: 'center', padding: '1rem 0 0.5rem', lineHeight: 1.6 }}>
          Niyam v6.0.0 · {isGuest ? 'Guest mode — local data only' : firebaseUser ? 'Data synced to cloud ☁️' : 'Data stored on device'}
        </p>
      </div>

      {/* ── PIN Setup Sheet ── */}
      {pinSheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={resetPinSheet}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 38 }}
            style={{ position: 'relative', width: '100%', maxWidth: 520, borderRadius: '1.5rem 1.5rem 0 0', background: 'var(--card)', borderTop: '1px solid var(--border)', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 1.5rem)', fontFamily: "'Rubik', sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.75rem' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
            </div>
            <div style={{ padding: '1rem 1.5rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {pinSheet === 'set' ? 'Set App Lock' : pinSheet === 'change' ? 'Change PIN' : 'Remove App Lock'}
                </h2>
                <motion.button whileTap={{ scale: 0.88 }} onClick={resetPinSheet}
                  style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--muted)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={14} color="var(--muted-foreground)" strokeWidth={2.5} />
                </motion.button>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1.5rem' }}>{pinStepLabel[pinStep]}</p>
              <PinNumpad digits={pinDigits} onDigit={handlePinDigit} onDelete={handlePinDelete} shake={pinShake} errorDots={!!pinError} />
              {pinError && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--destructive)', fontWeight: 500, textAlign: 'center', marginTop: '1rem' }}>{pinError}</p>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Edit Profile Sheet ── */}
      {showEditProfile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setShowEditProfile(false); setProfileError(''); }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 38 }}
            style={{ position: 'relative', width: '100%', maxWidth: 520, borderRadius: '1.5rem 1.5rem 0 0', background: 'var(--card)', borderTop: '1px solid var(--border)', maxHeight: '92dvh', overflowY: 'auto', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 1.5rem)', fontFamily: "'Rubik', sans-serif" }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.75rem' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
            </div>
            <div style={{ padding: '0.875rem 1.25rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)' }}>Edit Profile</h2>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => { setShowEditProfile(false); setProfileError(''); }} aria-label="Close"
                  style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--muted)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: 36 }}>
                  <X size={14} color="var(--muted-foreground)" strokeWidth={2.5} />
                </motion.button>
              </div>

              {/* Avatar — Google photo, read-only */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--border)', background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {avatarSrc
                    ? <img src={avatarSrc} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                    : <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  }
                </div>
              </div>

              {/* Name */}
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.375rem' }}>Name</p>
                <input value={editedProfile.name}
                  onChange={e => { setEditedProfile({ ...editedProfile, name: e.target.value }); setProfileError(''); }}
                  placeholder="Your name" maxLength={30} enterKeyHint="next"
                  style={{ width: '100%', height: 48, padding: '0 1rem', borderRadius: '0.75rem', border: `1.5px solid ${profileError ? '#DC2626' : 'var(--border)'}`, background: 'var(--input-bg)', color: 'var(--foreground)', fontSize: '0.9375rem', fontFamily: 'inherit', outline: 'none' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  {profileError && <p style={{ fontSize: '0.75rem', color: '#DC2626' }}>{profileError}</p>}
                  <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', marginLeft: 'auto' }}>{editedProfile.name.length}/30</p>
                </div>
              </div>

              {/* Bio */}
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.375rem' }}>Bio <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></p>
                <textarea value={editedProfile.bio || ''}
                  onChange={e => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                  placeholder="A short bio…" maxLength={200} rows={3}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1.5px solid var(--border)', background: 'var(--input-bg)', color: 'var(--foreground)', fontSize: '0.9375rem', fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.5 }} />
                <p style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', textAlign: 'right', marginTop: '0.25rem' }}>{(editedProfile.bio || '').length}/200</p>
              </div>

              {/* Location */}
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '0.375rem' }}>Location <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></p>
                <input value={editedProfile.location || ''}
                  onChange={e => setEditedProfile({ ...editedProfile, location: e.target.value })}
                  placeholder="e.g. Mumbai, India" maxLength={60} enterKeyHint="done"
                  style={{ width: '100%', height: 48, padding: '0 1rem', borderRadius: '0.75rem', border: '1.5px solid var(--border)', background: 'var(--input-bg)', color: 'var(--foreground)', fontSize: '0.9375rem', fontFamily: 'inherit', outline: 'none' }} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => { setShowEditProfile(false); setEditedProfile(userProfile); setProfileError(''); }}
                  style={{ flex: 1, height: 48, borderRadius: '0.875rem', border: '1.5px solid var(--border)', background: 'none', color: 'var(--foreground)', fontSize: '0.9375rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={saveProfile}
                  style={{ flex: 1, height: 48, borderRadius: '0.875rem', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Save Changes
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
