import { useState, useEffect } from 'react';
<<<<<<< HEAD
=======
import { io } from 'socket.io-client';
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
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

export default function App() {
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

  // Sync theme to document element class and localStorage
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

  // Persistent / Reactive App State
  const [sensorState, setSensorState] = useState<SensorState>(() => {
    const saved = localStorage.getItem('telemetry_sensor_state');
    return saved ? JSON.parse(saved) : INITIAL_SENSOR_STATE;
  });

  const [athleteProfile, setAthleteProfile] = useState<AthleteProfile>(() => {
    const saved = localStorage.getItem('telemetry_athlete_profile');
    return saved ? JSON.parse(saved) : INITIAL_ATHLETE_PROFILE;
  });

<<<<<<< HEAD
=======
  // Fetch session history from backend on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
        const res = await fetch(`${backendUrl}/api/sessions/history/${athleteProfile.name}`);
        if (!res.ok) throw new Error('Failed to fetch history');
        
        const rawSessions = await res.json();
        const mappedSessions: SessionData[] = rawSessions.map((s: any) => ({
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
          intensityPercent: 0, // Not stored yet, could be derived from reps/duration
          attempts: (s.attempts || []).map((a: any, i: number) => ({
            id: i + 1,
            timestampStr: new Date(a.timestamp).toISOString().substr(14, 5),
            jumpCm: a.heightCm,
            isPeak: a.heightCm === s.peakJumpCm,
          })),
          timeline: (s.attempts || []).map((a: any) => ({
            timeSec: Math.floor((a.timestamp - new Date(s.startTime).getTime()) / 1000),
            jumpCm: a.heightCm
          }))
        }));
        
        // Unconditionally set sessions to replace the local mock cache
        setSessions(mappedSessions);
      } catch (err) {
        console.error("Failed to fetch session history:", err);
      }
    };
    fetchHistory();
  }, [athleteProfile.name]);

>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
  const [sessions, setSessions] = useState<SessionData[]>(() => {
    const saved = localStorage.getItem('telemetry_sessions');
    return saved ? JSON.parse(saved) : HISTORICAL_SESSIONS;
  });

  const [currentSession, setCurrentSession] = useState<SessionData>(() => sessions[0]);
<<<<<<< HEAD
  const [activeAthleteId, setActiveAthleteId] = useState<string>('sim_athlete');

  // Fetch real sessions dynamically when login changes
  useEffect(() => {
    import('./utils/api').then(({ fetchSessionHistory }) => {
      fetchSessionHistory(activeAthleteId).then((data) => {
        if (data && data.length > 0) {
          setSessions(data);
          setCurrentSession(data[0]); 
        } else {
          // Fallback UI data if no MongoDB data exists for this specific ID
          setSessions(HISTORICAL_SESSIONS);
          setCurrentSession(HISTORICAL_SESSIONS[0]);
        }
      });
    });
  }, [activeAthleteId]);
=======
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242

  // Sync to localStorage
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
    localStorage.setItem('telemetry_sessions', JSON.stringify(sessions));
  }, [sessions]);

