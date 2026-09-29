import { useState, useEffect, useRef } from 'react';
import { JumpType } from '../types';

export type JumpState = 'STANDING' | 'DIP' | 'TAKEOFF' | 'AIRBORNE' | 'LANDING';

export interface JumpMetrics {
  totalJumps: number;
  hangTimeMs: number;
  landingImpactG: number;
  takeoffAccelG: number;
  groundContactTimeMs?: number;
  rsi?: number;
  dipDepthCm?: number;
  rfd?: number;
  jumpType?: JumpType;
  trueTakeoffVelocity?: number;
  crouchCorrectionMs?: number;
}

// ═══════════════════════════════════════════════════════════════
// Athletic Kinematics Thresholds & Window Limits
// ═══════════════════════════════════════════════════════════════
const MIN_AIRBORNE_MS = 140;         // ~2.4cm minimum — captures small 8-15cm jumps without clipping
const MAX_AIRBORNE_MS = 850;         // ~88cm — rejects unrealistic hang times
const MAX_DIP_DURATION_MS = 900;     // Max time for knee flexion before returning to standing
const MAX_TAKEOFF_DURATION_MS = 500; // Max duration from propulsion start to liftoff
const LANDING_SETTLE_TIMEOUT_MS = 140; // Landing impact duration
const POST_LANDING_COOLDOWN_MS = 250; // Absorbs ground shock vibration

