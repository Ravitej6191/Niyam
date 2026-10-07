import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { toast } from 'sonner';
import type { Note } from '../App';
import { hashSecret, checkSecret, parseSecretRecord } from '../utils/secret';

interface NotesProps {
  notes: Note[];
  onUpdate: (notes: Note[]) => void;
  onBack: () => void;
}

const TITLE_MAX = 100;
const CONTENT_MAX = 10000;
// Note passwords are stored as salted PBKDF2 hashes (never the password itself).
// This is a UI gate: note text is not encrypted at rest.
// Legacy entries (base64 of the password) are upgraded on the next successful unlock.
const pwKey = (id: string) => 'npw_' + id;
const decodeLegacy = (s: string) => { try { return decodeURIComponent(atob(s)); } catch { return null; } };

function hasPw(id: string): boolean {
  try { return localStorage.getItem(pwKey(id)) !== null; } catch { return false; }
}
function clearPw(id: string) {
  try { localStorage.removeItem(pwKey(id)); } catch {}
}
async function setPw(id: string, pw: string) {
  try { localStorage.setItem(pwKey(id), JSON.stringify(await hashSecret(pw))); } catch {}
}
async function checkPw(id: string, pw: string): Promise<boolean> {
  let raw: string | null = null;
  try { raw = localStorage.getItem(pwKey(id)); } catch { return false; }
  if (raw === null) return false;
  const record = parseSecretRecord(raw);
  if (record) return checkSecret(pw, record);
  if (decodeLegacy(raw) === pw) { await setPw(id, pw); return true; }
  return false;
}

type View = 'list' | 'editor';

