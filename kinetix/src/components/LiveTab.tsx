import React, { useState, useEffect, useRef } from 'react';
import { SensorState, AthleteProfile, SessionData } from '../types';
import { audioEngine } from '../utils/audio';
import { JumpAvatar } from './JumpAvatar';
import { useJumpDetection } from '../hooks/useJumpDetection';
import { bleHardware } from '../utils/bluetooth';

interface LiveTabProps {
  sensorState: SensorState;
  setSensorState: React.Dispatch<React.SetStateAction<SensorState>>;
  athleteProfile: AthleteProfile;
  currentSession: SessionData | undefined;
  isSessionActive: boolean;
  sessionElapsedSec: number;
  onToggleSession: () => void;
  onRecordJump: (jumpCm: number) => void;
  onPairBLE?: () => void;
  onOpenConnectionSettings?: () => void;
  serverHost?: string;
  onTare?: () => void;
}

export const LiveTab: React.FC<LiveTabProps> = ({
  sensorState,
  setSensorState,
  athleteProfile,
  currentSession,
  isSessionActive,
  sessionElapsedSec,
  onToggleSession,
  onRecordJump,
  onPairBLE,
  onOpenConnectionSettings,
  onTare,
}) => {
  const [jumpAnimation, setJumpAnimation] = useState(false);
  const [activeTelemetryView, setActiveTelemetryView] = useState<'graph' | '3d'>('graph');
  const [unit, setUnit] = useState<'cm' | 'in'>(athleteProfile.units === 'imperial' ? 'in' : 'cm');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [tareSuccess, setTareSuccess] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataPointsRef = useRef<number[]>([]);
  const latestAccelRef = useRef<number>(sensorState.procAccelG || 1.0);
  const maxJumpCmRef = useRef<number>(0);

  // Jump Detection Engine (Demoted in WiFi/Socket.io mode; secondary metrics & standalone BLE fallback)
  const jumpMetrics = useJumpDetection(
    sensorState.procAccelG || 1.0,
    isSessionActive,
    (metrics) => {
      const flightTimeSec = metrics.hangTimeMs / 1000;
      const flightHeightCm = 122.625 * flightTimeSec * flightTimeSec;
      const calculatedHeightCm = parseFloat(Math.min(120.0, flightHeightCm).toFixed(1));

      // Always update secondary metrics (RSI, GCT)
      setSensorState((prev) => {
        // If in direct BLE mode without backend, fallback to local height calculation
        if (prev.connectionMode === 'ble') {
          const isPeak = calculatedHeightCm > maxJumpCmRef.current;
          if (isPeak) maxJumpCmRef.current = calculatedHeightCm;
          return {
            ...prev,
            lastJumpCm: calculatedHeightCm,
            maxJumpCm: isPeak ? calculatedHeightCm : prev.maxJumpCm,
            totalJumps: metrics.totalJumps,
            hangTimeMs: metrics.hangTimeMs,
            landingImpactG: metrics.landingImpactG,
            takeoffAccelG: metrics.takeoffAccelG,
            groundContactTimeMs: metrics.groundContactTimeMs,
            rsi: metrics.rsi,
            isNewPeak: isPeak,
          };
        }
        // In WiFi / Socket.io mode, backend jump_detected is authoritative!
        // Only update client-derived secondary metrics (RSI, groundContactTimeMs)
        return {
          ...prev,
          groundContactTimeMs: metrics.groundContactTimeMs ?? prev.groundContactTimeMs,
          rsi: metrics.rsi ?? prev.rsi,
        };
      });

      // In standalone BLE mode, record jump locally
      if (sensorState.connectionMode === 'ble') {
        onRecordJump(calculatedHeightCm);
      }
    },
    sensorState.hardwareTimestampUs,
    athleteProfile.wearLocation || 'waist',
    athleteProfile.jumpThresholdG
  );

  // Authoritative Audio & Haptic Feedback (Triggers on backend or BLE authoritative jumps)
  const prevJumpCmRef = useRef<number>(sensorState.lastJumpCm);
  useEffect(() => {
    if (sensorState.lastJumpCm > 0 && sensorState.lastJumpCm !== prevJumpCmRef.current) {
      prevJumpCmRef.current = sensorState.lastJumpCm;
      setJumpAnimation(true);
      if (audioEnabled) {
        if (sensorState.landingImpactG && sensorState.landingImpactG >= 4.5) {
          audioEngine.playShockAlert();
          audioEngine.speakVoiceAnnouncement(`Caution: Heavy landing. ${sensorState.landingImpactG} Gs.`);
        } else {
          audioEngine.playJumpChime(sensorState.isNewPeak);
          audioEngine.triggerHaptic(sensorState.isNewPeak ? [60, 40, 80] : 40);
          if (sensorState.isNewPeak) {
            audioEngine.speakVoiceAnnouncement(`New peak! ${sensorState.lastJumpCm} centimeters.`);
          } else {
            audioEngine.speakVoiceAnnouncement(`${sensorState.lastJumpCm} centimeters.`);
          }
        }
      }
      const timer = setTimeout(() => setJumpAnimation(false), 800);
      return () => clearTimeout(timer);
    }
  }, [sensorState.lastJumpCm, sensorState.isNewPeak, sensorState.landingImpactG, audioEnabled]);

  // Sync state values
  useEffect(() => {
    latestAccelRef.current = sensorState.procAccelG || 1.0;
  }, [sensorState.procAccelG]);

  // Waveform canvas initialization & rendering
  useEffect(() => {
    const pointsCount = 120;
    const initial = Array(pointsCount).fill(94);
    dataPointsRef.current = initial;
  }, []);

  useEffect(() => {
    let animId: number;
    const render = () => {
      const canvas = canvasRef.current;
      if (canvas && activeTelemetryView === 'graph') {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;

          const points = dataPointsRef.current;
          points.shift();

          const currentG = latestAccelRef.current || 1.0;
          const baselineY = height * 0.65;
          const scalePxPerG = height * 0.22;
          const calculatedY = baselineY - (currentG - 1.0) * scalePxPerG;
          const nextVal = Math.max(8, Math.min(height - 8, calculatedY));
          points.push(nextVal);

          // Clear
          ctx.clearRect(0, 0, width, height);

          // Subtle horizontal gridlines
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.lineWidth = 1;
          for (let y = 15; y < height; y += 28) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }

          // 1.0g Resting Baseline line
          ctx.strokeStyle = 'rgba(0, 245, 212, 0.2)';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, baselineY);
          ctx.lineTo(width, baselineY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Gradient under curve
          const gradient = ctx.createLinearGradient(0, 0, 0, height);
          gradient.addColorStop(0, 'rgba(0, 245, 212, 0.35)');
          gradient.addColorStop(1, 'rgba(0, 245, 212, 0)');

          ctx.beginPath();
          const dx = width / (points.length - 1);
          ctx.moveTo(0, height);
          ctx.lineTo(0, points[0]);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(i * dx, points[i]);
          }
          ctx.lineTo(width, height);
          ctx.closePath();
          ctx.fillStyle = gradient;
          ctx.fill();

          // Smooth curve stroke
          ctx.beginPath();
          ctx.moveTo(0, points[0]);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(i * dx, points[i]);
          }
          ctx.strokeStyle = '#00f5d4';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = 'rgba(0, 245, 212, 0.6)';
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [activeTelemetryView]);

  const toggleAudio = () => {
    audioEngine.enabled = !audioEnabled;
    setAudioEnabled(!audioEnabled);
  };

  const handleQuickTare = () => {
    if (onTare) {
      onTare();
    } else if (sensorState.connectionMode === 'ble') {
      bleHardware.sendCommand('tare').catch((e) => console.warn(e));
    }
    jumpMetrics.resetMetrics();
    setSensorState((prev) => ({
      ...prev,
      lastJumpCm: 0,
    }));
    setTareSuccess(true);
    setTimeout(() => setTareSuccess(false), 1500);
  };

  const displayJumpHeight = unit === 'in'
    ? (sensorState.lastJumpCm / 2.54).toFixed(1)
    : (sensorState.lastJumpCm || 0).toFixed(1);

  return (
    <div className="pt-20 md:pt-24 px-4 md:px-8 max-w-5xl mx-auto space-y-5 pb-36">
      {/* Top Action Ribbon */}
      <div className="flex items-center justify-between gap-3 px-1">
        {/* Prominent Calibrate / Tare Button */}
        <button
          onClick={handleQuickTare}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold border transition-all cursor-pointer flex items-center gap-2 active:scale-95 shadow-sm ${
            tareSuccess
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
              : 'bg-white/[0.05] hover:bg-white/[0.09] border-white/10 text-white hover:border-[#00f5d4]/40'
          }`}
          title="Zero and calibrate sensor before jumping"
        >
          <span className="material-symbols-outlined text-sm text-[#00f5d4]">
            {tareSuccess ? 'check_circle' : 'tune'}
          </span>
          <span>{tareSuccess ? 'Calibrated!' : 'Calibrate / Tare'}</span>
        </button>

        {/* Audio & Unit Controls */}
        <div className="flex items-center gap-2">
          {!sensorState.connected && onPairBLE && (
            <button
              onClick={onPairBLE}
              className="px-3 py-1.5 rounded-xl bg-[#00f5d4]/10 hover:bg-[#00f5d4]/20 border border-[#00f5d4]/30 text-[#00f5d4] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">bluetooth</span>
              <span>Connect</span>
            </button>
          )}

          <button
            onClick={toggleAudio}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              audioEnabled
                ? 'bg-[#00f5d4]/10 border-[#00f5d4]/30 text-[#00f5d4]'
                : 'bg-white/[0.04] border-white/10 text-white/40'
            }`}
            title={audioEnabled ? 'Voice/Chimes Active' : 'Audio Muted'}
          >
            <span className="material-symbols-outlined text-base">
              {audioEnabled ? 'volume_up' : 'volume_off'}
            </span>
          </button>

          <div className="flex rounded-xl bg-white/[0.04] p-0.5 border border-white/10 text-xs font-mono">
            <button
              onClick={() => setUnit('cm')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                unit === 'cm' ? 'bg-[#00f5d4] text-black font-bold' : 'text-white/60 hover:text-white'
              }`}
            >
              CM
            </button>
            <button
              onClick={() => setUnit('in')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                unit === 'in' ? 'bg-[#00f5d4] text-black font-bold' : 'text-white/60 hover:text-white'
              }`}
            >
              IN
            </button>
          </div>
        </div>
      </div>

      {/* Hero Elevation Card */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#121722]/90 via-[#0e121a]/80 to-[#0b0d11] border border-white/[0.09] p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-[#00f5d4]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center justify-center text-center relative z-10">
          {/* Header Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono font-medium text-white/80">
              <span className="material-symbols-outlined text-sm text-[#00f5d4]">fitness_center</span>
              <span className="text-[#00f5d4]">JUMPS:</span>
              <span className="font-bold text-white">
                {sensorState.totalJumps || (sensorState.connectionMode === 'ble' ? jumpMetrics.totalJumps : 0)}
              </span>
            </div>

            {sensorState.isNewPeak && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs font-bold tracking-wider uppercase animate-bounce shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                <span className="material-symbols-outlined text-sm filled text-amber-400">local_fire_department</span>
                <span>NEW PEAK</span>
              </div>
            )}

            {jumpMetrics.jumpType && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono font-medium text-white/80">
                <span className="text-[#00f5d4]">TYPE:</span>
                <span>
                  {jumpMetrics.jumpType === 'CMJ'
                    ? 'Countermovement (CMJ)'
                    : jumpMetrics.jumpType === 'DJ'
                    ? 'Drop Jump (DJ)'
                    : 'Squat Jump (SJ)'}
                </span>
              </div>
            )}
          </div>

          <span className="text-xs uppercase tracking-[0.25em] font-medium text-white/40 mb-2">
            VERTICAL ELEVATION
          </span>

          {/* Large Metric Value */}
          <div
            className={`font-display-metrics text-6xl sm:text-7xl md:text-8xl font-black tracking-tight text-white flex items-baseline justify-center transition-transform duration-200 ${
              jumpAnimation ? 'scale-105 text-[#00f5d4]' : ''
            }`}
          >
            <span>{displayJumpHeight}</span>
            <span className="text-2xl sm:text-3xl md:text-4xl text-[#00f5d4] ml-2 font-mono font-semibold">
              {unit}
            </span>
          </div>

          {/* Live Phase Pill */}
          <div className="mt-5 flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono tracking-wider uppercase transition-all duration-200 bg-white/[0.04] border-white/10">
            <span
              className={`w-2 h-2 rounded-full ${
                jumpMetrics.jumpState === 'AIRBORNE'
                  ? 'bg-[#00f5d4] animate-ping'
                  : jumpMetrics.jumpState === 'TAKEOFF'
                  ? 'bg-purple-400 animate-pulse'
                  : jumpMetrics.jumpState === 'DIP'
                  ? 'bg-amber-400'
                  : jumpMetrics.jumpState === 'LANDING'
                  ? 'bg-emerald-400'
                  : 'bg-white/40'
              }`}
            />
            <span
              className={
                jumpMetrics.jumpState === 'AIRBORNE'
                  ? 'text-[#00f5d4] font-bold'
                  : jumpMetrics.jumpState === 'TAKEOFF'
                  ? 'text-purple-300 font-semibold'
                  : jumpMetrics.jumpState === 'DIP'
                  ? 'text-amber-300'
                  : jumpMetrics.jumpState === 'LANDING'
                  ? 'text-emerald-300 font-semibold'
                  : 'text-white/60'
              }
            >
              Phase: {jumpMetrics.jumpState || 'READY'}
            </span>
          </div>
        </div>
      </section>

      {/* Telemetry Cockpit (3D Spatial Arena & Live 100Hz Waveform) */}
      <section className="rounded-3xl bg-[#121620]/80 border border-white/[0.08] backdrop-blur-xl p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-[#00f5d4]">timeline</span>
            <span className="text-xs font-mono uppercase tracking-wider text-white/70 font-semibold">
              REAL-TIME KINEMATIC STREAM
            </span>
          </div>

          {/* View Mode Switcher */}
          <div className="flex rounded-full bg-white/[0.04] p-0.5 border border-white/10 text-xs">
            <button
              onClick={() => setActiveTelemetryView('graph')}
              className={`px-3 py-1 rounded-full transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTelemetryView === 'graph'
                  ? 'bg-[#00f5d4] text-black font-semibold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-sm">show_chart</span>
              <span>G-Force Waveform</span>
            </button>
            <button
              onClick={() => setActiveTelemetryView('3d')}
              className={`px-3 py-1 rounded-full transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTelemetryView === '3d'
                  ? 'bg-[#00f5d4] text-black font-semibold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-sm">3d_rotation</span>
              <span>3D Spatial</span>
            </button>
          </div>
        </div>

        {/* View Contents */}
        {activeTelemetryView === 'graph' ? (
          <div className="space-y-2">
            <div className="w-full h-44 bg-[#090b0f] rounded-2xl border border-white/[0.06] relative overflow-hidden flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={800}
                height={176}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2.5 right-3 text-[10px] font-mono text-[#00f5d4] bg-[#00f5d4]/10 border border-[#00f5d4]/30 px-2 py-0.5 rounded-full font-semibold">
                100Hz Tick
              </div>
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-white/40 px-1">
              <span>0g (Freefall Flight)</span>
              <span>1.0g (Resting Gravity Baseline)</span>
              <span>Resultant |a|</span>
            </div>
          </div>
        ) : (
          <div className="w-full h-64 md:h-72 rounded-2xl bg-[#090b0f] border border-white/[0.06] overflow-hidden relative">
            <JumpAvatar
              gyro={sensorState.gyro || { x: 0, y: 0, z: 0 }}
              accel={sensorState.accel || { x: 0, y: 1, z: 0 }}
              connected={sensorState.connected}
            />
            <div className="absolute bottom-2 left-3 text-[11px] font-mono text-white/50">
              Drag to orbit 3D body orientation
            </div>
          </div>
        )}
      </section>

      {/* 4 Core Athletic Biomechanics KPI Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Hang Time */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 md:p-5 backdrop-blur-xl flex flex-col justify-between hover:border-[#00f5d4]/40 transition-colors group">
          <div className="flex items-center justify-between text-white/40 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">Hang Time</span>
            <span className="material-symbols-outlined text-base group-hover:text-[#00f5d4] transition-colors">
              timer
            </span>
          </div>
          <div>
            <div className="font-display-metrics text-2xl md:text-3xl font-bold text-white">
              {sensorState.hangTimeMs || jumpMetrics.hangTimeMs ? `${sensorState.hangTimeMs || jumpMetrics.hangTimeMs}` : '--'}
              <span className="text-sm font-mono text-white/40 ml-1 font-normal">ms</span>
            </div>
            <div className="text-[11px] font-mono text-white/40 mt-1">Flight duration</div>
          </div>
        </div>

        {/* Takeoff Acceleration */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 md:p-5 backdrop-blur-xl flex flex-col justify-between hover:border-[#00f5d4]/40 transition-colors group">
          <div className="flex items-center justify-between text-white/40 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">Takeoff Expl.</span>
            <span className="material-symbols-outlined text-base group-hover:text-[#00f5d4] transition-colors">
              arrow_upward
            </span>
          </div>
          <div>
            <div className="font-display-metrics text-2xl md:text-3xl font-bold text-white">
              {sensorState.takeoffAccelG || jumpMetrics.takeoffAccelG ? `${(sensorState.takeoffAccelG || jumpMetrics.takeoffAccelG || 0).toFixed(1)}` : '--'}
              <span className="text-sm font-mono text-white/40 ml-1 font-normal">g</span>
            </div>
            <div className="text-[11px] font-mono text-white/40 mt-1">Peak propulsion</div>
          </div>
        </div>

        {/* Landing Impact Deceleration */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 md:p-5 backdrop-blur-xl flex flex-col justify-between hover:border-red-400/40 transition-colors group">
          <div className="flex items-center justify-between text-white/40 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">Landing Force</span>
            <span className="material-symbols-outlined text-base group-hover:text-red-400 transition-colors">
              arrow_downward
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display-metrics text-2xl md:text-3xl font-bold text-white">
                {sensorState.landingImpactG || jumpMetrics.landingImpactG ? `${(sensorState.landingImpactG || jumpMetrics.landingImpactG || 0).toFixed(1)}` : '--'}
                <span className="text-sm font-mono text-white/40 ml-1 font-normal">g</span>
              </span>
              {(sensorState.landingImpactG || jumpMetrics.landingImpactG) ? (
                <span
                  className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${
                    (sensorState.landingImpactG || jumpMetrics.landingImpactG || 0) > 4.2
                      ? 'bg-red-500/20 text-red-400'
                      : (sensorState.landingImpactG || jumpMetrics.landingImpactG || 0) > 2.8
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  {(sensorState.landingImpactG || jumpMetrics.landingImpactG || 0) > 4.2
                    ? 'Heavy'
                    : (sensorState.landingImpactG || jumpMetrics.landingImpactG || 0) > 2.8
                    ? 'Mod.'
                    : 'Safe'}
                </span>
              ) : null}
            </div>
            <div className="text-[11px] font-mono text-white/40 mt-1">Deceleration impact</div>
          </div>
        </div>

        {/* Reactive Strength Index (RSI) */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 md:p-5 backdrop-blur-xl flex flex-col justify-between hover:border-[#00f5d4]/40 transition-colors group">
          <div className="flex items-center justify-between text-white/40 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider">Reactive RSI</span>
            <span className="material-symbols-outlined text-base group-hover:text-[#00f5d4] transition-colors">
              electric_bolt
            </span>
          </div>
          <div>
            <div className="font-display-metrics text-2xl md:text-3xl font-bold text-[#00f5d4]">
              {sensorState.rsi || jumpMetrics.rsi ? `${(sensorState.rsi || jumpMetrics.rsi || 0).toFixed(2)}` : '--'}
            </div>
            <div className="text-[11px] font-mono text-white/40 mt-1">Flight / ground contact</div>
          </div>
        </div>
      </section>

      {/* Floating Bottom Workout Dock */}
      <div className="fixed bottom-20 md:bottom-4 left-0 right-0 z-40 px-4 flex justify-center pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 p-2 rounded-full bg-[#0b0d11]/90 backdrop-blur-2xl border border-white/[0.12] shadow-[0_15px_40px_rgba(0,0,0,0.8)]">
          <button
            onClick={onToggleSession}
            className={`px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 flex items-center gap-2.5 cursor-pointer shadow-lg ${
              isSessionActive
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_25px_rgba(225,29,72,0.5)] border border-rose-400/40'
                : 'bg-[#00f5d4] hover:bg-[#33ffdf] text-black shadow-[0_0_20px_rgba(0,245,212,0.4)]'
            }`}
          >
            <span className="material-symbols-outlined text-base filled">
              {isSessionActive ? 'stop_circle' : 'play_circle'}
            </span>
            {isSessionActive ? (
              <span>
                Stop Workout ({Math.floor(sessionElapsedSec / 60).toString().padStart(2, '0')}:{(sessionElapsedSec % 60).toString().padStart(2, '0')})
              </span>
            ) : (
              <span>Start Workout</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
