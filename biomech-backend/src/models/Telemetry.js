const mongoose = require("mongoose");

const vec3 = {
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  z: { type: Number, required: true },
};

const telemetrySchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Number, // epoch milliseconds
      required: true,
    },
    accel: vec3, // units: g
    gyro: vec3, // units: deg/sec
    battery: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    /* ---- Will be populated by signal processing in Phase 3 ---- */
    processedAccel: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index for efficient time-range queries per session
telemetrySchema.index({ sessionId: 1, timestamp: 1 });

module.exports = mongoose.model("Telemetry", telemetrySchema);
