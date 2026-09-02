export type TabType = 'live' | 'analysis' | 'history' | 'calibration' | 'profile';

export interface JumpAttempt {
  id: number;
  timestampStr: string; // e.g. "00:15"
  jumpCm: number;
  isPeak?: boolean;
  isFatigue?: boolean;
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

export interface SensorState {
  connected: boolean;
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
  twistDeg?: number;
  swingCount?: number;
  lastSwingVelocity?: number;
  lastSwingDurationMs?: number;
  orientation?: { x: number; y: number; z: number; w: number };
  streamHz?: number;
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

export interface AthleteProfile {
  name: string;
  email?: string;
  role: string;
  primarySport: string;
  weightKg: number;
  heightCm: number;
  standingReachCm: number;
  jumpThresholdG: number;
  units: 'metric' | 'imperial';
  darkMode: boolean;
  avatarUrl: string;
}
