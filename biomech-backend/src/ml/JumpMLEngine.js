/**
 * JumpMLEngine.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Lightweight ML engine for jump classification & fatigue prediction.
 *
 * Uses brain.js (tiny neural network, pure JS — no Python/TF required).
 *
 * MODELS:
 *  1. Jump Type Classifier (CMJ / SJ / DJ)
 *     - Countermovement Jump (CMJ): explosive + deep dip, high takeoffG
 *     - Squat Jump (SJ):            no dip, moderate takeoffG, high hang time
 *     - Drop Jump (DJ):             high landing impact, short ground contact
 *
 *  2. Fatigue Predictor (0.0 – 1.0 fatigue score)
 *     - Analyses the last N jumps within a session for height decline trend
 *     - Outputs fatigue score + recommendation (Rest / Continue / Peak)
 *
 * WHY BRAIN.JS?
 *  Pure JavaScript, no Python runtime, works inside Node.js directly.
 *  Training takes <100ms on a small dataset. Ideal for edge/IoT backends.
 * ═══════════════════════════════════════════════════════════════════════════
 */

let brain;
try {
  brain = require("brain.js");
} catch (e) {
  console.warn("[ML] brain.js not installed — ML features will use rule-based fallback");
  brain = null;
}

// ── Normalisation helpers ────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const norm  = (v, lo, hi) => clamp((v - lo) / (hi - lo), 0, 1);
const flightHeightCm = (hangTimeMs) => 122.625 * (hangTimeMs / 1000) ** 2;

// ── Training data for jump type classifier ────────────────────────────────
// Features: [hangTimeNorm, heightNorm, takeoffGNorm, landingGNorm, twistNorm]
// Labels: { CMJ, SJ, DJ } — one-hot
const JUMP_TRAINING_DATA = [
  // CMJ (high takeoff, moderate hang, moderate landing)
  { input: [norm(380, 100, 800), norm(flightHeightCm(380), 0, 80), norm(2.8, 1.0, 4.5), norm(2.0, 1.0, 5.0), norm(5, 0, 180)],  output: { CMJ: 1, SJ: 0, DJ: 0 } },
  { input: [norm(350, 100, 800), norm(flightHeightCm(350), 0, 80), norm(2.6, 1.0, 4.5), norm(1.9, 1.0, 5.0), norm(3, 0, 180)],  output: { CMJ: 1, SJ: 0, DJ: 0 } },
  { input: [norm(400, 100, 800), norm(flightHeightCm(400), 0, 80), norm(3.0, 1.0, 4.5), norm(2.1, 1.0, 5.0), norm(8, 0, 180)],  output: { CMJ: 1, SJ: 0, DJ: 0 } },
  { input: [norm(310, 100, 800), norm(flightHeightCm(310), 0, 80), norm(2.4, 1.0, 4.5), norm(1.8, 1.0, 5.0), norm(2, 0, 180)],  output: { CMJ: 1, SJ: 0, DJ: 0 } },
  { input: [norm(430, 100, 800), norm(flightHeightCm(430), 0, 80), norm(3.2, 1.0, 4.5), norm(2.3, 1.0, 5.0), norm(10, 0, 180)], output: { CMJ: 1, SJ: 0, DJ: 0 } },

  // SJ (high hang, lower takeoffG — no pre-stretch)
  { input: [norm(450, 100, 800), norm(flightHeightCm(450), 0, 80), norm(1.8, 1.0, 4.5), norm(1.7, 1.0, 5.0), norm(2, 0, 180)],  output: { CMJ: 0, SJ: 1, DJ: 0 } },
  { input: [norm(480, 100, 800), norm(flightHeightCm(480), 0, 80), norm(1.9, 1.0, 4.5), norm(1.6, 1.0, 5.0), norm(4, 0, 180)],  output: { CMJ: 0, SJ: 1, DJ: 0 } },
  { input: [norm(420, 100, 800), norm(flightHeightCm(420), 0, 80), norm(1.7, 1.0, 4.5), norm(1.8, 1.0, 5.0), norm(1, 0, 180)],  output: { CMJ: 0, SJ: 1, DJ: 0 } },
  { input: [norm(500, 100, 800), norm(flightHeightCm(500), 0, 80), norm(2.0, 1.0, 4.5), norm(1.5, 1.0, 5.0), norm(3, 0, 180)],  output: { CMJ: 0, SJ: 1, DJ: 0 } },
  { input: [norm(410, 100, 800), norm(flightHeightCm(410), 0, 80), norm(1.6, 1.0, 4.5), norm(1.9, 1.0, 5.0), norm(5, 0, 180)],  output: { CMJ: 0, SJ: 1, DJ: 0 } },

  // DJ (short hang, very high landing impact — reactive)
  { input: [norm(180, 100, 800), norm(flightHeightCm(180), 0, 80), norm(2.2, 1.0, 4.5), norm(3.5, 1.0, 5.0), norm(5, 0, 180)],  output: { CMJ: 0, SJ: 0, DJ: 1 } },
  { input: [norm(160, 100, 800), norm(flightHeightCm(160), 0, 80), norm(2.0, 1.0, 4.5), norm(3.8, 1.0, 5.0), norm(3, 0, 180)],  output: { CMJ: 0, SJ: 0, DJ: 1 } },
  { input: [norm(200, 100, 800), norm(flightHeightCm(200), 0, 80), norm(2.3, 1.0, 4.5), norm(4.0, 1.0, 5.0), norm(7, 0, 180)],  output: { CMJ: 0, SJ: 0, DJ: 1 } },
  { input: [norm(150, 100, 800), norm(flightHeightCm(150), 0, 80), norm(1.9, 1.0, 4.5), norm(3.6, 1.0, 5.0), norm(4, 0, 180)],  output: { CMJ: 0, SJ: 0, DJ: 1 } },
  { input: [norm(220, 100, 800), norm(flightHeightCm(220), 0, 80), norm(2.5, 1.0, 4.5), norm(3.2, 1.0, 5.0), norm(2, 0, 180)],  output: { CMJ: 0, SJ: 0, DJ: 1 } },
];

