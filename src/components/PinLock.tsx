import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Fingerprint } from 'lucide-react';
import { hapticTap, hapticError, hapticSuccess } from '../utils/haptic';

const PIN_KEY = 'niyam-pin-hash';
const SALT = ':niyam-v6-lock';
const PRIMARY = '#B78E79';

// ── PIN utilities (exported for Account.tsx) ─────────────────────────────────
function hashPin(pin: string): string {
  return btoa(pin + SALT);
}
export const isPinSet = (): boolean => !!localStorage.getItem(PIN_KEY);
export const verifyPin = (pin: string): boolean => localStorage.getItem(PIN_KEY) === hashPin(pin);
export const setPin = (pin: string): void => localStorage.setItem(PIN_KEY, hashPin(pin));
export const removePin = (): void => localStorage.removeItem(PIN_KEY);

// ── Lock Screen ───────────────────────────────────────────────────────────────
interface Props {
  onUnlock: () => void;
  biometricEnabled?: boolean;
  onBiometricTap?: () => void;
}

export default function PinLock({ onUnlock, biometricEnabled, onBiometricTap }: Props) {
  const [digits, setDigits]     = useState('');
  const [shake, setShake]       = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow]           = useState(Date.now());
  const tickRef                 = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (lockedUntil === 0) return;
    tickRef.current = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= lockedUntil) {
        clearInterval(tickRef.current!);
        setLockedUntil(0);
        setAttempts(0);
      }
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [lockedUntil]);

  const isLocked  = now < lockedUntil;
  const lockSecs  = Math.ceil((lockedUntil - now) / 1000);

  const handleDigit = (d: string) => {
    if (shake || digits.length >= 4 || isLocked) return;
    hapticTap();
    const next = digits + d;
    setDigits(next);
    if (next.length === 4) {
      if (verifyPin(next)) {
        hapticSuccess();
        onUnlock();
      } else {
        hapticError();
        setShake(true);
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 5) {
          setLockedUntil(Date.now() + 30000);
          setNow(Date.now());
        }
        setTimeout(() => { setDigits(''); setShake(false); }, 600);
      }
    }
  };

  const handleDelete = () => {
    if (shake || isLocked) return;
    hapticTap();
    setDigits(d => d.slice(0, -1));
  };

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'];
  const pinSet = isPinSet(); // determines whether numpad is shown

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--background)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 'calc(env(safe-area-inset-top,0px) + 2rem) 2rem calc(env(safe-area-inset-bottom,0px) + 2rem)',
      fontFamily: "'Rubik', sans-serif",
    }}>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.04em', lineHeight: 1 }}>Niyam</p>
        <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: '0.5rem' }}>
          {pinSet ? 'Enter your PIN to continue' : 'Use fingerprint to continue'}
        </p>
      </div>

      {/* PIN dots + numpad — only shown when a PIN is actually set */}
      {pinSet && (
        <>
          <motion.div
            animate={shake ? { x: [0, -12, 12, -12, 12, -6, 6, 0] } : {}}
            transition={{ duration: 0.5 }}
            style={{ display: 'flex', gap: '1.125rem', marginBottom: '0.875rem' }}
          >
            {[0, 1, 2, 3].map(i => (
              <motion.div key={i}
                animate={{ scale: i < digits.length ? 1.1 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: i < digits.length
                    ? shake ? 'var(--destructive)' : PRIMARY
                    : 'var(--border)',
                  transition: 'background 0.12s',
                }}
              />
            ))}
          </motion.div>

          <div style={{ height: 22, marginBottom: '2rem', display: 'flex', alignItems: 'center' }}>
            {isLocked ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--destructive)', fontWeight: 500 }}>
                Too many attempts · try again in {lockSecs}s
              </p>
            ) : attempts > 0 && !shake ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--destructive)', fontWeight: 500 }}>
                Incorrect PIN{attempts > 1 ? ` · ${attempts} attempts` : ''}
              </p>
            ) : null}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', width: '100%', maxWidth: 300, opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
            {KEYS.map((k, idx) => {
              if (k === '') return <div key={idx} />;
              if (k === 'del') return (
                <motion.button key="del" whileTap={{ scale: 0.88 }} onClick={handleDelete}
                  style={{ height: 68, borderRadius: '1rem', background: 'var(--muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 68 }}>
                  <span style={{ fontSize: '1.375rem', color: 'var(--muted-foreground)', lineHeight: 1 }}>⌫</span>
                </motion.button>
              );
              return (
                <motion.button key={k} whileTap={{ scale: 0.88 }} onClick={() => handleDigit(k)}
                  style={{ height: 68, borderRadius: '1rem', background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '1.625rem', fontWeight: 600, color: 'var(--foreground)', fontFamily: "'Rubik', sans-serif", boxShadow: 'var(--shadow-xs)', minHeight: 68 }}>
                  {k}
                </motion.button>
              );
            })}
          </div>
        </>
      )}

      {/* Biometric unlock button */}
      {biometricEnabled && onBiometricTap && (
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => { hapticTap(); onBiometricTap(); }}
          aria-label="Use fingerprint to unlock"
          style={{
            marginTop: '2rem',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted-foreground)', fontSize: '0.75rem', fontWeight: 500,
            fontFamily: "'Rubik', sans-serif", minHeight: 44,
          }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--card)', border: '1.5px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-xs)',
          }}>
            <Fingerprint size={26} color={PRIMARY} strokeWidth={1.6} />
          </div>
          Use fingerprint
        </motion.button>
      )}
    </div>
  );
}

// ── Mini numpad for setup sheets ──────────────────────────────────────────────
interface NumpadProps {
  digits: string;
  onDigit: (d: string) => void;
  onDelete: () => void;
  shake?: boolean;
  errorDots?: boolean;
}

export function PinNumpad({ digits, onDigit, onDelete, shake = false, errorDots = false }: NumpadProps) {
  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'];
  return (
    <div>
      {/* Dots */}
      <motion.div
        animate={shake ? { x: [0, -10, 10, -10, 10, -5, 5, 0] } : {}}
        transition={{ duration: 0.45 }}
        style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem' }}
      >
        {[0, 1, 2, 3].map(i => (
          <motion.div key={i}
            animate={{ scale: i < digits.length ? 1.1 : 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            style={{
              width: 13, height: 13, borderRadius: '50%',
              background: i < digits.length
                ? errorDots ? 'var(--destructive)' : PRIMARY
                : 'var(--border)',
              transition: 'background 0.12s',
            }}
          />
        ))}
      </motion.div>
      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
        {KEYS.map((k, idx) => {
          if (k === '') return <div key={idx} />;
          if (k === 'del') return (
            <motion.button key="del" whileTap={{ scale: 0.88 }} onClick={onDelete}
              style={{ height: 58, borderRadius: '0.875rem', background: 'var(--muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 58 }}>
              <span style={{ fontSize: '1.25rem', color: 'var(--muted-foreground)' }}>⌫</span>
            </motion.button>
          );
          return (
            <motion.button key={k} whileTap={{ scale: 0.88 }} onClick={() => onDigit(k)}
              style={{ height: 58, borderRadius: '0.875rem', background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '1.5rem', fontWeight: 600, color: 'var(--foreground)', fontFamily: "'Rubik', sans-serif", minHeight: 58 }}>
              {k}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
