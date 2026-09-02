const mongoose = require("mongoose");

const swingEventSchema = new mongoose.Schema(
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
    peakAngularVelocity: { type: Number, default: 0 },
    swingDurationMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SwingEvent", swingEventSchema);
