/**
 * MLInsightsCard.tsx
 * ─────────────────────────────────────────────────────────────
 * Real-time ML Insights panel.
 * Displays live jump classification, fatigue score, and
 * explosive power — all powered by the backend brain.js model.
 * ─────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState } from 'react';
import { io as connectIO, Socket } from 'socket.io-client';
import { getBackendUrl } from '../utils/connectionConfig';
import { SensorState, SessionData } from '../types';
import { classifyLocalJump, computeLocalExplosiveScore, LocalJumpMetrics, predictLocalFatigue } from '../utils/localML';

interface MLInsight {
  sessionId?: string;
  jumpType: 'CMJ' | 'SJ' | 'DJ' | 'Unknown';
  confidence: number;
  scores: { CMJ: number; SJ: number; DJ: number };
  explosiveScore: number;
  fatigue: {
    fatigueScore: number;
    trend: string;
    recommendation: string;
    declinePercent: number;
    totalJumps?: number;
  };
  timestamp: number;
}

interface Props {
  sessionId?: string;
  sensorState: SensorState;
  currentSession?: SessionData;
}

const JUMP_TYPE_INFO: Record<string, { label: string; color: string; desc: string; emoji: string }> = {
  CMJ: {
    label: 'Countermovement Jump',
    color: '#6366f1',
    desc: 'Explosive push with pre-stretch dip',
    emoji: '⚡',
  },
  SJ: {
    label: 'Squat Jump',
    color: '#10b981',
    desc: 'Static start, no countermovement',
    emoji: '🏋️',
  },
  DJ: {
    label: 'Drop Jump',
    color: '#f59e0b',
    desc: 'Reactive rebound jump',
    emoji: '🎯',
  },
  Unknown: {
    label: 'Analysing…',
    color: '#6b7280',
    desc: 'Collecting jump data',
    emoji: '🔍',
  },
};

const FATIGUE_COLOR = (score: number) => {
  if (score < 0.2) return '#10b981'; // green
  if (score < 0.45) return '#f59e0b'; // amber
  if (score < 0.7) return '#f97316'; // orange
  return '#ef4444'; // red
};

const FATIGUE_LABEL = (trend: string) => {
  switch (trend) {
    case 'stable': return 'Fresh';
    case 'mild_decline': return 'Mild Fatigue';
    case 'moderate_decline': return 'Moderate Fatigue';
    case 'high_fatigue': return 'High Fatigue!';
    default: return 'Analysing…';
  }
};

export const MLInsightsCard: React.FC<Props> = ({ sessionId, sensorState, currentSession }) => {
  const [insight, setInsight] = useState<MLInsight | null>(null);
  const [isConnected, setIsConnected] = useState(false);
    const [jumpCount, setJumpCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const url = getBackendUrl();
    if (!url) return;

    const socket = connectIO(url, { transports: ['websocket'], reconnectionDelay: 2000 });
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('ml_insight', (data: MLInsight) => {
      if (!sessionId || data.sessionId === sessionId) {
        setInsight(data);
        setJumpCount(data.fatigue?.totalJumps ?? 0);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  // Keep the card useful on BLE/offline deployments. Backend brain.js results
  // replace this fallback automatically when the socket sends ml_insight.
  useEffect(() => {
    if (!sensorState.totalJumps || !sensorState.lastJumpCm) return;

    const height = sensorState.lastJumpCm;
    const hangTime = sensorState.hangTimeMs || Math.round(Math.sqrt(height / 122.625) * 1000);
    const takeoff = sensorState.takeoffAccelG || 1;
    const landing = sensorState.landingImpactG || 1;
    const currentJump: LocalJumpMetrics = {
      heightCm: height,
      hangTimeMs: hangTime,
      takeoffAccelG: takeoff,
      landingImpactG: landing,
    };
    const jumps = (currentSession?.attempts || []).map((attempt) => ({
      heightCm: attempt.jumpCm,
      hangTimeMs: hangTime,
      takeoffAccelG: takeoff,
      landingImpactG: landing,
    }));
    if (jumps[jumps.length - 1]?.heightCm !== height) jumps.push(currentJump);
    const classification = classifyLocalJump(currentJump);
    const fatigue = predictLocalFatigue(jumps);

    setInsight({
      sessionId,
      jumpType: classification.jumpType,
      confidence: classification.confidence,
      scores: classification.scores,
      explosiveScore: computeLocalExplosiveScore(currentJump),
      fatigue: {
        fatigueScore: fatigue.fatigueScore,
        trend: fatigue.trend,
        recommendation: fatigue.recommendation,
        declinePercent: fatigue.declinePercent,
        totalJumps: Math.max(sensorState.totalJumps, fatigue.totalJumps),
      },
      timestamp: Date.now(),
    });
    setJumpCount(Math.max(sensorState.totalJumps, fatigue.totalJumps));
  }, [sensorState.totalJumps, sensorState.lastJumpCm, sensorState.hangTimeMs, sensorState.takeoffAccelG, sensorState.landingImpactG, currentSession, sessionId]);

  const info = insight ? JUMP_TYPE_INFO[insight.jumpType] ?? JUMP_TYPE_INFO.Unknown : JUMP_TYPE_INFO.Unknown;
  const fatigueColor = insight ? FATIGUE_COLOR(insight.fatigue.fatigueScore) : '#6b7280';
  const fatiguePercent = insight ? Math.round(insight.fatigue.fatigueScore * 100) : 0;
  const explosiveScore = insight?.explosiveScore ?? 0;
  const signalQuality = sensorState.jumpQuality?.signalQuality;
  const hasPoorSignal = signalQuality === 'poor';
  const statusLabel = hasPoorSignal ? 'LOW SIGNAL' : isConnected ? 'LIVE' : insight ? 'LOCAL' : 'Offline';
  const statusColor = hasPoorSignal ? '#f59e0b' : isConnected ? '#00f5d4' : '#ef4444';

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(16, 21, 30, 0.98) 0%, rgba(12, 16, 23, 0.98) 100%)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '18px',
      padding: '18px 18px 14px',
      marginBottom: '16px',
      backdropFilter: 'blur(18px)',
      boxShadow: '0 16px 36px rgba(0,0,0,0.25)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 160, height: 160,
        background: 'radial-gradient(circle, rgba(0,245,212,0.08) 0%, transparent 68%)',
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px', filter: 'drop-shadow(0 0 8px rgba(125,211,252,0.3))' }}>🤖</span>
          <span style={{ color: '#edf2ff', fontWeight: 700, fontSize: '15px', letterSpacing: '0.2px' }}>ML Insights</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: hasPoorSignal ? 'rgba(245,158,11,0.12)' : isConnected ? 'rgba(0,245,212,0.08)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${statusColor}44`,
          borderRadius: '999px', padding: '4px 10px',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: statusColor,
            boxShadow: hasPoorSignal ? '0 0 8px rgba(245,158,11,0.7)' : isConnected ? '0 0 8px rgba(0,245,212,0.9)' : '0 0 8px rgba(239,68,68,0.6)',
          }} />
          <span style={{ color: statusColor, fontSize: '11px', fontWeight: 600 }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {sensorState.jumpQuality && (
        <div style={{
          color: hasPoorSignal ? '#fbbf24' : '#7f8aa4',
          fontSize: '10px',
          margin: '-4px 0 12px 26px',
          letterSpacing: '0.2px',
        }}>
          Signal {signalQuality} · {sensorState.jumpQuality.samplingRateHz.toFixed(1)}Hz · {sensorState.jumpQuality.detectorVersion}
        </div>
      )}

      {!insight ? (
        <div style={{
          textAlign: 'center',
          padding: '32px 16px 34px',
          color: '#65708f',
          minHeight: '200px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ fontSize: '34px', marginBottom: '12px', opacity: 0.82 }}>🦘</div>
          <div style={{ fontSize: '15px', color: '#8b93af', marginBottom: '8px' }}>Jump to get ML classification</div>
          <div style={{ fontSize: '12px', color: '#65708f' }}>Needs 5+ valid jumps for fatigue analysis</div>
        </div>
      ) : (
        <>
          {/* Jump Type Classification */}
          <div style={{
            background: 'rgba(255,255,255,0.035)',
            border: `1px solid ${info.color}44`,
            borderRadius: '12px', padding: '14px', marginBottom: '14px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '20px' }}>{info.emoji}</span>
                  <span style={{ color: info.color, fontWeight: 800, fontSize: '18px' }}>{insight.jumpType}</span>
                  <span style={{
                    background: `${info.color}33`, color: info.color,
                    borderRadius: '8px', padding: '2px 8px', fontSize: '11px', fontWeight: 700,
                  }}>{insight.confidence}%</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '12px' }}>{info.label}</div>
                <div style={{ color: '#64748b', fontSize: '11px' }}>{info.desc}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#64748b', fontSize: '10px', marginBottom: '2px' }}>Jumps</div>
                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '20px' }}>{jumpCount}</div>
              </div>
            </div>

            {/* Confidence bars */}
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {(['CMJ', 'SJ', 'DJ'] as const).map(type => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '10px', width: '28px', fontFamily: 'monospace' }}>{type}</span>
                  <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${insight.scores[type]}%`,
                      background: type === insight.jumpType ? info.color : 'rgba(148,163,184,0.22)',
                      borderRadius: '3px',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '10px', width: '30px', textAlign: 'right' }}>
                    {insight.scores[type]}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Explosive Score + Fatigue row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Explosive Power */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px', padding: '12px', textAlign: 'center',
            }}>
              <div style={{ color: '#64748b', fontSize: '10px', marginBottom: '6px', letterSpacing: '0.5px' }}>EXPLOSIVE SCORE</div>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                  <circle cx="32" cy="32" r="28" fill="none"
                    stroke={explosiveScore > 70 ? '#10b981' : explosiveScore > 40 ? '#f59e0b' : '#6366f1'}
                    strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${(explosiveScore / 100) * 175.9} 175.9`}
                    strokeDashoffset="44"
                    transform="rotate(-90 32 32)"
                    style={{ transition: 'stroke-dasharray 0.6s ease' }}
                  />
                  <text x="32" y="37" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="bold">{explosiveScore}</text>
                </svg>
              </div>
              <div style={{ color: '#64748b', fontSize: '10px', marginTop: '4px' }}>out of 100</div>
            </div>

            {/* Fatigue */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${fatigueColor}33`,
              borderRadius: '12px', padding: '12px', textAlign: 'center',
            }}>
              <div style={{ color: '#64748b', fontSize: '10px', marginBottom: '6px', letterSpacing: '0.5px' }}>FATIGUE</div>
              <div style={{
                fontSize: '28px', fontWeight: 800, color: fatigueColor,
                lineHeight: 1, marginBottom: '2px',
                transition: 'color 0.3s',
              }}>{fatiguePercent}%</div>
              <div style={{ color: fatigueColor, fontSize: '11px', fontWeight: 600 }}>
                {FATIGUE_LABEL(insight.fatigue.trend)}
              </div>
              <div style={{ marginTop: '8px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                <div style={{
                  height: '100%', width: `${fatiguePercent}%`,
                  background: fatigueColor, borderRadius: '2px',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              {insight.fatigue.declinePercent > 0 && (
                <div style={{ color: '#64748b', fontSize: '10px', marginTop: '4px' }}>
                  ↓ {insight.fatigue.declinePercent}% height decline
                </div>
              )}
            </div>
          </div>

          {/* Recommendation */}
          {insight.fatigue.recommendation && insight.fatigue.trend !== 'insufficient_data' && (
            <div style={{
              marginTop: '12px',
              background: `${fatigueColor}11`,
              border: `1px solid ${fatigueColor}33`,
              borderRadius: '10px', padding: '10px 12px',
              display: 'flex', alignItems: 'flex-start', gap: '8px',
            }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>
                {fatiguePercent < 20 ? '🟢' : fatiguePercent < 45 ? '🟡' : fatiguePercent < 70 ? '🟠' : '🔴'}
              </span>
              <span style={{ color: '#cbd5e1', fontSize: '12px', lineHeight: '1.4' }}>
                {insight.fatigue.recommendation}
              </span>
            </div>
          )}
        </>
      )}

      {/* Footer: model info */}
      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '6px', height: '6px', background: '#00d9c0', borderRadius: '50%' }} />
        <span style={{ color: '#7f8aa4', fontSize: '10px' }}>brain.js Neural Net · CMJ / SJ / DJ classifier</span>
      </div>
    </div>
  );
};

export default MLInsightsCard;
