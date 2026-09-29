const express = require("express");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const Session = require("../models/Session");
const Telemetry = require("../models/Telemetry");
const JumpEvent = require("../models/JumpEvent");

const router = express.Router();

// In-memory fallback storage when MongoDB is not connected
const inMemorySessions = new Map();
const inMemoryTelemetry = new Map();

function calculateStdDev(values) {
  if (!values || values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return Math.round(stdDev * 10) / 10;
}

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

    const sessionId = uuidv4();
    const sessionData = {
      sessionId,
      athleteId,
      sessionType,
      status: "active",
      startTime: new Date(),
      createdAt: new Date(),
    };

    if (mongoose.connection.readyState === 1) {
      const session = await Session.create(sessionData);
      return res.status(201).json(session);
    } else {
      inMemorySessions.set(sessionId, sessionData);
      return res.status(201).json(sessionData);
    }
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

    let session;
    let telemetryDocs = [];

    if (mongoose.connection.readyState === 1) {
      session = await Session.findOne({ sessionId });
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (session.status === "completed") {
        return res.status(400).json({ error: "Session already ended" });
      }
      telemetryDocs = await Telemetry.find({ sessionId }).lean();
    } else {
      session = inMemorySessions.get(sessionId);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (session.status === "completed") {
        return res.status(400).json({ error: "Session already ended" });
      }
      telemetryDocs = inMemoryTelemetry.get(sessionId) || [];
    }

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
      
    // Fetch persisted JumpEvent documents for accurate attempts history with timestamps
    let jumpEvents = [];
    if (mongoose.connection.readyState === 1) {
      jumpEvents = await JumpEvent.find({ sessionId }).sort({ timestamp: 1 }).lean();
    }

    // Read heights from persisted session.jumpHeights array or jumpEvents
    const sessionJumpHeights = (session.jumpHeights && session.jumpHeights.length > 0)
      ? session.jumpHeights
      : jumpEvents.map(j => j.heightCm);

    let peakJumpCm = 0;
    let totalJumpCm = 0;

    for (const h of sessionJumpHeights) {
      if (h > peakJumpCm) peakJumpCm = h;
      totalJumpCm += h;
    }

    const avgJumpCm = sessionJumpHeights.length > 0
      ? parseFloat((totalJumpCm / sessionJumpHeights.length).toFixed(1))
      : 0;

    const attempts = jumpEvents.length > 0
      ? jumpEvents.map(j => ({ heightCm: j.heightCm, timestamp: j.timestamp }))
      : sessionJumpHeights.map((h, idx) => ({ heightCm: h, timestamp: Date.now() + idx }));

    session.status = "completed";
    session.endTime = new Date();
    session.peakAccelerationG = peakAccelerationG;
    session.avgAccelerationG = avgAccelerationG;
    session.totalSamples = telemetryDocs.length;
    session.peakJumpCm = peakJumpCm;
    session.avgJumpCm = avgJumpCm;
    session.totalReps = sessionJumpHeights.length;
    session.attempts = attempts;
    session.jumpHeights = sessionJumpHeights;
    session.jumpConsistencyCm = calculateStdDev(sessionJumpHeights);

    if (mongoose.connection.readyState === 1) {
      await session.save();
    } else {
      inMemorySessions.set(sessionId, session);
    }

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

    let session;
    if (mongoose.connection.readyState === 1) {
      session = await Session.findOne({ sessionId });
    } else {
      session = inMemorySessions.get(sessionId);
    }

    if (!session) return res.status(404).json({ error: "Session not found" });

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

    if (mongoose.connection.readyState === 1) {
      await session.save();
    } else {
      inMemorySessions.set(sessionId, session);
    }

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

    let session;
    if (mongoose.connection.readyState === 1) {
      session = await Session.findOne({ sessionId });
    } else {
      session = inMemorySessions.get(sessionId);
    }

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

    const doc = {
      sessionId,
      timestamp,
      accel,
      gyro,
      battery: battery ?? null,
    };

    if (mongoose.connection.readyState === 1) {
      const dbDoc = await Telemetry.create(doc);
      return res.status(201).json(dbDoc);
    } else {
      if (!inMemoryTelemetry.has(sessionId)) {
        inMemoryTelemetry.set(sessionId, []);
      }
      inMemoryTelemetry.get(sessionId).push(doc);
      return res.status(201).json(doc);
    }
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
    if (mongoose.connection.readyState === 1) {
      const docs = await Telemetry.find({ sessionId })
        .sort({ timestamp: 1 })
        .lean();
      return res.json(docs);
    } else {
      const docs = inMemoryTelemetry.get(sessionId) || [];
      return res.json(docs);
    }
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
    if (mongoose.connection.readyState === 1) {
      const sessions = await Session.find({ athleteId })
        .sort({ createdAt: -1 })
        .lean();
      return res.json(sessions);
    } else {
      const sessions = Array.from(inMemorySessions.values()).filter(
        (s) => s.athleteId === athleteId
      );
      sessions.sort((a, b) => b.createdAt - a.createdAt);
    }

    let allTimePbCm = 0;
    sessions.forEach(s => {
      const peak = s.sessionType === 'cricket' ? (s.maxSwingAngularVelocity || 0) : (s.peakJumpCm || 0);
      if (peak > allTimePbCm) allTimePbCm = peak;
    });

    const targetZoneMin = Math.round(allTimePbCm * 0.85 * 10) / 10;
    const targetZoneMax = Math.round(allTimePbCm * 1.1 * 10) / 10;
    const fatigueThreshold = Math.round(allTimePbCm * 0.7 * 10) / 10;

    return res.json({
      sessions,
      stats: {
        personalBest: allTimePbCm,
        targetZoneMin,
        targetZoneMax,
        fatigueThreshold
      }
    });
  } catch (err) {
    console.error("GET /history/:athleteId error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   6. GET /api/sessions/:sessionId/export.csv
   ───────────────────────────────────────────── */
router.get("/:sessionId/export.csv", async (req, res) => {
  try {
    const { sessionId } = req.params;
    let session;
    if (mongoose.connection.readyState === 1) {
      session = await Session.findOne({ sessionId }).lean();
    } else {
      session = inMemorySessions.get(sessionId);
    }
    if (!session) return res.status(404).json({ error: "Session not found" });

    let csv = "Rep_ID,Timestamp,Metric_Value\n";
    let attempts = [];
    if (mongoose.connection.readyState === 1) {
      const jumpEvents = await JumpEvent.find({ sessionId }).sort({ timestamp: 1 }).lean();
      if (jumpEvents.length > 0) {
        attempts = jumpEvents.map(j => ({ heightCm: j.heightCm, timestamp: j.timestamp }));
      }
    }
    if (attempts.length === 0) {
      attempts = session.attempts || [];
    }
    
    attempts.forEach((a, index) => {
      const metric = a.heightCm || a.peakAngularVelocity || 0;
      csv += `${index + 1},${a.timestamp || ''},${metric}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment(`session_${sessionId.slice(0, 8)}.csv`);
    return res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   7. GET /api/sessions/history/:athleteId/trend
   Task 3 & 5: Trend Endpoint w/ Week-over-Week
   ───────────────────────────────────────────── */
const TARGET_ZONE_MIN_MULTIPLIER = 0.85;
const TARGET_ZONE_MAX_MULTIPLIER = 1.00;
const FATIGUE_THRESHOLD_MULTIPLIER = 0.80; // 20% below trailing average

router.get("/history/:athleteId/trend", async (req, res) => {
  try {
    const { athleteId } = req.params;
    let sessions = [];
    if (mongoose.connection.readyState === 1) {
      sessions = await Session.find({ athleteId, status: "completed" }).sort({ createdAt: -1 }).lean();
    } else {
      sessions = Array.from(inMemorySessions.values()).filter(s => s.athleteId === athleteId && s.status === "completed");
      sessions.sort((a, b) => b.createdAt - a.createdAt);
    }
    
    // Sort chronological so trailing elements are older
    sessions.reverse();

    const trendData = sessions.slice(-10).map((s) => {
      const isCricket = s.sessionType === 'cricket';
      const peak = isCricket ? (s.maxSwingAngularVelocity || 0) : (s.peakJumpCm || 0);
      const avg = isCricket ? peak : (s.avgJumpCm || 0); // Fake avg for cricket until implemented
      
      let currentPB = 0;
      sessions.slice(0, sessions.indexOf(s) + 1).forEach(histItem => {
        const hPeak = histItem.sessionType === 'cricket' ? (histItem.maxSwingAngularVelocity || 0) : (histItem.peakJumpCm || 0);
        if (hPeak > currentPB) currentPB = hPeak;
      });

      const targetZoneMin = Math.round(currentPB * TARGET_ZONE_MIN_MULTIPLIER * 10) / 10;
      const targetZoneMax = Math.round(currentPB * TARGET_ZONE_MAX_MULTIPLIER * 10) / 10;
      
      const trailing5 = sessions.slice(Math.max(0, sessions.indexOf(s) - 5), sessions.indexOf(s));
      let trailingAvg = 0;
      if (trailing5.length > 0) {
        trailingAvg = trailing5.reduce((acc, ts) => acc + (ts.sessionType === 'cricket' ? (ts.maxSwingAngularVelocity || 0) : ts.avgJumpCm), 0) / trailing5.length;
      }
      
      const isFatigueFlag = trailing5.length > 0 ? (avg < (trailingAvg * FATIGUE_THRESHOLD_MULTIPLIER)) : false;

      return {
        sessionId: s.sessionId,
        date: s.startTime || s.createdAt,
        peakMetricValue: peak,
        personalBest: currentPB,
        targetZoneMin,
        targetZoneMax,
        isFatigueFlag
      };
    });

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const thisWeekSessions = sessions.filter(s => new Date(s.createdAt) >= oneWeekAgo);
    const lastWeekSessions = sessions.filter(s => {
      const d = new Date(s.createdAt);
      return d >= twoWeeksAgo && d < oneWeekAgo;
    });

    let weekOverWeekChangePercent = null;
    if (thisWeekSessions.length > 0 && lastWeekSessions.length > 0) {
      const thisWeekPeakAvg = thisWeekSessions.reduce((acc, s) => acc + (s.sessionType === 'cricket' ? (s.maxSwingAngularVelocity || 0) : (s.peakJumpCm || 0)), 0) / thisWeekSessions.length;
      const lastWeekPeakAvg = lastWeekSessions.reduce((acc, s) => acc + (s.sessionType === 'cricket' ? (s.maxSwingAngularVelocity || 0) : (s.peakJumpCm || 0)), 0) / lastWeekSessions.length;
      
      if (lastWeekPeakAvg > 0) {
        weekOverWeekChangePercent = Math.round(((thisWeekPeakAvg - lastWeekPeakAvg) / lastWeekPeakAvg) * 100 * 10) / 10;
      }
    }

    return res.json({
      trends: trendData,
      weekOverWeekChangePercent
    });

  } catch (err) {
    console.error("GET /history/:athleteId/trend error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
