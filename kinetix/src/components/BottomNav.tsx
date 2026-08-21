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
    { id: 'analysis', label: 'Analysis', icon: 'analytics' },
    { id: 'history', label: 'History', icon: 'history' },
    { id: 'calibration', label: 'Calibration', icon: 'tune' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-[#1c1b1b] border-t border-[#3a4a49] flex justify-around items-center h-20 px-2 pb-2 md:hidden">
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id)}
            className={`relative flex flex-col items-center justify-center py-2 transition-all active:scale-95 w-20 rounded-xl cursor-pointer ${
              isActive ? 'text-[#00fbfb]' : 'text-[#b9cac9] hover:text-white'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="bottomNavActivePill"
                className="absolute inset-0 bg-[#00fbfb]/10 border border-[#00fbfb]/30 rounded-xl"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span
              className={`material-symbols-outlined mb-0.5 relative z-10 ${
                isActive ? 'filled' : ''
              }`}
            >
              {tab.icon}
            </span>
            <span className="font-data-label text-[10px] uppercase tracking-wider relative z-10 font-bold">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
