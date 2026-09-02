import React, { useState } from 'react';
import { motion } from 'motion/react';
import { SensorState, AthleteProfile } from '../types';
import { bleHardware } from '../utils/bluetooth';

interface CalibrationTabProps {
  sensorState: SensorState;
  setSensorState: React.Dispatch<React.SetStateAction<SensorState>>;
  athleteProfile: AthleteProfile;
  setAthleteProfile: React.Dispatch<React.SetStateAction<AthleteProfile>>;
}

export const CalibrationTab: React.FC<CalibrationTabProps> = ({
  sensorState,
  setSensorState,
  athleteProfile,
  setAthleteProfile,
}) => {
  const [calibrationState, setCalibrationState] = useState<'idle' | 'calibrating' | 'success'>(
    'idle'
  );
  const [bleError, setBleError] = useState<string | null>(null);

  const handleConnectBLE = async () => {
    setBleError(null);
    await bleHardware.requestBLEDevice(
      (accelG) => {
        setSensorState((prev) => ({ ...prev, procAccelG: accelG }));
      },
      (status) => {
        if (status.error) {
          setBleError(status.error);
        } else if (status.connected && status.deviceName) {
          setSensorState((prev) => ({
            ...prev,
            connected: true,
            deviceName: status.deviceName || 'ESP32 BLE Node',
          }));
        }
      }
    );
  };

  const handleCalibrate = () => {
    if (calibrationState !== 'idle') return;

    setCalibrationState('calibrating');

    setTimeout(() => {
      setCalibrationState('success');
      setSensorState((prev) => ({
        ...prev,
        procAccelG: 1.0,
      }));

      setTimeout(() => {
        setCalibrationState('idle');
      }, 2500);
    }, 3000);
  };

  const handleSliderChange = (val: number) => {
    setAthleteProfile((prev) => ({
      ...prev,
      jumpThresholdG: parseFloat(val.toFixed(2)),
    }));
  };

  // Slider visual thumb calculation percentage
  const sliderPercent =
    ((athleteProfile.jumpThresholdG - 1.0) / (3.0 - 1.0)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="pt-20 md:pt-24 px-5 md:px-10 max-w-4xl mx-auto space-y-6 pb-28"
    >
      {/* Page Header */}
      <div className="mb-2">
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-2xl md:text-3xl font-bold text-[#c9a050] uppercase tracking-widest">
          HARDWARE &amp; PROFILE
        </h1>
        <p className="font-data-label text-xs text-white/50 mt-1">
          Zero-G accelerometer tuning and ESP32 hardware diagnostics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column (Hardware & Calibration) */}
        <div className="md:col-span-6 flex flex-col gap-6">
          {/* Sensor Status Card */}
          <div className="card-container p-6 flex flex-col gap-4 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-headline-md text-xl text-white font-bold mb-1">
                  {sensorState.deviceName}
                </h2>
                <p className="font-data-label text-xs text-white/50 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full inline-block ${
                      sensorState.connected ? 'bg-[#00ff7f] pulse-dot-green' : 'bg-red-500'
                    }`}
                  />
                  {sensorState.connected ? 'Connected' : 'Disconnected'}
                </p>
              </div>
              <span className="material-symbols-outlined text-[#c9a050] text-2xl">
                wifi_tethering
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="flex flex-col gap-1">
                <span className="font-data-label text-xs text-white/50 uppercase tracking-wider">BATTERY</span>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#c9a050] text-base">
                    battery_5_bar
                  </span>
                  <span className="font-data-value text-base text-white">
                    {sensorState.batteryPercent}%
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-data-label text-xs text-white/50 uppercase tracking-wider">SIGNAL</span>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#c9a050] text-base">
                    signal_cellular_alt
                  </span>
                  <span className="font-data-value text-base text-white">
                    {sensorState.signalDbm}dBm
                  </span>
                </div>
              </div>

              <div className="col-span-2 flex flex-col gap-1 mt-1">
                <span className="font-data-label text-xs text-white/50 uppercase tracking-wider">IP ADDRESS</span>
                <span className="font-data-value text-base text-white">
                  {sensorState.ipAddress}
                </span>
              </div>
            </div>

            {/* Bluetooth LE Direct Scan & Pair Button */}
            <div className="mt-2 border-t border-white/10 pt-4 flex flex-col gap-2">
              <button
                onClick={handleConnectBLE}
                className="w-full py-2.5 px-4 bg-white/10 hover:bg-[#c9a050] hover:text-black text-[#c9a050] border border-[#c9a050]/40 rounded-full font-data-label text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <span className="material-symbols-outlined text-base">bluetooth_searching</span>
                Pair Bluetooth LE Hardware (ESP32)
              </button>

              {bleError && (
                <p className="font-data-label text-[11px] text-amber-400 bg-amber-400/10 p-2 rounded-xl border border-amber-400/20">
                  {bleError}
                </p>
              )}
            </div>
          </div>

          {/* Zero-G Calibration Section */}
          <div className="card-container p-6 flex flex-col gap-4 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#c9a050]">warning</span>
              <h3 className="font-headline-md text-xl text-white font-bold">
                Zero-G Calibration
              </h3>
            </div>
            <p className="font-body-sm text-sm text-white/60">
              Place sensor on a flat, stable surface before initiating calibration sequence.
            </p>

            <button
              onClick={handleCalibrate}
              disabled={calibrationState !== 'idle'}
              className={`w-full py-3 px-6 mt-2 flex justify-center items-center gap-2 rounded-full font-data-label text-sm font-bold transition-all active:scale-95 cursor-pointer uppercase tracking-[0.2em] ${
                calibrationState === 'calibrating'
                  ? 'bg-[#c9a050]/80 text-black animate-pulse'
                  : calibrationState === 'success'
                  ? 'bg-emerald-500 text-black'
                  : 'bg-[#c9a050] text-black hover:bg-[#d9b060]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {calibrationState === 'calibrating'
                  ? 'sync'
                  : calibrationState === 'success'
                  ? 'check_circle'
                  : 'precision_manufacturing'}
              </span>
              <span>
                {calibrationState === 'calibrating'
                  ? 'Calibrating MPU-6050...'
                  : calibrationState === 'success'
                  ? 'Success!'
                  : 'Calibrate Accelerometer'}
              </span>
            </button>
          </div>
        </div>

        {/* Right Column (Profile Parameters & Motion Sensitivity) */}
        <div className="md:col-span-6 flex flex-col gap-6">
          {/* Athlete Parameters Form */}
          <div className="card-container p-6 flex flex-col gap-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl">
            <h3 className="font-headline-md text-xl text-white font-bold flex items-center gap-2 border-b border-white/10 pb-3">
              <span className="material-symbols-outlined text-[#c9a050]">person</span>
              Athlete Parameters
            </h3>

            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="font-data-label text-xs text-white/50 uppercase tracking-wider">ATHLETE WEIGHT (KG)</span>
                <input
                  type="number"
                  step="0.1"
                  value={athleteProfile.weightKg}
                  onChange={(e) =>
                    setAthleteProfile((prev) => ({
                      ...prev,
                      weightKg: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2.5 font-data-value text-base text-white focus:outline-none focus:border-[#c9a050]"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-data-label text-xs text-white/50 uppercase tracking-wider">HEIGHT (CM)</span>
                <input
                  type="number"
                  step="0.5"
                  value={athleteProfile.heightCm}
                  onChange={(e) =>
                    setAthleteProfile((prev) => ({
                      ...prev,
                      heightCm: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2.5 font-data-value text-base text-white focus:outline-none focus:border-[#c9a050]"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-data-label text-xs text-white/50 uppercase tracking-wider">STANDING REACH (CM)</span>
                <input
                  type="number"
                  step="0.5"
                  value={athleteProfile.standingReachCm}
                  onChange={(e) =>
                    setAthleteProfile((prev) => ({
                      ...prev,
                      standingReachCm: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2.5 font-data-value text-base text-white focus:outline-none focus:border-[#c9a050]"
                />
              </label>
            </div>
          </div>

          {/* Motion Sensitivity Slider */}
          <div className="card-container p-6 flex flex-col gap-4 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl">
            <div className="flex justify-between items-center">
              <span className="font-data-label text-xs text-white/50 uppercase tracking-wider">
                JUMP DETECTION THRESHOLD (G)
              </span>
              <span className="font-data-value text-base text-[#c9a050]">
                {athleteProfile.jumpThresholdG.toFixed(2)}
              </span>
            </div>

            <div className="relative w-full h-8 flex items-center">
              <div className="slider-track absolute w-full z-0 bg-white/10 h-1 rounded-full" />
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.05"
                value={athleteProfile.jumpThresholdG}
                onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
                className="w-full absolute z-10 opacity-0 cursor-pointer h-full"
              />
              <div
                className="w-4 h-4 bg-[#c9a050] rounded-full absolute z-0 pointer-events-none transform -translate-x-1/2 shadow-[0_0_0_4px_rgba(201,160,80,0.3)]"
                style={{ left: `${sliderPercent}%` }}
              />
            </div>

            <div className="flex justify-between w-full text-xs font-data-label text-white/40">
              <span>1.0 G</span>
              <span>3.0 G</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
