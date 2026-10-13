const mongoose = require("mongoose");

const jumpEventSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Number,
      required: true,
    },
    heightCm: { type: Number, default: 0 },
    hangTimeMs: { type: Number, default: 0 },
    landingImpactG: { type: Number, default: 0 },
    takeoffAccelG: { type: Number, default: 0 },
    twistDeg: { type: Number, default: 0 },
    sampleCount: { type: Number, default: 0 },
    samplingRateHz: { type: Number, default: 0 },
    packetLossPercent: { type: Number, default: 0 },
    signalQuality: { type: String, enum: ["good", "fair", "poor"], default: "poor" },
    valid: { type: Boolean, default: true },
    detectorVersion: { type: String, default: "backend-flight-time-v2" },
    // ML-enriched fields
    mlLabel: { type: String, enum: ["CMJ", "SJ", "DJ", "Unknown"], default: "Unknown" },
    mlConfidence: { type: Number, default: 0 },
    explosiveScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("JumpEvent", jumpEventSchema);
