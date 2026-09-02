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
  },
  { timestamps: true }
);

module.exports = mongoose.model("JumpEvent", jumpEventSchema);
