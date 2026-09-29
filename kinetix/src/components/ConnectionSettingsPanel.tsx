import React, { useState } from 'react';
import { ConnectionConfig } from '../utils/connectionConfig';
import { motion } from 'motion/react';

interface ConnectionSettingsPanelProps {
  config: ConnectionConfig;
  onSave: (cfg: ConnectionConfig) => void;
}

export const ConnectionSettingsPanel: React.FC<ConnectionSettingsPanelProps> = ({ config, onSave }) => {
  const [host, setHost] = useState(config.wsHost);
  const [wsPort, setWsPort] = useState(String(config.wsPort));
  const [apiPort, setApiPort] = useState(String(config.apiPort));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = () => {
    setError('');
    const wsPortNum = parseInt(wsPort, 10);
    const apiPortNum = parseInt(apiPort, 10);

    if (!host.trim()) {
      setError('Server host cannot be empty.');
      return;
    }
    if (isNaN(wsPortNum) || wsPortNum < 1 || wsPortNum > 65535) {
      setError('WebSocket port must be between 1 and 65535.');
      return;
    }
    if (isNaN(apiPortNum) || apiPortNum < 1 || apiPortNum > 65535) {
      setError('API port must be between 1 and 65535.');
      return;
    }

    onSave({ wsHost: host.trim(), wsPort: wsPortNum, apiPort: apiPortNum });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/50 leading-relaxed">
        Configure the address of the relay server running on your laptop/PC.
        When running on Android, enter your PC's local IP address (e.g. <code className="text-[#c9a050]/80 bg-white/5 px-1 rounded">192.168.1.10</code>).
      </p>

      <div className="space-y-3">
        {/* Server Host */}
        <div className="space-y-1.5">
          <label className="font-data-label text-[11px] text-white/50 uppercase tracking-wider">
            Server Host / IP Address
          </label>
          <input
            type="text"
            value={host}
            onChange={(e) => { setHost(e.target.value); setSaved(false); }}
            placeholder="e.g. 192.168.1.10 or localhost"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#c9a050]/60 focus:bg-white/8 transition-all font-mono"
          />
        </div>

        {/* Ports row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="font-data-label text-[11px] text-white/50 uppercase tracking-wider">
              WebSocket Port
            </label>
            <input
              type="number"
              value={wsPort}
              onChange={(e) => { setWsPort(e.target.value); setSaved(false); }}
              placeholder="8080"
              min={1}
              max={65535}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#c9a050]/60 transition-all font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-data-label text-[11px] text-white/50 uppercase tracking-wider">
              API Port
            </label>
            <input
              type="number"
              value={apiPort}
              onChange={(e) => { setApiPort(e.target.value); setSaved(false); }}
              placeholder="3001"
              min={1}
              max={65535}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#c9a050]/60 transition-all font-mono"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white/3 border border-white/8 rounded-xl px-4 py-2.5 space-y-1">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-data-label mb-1">Preview</p>
          <p className="text-xs font-mono text-emerald-400/80">
            WebSocket: <span className="text-white/70">ws://{host || '…'}:{wsPort || '…'}</span>
          </p>
          <p className="text-xs font-mono text-[#c9a050]/80">
            REST API: <span className="text-white/70">http://{host || '…'}:{apiPort || '…'}</span>
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">error</span>
            {error}
          </p>
        )}

        <motion.button
          onClick={handleSave}
          whileTap={{ scale: 0.97 }}
          className={`w-full py-3 rounded-xl font-data-label text-sm uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            saved
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
              : 'bg-[#c9a050] hover:bg-[#d9b060] text-black shadow-[0_0_20px_rgba(201,160,80,0.2)]'
          }`}
        >
          <span className="material-symbols-outlined text-base">
            {saved ? 'check_circle' : 'save'}
          </span>
          {saved ? 'Saved — Reconnecting…' : 'Save & Reconnect'}
        </motion.button>
      </div>
    </div>
  );
};
