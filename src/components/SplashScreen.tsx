import React from 'react';
import { motion } from 'motion/react';

export default function SplashScreen() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#414751',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      fontFamily: "'Rubik', sans-serif",
    }}>
      <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 2.8, opacity: 0.08 }}
        transition={{ duration: 4, ease: 'easeOut' }}
        style={{ position: 'absolute', top: '-5%', right: '-20%', width: 380, height: 380, borderRadius: '50%', background: '#B78E79', pointerEvents: 'none' }} />
      <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 2.2, opacity: 0.06 }}
        transition={{ duration: 4, delay: 0.4, ease: 'easeOut' }}
        style={{ position: 'absolute', bottom: '-15%', left: '-15%', width: 320, height: 320, borderRadius: '50%', background: '#919F90', pointerEvents: 'none' }} />
      <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1.4, opacity: 0.10 }}
        transition={{ duration: 3, delay: 0.8 }}
        style={{ position: 'absolute', top: '30%', left: '5%', width: 180, height: 180, borderRadius: '50%', background: '#C9935A', pointerEvents: 'none' }} />

      <motion.div initial={{ opacity: 0, y: 40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ textAlign: 'center', zIndex: 1, position: 'relative' }}>

        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.12, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: 104, height: 104, borderRadius: 30, margin: '0 auto 2rem', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 30, border: '1.5px solid rgba(183,142,121,0.35)', background: 'rgba(183,142,121,0.08)' }}/>
          <div style={{ width: 80, height: 80, borderRadius: 22, background: 'linear-gradient(135deg, #C8A491 0%, #9E7663 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 36px rgba(183,142,121,0.40)' }}>
            <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
              <path d="M10 32V10L32 32V10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="32" cy="10" r="4.5" fill="rgba(255,255,255,0.3)"/>
              <circle cx="32" cy="10" r="2.5" fill="white"/>
            </svg>
          </div>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}
          style={{ fontSize: '3.25rem', fontWeight: 700, color: '#F2EDE7', letterSpacing: '-0.045em', marginBottom: '0.5rem', lineHeight: 1 }}>
          Niyam
        </motion.h1>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 0.72 }}
          style={{ fontSize: '0.9375rem', color: '#F2EDE7', fontWeight: 500, letterSpacing: '0.02em' }}>
          Build discipline, shape your life
        </motion.p>
      </motion.div>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.35 }} transition={{ delay: 1.5 }}
        style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom,0px) + 1.5rem)', fontSize: '0.6875rem', color: '#F2EDE7', fontWeight: 500, letterSpacing: '0.08em' }}>
        v6.0.0
      </motion.p>
    </div>
  );
}
