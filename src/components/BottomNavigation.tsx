import { hapticTap } from '../utils/haptic';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, TrendingUp, User, BookOpen } from 'lucide-react';
import type { TabScreen } from '../App';

interface BottomNavigationProps {
  activeTab: TabScreen;
  onTabChange: (tab: TabScreen) => void;
  newAchievements: number;
}

const TABS: { id: TabScreen; label: string; Icon: React.FC<any> }[] = [
  { id: 'home',         label: 'Home',    Icon: Home       },
  { id: 'journal',      label: 'Journal', Icon: BookOpen   },
  { id: 'achievements', label: 'Journey', Icon: TrendingUp },
  { id: 'account',      label: 'Profile', Icon: User       },
];

export default function BottomNavigation({ activeTab, onTabChange, newAchievements }: BottomNavigationProps) {
  return (
    <nav style={{
      position:'fixed', bottom:0, left:0, right:0, zIndex:50,
      background:'var(--card)', borderTop:'1px solid var(--border)',
      paddingBottom:'var(--safe-bottom)',
      backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
    }}>
      <div style={{ display:'flex', alignItems:'stretch', maxWidth:480, margin:'0 auto', height:'var(--nav-height)' }}>
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          const badge = id === 'achievements' && newAchievements > 0 ? newAchievements : 0;
          return (
            <motion.button key={id} onClick={() => { hapticTap(); onTabChange(id); }} whileTap={{ scale:0.88 }}
              style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, background:'none', border:'none', cursor:'pointer', position:'relative', minHeight:44 }}>
              <AnimatePresence>
                {isActive && (
                  <motion.div layoutId="nav-pill"
                    initial={{ opacity:0, scaleX:0.4 }} animate={{ opacity:1, scaleX:1 }} exit={{ opacity:0, scaleX:0.4 }}
                    transition={{ type:'spring', stiffness:380, damping:32 }}
                    style={{ position:'absolute', top:8, width:40, height:30, borderRadius:999, background:'var(--primary-pale)' }} />
                )}
              </AnimatePresence>
              <div style={{ position:'relative' }}>
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.6}
                  style={{ color: isActive ? 'var(--primary)' : 'var(--muted-foreground)', display:'block' }} />
                {badge > 0 && (
                  <motion.div initial={{ scale:0 }} animate={{ scale:1 }}
                    style={{ position:'absolute', top:-5, right:-7, minWidth:16, height:16, borderRadius:8, background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>
                    <span style={{ fontSize:'0.5625rem', fontWeight:700, color:'var(--primary-foreground)', lineHeight:1 }}>
                      {badge > 9 ? '9+' : badge}
                    </span>
                  </motion.div>
                )}
              </div>
              <span style={{ fontSize:'0.5625rem', fontWeight: isActive ? 600 : 400, letterSpacing:'0.02em', color: isActive ? 'var(--primary)' : 'var(--muted-foreground)', lineHeight:1 }}>
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
