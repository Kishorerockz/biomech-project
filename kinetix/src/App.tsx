import { useState, useEffect } from 'react';
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

  const [sessions, setSessions] = useState<SessionData[]>(() => {
    const saved = localStorage.getItem('telemetry_sessions');
    return saved ? JSON.parse(saved) : HISTORICAL_SESSIONS;
  });

  const [currentSession, setCurrentSession] = useState<SessionData>(() => sessions[0]);
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

  // Record Jump Attempt during Live session
  const handleRecordJump = (jumpCm: number) => {
    const now = new Date();
    const timeStr = `${now.getMinutes().toString().padStart(2, '0')}:${now
      .getSeconds()
      .toString()
      .padStart(2, '0')}`;

    const isPeak = jumpCm >= sensorState.maxJumpCm;
    const isFatigue = jumpCm < 36.0;

    setCurrentSession((prev) => {
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

      const newPeak = Math.max(prev.peakJumpCm, jumpCm);
      const newTotal = updatedAttempts.length;
      const newAvg = parseFloat(
        (updatedAttempts.reduce((acc, a) => acc + a.jumpCm, 0) / newTotal).toFixed(1)
      );

      return {
        ...prev,
        peakJumpCm: newPeak,
        avgJumpCm: newAvg,
        totalReps: newTotal,
        attempts: updatedAttempts,
      };
    });
  };

  // Start new live recording session
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
        }}
      />
    );
  }

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
