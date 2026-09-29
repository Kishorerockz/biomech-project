import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { SensorState, AthleteProfile, SensorOffsets } from '../types';
import { bleHardware } from '../utils/bluetooth';
import { ConnectionSettingsPanel } from './ConnectionSettingsPanel';
import { ConnectionConfig } from '../utils/connectionConfig';

interface CalibrationTabProps {
  sensorState: SensorState;
  setSensorState: React.Dispatch<React.SetStateAction<SensorState>>;
  athleteProfile: AthleteProfile;
  setAthleteProfile: React.Dispatch<React.SetStateAction<AthleteProfile>>;
  offsets: SensorOffsets;
  onSaveOffsets: (offsets: SensorOffsets) => void;
  registerRawSampleListener?: (callback: ((raw: { x: number; y: number; z: number }) => void) | null) => void;
  connectionConfig: ConnectionConfig;
  onSaveConnectionConfig: (cfg: ConnectionConfig) => void;
}

export const CalibrationTab: React.FC<CalibrationTabProps> = ({
  sensorState,
  setSensorState,
  athleteProfile,
  setAthleteProfile,
  offsets,
  onSaveOffsets,
  registerRawSampleListener,
  connectionConfig,
  onSaveConnectionConfig,
}) => {
  const [calibrationState, setCalibrationState] = useState<'idle' | 'calibrating' | 'success' | 'error'>('idle');
  const [samplesCount, setSamplesCount] = useState<number>(0);
  const [calibrationError, setCalibrationError] = useState<string | null>(null);
  const samplesRef = useRef<{ x: number; y: number; z: number }[]>([]);

  useEffect(() => {
    return () => {
      if (registerRawSampleListener) {
        registerRawSampleListener(null);
      }
    };
  }, [registerRawSampleListener]);

  const handleStartCalibration = () => {
    if (calibrationState !== 'idle') return;

    if (!sensorState.connected) {
      setCalibrationError('Connect wearable via BLE or Wi-Fi before zeroing.');
      return;
    }

    if (!registerRawSampleListener) {
      setCalibrationError('Live stream unavailable. Ensure hardware is streaming.');
      return;
    }

    setCalibrationError(null);
    setCalibrationState('calibrating');
    setSamplesCount(0);
    samplesRef.current = [];

    if (sensorState.connectionMode === 'ble') {
      bleHardware.sendCommand('tare').catch((err) => console.warn('BLE tare error:', err));
    }

    const TOTAL_SAMPLES = 40;

    registerRawSampleListener((sample) => {
      samplesRef.current.push(sample);
      const currentCount = samplesRef.current.length;
      setSamplesCount(currentCount);

      if (currentCount >= TOTAL_SAMPLES) {
        if (registerRawSampleListener) {
          registerRawSampleListener(null);
        }

        const collected = samplesRef.current;
        const avgX = collected.reduce((acc, s) => acc + s.x, 0) / collected.length;
        const avgY = collected.reduce((acc, s) => acc + s.y, 0) / collected.length;
        const avgZ = collected.reduce((acc, s) => acc + s.z, 0) / collected.length;

        const calculatedXOffset = Math.round(0 - avgX);
        const calculatedYOffset = Math.round(0 - avgY);
        const target1gLsb = 4096;
        const calculatedZOffset = Math.round(target1gLsb - avgZ);

        const newOffsets: SensorOffsets = {
          xOffset: Math.abs(calculatedXOffset) < 1500 ? calculatedXOffset : 0,
          yOffset: Math.abs(calculatedYOffset) < 1500 ? calculatedYOffset : 0,
          zOffset: Math.abs(calculatedZOffset) < 1500 ? calculatedZOffset : 0,
        };

        onSaveOffsets(newOffsets);
        setCalibrationState('success');

        setTimeout(() => {
          setCalibrationState('idle');
          setSamplesCount(0);
        }, 1200);
      }
    });
  };

  const handleSliderChange = (val: number) => {
    setAthleteProfile((prev) => ({
      ...prev,
      jumpThresholdG: parseFloat(val.toFixed(2)),
    }));
  };

  const sliderPercent = ((athleteProfile.jumpThresholdG - 1.0) / (2.5 - 1.0)) * 100;
  const progressPercent = Math.min(100, Math.round((samplesCount / 40) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="pt-20 md:pt-24 px-4 md:px-8 max-w-5xl mx-auto space-y-6 pb-32"
    >
      {/* Header */}
      <div>
        <h1 className="font-display-metrics text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[#00f5d4] text-2xl">tune</span>
          <span>HARDWARE &amp; CALIBRATION</span>
        </h1>
        <p className="text-xs text-white/50 mt-1 font-mono">
          Zero-G accelerometer offset calibration, sensor placement, and sensitivity tuning.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left Column (Hardware Status & Zero-G Tare) */}
        <div className="md:col-span-6 flex flex-col gap-5">
          {/* Hardware Diagnostic Card */}
          <div className="rounded-3xl bg-[#121620]/80 border border-white/[0.08] backdrop-blur-xl p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-display-metrics text-lg font-bold text-white">
                  {sensorState.deviceName || 'ESP32 Sensor Unit'}
                </h2>
                <div className="flex items-center gap-2 mt-1 text-xs font-mono">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      sensorState.connected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-red-400'
                    }`}
                  />
                  <span className={sensorState.connected ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
                    {sensorState.connected ? 'Online (100Hz Active)' : 'Disconnected'}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#00f5d4]">
                <span className="material-symbols-outlined text-xl">sensors</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/[0.06]">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <span className="text-[10px] font-mono text-white/40 uppercase">BATTERY</span>
                <div className="flex items-center gap-1.5 mt-0.5 text-sm font-mono text-white font-bold">
                  <span className="material-symbols-outlined text-sm text-emerald-400">
                    {sensorState.batteryPercent > 70 ? 'battery_full' : 'battery_5_bar'}
                  </span>
                  <span>{sensorState.batteryPercent || 100}%</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <span className="text-[10px] font-mono text-white/40 uppercase">LINK SIGNAL</span>
                <div className="flex items-center gap-1.5 mt-0.5 text-sm font-mono text-white font-bold">
                  <span className="material-symbols-outlined text-sm text-[#00f5d4]">signal_cellular_alt</span>
                  <span>{sensorState.signalDbm || -55} dBm</span>
                </div>
              </div>
            </div>

            {calibrationError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-xs text-red-300 font-mono">
                <span className="material-symbols-outlined text-base">error_outline</span>
                <span>{calibrationError}</span>
              </div>
            )}
          </div>

          {/* Zero-G Calibration Tare Card */}
          <div className="rounded-3xl bg-[#121620]/80 border border-white/[0.08] backdrop-blur-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00f5d4]">balance</span>
                <h3 className="font-display-metrics text-base font-bold text-white">
                  Zero-G Hardware Tare
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#00f5d4]/10 text-[#00f5d4] border border-[#00f5d4]/30 font-semibold uppercase">
                Fast Tare (400ms)
              </span>
            </div>

            <p className="text-xs text-white/60 leading-relaxed">
              Place the wearable flat and motionless on a level surface. The system captures 40 samples to zero accelerometer offsets.
            </p>

            {calibrationState === 'calibrating' && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-white/60">
                  <span>Sampling Live Baseline ({samplesCount}/40)</span>
                  <span className="text-[#00f5d4] font-bold">{progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#00f5d4] to-emerald-400 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Active Offsets */}
            <div className="grid grid-cols-3 gap-2 bg-[#090b0f] border border-white/[0.06] rounded-2xl p-3 text-center">
              <div>
                <span className="text-[10px] font-mono text-white/40 uppercase">X Offset</span>
                <div className="font-mono text-xs font-bold text-[#00f5d4] mt-0.5">
                  {offsets.xOffset >= 0 ? `+${offsets.xOffset}` : offsets.xOffset}
                </div>
              </div>
              <div className="border-x border-white/[0.08]">
                <span className="text-[10px] font-mono text-white/40 uppercase">Y Offset</span>
                <div className="font-mono text-xs font-bold text-[#00f5d4] mt-0.5">
                  {offsets.yOffset >= 0 ? `+${offsets.yOffset}` : offsets.yOffset}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-mono text-white/40 uppercase">Z Offset</span>
                <div className="font-mono text-xs font-bold text-amber-400 mt-0.5">
                  {offsets.zOffset >= 0 ? `+${offsets.zOffset}` : offsets.zOffset}
                </div>
              </div>
            </div>

            <button
              onClick={handleStartCalibration}
              disabled={calibrationState !== 'idle'}
              className={`w-full py-3.5 px-6 rounded-full font-display-metrics text-xs font-bold transition-all active:scale-95 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg ${
                calibrationState === 'calibrating'
                  ? 'bg-amber-400 text-black'
                  : calibrationState === 'success'
                  ? 'bg-emerald-400 text-black'
                  : 'bg-[#00f5d4] hover:bg-[#33ffdf] text-black shadow-[0_0_20px_rgba(0,245,212,0.3)]'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {calibrationState === 'calibrating'
                  ? 'sync'
                  : calibrationState === 'success'
                  ? 'check_circle'
                  : 'play_arrow'}
              </span>
              <span>
                {calibrationState === 'calibrating'
                  ? `Calibrating (${samplesCount}/40)...`
                  : calibrationState === 'success'
                  ? 'Calibrated Successfully!'
                  : 'Start Zero-G Calibration'}
              </span>
            </button>
          </div>
        </div>

        {/* Right Column (Placement & Sensitivity) */}
        <div className="md:col-span-6 flex flex-col gap-5">
          {/* Wear Placement Card */}
          <div className="rounded-3xl bg-[#121620]/80 border border-white/[0.08] backdrop-blur-xl p-6 space-y-4">
            <h3 className="font-display-metrics text-base font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00f5d4]">accessibility_new</span>
              <span>Sensor Placement Preset</span>
            </h3>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'waist', label: 'Waist (CoM)', score: '98%', icon: 'accessibility_new', desc: 'Optimal CoM' },
                { id: 'ankle', label: 'Ankle / Foot', score: '85%', icon: 'directions_walk', desc: 'Direct Flight' },
                { id: 'arm', label: 'Arm / Wrist', score: '55%', icon: 'pan_tool', desc: 'High Noise' },
              ].map((loc) => {
                const isSelected = (athleteProfile.wearLocation || 'waist') === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() =>
                      setAthleteProfile((prev) => ({
                        ...prev,
                        wearLocation: loc.id as any,
                      }))
                    }
                    className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#00f5d4]/15 border-[#00f5d4] text-white shadow-[0_0_15px_rgba(0,245,212,0.25)]'
                        : 'bg-white/[0.02] border-white/10 text-white/50 hover:border-white/20'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-xl ${isSelected ? 'text-[#00f5d4]' : 'text-white/40'}`}>
                      {loc.icon}
                    </span>
                    <span className="text-xs font-semibold">{loc.label}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      loc.id === 'waist' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'bg-white/10 text-white/60'
                    }`}>
                      {loc.score} Acc.
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-white/50 leading-relaxed font-mono">
              {(athleteProfile.wearLocation || 'waist') === 'waist' && '🏆 Recommended: Fastened securely at trunk center of mass (sacrum). Free of limb swing artifacts.'}
              {athleteProfile.wearLocation === 'ankle' && '⚠️ Measures pure foot hang time. Cushion landing with knees straight to avoid hang time overestimation.'}
              {athleteProfile.wearLocation === 'arm' && '⚠️ High swing dynamics. Gyro compensation enabled; keep arm swings consistent.'}
            </p>
          </div>

          {/* Jump Detection Sensitivity Slider */}
          <div className="rounded-3xl bg-[#121620]/80 border border-white/[0.08] backdrop-blur-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-display-metrics text-base font-bold text-white block">
                  Jump Takeoff Sensitivity
                </span>
                <span className="text-[11px] font-mono text-white/40">
                  Acceleration threshold to initiate jump tracking
                </span>
              </div>
              <span className="font-mono text-lg font-bold text-[#00f5d4] bg-[#00f5d4]/10 border border-[#00f5d4]/30 px-3 py-1 rounded-xl">
                {athleteProfile.jumpThresholdG.toFixed(2)} g
              </span>
            </div>

            <div className="relative w-full h-8 flex items-center">
              <div className="slider-track absolute w-full z-0 bg-white/10 h-1.5 rounded-full" />
              <input
                type="range"
                min="1.0"
                max="2.5"
                step="0.05"
                value={athleteProfile.jumpThresholdG}
                onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
                className="w-full absolute z-10 opacity-0 cursor-pointer h-full"
              />
              <div
                className="w-5 h-5 bg-[#00f5d4] rounded-full absolute z-0 pointer-events-none transform -translate-x-1/2 shadow-[0_0_12px_#00f5d4]"
                style={{ left: `${sliderPercent}%` }}
              />
            </div>

            <div className="flex justify-between w-full text-xs font-mono text-white/40">
              <span>1.00g (High Sensitivity)</span>
              <span>1.25g (Default)</span>
              <span>2.50g (Strict)</span>
            </div>
          </div>

          {/* Server Connection Settings */}
          <div className="rounded-3xl bg-[#121620]/80 border border-white/[0.08] backdrop-blur-xl p-6 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-white/50 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-[#00f5d4]">wifi</span>
              <span>Local Network Host</span>
            </h3>
            <ConnectionSettingsPanel
              config={connectionConfig}
              onSave={onSaveConnectionConfig}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
