import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { auth } from '../firebase';

const IS_NATIVE = Capacitor.isNativePlatform();

async function signInWithGoogle() {
  if (IS_NATIVE) {
    const result = await FirebaseAuthentication.signInWithGoogle();
    const idToken = result.credential?.idToken;
    if (!idToken) throw new Error('No ID token returned');
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
  } else {
    await signInWithPopup(auth, new GoogleAuthProvider());
  }
}

// ready=false → shows loading dots (splash look)
// ready=true  → loading dots exit, sign-in card enters
export default function AuthGate({ ready = false, onGuestMode }: { ready?: boolean; onGuestMode?: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      console.warn('Google sign-in error:', e?.code, e?.message, e);
      const cancelled = e?.code === 'auth/cancelled-by-user' || e?.message === 'Sign in action cancelled.';
      if (!cancelled) {
        if (e?.code === 'auth/popup-blocked') {
          toast.error('Popup blocked — allow popups for this site and try again.');
        } else if (e?.code === 'auth/operation-not-allowed') {
          toast.error('Google sign-in not enabled — check Firebase Console.');
        } else {
          toast.error('Sign-in failed. Please try again.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#414751',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      fontFamily: "'Rubik', sans-serif",
      padding: '2rem 1.5rem',
    }}>

      {/* ── Decorative blobs ── */}
      <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 2.8, opacity: 0.08 }}
        transition={{ duration: 4, ease: 'easeOut' }}
        style={{ position: 'absolute', top: '-5%', right: '-20%', width: 380, height: 380, borderRadius: '50%', background: '#B78E79', pointerEvents: 'none' }} />
      <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 2.2, opacity: 0.06 }}
        transition={{ duration: 4, delay: 0.4, ease: 'easeOut' }}
        style={{ position: 'absolute', bottom: '-15%', left: '-15%', width: 320, height: 320, borderRadius: '50%', background: '#919F90', pointerEvents: 'none' }} />
      <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1.4, opacity: 0.10 }}
        transition={{ duration: 3, delay: 0.8 }}
        style={{ position: 'absolute', top: '30%', left: '5%', width: 180, height: 180, borderRadius: '50%', background: '#C9935A', pointerEvents: 'none' }} />

      {/* ── Main content ── */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ textAlign: 'center', zIndex: 1, width: '100%', maxWidth: 360 }}
      >
        {/* ── Icon ── */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: 104, height: 104, borderRadius: 30, margin: '0 auto 1.75rem', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ position: 'absolute', inset: 0, borderRadius: 30, border: '1.5px solid rgba(183,142,121,0.35)', background: 'rgba(183,142,121,0.08)' }} />
          <div style={{ width: 80, height: 80, borderRadius: 22, background: 'linear-gradient(135deg, #C8A491 0%, #9E7663 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 36px rgba(183,142,121,0.40)' }}>
            <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
              <path d="M10 32V10L32 32V10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="32" cy="10" r="4.5" fill="rgba(255,255,255,0.3)"/>
              <circle cx="32" cy="10" r="2.5" fill="white"/>
            </svg>
          </div>
        </motion.div>

        {/* ── Title ── */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          style={{ fontSize: '3.25rem', fontWeight: 700, color: '#F2EDE7', letterSpacing: '-0.045em', marginBottom: '0.5rem', lineHeight: 1 }}
        >
          Niyam
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 0.6 }}
          transition={{ delay: 0.55 }}
          style={{ fontSize: '0.9375rem', color: '#F2EDE7', fontWeight: 500, letterSpacing: '0.02em', marginBottom: '2.5rem' }}
        >
          Build discipline, shape your life
        </motion.p>

        {/* ── Loading dots → Sign-in card ── */}
        <AnimatePresence mode="wait">
          {!ready ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.25 } }}
              transition={{ delay: 1.2, duration: 0.4 }}
              style={{ display: 'flex', justifyContent: 'center', gap: 8 }}
            >
              {[0, 1, 2].map(i => (
                <motion.div key={i}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: '#B78E79' }}
                  animate={{ scale: [1, 1.8, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="card"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '1.5rem',
                padding: '1.75rem 1.5rem',
                backdropFilter: 'blur(12px)',
              }}
            >
              <p style={{ fontSize: '1rem', fontWeight: 600, color: '#F2EDE7', marginBottom: '0.375rem' }}>
                Welcome back
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'rgba(242,237,231,0.55)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Everything syncs automatically — habits, notes, streaks
              </p>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSignIn}
                disabled={loading}
                style={{
                  width: '100%', height: 54,
                  borderRadius: '0.875rem',
                  background: loading ? 'rgba(255,255,255,0.08)' : '#fff',
                  border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '0.75rem',
                  cursor: loading ? 'default' : 'pointer',
                  fontFamily: 'inherit', fontSize: '0.9375rem', fontWeight: 600,
                  color: '#1f1f1f',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                  transition: 'opacity 0.15s ease',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {loading ? (
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid #ccc', borderTopColor: '#555', animation: 'spin 0.7s linear infinite' }} />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                )}
                {loading ? 'Signing in…' : 'Continue with Google'}
              </motion.button>

              {/* Cloud sync note */}
              <p style={{
                fontSize: '0.75rem',
                color: 'rgba(242,237,231,0.40)',
                marginTop: '1rem',
                lineHeight: 1.55,
                textAlign: 'center',
              }}>
                Your data stays private and syncs across all your devices.
              </p>

              {/* Guest mode button */}
              {onGuestMode && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onGuestMode}
                  style={{
                    width: '100%',
                    height: 46,
                    borderRadius: '0.875rem',
                    background: 'transparent',
                    border: '1px solid rgba(242,237,231,0.20)',
                    marginTop: '0.75rem',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'rgba(242,237,231,0.70)',
                    letterSpacing: '0.01em',
                  }}
                >
                  Continue as Guest
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
