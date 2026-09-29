import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { TabType, SensorState, AthleteProfile, SessionData, SensorOffsets, ConnectionMode } from './types';
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
import { InstallAppBanner } from './components/InstallAppBanner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bleHardware, RawTelemetrySample } from './utils/bluetooth';
import { convertToGForce } from './utils/sensorMath';
import { getWsUrl, getApiBaseUrl, getBackendUrl, getConnectionConfig, saveConnectionConfig, ConnectionConfig } from './utils/connectionConfig';
import { ConnectionModal } from './components/ConnectionModal';

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
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          connected: false,
          connectionMode: 'disconnected',
          reconnecting: false,
        };
      } catch (e) {
        console.error('Failed to parse telemetry_sensor_state', e);
      }
    }
    return INITIAL_SENSOR_STATE;
  });

  const [athleteProfile, setAthleteProfile] = useState<AthleteProfile>(() => {
    const saved = localStorage.getItem('telemetry_athlete_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.jumpThresholdG === 1.50) {
          parsed.jumpThresholdG = 1.25;
        }
        return { ...INITIAL_ATHLETE_PROFILE, ...parsed };
      } catch (e) {}
    }
    return INITIAL_ATHLETE_PROFILE;
  });

  const [activeAthleteId, setActiveAthleteId] = useState<string>('sim_athlete');

  // React Query implementation for Offline Persistence
  const { data: historyPayload } = useQuery({
    queryKey: ['sessions', activeAthleteId],
    queryFn: async () => {
      // 1. Check local offline storage first
      const localSaved = localStorage.getItem(`telemetry_sessions_${activeAthleteId}`);
      let localSessions: SessionData[] = [];
      if (localSaved) {
        try {
          localSessions = JSON.parse(localSaved);
        } catch {
          // ignore
        }
      }

      // 2. Fetch remote history if available
      let remoteSessions = await fetchSessionHistory(activeAthleteId);
      if (Array.isArray(remoteSessions) && remoteSessions.length > 0) {
        const combined = [...localSessions, ...remoteSessions.filter(r => !localSessions.some(l => l.id === r.id))];
        return { sessions: combined, stats: null };
      }

      return {
        sessions: localSessions.length > 0 ? localSessions : HISTORICAL_SESSIONS,
        stats: null,
      };
    },
    staleTime: 1000 * 60 * 5, 
  });

  const validPayload = historyPayload || { sessions: HISTORICAL_SESSIONS, stats: null };
  const sessions: SessionData[] = validPayload?.sessions || HISTORICAL_SESSIONS || [];
  const backendStats = validPayload?.stats || null;
  
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => sessions?.[0]?.id);
  const currentSessionIdRef = useRef<string>(currentSessionId);
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const currentSession = (Array.isArray(sessions) && sessions.find((s: SessionData) => s.id === currentSessionId)) || sessions?.[0];

  // Keep localStorage in sync whenever sessions update
  useEffect(() => {
    if (sessions && sessions.length > 0) {
      localStorage.setItem(`telemetry_sessions_${activeAthleteId}`, JSON.stringify(sessions));
    }
  }, [sessions, activeAthleteId]);

  useEffect(() => {
    localStorage.setItem('telemetry_auth', JSON.stringify(isAuthenticated));
  }, [isAuthenticated]);

  useEffect(() => {
    localStorage.setItem('telemetry_sensor_state', JSON.stringify(sensorState));
  }, [sensorState]);

  useEffect(() => {
    localStorage.setItem('telemetry_athlete_profile', JSON.stringify(athleteProfile));
  }, [athleteProfile]);

  const [offsets, setOffsets] = useState<SensorOffsets>(() => {
    const saved = localStorage.getItem('telemetry_sensor_offsets');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          xOffset: typeof parsed.xOffset === 'number' ? parsed.xOffset : 0,
          yOffset: typeof parsed.yOffset === 'number' ? parsed.yOffset : 0,
          zOffset: typeof parsed.zOffset === 'number' ? parsed.zOffset : 0,
        };
      } catch (e) {
        console.error('Failed to parse telemetry_sensor_offsets', e);
      }
    }
    return { xOffset: 0, yOffset: 0, zOffset: 0 };
  });

  const offsetsRef = useRef<SensorOffsets>(offsets);
  useEffect(() => {
    offsetsRef.current = offsets;
    localStorage.setItem('telemetry_sensor_offsets', JSON.stringify(offsets));
  }, [offsets]);

  // Connection config (server IP/port — user configurable, no hardcoded values)
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig>(getConnectionConfig);
  const connectionConfigRef = useRef<ConnectionConfig>(connectionConfig);
  useEffect(() => {
    connectionConfigRef.current = connectionConfig;
    saveConnectionConfig(connectionConfig);
  }, [connectionConfig]);

  // Trigger WS reconnect when config changes
  const [wsReconnectKey, setWsReconnectKey] = useState(0);
  const handleSaveConnectionConfig = (cfg: ConnectionConfig) => {
    setConnectionConfig(cfg);
    setWsReconnectKey(k => k + 1);
  };

  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('disconnected');
  const connectionModeRef = useRef<ConnectionMode>(connectionMode);
  useEffect(() => {
    connectionModeRef.current = connectionMode;
  }, [connectionMode]);

  const [showConnectionModal, setShowConnectionModal] = useState(false);

  // Listener callback for intercepting live raw samples during calibration
  const rawSampleListenerRef = useRef<((raw: { x: number; y: number; z: number }) => void) | null>(null);

  // Shared Data Ingestion: Processes raw JSON telemetry from either WebSocket or BLE
  const processIncomingRawData = (data: RawTelemetrySample, source: 'wifi' | 'ble') => {
    if (data.x === -1) return; // Ignore drops

    // If BLE is actively connected, ignore background Wi-Fi packets to prevent UI flickering
    if (source === 'wifi' && connectionModeRef.current === 'ble') {
      return;
    }

    const rawX = Number(data.x) || 0;
    const rawY = Number(data.y) || 0;
    const rawZ = Number(data.z) || 0;
    const rawT = typeof data.t === 'number' ? data.t : undefined;

    // Pass raw uncalibrated sample to calibration listener if active
    if (rawSampleListenerRef.current) {
      rawSampleListenerRef.current({ x: rawX, y: rawY, z: rawZ });
    }

    // Apply client-side offsets ONLY if they are non-zero (firmware tare already applies offsets)
    // Prevents double-correction when both firmware and app calibration have been run
    const currentOffsets = offsetsRef.current;
    const hasAppOffsets = (currentOffsets.xOffset || 0) !== 0 || (currentOffsets.yOffset || 0) !== 0 || (currentOffsets.zOffset || 0) !== 0;
    const correctedX = hasAppOffsets ? rawX + (currentOffsets.xOffset || 0) : rawX;
    const correctedY = hasAppOffsets ? rawY + (currentOffsets.yOffset || 0) : rawY;
    const correctedZ = hasAppOffsets ? rawZ + (currentOffsets.zOffset || 0) : rawZ;

    const rawRange = Number((data as any).r) || 8;
    // Convert 16-bit raw values to acceleration in Gs via convertToGForce (4096 LSB/g for 8g)
    const accelX = convertToGForce(correctedX, rawRange);
    const accelY = convertToGForce(correctedY, rawRange);
    const accelZ = convertToGForce(correctedZ, rawRange);
    // Full-precision magnitude — no rounding! Rounding to 0.01g caused threshold jitter
    const magnitudeG = Math.sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);

    // Convert raw 16-bit gyro values to deg/s (MPU-6050 sensitivity for ±2000 deg/s is 16.4 LSB/(deg/s))
    const gyroScale = 16.4;
    const gyroX = data.gx != null ? parseFloat((Number(data.gx) / gyroScale).toFixed(2)) : 0;
    const gyroY = data.gy != null ? parseFloat((Number(data.gy) / gyroScale).toFixed(2)) : 0;
    const gyroZ = data.gz != null ? parseFloat((Number(data.gz) / gyroScale).toFixed(2)) : 0;

    setConnectionMode(source);
    connectionModeRef.current = source;
    setSensorState((prev) => ({
      ...prev,
      accel: { x: accelX, y: accelY, z: accelZ },
      gyro: { x: gyroX, y: gyroY, z: gyroZ },
      procAccelG: magnitudeG,
      connected: true,
      connectionMode: source,
      samplingRateHz: 100,
      hardwareTimestampUs: rawT,
      batteryPercent: data.bat != null ? Number(data.bat) : prev.batteryPercent,
      deviceName: source === 'ble' ? 'Kinetix Wearable (BLE)' : 'ESP32 Wi-Fi Node',
    }));
  };

  // 1. Hardware Direct Wi-Fi WebSocket (Connects directly to ESP32 AP on port 8080)
  const activeWsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isUnmounted = false;

    const connectWebSocket = () => {
      if (isUnmounted) return;
      if (connectionModeRef.current === 'ble') return;

      const wsUrl = getWsUrl(connectionConfigRef.current);

      try {
        console.log('[Kinetix-ESP32-WS] Connecting to hardware at:', wsUrl);
        ws = new WebSocket(wsUrl);
        activeWsRef.current = ws;

        ws.onopen = () => {
          console.log('[Kinetix-ESP32-WS] Connected successfully to:', wsUrl);
          if (isUnmounted) return;
          if (connectionModeRef.current === 'ble') {
            ws?.close();
            return;
          }
          setConnectionMode('wifi');
          connectionModeRef.current = 'wifi';
          setSensorState((prev) => ({
            ...prev,
            connected: true,
            connectionMode: 'wifi',
            reconnecting: false,
            deviceName: 'Kinetix ESP32 (Wi-Fi)',
            ipAddress: connectionConfigRef.current.wsHost || '192.168.4.1',
          }));
        };

        ws.onclose = () => {
          if (isUnmounted || connectionModeRef.current === 'ble') return;
          setSensorState((prev) => {
            if (activeSocketRef.current?.connected) return prev;
            return {
              ...prev,
              connected: false,
              connectionMode: 'disconnected',
              reconnecting: true,
            };
          });
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          // Hardware WS silent fallback
        };

        ws.onmessage = (event) => {
          if (connectionModeRef.current === 'ble') return;
          try {
            const data = JSON.parse(event.data);
            processIncomingRawData(data, 'wifi');
          } catch (e) {
            console.error('[Kinetix-ESP32-WS] Telemetry parse error:', e);
          }
        };
      } catch {
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [wsReconnectKey]);

  // 2. Backend Socket.io (Optional backend relay / simulator stream)
  const activeSocketRef = useRef<any>(null);
  const handleRecordJumpRef = useRef<(jumpCm: number) => void>(() => {});

  useEffect(() => {
    if (connectionModeRef.current === 'ble') return;

    const backendUrl = getBackendUrl(connectionConfigRef.current);

    const socket = io(backendUrl, {
      reconnection: true,
      transports: ['websocket', 'polling'],
      timeout: 3000,
    });
    activeSocketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Kinetix-SocketIO] Connected to backend:', backendUrl);
      setSensorState((prev) => ({
        ...prev,
        connected: true,
        connectionMode: prev.connectionMode === 'disconnected' ? 'wifi' : prev.connectionMode,
        deviceName: prev.deviceName || 'Biomech Server',
      }));
    });

    socket.on('disconnect', () => {
      // Disconnect from Socket.io doesn't drop sensor if hardware WS is open
      setSensorState((prev) => {
        if (activeWsRef.current?.readyState === WebSocket.OPEN) return prev;
        return {
          ...prev,
          connected: false,
          connectionMode: 'disconnected',
          reconnecting: true,
        };
      });
    });

    socket.on('dashboard_update', (data: any) => {
      if (connectionModeRef.current === 'ble') return;
      // If hardware WS is actively streaming, don't overwrite with backend
      if (activeWsRef.current?.readyState === WebSocket.OPEN) return;

      setConnectionMode('wifi');
      connectionModeRef.current = 'wifi';
      setSensorState((prev) => ({
        ...prev,
        accel: data.accel || prev.accel,
        gyro: data.gyro || prev.gyro,
        procAccelG: typeof data.processedAccel === 'number' ? data.processedAccel : prev.procAccelG,
        orientation: data.orientation || prev.orientation,
        connected: true,
        connectionMode: 'wifi',
        reconnecting: false,
      }));
    });

    // Authoritative jump detection from backend if present
    socket.on('jump_detected', (data: any) => {
      console.log('[Kinetix-SocketIO] Jump detected event received from backend:', data);
      const height = typeof data.heightCm === 'number' ? data.heightCm : 0;
      setSensorState((prev) => {
        const isPeak = height > prev.maxJumpCm;
        return {
          ...prev,
          lastJumpCm: height,
          maxJumpCm: isPeak ? height : prev.maxJumpCm,
          totalJumps: (prev.totalJumps || 0) + 1,
          hangTimeMs: typeof data.hangTimeMs === 'number' ? data.hangTimeMs : prev.hangTimeMs,
          landingImpactG: typeof data.landingImpactG === 'number' ? data.landingImpactG : prev.landingImpactG,
          takeoffAccelG: typeof data.takeoffAccelG === 'number' ? data.takeoffAccelG : prev.takeoffAccelG,
          twistDeg: typeof data.twistDeg === 'number' ? data.twistDeg : prev.twistDeg,
          isNewPeak: isPeak,
        };
      });

      handleRecordJumpRef.current(height);
    });

    socket.on('stream_stats', (stats: any) => {
      if (stats?.hz) {
        setSensorState((prev) => ({ ...prev, streamHz: stats.hz }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [wsReconnectKey]);

  // 3. Web Bluetooth (Manual user trigger)
  const handlePairBLE = async () => {
    if (connectionModeRef.current === 'ble') {
      await bleHardware.disconnect();
      setConnectionMode('disconnected');
      connectionModeRef.current = 'disconnected';
      setSensorState((prev) => ({
        ...prev,
        connected: false,
        connectionMode: 'disconnected',
      }));
      return;
    }

    await bleHardware.requestBLEDevice(
      (rawData) => {
        processIncomingRawData(rawData, 'ble');
      },
      (status) => {
        if (status.connected) {
          if (activeWsRef.current && activeWsRef.current.readyState === WebSocket.OPEN) {
            activeWsRef.current.close();
          }
          if (activeSocketRef.current && activeSocketRef.current.connected) {
            activeSocketRef.current.disconnect();
          }
          setConnectionMode('ble');
          connectionModeRef.current = 'ble';
          setSensorState((prev) => ({
            ...prev,
            connected: true,
            connectionMode: 'ble',
            deviceName: status.deviceName || 'Kinetix Wearable (BLE)',
          }));
        } else if (status.error) {
          console.warn('[BLE Status]:', status.error);
          alert(`Bluetooth Error: ${status.error}`);
        }
      }
    );
  };

  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [sessionElapsedSec, setSessionElapsedSec] = useState<number>(0);

  // Live session timer updating React Query cache
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSessionActive && currentTab === 'live' && currentSession) {
      interval = setInterval(() => {
        setSessionElapsedSec((prev) => prev + 1);
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
  }, [isSessionActive, currentTab, currentSession, queryClient, activeAthleteId]);

  const handleRecordJump = (jumpCm: number) => {
    let activeId = currentSessionIdRef.current;
    if (!activeId) {
      activeId = sessions?.[0]?.id;
      if (activeId) {
        currentSessionIdRef.current = activeId;
      }
    }
    if (!activeId) return;

    const now = new Date();
    const timeStr = `${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const isFatigue = jumpCm < 36.0;

    queryClient.setQueryData(['sessions', activeAthleteId], (old: any) => {
      if (!old) return old;
      
      const oldArray = Array.isArray(old) ? old : (old.sessions || []);
      const newOldSessions = oldArray.map((prev: SessionData) => {
        if (prev.id !== activeId) return prev;
        const isPeak = jumpCm >= (prev.peakJumpCm || 0);
        const newAttemptId = (prev.attempts || []).length + 1;
        const updatedAttempts = [
          ...(prev.attempts || []),
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
  handleRecordJumpRef.current = handleRecordJump;

  const handleTriggerSessionStart = async () => {
    try {
      // Clear live metrics for the new session immediately
      setSensorState((prev) => ({
        ...prev,
        lastJumpCm: 0,
        maxJumpCm: 0,
        totalJumps: 0,
        hangTimeMs: 0,
        landingImpactG: 0,
        takeoffAccelG: 0,
        isNewPeak: false,
      }));
      setSessionElapsedSec(0);
      setIsSessionActive(true);

      // 1. Generate local session ID synchronously so any jumps detected right away belong to it
      const localSessionId = `session-live-${Date.now()}`;
      currentSessionIdRef.current = localSessionId;
      setCurrentSessionId(localSessionId);

      const newSession: SessionData = {
        id: localSessionId,
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

      // 2. Notify backend if running
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
        const res = await fetch(`${backendUrl}/api/sessions/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ athleteId: activeAthleteId, sessionType: athleteProfile.primarySport })
        });
        
        if (res.ok) {
          const data = await res.json();
          const remoteId = data.sessionId;
          if (remoteId && remoteId !== localSessionId) {
            currentSessionIdRef.current = remoteId;
            setCurrentSessionId(remoteId);
            queryClient.setQueryData(['sessions', activeAthleteId], (old: any) => {
              if (!old) return old;
              const oldArray = Array.isArray(old) ? old : (old?.sessions || []);
              const updated = oldArray.map((s: SessionData) => s.id === localSessionId ? { ...s, id: remoteId } : s);
              return Array.isArray(old) ? updated : { ...old, sessions: updated };
            });
          }
        }
      } catch (err) {
        console.warn("Backend /api/sessions/start unreachable or offline, using local live session ID:", err);
      }
    } catch (err) {
      console.error("Failed to start session:", err);
    }
  };

  const [finishedSessionSummary, setFinishedSessionSummary] = useState<SessionData | null>(null);

  const handleTriggerSessionStop = async () => {
    setIsSessionActive(false);

    const activeId = currentSessionIdRef.current;
    const finalElapsed = sessionElapsedSec;
    const finalTotalJumps = sensorState.totalJumps;
    const finalPeakFromSensor = sensorState.maxJumpCm || sensorState.lastJumpCm || 0;

    // Save final session snapshot to query cache
    if (activeId) {
      let finalSummary: SessionData | null = null;
      queryClient.setQueryData(['sessions', activeAthleteId], (old: any) => {
        if (!old) return old;
        const oldArray = Array.isArray(old) ? old : (old.sessions || []);
        const updatedArray = oldArray.map((s: SessionData) => {
          if (s.id !== activeId) return s;

          const hasAttempts = s.attempts && s.attempts.length > 0;
          const peak = hasAttempts 
            ? Math.max(...s.attempts.map((a) => a.jumpCm)) 
            : finalPeakFromSensor > 0 ? finalPeakFromSensor : s.peakJumpCm;

          const avg = hasAttempts
            ? parseFloat((s.attempts.reduce((acc, a) => acc + a.jumpCm, 0) / s.attempts.length).toFixed(1))
            : peak > 0 ? peak : s.avgJumpCm;

          const reps = hasAttempts ? s.attempts.length : (finalTotalJumps || s.totalReps || 0);

          const completed: SessionData = {
            ...s,
            durationSec: finalElapsed,
            totalReps: reps,
            peakJumpCm: peak,
            avgJumpCm: avg,
          };
          finalSummary = completed;
          return completed;
        });
        return Array.isArray(old) ? updatedArray : { ...old, sessions: updatedArray };
      });

      if (finalSummary) {
        setFinishedSessionSummary(finalSummary);
      }

      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
        await fetch(`${backendUrl}/api/sessions/${activeId}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.warn("Backend not running or failed on session end:", err);
      }
    }

    // Reset live transient metrics so screen is clean for next session
    setSensorState((prev) => ({
      ...prev,
      lastJumpCm: 0,
      maxJumpCm: 0,
      totalJumps: 0,
      hangTimeMs: 0,
      landingImpactG: 0,
      takeoffAccelG: 0,
      isNewPeak: false,
    }));
    setSessionElapsedSec(0);
  };

  const handleToggleSession = () => {
    if (isSessionActive) {
      handleTriggerSessionStop();
    } else {
      handleTriggerSessionStart();
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

  const handleTare = () => {
    if (connectionModeRef.current === 'ble') {
      bleHardware.sendCommand('tare').catch((e) => console.warn(e));
    } else if (activeWsRef.current && activeWsRef.current.readyState === WebSocket.OPEN) {
      activeWsRef.current.send('tare');
      console.log('[Kinetix] Sent tare command via WebSocket');
    }
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
    <div className="min-h-screen bg-[#0b0d11] text-[#e5e2e1] font-body-sm relative selection:bg-[#00f5d4] selection:text-black transition-colors duration-300">
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        sensorState={sensorState}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenConnectionModal={() => setShowConnectionModal(true)}
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
                isSessionActive={isSessionActive}
                sessionElapsedSec={sessionElapsedSec}
                onToggleSession={handleToggleSession}
                onRecordJump={handleRecordJump}
                onPairBLE={handlePairBLE}
                onOpenConnectionSettings={() => setShowConnectionModal(true)}
                serverHost={connectionConfig.wsHost}
                onTare={handleTare}
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
                offsets={offsets}
                onSaveOffsets={setOffsets}
                registerRawSampleListener={(callback) => {
                  rawSampleListenerRef.current = callback;
                }}
                connectionConfig={connectionConfig}
                onSaveConnectionConfig={handleSaveConnectionConfig}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav currentTab={currentTab} setCurrentTab={setCurrentTab} />
      <InstallAppBanner />

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
        {showConnectionModal && (
          <ConnectionModal
            config={connectionConfig}
            onSave={handleSaveConnectionConfig}
            onClose={() => setShowConnectionModal(false)}
            sensorState={sensorState}
          />
        )}
        {finishedSessionSummary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#121212] border border-[#c9a050]/40 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#c9a050] text-2xl">emoji_events</span>
                  <h3 className="font-headline-md text-xl font-bold text-white uppercase tracking-wider">
                    Session Completed
                  </h3>
                </div>
                <span className="text-[10px] font-data-label px-2.5 py-0.5 rounded-full bg-[#c9a050]/20 text-[#c9a050] border border-[#c9a050]/40 font-bold uppercase">
                  {finishedSessionSummary.sport}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <span className="text-[10px] font-data-label text-white/50 uppercase tracking-widest block mb-1">
                    Peak Jump
                  </span>
                  <span className="font-display-metrics text-3xl font-bold text-[#c9a050]">
                    {finishedSessionSummary.peakJumpCm}
                    <span className="text-sm font-normal text-white/50 ml-1">cm</span>
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <span className="text-[10px] font-data-label text-white/50 uppercase tracking-widest block mb-1">
                    Average Jump
                  </span>
                  <span className="font-display-metrics text-3xl font-bold text-[#00fbfb]">
                    {finishedSessionSummary.avgJumpCm}
                    <span className="text-sm font-normal text-white/50 ml-1">cm</span>
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <span className="text-[10px] font-data-label text-white/50 uppercase tracking-widest block mb-1">
                    Total Reps
                  </span>
                  <span className="font-display-metrics text-2xl font-bold text-white">
                    {finishedSessionSummary.totalReps}
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <span className="text-[10px] font-data-label text-white/50 uppercase tracking-widest block mb-1">
                    Duration
                  </span>
                  <span className="font-display-metrics text-2xl font-bold text-white">
                    {Math.floor(finishedSessionSummary.durationSec / 60)}m {finishedSessionSummary.durationSec % 60}s
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setFinishedSessionSummary(null)}
                  className="flex-1 py-3 px-4 rounded-full border border-white/20 text-white font-data-label text-xs uppercase tracking-wider font-bold hover:bg-white/5 transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setCurrentSessionId(finishedSessionSummary.id);
                    setFinishedSessionSummary(null);
                    setCurrentTab('analysis');
                  }}
                  className="flex-1 py-3 px-4 rounded-full bg-[#c9a050] hover:bg-[#d9b060] text-black font-data-label text-xs uppercase tracking-wider font-bold shadow-[0_0_15px_rgba(201,160,80,0.4)] transition-all cursor-pointer"
                >
                  View Analysis
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
