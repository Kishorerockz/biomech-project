const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Session = require("../models/Session");
const Telemetry = require("../models/Telemetry");

const router = express.Router();

/* ─────────────────────────────────────────────
   1. POST /api/sessions/start
   Body: { athleteId, sessionType }
   Returns the created session (including sessionId)
   ───────────────────────────────────────────── */
router.post("/start", async (req, res) => {
  try {
    const { athleteId, sessionType } = req.body;
    if (!athleteId || !sessionType) {
      return res
        .status(400)
        .json({ error: "athleteId and sessionType are required" });
    }

    const session = await Session.create({
      sessionId: uuidv4(),
      athleteId,
      sessionType,
    });

    res.status(201).json(session);
  } catch (err) {
    console.error("POST /start error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   2. POST /api/sessions/:sessionId/end
   Marks session as completed, computes summary stats
   ───────────────────────────────────────────── */
router.post("/:sessionId/end", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({ sessionId });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status === "completed") {
      return res.status(400).json({ error: "Session already ended" });
    }

    // Compute summary statistics from telemetry
    const telemetryDocs = await Telemetry.find({ sessionId }).lean();
    let peakAccelerationG = 0;
    let totalAccel = 0;

    for (const t of telemetryDocs) {
      const mag = Math.sqrt(
        t.accel.x ** 2 + t.accel.y ** 2 + t.accel.z ** 2
      );
      if (mag > peakAccelerationG) peakAccelerationG = mag;
      totalAccel += mag;
    }

    const avgAccelerationG =
      telemetryDocs.length > 0 ? totalAccel / telemetryDocs.length : 0;

    session.status = "completed";
    session.endTime = new Date();
    session.peakAccelerationG = peakAccelerationG;
    session.avgAccelerationG = avgAccelerationG;
    session.totalSamples = telemetryDocs.length;
    await session.save();

    res.json(session);
  } catch (err) {
    console.error("POST /:sessionId/end error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   2b. POST /api/sessions/:sessionId/calibrate
   Body: { samples: [ { accel:{x,y,z}, gyro:{x,y,z} }, ... ] }
   Computes mean per-axis offset and stores on Session
   ───────────────────────────────────────────── */
router.post("/:sessionId/calibrate", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { samples } = req.body;

    if (!samples || !Array.isArray(samples) || samples.length === 0) {
      return res
        .status(400)
        .json({ error: "samples array is required and must be non-empty" });
    }

    const session = await Session.findOne({ sessionId });
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Compute mean offset per axis
    const sum = {
      accel: { x: 0, y: 0, z: 0 },
      gyro: { x: 0, y: 0, z: 0 },
    };

    for (const s of samples) {
      sum.accel.x += s.accel.x;
      sum.accel.y += s.accel.y;
      sum.accel.z += s.accel.z;
      sum.gyro.x += s.gyro.x;
      sum.gyro.y += s.gyro.y;
      sum.gyro.z += s.gyro.z;
    }

    const n = samples.length;
    const calibrationOffset = {
      accel: {
        x: sum.accel.x / n,
        y: sum.accel.y / n,
        z: sum.accel.z / n,
      },
      gyro: {
        x: sum.gyro.x / n,
        y: sum.gyro.y / n,
        z: sum.gyro.z / n,
      },
    };

    session.calibrationOffset = calibrationOffset;
    await session.save();

    console.log(
      `🎯  Calibration set for session ${sessionId.slice(0, 8)}…:`,
      JSON.stringify(calibrationOffset)
    );

    res.json({ sessionId, calibrationOffset });
  } catch (err) {
    console.error("POST /:sessionId/calibrate error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   3. POST /api/sessions/:sessionId/telemetry
   Body: single telemetry packet matching the data contract
   ───────────────────────────────────────────── */
router.post("/:sessionId/telemetry", async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Verify session exists and is active
    const session = await Session.findOne({ sessionId });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status === "completed") {
      return res.status(400).json({ error: "Session already ended" });
    }

    const { timestamp, accel, gyro, battery } = req.body;

    if (!timestamp || !accel || !gyro) {
      return res
        .status(400)
        .json({ error: "timestamp, accel, and gyro are required" });
    }

    const doc = await Telemetry.create({
      sessionId,
      timestamp,
      accel,
      gyro,
      battery: battery ?? null,
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error("POST /:sessionId/telemetry error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   4. GET /api/sessions/:sessionId/telemetry
   Returns all telemetry for a session, sorted by timestamp
   ───────────────────────────────────────────── */
router.get("/:sessionId/telemetry", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const docs = await Telemetry.find({ sessionId })
      .sort({ timestamp: 1 })
      .lean();
    res.json(docs);
  } catch (err) {
    console.error("GET /:sessionId/telemetry error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   5. GET /api/sessions/history/:athleteId
   Returns all sessions for an athlete, newest first
   ───────────────────────────────────────────── */
router.get("/history/:athleteId", async (req, res) => {
  try {
    const { athleteId } = req.params;
    const sessions = await Session.find({ athleteId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(sessions);
  } catch (err) {
    console.error("GET /history/:athleteId error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
