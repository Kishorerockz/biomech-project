import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { SessionData, AthleteProfile } from '../types';
import { formatMetricHeight } from '../data';

interface HistoryTabProps {
  sessions: SessionData[];
  athleteProfile: AthleteProfile;
  allTimePbCm?: number;
  backendStats?: {
    personalBest: number;
    targetZoneMin: number;
    targetZoneMax: number;
    fatigueThreshold: number;
  };
  onSelectSession: (session: SessionData) => void;
  onAddLogSession: (newSession: SessionData) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  sessions,
  athleteProfile,
  allTimePbCm = 52.0,
  backendStats,
  onSelectSession,
  onAddLogSession,
}) => {
  const [selectedSport, setSelectedSport] = useState<string>('All');
  const [timeRange, setTimeRange] = useState<string>('Last 30 Days');
  const [showLogModal, setShowLogModal] = useState(false);

  // Overlay Toggles for Target Zones & Personal Best
  const [showPBLine, setShowPBLine] = useState(true);
  const [showTargetZone, setShowTargetZone] = useState(true);
  const [showGoalLine, setShowGoalLine] = useState(true);

  // New Log Form State
  const [newTitle, setNewTitle] = useState('Beach Volleyball Practice');
  const [newSport, setNewSport] = useState('Volleyball');
  const [newPeakJump, setNewPeakJump] = useState(45.5);
  const [newReps, setNewReps] = useState(25);

  const sportsList = ['All', 'Volleyball', 'Sprints', 'Cricket', 'Basketball'];

  const filteredSessions = sessions.filter((s) => {
    if (selectedSport !== 'All' && s.sport.toLowerCase() !== selectedSport.toLowerCase()) {
      return false;
    }
    return true;
  });

  // Fetch robust trends dynamically over the new API!
  const activeAthleteId = athleteProfile.email && athleteProfile.email.split('@')[0] !== 'pro.athlete' && athleteProfile.email.split('@')[0].length > 2 ? athleteProfile.email.split('@')[0] : 'sim_athlete';
  const { data: trendPayload } = useQuery({
    queryKey: ['trends', activeAthleteId],
    queryFn: async () => {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const res = await fetch(`${backendUrl}/api/sessions/history/${activeAthleteId}/trend`);
      if (!res.ok) return { trends: [], weekOverWeekChangePercent: null };
      return await res.json();
    },
    staleTime: 1000 * 60 * 5, 
  });

  const maxPeak = Math.max(...filteredSessions.map((s) => s.peakJumpCm || 0), 0) || 0;
  
  const latestTrend = trendPayload?.trends?.[trendPayload.trends.length - 1];
  const activePb = latestTrend ? latestTrend.personalBest : allTimePbCm;

  const seasonGoal = latestTrend ? latestTrend.targetZoneMax : (activePb > 0 ? activePb * 1.05 : 58.0); 
  const targetZoneMin = latestTrend ? latestTrend.targetZoneMin : (activePb > 0 ? activePb * 0.85 : 42.0);
  const targetZoneMax = latestTrend ? latestTrend.targetZoneMax : (activePb > 0 ? activePb * 1.00 : 52.0);
  const fatigueThreshold = latestTrend ? (latestTrend.targetZoneMin * 0.8) : 38.0; 

  // Calculate weekly average (for displaying current value absolute)
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisWeekSessions = filteredSessions.filter(s => new Date(s.isoDate || s.date) >= oneWeekAgo);
  const getAvg = (list: SessionData[]) => {
    if (list.length === 0) return 0;
    return list.reduce((acc, s) => acc + (s.peakJumpCm || 0), 0) / list.length;
  };
  const weeklyAverage = getAvg(thisWeekSessions);

  // Directly ingest verified WOW backend stats
  const weeklyChange = trendPayload && trendPayload.weekOverWeekChangePercent !== null 
    ? trendPayload.weekOverWeekChangePercent 
    : 0;

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const created: SessionData = {
      id: `session-${Date.now()}`,
      title: newTitle,
      sport: newSport,
      date: 'Today',
      isoDate: new Date().toISOString().split('T')[0],
      peakJumpCm: Number(newPeakJump),
      avgJumpCm: Number((newPeakJump * 0.85).toFixed(1)),
      totalReps: Number(newReps),
      durationSec: 1200,
      intensityPercent: 88,
      attempts: [
        { id: 1, timestampStr: '01:00', jumpCm: Number(newPeakJump), isPeak: true },
        { id: 2, timestampStr: '05:00', jumpCm: Number((newPeakJump - 3).toFixed(1)) },
      ],
      timeline: [
        { timeSec: 0, jumpCm: Number(newPeakJump) },
        { timeSec: 600, jumpCm: Number(newPeakJump - 4) },
      ],
    };

    onAddLogSession(created);
    setShowLogModal(false);
  };

  const getSportIcon = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'volleyball':
        return 'sports_volleyball';
      case 'sprints':
      case 'track':
        return 'sprint';
      case 'cricket':
        return 'sports_cricket';
      case 'basketball':
        return 'sports_basketball';
      default:
        return 'fitness_center';
    }
  };

  return (
    <div className="pt-20 md:pt-24 px-5 md:px-10 max-w-7xl mx-auto space-y-6 pb-28">
      {/* Header & Filter Row */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-2xl md:text-3xl font-bold text-[#c9a050] uppercase tracking-widest">
            ANALYTICS &amp; PROGRESS
          </h1>
          <p className="font-data-label text-xs text-white/50 mt-1">
            Historical performance telemetry and jump progression logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLogModal(true)}
            className="bg-white/10 hover:bg-white/20 border border-[#c9a050]/50 text-[#c9a050] px-4 py-2 rounded-full font-data-label text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-md font-bold uppercase tracking-wider cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            Log Session
          </button>

          <div className="relative inline-block w-44">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="block w-full appearance-none bg-white/5 border border-white/10 text-white py-2 px-4 pr-8 rounded-full leading-tight focus:outline-none focus:border-[#c9a050] font-data-label text-xs cursor-pointer hover:bg-white/10 transition-colors"
            >
              <option className="bg-[#0a0a0a]">Last 30 Days</option>
              <option className="bg-[#0a0a0a]">Last 3 Months</option>
              <option className="bg-[#0a0a0a]">Year to Date</option>
              <option className="bg-[#0a0a0a]">All Time</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/50">
              <span className="material-symbols-outlined text-[18px]">expand_more</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sport Selector Mode Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-1">
        {sportsList.map((sport) => {
          const isActive = selectedSport === sport;
          return (
            <button
              key={sport}
              onClick={() => setSelectedSport(sport)}
              className={`flex-shrink-0 font-data-label text-xs px-4 py-2 rounded-full active:scale-95 transition-all cursor-pointer uppercase tracking-wider font-semibold ${
                isActive
                  ? 'bg-[#c9a050] text-black font-bold'
                  : 'border border-white/10 text-white/80 hover:bg-white/10 bg-white/5'
              }`}
            >
              {sport}
            </button>
          );
        })}
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Long-Term Trend Chart */}
        <div className="card-base p-5 md:p-6 col-span-1 md:col-span-8 flex flex-col justify-between min-h-[340px] bg-white/5 border border-white/10 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-white/10 pb-3">
            <div>
              <h2 className="font-data-label text-xs text-white/50 uppercase tracking-[0.2em] font-bold">
                Peak Jump Height Progress vs Goals
              </h2>
              <div className="font-display-metrics text-3xl md:text-4xl text-[#c9a050] mt-1 flex items-baseline gap-1">
                {formatMetricHeight(maxPeak, athleteProfile.units)}
                {maxPeak > 0 && (
                  <span className="text-xs font-data-label text-emerald-400 font-bold ml-2">
                    {maxPeak >= allTimePbCm ? 'New PB!' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Interactive Target Layer Toggles */}
            <div className="flex flex-wrap gap-1.5 font-data-label text-[10px]">
              <button
                onClick={() => setShowGoalLine(!showGoalLine)}
                className={`px-2.5 py-1 rounded-full border transition-all cursor-pointer font-semibold flex items-center gap-1 ${
                  showGoalLine
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-white/5 text-white/40 border-white/10'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Goal: {seasonGoal.toFixed(1)}cm
              </button>
              <button
                onClick={() => setShowPBLine(!showPBLine)}
                className={`px-2.5 py-1 rounded-full border transition-all cursor-pointer font-semibold flex items-center gap-1 ${
                  showPBLine
                    ? 'bg-[#c9a050]/20 text-[#c9a050] border-[#c9a050]/40'
                    : 'bg-white/5 text-white/40 border-white/10'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#c9a050]" />
                PB: {allTimePbCm.toFixed(1)}cm
              </button>
              <button
                onClick={() => setShowTargetZone(!showTargetZone)}
                className={`px-2.5 py-1 rounded-full border transition-all cursor-pointer font-semibold flex items-center gap-1 ${
                  showTargetZone
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-white/5 text-white/40 border-white/10'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Target Band
              </button>
            </div>
          </div>

          {/* SVG Progress Chart with Target Lines */}
          <div className="relative h-48 w-full mt-auto rounded-xl overflow-hidden border-b border-l border-white/10 pt-2">
            {/* Target Training Zone Band */}
            {showTargetZone && (() => {
              const maxGraphVal = seasonGoal * 1.1;
              const yMin = 100 - (targetZoneMax / maxGraphVal) * 100;
              const yMax = 100 - (targetZoneMin / maxGraphVal) * 100;
              const yFatigue = 100 - (fatigueThreshold / maxGraphVal) * 100;
              return (
                <>
                  <div 
                    className="absolute w-full bg-emerald-500/5 border-y border-emerald-500/20 pointer-events-none z-0 flex items-center justify-end pr-2"
                    style={{ top: `${yMin}%`, height: `${yMax - yMin}%` }}
                  >
                    <span className="text-[9px] font-data-label uppercase tracking-widest text-emerald-400/60 font-bold bg-[#0a0a0a]/80 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      Target ({targetZoneMin.toFixed(0)}–{targetZoneMax.toFixed(0)}cm)
                    </span>
                  </div>
                  
                  {/* Fatigue Zone Band */}
                  <div 
                    className="absolute w-full bg-red-500/5 border-t border-dashed border-red-500/30 pointer-events-none z-0 flex items-center justify-end pr-2"
                    style={{ top: `${yFatigue}%`, height: `${100 - yFatigue}%` }}
                  >
                    <span className="text-[9px] font-data-label uppercase tracking-widest text-red-500/70 font-bold bg-[#0a0a0a]/80 px-1.5 py-0.5 rounded border border-red-500/30">
                      Fatigue (&lt;{fatigueThreshold.toFixed(0)}cm)
                    </span>
                  </div>
                </>
              );
            })()}

            {/* Season Goal Line */}
            {showGoalLine && (() => {
              const goalY = 100 - (seasonGoal / (seasonGoal * 1.1)) * 100;
              return (
                <div 
                  className="absolute w-full border-b border-dashed border-amber-400/80 opacity-90 flex items-center z-10"
                  style={{ top: `${goalY}%` }}
                >
                  <span className="absolute right-2 -top-2.5 text-[9px] text-amber-300 font-data-label uppercase font-bold bg-[#0a0a0a] px-2 py-0.5 rounded border border-amber-500/40 shadow-sm flex items-center gap-1">
                    <span className="material-symbols-outlined text-[10px] text-amber-400">flag</span>
                    Goal: {seasonGoal.toFixed(1)}cm
                  </span>
                </div>
              );
            })()}

            {/* Personal Best (PB) Line */}
            {showPBLine && (() => {
              const pbY = 100 - (allTimePbCm / (seasonGoal * 1.1)) * 100;
              return (
                <div 
                  className="absolute w-full border-b border-dashed border-[#c9a050] opacity-90 flex items-center z-10"
                  style={{ top: `${pbY}%` }}
                >
                  <span className="absolute left-2 -top-2.5 text-[9px] text-[#c9a050] font-data-label uppercase font-bold bg-[#0a0a0a] px-2 py-0.5 rounded border border-[#c9a050]/40 shadow-sm flex items-center gap-1">
                    <span className="material-symbols-outlined text-[10px] text-[#c9a050]">emoji_events</span>
                    PB: {allTimePbCm.toFixed(1)}cm
                  </span>
                </div>
              );
            })()}

            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pb-2 pointer-events-none">
              <div className="border-t border-dashed border-white/10 w-full" />
              <div className="border-t border-dashed border-white/10 w-full" />
              <div className="border-t border-dashed border-white/10 w-full" />
            </div>

            {(() => {
              // We'll map up to the 10 oldest-to-newest sessions
              const graphSessions = [...filteredSessions].reverse().slice(-10);
              if (graphSessions.length === 0) {
                return (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white/30 text-sm font-data-label uppercase tracking-widest">No sessions recorded</span>
                  </div>
                );
              }

              const maxGraphY = (seasonGoal > 0 ? seasonGoal * 1.1 : 50) || 50;
              const points = graphSessions.map((s, i) => {
                const x = graphSessions.length > 1 ? (i / (graphSessions.length - 1)) * 100 : 50;
                const y = Math.max(0, 100 - ((s.peakJumpCm || 0) / maxGraphY) * 100);
                return { x, y, session: s };
              });

              const dLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
              const dFill = `${dLine} L100,100 L0,100 Z`;

              return (
                <>
                  <svg className="absolute bottom-0 w-full h-full z-0 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="goldArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#c9a050" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#c9a050" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {points.length > 1 && (
                      <path d={dFill} fill="url(#goldArea)" />
                    )}
                    <path d={dLine} fill="none" stroke="#c9a050" strokeWidth="2.5" />
                  </svg>

                  {/* Interactive Data Nodes on Trend Curve */}
                  <div className="absolute inset-0 z-20 pointer-events-none">
                    {points.map((p, i) => {
                      const isPB = p.session.peakJumpCm && p.session.peakJumpCm >= activePb;
                      const trendMatch = trendPayload?.trends?.find((t: any) => t.sessionId === p.session.id);
                      const isFatigue = trendMatch?.isFatigueFlag;

                      return (
                        <div 
                          key={p.session.id} 
                          className="absolute group/node pointer-events-auto cursor-pointer flex justify-center items-center"
                          style={{ left: `${p.x}%`, top: `${p.y}%`, width: '16px', height: '16px', transform: 'translate(-50%, -50%)' }}
                          onClick={() => onSelectSession(p.session)}
                        >
                          <div className={`rounded-full border border-black ${isPB ? 'w-3.5 h-3.5 bg-amber-400 border-2 shadow-[0_0_10px_rgba(251,191,36,0.9)] animate-bounce' : (isFatigue ? 'w-3 h-3 bg-red-500 border-2 shadow-[0_0_10px_rgba(239,68,68,0.9)]' : 'w-2.5 h-2.5 bg-emerald-400')}`} />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/node:flex flex-col items-center bg-[#131313] border border-white/20 px-2 py-1 rounded text-[10px] font-data-label text-white whitespace-nowrap shadow-xl z-30">
                            <span className={isPB ? 'text-amber-300 font-bold' : (isFatigue ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold')}>
                              {p.session.date}: {p.session.peakJumpCm}cm {isPB ? '(PB!)' : (isFatigue ? '(Fatigue)' : '')}
                            </span>
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
        </div>

        {/* Consistency Metric Card */}
        <div className="card-base p-5 md:p-6 col-span-1 md:col-span-4 flex flex-col justify-center bg-white/5 border border-white/10 backdrop-blur-md">
          <h3 className="font-data-label text-xs text-white/50 uppercase tracking-[0.2em] mb-2 font-bold">
            Consistency
          </h3>
          <div className="font-headline-md text-lg text-white mb-1">Weekly Average</div>
          <div className="font-display-metrics text-4xl text-white flex items-baseline gap-1">
            {weeklyAverage > 0 ? formatMetricHeight(weeklyAverage, athleteProfile.units) : '--'}
          </div>
          {weeklyChange !== 0 && (
            <div className={`font-data-label text-xs ${weeklyChange > 0 ? 'text-emerald-400' : 'text-red-400'} mt-3 flex items-center gap-1 font-bold`}>
              <span className="material-symbols-outlined text-sm">{weeklyChange > 0 ? 'arrow_upward' : 'arrow_downward'}</span>
              ({weeklyChange > 0 ? '+' : ''}{weeklyChange.toFixed(1)}% vs last week)
            </div>
          )}
        </div>

        {/* History Feed */}
        <div className="col-span-1 md:col-span-12 mt-2">
          <h3 className="font-headline-md text-lg text-white mb-4 border-b border-white/10 pb-2 flex justify-between items-center">
            <span className="uppercase tracking-wider font-bold">Session History</span>
            <span className="font-data-label text-xs text-white/50">
              {filteredSessions.length} logged
            </span>
          </h3>

          <div className="space-y-3">
            {filteredSessions.map((session, index) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.04 }}
                whileHover={{ scale: 1.01, transition: { duration: 0.15 } }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSelectSession(session)}
                className="data-card p-4 flex items-center justify-between hover:border-[#c9a050] hover:bg-white/10 transition-colors cursor-pointer group rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-white/10 w-12 h-12 rounded-full flex items-center justify-center text-[#c9a050] group-hover:bg-[#c9a050] group-hover:text-black transition-colors">
                    <span className="material-symbols-outlined">{getSportIcon(session.sport)}</span>
                  </div>
                  <div>
                    <div className="font-data-label text-xs text-white/50 mb-1">
                      {session.date} • {session.sport}
                    </div>
                    <div className="font-body-lg text-white font-semibold group-hover:text-[#c9a050] transition-colors">
                      {session.title}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <div className="font-data-label text-xs text-white/50">Total Reps</div>
                    <div className="font-data-value text-sm text-white">{session.totalReps}</div>
                  </div>

                  <div className="text-right">
                    <div className="font-data-label text-xs text-white/50">Max Jump</div>
                    <div className="font-data-value text-sm text-[#c9a050] font-bold">
                      {formatMetricHeight(session.peakJumpCm, athleteProfile.units)}
                    </div>
                  </div>

                  <span className="material-symbols-outlined text-white/50 group-hover:text-[#c9a050] group-hover:translate-x-1 transition-all">
                    chevron_right
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Manual Session Modal */}
      <AnimatePresence>
        {showLogModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 relative shadow-2xl"
            >
              <button
                onClick={() => setShowLogModal(false)}
                className="absolute top-4 right-4 text-white/60 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>

              <h3 className="font-headline-md text-xl text-[#c9a050] font-bold uppercase tracking-wider">
                Log Custom Session
              </h3>

              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label className="font-data-label text-xs text-white/60 block mb-1 uppercase tracking-wider">
                    Session Title
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2 font-data-value text-sm text-white focus:outline-none focus:border-[#c9a050]"
                    required
                  />
                </div>

                <div>
                  <label className="font-data-label text-xs text-white/60 block mb-1 uppercase tracking-wider">Sport</label>
                  <select
                    value={newSport}
                    onChange={(e) => setNewSport(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2 font-data-value text-sm text-white focus:outline-none focus:border-[#c9a050]"
                  >
                    <option value="Volleyball" className="bg-[#0a0a0a]">Volleyball</option>
                    <option value="Sprints" className="bg-[#0a0a0a]">Sprints</option>
                    <option value="Cricket" className="bg-[#0a0a0a]">Cricket</option>
                    <option value="Basketball" className="bg-[#0a0a0a]">Basketball</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-data-label text-xs text-white/60 block mb-1 uppercase tracking-wider">
                      Peak Jump (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newPeakJump}
                      onChange={(e) => setNewPeakJump(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2 font-data-value text-sm text-white focus:outline-none focus:border-[#c9a050]"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-data-label text-xs text-white/60 block mb-1 uppercase tracking-wider">
                      Total Reps
                    </label>
                    <input
                      type="number"
                      value={newReps}
                      onChange={(e) => setNewReps(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2 font-data-value text-sm text-white focus:outline-none focus:border-[#c9a050]"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#c9a050] hover:bg-[#d9b060] text-black font-data-value py-3 rounded-full font-bold transition-all active:scale-95 uppercase tracking-[0.2em] cursor-pointer"
                >
                  Save Telemetry Record
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
