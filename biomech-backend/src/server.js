require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server: SocketIO } = require("socket.io");
const connectDB = require("./config/db");
const sessionRoutes = require("./routes/sessions");
const Session = require("./models/Session");
const Telemetry = require("./models/Telemetry");
const JumpEvent = require("./models/JumpEvent");
const SwingEvent = require("./models/SwingEvent");
const { initML, classifyJump, predictFatigue, computeExplosiveScore } = require("./ml/JumpMLEngine");
const { detectJump: detectJumpFromStateMachine } = require("./ml/JumpDetector");
const { recordPacketTimestamp, getEventQuality } = require("./ml/PacketQuality");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

/* ── Socket.io setup (CORS open for dev) ────────────────────────── */
const io = new SocketIO(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

/* ── Middleware ── */
app.use(cors());
app.use(express.json());

/* ── Routes ── */
app.use("/api/sessions", sessionRoutes);

/* ── Health check ── */
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "biomech-backend" });
});

/* ── ML REST endpoint: get session-level ML analysis ── */
app.get("/api/ml/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const jumps = await JumpEvent.find({ sessionId }).sort({ timestamp: 1 }).lean();
    if (!jumps.length) return res.json({ error: "No jumps found for session" });

    const heights = jumps.map(j => j.heightCm);
    const fatigue = predictFatigue(heights);

    const classified = jumps.map(j => ({
      timestamp: j.timestamp,
      heightCm: j.heightCm,
      hangTimeMs: j.hangTimeMs,
      ...classifyJump({
        hangTimeMs: j.hangTimeMs,
        takeoffAccelG: j.takeoffAccelG,
        landingImpactG: j.landingImpactG,
        twistDeg: j.twistDeg,
      }),
      explosiveScore: computeExplosiveScore({
        heightCm: j.heightCm,
        takeoffAccelG: j.takeoffAccelG,
        hangTimeMs: j.hangTimeMs,
      }),
    }));

    // Jump type distribution
    const distribution = classified.reduce((acc, j) => {
      acc[j.label] = (acc[j.label] || 0) + 1;
      return acc;
    }, { CMJ: 0, SJ: 0, DJ: 0 });

    res.json({
      sessionId,
      totalJumps: jumps.length,
      fatigue,
      jumpTypeDistribution: distribution,
      classifiedJumps: classified,
      avgExplosiveScore: Math.round(
        classified.reduce((s, j) => s + j.explosiveScore, 0) / classified.length
      ),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   TASK 3.2 — In-memory telemetry buffer (batch writes)
   ══════════════════════════════════════════════════════════════════ */
const BUFFER_FLUSH_SIZE = 50;
const BUFFER_FLUSH_INTERVAL_MS = 5000;

// Global buffer: sessionId → [ telemetry docs ]
const telemetryBuffer = {};

async function flushBuffer(sessionId) {
  const buf = telemetryBuffer[sessionId];
  if (!buf || buf.length === 0) return;

  const toInsert = buf.splice(0); // drain the buffer
  if (require("mongoose").connection.readyState !== 1) {
    // MongoDB offline - silently keep in memory buffer cleared
    return;
  }
  try {
    await Telemetry.insertMany(toInsert);
    console.log(
      `💾  Flushed ${toInsert.length} records for session ${sessionId.slice(0, 8)}…`
    );
  } catch (err) {
    console.error("❌  insertMany failed:", err.message);
  }
}

// Periodic flush (catches short sessions with < 50 packets)
setInterval(() => {
  for (const sid of Object.keys(telemetryBuffer)) {
    flushBuffer(sid);
  }
}, BUFFER_FLUSH_INTERVAL_MS);

/* ══════════════════════════════════════════════════════════════════
   TASK 3.3 — Calibration offset cache (per session)
   ══════════════════════════════════════════════════════════════════ */
const calibrationCache = {}; // sessionId → { accel:{x,y,z}, gyro:{x,y,z} }

async function getCalibration(sessionId) {
  if (calibrationCache[sessionId]) return calibrationCache[sessionId];
  if (require("mongoose").connection.readyState === 1) {
    const session = await Session.findOne({ sessionId }).lean();
    if (session && session.calibrationOffset) {
      calibrationCache[sessionId] = session.calibrationOffset;
      return session.calibrationOffset;
    }
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════
   TASK 3.4 — Signal processing + jump-detection state machine
   ══════════════════════════════════════════════════════════════════ */

// ── Signal-processing constants ─────────────────────────────────
// Firmware sends calibrated raw int16 values (±8g range -> 4096 LSB/g).
const LSB_PER_G = 4096.0;           // MPU-6050 ±8g range sensitivity
const COMPLEMENTARY_FILTER_ALPHA = 0.98; // 98% gyro / 2% accel correction per step

// Per-session state
const sessionState = {};
// sessionState[sid] = {
//   movingAvgWindow: [],      // last 5 accel magnitudes (raw)
//   jumpState: "GROUNDED",    // GROUNDED | TAKEOFF | FREEFALL | LANDING
//   freefallStart: null,      // timestamp (ms) when freefall began
// }


function getOrCreateState(sessionId) {
  if (!sessionState[sessionId]) {
    sessionState[sessionId] = {
      movingAvgWindow: [],
      jumpState: "GROUNDED",
      baselineG: 1.0,
      takeoffSamples: 0,
      freefallSamples: 0,
      landingSamples: 0,
      cooldownUntil: 0,
      freefallStart: null,
      takeoffPeak: 0,
      landingPeak: 0,
      twistCumX: 0,
      twistCumY: 0,
      twistPeak: 0,
      lastGyroTime: null,
      pendingJump: null,
      landingStart: null,
      swingState: "IDLE",
      windupStart: null,
      swingPeakVelocity: 0,
      sessionType: null,
      euler: { pitch: 0, yaw: 0, roll: 0 },
      lastFusionTime: null,
      packetCount: 0, // Task 2 tracking
      totalPacketCount: 0,
      droppedPacketCount: 0,
      invalidTimestampCount: 0,
      firstPacketTimestamp: null,
      lastPacketTimestamp: null,
    };
  }
  return sessionState[sessionId];
}

function eulerToQuaternion(pitchDeg, yawDeg, rollDeg) {
  const p = (pitchDeg * Math.PI) / 180 / 2;
  const y = (yawDeg * Math.PI) / 180 / 2;
  const r = (rollDeg * Math.PI) / 180 / 2;

  const cp = Math.cos(p);
  const sp = Math.sin(p);
  const cy = Math.cos(y);
  const sy = Math.sin(y);
  const cr = Math.cos(r);
  const sr = Math.sin(r);

  return {
    w: cr * cp * cy + sr * sp * sy,
    x: sr * cp * cy - cr * sp * sy,
    y: cr * sp * cy + sr * cp * sy,
    z: cr * cp * sy - sr * sp * cy
  };
}

/**
 * Apply calibration offset, compute smoothed accel magnitude, and sensor fusion.
 * Returns { calibratedAccel, calibratedGyro, processedAccel, rawAccelMag, orientation }.
 */
function processPacket(packet, calibration, state) {
  const cal = calibration || {
    accel: { x: 0, y: 0, z: 0 },
    gyro: { x: 0, y: 0, z: 0 },
  };

  // 1. Subtract calibration offset
  const cAccel = {
    x: packet.accel.x - cal.accel.x,
    y: packet.accel.y - cal.accel.y,
    z: packet.accel.z - cal.accel.z,
  };
  const cGyro = {
    x: packet.gyro.x - cal.gyro.x,
    y: packet.gyro.y - cal.gyro.y,
    z: packet.gyro.z - cal.gyro.z,
  };

  // 2. Convert raw LSB values → G-force, then compute magnitude
  // CRITICAL FIX: firmware sends int16 LSB (±8g range = 4096 LSB/g).
  // Must divide by LSB_PER_G before comparing against G-force thresholds!
  const accelXg = cAccel.x / LSB_PER_G;
  const accelYg = cAccel.y / LSB_PER_G;
  const accelZg = cAccel.z / LSB_PER_G;
  const rawAccelMagG = Math.sqrt(accelXg ** 2 + accelYg ** 2 + accelZg ** 2);

  const rawGyroMag = Math.sqrt(
    packet.gyro.x ** 2 + packet.gyro.y ** 2 + packet.gyro.z ** 2
  );

  // 3. Simple moving average (3-sample window) on G-force magnitude for display
  state.movingAvgWindow.push(rawAccelMagG);
  if (state.movingAvgWindow.length > 3) {
    state.movingAvgWindow.shift();
  }
  const processedAccel =
    state.movingAvgWindow.reduce((a, b) => a + b, 0) /
    state.movingAvgWindow.length;

  // 4. Integrator for Sensor Fusion (Euler to Quaternion) - Task 1
  const timestamp = packet.timestamp;
  if (!state.lastFusionTime) state.lastFusionTime = timestamp;
  const dt = (timestamp - state.lastFusionTime) / 1000;
  state.lastFusionTime = timestamp;

  if (dt > 0 && dt < 1) {
    let newPitch = state.euler.pitch + cGyro.x * dt;
    let newYaw   = state.euler.yaw   + cGyro.y * dt;
    let newRoll  = state.euler.roll  + cGyro.z * dt;

    const isFreefall = state.jumpState === "FREEFALL";
    const isRelease = state.swingState === "RELEASE";

    if (!isFreefall && !isRelease && rawAccelMagG > 0.8 && rawAccelMagG < 1.2) {
      const accelPitchDeg = Math.atan2(packet.accel.y, Math.sqrt(packet.accel.x ** 2 + packet.accel.z ** 2)) * (180 / Math.PI);
      const accelRollDeg  = Math.atan2(-packet.accel.x, packet.accel.z) * (180 / Math.PI);

      newPitch = COMPLEMENTARY_FILTER_ALPHA * newPitch + (1 - COMPLEMENTARY_FILTER_ALPHA) * accelPitchDeg;
      newRoll  = COMPLEMENTARY_FILTER_ALPHA * newRoll  + (1 - COMPLEMENTARY_FILTER_ALPHA) * accelRollDeg;
    }

    state.euler.pitch = newPitch;
    state.euler.yaw   = newYaw;
    state.euler.roll  = newRoll;
  }
  const orientation = eulerToQuaternion(state.euler.pitch, state.euler.yaw, state.euler.roll);

  return {
    calibratedAccel: cAccel,
    calibratedGyro: cGyro,
    processedAccel: Math.round(processedAccel * 10000) / 10000,
    rawAccelMagG: Math.round(rawAccelMagG * 10000) / 10000, // G-force magnitude used for jump detection
    rawGyroMag: Math.round(rawGyroMag * 10000) / 10000,
    orientation
  };
}

/* ══════════════════════════════════════════════════════════════════
   Cricket Arm-Swing Detection (Task D)
   ══════════════════════════════════════════════════════════════════ */
const WINDUP_THRESHOLD_DEG = 150;
const RELEASE_THRESHOLD_DEG = 700;

function detectSwing(rawGyroMag, timestamp, state) {
  switch (state.swingState) {
    case "IDLE":
      if (rawGyroMag > WINDUP_THRESHOLD_DEG) {
        state.swingState = "WINDUP";
        state.windupStart = timestamp;
      }
      break;

    case "WINDUP":
      if (rawGyroMag > RELEASE_THRESHOLD_DEG) {
        state.swingState = "RELEASE";
        state.swingPeakVelocity = rawGyroMag;
      } else if (rawGyroMag < WINDUP_THRESHOLD_DEG / 2) {
        state.swingState = "IDLE"; // false alarm
      }
      break;

    case "RELEASE":
      if (rawGyroMag > state.swingPeakVelocity) {
        state.swingPeakVelocity = rawGyroMag;
      }
      if (rawGyroMag < WINDUP_THRESHOLD_DEG) { // followthrough threshold
        const event = {
          peakAngularVelocity: Math.round(state.swingPeakVelocity * 10) / 10,
          swingDurationMs: timestamp - state.windupStart
        };
        state.swingState = "IDLE";
        return event;
      }
      break;
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════
   Socket.io connection handler
   ══════════════════════════════════════════════════════════════════ */
io.on("connection", (socket) => {
  console.log(`🔌  Client connected: ${socket.id}`);

  socket.on("hardware_data", async (packet) => {
    try {
      const { sessionId } = packet;
      if (!sessionId) return;

      // ── Get calibration & per-session state ────────────────
      const calibration = await getCalibration(sessionId);
      const state = getOrCreateState(sessionId);
      
      let sType = state.sessionType;
      if (!sType) {
        if (require("mongoose").connection.readyState === 1) {
          const sess = await Session.findOne({ sessionId }).select("sessionType").lean();
          if (sess) sType = sess.sessionType;
        }
        state.sessionType = sType || "volleyball"; // default
      }

      // ── Signal processing (Task 3.4 & 4) ───────────────────────
      if (!recordPacketTimestamp(state, packet.timestamp)) return;
      const { calibratedAccel, calibratedGyro, processedAccel, rawAccelMagG, rawGyroMag, orientation } =
        processPacket(packet, calibration, state);

      // Calculate Stream Hz counts (Task 2)
      state.packetCount++;

      // ── Build the enriched telemetry document ──────────────
      const doc = {
        sessionId,
        timestamp: packet.timestamp,
        accel: packet.accel, // keep raw accel for reference
        gyro: packet.gyro,
        packetVersion: packet.v ?? 1,
        battery: packet.battery ?? null,
        processedAccel,
      };

      // ── Buffer for batched DB write (Task 3.2) ─────────────
      if (!telemetryBuffer[sessionId]) telemetryBuffer[sessionId] = [];
      telemetryBuffer[sessionId].push(doc);
      if (telemetryBuffer[sessionId].length >= BUFFER_FLUSH_SIZE) {
        flushBuffer(sessionId);
      }

      // ── Broadcast to dashboard clients (Task 1) ──────────
      io.emit("dashboard_update", {
        ...doc,
        calibratedAccel,
        calibratedGyro,
        orientation // Exclusively live-only rotation per Task 1
      });

      // ── Jump / Swing detection ───────────────────────────────
      if (state.sessionType === "cricket") {
        const swing = detectSwing(rawGyroMag, packet.timestamp, state);
        if (swing) {
          console.log(`🏏  Swing detected! ${swing.peakAngularVelocity} deg/s @ session ${sessionId.slice(0, 8)}…`);
          
          SwingEvent.create({
            sessionId,
            timestamp: packet.timestamp,
            peakAngularVelocity: swing.peakAngularVelocity,
            swingDurationMs: swing.swingDurationMs
          }).catch(err => console.error("Error saving SwingEvent:", err.message));

          Session.findOneAndUpdate(
            { sessionId },
            {
              $max: {
                maxSwingAngularVelocity: swing.peakAngularVelocity,
                maxSwingDurationMs: swing.swingDurationMs
              }
            }
          ).catch(err => console.error("Error updating Session:", err.message));

          io.emit("swing_detected", {
            sessionId,
            timestamp: packet.timestamp,
            peakAngularVelocity: swing.peakAngularVelocity,
            swingDurationMs: swing.swingDurationMs
          });
        }
      } else {
        // Use rawAccelMagG (G-force, unsmoothed) for jump detection so the sharp
        // freefall dip and landing spike aren't averaged away by the display filter.
        const jump = detectJumpFromStateMachine(rawAccelMagG, packet, calibratedGyro, state);
        if (jump) {
          console.log(
            `🦘  Jump detected! ${jump.heightCm} cm @ session ${sessionId.slice(0, 8)}…`
          );

          const quality = getEventQuality(state);
          const mlClass = quality.valid
            ? classifyJump({
              heightCm:       jump.heightCm,
                hangTimeMs:     jump.hangTimeMs,
                takeoffAccelG:  jump.takeoffAccelG,
                landingImpactG: jump.landingImpactG,
                twistDeg:       jump.twistDeg,
              })
            : {
                label: "Unknown",
                confidence: 0,
                scores: { CMJ: 0, SJ: 0, DJ: 0 },
              };
          const explosiveScore = quality.valid
            ? computeExplosiveScore({
                heightCm:       jump.heightCm,
                takeoffAccelG:  jump.takeoffAccelG,
                hangTimeMs:     jump.hangTimeMs,
              })
            : 0;

          // Only valid events contribute to fatigue metrics.
          if (!state.sessionJumps) state.sessionJumps = [];
          if (quality.valid) {
            state.sessionJumps.push({
              heightCm: jump.heightCm,
              takeoffAccelG: jump.takeoffAccelG,
              landingImpactG: jump.landingImpactG,
            });
          }
          const fatigue = predictFatigue(state.sessionJumps);

          console.log(
            `[ML] 🤖 Jump classified as ${mlClass.label} (${mlClass.confidence}% confidence) | ` +
            `Explosive: ${explosiveScore}/100 | Fatigue: ${(fatigue.fatigueScore * 100).toFixed(0)}%`
          );
          
          // 1. Insert JumpEvent
          JumpEvent.create({
            sessionId,
            timestamp: jump.timestamp,
            heightCm: jump.heightCm,
            hangTimeMs: jump.hangTimeMs,
            landingImpactG: jump.landingImpactG,
            takeoffAccelG: jump.takeoffAccelG,
            twistDeg: jump.twistDeg,
            ...quality,
            mlLabel: mlClass.label,
            mlConfidence: mlClass.confidence,
            explosiveScore,
          }).catch(err => console.error("Error saving JumpEvent:", err.message));

          // 2. Update parent Session
          Session.findOneAndUpdate(
            { sessionId },
            {
              $inc: { jumpCount: 1 },
              $push: { jumpHeights: jump.heightCm },
              $max: {
                maxHangTimeMs: jump.hangTimeMs,
                maxLandingImpactG: jump.landingImpactG,
                maxTakeoffAccelG: jump.takeoffAccelG,
                maxTwistDeg: jump.twistDeg
              }
            },
            { new: true }
          ).catch(err => console.error("Error updating Session:", err.message));

          // 3. Emit jump_detected event
          io.emit("jump_detected", {
            sessionId,
            heightCm: jump.heightCm,
            timestamp: jump.timestamp,
            hangTimeMs: jump.hangTimeMs,
            landingImpactG: jump.landingImpactG,
            takeoffAccelG: jump.takeoffAccelG,
            twistDeg: jump.twistDeg,
            ...quality,
            mlLabel: mlClass.label,
            mlConfidence: mlClass.confidence,
            mlScores: mlClass.scores,
            explosiveScore,
          });

          // 4. Emit ML insight event (fatigue + live classification)
          io.emit("ml_insight", {
            sessionId,
            jumpType:       mlClass.label,
            confidence:     mlClass.confidence,
            scores:         mlClass.scores,
            explosiveScore,
            fatigue,
            timestamp:      jump.timestamp,
          });
        }
      }
    } catch (err) {
      console.error("hardware_data error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔌  Client disconnected: ${socket.id}`);
  });
});

/* ── Start ── */
async function start() {
  await connectDB();

  // Initialise ML engine (trains neural net — completes in <200ms)
  initML();

  // Task 2: Emit stream_stats every 1000ms
  setInterval(() => {
    for (const sid of Object.keys(sessionState)) {
      const s = sessionState[sid];
      io.emit("stream_stats", { sessionId: sid, hz: s.packetCount });
      s.packetCount = 0;
    }
  }, 1000);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀  biomech-backend listening on http://0.0.0.0:${PORT}`);
    console.log(`🔌  Socket.io ready`);
  });
}

start();
