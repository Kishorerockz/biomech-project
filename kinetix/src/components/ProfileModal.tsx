import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AthleteProfile, SessionData } from '../types';

interface ProfileModalProps {
  athleteProfile: AthleteProfile;
  setAthleteProfile: React.Dispatch<React.SetStateAction<AthleteProfile>>;
  sessions: SessionData[];
  onClose: () => void;
  onClearCache: () => void;
  onLogout?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  athleteProfile,
  setAthleteProfile,
  sessions,
  onClose,
  onClearCache,
  onLogout,
}) => {
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Press ESC to return to dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSaveParameters = () => {
    setSaveSuccess(true);
    setToastMsg('Physics baseline & biomechanical model updated!');
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Derive peak jump across sessions for calculations
  const maxJumpCm = Math.max(...sessions.map((s) => s.peakJumpCm || 0), 54.5);

  // Sayers Peak Power Formula: P(Watts) = 60.7 * JumpHeight(cm) + 45.3 * Mass(kg) - 2055
  const estimatedPeakPowerW = Math.max(
    0,
    Math.round(60.7 * maxJumpCm + 45.3 * (athleteProfile.weightKg || 70) - 2055)
  );
  const powerToWeightRatio = (
    estimatedPeakPowerW / (athleteProfile.weightKg || 1)
  ).toFixed(1);
  const estimatedMaxReachCm = (athleteProfile.standingReachCm || 245) + maxJumpCm;

  const handleExportAllCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'SessionID,Title,Sport,Date,PeakJump_cm,AvgJump_cm,TotalReps,Duration_sec,Intensity\n' +
      sessions
        .map(
          (s) =>
            `${s.id},"${s.title}",${s.sport},${s.date},${s.peakJumpCm},${s.avgJumpCm},${s.totalReps},${s.durationSec},${s.intensityPercent}%`
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kinetix_telemetry_all_sessions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToastMsg('All session telemetry exported to CSV!');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleClearCacheClick = () => {
    onClearCache();
    setToastMsg('Session cache cleared successfully.');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-50 bg-[#0b0d11]/95 backdrop-blur-2xl overflow-y-auto"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-5 z-50 bg-[#00f5d4] text-black px-4 py-2.5 rounded-full font-mono text-xs shadow-2xl flex items-center gap-2 font-bold uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <header className="fixed top-0 w-full z-50 bg-[#0b0d11]/90 backdrop-blur-xl border-b border-white/[0.08] flex justify-between items-center px-5 md:px-10 h-16">
        <button
          onClick={onClose}
          className="text-white/60 hover:text-[#00f5d4] transition-colors p-2 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center active:scale-95 cursor-pointer gap-1.5"
          aria-label="Back to Dashboard"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          <span className="font-mono text-xs uppercase hidden sm:inline">Telemetry</span>
        </button>

        <div className="font-mono text-xs sm:text-sm font-bold tracking-wider text-white uppercase text-center flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00f5d4] shadow-[0_0_8px_#00f5d4]" />
          <span>Athlete Profile &amp; Biomechanics</span>
        </div>

        <button
          onClick={onClose}
          className="text-white/60 hover:text-white transition-colors p-2 rounded-xl bg-white/[0.03] border border-white/10 cursor-pointer flex items-center gap-1 active:scale-95"
        >
          <span className="text-[10px] font-mono text-white/40 hidden sm:inline px-1 py-0.5">ESC</span>
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="mt-20 px-4 sm:px-6 md:px-10 py-6 max-w-4xl mx-auto w-full space-y-6 pb-28">
        {/* Profile Card Section */}
        <section className="rounded-3xl bg-[#121620]/80 border border-white/[0.08] p-6 backdrop-blur-xl flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="relative group">
            <img
              src={athleteProfile.avatarUrl}
              alt={athleteProfile.name}
              className="w-24 h-24 md:w-28 md:h-28 rounded-2xl object-cover border-2 border-[#00f5d4]/40 shadow-[0_0_25px_rgba(0,245,212,0.15)]"
            />
            <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-lg bg-[#00f5d4] text-black flex items-center justify-center font-bold text-xs shadow-md">
              <span className="material-symbols-outlined text-sm">verified</span>
            </div>
          </div>

          <div className="text-center md:text-left flex-1 space-y-4 w-full">
            <div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  {athleteProfile.name}
                </h1>
                <span className="font-mono text-[10px] bg-[#00f5d4]/10 text-[#00f5d4] border border-[#00f5d4]/30 px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider">
                  Hardware Synced
                </span>
              </div>
              <p className="font-mono text-xs text-white/50 mt-1">{athleteProfile.role}</p>
            </div>

            <div className="pt-3 border-t border-white/[0.08] grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              <div>
                <label
                  className="font-mono text-[11px] text-white/50 block mb-1.5 uppercase tracking-wider font-semibold"
                  htmlFor="primary-sport"
                >
                  Primary Discipline
                </label>
                <div className="relative">
                  <select
                    id="primary-sport"
                    value={athleteProfile.primarySport}
                    onChange={(e) =>
                      setAthleteProfile((prev) => ({
                        ...prev,
                        primarySport: e.target.value,
                        role: `${e.target.value} Athlete`,
                      }))
                    }
                    className="w-full bg-[#0b0d11] border border-white/10 rounded-xl py-2.5 px-4 font-mono text-xs text-white appearance-none focus:outline-none focus:border-[#00f5d4] transition-all cursor-pointer"
                  >
                    <option value="Volleyball" className="bg-[#0b0d11]">Volleyball</option>
                    <option value="Basketball" className="bg-[#0b0d11]">Basketball</option>
                    <option value="Track & Field" className="bg-[#0b0d11]">Track &amp; Field</option>
                    <option value="Plyometrics" className="bg-[#0b0d11]">Plyometrics</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 text-base">
                    expand_more
                  </span>
                </div>
              </div>

              <div>
                <label
                  className="font-mono text-[11px] text-white/50 block mb-1.5 uppercase tracking-wider font-semibold"
                  htmlFor="wear-location"
                >
                  Sensor Wear Placement
                </label>
                <div className="relative">
                  <select
                    id="wear-location"
                    value={athleteProfile.wearLocation || 'waist'}
                    onChange={(e) =>
                      setAthleteProfile((prev) => ({
                        ...prev,
                        wearLocation: e.target.value as any,
                      }))
                    }
                    className="w-full bg-[#0b0d11] border border-white/10 rounded-xl py-2.5 px-4 font-mono text-xs text-white appearance-none focus:outline-none focus:border-[#00f5d4] transition-all cursor-pointer"
                  >
                    <option value="waist" className="bg-[#0b0d11]">Waist / Lower Back (Recommended - Center of Mass)</option>
                    <option value="ankle" className="bg-[#0b0d11]">Ankle / Foot (Impact &amp; Contact Mode)</option>
                    <option value="arm" className="bg-[#0b0d11]">Arm / Forearm (Upper Limb Dynamics)</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 text-base">
                    expand_more
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BIOMECHANICAL PHYSICS PARAMETERS ENGINE */}
        <section className="rounded-3xl bg-[#121620]/80 border border-white/[0.08] p-6 backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00f5d4] text-lg">biometrics</span>
                <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                  Biomechanical Input Engine
                </h2>
              </div>
              <p className="text-xs font-mono text-white/40 mt-0.5">
                Physical baselines required for Sayers impulse &amp; vertical reach calculations
              </p>
            </div>
            <span className="font-mono text-[10px] bg-[#00f5d4]/10 text-[#00f5d4] border border-[#00f5d4]/30 px-3 py-1 rounded-full font-bold uppercase tracking-wider self-start sm:self-auto">
              Calibration Baseline
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Height Input */}
            <div className="bg-[#0b0d11]/80 border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between gap-2 hover:border-[#00f5d4]/40 transition-colors">
              <div className="flex justify-between items-center">
                <label className="font-mono text-[11px] text-white/50 uppercase tracking-wider font-semibold" htmlFor="height-input">
                  Height
                </label>
                <span className="material-symbols-outlined text-sm text-[#00f5d4]">height</span>
              </div>
              <div className="relative">
                <input
                  id="height-input"
                  type="number"
                  step="0.5"
                  value={athleteProfile.heightCm}
                  onChange={(e) =>
                    setAthleteProfile((prev) => ({
                      ...prev,
                      heightCm: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 px-3 font-mono text-xl text-white focus:outline-none focus:border-[#00f5d4] transition-all font-bold pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[#00f5d4] font-bold">
                  cm
                </span>
              </div>
            </div>

            {/* Weight Input */}
            <div className="bg-[#0b0d11]/80 border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between gap-2 hover:border-[#00f5d4]/40 transition-colors">
              <div className="flex justify-between items-center">
                <label className="font-mono text-[11px] text-white/50 uppercase tracking-wider font-semibold" htmlFor="weight-input">
                  Body Mass
                </label>
                <span className="material-symbols-outlined text-sm text-amber-400">monitor_weight</span>
              </div>
              <div className="relative">
                <input
                  id="weight-input"
                  type="number"
                  step="0.1"
                  value={athleteProfile.weightKg}
                  onChange={(e) =>
                    setAthleteProfile((prev) => ({
                      ...prev,
                      weightKg: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 px-3 font-mono text-xl text-white focus:outline-none focus:border-[#00f5d4] transition-all font-bold pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-amber-400 font-bold">
                  kg
                </span>
              </div>
            </div>

            {/* Standing Reach Input */}
            <div className="bg-[#0b0d11]/80 border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between gap-2 hover:border-[#00f5d4]/40 transition-colors">
              <div className="flex justify-between items-center">
                <label className="font-mono text-[11px] text-white/50 uppercase tracking-wider font-semibold" htmlFor="reach-input">
                  Standing Reach
                </label>
                <span className="material-symbols-outlined text-sm text-purple-400">straighten</span>
              </div>
              <div className="relative">
                <input
                  id="reach-input"
                  type="number"
                  step="0.5"
                  value={athleteProfile.standingReachCm}
                  onChange={(e) =>
                    setAthleteProfile((prev) => ({
                      ...prev,
                      standingReachCm: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 px-3 font-mono text-xl text-white focus:outline-none focus:border-[#00f5d4] transition-all font-bold pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-purple-400 font-bold">
                  cm
                </span>
              </div>
            </div>
          </div>

          {/* Live Calculated Biomechanical Indicators Bar */}
          <div className="pt-3 border-t border-white/[0.08] grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/[0.02] p-3.5 rounded-2xl border border-white/[0.06] flex flex-col justify-between">
              <span className="font-mono text-[10px] text-white/40 uppercase tracking-wider">
                Max Spike / Block Reach
              </span>
              <div className="font-mono text-lg text-[#00f5d4] mt-1 font-bold">
                {estimatedMaxReachCm.toFixed(1)} cm
              </div>
              <span className="font-mono text-[9px] text-white/30 mt-0.5">Reach + Peak Jump ({maxJumpCm}cm)</span>
            </div>

            <div className="bg-white/[0.02] p-3.5 rounded-2xl border border-white/[0.06] flex flex-col justify-between">
              <span className="font-mono text-[10px] text-white/40 uppercase tracking-wider">
                Sayers Peak Power Output
              </span>
              <div className="font-mono text-lg text-amber-300 mt-1 font-bold">
                {estimatedPeakPowerW} W
              </div>
              <span className="font-mono text-[9px] text-white/30 mt-0.5">Instantaneous explosive mechanical wattage</span>
            </div>

            <div className="bg-white/[0.02] p-3.5 rounded-2xl border border-white/[0.06] flex flex-col justify-between">
              <span className="font-mono text-[10px] text-white/40 uppercase tracking-wider">
                Power-to-Weight Ratio
              </span>
              <div className="font-mono text-lg text-emerald-400 mt-1 font-bold">
                {powerToWeightRatio} W/kg
              </div>
              <span className="font-mono text-[9px] text-white/30 mt-0.5">Explosiveness index per kg mass</span>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleSaveParameters}
              className="bg-[#00f5d4] text-black rounded-xl px-5 py-2.5 font-mono text-xs font-bold hover:bg-[#00f5d4]/90 transition-all cursor-pointer uppercase tracking-wider shadow-[0_0_15px_rgba(0,245,212,0.2)] active:scale-95 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm font-bold">save</span>
              Save Biomechanics Baseline
            </button>
          </div>
        </section>

        {/* System Preferences Section (Cleaned up: No unwanted light mode toggle) */}
        <section className="rounded-3xl bg-[#121620]/80 border border-white/[0.08] p-6 backdrop-blur-xl space-y-4">
          <div className="border-b border-white/[0.08] pb-3">
            <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#00f5d4]">tune</span>
              System Preferences
            </h2>
            <p className="text-xs font-mono text-white/40 mt-0.5">
              Unit formatting and measurement system configuration
            </p>
          </div>

          <div className="flex justify-between items-center py-2">
            <div>
              <div className="text-sm text-white font-medium">Unit Measurement System</div>
              <div className="font-mono text-xs text-white/40 mt-0.5">
                Switch between Metric (cm/kg) and Imperial (in/lbs)
              </div>
            </div>

            <div className="flex items-center gap-2.5 font-mono text-xs">
              <button
                onClick={() =>
                  setAthleteProfile((prev) => ({
                    ...prev,
                    units: 'metric',
                  }))
                }
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  athleteProfile.units === 'metric'
                    ? 'bg-[#00f5d4]/15 text-[#00f5d4] border-[#00f5d4]/40 shadow-[0_0_10px_rgba(0,245,212,0.15)]'
                    : 'bg-white/[0.02] text-white/40 border-white/[0.08] hover:text-white'
                }`}
              >
                Metric (cm)
              </button>
              <button
                onClick={() =>
                  setAthleteProfile((prev) => ({
                    ...prev,
                    units: 'imperial',
                  }))
                }
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  athleteProfile.units === 'imperial'
                    ? 'bg-amber-400/15 text-amber-300 border-amber-400/40 shadow-[0_0_10px_rgba(251,191,36,0.15)]'
                    : 'bg-white/[0.02] text-white/40 border-white/[0.08] hover:text-white'
                }`}
              >
                Imperial (in)
              </button>
            </div>
          </div>
        </section>

        {/* Account & Data Management Section */}
        <section className="rounded-3xl bg-[#121620]/80 border border-white/[0.08] p-6 backdrop-blur-xl space-y-4">
          <div className="border-b border-white/[0.08] pb-3">
            <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#00f5d4]">folder_data</span>
              Data &amp; Storage Management
            </h2>
            <p className="text-xs font-mono text-white/40 mt-0.5">
              Export raw session telemetry or clear offline persistent memory
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleExportAllCSV}
              className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.08] hover:border-[#00f5d4]/40 rounded-2xl p-4 flex items-center justify-between transition-all group cursor-pointer"
            >
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold text-white group-hover:text-[#00f5d4] transition-colors">
                  Export Complete Telemetry (.CSV)
                </span>
                <span className="font-mono text-xs text-white/40 mt-0.5">
                  Download structured logs for all sessions
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center text-[#00f5d4] group-hover:bg-[#00f5d4]/20 transition-colors">
                <span className="material-symbols-outlined text-base group-hover:translate-y-0.5 transition-transform">
                  download
                </span>
              </div>
            </button>

            <button
              onClick={handleClearCacheClick}
              className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.08] hover:border-amber-400/40 rounded-2xl p-4 flex items-center justify-between transition-all group cursor-pointer"
            >
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
                  Purge Local Storage Cache
                </span>
                <span className="font-mono text-xs text-white/40 mt-0.5">
                  Clear cached session logs &amp; reset state
                </span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center text-amber-400 group-hover:bg-amber-400/20 transition-colors">
                <span className="material-symbols-outlined text-base group-hover:rotate-180 transition-transform duration-500">
                  cleaning_services
                </span>
              </div>
            </button>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-white/[0.08]">
            <button
              onClick={onClose}
              className="w-full sm:w-auto bg-[#00f5d4]/10 hover:bg-[#00f5d4]/20 border border-[#00f5d4]/30 text-[#00f5d4] font-mono font-bold text-xs uppercase tracking-wider px-6 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Return to Telemetry
            </button>
            <button
              onClick={() => {
                onClose();
                if (onLogout) onLogout();
              }}
              className="w-full sm:w-auto border border-rose-500/30 hover:border-rose-500 text-rose-300 hover:bg-rose-500/10 rounded-xl px-5 py-2.5 font-mono text-xs transition-colors flex items-center justify-center gap-2 font-bold cursor-pointer uppercase tracking-wider"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              Disconnect &amp; Logout
            </button>
          </div>
        </section>
      </main>
    </motion.div>
  );
};
