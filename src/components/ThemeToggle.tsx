import React from 'react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  onChange?: (theme: 'light' | 'dark' | 'system') => void;
}

export default function ThemeToggle({ onChange }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const next: 'dark' | 'system' | 'light' =
      theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
    onChange?.(next);
  };

  const label =
    theme === 'light' ? 'Switch to dark mode' :
    theme === 'dark' ? 'Switch to system theme' :
    'Switch to light mode';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycleTheme}
      className="relative w-10 h-10 rounded-full"
      aria-label={label}
    >
      {/* Sun icon — light mode */}
      <motion.div
        initial={false}
        animate={{ scale: theme === 'light' ? 1 : 0, opacity: theme === 'light' ? 1 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </motion.div>

      {/* Moon icon — dark mode */}
      <motion.div
        initial={false}
        animate={{ scale: theme === 'dark' ? 1 : 0, opacity: theme === 'dark' ? 1 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </motion.div>

      {/* Monitor icon — system mode */}
      <motion.div
        initial={false}
        animate={{ scale: theme === 'system' ? 1 : 0, opacity: theme === 'system' ? 1 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </motion.div>
    </Button>
  );
}
