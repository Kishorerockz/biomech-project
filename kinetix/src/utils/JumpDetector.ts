/**
 * JumpDetector — Imperative, React-free jump detection engine.
 *
 * WHY THIS EXISTS:
 * React's useEffect only runs after a render (~60fps). The ESP32 sends at
 * 100Hz. React batches multiple state updates into one render, so the hook
 * in useJumpDetection.ts only sees ~60 out of 100 packets per second.
 *
 * For a 10cm jump, the takeoff spike lasts only ~50ms (5 packets). React
 * may batch all 5 into one render showing the tail end (g≈1g), so the
 * TAKEOFF state is never entered → jump is silently missed.
 *
 * This class processes EVERY packet synchronously inside onmessage, before
 * React ever sees it, guaranteeing no sample is skipped.
 */

export type JumpPhase = 'GROUNDED' | 'TAKEOFF' | 'FREEFALL' | 'LANDING';

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
  private freefallStartMs: number = 0;
  private landingStartMs: number = 0;
  private peakTakeoffG: number = 0;

  // ── Thresholds (all relative to baseline ≈ 1.0g) ──────────────
  // Takeoff: leg drive pushes magnitude above resting
  private readonly TAKEOFF_ABOVE = 0.25;    // baseline + 0.25g triggers TAKEOFF
  // Freefall: weightlessness — feet leave floor
  private readonly FREEFALL_BELOW = 0.40;   // baseline - 0.40g confirms FREEFALL
  // Landing: deceleration impact when feet hit floor
  private readonly LANDING_ABOVE = 0.35;    // baseline + 0.35g triggers LANDING
  // Timing guards
  private readonly MIN_FREEFALL_MS = 100;   // ≈2.5cm minimum detectable jump
  private readonly MAX_FREEFALL_MS = 900;   // ≈88cm max — dropped sensor abort
  private readonly TAKEOFF_TIMEOUT_MS = 600;
  private readonly LANDING_SETTLE_MS = 350;
  private readonly COOLDOWN_MS = 300;       // debounce after landing

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
   * Call this on EVERY incoming sensor packet, directly in the WebSocket
   * or BLE onmessage handler — before React state is updated.
   * @param magnitudeG  Resultant acceleration magnitude in G-force units
   */
  processPacket(magnitudeG: number): JumpPhase {
    const now = performance.now();

    // ── Baseline initialization (first valid standing reading) ──
    if (!this.initialized && magnitudeG > 0.5 && magnitudeG < 2.0) {
      this.baseline = magnitudeG;
      this.initialized = true;
    }

    // ── Slow baseline drift compensation while grounded & stable ──
    if (
      this.phase === 'GROUNDED' &&
      now > this.cooldownUntil &&
      magnitudeG >= 0.80 && magnitudeG <= 1.20
    ) {
      this.baseline = this.baseline * 0.997 + magnitudeG * 0.003;
    }

    const b = this.baseline;
    const prevPhase = this.phase;

    switch (this.phase) {
      case 'GROUNDED':
        if (now >= this.cooldownUntil && magnitudeG > b + this.TAKEOFF_ABOVE) {
          this.phase = 'TAKEOFF';
          this.takeoffStartMs = now;
          this.peakTakeoffG = magnitudeG;
        }
        break;

      case 'TAKEOFF':
        if (magnitudeG > this.peakTakeoffG) this.peakTakeoffG = magnitudeG;

        // Timeout — athlete crouched but didn't jump
        if (now - this.takeoffStartMs > this.TAKEOFF_TIMEOUT_MS) {
          this.phase = 'GROUNDED';
          this.cooldownUntil = now + this.COOLDOWN_MS;
          break;
        }

        // Liftoff: had real propulsion AND magnitude dropped into freefall
        if (this.peakTakeoffG >= b + 0.18 && magnitudeG < b - this.FREEFALL_BELOW) {
          this.phase = 'FREEFALL';
          this.freefallStartMs = now;
        }
        break;

      case 'FREEFALL': {
        const freefallMs = now - this.freefallStartMs;

        // Abort — too long in air (sensor dropped/thrown)
        if (freefallMs > this.MAX_FREEFALL_MS) {
          this.phase = 'GROUNDED';
          this.cooldownUntil = now + this.COOLDOWN_MS;
          break;
        }

        // Landing impact detected
        if (freefallMs >= this.MIN_FREEFALL_MS && magnitudeG > b + this.LANDING_ABOVE) {
          this.phase = 'LANDING';
          this.landingStartMs = now;

          // ── Height calculation: h = g * (T/2)² / 2 = g * T² / 8 ──
          const hangTimeMs = Math.round(freefallMs);
          const t = hangTimeMs / 1000;
          const heightCm = parseFloat(Math.min(130, 122.625 * t * t).toFixed(1));

          if (heightCm >= 1.5) {
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

      case 'LANDING':
        // Settle back to resting baseline, or force-exit after timeout
        if (
          magnitudeG < b + 0.15 ||
          now - this.landingStartMs > this.LANDING_SETTLE_MS
        ) {
          this.phase = 'GROUNDED';
          this.cooldownUntil = now + this.COOLDOWN_MS;
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
  }
}