<<<<<<< HEAD
=======
  // Socket.io integration
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

    socket.on('jump_detected', (data: any) => {
      const { heightCm } = data;
      setSensorState((prev) => {
        const newMax = Math.max(prev.maxJumpCm, heightCm);
        const isNewPeak = heightCm > prev.maxJumpCm;
        return {
          ...prev,
          lastJumpCm: heightCm,
          maxJumpCm: newMax,
          totalJumps: prev.totalJumps + 1,
          isNewPeak,
        };
      });
      // Record the jump in the current session
      handleRecordJump(heightCm);
    });

    return () => {
      socket.disconnect();
    };
  }, []); // Run once on mount

  // Live session timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentTab === 'live' && currentSession) {
      interval = setInterval(() => {
        setCurrentSession((prev) => {
          if (!prev) return prev;
          return { ...prev, durationSec: prev.durationSec + 1 };
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentTab, currentSession]);

>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
  // Record Jump Attempt during Live session
  const handleRecordJump = (jumpCm: number) => {
    const now = new Date();
    const timeStr = `${now.getMinutes().toString().padStart(2, '0')}:${now
      .getSeconds()
      .toString()
      .padStart(2, '0')}`;

<<<<<<< HEAD
    const isPeak = jumpCm >= sensorState.maxJumpCm;
    const isFatigue = jumpCm < 36.0;

    setCurrentSession((prev) => {
=======
    const isFatigue = jumpCm < 36.0;

    setCurrentSession((prev) => {
      const isPeak = jumpCm >= prev.peakJumpCm;
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
      const newAttemptId = prev.attempts.length + 1;
      const updatedAttempts = [
        ...prev.attempts,
        {
          id: newAttemptId,
          timestampStr: timeStr,
          jumpCm,
          isPeak,
          isFatigue,
        },
      ];

<<<<<<< HEAD
      const newPeak = Math.max(prev.peakJumpCm, jumpCm);
=======
      const newPeak = Math.max(prev.peakJumpCm || 0, jumpCm);
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
      const newTotal = updatedAttempts.length;
      const newAvg = parseFloat(
        (updatedAttempts.reduce((acc, a) => acc + a.jumpCm, 0) / newTotal).toFixed(1)
      );
<<<<<<< HEAD

      return {
=======
      
      const newTimeline = [
        ...(prev.timeline || []),
        { timeSec: prev.durationSec || 0, jumpCm }
      ];

      const updatedSession = {
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
        ...prev,
        peakJumpCm: newPeak,
        avgJumpCm: newAvg,
        totalReps: newTotal,
        attempts: updatedAttempts,
<<<<<<< HEAD
      };
=======
        timeline: newTimeline,
      };

      // Keep the global sessions array in sync so we don't lose data when navigating
      setSessions((prevSessions) => 
        prevSessions.map(s => s.id === updatedSession.id ? updatedSession : s)
      );

      return updatedSession;
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
    });
  };

  // Start new live recording session
<<<<<<< HEAD
  const handleTriggerSessionStart = () => {
    const newSession: SessionData = {
      id: `session-live-${Date.now()}`,
      title: `${athleteProfile.primarySport} Live Stream`,
      sport: athleteProfile.primarySport,
      date: 'Today',
      isoDate: new Date().toISOString().split('T')[0],
      peakJumpCm: sensorState.lastJumpCm,
      avgJumpCm: sensorState.lastJumpCm,
      totalReps: 1,
      durationSec: 180,
      intensityPercent: 92,
      attempts: [
        {
          id: 1,
          timestampStr: '00:05',
          jumpCm: sensorState.lastJumpCm,
          isPeak: true,
        },
      ],
      timeline: [{ timeSec: 0, jumpCm: sensorState.lastJumpCm }],
    };

    setCurrentSession(newSession);
    setSessions((prev) => [newSession, ...prev]);
    setCurrentTab('analysis');
=======
  const handleTriggerSessionStart = async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const res = await fetch(`${backendUrl}/api/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteId: athleteProfile.name, sessionType: athleteProfile.primarySport })
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

      setCurrentSession(newSession);
      setSessions((prev) => [newSession, ...prev]);
      // Remain on the 'live' tab to watch the telemetry
    } catch (err) {
      console.error("Failed to start session:", err);
    }
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
  };

  // Select historical session for Debrief
  const handleSelectSession = (session: SessionData) => {
    setCurrentSession(session);
    setCurrentTab('analysis');
  };

  // Add manually logged session
  const handleAddLogSession = (newSession: SessionData) => {
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSession(newSession);
    setCurrentTab('analysis');
  };

  const handleClearCache = () => {
    localStorage.removeItem('telemetry_sessions');
    localStorage.removeItem('telemetry_sensor_state');
    localStorage.removeItem('telemetry_athlete_profile');
    setSessions(HISTORICAL_SESSIONS);
    setSensorState(INITIAL_SENSOR_STATE);
    setAthleteProfile(INITIAL_ATHLETE_PROFILE);
  };

  if (!isAuthenticated) {
    return (
      <AuthScreen
        onLogin={(email) => {
<<<<<<< HEAD
          const handleLogin = (email: string) => {
            if (email) {
              setAthleteProfile((prev) => ({ ...prev, email }));
            }
            setIsAuthenticated(true);
            // Dynamically set ID. If demo or blank, fallback to 'sim_athlete' where backend data exists.
            const extractedId = email.split('@')[0];
            if (extractedId !== 'pro.athlete' && extractedId.length > 2) {
              setActiveAthleteId(extractedId);
            } else {
              setActiveAthleteId('sim_athlete');
            }
          };
          handleLogin(email);
=======
          if (email) {
            setAthleteProfile((prev) => ({ ...prev, email }));
          }
          setIsAuthenticated(true);
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
        }}
      />
    );
  }

<<<<<<< HEAD
=======
  // Calculate true PB across all sessions (defaults to 0 if no jumps)
  const allTimePbCm = sessions.reduce((max, s) => Math.max(max, s.peakJumpCm || 0), 0);

>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-[#f8fafc] text-[#0f172a]' : 'bg-[#121212] text-[#e5e2e1]'} font-body-sm relative selection:bg-[#00fbfb] selection:text-black transition-colors duration-300`}>
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        sensorState={sensorState}
        onOpenProfile={() => setShowProfileModal(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Primary Tab Views */}
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
<<<<<<< HEAD
=======
                allTimePbCm={allTimePbCm}
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
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
<<<<<<< HEAD
=======
                allTimePbCm={allTimePbCm}
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
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
<<<<<<< HEAD
=======
                sessionId={currentSession.id}
>>>>>>> 7bf54ac1d48f9945c9bcb53013d5c9ec7a37f242
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Mobile Navigation */}
      <BottomNav currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Profile & Settings Modal */}
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