export function useJumpDetection(
  liveMagnitudeG: number,
  isSessionActive: boolean,
  onJumpDetected?: (metrics: JumpMetrics) => void,
  hardwareTimestampUs?: number,
  wearLocation: 'waist' | 'ankle' | 'arm' = 'waist',
  customJumpThresholdG?: number
) {
  const [jumpState, setJumpState] = useState<JumpState>('STANDING');
  const [metrics, setMetrics] = useState<JumpMetrics>({
    totalJumps: 0,
    hangTimeMs: 0,
    landingImpactG: 0,
    takeoffAccelG: 0,
    groundContactTimeMs: 0,
    rsi: 0,
  });

  const stateRef = useRef<JumpState>('STANDING');
  const dipStartTimeRef = useRef<number>(0);
  const takeoffStartTimeRef = useRef<number>(0);
  const airborneStartTimeRef = useRef<number>(0);
  const airborneStartHwUsRef = useRef<number | null>(null);
  const landingTouchdownTimeRef = useRef<number>(0);
  const landingTouchdownHwUsRef = useRef<number | null>(null);
  const stateEntryTimeRef = useRef<number>(0);
  const currentTakeoffRef = useRef<number>(0);
  const currentLandingRef = useRef<number>(0);
  const totalJumpsRef = useRef<number>(0);
  const lastLandingTimeRef = useRef<number | null>(null);
  const minDipGRef = useRef<number>(1.0);
  const currentDipDepthRef = useRef<number>(0);
  const cooldownUntilRef = useRef<number>(0);
  const baselineGRef = useRef<number>(1.0);
  const isInitializedRef = useRef<boolean>(false);
  const liftoffCrossingTimeRef = useRef<number>(0);
  const liftoffCrossingHwUsRef = useRef<number | null>(null);

  // Real-time propulsion integration buffer
  const propulsionSamplesRef = useRef<{ g: number; t: number }[]>([]);

  const onJumpRef = useRef(onJumpDetected);
  useEffect(() => {
    onJumpRef.current = onJumpDetected;
  }, [onJumpDetected]);

  // Helper: reset state cleanly back to STANDING
  const resetToStanding = (now: number, withCooldown: boolean) => {
    stateRef.current = 'STANDING';
    setJumpState('STANDING');
    stateEntryTimeRef.current = now;
    propulsionSamplesRef.current = [];
    minDipGRef.current = baselineGRef.current;
    currentDipDepthRef.current = 0;
    liftoffCrossingTimeRef.current = 0;
    liftoffCrossingHwUsRef.current = null;
    if (withCooldown) {
      cooldownUntilRef.current = now + POST_LANDING_COOLDOWN_MS;
    }
  };

  // Phase-aware watchdog: guarantees state machine never gets stuck
  useEffect(() => {
    const interval = setInterval(() => {
      const now = performance.now();
      const current = stateRef.current;
      if (current === 'STANDING') return;

      const elapsed = now - stateEntryTimeRef.current;
      const timeout =
        current === 'AIRBORNE' ? MAX_AIRBORNE_MS + 100 :
        current === 'DIP' ? MAX_DIP_DURATION_MS + 100 :
        current === 'TAKEOFF' ? MAX_TAKEOFF_DURATION_MS + 100 :
        LANDING_SETTLE_TIMEOUT_MS + 100;

      if (elapsed > timeout) {
        resetToStanding(now, true);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const resetMetrics = () => {
    stateRef.current = 'STANDING';
    stateEntryTimeRef.current = performance.now();
    totalJumpsRef.current = 0;
    lastLandingTimeRef.current = null;
    airborneStartTimeRef.current = 0;
    airborneStartHwUsRef.current = null;
    landingTouchdownTimeRef.current = 0;
    landingTouchdownHwUsRef.current = null;
    currentTakeoffRef.current = 0;
    currentLandingRef.current = 0;
    const initialG = liveMagnitudeG > 0.4 && liveMagnitudeG < 2.5 ? liveMagnitudeG : 1.0;
    baselineGRef.current = initialG;
    minDipGRef.current = initialG;
    currentDipDepthRef.current = 0;
    cooldownUntilRef.current = 0;
    liftoffCrossingTimeRef.current = 0;
    liftoffCrossingHwUsRef.current = null;
    propulsionSamplesRef.current = [];
    setJumpState('STANDING');
    setMetrics({
      totalJumps: 0,
      hangTimeMs: 0,
      landingImpactG: 0,
      takeoffAccelG: 0,
      groundContactTimeMs: 0,
      rsi: 0,
    });
  };

  useEffect(() => {
    const g = liveMagnitudeG;
    const now = performance.now();

    // 1. Initial Baseline Lock on first valid packet
    if (!isInitializedRef.current && g > 0.4 && g < 2.5) {
      baselineGRef.current = g;
      isInitializedRef.current = true;
    }

    // 2. Continuous Baseline Adaptation when at rest in STANDING
    if (stateRef.current === 'STANDING' && now > cooldownUntilRef.current && g >= 0.80 && g <= 1.25) {
      baselineGRef.current = baselineGRef.current * 0.98 + g * 0.02;
    }

    const baseline = baselineGRef.current;

    // ── Athletic Kinematic Thresholds (Calibrated for 8cm to 80cm jumps) ──
    // Takeoff push: Requires intentional upward propulsion (>= 1.28g)
    const takeoffThreshold = customJumpThresholdG && customJumpThresholdG > 1.20
      ? customJumpThresholdG
      : (baseline + 0.28);

    // Dip threshold: knees bending downward unweights the body (< 0.84g)
    const dipThreshold = baseline - 0.16;

    // Liftoff/Freefall threshold: in flight, |a| plunges toward 0g (< 0.76g)
    const freefallThreshold = baseline - 0.24;

    // Landing impact threshold: deceleration shock when feet hit ground (>= 1.35g)
    const landingThreshold = baseline + 0.35;
    const landingSettle = baseline + 0.16;

    switch (stateRef.current) {
      case 'STANDING': {
        // Cooldown period after landing absorbs residual floor/body vibrations
        if (now < cooldownUntilRef.current) break;

        // 1. Countermovement Dip (athlete flexes knees downward before exploding up)
        if (g < dipThreshold) {
          stateRef.current = 'DIP';
          setJumpState('DIP');
          dipStartTimeRef.current = now;
          stateEntryTimeRef.current = now;
          minDipGRef.current = g;
        }
        // 2. Direct Takeoff (explosive jump without dip or quick hop >= 1.28g)
        else if (g > takeoffThreshold) {
          stateRef.current = 'TAKEOFF';
          setJumpState('TAKEOFF');
          currentTakeoffRef.current = g;
          takeoffStartTimeRef.current = now;
          stateEntryTimeRef.current = now;
          propulsionSamplesRef.current = [{ g, t: now }];
        }
        break;
      }

      case 'DIP': {
        if (g < minDipGRef.current) {
          minDipGRef.current = g;
        }

        // Timeout: if dip lasts > 900ms, athlete aborted jump or just crouched
        if (now - dipStartTimeRef.current > MAX_DIP_DURATION_MS) {
          resetToStanding(now, true);
          break;
        }

        // Transition from Dip to Takeoff: athlete begins upward acceleration
        if (g > baseline + 0.20) {
          stateRef.current = 'TAKEOFF';
          setJumpState('TAKEOFF');
          currentTakeoffRef.current = g;
          takeoffStartTimeRef.current = now;
          stateEntryTimeRef.current = now;
          propulsionSamplesRef.current = [{ g, t: now }];

          const dipDtSec = (now - dipStartTimeRef.current) / 1000;
          const unweightG = Math.max(0.05, baseline - minDipGRef.current);
          currentDipDepthRef.current = parseFloat((0.5 * unweightG * 980.665 * Math.pow(dipDtSec, 2)).toFixed(1));
        }
        break;
      }

      case 'TAKEOFF': {
        const takeoffDurationMs = now - takeoffStartTimeRef.current;

        if (g > currentTakeoffRef.current) {
          currentTakeoffRef.current = g;
        }
        if (propulsionSamplesRef.current.length < 60) {
          propulsionSamplesRef.current.push({ g, t: now });
        }

        // Detect when propulsion ends and acceleration crosses below resting baseline (1.0g).
        // This is the EXACT physical instant the feet leave the ground!
        if (currentTakeoffRef.current >= (baseline + 0.22) && g < (baseline - 0.04)) {
          if (liftoffCrossingTimeRef.current === 0) {
            liftoffCrossingTimeRef.current = now;
            liftoffCrossingHwUsRef.current = hardwareTimestampUs || null;
          }
        }

        // ── LIFTOFF CONFIRMATION ──
        // Athlete had an upward push, and acceleration now confirms flight (< 0.76g)
        const hasRealPropulsion = currentTakeoffRef.current >= (baseline + 0.22);
        if (hasRealPropulsion && g < freefallThreshold) {
          stateRef.current = 'AIRBORNE';
          setJumpState('AIRBORNE');
          const actualLiftoffTime = liftoffCrossingTimeRef.current > 0 ? liftoffCrossingTimeRef.current : now;
          const actualLiftoffHwUs = liftoffCrossingHwUsRef.current != null ? liftoffCrossingHwUsRef.current : (hardwareTimestampUs || null);
          airborneStartTimeRef.current = actualLiftoffTime;
          airborneStartHwUsRef.current = actualLiftoffHwUs;
          stateEntryTimeRef.current = now;
          liftoffCrossingTimeRef.current = 0;
          liftoffCrossingHwUsRef.current = null;
          break;
        }

        // Timeout guard: if takeoff lasts > 500ms without freefall, athlete didn't jump
        if (takeoffDurationMs > MAX_TAKEOFF_DURATION_MS) {
          resetToStanding(now, true);
          break;
        }
        break;
      }

      case 'AIRBORNE': {
        const airborneMs = now - airborneStartTimeRef.current;

        // Abort guard: if airborne > 850ms (~88cm jump), sensor was dropped or thrown
        if (airborneMs > MAX_AIRBORNE_MS) {
          resetToStanding(now, true);
          break;
        }

        // ── TOUCHDOWN DETECTION: Ground reaction impact spike ──
        // Athlete must be in flight for at least MIN_AIRBORNE_MS (140ms ≈ 2.4cm hop)
        // Deceleration impact (>= 1.35g) confirms touchdown!
        const isImpact = g >= landingThreshold;

        if (airborneMs >= MIN_AIRBORNE_MS && isImpact) {
          stateRef.current = 'LANDING';
          setJumpState('LANDING');
          currentLandingRef.current = g;
          landingTouchdownTimeRef.current = now;
          landingTouchdownHwUsRef.current = hardwareTimestampUs || null;
          stateEntryTimeRef.current = now;

          // Compute flight duration
          let flightDuration = Math.round(now - airborneStartTimeRef.current);

          // Use high-precision hardware microsecond timestamp if available and reliable
          if (
            airborneStartHwUsRef.current != null &&
            landingTouchdownHwUsRef.current != null &&
            landingTouchdownHwUsRef.current > airborneStartHwUsRef.current
          ) {
            const hwDuration = Math.round((landingTouchdownHwUsRef.current - airborneStartHwUsRef.current) / 1000);
            if (hwDuration >= MIN_AIRBORNE_MS && hwDuration <= MAX_AIRBORNE_MS && Math.abs(hwDuration - flightDuration) < 90) {
              flightDuration = hwDuration;
            }
          }

          // ── CONFIRM JUMP & RECORD METRICS ──
          if (flightDuration >= MIN_AIRBORNE_MS && flightDuration <= MAX_AIRBORNE_MS) {
            const landingImpact = parseFloat(Math.max(landingThreshold, g).toFixed(2));
            const takeoffAccel = parseFloat(Math.max(takeoffThreshold, currentTakeoffRef.current).toFixed(2));

            let gctMs: number | undefined;
            let rsi: number | undefined;

            if (lastLandingTimeRef.current !== null) {
              const timeSinceLastLanding = Math.round(airborneStartTimeRef.current - lastLandingTimeRef.current);
              if (timeSinceLastLanding >= 60 && timeSinceLastLanding <= 900) {
                gctMs = timeSinceLastLanding;
                rsi = parseFloat((flightDuration / gctMs).toFixed(2));
              }
            }
            lastLandingTimeRef.current = now;

            totalJumpsRef.current += 1;
            const newCount = totalJumpsRef.current;


            let integratedVelocity = 0;
            const samples = propulsionSamplesRef.current;
            if (samples.length >= 2) {
              for (let i = 1; i < samples.length; i++) {
                const dt = Math.max(0.005, Math.min(0.03, (samples[i].t - samples[i - 1].t) / 1000));
                const netG = Math.max(0, ((samples[i].g + samples[i - 1].g) / 2.0) - baseline);
                integratedVelocity += netG * 9.80665 * dt;
              }
            }
            integratedVelocity = Math.min(4.2, integratedVelocity);

            const takeoffDurationSec = Math.max(0.02, (airborneStartTimeRef.current - takeoffStartTimeRef.current) / 1000);
            const rfdVal = parseFloat(((takeoffAccel - baseline) / takeoffDurationSec).toFixed(1));

            let detectedType: JumpType = 'CMJ';
            if (gctMs !== undefined && gctMs < 350) {
              detectedType = 'DJ';
            } else if (currentDipDepthRef.current >= 2.5) {
              detectedType = 'CMJ';
            } else {
              detectedType = 'SJ';
            }

            const newMetrics: JumpMetrics = {
              totalJumps: newCount,
              hangTimeMs: flightDuration,
              landingImpactG: landingImpact,
              takeoffAccelG: takeoffAccel,
              groundContactTimeMs: gctMs,
              rsi: rsi,
              dipDepthCm: currentDipDepthRef.current > 0 ? currentDipDepthRef.current : undefined,
              rfd: rfdVal > 0 ? rfdVal : undefined,
              jumpType: detectedType,
              trueTakeoffVelocity: integratedVelocity > 0.4 ? parseFloat(integratedVelocity.toFixed(2)) : undefined,
            };

            setMetrics(newMetrics);

            if (onJumpRef.current) {
              onJumpRef.current(newMetrics);
            }
          }
        }
        break;
      }

      case 'LANDING': {
        if (g > currentLandingRef.current) {
          currentLandingRef.current = g;
        }

        const landingDurationMs = now - stateEntryTimeRef.current;
        // Impact settles once g returns near baseline, or after max 150ms
        const isSettled = (g < landingSettle && landingDurationMs >= 50) || landingDurationMs >= LANDING_SETTLE_TIMEOUT_MS;

        if (isSettled) {
          currentTakeoffRef.current = 0;
          currentLandingRef.current = 0;
          airborneStartTimeRef.current = 0;
          airborneStartHwUsRef.current = null;
          landingTouchdownTimeRef.current = 0;
          landingTouchdownHwUsRef.current = null;
          takeoffStartTimeRef.current = 0;
          propulsionSamplesRef.current = [];
          minDipGRef.current = baseline;
          currentDipDepthRef.current = 0;
          stateRef.current = 'STANDING';
          setJumpState('STANDING');
          stateEntryTimeRef.current = now;
          cooldownUntilRef.current = now + POST_LANDING_COOLDOWN_MS;
        }
        break;
      }
    }
  }, [liveMagnitudeG, isSessionActive, hardwareTimestampUs, wearLocation, customJumpThresholdG]);

  return {
    ...metrics,
    jumpState,
    resetMetrics,
  };
}
