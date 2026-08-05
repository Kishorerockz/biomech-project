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
}

export interface SensorState {
  connected: boolean;
  reconnecting?: boolean;
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
}

export interface AthleteProfile {
  name: string;
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
