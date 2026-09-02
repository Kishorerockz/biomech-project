import React from 'react';
import { motion } from 'motion/react';
import { TabType, SensorState } from '../types';

interface HeaderProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  sensorState: SensorState;
  onOpenProfile: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  sensorState,
  onOpenProfile,
  theme,
  onToggleTheme,
}) => {
  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'live', label: 'Live', icon: 'sensors' },
    { id: 'analysis', label: 'Analysis', icon: 'analytics' },
    { id: 'history', label: 'History', icon: 'history' },
    { id: 'calibration', label: 'Calibration', icon: 'tune' },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <header className="fixed top-0 w-full z-50 bg-[#131313] border-b border-[#3a4a49] flex justify-between items-center px-5 md:px-10 h-16 md:hidden">
        <button
          onClick={() => setCurrentTab('live')}
          className="text-[#b9cac9] hover:text-[#00fbfb] transition-colors p-2 rounded-full flex items-center justify-center active:scale-95"
          title="Telemetry Feed"
        >
          <span className="material-symbols-outlined filled text-[#00dddd]">sensors</span>
        </button>

        <div
          onClick={() => setCurrentTab('live')}
          className="font-display-metrics text-xl tracking-tighter text-[#00dddd] cursor-pointer flex items-center gap-2"
        >
          KINETIX
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-full text-[#b9cac9] hover:text-[#00fbfb] transition-colors cursor-pointer active:scale-95"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            <span className="material-symbols-outlined text-xl">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          <button
            onClick={onOpenProfile}
            className="text-[#b9cac9] hover:text-[#00fbfb] transition-colors p-2 rounded-full flex items-center justify-center active:scale-95"
            title="Profile & Settings"
          >
            <span className="material-symbols-outlined filled text-[#00dddd]">account_circle</span>
          </button>
        </div>
      </header>

      {/* Desktop Top Header */}
      <header className="hidden md:flex fixed top-0 w-full z-50 justify-between items-center px-10 h-16 bg-[#131313] border-b border-[#3a4a49]">
        <div
          onClick={() => setCurrentTab('live')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <span className="material-symbols-outlined filled text-[#00fbfb] group-hover:scale-110 transition-transform">
            sensors
          </span>
          <span className="font-display-metrics text-xl tracking-tighter text-[#00fbfb]">
            KINETIX
          </span>
          <span className="flex items-center gap-1.5 ml-3 bg-[#1c1b1b] px-3 py-1 rounded-full border border-[#2a2a2a] text-xs font-data-label text-[#b9cac9]">
            <span
              className={`w-2 h-2 rounded-full ${
                sensorState.connected ? 'bg-[#00ff7f] pulse-dot-green' : 'bg-red-500'
              }`}
            />
            {sensorState.connected ? 'ESP32: CONNECTED' : 'OFFLINE'}
          </span>
        </div>

        <nav className="flex gap-8 relative">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`relative font-data-label text-sm flex items-center gap-1.5 py-1 transition-colors cursor-pointer ${
                  isActive ? 'text-[#00fbfb]' : 'text-[#b9cac9] hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="headerTabUnderline"
                    className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-[#00fbfb] shadow-[0_0_8px_#00fbfb]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* Light / Dark Theme Mode Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 bg-[#1c1b1b] hover:bg-[#2a2a2a] border border-[#2a2a2a] px-3 py-1.5 rounded-full text-xs font-data-label text-[#b9cac9] hover:text-[#00fbfb] transition-all cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            <span 
              className="material-symbols-outlined text-base"
              style={{ marginTop: '9px' }}
            >
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
            <span className="uppercase tracking-wider font-semibold">
              {theme === 'dark' ? 'Light' : 'Dark'}
            </span>
          </button>

          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 hover:bg-[#2a2a2a] px-3 py-1.5 rounded-full transition-colors text-[#b9cac9] hover:text-[#00fbfb] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[#00dddd] filled">account_circle</span>
            <span className="font-data-label text-xs uppercase tracking-wider">Profile</span>
          </button>
        </div>
      </header>
    </>
  );
};
