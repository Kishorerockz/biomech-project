const TAKEOFF_DELTA_G = 0.35;
const FREEFALL_DELTA_G = 0.30;
const LANDING_DELTA_G = 0.40;
const TAKEOFF_CONFIRM_SAMPLES = 3;
const FREEFALL_CONFIRM_SAMPLES = 3;
const LANDING_CONFIRM_SAMPLES = 2;
const MIN_FREEFALL_MS = 100;
const MAX_FREEFALL_MS = 1200;
const POST_LANDING_COOLDOWN_MS = 250;
const GRAVITY_M_S2 = 9.81;

function detectJump(processedAccel, packet, cGyro, state) {
  const timestamp = packet.timestamp;
  const baseline = state.baselineG;

  switch (state.jumpState) {
    case "GROUNDED":
      if (timestamp >= state.cooldownUntil && processedAccel >= 0.80 && processedAccel <= 1.20) {
        state.baselineG = state.baselineG * 0.98 + processedAccel * 0.02;
      }
      if (timestamp < state.cooldownUntil) break;
      if (processedAccel > baseline + TAKEOFF_DELTA_G) {
        state.takeoffSamples += 1;
      } else {
        state.takeoffSamples = 0;
      }
      if (state.takeoffSamples >= TAKEOFF_CONFIRM_SAMPLES) {
        state.jumpState = "TAKEOFF";
        state.takeoffPeak = processedAccel;
        state.takeoffSamples = 0;
      }
      break;

    case "TAKEOFF":
      if (processedAccel > state.takeoffPeak) state.takeoffPeak = processedAccel;
      if (processedAccel < baseline - FREEFALL_DELTA_G) {
        state.freefallSamples += 1;
      } else {
        state.freefallSamples = 0;
      }
      if (state.freefallSamples >= FREEFALL_CONFIRM_SAMPLES) {
        state.jumpState = "FREEFALL";
        state.freefallStart = timestamp;
        state.freefallSamples = 0;
        state.twistCumX = 0;
        state.twistCumY = 0;
        state.twistPeak = 0;
        state.lastGyroTime = timestamp;
      }
      break;

    case "FREEFALL": {
      if (timestamp - state.freefallStart > MAX_FREEFALL_MS) {
        state.jumpState = "GROUNDED";
        state.cooldownUntil = timestamp + POST_LANDING_COOLDOWN_MS;
        state.landingSamples = 0;
        break;
      }
      const dtSec = (timestamp - state.lastGyroTime) / 1000;
      state.lastGyroTime = timestamp;
      if (dtSec > 0 && dtSec < 0.1) {
        state.twistCumX += cGyro.x * dtSec;
        state.twistCumY += cGyro.y * dtSec;
        state.twistPeak = Math.max(
          state.twistPeak,
          Math.sqrt(state.twistCumX ** 2 + state.twistCumY ** 2),
        );
      }
      if (processedAccel > baseline + LANDING_DELTA_G) {
        state.landingSamples += 1;
      } else {
        state.landingSamples = 0;
      }
      if (state.landingSamples >= LANDING_CONFIRM_SAMPLES) {
        state.jumpState = "LANDING";
        state.landingPeak = processedAccel;
        state.landingStart = timestamp;
        state.landingSamples = 0;
        const flightMs = timestamp - state.freefallStart;
        if (flightMs >= MIN_FREEFALL_MS) {
          const heightM = 0.5 * GRAVITY_M_S2 * (flightMs / 2000) ** 2;
          state.pendingJump = {
            heightCm: Math.round(heightM * 100 * 10) / 10,
            hangTimeMs: flightMs,
          };
        } else {
          state.pendingJump = null;
        }
      }
      break;
    }

    case "LANDING":
      if (processedAccel > state.landingPeak) state.landingPeak = processedAccel;
      if (processedAccel < 1.2 || timestamp - state.landingStart > 300) {
        state.jumpState = "GROUNDED";
        state.cooldownUntil = timestamp + POST_LANDING_COOLDOWN_MS;
        if (state.pendingJump) {
          const jumpEvent = {
            heightCm: state.pendingJump.heightCm,
            hangTimeMs: state.pendingJump.hangTimeMs,
            takeoffAccelG: state.takeoffPeak,
            landingImpactG: state.landingPeak,
            twistDeg: Math.round(state.twistPeak * 10) / 10,
            timestamp: state.landingStart,
          };
          state.pendingJump = null;
          return jumpEvent;
        }
      }
      break;
  }

  return null;
}

module.exports = { detectJump };
