const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    athleteId: {
      type: String,
      required: true,
      index: true,
    },
    sessionType: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    /* ---- Computed on session end ---- */
    peakAccelerationG: {
      type: Number,
      default: null,
    },
    avgAccelerationG: {
      type: Number,
      default: null,
    },
    totalSamples: {
      type: Number,
      default: 0,
    },
    peakJumpCm: {
      type: Number,
      default: 0,
    },
    avgJumpCm: {
      type: Number,
      default: 0,
    },
    totalReps: {
      type: Number,
      default: 0,
    },
    attempts: [
      {
        heightCm: Number,
        timestamp: Number,
      }
    ],
    /* ---- Phase 3 Expansion Metrics ---- */
    jumpCount: { type: Number, default: 0 },
    maxHangTimeMs: { type: Number, default: 0 },
    maxLandingImpactG: { type: Number, default: 0 },
    maxTakeoffAccelG: { type: Number, default: 0 },
    jumpHeights: { type: [Number], default: [] },
    jumpConsistencyCm: { type: Number, default: null },
    maxTwistDeg: { type: Number, default: 0 },
    maxSwingAngularVelocity: { type: Number, default: 0 },
    maxSwingDurationMs: { type: Number, default: 0 },
    /* ---- Calibration (populated in Phase 3) ---- */
    calibrationOffset: {
      accel: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        z: { type: Number, default: 0 },
      },
      gyro: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        z: { type: Number, default: 0 },
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
