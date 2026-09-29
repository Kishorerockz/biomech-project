/**
 * JumpDetector — Imperative, React-free jump detection engine.
 *
 * Runs synchronously on EVERY sensor packet inside processIncomingRawData()
 * in App.tsx, before React state is updated. This guarantees no sample is
 * skipped due to React's render batching (which processes at ~60fps while
 * the sensor streams at 100Hz).
 *
 * DETECTION STRATEGY:
 * Old version required g < 0.60g (true freefall) for liftoff confirmation.
 * Problem: wrist/waist sensors often only dip to 0.7-0.9g during a jump
 * because arm/body rotation adds residual centripetal acceleration.
 *
 * New version detects LIFTOFF when the takeoff push ENDS:
 *   push spike (g > baseline+0.22) → push ends (g drops below baseline+0.10)
 * This transition is GUARANTEED for any real jump and does not require the
 * sensor to experience true weightlessness.
 */

export type JumpPhase = 'GROUNDED' | 'TAKEOFF' | 'AIRBORNE' | 'LANDING';

export interface DetectedJump {
  heightCm: number;
  hangTimeMs: number;
  takeoffG: number;
  landingG: number;
}

export class JumpDetector {
  private phase: JumpPhase = 'GROUNDED';
  private baseline: number = 1.0;
  private initialized: boolean = false;
  private cooldownUntil: number = 0;

  private takeoffStartMs: number = 0;
  private airborneStartMs: number = 0;
  private landingStartMs: number = 0;
  private peakTakeoffG: number = 0;

  // ── Detection thresholds ────────────────────────────────────────────────
  /** g above baseline to enter TAKEOFF (leg drive begins) */
  private readonly TAKEOFF_ABOVE = 0.22;
  /** g must drop below baseline+this to confirm liftoff (push phase ended) */
  private readonly LIFTOFF_BELOW_BASELINE = 0.10;
  /** Minimum real propulsion peak needed before accepting liftoff */
  private readonly MIN_PROPULSION = 0.18;
  /** g above baseline to detect landing impact */
  private readonly LANDING_ABOVE = 0.28;

  /** Min time in TAKEOFF before liftoff check (prevents oscillation false-positive) */
  private readonly MIN_TAKEOFF_MS = 25;
  /** Min airborne time — ~1.25cm hop equivalent */
  private readonly MIN_AIRBORNE_MS = 100;
  /** Max airborne time — ~88cm; abort if exceeded (dropped sensor) */
  private readonly MAX_AIRBORNE_MS = 900;
  /** Abort TAKEOFF if stuck for too long without liftoff */
  private readonly TAKEOFF_TIMEOUT_MS = 700;
  /** Max landing settle duration */
  private readonly LANDING_SETTLE_MS = 400;
  /** Post-jump debounce */
  private readonly COOLDOWN_MS = 300;

  private onJumpDetected: (jump: DetectedJump) => void;
  private onPhaseChange: ((phase: JumpPhase) => void) | undefined;

  constructor(
    onJumpDetected: (jump: DetectedJump) => void,
    onPhaseChange?: (phase: JumpPhase) => void,
  ) {
    this.onJumpDetected = onJumpDetected;
    this.onPhaseChange = onPhaseChange;
  }

