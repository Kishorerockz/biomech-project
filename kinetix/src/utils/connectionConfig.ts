/**
 * Connection Configuration Utility
 * Stores and retrieves server connection settings from localStorage.
 * No hardcoded IP addresses — users configure this in Settings.
 */

export interface ConnectionConfig {
  wsHost: string;   // WebSocket relay server host (IP or hostname)
  wsPort: number;   // WebSocket relay server port (default 8080)
  apiPort: number;  // REST API port (default 3001)
}

const STORAGE_KEY = 'kinetix_connection_config';

const DEFAULT_CONFIG: ConnectionConfig = {
  wsHost: '192.168.4.1',    // ESP32 AP fixed IP (always this when connected to Kinetix-WiFi)
  wsPort: 8080,
  apiPort: 3001,
};

export function getConnectionConfig(): ConnectionConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const host = typeof parsed.wsHost === 'string' && parsed.wsHost.trim() ? parsed.wsHost.trim() : DEFAULT_CONFIG.wsHost;
      return {
        // If it was saved as 'localhost', override with default IP so Android connects to PC
        wsHost: host === 'localhost' ? DEFAULT_CONFIG.wsHost : host,
        wsPort: typeof parsed.wsPort === 'number' && parsed.wsPort > 0 ? parsed.wsPort : DEFAULT_CONFIG.wsPort,
        apiPort: typeof parsed.apiPort === 'number' && parsed.apiPort > 0 ? parsed.apiPort : DEFAULT_CONFIG.apiPort,
      };
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConnectionConfig(config: ConnectionConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function getWsUrl(config?: ConnectionConfig): string {
  const c = config ?? getConnectionConfig();
  return `ws://${c.wsHost}:${c.wsPort}`;
}

export function getApiBaseUrl(config?: ConnectionConfig): string {
  const c = config ?? getConnectionConfig();
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `http://localhost:${c.apiPort}`;
  }
  return `http://${c.wsHost}:${c.apiPort}`;
}
