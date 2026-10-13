import React from 'react';
import { motion } from 'motion/react';
import { ConnectionConfig } from '../utils/connectionConfig';
import { ConnectionSettingsPanel } from './ConnectionSettingsPanel';
import { SensorState } from '../types';

interface ConnectionModalProps {
  config: ConnectionConfig;
  onSave: (cfg: ConnectionConfig) => void;
  onClose: () => void;
  sensorState: SensorState;
  onPairBLE?: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  config,
  onSave,
  onClose,
  sensorState,
  onPairBLE,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#00fbfb] text-2xl">router</span>
            <div>
              <h2 className="font-display text-lg text-white font-bold tracking-tight">Server Connection</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    sensorState.connected ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'
                  }`}
                />
                <span className="text-xs font-data-label text-white/60">
                  {sensorState.connected
                    ? `Connected (${sensorState.connectionMode.toUpperCase()})`
                    : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-3.5 bg-white/[0.03] border border-white/10 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-white/70">Hardware BLE Wearable</span>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
              sensorState.connectionMode === 'ble' && sensorState.connected
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-white/5 text-white/40'
            }`}>
              {sensorState.connectionMode === 'ble' && sensorState.connected ? 'Active BLE' : 'Not Connected'}
            </span>
          </div>

          <button
            onClick={() => {
              if (onPairBLE) onPairBLE();
            }}
            className={`w-full py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
              sensorState.connectionMode === 'ble' && sensorState.connected
                ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300'
                : 'bg-[#00f5d4]/15 hover:bg-[#00f5d4]/25 border border-[#00f5d4]/40 text-[#00f5d4] shadow-[0_0_15px_rgba(0,245,212,0.15)]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {sensorState.connectionMode === 'ble' && sensorState.connected ? 'bluetooth_disabled' : 'bluetooth'}
            </span>
            <span>
              {sensorState.connectionMode === 'ble' && sensorState.connected
                ? 'Disconnect BLE'
                : 'Scan & Connect ESP32 BLE'}
            </span>
          </button>
        </div>

        <ConnectionSettingsPanel config={config} onSave={(newCfg) => {
          onSave(newCfg);
        }} />

        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-data-label text-xs uppercase tracking-wider transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
