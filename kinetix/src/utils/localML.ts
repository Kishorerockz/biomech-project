export type LocalJumpType = 'CMJ' | 'SJ' | 'DJ' | 'Unknown';

export interface LocalJumpMetrics {
  heightCm: number;
  hangTimeMs: number;
  takeoffAccelG: number;
  landingImpactG: number;
}

export interface LocalFatigueResult {
  fatigueScore: number;
  trend: 'insufficient_data' | 'stable' | 'mild_decline' | 'moderate_decline' | 'high_fatigue';
  recommendation: string;
  declinePercent: number;
  totalJumps: number;
}

export function classifyLocalJump(metrics: LocalJumpMetrics) {
  const { hangTimeMs, takeoffAccelG, landingImpactG } = metrics;
  const scores = hangTimeMs < 220 && landingImpactG > 3
    ? { CMJ: 10, SJ: 10, DJ: 80 }
    : takeoffAccelG > 2.2
      ? { CMJ: 75, SJ: 15, DJ: 10 }
      : { CMJ: 15, SJ: 75, DJ: 10 };
  const ranked = (Object.keys(scores) as Array<'CMJ' | 'SJ' | 'DJ'>)
    .sort((left, right) => scores[right] - scores[left]);
  const best = ranked[0];
  const second = ranked[1];
  const confidence = scores[best];
  const jumpType: LocalJumpType = confidence >= 60 && confidence - scores[second] >= 10 ? best : 'Unknown';

  return { jumpType, confidence, scores };
}

export function computeLocalExplosiveScore(metrics: LocalJumpMetrics) {
  const heightScore = Math.max(0, Math.min(100, metrics.heightCm / 80 * 100));
  const takeoffScore = Math.max(0, Math.min(100, (metrics.takeoffAccelG - 1) / 3 * 100));
  const hangScore = Math.max(0, Math.min(100, (metrics.hangTimeMs - 100) / 600 * 100));
  return Math.round(heightScore * 0.5 + takeoffScore * 0.3 + hangScore * 0.2);
}

export function predictLocalFatigue(jumps: LocalJumpMetrics[]): LocalFatigueResult {
  const recent = jumps.slice(-8);
  if (recent.length < 5) {
    return {
      fatigueScore: 0,
      trend: 'insufficient_data',
      recommendation: 'Need 5 valid jumps for fatigue analysis.',
      declinePercent: 0,
      totalJumps: jumps.length,
    };
  }

  const midpoint = Math.ceil(recent.length / 2);
  const first = recent.slice(0, midpoint);
  const last = recent.slice(midpoint);
  const firstAverage = first.reduce((sum, jump) => sum + jump.heightCm, 0) / first.length;
  const lastAverage = last.reduce((sum, jump) => sum + jump.heightCm, 0) / last.length;
  const declinePercent = firstAverage > 0
    ? Math.max(0, ((firstAverage - lastAverage) / firstAverage) * 100)
    : 0;
  const fatigueScore = Math.min(1, declinePercent * 0.03);
  const trend = fatigueScore < 0.2
    ? 'stable'
    : fatigueScore < 0.45
      ? 'mild_decline'
      : fatigueScore < 0.7 ? 'moderate_decline' : 'high_fatigue';

  return {
    fatigueScore,
    trend,
    recommendation: trend === 'stable'
      ? 'Performance is stable. Keep monitoring form.'
      : 'Performance is declining. Consider a short rest before more jumps.',
    declinePercent: Math.round(declinePercent * 10) / 10,
    totalJumps: jumps.length,
  };
}