// ── Neural net configuration ─────────────────────────────────────────────
const NET_CONFIG = {
  hiddenLayers: [8, 6],
  activation: "sigmoid",
  learningRate: 0.1,
};

const TRAIN_OPTIONS = {
  iterations: 5000,
  errorThresh: 0.005,
  log: false,
};

const MIN_CLASS_CONFIDENCE = 0.60;
const MIN_CLASS_MARGIN = 0.10;

// ── Module state ─────────────────────────────────────────────────────────
let jumpClassifierNet = null;
let isModelReady = false;

/**
 * Initialise and train the neural network.
 * Call once at server startup — completes in <200ms.
 */
function initML() {
  if (!brain) {
    console.log("[ML] Running in rule-based fallback mode (brain.js unavailable)");
    isModelReady = false;
    return;
  }

  try {
    jumpClassifierNet = new brain.NeuralNetwork(NET_CONFIG);
    const result = jumpClassifierNet.train(JUMP_TRAINING_DATA, TRAIN_OPTIONS);
    isModelReady = true;
    console.log(`[ML] ✅ Jump classifier trained — error: ${result.error.toFixed(5)}, iterations: ${result.iterations}`);
  } catch (err) {
    console.error("[ML] ❌ Training failed:", err.message);
    isModelReady = false;
  }
}

// ── Jump type classification ─────────────────────────────────────────────

/**
 * Classify the type of a single jump.
 * @param {Object} jump  { heightCm, hangTimeMs, takeoffAccelG, landingImpactG, twistDeg }
 * @returns {{ label: 'CMJ'|'SJ'|'DJ'|'Unknown', confidence: number, scores: Object }}
 */
function classifyJump(jump) {
  const { heightCm = flightHeightCm(300), hangTimeMs = 300, takeoffAccelG = 2.0, landingImpactG = 1.8, twistDeg = 0 } = jump;

  const inputVec = [
    norm(hangTimeMs,    100, 800),
    norm(heightCm,      0, 80),
    norm(takeoffAccelG, 1.0, 4.5),
    norm(landingImpactG, 1.0, 5.0),
    norm(twistDeg,      0, 180),
  ];

  let scores;

  if (isModelReady && jumpClassifierNet) {
    // Neural net inference
    scores = jumpClassifierNet.run(inputVec);
  } else {
    // Rule-based fallback
    scores = ruleBasedClassify(hangTimeMs, takeoffAccelG, landingImpactG);
  }

  const classification = applyConfidencePolicy(scores);

  return {
    label: classification.label,
    confidence: classification.confidence,
    scores: {
      CMJ: Math.round((scores.CMJ || 0) * 100),
      SJ:  Math.round((scores.SJ  || 0) * 100),
      DJ:  Math.round((scores.DJ  || 0) * 100),
    },
  };
}

function applyConfidencePolicy(scores) {
  const rankedLabels = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  const bestLabel = rankedLabels[0];
  const bestScore = scores[bestLabel] || 0;
  const secondScore = scores[rankedLabels[1]] || 0;
  const confidence = Math.round(bestScore * 100);
  const isConfident = bestScore >= MIN_CLASS_CONFIDENCE &&
    bestScore - secondScore >= MIN_CLASS_MARGIN;

  return {
    label: isConfident ? bestLabel : "Unknown",
    confidence,
  };
}

/** Simple rule-based classifier used as fallback */
function ruleBasedClassify(hangTimeMs, takeoffG, landingG) {
  // DJ: short flight, big landing shock
  if (hangTimeMs < 220 && landingG > 3.0) {
    return { CMJ: 0.1, SJ: 0.1, DJ: 0.8 };
  }
  // CMJ: high explosive takeoff
  if (takeoffG > 2.2 && hangTimeMs < 420) {
    return { CMJ: 0.75, SJ: 0.15, DJ: 0.1 };
  }
  // SJ: moderate takeoff, longer hang
  return { CMJ: 0.1, SJ: 0.8, DJ: 0.1 };
}

