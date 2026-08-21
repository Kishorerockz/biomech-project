import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
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
    setToastMsg('Physics parameters saved & biomechanics updated!');
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Derive peak jump across sessions for calculations
<<<<<<< HEAD
  const maxJumpCm = Math.max(...sessions.map((s) => s.peakJumpCm), 54.5);

  // Sayers Peak Power Formula: P(Watts) = 60.7 * JumpHeight(cm) + 45.3 * Mass(kg) - 2055
  const estimatedPeakPowerW = Math.round(
    60.7 * maxJumpCm + 45.3 * athleteProfile.weightKg - 2055
  );
=======
  const maxJumpCm = sessions.reduce((max, s) => Math.max(max, s.peakJumpCm || 0), 0);

  // Sayers Peak Power Formula: P(Watts) = 60.7 * JumpHeight(cm) + 45.3 * Mass(kg) - 2055
  const estimatedPeakPowerW = maxJumpCm > 0 
    ? Math.max(0, Math.round(60.7 * maxJumpCm + 45.3 * athleteProfile.weightKg - 2055))
    : 0;
    
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
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
    link.setAttribute('download', `telemetry_lab_full_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToastMsg('All telemetry .CSV exported!');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleClearCacheClick = () => {
    onClearCache();
    setToastMsg('Session cache cleared successfully.');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md overflow-y-auto"
    >
      {/* Toast Notification */}
      {saveSuccess && (
        <div className="fixed top-20 right-5 z-50 bg-[#c9a050] text-black px-4 py-2 rounded-full font-data-label text-xs shadow-lg flex items-center gap-2 font-bold animate-fade-in uppercase tracking-wider">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          {toastMsg}
        </div>
      )}

      {/* Top Header */}
      <header className="fixed top-0 w-full z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/10 flex justify-between items-center px-5 md:px-10 h-16">
        <button
          onClick={onClose}
          className="text-white/60 hover:text-[#c9a050] transition-colors p-2 rounded-full flex items-center justify-center active:scale-95 cursor-pointer gap-1"
          aria-label="Back to Dashboard"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="font-data-label text-xs uppercase hidden sm:inline">Back to Telemetry</span>
        </button>

        <div className="font-display-metrics text-xs sm:text-base md:text-xl tracking-wide sm:tracking-widest text-[#c9a050] font-bold uppercase text-center truncate px-2">
          ATHLETE PROFILE &amp; BIOMECHANICS
        </div>

        <button
          onClick={onClose}
          className="text-white/60 hover:text-[#c9a050] transition-colors p-2 rounded-full cursor-pointer flex items-center gap-1"
        >
          <span className="text-[10px] font-data-label text-white/40 hidden sm:inline border border-white/10 px-1.5 py-0.5 rounded">ESC</span>
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="mt-20 px-5 md:px-10 py-6 max-w-4xl mx-auto w-full space-y-8 pb-32">
        {/* Profile Header Section */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex flex-col items-center md:flex-row md:items-start gap-6">
          <div className="relative group">
            <img
              src={athleteProfile.avatarUrl}
              alt={athleteProfile.name}
              className="w-28 h-28 md:w-32 md:h-32 rounded-full object-cover border-2 border-[#c9a050] shadow-xl"
            />
<<<<<<< HEAD
=======
            <button className="absolute bottom-0 right-0 bg-white/10 rounded-full p-2 border border-white/20 hover:bg-white/20 transition-colors text-white cursor-pointer">
              <span className="material-symbols-outlined text-sm">edit</span>
            </button>
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
          </div>

          <div className="text-center md:text-left flex-1 space-y-3">
            <div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
<<<<<<< HEAD
                <h1 className="font-headline-lg-mobile md:font-headline-lg text-2xl md:text-3xl font-bold text-white tracking-wide">
                  {athleteProfile.name}
                </h1>
                <span className="font-data-label text-[10px] bg-[#c9a050]/20 text-[#c9a050] border border-[#c9a050]/40 px-2 py-0.5 rounded-full uppercase font-bold">
                  VERIFIED HARDWARE NODE
=======
                <input
                  type="text"
                  value={athleteProfile.name}
                  onChange={(e) => setAthleteProfile(prev => ({ ...prev, name: e.target.value }))}
                  className="font-headline-lg-mobile md:font-headline-lg text-2xl md:text-3xl font-bold text-white tracking-wide bg-transparent border-b border-transparent hover:border-white/20 focus:border-[#c9a050] focus:outline-none transition-colors w-full max-w-xs text-center md:text-left p-0"
                />
                <span className="font-data-label text-[10px] bg-[#c9a050]/20 text-[#c9a050] border border-[#c9a050]/40 px-2 py-0.5 rounded-full uppercase font-bold">
                  PRO ACCOUNT
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
                </span>
              </div>
              <p className="font-body-lg text-base text-white/60 mt-0.5">{athleteProfile.role}</p>
            </div>

            <div className="pt-3 border-t border-white/10 inline-block md:block w-full max-w-xs">
              <label
                className="font-data-label text-xs text-white/50 block mb-2 uppercase tracking-wider"
                htmlFor="primary-sport"
              >
                PRIMARY SPORT
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
                  className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 px-4 font-data-value text-sm text-white appearance-none focus:outline-none focus:border-[#c9a050] transition-all cursor-pointer"
                >
                  <option value="Volleyball" className="bg-[#0a0a0a]">Volleyball</option>
                  <option value="Basketball" className="bg-[#0a0a0a]">Basketball</option>
                  <option value="Track & Field" className="bg-[#0a0a0a]">Track &amp; Field</option>
                  <option value="Cricket" className="bg-[#0a0a0a]">Cricket</option>
                  <option value="Sprints" className="bg-[#0a0a0a]">Sprints</option>
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
                  expand_more
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* PRIORITY 1: BIOMECHANICAL PHYSICS PARAMETERS ENGINE */}
        <section className="space-y-4 bg-gradient-to-b from-[#c9a050]/10 via-white/5 to-white/5 border border-[#c9a050]/40 rounded-3xl p-6 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <span className="material-symbols-outlined text-8xl text-[#c9a050]">sports_score</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="min-w-0 flex-1">
<<<<<<< HEAD
              <div className="flex items-center gap-2 flex-wrap">
                <span className="material-symbols-outlined text-[#c9a050] text-xl shrink-0">biometrics</span>
                <h2 className="font-headline-md text-base sm:text-lg md:text-xl text-[#c9a050] font-bold uppercase tracking-wide leading-tight">
                  BIOMECHANICAL INPUT ENGINE
                </h2>
              </div>
              <p className="font-data-label text-xs text-white/60 mt-1">
                Core physics baseline parameters required for Sayers impulse &amp; vertical reach calculations
              </p>
            </div>
            <span className="font-data-label text-[10px] bg-[#c9a050] text-black px-2.5 py-1 rounded-full font-bold uppercase tracking-widest self-start sm:self-center shrink-0">
              Core Calibration Input
=======
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="material-symbols-outlined text-[#c9a050] text-xl shrink-0">biometrics</span>
                <h2 className="font-headline-md text-base md:text-lg text-[#c9a050] font-bold uppercase tracking-wide">
                  BIOMECHANICS
                </h2>
              </div>
              <p className="font-data-label text-xs text-white/50 leading-relaxed">
                Core baseline parameters required for impulse & vertical reach calculations.
              </p>
            </div>
            <span className="font-data-label text-[10px] bg-[#c9a050] text-black px-2.5 py-1 rounded-full font-bold uppercase tracking-widest self-start sm:self-center shrink-0">
              Calibration Data
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Height Input */}
            <div className="bg-black/40 border border-white/15 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-[#c9a050]/50 transition-colors">
              <div className="flex justify-between items-center">
                <label className="font-data-label text-xs text-white/60 uppercase tracking-wider font-bold" htmlFor="height-input">
                  HEIGHT (CM)
                </label>
                <span className="material-symbols-outlined text-xs text-[#c9a050]">height</span>
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
                  className="w-full bg-white/5 border border-white/20 rounded-xl py-2.5 px-4 font-display-metrics text-2xl text-white focus:outline-none focus:border-[#c9a050] transition-all text-right pr-12 font-bold"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-data-label text-xs text-[#c9a050] font-bold">
                  cm
                </span>
              </div>
            </div>

            {/* Weight Input */}
            <div className="bg-black/40 border border-white/15 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-[#c9a050]/50 transition-colors">
              <div className="flex justify-between items-center">
                <label className="font-data-label text-xs text-white/60 uppercase tracking-wider font-bold" htmlFor="weight-input">
                  BODY MASS (KG)
                </label>
                <span className="material-symbols-outlined text-xs text-[#c9a050]">monitor_weight</span>
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
                  className="w-full bg-white/5 border border-white/20 rounded-xl py-2.5 px-4 font-display-metrics text-2xl text-white focus:outline-none focus:border-[#c9a050] transition-all text-right pr-12 font-bold"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-data-label text-xs text-[#c9a050] font-bold">
                  kg
                </span>
              </div>
            </div>

            {/* Standing Reach Input */}
            <div className="bg-black/40 border border-white/15 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-[#c9a050]/50 transition-colors">
              <div className="flex justify-between items-center">
                <label className="font-data-label text-xs text-white/60 uppercase tracking-wider font-bold" htmlFor="reach-input">
                  STANDING REACH (CM)
                </label>
                <span className="material-symbols-outlined text-xs text-[#c9a050]">straighten</span>
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
                  className="w-full bg-white/5 border border-white/20 rounded-xl py-2.5 px-4 font-display-metrics text-2xl text-white focus:outline-none focus:border-[#c9a050] transition-all text-right pr-12 font-bold"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-data-label text-xs text-[#c9a050] font-bold">
                  cm
                </span>
              </div>
            </div>
          </div>

          {/* Live Calculated Biomechanical Indicators Bar */}
          <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10 flex flex-col justify-between">
              <span className="font-data-label text-[10px] text-white/50 uppercase tracking-wider">
                Est. Spike Reach
              </span>
              <div className="font-display-metrics text-xl text-[#c9a050] mt-1 font-bold">
                {estimatedMaxReachCm.toFixed(1)} cm
              </div>
<<<<<<< HEAD
              <span className="font-data-label text-[9px] text-white/40 mt-0.5">Reach + Peak Jump ({maxJumpCm}cm)</span>
=======
              <span className="font-data-label text-[9px] text-white/40 mt-0.5">
                {maxJumpCm > 0 ? `Reach + Peak Jump (${maxJumpCm}cm)` : 'Based on standing reach'}
              </span>
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/10 flex flex-col justify-between">
              <span className="font-data-label text-[10px] text-white/50 uppercase tracking-wider">
                Sayers Peak Power Output
              </span>
              <div className="font-display-metrics text-xl text-[#c9a050] mt-1 font-bold">
                {estimatedPeakPowerW} Watts
              </div>
              <span className="font-data-label text-[9px] text-white/40 mt-0.5">Peak mechanical explosive force</span>
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/10 flex flex-col justify-between">
              <span className="font-data-label text-[10px] text-white/50 uppercase tracking-wider">
                Power-to-Weight Ratio
              </span>
              <div className="font-display-metrics text-xl text-emerald-400 mt-1 font-bold">
                {powerToWeightRatio} W/kg
              </div>
              <span className="font-data-label text-[9px] text-white/40 mt-0.5">Explosiveness index</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveParameters}
              className="bg-[#c9a050] text-black rounded-full px-6 py-2.5 font-data-value text-xs font-bold hover:bg-[#d9b060] transition-all cursor-pointer uppercase tracking-widest shadow-lg active:scale-95 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              UPDATE BIOMECHANICS BASELINE
            </button>
          </div>
        </section>

        {/* System Preferences Section */}
        <section className="space-y-4">
          <h2 className="font-headline-md text-lg md:text-xl text-[#c9a050] font-bold border-b border-white/10 pb-2 uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-base">tune</span>
            SYSTEM PREFERENCES
          </h2>

          <div className="bg-white/5 border border-white/10 rounded-2xl divide-y divide-white/10 backdrop-blur-md">
            {/* Units Toggle */}
            <div className="flex justify-between items-center p-4">
              <div>
                <div className="font-body-lg text-base text-white font-medium">Unit Measurement System</div>
                <div className="font-body-sm text-xs text-white/50">Switch between Metric (cm/kg) and Imperial (in/lbs)</div>
              </div>

              <div className="flex items-center gap-3 font-data-label text-xs">
                <span
                  className={athleteProfile.units === 'metric' ? 'text-[#c9a050] font-bold' : 'text-white/50'}
                >
                  Metric
                </span>

                <button
                  onClick={() =>
                    setAthleteProfile((prev) => ({
                      ...prev,
                      units: prev.units === 'metric' ? 'imperial' : 'metric',
                    }))
                  }
                  className="w-12 h-6 rounded-full bg-white/10 border border-white/20 p-0.5 relative transition-colors cursor-pointer"
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-[#c9a050] transition-transform ${
                      athleteProfile.units === 'imperial' ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>

                <span
                  className={athleteProfile.units === 'imperial' ? 'text-[#c9a050] font-bold' : 'text-white/50'}
                >
                  Imperial
                </span>
              </div>
            </div>

            {/* Dark Mode Toggle */}
            <div className="flex justify-between items-center p-4">
              <div>
                <div className="font-body-lg text-base text-white font-medium">High-Contrast Canvas</div>
                <div className="font-body-sm text-xs text-white/50">
                  Obsidian low-glare HUD color profile
                </div>
              </div>

              <button
                onClick={() =>
                  setAthleteProfile((prev) => ({
                    ...prev,
                    darkMode: !prev.darkMode,
                  }))
                }
                className="w-12 h-6 rounded-full bg-white/10 border border-white/20 p-0.5 relative transition-colors cursor-pointer"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-[#c9a050] transition-transform ${
                    athleteProfile.darkMode ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Account & Data Management Section */}
        <section className="space-y-4">
          <h2 className="font-headline-md text-lg md:text-xl text-[#c9a050] font-bold border-b border-white/10 pb-2 uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-base">folder_data</span>
            DATA &amp; ACCOUNT MANAGEMENT
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleExportAllCSV}
              className="bg-white/5 border border-[#c9a050]/50 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors group cursor-pointer backdrop-blur-md"
            >
              <div className="flex flex-col text-left">
                <span className="font-body-lg text-base text-[#c9a050] font-bold uppercase tracking-wider">
                  Export Full Telemetry
                </span>
                <span className="font-body-sm text-xs text-white/50">
                  Download structured .CSV logs for all sessions
                </span>
              </div>
              <span className="material-symbols-outlined text-[#c9a050] group-hover:translate-x-1 transition-transform">
                download
              </span>
            </button>

            <button
              onClick={handleClearCacheClick}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors group cursor-pointer backdrop-blur-md"
            >
              <div className="flex flex-col text-left">
                <span className="font-body-lg text-base text-white font-medium uppercase tracking-wider">
                  Purge Local Storage Cache
                </span>
                <span className="font-body-sm text-xs text-white/50">
                  Clear cached session logs &amp; reset state
                </span>
              </div>
              <span className="material-symbols-outlined text-white/50 group-hover:rotate-180 transition-transform duration-500">
                cleaning_services
              </span>
            </button>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row justify-center items-center gap-4 border-t border-white/10">
            <button
              onClick={onClose}
              className="bg-[#c9a050] text-black font-data-label font-bold text-xs uppercase tracking-[0.2em] px-8 py-3 rounded-full hover:bg-[#d9b060] transition-all cursor-pointer shadow-lg flex items-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              RETURN TO TELEMETRY DASHBOARD
            </button>
            <button
              onClick={() => {
                onClose();
                if (onLogout) onLogout();
              }}
              className="border border-red-500/50 text-red-300 rounded-full px-6 py-3 font-data-value text-xs hover:bg-red-500 hover:text-black transition-colors flex items-center gap-2 font-bold cursor-pointer uppercase tracking-widest opacity-80 hover:opacity-100"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              DISCONNECT &amp; LOGOUT
            </button>
          </div>
        </section>
      </main>
    </motion.div>
  );
};
