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
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  config,
  onSave,
  onClose,
  sensorState,
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
