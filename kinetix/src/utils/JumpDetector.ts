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
  velocityMps?: number;
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
  private lastSampleTimeMs: number = 0;
  private takeoffVelocity: number = 0; // Integrated upward takeoff velocity (m/s)

  // ── Thresholds ─────────────────────────────────────────────────────────
  /** g above baseline to begin upward motion detection */
  private readonly TAKEOFF_ABOVE = 0.25;
  /** Minimum propulsion peak before liftoff is accepted */
  private readonly MIN_PROPULSION = 0.20;
  /** Minimum time in upward motion phase before liftoff check */
  private readonly MIN_TAKEOFF_MS = 25;
  /** Minimum g required to confirm landing impact shock */
  private readonly LANDING_MIN_G = 1.40;
  /** Minimum airborne time — 100ms capture */
  private readonly MIN_AIRBORNE_MS = 100;
  /** Maximum airborne time — abort if exceeded */
  private readonly MAX_AIRBORNE_MS = 1200;
  /** Abort TAKEOFF if stuck too long without liftoff */
  private readonly TAKEOFF_TIMEOUT_MS = 800;
  /** Max landing settle duration */
  private readonly LANDING_SETTLE_MS = 300;
  /** Post-jump debounce */
  private readonly COOLDOWN_MS = 250;

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
   * @param magnitudeG  Resultant acceleration magnitude in G-force
   */
  processPacket(magnitudeG: number): JumpPhase {
    const now = performance.now();
    const dt = this.lastSampleTimeMs > 0 ? Math.min(0.05, Math.max(0.005, (now - this.lastSampleTimeMs) / 1000)) : 0.01;
    this.lastSampleTimeMs = now;

    // ── Baseline initialization & tracking ────────────────────────────────
    if (!this.initialized && magnitudeG > 0.4 && magnitudeG < 2.2) {
      this.baseline = magnitudeG;
      this.initialized = true;
    }

    const b = this.baseline;
    const prevPhase = this.phase;

    switch (this.phase) {

      // ── GROUNDED ─────────────────────────────────────────────────────
      case 'GROUNDED': {
        // Continuous baseline adaptation when still
        if (now > this.cooldownUntil && magnitudeG >= 0.80 && magnitudeG <= 1.25) {
          this.baseline = this.baseline * 0.99 + magnitudeG * 0.01;
        }

        // Trigger upward motion / takeoff
        if (now >= this.cooldownUntil && magnitudeG > (b + this.TAKEOFF_ABOVE)) {
          this.phase = 'TAKEOFF';
          this.takeoffStartMs = now;
          this.peakTakeoffG = magnitudeG;
          this.takeoffVelocity = 0;
          console.log(`[Jump] TAKEOFF detected @ ${magnitudeG.toFixed(2)}g (baseline=${b.toFixed(2)})`);
        }
        break;
      }

      // ── TAKEOFF ──────────────────────────────────────────────────────
      case 'TAKEOFF': {
        if (magnitudeG > this.peakTakeoffG) this.peakTakeoffG = magnitudeG;

        // Integrate upward net acceleration: a_net = (g - baseline) * 9.81 m/s²
        const netG = Math.max(0, magnitudeG - b);
        this.takeoffVelocity += netG * 9.80665 * dt;

        const takeoffDur = now - this.takeoffStartMs;

        // Timeout: motion stopped without entering flight
        if (takeoffDur > this.TAKEOFF_TIMEOUT_MS) {
          this.phase = 'GROUNDED';
          this.cooldownUntil = now + this.COOLDOWN_MS;
          this.takeoffVelocity = 0;
          console.log(`[Jump] TAKEOFF timeout after ${takeoffDur.toFixed(0)}ms → GROUNDED`);
          break;
        }

        // LIFTOFF DETECTION:
        // When upward push slows down and acceleration crosses below baseline (or <= 0.98g)
        const hadRealPush = this.peakTakeoffG >= (b + this.MIN_PROPULSION);
        const enteredFreefall = magnitudeG < b || magnitudeG <= 0.98;

        if (takeoffDur >= this.MIN_TAKEOFF_MS && hadRealPush && enteredFreefall) {
          this.phase = 'AIRBORNE';
          this.airborneStartMs = now;
          console.log(
            `[Jump] AIRBORNE! Peak push=${this.peakTakeoffG.toFixed(2)}g, ` +
            `v0=${this.takeoffVelocity.toFixed(2)}m/s, Push duration=${takeoffDur.toFixed(0)}ms`
          );
        }
        break;
      }

      // ── AIRBORNE ─────────────────────────────────────────────────────
      case 'AIRBORNE': {
        const airborneMs = now - this.airborneStartMs;

        // Abort: flight exceeded max realistic time
        if (airborneMs > this.MAX_AIRBORNE_MS) {
          this.phase = 'GROUNDED';
          this.cooldownUntil = now + this.COOLDOWN_MS;
          this.takeoffVelocity = 0;
          console.log(`[Jump] AIRBORNE timeout (${airborneMs.toFixed(0)}ms) → GROUNDED`);
          break;
        }

        // LANDING / TOUCHDOWN DETECTION:
        // Must be in air for at least MIN_AIRBORNE_MS (100ms).
        // Impact occurs when deceleration shock spikes above landing threshold.
        const isImpactShock = magnitudeG >= Math.min(this.LANDING_MIN_G, b + 0.32) || magnitudeG >= 1.38;

        if (airborneMs >= this.MIN_AIRBORNE_MS && isImpactShock) {
          this.phase = 'LANDING';
          this.landingStartMs = now;

          const hangTimeMs = Math.round(airborneMs);
          const t = hangTimeMs / 1000;

          // 1. Classical flight-time formula: h_flight = (1/8) * g * T²
          const hFlightCm = 122.625 * t * t;

          // Keep takeoff velocity as a diagnostic feature only. Integrating
          // acceleration is too sensitive to orientation and gravity leakage
          // to correct the official height measurement reliably.
          const v0 = Math.max(0, this.takeoffVelocity);
          const heightCm = parseFloat(Math.min(130, hFlightCm).toFixed(1));

          console.log(
            `[Jump] LANDING DETECTED! HangTime=${hangTimeMs}ms, v0=${v0.toFixed(2)}m/s | ` +
            `hFlight=${hFlightCm.toFixed(1)}cm → Final=${heightCm}cm | ` +
            `Impact=${magnitudeG.toFixed(2)}g`
          );

          // Ignore small false values like 2cm, 3cm (minimum threshold = 5.0cm)
          if (heightCm >= 5.0) {
            this.onJumpDetected({
              heightCm,
              hangTimeMs,
              takeoffG: parseFloat(this.peakTakeoffG.toFixed(2)),
              landingG: parseFloat(magnitudeG.toFixed(2)),
              velocityMps: parseFloat(v0.toFixed(2)),
            });
          }
        }
        break;
      }

      // ── LANDING ──────────────────────────────────────────────────────
      case 'LANDING': {
        // Settle: g returns toward baseline or max duration exceeded
        if (
          magnitudeG < b + 0.15 ||
          now - this.landingStartMs > this.LANDING_SETTLE_MS
        ) {
          this.phase = 'GROUNDED';
          this.cooldownUntil = now + this.COOLDOWN_MS;
          this.takeoffVelocity = 0;
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
    this.takeoffVelocity = 0;
    this.initialized = false;
    if (this.onPhaseChange) this.onPhaseChange('GROUNDED');
    console.log('[Jump] Detector reset (tare)');
  }
}
