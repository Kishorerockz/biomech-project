import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { TabType, SensorState, AthleteProfile, SessionData } from './types';
import {
  INITIAL_ATHLETE_PROFILE,
  INITIAL_SENSOR_STATE,
  HISTORICAL_SESSIONS,
} from './data';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { LiveTab } from './components/LiveTab';
import { AnalysisTab } from './components/AnalysisTab';
import { HistoryTab } from './components/HistoryTab';
import { CalibrationTab } from './components/CalibrationTab';
import { ProfileModal } from './components/ProfileModal';
import { AuthScreen } from './components/AuthScreen';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Dummy fetch function for API backwards compatibility, ideally move to /utils/api
async function fetchSessionHistory(activeAthleteId: string) {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const res = await fetch(`${backendUrl}/api/sessions/history/${activeAthleteId}`);
    if (!res.ok) return null;
    const payload = await res.json();
    let rawSessions = payload;
    let stats = null;
    
    // Handle the new payload object containing stats
    if (payload.sessions && Array.isArray(payload.sessions)) {
      rawSessions = payload.sessions;
      stats = payload.stats;
    }

    const mappedSessions = rawSessions.map((s: any) => ({
      id: s.sessionId,
      title: `${s.sessionType} Session`,
      sport: s.sessionType,
      date: new Date(s.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      isoDate: new Date(s.startTime).toISOString().split('T')[0],
      peakJumpCm: s.peakJumpCm || 0,
      avgJumpCm: s.avgJumpCm || 0,
      totalReps: s.totalReps || 0,
      durationSec: s.endTime 
        ? Math.floor((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000)
        : 0,
      intensityPercent: 0,
      jumpConsistencyCm: s.jumpConsistencyCm,
      attempts: (s.attempts || []).map((a: any, i: number) => ({
        id: i + 1,
        timestampStr: new Date(a.timestamp).toISOString().substr(14, 5),
        jumpCm: a.heightCm,
        isPeak: a.heightCm === s.peakJumpCm,
      })),
      timeline: (s.attempts || []).map((a: any) => ({
        timeSec: Math.floor((new Date(a.timestamp).getTime() - new Date(s.startTime).getTime()) / 1000),
        jumpCm: a.heightCm
      }))
    }));

    return { sessions: mappedSessions, stats };
  } catch(e) {
    return null;
  }
}

export default function App() {
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const saved = localStorage.getItem('telemetry_auth');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('telemetry_theme');
    return (saved as 'dark' | 'light') || 'dark';
  });
  const [currentTab, setCurrentTab] = useState<TabType>('live');
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('telemetry_theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [sensorState, setSensorState] = useState<SensorState>(() => {
    const saved = localStorage.getItem('telemetry_sensor_state');
    return saved ? JSON.parse(saved) : INITIAL_SENSOR_STATE;
  });

  const [athleteProfile, setAthleteProfile] = useState<AthleteProfile>(() => {
    const saved = localStorage.getItem('telemetry_athlete_profile');
    return saved ? JSON.parse(saved) : INITIAL_ATHLETE_PROFILE;
  });

  const [activeAthleteId, setActiveAthleteId] = useState<string>('sim_athlete');

  // React Query implementation for Offline Persistence
  const { data: historyPayload = { sessions: HISTORICAL_SESSIONS, stats: null } } = useQuery({
    queryKey: ['sessions', activeAthleteId],
    queryFn: async () => {
      let data = await fetchSessionHistory(activeAthleteId);
      if (!data || !data.sessions || data.sessions.length === 0) return { sessions: HISTORICAL_SESSIONS, stats: null };
      return data;
    },
    staleTime: 1000 * 60 * 5, 
  });

  const isLegacyCache = Array.isArray(historyPayload);
  const validPayload = isLegacyCache ? { sessions: historyPayload, stats: null } : historyPayload;

  const sessions = validPayload?.sessions || HISTORICAL_SESSIONS || [];
  const backendStats = validPayload?.stats || null;
  
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => sessions?.[0]?.id);
  const currentSession = (Array.isArray(sessions) && sessions.find((s: SessionData) => s.id === currentSessionId)) || sessions?.[0];

  useEffect(() => {
    localStorage.setItem('telemetry_auth', JSON.stringify(isAuthenticated));
  }, [isAuthenticated]);

  useEffect(() => {
    localStorage.setItem('telemetry_sensor_state', JSON.stringify(sensorState));
  }, [sensorState]);

  useEffect(() => {
    localStorage.setItem('telemetry_athlete_profile', JSON.stringify(athleteProfile));
  }, [athleteProfile]);

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const socket = io(backendUrl);

    socket.on('connect', () => {
      setSensorState((prev) => ({ ...prev, connected: true, reconnecting: false }));
    });

    socket.on('disconnect', () => {
      setSensorState((prev) => ({ ...prev, connected: false, reconnecting: true }));
    });

    socket.io.on('reconnect_attempt', () => {
      setSensorState((prev) => ({ ...prev, connected: false, reconnecting: true }));
    });

    socket.io.on('reconnect_failed', () => {
      setSensorState((prev) => ({ ...prev, connected: false, reconnecting: false }));
    });

    socket.on('dashboard_update', (data: any) => {
      setSensorState((prev) => ({
        ...prev,
        procAccelG: data.processedAccel !== undefined ? data.processedAccel : prev.procAccelG,
        batteryPercent: data.battery !== null ? data.battery : prev.batteryPercent,
        connected: true,
      }));
    });

    socket.on('stream_stats', (data: any) => {
      setSensorState((prev) => ({ ...prev, samplingRateHz: data.hz }));
    });

    socket.on('jump_detected', (data: any) => {
      const { heightCm, hangTimeMs, landingImpactG, takeoffAccelG, twistDeg } = data;
      setSensorState((prev) => {
        const newMax = Math.max(prev.maxJumpCm, heightCm);
        const isNewPeak = heightCm > prev.maxJumpCm;
        return {
          ...prev,
          lastJumpCm: heightCm,
          maxJumpCm: newMax,
          totalJumps: prev.totalJumps + 1,
          isNewPeak,
          hangTimeMs,
          landingImpactG,
          takeoffAccelG,
          twistDeg
        };
      });
      handleRecordJump(heightCm);
    });

    socket.on('swing_detected', (data: any) => {
      const { peakAngularVelocity, swingDurationMs } = data;
      setSensorState((prev) => ({
        ...prev,
        lastSwingVelocity: peakAngularVelocity,
        lastSwingDurationMs: swingDurationMs,
        swingCount: (prev.swingCount || 0) + 1,
        isNewPeak: peakAngularVelocity > (prev.maxJumpCm || 0), // fallback using maxJumpCm logic for sparks
        maxJumpCm: Math.max(prev.maxJumpCm, peakAngularVelocity), // temporarily reuse this so Hero Card peaks well
      }));
      handleRecordJump(peakAngularVelocity); // Re-use the timeline generation
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Live session timer updating React Query cache
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentTab === 'live' && currentSession) {
      interval = setInterval(() => {
        queryClient.setQueryData(['sessions', activeAthleteId], (old: any) => {
          if (!old) return old;
          const oldArray = Array.isArray(old) ? old : (old.sessions || []);
          const updatedArray = oldArray.map((s: SessionData) => s.id === currentSession?.id ? { ...s, durationSec: (s.durationSec || 0) + 1 } : s);
          return Array.isArray(old) ? updatedArray : { ...old, sessions: updatedArray };
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentTab, currentSession, queryClient, activeAthleteId]);

  const handleRecordJump = (jumpCm: number) => {
    const now = new Date();
    const timeStr = `${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const isFatigue = jumpCm < 36.0;

    queryClient.setQueryData(['sessions', activeAthleteId], (old: any) => {
      if (!old) return old;
      
      const oldArray = Array.isArray(old) ? old : (old.sessions || []);
      const newOldSessions = oldArray.map((prev: SessionData) => {
        if (prev.id !== currentSession?.id) return prev;
        const isPeak = jumpCm >= (prev.peakJumpCm || 0);
        const newAttemptId = prev.attempts.length + 1;
        const updatedAttempts = [
          ...prev.attempts,
          { id: newAttemptId, timestampStr: timeStr, jumpCm, isPeak, isFatigue },
        ];
        const newPeak = Math.max(prev.peakJumpCm || 0, jumpCm);
        const newTotal = updatedAttempts.length;
        const newAvg = parseFloat((updatedAttempts.reduce((acc, a) => acc + a.jumpCm, 0) / newTotal).toFixed(1));
        const newTimeline = [...(prev.timeline || []), { timeSec: prev.durationSec || 0, jumpCm }];

        return {
          ...prev,
          peakJumpCm: newPeak,
          avgJumpCm: newAvg,
          totalReps: newTotal,
          attempts: updatedAttempts,
          timeline: newTimeline,
        };
      });

      return Array.isArray(old) ? newOldSessions : {
        ...old,
        sessions: newOldSessions
      };
    });
  };

  const handleTriggerSessionStart = async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const res = await fetch(`${backendUrl}/api/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteId: activeAthleteId, sessionType: athleteProfile.primarySport })
      });
      
      let sessionId = `session-live-${Date.now()}`;
      if (res.ok) {
        const data = await res.json();
        sessionId = data.sessionId;
      }

      const newSession: SessionData = {
        id: sessionId,
        title: `${athleteProfile.primarySport} Live Stream`,
        sport: athleteProfile.primarySport,
        date: 'Today',
        isoDate: new Date().toISOString().split('T')[0],
        peakJumpCm: 0,
        avgJumpCm: 0,
        totalReps: 0,
        durationSec: 0,
        intensityPercent: 0,
        attempts: [],
        timeline: [],
      };

      queryClient.setQueryData(['sessions', activeAthleteId], (old: any) => {
        const oldArray = Array.isArray(old) ? old : (old?.sessions || []);
        const newArray = [newSession, ...oldArray];
        return Array.isArray(old) ? newArray : { ...old, sessions: newArray };
      });
      setCurrentSessionId(sessionId);
    } catch (err) {
      console.error("Failed to start session:", err);
    }
  };

  const handleSelectSession = (session: SessionData) => {
    setCurrentSessionId(session.id);
    setCurrentTab('analysis');
  };

  const handleAddLogSession = (newSession: SessionData) => {
    queryClient.setQueryData(['sessions', activeAthleteId], (old: any) => {
      const oldArray = Array.isArray(old) ? old : (old?.sessions || []);
      const newArray = [newSession, ...oldArray];
      return Array.isArray(old) ? newArray : { ...old, sessions: newArray };
    });
    setCurrentSessionId(newSession.id);
    setCurrentTab('analysis');
  };

  const handleClearCache = () => {
    localStorage.removeItem('telemetry_sensor_state');
    localStorage.removeItem('telemetry_athlete_profile');
    queryClient.clear();
    setSensorState(INITIAL_SENSOR_STATE);
    setAthleteProfile(INITIAL_ATHLETE_PROFILE);
  };

  const allTimePbCm = backendStats ? backendStats.personalBest : (Array.isArray(sessions) ? sessions.reduce((max: number, s: SessionData) => Math.max(max, s.peakJumpCm || 0), 0) : 0);

  if (!isAuthenticated) {
    return (
      <AuthScreen
        onLogin={(email) => {
          if (email) {
            setAthleteProfile((prev) => ({ ...prev, email }));
          }
          setIsAuthenticated(true);
          const extractedId = email.split('@')[0];
          if (extractedId !== 'pro.athlete' && extractedId.length > 2) {
            setActiveAthleteId(extractedId);
          } else {
            setActiveAthleteId('sim_athlete');
          }
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-[#f8fafc] text-[#0f172a]' : 'bg-[#121212] text-[#e5e2e1]'} font-body-sm relative selection:bg-[#00fbfb] selection:text-black transition-colors duration-300`}>
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        sensorState={sensorState}
        onOpenProfile={() => setShowProfileModal(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="w-full">
        <AnimatePresence mode="wait">
          {currentTab === 'live' && (
            <motion.div
              key="live"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <LiveTab
                sensorState={sensorState}
                setSensorState={setSensorState}
                athleteProfile={athleteProfile}
                currentSession={currentSession}
                onTriggerSessionStart={handleTriggerSessionStart}
                onRecordJump={handleRecordJump}
              />
            </motion.div>
          )}

          {currentTab === 'analysis' && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <AnalysisTab
                currentSession={currentSession}
                athleteProfile={athleteProfile}
                onReturnHome={() => setCurrentTab('live')}
              />
            </motion.div>
          )}

          {currentTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <HistoryTab
                sessions={sessions}
                athleteProfile={athleteProfile}
                allTimePbCm={allTimePbCm} // Legacy support, we can pull target details from stats directly next!
                backendStats={backendStats}
                onSelectSession={handleSelectSession}
                onAddLogSession={handleAddLogSession}
              />
            </motion.div>
          )}

          {currentTab === 'calibration' && (
            <motion.div
              key="calibration"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <CalibrationTab
                sensorState={sensorState}
                setSensorState={setSensorState}
                athleteProfile={athleteProfile}
                setAthleteProfile={setAthleteProfile}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <AnimatePresence>
        {showProfileModal && (
          <ProfileModal
            athleteProfile={athleteProfile}
            setAthleteProfile={setAthleteProfile}
            sessions={sessions}
            onClose={() => setShowProfileModal(false)}
            onClearCache={handleClearCache}
            onLogout={() => setIsAuthenticated(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
