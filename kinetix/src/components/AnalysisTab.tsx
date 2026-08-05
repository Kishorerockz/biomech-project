import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SessionData, AthleteProfile } from '../types';
import { formatDuration, formatMetricHeight } from '../data';

interface AnalysisTabProps {
  currentSession: SessionData;
  athleteProfile: AthleteProfile;
  allTimePbCm?: number;
  onReturnHome: () => void;
}

export const AnalysisTab: React.FC<AnalysisTabProps> = ({ currentSession, athleteProfile, allTimePbCm = 0, onReturnHome }) => {
  // Use passed PB or fallback
  const pbTarget = allTimePbCm || 0;
  const pbScale = pbTarget > 0 ? pbTarget * 1.1 : 50;
  const fatigueThreshold = pbTarget * 0.7;
  const targetZoneMax = pbTarget;
  const targetZoneMin = pbTarget * 0.8;
  const [downloadNotification, setDownloadNotification] = useState(false);

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Attempt,Timestamp,Height_cm,IsPeak,IsFatigue\n' +
      currentSession.attempts
        .map(
          (a) =>
            `${a.id},${a.timestampStr},${a.jumpCm},${a.isPeak ? 'YES' : 'NO'},${
              a.isFatigue ? 'YES' : 'NO'
            }`
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `telemetry_debrief_${currentSession.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadNotification(true);
    setTimeout(() => setDownloadNotification(false), 3000);
  };

  // SVG Ring calculation
  const radius = 40;
  const circumference = 2 * Math.PI * radius; // 251.33
  const strokeDashoffset = circumference - (currentSession.intensityPercent / 100) * circumference;

  return (
    <div className="pt-20 md:pt-24 px-5 md:px-10 max-w-4xl mx-auto space-y-6 pb-48">
      {/* Toast Notification */}
      <AnimatePresence>
        {downloadNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-5 z-50 bg-[#10b981] text-black px-4 py-2 rounded-full font-data-label text-xs shadow-lg flex items-center gap-2 font-bold"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Telemetry .CSV exported successfully!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen Title & Top Bar Actions */}
      <div className="flex justify-between items-center border-b border-white/10 pb-4">
        <button
          onClick={onReturnHome}
          className="text-white/60 hover:text-[#c9a050] transition-colors p-2 rounded-full active:scale-95 cursor-pointer"
          title="Close Debrief"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <h1 className="font-headline-md text-xl md:text-2xl font-bold tracking-widest text-[#c9a050] uppercase">
          SESSION DEBRIEF
        </h1>

        <button
          onClick={handleExportCSV}
          className="text-white/60 hover:text-[#c9a050] transition-colors p-2 rounded-full active:scale-95 cursor-pointer"
          title="Export CSV"
        >
          <span className="material-symbols-outlined">file_download</span>
        </button>
      </div>

      {/* Score Card: Session Intensity */}
      <section className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col items-center relative overflow-hidden backdrop-blur-md">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 mb-2">
          <div className="hidden sm:block w-28" />
          <h2 className="font-data-label text-xs text-white/50 uppercase tracking-[0.2em] font-bold text-center">
            Session Intensity
          </h2>
          <div className="bg-[#c9a050]/10 text-[#c9a050] px-3 py-1 rounded-full text-xs font-data-label flex items-center gap-2 border border-[#c9a050]/30 font-bold uppercase tracking-wider whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-[#c9a050] pulse-dot-cyan" />
            PEAK EFFORT
          </div>
        </div>

        <div className="relative w-44 h-44 flex items-center justify-center my-3">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
            <circle
              className="text-white/10 stroke-current"
              cx="50"
              cy="50"
              fill="transparent"
              r={radius}
              strokeWidth="8"
            />
            <circle
              className="text-[#c9a050] stroke-current progress-ring__circle"
              cx="50"
              cy="50"
              fill="transparent"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              strokeWidth="8"
            />
          </svg>

          <div className="flex flex-col items-center">
            <span className="font-display-metrics text-4xl text-[#c9a050]">
              {currentSession.intensityPercent}%
            </span>
          </div>
        </div>
      </section>

      {/* Metrics Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-white/50 mb-1">
            <span className="material-symbols-outlined text-sm">vertical_align_top</span>
            <span className="font-data-label text-xs uppercase tracking-wider">Peak Jump</span>
          </div>
          <div className="font-data-value text-lg text-[#c9a050]">
            {formatMetricHeight(currentSession.peakJumpCm, athleteProfile.units)}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-white/50 mb-1">
            <span className="material-symbols-outlined text-sm">straighten</span>
            <span className="font-data-label text-xs uppercase tracking-wider">Avg Jump</span>
          </div>
          <div className="font-data-value text-lg text-white">
            {formatMetricHeight(currentSession.avgJumpCm, athleteProfile.units)}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-white/50 mb-1">
            <span className="material-symbols-outlined text-sm">reorder</span>
            <span className="font-data-label text-xs uppercase tracking-wider">Total Reps</span>
          </div>
          <div className="font-data-value text-lg text-white">{currentSession.totalReps}</div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-white/50 mb-1">
            <span className="material-symbols-outlined text-sm">timer</span>
            <span className="font-data-label text-xs uppercase tracking-wider">Duration</span>
          </div>
          <div className="font-data-value text-lg text-white">
            {formatDuration(currentSession.durationSec)}
          </div>
        </div>
      </section>

      {/* Jump Performance Trend & Target Zones Chart */}
      <section className="bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <h2 className="font-data-label text-xs text-white/60 uppercase tracking-[0.2em] font-bold">
              Jump Performance vs Target Zones
            </h2>
            <p className="font-data-label text-[11px] text-white/40 mt-0.5">
              Attempt trajectory against Personal Best (PB) and fatigue thresholds
            </p>
          </div>

          {/* Chart Legend Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-data-label text-[10px] text-[#c9a050] border border-[#c9a050]/40 px-2 py-0.5 rounded-full bg-[#c9a050]/10 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c9a050]" />
              PB: {pbTarget.toFixed(1)}cm
            </span>
            <span className="font-data-label text-[10px] text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full bg-emerald-500/10 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Target Zone: {targetZoneMin.toFixed(0)}–{targetZoneMax.toFixed(0)}cm
            </span>
            <span className="font-data-label text-[10px] text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full bg-red-500/10 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              Fatigue: {fatigueThreshold.toFixed(1)}cm
            </span>
          </div>
        </div>

        <div className="relative h-52 w-full border-l border-b border-white/10 pb-6 pl-2 pt-2">
          {/* Target Zone Highlight Band */}
          {pbTarget > 0 && (() => {
            const yMin = 100 - (targetZoneMax / pbScale) * 100;
            const yMax = 100 - (targetZoneMin / pbScale) * 100;
            return (
              <div 
                className="absolute w-full bg-emerald-500/5 border-y border-emerald-500/20 pointer-events-none z-0 flex items-center justify-end pr-2"
                style={{ top: `${yMin}%`, height: `${yMax - yMin}%` }}
              >
                <span className="text-[9px] font-data-label uppercase tracking-widest text-emerald-400/60 font-bold bg-[#0a0a0a]/80 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Optimal Target Zone ({targetZoneMin.toFixed(0)}–{targetZoneMax.toFixed(0)}cm)
                </span>
              </div>
            );
          })()}

          {/* Personal Best (PB) Threshold Line */}
          {pbTarget > 0 && (() => {
            const pbY = 100 - (pbTarget / pbScale) * 100;
            return (
              <div 
                className="absolute w-full border-b border-dashed border-[#c9a050] opacity-90 flex items-center z-10"
                style={{ top: `${pbY}%` }}
              >
                <span className="absolute right-2 -top-2.5 text-[9px] text-[#c9a050] font-data-label uppercase font-bold bg-[#0a0a0a] px-2 py-0.5 rounded border border-[#c9a050]/40 shadow-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[10px] text-[#c9a050]">emoji_events</span>
                  Personal Best ({pbTarget.toFixed(1)}cm)
                </span>
              </div>
            );
          })()}

          {/* Fatigue Threshold Line */}
          {pbTarget > 0 && (() => {
            const fatY = 100 - (fatigueThreshold / pbScale) * 100;
            return (
              <div 
                className="absolute w-full border-b border-dashed border-red-400/60 opacity-80 flex items-center z-10"
                style={{ top: `${fatY}%` }}
              >
                <span className="absolute right-2 -top-2.5 text-[9px] text-red-300 font-data-label uppercase font-bold bg-[#0a0a0a] px-2 py-0.5 rounded border border-red-500/30">
                  Fatigue Threshold ({fatigueThreshold.toFixed(1)}cm)
                </span>
              </div>
            );
          })()}

          {/* Trend SVG Area & Line */}
          {(() => {
            if (!currentSession.attempts || currentSession.attempts.length === 0) {
              return (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/30 text-sm font-data-label uppercase tracking-widest">No jumps recorded yet</span>
                </div>
              );
            }

            const pbScale = Math.max(pbTarget * 1.1, 1);
            const points = currentSession.attempts.map((a, i) => {
              const x = currentSession.attempts.length > 1 ? (i / (currentSession.attempts.length - 1)) * 100 : 50;
              const y = 100 - (a.jumpCm / pbScale) * 100;
              return { x, y, a };
            });

            // Construct SVG path string with straight lines
            const dLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
            const dFill = `${dLine} L100,100 L0,100 Z`;

            return (
              <>
                <svg className="absolute inset-0 h-full w-full z-0" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="debriefGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                      <stop offset="0%" stopColor="#c9a050" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#c9a050" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {points.length > 1 && (
                    <path d={dFill} fill="url(#debriefGrad)" />
                  )}
                  <path d={dLine} fill="none" stroke="#c9a050" strokeWidth="2.5" />
                </svg>

                {/* Interactive Plot Points for Attempt Reps */}
                <div className="absolute inset-0 z-20 pointer-events-none">
                  {points.map((p, i) => {
                    const isFatigue = p.a.jumpCm < fatigueThreshold;
                    const isPeak = p.a.jumpCm >= currentSession.peakJumpCm;
                    
                    return (
                      <div 
                        key={i} 
                        className="absolute group/pt pointer-events-auto cursor-pointer flex items-center justify-center" 
                        style={{ left: `${p.x}%`, top: `${p.y}%`, width: '20px', height: '20px', transform: 'translate(-50%, -50%)' }}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full ${isPeak ? 'bg-[#c9a050] animate-pulse' : isFatigue ? 'bg-red-500' : 'bg-emerald-400'} border-2 border-black shadow-[0_0_8px_rgba(201,160,80,0.5)]`} />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/pt:flex flex-col items-center bg-[#131313] border border-white/20 px-2 py-1 rounded text-[10px] font-data-label text-white whitespace-nowrap z-30 shadow-xl">
                          <span className="font-bold">{p.a.jumpCm}cm</span>
                          <span className="text-white/50 text-[9px]">Rep {i + 1}</span>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#131313]" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      </section>

      {/* Attempt Log */}
      <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col max-h-72">
        <div className="p-4 border-b border-white/10 bg-[#0a0a0a] sticky top-0 z-10 flex justify-between items-center">
          <h2 className="font-data-label text-xs text-white/60 uppercase tracking-[0.2em]">
            Attempt History ({currentSession.attempts.length})
          </h2>
          <button
            onClick={handleExportCSV}
            className="text-xs font-data-label text-[#c9a050] hover:underline flex items-center gap-1 font-bold uppercase tracking-wider cursor-pointer"
          >
            <span className="material-symbols-outlined text-xs">download</span> CSV
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-2">
          {currentSession.attempts.map((attempt) => (
            <div
              key={attempt.id}
              className={`flex justify-between items-center py-2.5 px-3 rounded-lg border text-sm ${
                attempt.isPeak
                  ? 'bg-[#c9a050]/15 border-[#c9a050]/40'
                  : attempt.isFatigue
                  ? 'bg-red-950/20 border-red-500/30'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">Attempt #{attempt.id}</span>
                {attempt.isPeak && (
                  <span className="text-[10px] font-data-label bg-[#c9a050] text-black px-1.5 py-0.2 rounded font-bold uppercase">
                    Peak
                  </span>
                )}
                {attempt.isFatigue && (
                  <span className="text-[10px] font-data-label bg-red-600 text-white px-1.5 py-0.2 rounded font-bold uppercase">
                    Fatigue
                  </span>
                )}
              </div>

              <span className="font-data-value text-xs text-white/50">
                {attempt.timestampStr}
              </span>

              <span
                className={`font-data-value text-sm ${
                  attempt.isPeak
                    ? 'text-[#c9a050] font-bold'
                    : attempt.isFatigue
                    ? 'text-red-300'
                    : 'text-white'
                }`}
              >
                {formatMetricHeight(attempt.jumpCm, athleteProfile.units)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Sticky Bottom Action */}
      <div className="fixed bottom-0 left-0 w-full p-4 md:px-10 bg-[#0a0a0a]/90 backdrop-blur-md border-t border-white/10 z-40 flex justify-center shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
        <button
          onClick={onReturnHome}
          className="w-full max-w-md bg-[#c9a050] text-black font-headline-md py-3.5 rounded-full hover:bg-[#d9b060] transition-colors active:scale-95 flex items-center justify-center gap-2 font-bold shadow-lg cursor-pointer uppercase tracking-[0.2em]"
        >
          Save & Return to Home
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};
