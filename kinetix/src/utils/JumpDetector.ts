/**
 * JumpDetector — Imperative, React-free jump detection engine.
 *
 * Runs synchronously on EVERY sensor packet inside processIncomingRawData()
 * in App.tsx, before React state is updated. Guarantees no sample is skipped
 * due to React's render batching (which processes at ~60fps, ESP32 at 100Hz).
 *
 * ── ACCURATE TIMING STRATEGY ─────────────────────────────────────────────
 *
 * Biomechanics: liftoff occurs exactly when Ground Reaction Force = 0.
 * At that instant an accelerometer reads exactly 1g (gravity only).
 * Therefore: liftoff = when g drops BELOW BASELINE after the takeoff spike.
 *
 * Previous version started the AIRBORNE timer when g dropped below
 * baseline+0.10g (push-phase end). That's 10-30ms AFTER actual liftoff,
 * causing systematic UNDERESTIMATION of hang time → small height values.
 *
 * This version starts AIRBORNE when g crosses BELOW BASELINE, which
 * closely matches actual liftoff and gives accurate height calculation.
 *
 * ── FALSE POSITIVE REDUCTION ─────────────────────────────────────────────
 * TAKEOFF threshold raised to baseline+0.40g — filters out walking (±0.3g)
 * and casual arm swings. Only explosive leg drive triggers TAKEOFF.
 * MIN_AIRBORNE_MS = 150ms filters micro-hops (< ~2.8cm equivalent).
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

  // ── Thresholds ─────────────────────────────────────────────────────────
  /** g above baseline to begin TAKEOFF detection (filters walking/arm swings) */
  private readonly TAKEOFF_ABOVE = 0.40;
  /** Minimum propulsion peak before liftoff is accepted */
  private readonly MIN_PROPULSION = 0.28;
  /** Minimum time in TAKEOFF phase before liftoff check (anti-oscillation) */
  private readonly MIN_TAKEOFF_MS = 40;
  /** g above baseline to detect landing impact spike */
  private readonly LANDING_ABOVE = 0.30;
  /** Minimum airborne time — filters micro-hops; ~2.8cm equivalent */
  private readonly MIN_AIRBORNE_MS = 150;
  /** Maximum airborne time — abort if exceeded (sensor thrown/dropped) */
  private readonly MAX_AIRBORNE_MS = 900;
  /** Abort TAKEOFF if stuck too long (athlete crouched but didn't jump) */
  private readonly TAKEOFF_TIMEOUT_MS = 700;
  /** Max landing settle duration */
  private readonly LANDING_SETTLE_MS = 400;
  /** Post-jump debounce */
  private readonly COOLDOWN_MS = 350;

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
   * Call on EVERY incoming sensor packet, synchronously inside the
   * WebSocket/BLE onmessage handler — before React state is updated.
   * @param magnitudeG  Resultant acceleration magnitude in G-force (NOT raw LSB)
   */
  processPacket(magnitudeG: number): JumpPhase {
    const now = performance.now();

    // ── Baseline initialization ───────────────────────────────────────────
    if (!this.initialized && magnitudeG > 0.5 && magnitudeG < 2.0) {
      this.baseline = magnitudeG;
      this.initialized = true;
    }

    const b = this.baseline;
    const prevPhase = this.phase;

    switch (this.phase) {

      // ── GROUNDED ─────────────────────────────────────────────────────
      case 'GROUNDED': {
        // Slow baseline drift compensation while standing still and stable
        if (now > this.cooldownUntil && magnitudeG >= 0.85 && magnitudeG <= 1.15) {
          this.baseline = this.baseline * 0.995 + magnitudeG * 0.005;
        }

        if (now >= this.cooldownUntil && magnitudeG > b + this.TAKEOFF_ABOVE) {
          this.phase = 'TAKEOFF';
          this.takeoffStartMs = now;
          this.peakTakeoffG = magnitudeG;
          console.log(`[Jump] TAKEOFF @ ${magnitudeG.toFixed(3)}g (baseline=${b.toFixed(3)}, thresh=${(b + this.TAKEOFF_ABOVE).toFixed(3)})`);
        }
        break;
      }

      // ── TAKEOFF ──────────────────────────────────────────────────────
      case 'TAKEOFF': {
        if (magnitudeG > this.peakTakeoffG) this.peakTakeoffG = magnitudeG;

        const takeoffDur = now - this.takeoffStartMs;

        // Timeout: crouched/stumbled but didn't jump
        if (takeoffDur > this.TAKEOFF_TIMEOUT_MS) {
          this.phase = 'GROUNDED';
          this.cooldownUntil = now + this.COOLDOWN_MS;
          console.log(`[Jump] TAKEOFF timeout → GROUNDED`);
          break;
        }

        // LIFTOFF DETECTION (accurate timing):
        // Liftoff ≈ when g crosses below baseline (feet leave floor, GRF → 0).
        // Guards:
        //   1. Min 40ms in TAKEOFF (ensures we've seen the full push spike)
        //   2. Real propulsion peak observed (> baseline + MIN_PROPULSION)
        //   3. g now below baseline (baseline crossing = liftoff)
        const hadRealPush = this.peakTakeoffG >= b + this.MIN_PROPULSION;
        const crossedBaseline = magnitudeG < b;          // ← key fix: < baseline, not < baseline+0.10

        if (takeoffDur >= this.MIN_TAKEOFF_MS && hadRealPush && crossedBaseline) {
          this.phase = 'AIRBORNE';
          this.airborneStartMs = now;
          console.log(
            `[Jump] AIRBORNE! peakPush=${this.peakTakeoffG.toFixed(3)}g, ` +
            `now=${magnitudeG.toFixed(3)}g, pushDur=${takeoffDur.toFixed(0)}ms`
          );
        }
        break;
      }

      // ── AIRBORNE ─────────────────────────────────────────────────────
      case 'AIRBORNE': {
        const airborneMs = now - this.airborneStartMs;

        // Abort: sensor dropped/thrown
        if (airborneMs > this.MAX_AIRBORNE_MS) {
          this.phase = 'GROUNDED';
          this.cooldownUntil = now + this.COOLDOWN_MS;
          console.log(`[Jump] AIRBORNE timeout → GROUNDED`);
          break;
        }

        // LANDING DETECTION:
        //   - Sufficient hang time (filters micro-movements)
        //   - Clear impact spike above baseline
        if (airborneMs >= this.MIN_AIRBORNE_MS && magnitudeG > b + this.LANDING_ABOVE) {
          this.phase = 'LANDING';
          this.landingStartMs = now;

          // ── Height formula ──────────────────────────────────────────
          // Physics: h = (1/2) * g_earth * (T/2)²
          //        = g_earth * T² / 8
          //        = 9.81 * T² / 8   [m]
          //        = 122.625 * T²    [cm]   where T = total hang time in seconds
          const hangTimeMs = Math.round(airborneMs);
          const t = hangTimeMs / 1000;
          const heightCm = parseFloat(Math.min(130, 122.625 * t * t).toFixed(1));

          console.log(
            `[Jump] LANDING! hangTime=${hangTimeMs}ms → height=${heightCm}cm | ` +
            `impact=${magnitudeG.toFixed(3)}g`
          );

          if (heightCm >= 2.0) {                        // ← 2cm minimum (sanity check)
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

      // ── LANDING ──────────────────────────────────────────────────────
      case 'LANDING': {
        // Settle: g returns toward baseline or max duration exceeded
        if (
          magnitudeG < b + 0.12 ||
          now - this.landingStartMs > this.LANDING_SETTLE_MS
        ) {
          this.phase = 'GROUNDED';
          this.cooldownUntil = now + this.COOLDOWN_MS;
          console.log(`[Jump] Settled → GROUNDED (baseline=${this.baseline.toFixed(3)})`);
        }
        break;
      }
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
    console.log('[Jump] Detector reset (tare)');
  }
}
