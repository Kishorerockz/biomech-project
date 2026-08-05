import { AthleteProfile, SensorState, SessionData } from './types';

export const INITIAL_ATHLETE_PROFILE: AthleteProfile = {
  name: 'ELITE ATHLETE',
  role: 'Volleyball Athlete',
  primarySport: 'Volleyball',
  weightKg: 88.2,
  heightCm: 198.5,
  standingReachCm: 256.0,
  jumpThresholdG: 1.50,
  units: 'metric',
  darkMode: true,
  avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCgFHQZNM6kf_6-aU-4k0CUCrAJXv_rCcoFV2EGsRRZDX5yAHA-aovjmXQsxbF0sY6MkSrl19QxtBX1YYmDsmkYRmRHJLckKdNOs_fFgtRb55F49D8DF-JZKB6blE3b0tNdh_e5hZm5UqCHxljeA7EvHk4HEmNP-PFaKP5QHbhGIKoS11QMFFthNYve_Fe2R2L_iyjIm6odEidCDar6Lj68fPnoQjaZw5yjgfhjhJ1W4qJekbnYPxofCQ',
};

export const INITIAL_SENSOR_STATE: SensorState = {
  connected: true,
  reconnecting: false,
  deviceName: 'ESP32 Sensor Unit',
  batteryPercent: 88,
  signalDbm: -52,
  ipAddress: '192.168.1.142',
  samplingRateHz: 10,
  procAccelG: 1.3,
  lastJumpCm: 44.3,
  maxJumpCm: 46.0,
  totalJumps: 26,
  isNewPeak: true,
};

export const HISTORICAL_SESSIONS: SessionData[] = [
  {
    id: 'session-1',
    title: 'Volleyball Scrimmage',
    sport: 'Volleyball',
    date: 'Oct 12, 2023',
    isoDate: '2023-10-12',
    peakJumpCm: 45.2,
    avgJumpCm: 39.4,
    totalReps: 32,
    durationSec: 1320, // 22:00
    intensityPercent: 89,
    attempts: [
      { id: 1, timestampStr: '00:15', jumpCm: 42.0 },
      { id: 2, timestampStr: '01:30', jumpCm: 44.1 },
      { id: 3, timestampStr: '03:10', jumpCm: 45.2, isPeak: true },
      { id: 4, timestampStr: '05:45', jumpCm: 41.5 },
      { id: 5, timestampStr: '08:20', jumpCm: 38.0 },
      { id: 6, timestampStr: '12:10', jumpCm: 35.5, isFatigue: true },
    ],
    timeline: [
      { timeSec: 0, jumpCm: 40 },
      { timeSec: 300, jumpCm: 45.2 },
      { timeSec: 600, jumpCm: 42.0 },
      { timeSec: 900, jumpCm: 38.5 },
      { timeSec: 1200, jumpCm: 35.5 },
    ]
  },
  {
    id: 'session-2',
    title: 'Track Drills',
    sport: 'Sprints',
    date: 'Oct 09, 2023',
    isoDate: '2023-10-09',
    peakJumpCm: 42.8,
    avgJumpCm: 37.1,
    totalReps: 45,
    durationSec: 1800, // 30:00
    intensityPercent: 82,
    attempts: [
      { id: 1, timestampStr: '00:20', jumpCm: 39.5 },
      { id: 2, timestampStr: '02:15', jumpCm: 42.8, isPeak: true },
      { id: 3, timestampStr: '04:30', jumpCm: 41.0 },
      { id: 4, timestampStr: '10:00', jumpCm: 36.2 },
      { id: 5, timestampStr: '18:30', jumpCm: 33.0, isFatigue: true },
    ],
    timeline: [
      { timeSec: 0, jumpCm: 38 },
      { timeSec: 400, jumpCm: 42.8 },
      { timeSec: 800, jumpCm: 39.0 },
      { timeSec: 1200, jumpCm: 36.0 },
      { timeSec: 1600, jumpCm: 33.0 },
    ]
  },
  {
    id: 'session-3',
    title: 'Match Day Test',
    sport: 'Volleyball',
    date: 'Sep 28, 2023',
    isoDate: '2023-09-28',
    peakJumpCm: 48.5,
    avgJumpCm: 42.1,
    totalReps: 28,
    durationSec: 1122, // 18:42
    intensityPercent: 92,
    attempts: [
      { id: 1, timestampStr: '00:15', jumpCm: 45.0 },
      { id: 2, timestampStr: '01:30', jumpCm: 46.0 },
      { id: 3, timestampStr: '03:10', jumpCm: 48.5, isPeak: true },
      { id: 4, timestampStr: '05:45', jumpCm: 42.0 },
      { id: 5, timestampStr: '08:20', jumpCm: 40.0 },
      { id: 6, timestampStr: '18:40', jumpCm: 32.0, isFatigue: true },
    ],
    timeline: [
      { timeSec: 0, jumpCm: 42 },
      { timeSec: 250, jumpCm: 48.5 },
      { timeSec: 500, jumpCm: 44.0 },
      { timeSec: 750, jumpCm: 39.0 },
      { timeSec: 1000, jumpCm: 32.0 },
    ]
  },
  {
    id: 'session-4',
    title: 'Cricket Bound & Jump Session',
    sport: 'Cricket',
    date: 'Sep 15, 2023',
    isoDate: '2023-09-15',
    peakJumpCm: 41.2,
    avgJumpCm: 36.8,
    totalReps: 20,
    durationSec: 900,
    intensityPercent: 78,
    attempts: [
      { id: 1, timestampStr: '00:10', jumpCm: 38.0 },
      { id: 2, timestampStr: '01:40', jumpCm: 41.2, isPeak: true },
      { id: 3, timestampStr: '04:10', jumpCm: 37.0 },
    ],
    timeline: [
      { timeSec: 0, jumpCm: 37 },
      { timeSec: 300, jumpCm: 41.2 },
      { timeSec: 600, jumpCm: 36.0 },
    ]
  }
];

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatMetricHeight(cm: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    const inches = cm / 2.54;
    return `${inches.toFixed(1)} in`;
  }
  return `${cm.toFixed(1)} cm`;
}

export function formatMetricWeight(kg: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    const lbs = kg * 2.20462;
    return `${lbs.toFixed(1)} lbs`;
  }
  return `${kg.toFixed(1)} kg`;
}
