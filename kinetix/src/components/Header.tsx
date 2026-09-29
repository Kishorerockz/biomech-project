import React from 'react';
import { motion } from 'motion/react';
import { TabType, SensorState } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface HeaderProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  sensorState: SensorState;
  onOpenProfile: () => void;
  onOpenConnectionModal?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  sensorState,
  onOpenProfile,
  onOpenConnectionModal,
  theme,
  onToggleTheme,
}) => {
  const { isInstallable, promptInstall } = usePWAInstall();

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'live', label: 'Live Telemetry', icon: 'sensors' },
    { id: 'analysis', label: 'Analysis', icon: 'insights' },
    { id: 'history', label: 'History', icon: 'calendar_month' },
    { id: 'calibration', label: 'Device & Tuning', icon: 'tune' },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <header className="fixed top-0 left-0 right-0 w-full z-50 bg-[#0b0d11]/90 backdrop-blur-xl border-b border-white/[0.08] flex justify-between items-center px-4 h-16 md:hidden">
        <div className="flex items-center gap-2.5">
          <div
            onClick={() => setCurrentTab('live')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00f5d4]/20 to-[#00f5d4]/5 border border-[#00f5d4]/40 flex items-center justify-center text-[#00f5d4] shadow-[0_0_12px_rgba(0,245,212,0.25)]">
              <span className="material-symbols-outlined text-lg filled">electric_bolt</span>
            </div>
            <span className="font-display-metrics text-lg font-bold tracking-tight text-white">
              KINETIX
            </span>
          </div>

          {/* Unified Connection Badge */}
          <button
            onClick={onOpenConnectionModal}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-medium transition-all active:scale-95 ${
              sensorState.connectionMode === 'wifi'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : sensorState.connectionMode === 'ble'
                ? 'bg-[#00f5d4]/10 border-[#00f5d4]/30 text-[#00f5d4]'
                : 'bg-white/[0.04] border-white/10 text-white/50 hover:text-white'
            }`}
            title="Configure Wearable Connection"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                sensorState.connectionMode === 'wifi'
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : sensorState.connectionMode === 'ble'
                  ? 'bg-[#00f5d4] shadow-[0_0_8px_#00f5d4]'
                  : 'bg-white/30'
              }`}
            />
            <span>
              {sensorState.connectionMode === 'wifi'
                ? 'Wi-Fi 100Hz'
                : sensorState.connectionMode === 'ble'
                ? 'BLE 100Hz'
                : 'Connect'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {sensorState.connected && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono text-white/70">
              <span className="material-symbols-outlined text-xs text-emerald-400">
                {sensorState.batteryPercent > 70 ? 'battery_full' : sensorState.batteryPercent > 25 ? 'battery_5_bar' : 'battery_alert'}
              </span>
              <span>{sensorState.batteryPercent || 100}%</span>
            </div>
          )}

          {isInstallable && (
            <button
              onClick={promptInstall}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#00f5d4] hover:bg-white/[0.06] transition-colors cursor-pointer active:scale-95"
              title="Install App"
            >
              <span className="material-symbols-outlined text-xl">download</span>
            </button>
          )}

          <button
            onClick={onOpenProfile}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/80 hover:text-[#00f5d4] hover:bg-white/[0.06] transition-colors cursor-pointer active:scale-95"
            title="Athlete Profile"
          >
            <span className="material-symbols-outlined text-2xl text-[#00f5d4]">account_circle</span>
          </button>
        </div>
      </header>

      {/* Desktop Top Header */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 w-full z-50 justify-between items-center px-8 h-18 bg-[#0b0d11]/85 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="flex items-center gap-4">
          <div
            onClick={() => setCurrentTab('live')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00f5d4]/20 to-[#00f5d4]/5 border border-[#00f5d4]/30 flex items-center justify-center text-[#00f5d4] shadow-[0_0_15px_rgba(0,245,212,0.25)] group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-xl filled">electric_bolt</span>
            </div>
            <div>
              <div className="font-display-metrics text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>KINETIX</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#00f5d4]/10 text-[#00f5d4] border border-[#00f5d4]/30 tracking-widest font-semibold">
                  PRO
                </span>
              </div>
            </div>
          </div>
          
          {/* Unified Connection Badge */}
          <button
            onClick={onOpenConnectionModal}
            className={`flex items-center gap-2 ml-2 px-3 py-1.5 rounded-full border text-xs font-mono font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              sensorState.connectionMode === 'wifi'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                : sensorState.connectionMode === 'ble'
                ? 'bg-[#00f5d4]/10 border-[#00f5d4]/30 text-[#00f5d4] shadow-[0_0_15px_rgba(0,245,212,0.2)]'
                : 'bg-white/[0.04] border-white/10 text-white/50 hover:text-white hover:border-white/20'
            }`}
            title="Configure Sensor Connection"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                sensorState.connectionMode === 'wifi'
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : sensorState.connectionMode === 'ble'
                  ? 'bg-[#00f5d4] shadow-[0_0_8px_#00f5d4]'
                  : 'bg-white/30'
              }`}
            />
            <span>
              {sensorState.connectionMode === 'wifi'
                ? 'ESP32 Wi-Fi (100Hz)'
                : sensorState.connectionMode === 'ble'
                ? 'ESP32 BLE (100Hz)'
                : 'Connect Wearable'}
            </span>
          </button>

          {sensorState.connected && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono text-white/70">
              <span className="material-symbols-outlined text-sm text-emerald-400">
                {sensorState.batteryPercent > 70 ? 'battery_full' : sensorState.batteryPercent > 25 ? 'battery_5_bar' : 'battery_alert'}
              </span>
              <span>{sensorState.batteryPercent || 100}%</span>
            </div>
          )}
        </div>

        {/* Central Tab Navigation */}
        <nav className="flex items-center gap-1.5 p-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-md">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`relative px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  isActive ? 'text-black font-semibold' : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="desktopTabIndicator"
                    className="absolute inset-0 bg-[#00f5d4] rounded-full shadow-[0_0_20px_rgba(0,245,212,0.4)]"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                )}
                <span className={`material-symbols-outlined text-base relative z-10 ${isActive ? 'text-black' : ''}`}>
                  {tab.icon}
                </span>
                <span className="relative z-10 tracking-wide">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5">
          {isInstallable && (
            <button
              onClick={promptInstall}
              className="flex items-center gap-1.5 bg-[#00f5d4]/10 hover:bg-[#00f5d4]/20 border border-[#00f5d4]/30 text-[#00f5d4] px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-[0_0_12px_rgba(0,245,212,0.15)] active:scale-95"
              title="Install App"
            >
              <span className="material-symbols-outlined text-base">download</span>
              <span>Install App</span>
            </button>
          )}

          {/* Profile Button */}
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all text-white/80 hover:text-white cursor-pointer group"
          >
            <div className="w-6 h-6 rounded-full bg-[#00f5d4]/20 border border-[#00f5d4]/40 flex items-center justify-center text-[#00f5d4]">
              <span className="material-symbols-outlined text-sm filled">person</span>
            </div>
            <span className="text-xs font-medium tracking-wide">Athlete</span>
          </button>
        </div>
      </header>
    </>
  );
};