  /**
   * Process one sensor packet. Call this on EVERY incoming packet,
   * synchronously inside the WebSocket/BLE onmessage handler.
   * @param magnitudeG  Resultant accel magnitude in G-force (not raw LSB)
   */
  processPacket(magnitudeG: number): JumpPhase {
    const now = performance.now();

    // ── Baseline initialization (first valid standing reading) ────────────
    if (!this.initialized && magnitudeG > 0.5 && magnitudeG < 2.0) {
      this.baseline = magnitudeG;
      this.initialized = true;
    }

    const b = this.baseline;

    // ── Pre-compute thresholds ────────────────────────────────────────────
    const takeoffThresh  = b + this.TAKEOFF_ABOVE;         // e.g. 1.22g
    const liftoffThresh  = b + this.LIFTOFF_BELOW_BASELINE; // e.g. 1.10g
    const landingThresh  = b + this.LANDING_ABOVE;         // e.g. 1.28g

    const prevPhase = this.phase;

    switch (this.phase) {
      // ── GROUNDED ──────────────────────────────────────────────────────
      case 'GROUNDED':
        // Slow baseline drift compensation while standing still
        if (now > this.cooldownUntil && magnitudeG >= 0.80 && magnitudeG <= 1.20) {
          this.baseline = this.baseline * 0.995 + magnitudeG * 0.005;
        }

        if (now >= this.cooldownUntil && magnitudeG > takeoffThresh) {
          this.phase = 'TAKEOFF';
          this.takeoffStartMs = now;
          this.peakTakeoffG = magnitudeG;
          console.log(`[JumpDetector] TAKEOFF @ ${magnitudeG.toFixed(3)}g (baseline=${b.toFixed(3)})`);
        }
        break;

      // ── TAKEOFF ───────────────────────────────────────────────────────
      case 'TAKEOFF':
        if (magnitudeG > this.peakTakeoffG) this.peakTakeoffG = magnitudeG;

        // Timeout guard: athlete crouched/stumbled but didn't jump
        if (now - this.takeoffStartMs > this.TAKEOFF_TIMEOUT_MS) {
          this.phase = 'GROUNDED';
          this.cooldownUntil = now + this.COOLDOWN_MS;
          console.log(`[JumpDetector] TAKEOFF timeout, back to GROUNDED`);
          break;
        }

        {
          // Liftoff confirmed when:
          //   1. Enough time has passed in TAKEOFF (push phase not an oscillation)
          //   2. Had real propulsion (peak g exceeded minimum threshold)
          //   3. Current g has dropped back below baseline+LIFTOFF_BELOW (push ended)
          const takeoffDuration = now - this.takeoffStartMs;
          const hadRealPush     = this.peakTakeoffG >= b + this.MIN_PROPULSION;
          const pushPhaseEnded  = magnitudeG < liftoffThresh;

          if (takeoffDuration >= this.MIN_TAKEOFF_MS && hadRealPush && pushPhaseEnded) {
            this.phase = 'AIRBORNE';
            this.airborneStartMs = now;
            console.log(
              `[JumpDetector] AIRBORNE! peakTakeoff=${this.peakTakeoffG.toFixed(3)}g, ` +
              `current=${magnitudeG.toFixed(3)}g, pushDur=${takeoffDuration.toFixed(0)}ms`
            );
          }
        }
        break;

      // ── AIRBORNE ──────────────────────────────────────────────────────
      case 'AIRBORNE': {
        const airborneMs = now - this.airborneStartMs;

        // Abort: sensor was thrown or drop test — unrealistically long
        if (airborneMs > this.MAX_AIRBORNE_MS) {
          this.phase = 'GROUNDED';
          this.cooldownUntil = now + this.COOLDOWN_MS;
          console.log(`[JumpDetector] AIRBORNE timeout (${airborneMs.toFixed(0)}ms), resetting`);
          break;
        }

        // Landing impact: sufficient airborne time AND deceleration spike
        if (airborneMs >= this.MIN_AIRBORNE_MS && magnitudeG > landingThresh) {
          this.phase = 'LANDING';
          this.landingStartMs = now;

          // h = (1/2) * g * (T/2)^2 = g * T^2 / 8
          // 122.625 = 9.81 * 100 / 8  (gives cm)
          const hangTimeMs = Math.round(airborneMs);
          const t = hangTimeMs / 1000;
          const heightCm = parseFloat(Math.min(130, 122.625 * t * t).toFixed(1));

          console.log(
            `[JumpDetector] LANDING! hangTime=${hangTimeMs}ms → height=${heightCm}cm, ` +
            `landingImpact=${magnitudeG.toFixed(3)}g`
          );

          if (heightCm >= 1.0) {
            this.onJumpDetected({
              heightCm,
              hangTimeMs,
              takeoffG: parseFloat(this.peakTakeoffG.toFixed(2)),
              landingG: parseFloat(magnitudeG.toFixed(2)),
            });
          }
        }
        break;
      }

      // ── LANDING ───────────────────────────────────────────────────────
      case 'LANDING':
        // Settle back to baseline or force-exit after max settle duration
        if (
          magnitudeG < b + 0.12 ||
          now - this.landingStartMs > this.LANDING_SETTLE_MS
        ) {
          this.phase = 'GROUNDED';
          this.cooldownUntil = now + this.COOLDOWN_MS;
          console.log(`[JumpDetector] Settled → GROUNDED`);
        }
        break;
    }

    if (prevPhase !== this.phase && this.onPhaseChange) {
      this.onPhaseChange(this.phase);
    }

    return this.phase;
  }

  getPhase(): JumpPhase { return this.phase; }
  getBaseline(): number { return this.baseline; }

  reset(): void {
    this.phase = 'GROUNDED';
    this.cooldownUntil = 0;
    this.peakTakeoffG = 0;
    this.initialized = false;
    if (this.onPhaseChange) this.onPhaseChange('GROUNDED');
    console.log('[JumpDetector] Reset (tare)');
  }
}
