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

  // Fetch persisted jump telemetry records from SQLite backend
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const { data: jumpRecords = [], isLoading: isLoadingJumps } = useQuery({
    queryKey: ['jump-telemetry'],
    queryFn: async () => {
      try {
        const res = await fetch(`${apiBase}/api/jumps`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const remote = await res.json();
          if (Array.isArray(remote) && remote.length > 0) return remote;
        }
      } catch {}
      // Fallback: extract attempts from local sessions
      const localJumps: any[] = [];
      sessions.forEach((s) => {
        (s.attempts || []).forEach((att, idx) => {
          const hangTimeMs = Math.round(Math.sqrt(Math.max(1, att.jumpCm) / 122.6) * 1000);
          localJumps.push({
            id: att.id || idx + 1,
            timestamp: s.isoDate || new Date().toISOString(),
            hang_time: hangTimeMs,
            landing_impact: 2.8,
            takeoff_expl: 2.2,
            ground_contact_ms: 220,
            rsi: 1.5,
          });
        });
      });
      return localJumps;
    },
    staleTime: 1000 * 5,
    refetchOnWindowFocus: true,
  });

  // Overlay Toggles for Target Zones & Personal Best
  const [showPBLine, setShowPBLine] = useState(true);
  const [showTargetZone, setShowTargetZone] = useState(true);
  const [showGoalLine, setShowGoalLine] = useState(true);

  // New Log Form State
  const [newTitle, setNewTitle] = useState('Volleyball Vertical Training');
  const [newSport, setNewSport] = useState('Volleyball');
  const [newPeakJump, setNewPeakJump] = useState(48.5);
  const [newReps, setNewReps] = useState(25);

  const sportsList = ['All', 'Volleyball', 'Basketball', 'Track & Field', 'Plyometrics'];

  const filteredSessions = sessions.filter((s) => {
    if (selectedSport !== 'All' && s.sport.toLowerCase() !== selectedSport.toLowerCase()) {
      return false;
    }
    return true;
  });

  // Fetch robust trends dynamically over API
  const activeAthleteId =
    athleteProfile.email &&
    athleteProfile.email.split('@')[0] !== 'pro.athlete' &&
    athleteProfile.email.split('@')[0].length > 2
      ? athleteProfile.email.split('@')[0]
      : 'sim_athlete';

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

  const seasonGoal = latestTrend ? latestTrend.targetZoneMax : activePb > 0 ? activePb * 1.05 : 58.0;
  const targetZoneMin = latestTrend ? latestTrend.targetZoneMin : activePb > 0 ? activePb * 0.85 : 42.0;
  const targetZoneMax = latestTrend ? latestTrend.targetZoneMax : activePb > 0 ? activePb * 1.0 : 52.0;
  const fatigueThreshold = latestTrend ? latestTrend.targetZoneMin * 0.8 : 38.0;

  // Calculate weekly average
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisWeekSessions = filteredSessions.filter((s) => new Date(s.isoDate || s.date) >= oneWeekAgo);
  const getAvg = (list: SessionData[]) => {
    if (list.length === 0) return 0;
    return list.reduce((acc, s) => acc + (s.peakJumpCm || 0), 0) / list.length;
  };
  const weeklyAverage = getAvg(thisWeekSessions);

  // Directly ingest verified WOW backend stats
  const weeklyChange =
    trendPayload && trendPayload.weekOverWeekChangePercent !== null
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
      case 'basketball':
        return 'sports_basketball';
      case 'track & field':
      case 'sprints':
      case 'track':
        return 'sprint';
      case 'plyometrics':
        return 'bolt';
      default:
        return 'fitness_center';
    }
  };

  return (
    <div className="pt-20 md:pt-24 px-4 sm:px-6 md:px-10 max-w-7xl mx-auto space-y-6 pb-28">
      {/* Header & Filter Row */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400 text-2xl">leaderboard</span>
            <span>Performance &amp; Progression</span>
          </h1>
          <p className="text-xs font-mono text-white/50 mt-1">
            Historical jump telemetry curves, personal best tracking, and session archives
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLogModal(true)}
            className="bg-[#00f5d4]/10 hover:bg-[#00f5d4]/20 border border-[#00f5d4]/30 text-[#00f5d4] px-4 py-2 rounded-xl font-mono text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-[0_0_15px_rgba(0,245,212,0.15)] font-bold uppercase tracking-wider cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            Log Session
          </button>

          <div className="relative inline-block w-40">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="block w-full appearance-none bg-[#121620] border border-white/[0.1] text-white/90 py-2 px-3.5 pr-8 rounded-xl leading-tight focus:outline-none focus:border-[#00f5d4] font-mono text-xs cursor-pointer hover:bg-white/[0.05] transition-colors"
            >
              <option className="bg-[#0b0d11]">Last 30 Days</option>
              <option className="bg-[#0b0d11]">Last 3 Months</option>
              <option className="bg-[#0b0d11]">Year to Date</option>
              <option className="bg-[#0b0d11]">All Time</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/40">
              <span className="material-symbols-outlined text-base">expand_more</span>
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
              className={`flex-shrink-0 font-mono text-xs px-3.5 py-1.5 rounded-xl active:scale-95 transition-all cursor-pointer uppercase tracking-wider font-semibold ${
                isActive
                  ? 'bg-amber-400 text-black font-bold shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                  : 'border border-white/[0.08] text-white/70 hover:bg-white/[0.05] bg-white/[0.02]'
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
        <div className="rounded-3xl bg-[#121620]/80 border border-white/[0.08] p-5 md:p-6 col-span-1 md:col-span-8 flex flex-col justify-between min-h-[360px] backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
            <div>
              <h2 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                Peak Elevation Progress vs Targets
              </h2>
              <div className="font-mono text-3xl md:text-4xl text-amber-300 font-bold mt-1 flex items-baseline gap-2">
                {formatMetricHeight(maxPeak, athleteProfile.units)}
                {maxPeak > 0 && maxPeak >= allTimePbCm && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    New PB!
                  </span>
                )}
              </div>
            </div>

            {/* Interactive Target Layer Toggles */}
            <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
              <button
                onClick={() => setShowGoalLine(!showGoalLine)}
                className={`px-2.5 py-1 rounded-full border transition-all cursor-pointer font-bold flex items-center gap-1 ${
                  showGoalLine
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-white/[0.02] text-white/40 border-white/[0.08]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Goal: {seasonGoal.toFixed(1)}cm
              </button>
              <button
                onClick={() => setShowPBLine(!showPBLine)}
                className={`px-2.5 py-1 rounded-full border transition-all cursor-pointer font-bold flex items-center gap-1 ${
                  showPBLine
                    ? 'bg-[#00f5d4]/20 text-[#00f5d4] border-[#00f5d4]/40'
                    : 'bg-white/[0.02] text-white/40 border-white/[0.08]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#00f5d4]" />
                PB: {allTimePbCm.toFixed(1)}cm
              </button>
              <button
                onClick={() => setShowTargetZone(!showTargetZone)}
                className={`px-2.5 py-1 rounded-full border transition-all cursor-pointer font-bold flex items-center gap-1 ${
                  showTargetZone
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-white/[0.02] text-white/40 border-white/[0.08]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Target Band
              </button>
            </div>
          </div>

          {/* SVG Progress Chart with Target Lines */}
          <div className="relative h-52 w-full mt-auto rounded-2xl overflow-hidden border-b border-l border-white/[0.08] pt-2">
            {/* Target Training Zone Band */}
            {showTargetZone && (() => {
              const maxGraphVal = seasonGoal * 1.1;
              const yMin = 100 - (targetZoneMax / maxGraphVal) * 100;
              const yMax = 100 - (targetZoneMin / maxGraphVal) * 100;
              const yFatigue = 100 - (fatigueThreshold / maxGraphVal) * 100;
              return (
                <>
                  <div
                    className="absolute w-full bg-emerald-500/[0.08] border-y border-emerald-500/20 pointer-events-none z-0 flex items-center justify-end pr-2"
                    style={{ top: `${yMin}%`, height: `${yMax - yMin}%` }}
                  >
                    <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400/80 font-bold bg-[#0b0d11]/80 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Target ({targetZoneMin.toFixed(0)}–{targetZoneMax.toFixed(0)}cm)
                    </span>
                  </div>

                  {/* Fatigue Zone Band */}
                  <div
                    className="absolute w-full bg-rose-500/[0.06] border-t border-dashed border-rose-500/30 pointer-events-none z-0 flex items-center justify-end pr-2"
                    style={{ top: `${yFatigue}%`, height: `${100 - yFatigue}%` }}
                  >
                    <span className="text-[9px] font-mono uppercase tracking-widest text-rose-400/80 font-bold bg-[#0b0d11]/80 px-2 py-0.5 rounded-md border border-rose-500/30">
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
                  <span className="absolute right-2 -top-2.5 text-[9px] text-amber-300 font-mono uppercase font-bold bg-[#0b0d11] px-2 py-0.5 rounded-md border border-amber-500/40 shadow-sm flex items-center gap-1">
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
                  className="absolute w-full border-b border-dashed border-[#00f5d4]/80 opacity-90 flex items-center z-10"
                  style={{ top: `${pbY}%` }}
                >
                  <span className="absolute left-2 -top-2.5 text-[9px] text-[#00f5d4] font-mono uppercase font-bold bg-[#0b0d11] px-2 py-0.5 rounded-md border border-[#00f5d4]/40 shadow-sm flex items-center gap-1">
                    <span className="material-symbols-outlined text-[10px] text-[#00f5d4]">emoji_events</span>
                    PB: {allTimePbCm.toFixed(1)}cm
                  </span>
                </div>
              );
            })()}

            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pb-2 pointer-events-none">
              <div className="border-t border-dashed border-white/[0.06] w-full" />
              <div className="border-t border-dashed border-white/[0.06] w-full" />
              <div className="border-t border-dashed border-white/[0.06] w-full" />
            </div>

            {(() => {
              const graphSessions = [...filteredSessions].reverse().slice(-10);
              if (graphSessions.length === 0) {
                return (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white/30 text-xs font-mono uppercase tracking-widest">
                      No sessions recorded yet
                    </span>
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
                  <svg
                    className="absolute bottom-0 w-full h-full z-0 pointer-events-none"
                    preserveAspectRatio="none"
                    viewBox="0 0 100 100"
                  >
                    <defs>
                      <linearGradient id="goldArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {points.length > 1 && <path d={dFill} fill="url(#goldArea)" />}
                    <path d={dLine} fill="none" stroke="#fbbf24" strokeWidth="2.5" />
                  </svg>

                  {/* Interactive Data Nodes on Trend Curve */}
                  <div className="absolute inset-0 z-20 pointer-events-none">
                    {points.map((p) => {
                      const isPB = p.session.peakJumpCm && p.session.peakJumpCm >= activePb;
                      const trendMatch = trendPayload?.trends?.find((t: any) => t.sessionId === p.session.id);
                      const isFatigue = trendMatch?.isFatigueFlag;

                      return (
                        <div
                          key={p.session.id}
                          className="absolute group/node pointer-events-auto cursor-pointer flex justify-center items-center"
                          style={{
                            left: `${p.x}%`,
                            top: `${p.y}%`,
                            width: '18px',
                            height: '18px',
                            transform: 'translate(-50%, -50%)',
                          }}
                          onClick={() => onSelectSession(p.session)}
                        >
                          <div
                            className={`rounded-full border-2 border-[#0b0d11] transition-transform group-hover/node:scale-125 ${
                              isPB
                                ? 'w-3.5 h-3.5 bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-pulse'
                                : isFatigue
                                ? 'w-3 h-3 bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]'
                                : 'w-2.5 h-2.5 bg-[#00f5d4] shadow-[0_0_8px_rgba(0,245,212,0.7)]'
                            }`}
                          />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/node:flex flex-col items-center bg-[#0b0d11] border border-white/20 px-2.5 py-1 rounded-xl text-[10px] font-mono text-white whitespace-nowrap shadow-2xl z-30">
                            <span
                              className={
                                isPB
                                  ? 'text-amber-300 font-bold'
                                  : isFatigue
                                  ? 'text-rose-400 font-bold'
                                  : 'text-[#00f5d4] font-bold'
                              }
                            >
                              {p.session.date}: {p.session.peakJumpCm}cm{' '}
                              {isPB ? '(PB!)' : isFatigue ? '(Fatigued)' : ''}
                            </span>
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
        <div className="rounded-3xl bg-[#121620]/80 border border-white/[0.08] p-5 md:p-6 col-span-1 md:col-span-4 flex flex-col justify-between backdrop-blur-xl space-y-4">
          <div className="border-b border-white/[0.08] pb-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#00f5d4] font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              Weekly Consistency
            </h3>
            <p className="text-[11px] font-mono text-white/40 mt-0.5">
              Average peak vertical over 7 rolling days
            </p>
          </div>

          <div className="py-2">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest block mb-1">
              7-Day Rolling Avg
            </span>
            <div className="font-mono text-4xl font-bold text-white flex items-baseline gap-1">
              {weeklyAverage > 0 ? formatMetricHeight(weeklyAverage, athleteProfile.units) : '--'}
            </div>
            {weeklyChange !== 0 && (
              <div
                className={`font-mono text-xs ${
                  weeklyChange > 0 ? 'text-emerald-400' : 'text-rose-400'
                } mt-3 flex items-center gap-1 font-bold`}
              >
                <span className="material-symbols-outlined text-sm">
                  {weeklyChange > 0 ? 'arrow_upward' : 'arrow_downward'}
                </span>
                <span>
                  {weeklyChange > 0 ? '+' : ''}
                  {weeklyChange.toFixed(1)}% vs prior week
                </span>
              </div>
            )}
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3.5 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-white/50">
              <span>Logged Sessions</span>
              <span className="text-white font-bold">{filteredSessions.length}</span>
            </div>
            <div className="flex justify-between text-white/50">
              <span>Target Discipline</span>
              <span className="text-amber-300 font-bold">{selectedSport}</span>
            </div>
          </div>
        </div>

        {/* History Feed */}
        <div className="col-span-1 md:col-span-12 mt-2">
          <div className="flex justify-between items-center border-b border-white/[0.08] pb-3 mb-4">
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400 text-lg">history</span>
              <span>Session History</span>
            </h3>
            <span className="font-mono text-xs text-white/40">
              {filteredSessions.length} recorded
            </span>
          </div>

          <div className="space-y-3">
            {filteredSessions.map((session, index) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                whileHover={{ scale: 1.005 }}
                whileTap={{ scale: 0.995 }}
                onClick={() => onSelectSession(session)}
                className="p-4 rounded-2xl border border-white/[0.08] bg-[#121620]/60 hover:bg-[#121620] hover:border-[#00f5d4]/40 transition-all cursor-pointer flex items-center justify-between group backdrop-blur-md"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-amber-400 group-hover:bg-amber-400 group-hover:text-black transition-colors">
                    <span className="material-symbols-outlined text-xl">
                      {getSportIcon(session.sport)}
                    </span>
                  </div>
                  <div>
                    <div className="font-mono text-[11px] text-white/40 mb-0.5">
                      {session.date} • {session.sport}
                    </div>
                    <div className="text-sm font-semibold text-white group-hover:text-[#00f5d4] transition-colors">
                      {session.title}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-5 sm:gap-6">
                  <div className="text-right hidden sm:block">
                    <div className="font-mono text-[10px] text-white/40 uppercase">Total Reps</div>
                    <div className="font-mono text-xs text-white font-bold">{session.totalReps}</div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-[10px] text-white/40 uppercase">Max Jump</div>
                    <div className="font-mono text-xs text-amber-300 font-bold">
                      {formatMetricHeight(session.peakJumpCm, athleteProfile.units)}
                    </div>
                  </div>

                  <span className="material-symbols-outlined text-white/30 group-hover:text-[#00f5d4] group-hover:translate-x-1 transition-all text-lg">
                    chevron_right
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Jump Telemetry Database Log */}
        <div className="col-span-1 md:col-span-12 mt-4">
          <div className="flex justify-between items-center border-b border-white/[0.08] pb-3 mb-4">
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00f5d4] text-lg">database</span>
              <span>Jump Telemetry Log</span>
            </h3>
            <span className="font-mono text-xs text-white/40">
              {jumpRecords.length} entries
            </span>
          </div>

          {isLoadingJumps ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#00f5d4]/30 border-t-[#00f5d4] rounded-full animate-spin" />
              <span className="ml-3 font-mono text-xs text-white/40 uppercase tracking-widest">
                Loading telemetry data…
              </span>
            </div>
          ) : jumpRecords.length === 0 ? (
            <div className="rounded-3xl bg-[#121620]/60 border border-white/[0.08] p-8 flex flex-col items-center justify-center text-center backdrop-blur-md">
              <span className="material-symbols-outlined text-3xl text-white/20 mb-2">hourglass_empty</span>
              <p className="font-mono text-xs text-white/50 uppercase tracking-widest">
                No jumps recorded yet
              </p>
              <p className="text-xs text-white/30 mt-1 font-mono">
                Perform a jump on the Live tab to stream data here.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl bg-[#121620]/80 border border-white/[0.08] backdrop-blur-xl overflow-hidden">
              <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10 bg-[#0b0d11]/95 backdrop-blur-md border-b border-white/[0.08]">
                    <tr>
                      <th className="font-mono text-[10px] text-white/50 uppercase tracking-wider px-4 py-3">#</th>
                      <th className="font-mono text-[10px] text-white/50 uppercase tracking-wider px-4 py-3">Timestamp</th>
                      <th className="font-mono text-[10px] text-white/50 uppercase tracking-wider px-4 py-3 text-right">Hang Time</th>
                      <th className="font-mono text-[10px] text-white/50 uppercase tracking-wider px-4 py-3 text-right">Landing Impact</th>
                      <th className="font-mono text-[10px] text-white/50 uppercase tracking-wider px-4 py-3 text-right">Takeoff Expl.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {jumpRecords.map((jump: any, index: number) => {
                      const ts = new Date(jump.timestamp + (jump.timestamp.endsWith('Z') ? '' : 'Z'));
                      const formattedTime = ts.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                      });
                      const isHighImpact = jump.landing_impact >= 4.0;
                      return (
                        <motion.tr
                          key={jump.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.15, delay: index * 0.015 }}
                          className="hover:bg-white/[0.03] transition-colors font-mono"
                        >
                          <td className="px-4 py-3 text-xs text-white/40">{jump.id}</td>
                          <td className="px-4 py-3 text-xs text-white/70">{formattedTime}</td>
                          <td className="px-4 py-3 text-xs text-white text-right font-bold">
                            {jump.hang_time}
                            <span className="text-white/40 text-[10px] ml-0.5 font-normal">ms</span>
                          </td>
                          <td
                            className={`px-4 py-3 text-xs text-right font-bold ${
                              isHighImpact ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {Number(jump.landing_impact).toFixed(1)}
                            <span className="text-white/40 text-[10px] ml-0.5 font-normal">g</span>
                            {isHighImpact && (
                              <span
                                className="material-symbols-outlined text-xs text-rose-400 ml-1 align-middle"
                                title="High impact landing"
                              >
                                warning
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-amber-300 text-right font-bold">
                            {Number(jump.takeoff_expl).toFixed(1)}
                            <span className="text-white/40 text-[10px] ml-0.5 font-normal">g</span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
              className="bg-[#0b0d11] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-md space-y-5 relative shadow-2xl"
            >
              <button
                onClick={() => setShowLogModal(false)}
                className="absolute top-5 right-5 text-white/50 hover:text-white cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>

              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#00f5d4]">add_circle</span>
                  Log Custom Session
                </h3>
                <p className="text-xs font-mono text-white/50 mt-1">
                  Add offline or external jump session metrics
                </p>
              </div>

              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label className="font-mono text-xs text-white/60 block mb-1 uppercase tracking-wider">
                    Session Title
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-[#00f5d4] transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="font-mono text-xs text-white/60 block mb-1 uppercase tracking-wider">
                    Discipline / Sport
                  </label>
                  <select
                    value={newSport}
                    onChange={(e) => setNewSport(e.target.value)}
                    className="w-full bg-[#121620] border border-white/10 rounded-xl px-4 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-[#00f5d4] transition-colors cursor-pointer"
                  >
                    <option value="Volleyball" className="bg-[#0b0d11]">Volleyball</option>
                    <option value="Basketball" className="bg-[#0b0d11]">Basketball</option>
                    <option value="Track & Field" className="bg-[#0b0d11]">Track & Field</option>
                    <option value="Plyometrics" className="bg-[#0b0d11]">Plyometrics</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-xs text-white/60 block mb-1 uppercase tracking-wider">
                      Peak Jump (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newPeakJump}
                      onChange={(e) => setNewPeakJump(Number(e.target.value))}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-[#00f5d4] transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-mono text-xs text-white/60 block mb-1 uppercase tracking-wider">
                      Total Reps
                    </label>
                    <input
                      type="number"
                      value={newReps}
                      onChange={(e) => setNewReps(Number(e.target.value))}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-[#00f5d4] transition-colors"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#00f5d4] hover:bg-[#00f5d4]/90 text-black font-mono py-3 rounded-xl font-bold transition-all active:scale-95 uppercase tracking-wider text-xs shadow-[0_0_20px_rgba(0,245,212,0.25)] cursor-pointer mt-2"
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