export default function Notes({ notes, onUpdate, onBack }: NotesProps) {
  const [view, setView] = useState<View>('list');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // editor state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedKey = useRef('');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // note we track locally so we can update it after first save
  const editingNoteRef = useRef<Note | null>(null);
  // password modal
  const [pwModal, setPwModal] = useState<{ open: boolean; mode: 'set'|'unlock'|'change'; noteId?: string } | null>(null);
  const [pwInput, setPwInput] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? notes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
      : [...notes];
    return list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime();
    });
  }, [notes, searchQuery]);

  // ── auto-save ──
  const doSave = useCallback((t: string, c: string, note: Note | null) => {
    const key = t.trim() + '\0' + c.trim();
    if (key === lastSavedKey.current) return;
    if (!t.trim() && !c.trim()) return;
    const now = new Date().toISOString();
    // Auto-title: derive from first non-empty content line when title is blank
    const derivedTitle = t.trim()
      || (c.trim() ? (c.trim().split('\n').find(l => l.trim()) || '').trim().slice(0, TITLE_MAX) : '')
      || 'Untitled';
    if (note) {
      // update existing
      onUpdate(notes.map(n => n.id === note.id
        ? { ...n, title: derivedTitle, content: c.trim(), lastEdited: now }
        : n
      ));
    } else {
      // create new
      const newNote: Note = { id: Date.now().toString(), title: derivedTitle, content: c.trim(), lastEdited: now };
      onUpdate([newNote, ...notes]);
      editingNoteRef.current = newNote;
      setEditingNote(newNote);
      // Show XP toast only on first save (new note)
      toast.success('Note saved · +3 XP', { duration: 2000 });
    }
    lastSavedKey.current = key;
    setIsDirty(false);
  }, [notes, onUpdate]);

  useEffect(() => {
    if (!isDirty) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      doSave(title, content, editingNoteRef.current);
    }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [title, content, isDirty, doSave]);

  const flushSave = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (isDirty) doSave(title, content, editingNoteRef.current);
  };

  const openNew = () => {
    flushSave();
    editingNoteRef.current = null;
    setEditingNote(null);
    setTitle(''); setContent('');
    setIsDirty(false); lastSavedKey.current = '';
    setView('editor');
  };

  const tryOpenNote = (note: Note) => {
    if (hasPw(note.id)) {
      setPwInput(''); setPwConfirm(''); setPwError('');
      setPwModal({ open: true, mode: 'unlock', noteId: note.id });
      return;
    }
    openNoteEditor(note);
  };

  const openNoteEditor = (note: Note) => {
    flushSave();
    editingNoteRef.current = note;
    setEditingNote(note);
    setTitle(note.title); setContent(note.content);
    setIsDirty(false); lastSavedKey.current = note.title + '\0' + note.content;
    setView('editor');
  };

  const closeEditor = () => {
    flushSave();
    setView('list');
    setEditingNote(null); editingNoteRef.current = null;
    setIsDirty(false);
  };

  const deleteNote = (noteId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const prevNotes = [...notes];
    clearPw(noteId);
    onUpdate(notes.filter(n => n.id !== noteId));
    toast.success('Note deleted', {
      action: { label: 'Undo', onClick: () => onUpdate(prevNotes) },
      duration: 5000,
    });
    if (editingNote?.id === noteId) { setView('list'); setEditingNote(null); editingNoteRef.current = null; }
  };

  const togglePin = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(notes.map(n => n.id === noteId ? { ...n, isPinned: !n.isPinned } : n));
  };

  const shareNote = async () => {
    const text = (title.trim() ? title + '\n\n' : '') + content;
    if (navigator.share) {
      try { await navigator.share({ title: title || 'Note', text }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(text); toast.success('Copied to clipboard'); } catch { toast.error('Could not share'); }
    }
  };

  // ── password modal logic ──
  const openPwModal = (mode: 'set'|'change', noteId: string) => {
    setPwInput(''); setPwConfirm(''); setPwError('');
    setPwModal({ open: true, mode, noteId });
  };

  const submitPassword = async () => {
    if (!pwModal) return;
    const { mode, noteId } = pwModal;
    if (!noteId) return;
    setPwError('');

    if (mode === 'unlock') {
      if (!(await checkPw(noteId, pwInput))) { setPwError('Incorrect password'); return; }
      setPwModal(null);
      const note = notes.find(n => n.id === noteId);
      if (!note) return;
      openNoteEditor(note);
      return;
    }
    if (mode === 'set') {
      if (pwInput.length < 6) { setPwError('At least 6 characters required'); return; }
      if (pwInput !== pwConfirm) { setPwError('Passwords do not match'); return; }
      await setPw(noteId, pwInput);
      setPwModal(null);
      toast.success('Password set');
      return;
    }
    if (mode === 'change') {
      // pwInput = current pw, pwConfirm = new pw (blank = remove)
      if (!(await checkPw(noteId, pwInput))) { setPwError('Current password incorrect'); return; }
      if (!pwConfirm) { clearPw(noteId); setPwModal(null); toast.success('Password removed'); return; }
      if (pwConfirm.length < 6) { setPwError('New password must be at least 6 characters'); return; }
      await setPw(noteId, pwConfirm);
      setPwModal(null);
      toast.success('Password updated');
    }
  };

  const formatDate = (d: string) => {
    const ms = Date.now() - new Date(d).getTime();
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(ms / 3600000);
    const days = Math.floor(ms / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

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
                <h1 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.1 }}>Notes</h1>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', lineHeight: 1 }}>{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.94 }} onClick={openNew}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.75rem', border: 'none', background: '#5C7A5B', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Rubik', sans-serif", minHeight: 44 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Note
            </motion.button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-4">
          {notes.length > 0 && (
            <div className="relative mb-4">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input className="pl-9 h-10" placeholder="Search notes…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1.5" style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {filteredNotes.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {filteredNotes.map((note, i) => (
                  <motion.div key={note.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }} transition={{ delay: i * 0.04 }}>
                    <Card className="p-4 cursor-pointer active:scale-[0.99] transition-all border border-border/60"
                      onClick={() => tryOpenNote(note)}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            {note.isPinned && (
                              <svg className="w-3 h-3 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                              </svg>
                            )}
                            {hasPw(note.id) && (
                              <svg className="w-3 h-3 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            )}
                            <h3 className="font-semibold text-foreground text-sm truncate">{note.title}</h3>
                          </div>
                          {hasPw(note.id)
                            ? <p className="text-xs text-muted-foreground italic">Protected note</p>
                            : <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{note.content}</p>
                          }
                          <p className="text-xs text-muted-foreground/50 mt-2">{formatDate(note.lastEdited)}</p>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                          <button onClick={e => togglePin(note.id, e)}
                            aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
                            className={`p-1.5 rounded-lg transition-colors ${note.isPinned ? 'text-primary' : 'text-muted-foreground/30 hover:text-muted-foreground'}`}
                            style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg className="w-4 h-4" fill={note.isPinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                          </button>
                          <button onClick={e => deleteNote(note.id, e)}
                            aria-label="Delete note"
                            className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-destructive transition-colors"
                            style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                <div style={{width:56,height:56,borderRadius:"1rem",background:"rgba(92,122,91,0.14)",border:"1px solid rgba(92,122,91,0.22)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 1rem"}}><svg width="28" height="28" fill="none" stroke="#5C7A5B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
                <h2 className="text-lg font-semibold mb-1">{notes.length === 0 ? 'No notes yet' : 'No notes found'}</h2>
                <p className="text-sm text-muted-foreground">
                  {notes.length === 0 ? 'Tap the New Note button above to start writing' : 'Try a different search'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {pwModal?.open && (
          <PwModal mode={pwModal.mode} input={pwInput} confirm={pwConfirm} error={pwError}
            onInput={v => { setPwInput(v); setPwError(''); }}
            onConfirm={v => { setPwConfirm(v); setPwError(''); }}
            onSubmit={submitPassword}
            onClose={() => setPwModal(null)} />
        )}
      </div>
    );
  }

  // ── EDITOR VIEW (full-page) ────────────────────────────
  const liveNote = editingNote ? notes.find(n => n.id === editingNote.id) : null;
  const isPinned = liveNote?.isPinned ?? false;
  const isProtected = editingNote ? hasPw(editingNote.id) : false;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lastEditedLabel = liveNote?.lastEdited
    ? new Date(liveNote.lastEdited).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ minHeight: '100dvh' }}>
      {/* Notes-green top accent bar */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #5C7A5B, #7BA37A)', flexShrink: 0 }}/>

      <header className="border-b px-4 pb-3 sticky z-40 flex-shrink-0 bg-background"
              style={{ top: 0, paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <button onClick={closeEditor}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors active:scale-95">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Notes</span>
          </button>

          <div className="flex items-center gap-0.5">
            {/* Save indicator */}
            <span className="flex items-center gap-1 mr-1">
              {isDirty ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: 'var(--muted-foreground)', opacity: 0.65 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9935A', display: 'inline-block', animation: 'pulse 1.2s ease-in-out infinite' }}/>
                  Saving
                </span>
              ) : (editingNote || lastSavedKey.current) ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: '#5C7A5B', opacity: 0.8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5C7A5B', display: 'inline-block' }}/>
                  Saved
                </span>
              ) : null}
            </span>

            {/* Share */}
            {(title.trim() || content.trim()) && (
              <button onClick={shareNote} className="p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors" style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
            )}

            {/* Lock */}
            {editingNote && (
              <button onClick={() => openPwModal(isProtected ? 'change' : 'set', editingNote.id)}
                className={`p-2 rounded-lg transition-colors ${isProtected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </button>
            )}

            {/* Pin */}
            {editingNote && (
              <button onClick={() => onUpdate(notes.map(n => n.id === editingNote.id ? { ...n, isPinned: !n.isPinned } : n))}
                className={`p-2 rounded-lg transition-colors ${isPinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg className="w-5 h-5" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
            )}

            {/* Delete */}
            {editingNote && (
              <button onClick={() => deleteNote(editingNote.id)}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="max-w-2xl mx-auto px-5 pb-16" style={{ paddingTop: '1.5rem' }}>
          {/* Title with left accent */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
            <div style={{ width: 3, borderRadius: 99, background: 'linear-gradient(180deg, #5C7A5B, #7BA37A88)', alignSelf: 'stretch', flexShrink: 0, minHeight: 32 }}/>
            <input
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); setIsDirty(true); }}
              placeholder="Untitled"
              maxLength={TITLE_MAX}
              className="w-full bg-transparent text-2xl font-bold text-foreground placeholder:text-muted-foreground/25 border-none outline-none"
              style={{ lineHeight: 1.3, fontFamily: "'Rubik', sans-serif" }}
            />
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', paddingLeft: '0.875rem' }}>
            {lastEditedLabel && (
              <span style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', opacity: 0.55, fontFamily: "'Rubik', sans-serif" }}>
                {lastEditedLabel}
              </span>
            )}
            {wordCount > 0 && (
              <>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted-foreground)', opacity: 0.3, display: 'inline-block', flexShrink: 0 }}/>
                <span style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', opacity: 0.55, fontFamily: "'Rubik', sans-serif" }}>
                  {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </span>
              </>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', opacity: 0.4, marginBottom: '1.25rem' }}/>

          {/* Content area with subtle ruled lines */}
          <textarea
            value={content}
            onChange={e => { setContent(e.target.value); setIsDirty(true); }}
            placeholder="Start writing…"
            maxLength={CONTENT_MAX}
            autoFocus={!editingNote}
            className="w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground/25 border-none outline-none resize-none"
            style={{
              minHeight: '60vh',
              lineHeight: '1.875rem',
              fontFamily: "'Rubik', sans-serif",
              backgroundImage: 'repeating-linear-gradient(transparent, transparent calc(1.875rem - 1px), rgba(65,71,81,0.07) calc(1.875rem - 1px), rgba(65,71,81,0.07) 1.875rem)',
              backgroundSize: '100% 1.875rem',
              backgroundAttachment: 'local',
            }}
          />
        </div>
      </div>

      {/* Bottom status bar */}
      <div style={{ flexShrink: 0, padding: '0.375rem 1.25rem', borderTop: '1px solid var(--border)', borderTopColor: 'rgba(65,71,81,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--background)' }}>
        <span style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', opacity: 0.4, fontFamily: "'Rubik', sans-serif" }}>
          {wordCount > 0 ? `${wordCount} words` : 'Empty note'}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--muted-foreground)', opacity: 0.4, fontFamily: "'Rubik', sans-serif" }}>
          {content.length.toLocaleString()} / {CONTENT_MAX.toLocaleString()}
        </span>
      </div>

      {pwModal?.open && (
        <PwModal mode={pwModal.mode} input={pwInput} confirm={pwConfirm} error={pwError}
          onInput={v => { setPwInput(v); setPwError(''); }}
          onConfirm={v => { setPwConfirm(v); setPwError(''); }}
          onSubmit={submitPassword}
          onClose={() => setPwModal(null)} />
      )}
    </div>
  );
}

function PwModal({ mode, input, confirm, error, onInput, onConfirm, onSubmit, onClose }: {
  mode: 'set'|'unlock'|'change';
  input: string; confirm: string; error: string;
  onInput: (v: string) => void; onConfirm: (v: string) => void;
  onSubmit: () => void; onClose: () => void;
}) {
  const titles = { set: 'Set Password', unlock: 'Protected Note', change: 'Change Password' };
  const descs = {
    set: 'Lock this note with a password (min 6 characters). Prevents casual access.',
    unlock: 'Enter the password to open this note.',
    change: 'Enter current password, then new password (blank to remove lock).',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm mx-3 mb-4 sm:mb-0 bg-card rounded-2xl border border-border shadow-2xl p-5">
        <h2 className="text-base font-semibold mb-0.5">{titles[mode]}</h2>
        <p className="text-sm text-muted-foreground mb-4">{descs[mode]}</p>
        <div className="space-y-3">
          <Input type="password" placeholder={mode === 'change' ? 'Current password' : 'Password'}
            value={input} onChange={e => onInput(e.target.value)} className="h-11"
            autoFocus enterKeyHint={mode === 'unlock' ? 'done' : 'next'} maxLength={128}
            onKeyDown={e => e.key === 'Enter' && (mode !== 'set' && mode !== 'change' ? onSubmit() : undefined)} />
          {(mode === 'set' || mode === 'change') && (
            <Input type="password"
              placeholder={mode === 'change' ? 'New password (blank to remove)' : 'Confirm password'}
              value={confirm} onChange={e => onConfirm(e.target.value)} className="h-11"
              maxLength={128}
              enterKeyHint="done" onKeyDown={e => e.key === 'Enter' && onSubmit()} />
          )}
        </div>
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={onSubmit}>
            {mode === 'unlock' ? 'Unlock' : mode === 'set' ? 'Set Password' : 'Update'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