// ── Fatigue prediction ────────────────────────────────────────────────────

/**
 * Analyse the last N jumps in a session and compute a fatigue score.
 * @param {(number|Object)[]} jumps  Heights or validated jump metric objects in chronological order.
 * @returns {{ fatigueScore: number, trend: string, recommendation: string, declinePercent: number }}
 */
function predictFatigue(jumps) {
  if (!jumps || jumps.length < 5) {
    return {
      fatigueScore: 0,
      trend: "insufficient_data",
      recommendation: "Keep jumping to collect at least 5 valid jumps for fatigue analysis.",
      declinePercent: 0,
    };
  }

  const normalizedJumps = jumps.map((jump) => typeof jump === "number" ? { heightCm: jump } : jump);
  const n = normalizedJumps.length;
  // Use last 8 jumps max
  const recent = normalizedJumps.slice(-8);
  const first  = recent.slice(0, Math.ceil(recent.length / 2));
  const last   = recent.slice(Math.ceil(recent.length / 2));

  const heights = recent.map((jump) => Number(jump.heightCm) || 0);
  const avgFirst = first.reduce((sum, jump) => sum + (Number(jump.heightCm) || 0), 0) / first.length;
  const avgLast  = last.reduce((sum, jump) => sum + (Number(jump.heightCm) || 0), 0) / last.length;

  const declinePercent = avgFirst > 0 ? ((avgFirst - avgLast) / avgFirst) * 100 : 0;

  // Variance in last 4 jumps — high variance = erratic performance
  const variance = computeVariance(heights.slice(-4));
  const cvPercent = avgLast > 0 ? (Math.sqrt(variance) / avgLast) * 100 : 0;
  const firstTakeoff = averageMetric(first, "takeoffAccelG");
  const lastTakeoff = averageMetric(last, "takeoffAccelG");
  const takeoffDeclinePercent = firstTakeoff > 0
    ? Math.max(0, ((firstTakeoff - lastTakeoff) / firstTakeoff) * 100)
    : 0;
  const firstLanding = averageMetric(first, "landingImpactG");
  const lastLanding = averageMetric(last, "landingImpactG");
  const landingIncreasePercent = firstLanding > 0
    ? Math.max(0, ((lastLanding - firstLanding) / firstLanding) * 100)
    : 0;

  // Fatigue score: 0 = fresh, 1 = exhausted
  let fatigueScore = clamp(
    declinePercent * 0.03 + cvPercent * 0.015 + takeoffDeclinePercent * 0.01 + landingIncreasePercent * 0.005,
    0, 1
  );

  let trend, recommendation;
  if (fatigueScore < 0.2) {
    trend = "stable";
    recommendation = "Performance is stable. You're in peak condition. Push harder!";
  } else if (fatigueScore < 0.45) {
    trend = "mild_decline";
    recommendation = "Slight fatigue detected. Maintain form and rest after 3–5 more reps.";
  } else if (fatigueScore < 0.7) {
    trend = "moderate_decline";
    recommendation = "Moderate fatigue detected. Consider a 2-minute rest to prevent injury.";
  } else {
    trend = "high_fatigue";
    recommendation = "High fatigue detected! Stop jumping and rest for 5+ minutes.";
  }

  return {
    fatigueScore: Math.round(fatigueScore * 100) / 100,
    trend,
    recommendation,
    declinePercent: Math.round(declinePercent * 10) / 10,
    cvPercent: Math.round(cvPercent * 10) / 10,
    takeoffDeclinePercent: Math.round(takeoffDeclinePercent * 10) / 10,
    landingIncreasePercent: Math.round(landingIncreasePercent * 10) / 10,
    totalJumps: n,
  };
}

function averageMetric(jumps, field) {
  const values = jumps
    .map((jump) => Number(jump[field]))
    .filter((value) => Number.isFinite(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function computeVariance(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
}

// ── Explosive Power Score ────────────────────────────────────────────────

/**
 * Compute an Explosive Power Score (0–100) using jump physics.
 * Combines height, takeoff rate-of-force development, and hang time quality.
 */
function computeExplosiveScore(jump) {
  const { heightCm = 0, takeoffAccelG = 1.0, hangTimeMs = 0 } = jump;

  // Normalise each sub-metric to 0-100
  const heightScore  = norm(heightCm, 0, 80) * 100;
  const rfdScore     = norm(takeoffAccelG, 1.0, 4.0) * 100;
  const hangScore    = norm(hangTimeMs, 100, 700) * 100;

  // Weighted combination
  const explosiveScore = heightScore * 0.5 + rfdScore * 0.3 + hangScore * 0.2;
  return Math.round(clamp(explosiveScore, 0, 100));
}

// ── Public API ────────────────────────────────────────────────────────────

module.exports = {
  initML,
  classifyJump,
  predictFatigue,
  computeExplosiveScore,
  applyConfidencePolicy,
  isReady: () => isModelReady,
};
