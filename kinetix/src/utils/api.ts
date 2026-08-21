import { SessionData } from '../types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export async function fetchSessionHistory(athleteId: string): Promise<SessionData[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/sessions/history/${athleteId}`);
    if (!res.ok) throw new Error('Failed to fetch history');
    const dbSessions = await res.json();
    
    return dbSessions.map((s: any) => {
      const dateObj = new Date(s.startTime);
      const durationSec = s.endTime 
        ? Math.round((new Date(s.endTime).getTime() - dateObj.getTime()) / 1000)
        : Math.round(s.totalSamples / 10) || 60;

      // Approximate a "peak jump CM" from peakAccelerationG for UI compatibility
      // Or just map it as a raw metric
      const mockPeakCm = ((s.peakAccelerationG || 1.5) - 1) * 20 + 20;

      return {
        id: s.sessionId,
        title: `${s.sessionType} Session`,
        sport: s.sessionType.charAt(0).toUpperCase() + s.sessionType.slice(1),
        date: dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        isoDate: dateObj.toISOString().split('T')[0],
        peakJumpCm: Number(mockPeakCm.toFixed(1)),
        avgJumpCm: Number((mockPeakCm * 0.85).toFixed(1)),
        totalReps: Math.max(1, Math.floor(s.totalSamples / 150)),
        durationSec,
        intensityPercent: Math.min(100, Math.max(10, Math.round(s.avgAccelerationG * 40))),
        attempts: [
          { id: 1, timestampStr: '00:05', jumpCm: mockPeakCm, isPeak: true, isFatigue: false },
          ...(s.totalSamples > 100 ? [{ id: 2, timestampStr: '00:15', jumpCm: Number((mockPeakCm * 0.9).toFixed(1)), isPeak: false, isFatigue: false }] : [])
        ],
        timeline: []
      } as SessionData;
    });
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function fetchSessionTelemetry(sessionId: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/telemetry`);
    if (!res.ok) throw new Error('Failed to fetch telemetry');
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}
