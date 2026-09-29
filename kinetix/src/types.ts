export type TabType = 'live' | 'analysis' | 'history' | 'calibration' | 'profile';
export type JumpType = 'CMJ' | 'SJ' | 'DJ';

export interface JumpAttempt {
  id: number;
  timestampStr: string; // e.g. "00:15"
  jumpCm: number;
  isPeak?: boolean;
  isFatigue?: boolean;
  jumpType?: JumpType;
  eur?: number;
}

export interface JumpRecord {
  id: number;
  timestamp: string;
  hang_time: number;
  landing_impact: number;
  takeoff_expl: number;
  ground_contact_ms?: number;
  rsi?: number;
  dip_depth_cm?: number;
  rfd?: number;
  jump_type?: JumpType;
  eur?: number;
}

export interface SessionData {
  id: string;
  title: string;
  sport: string;
  date: string; // e.g. "Oct 12, 2023" or ISO
  isoDate: string;
  peakJumpCm: number;
  avgJumpCm: number;
  totalReps: number;
  durationSec: number; // e.g. 1122 (18:42)
  intensityPercent: number; // e.g. 92
  attempts: JumpAttempt[];
  timeline: { timeSec: number; jumpCm: number }[];
  jumpConsistencyCm?: number;
  jumpHeights?: number[];
}

export interface SensorOffsets {
  xOffset: number;
  yOffset: number;
  zOffset: number;
}

export type ConnectionMode = 'disconnected' | 'wifi' | 'ble';

export interface SensorState {
  connected: boolean;
  connectionMode?: ConnectionMode;
  reconnecting?: boolean;
  gyro?: { x: number; y: number; z: number };
  accel?: { x: number; y: number; z: number };
  deviceName: string;
  batteryPercent: number;
  signalDbm: number;
  ipAddress: string;
  samplingRateHz: number;
  procAccelG: number;
  lastJumpCm: number;
  maxJumpCm: number;
  totalJumps: number;
  isNewPeak: boolean;
  hangTimeMs?: number;
  landingImpactG?: number;
  takeoffAccelG?: number;
  groundContactTimeMs?: number;
  rsi?: number;
  hardwareTimestampUs?: number;
  twistDeg?: number;
  orientation?: { x: number; y: number; z: number; w: number };
  streamHz?: number;
  /** Live jump phase from the imperative JumpDetector (bypasses React batching) */
  jumpPhase?: 'GROUNDED' | 'TAKEOFF' | 'FREEFALL' | 'LANDING';
}


export interface HistoryResponse {
  sessions: any[]; // The raw JSON before mapping
  stats: {
    personalBest: number;
    targetZoneMin: number;
    targetZoneMax: number;
    fatigueThreshold: number;
  };
}

export type WearLocation = 'waist' | 'ankle' | 'arm';

export interface AthleteProfile {
  name: string;
  email?: string;
  role: string;
  primarySport: string;
  weightKg: number;
  heightCm: number;
  standingReachCm: number;
  jumpThresholdG: number;
  wearLocation?: WearLocation;
  units: 'metric' | 'imperial';
  darkMode: boolean;
  avatarUrl: string;
}
