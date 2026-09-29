import React from 'react';
import { motion } from 'motion/react';
import { TabType } from '../types';

interface BottomNavProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setCurrentTab }) => {
  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'live', label: 'Live', icon: 'sensors' },
    { id: 'analysis', label: 'Analysis', icon: 'insights' },
    { id: 'history', label: 'History', icon: 'calendar_month' },
    { id: 'calibration', label: 'Tuning', icon: 'tune' },
  ];

  return (
    <nav className="fixed bottom-3 left-4 right-4 z-50 bg-[#0b0d11]/85 backdrop-blur-2xl border border-white/[0.08] shadow-[0_10px_35px_rgba(0,0,0,0.6)] flex justify-around items-center h-16 rounded-2xl px-2 pb-[env(safe-area-inset-bottom,0px)] md:hidden">
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id)}
            className={`relative flex flex-col items-center justify-center py-1.5 transition-all active:scale-95 w-16 rounded-xl cursor-pointer ${
              isActive ? 'text-[#00f5d4]' : 'text-white/50 hover:text-white'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="bottomNavIndicator"
                className="absolute inset-0 bg-[#00f5d4]/10 border border-[#00f5d4]/30 rounded-xl"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
            <span
              className={`material-symbols-outlined text-xl mb-0.5 relative z-10 ${
                isActive ? 'filled text-[#00f5d4]' : ''
              }`}
            >
              {tab.icon}
            </span>
            <span className="font-mono text-[10px] tracking-wider relative z-10 font-medium">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
