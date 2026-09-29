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

// ── Configurable thresholds (tune for real hardware) ─────────────
// NOTE: These operate on RAW accel magnitude (includes gravity).
// At rest ≈ 1g, takeoff push > 1.5g, freefall < 0.3g, landing > 1.5g.
const TAKEOFF_THRESHOLD_G = 1.5;   // raw accel mag > this → TAKEOFF
const FREEFALL_THRESHOLD_G = 0.3;  // raw accel mag < this → FREEFALL
const LANDING_THRESHOLD_G = 1.5;   // raw accel mag > this → LANDING
const MIN_FREEFALL_MS = 100;       // ignore micro-jumps shorter than this
const GRAVITY_M_S2 = 9.81;

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

  // 2. Compute RAW accel magnitude (for jump detection — includes gravity)
  const rawMag = Math.sqrt(
    packet.accel.x ** 2 + packet.accel.y ** 2 + packet.accel.z ** 2
  );
  
  const rawGyroMag = Math.sqrt(
    packet.gyro.x ** 2 + packet.gyro.y ** 2 + packet.gyro.z ** 2
  );

  // 3. Simple moving average (5-sample window) on RAW magnitude
  state.movingAvgWindow.push(rawMag);
  if (state.movingAvgWindow.length > 5) {
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

    if (!isFreefall && !isRelease && rawMag > 0.8 && rawMag < 1.2) {
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
    rawAccelMag: Math.round(rawMag * 10000) / 10000,
    rawGyroMag: Math.round(rawGyroMag * 10000) / 10000,
    orientation
  };
}

/**
 * Jump-detection state machine. Returns a jump event or null.
 */
function detectJump(processedAccel, packet, cGyro, state) {
  const timestamp = packet.timestamp;
  switch (state.jumpState) {
    case "GROUNDED":
      if (processedAccel > TAKEOFF_THRESHOLD_G) {
        state.jumpState = "TAKEOFF";
        state.takeoffPeak = processedAccel;
      }
      break;

    case "TAKEOFF":
      if (processedAccel > state.takeoffPeak) {
        state.takeoffPeak = processedAccel;
      }
      if (processedAccel < FREEFALL_THRESHOLD_G) {
        state.jumpState = "FREEFALL";
        state.freefallStart = timestamp;
        state.twistCumX = 0;
        state.twistCumY = 0;
        state.twistPeak = 0;
        state.lastGyroTime = timestamp;
      }
      break;

    case "FREEFALL":
      const dtSec = (timestamp - state.lastGyroTime) / 1000;
      state.lastGyroTime = timestamp;
      if (dtSec > 0 && dtSec < 0.1) {
        state.twistCumX += cGyro.x * dtSec;
        state.twistCumY += cGyro.y * dtSec;
        const currentTwist = Math.sqrt(state.twistCumX ** 2 + state.twistCumY ** 2);
        if (currentTwist > state.twistPeak) {
          state.twistPeak = currentTwist;
        }
      }

      if (processedAccel > LANDING_THRESHOLD_G) {
        state.jumpState = "LANDING";
        state.landingPeak = processedAccel;
        state.landingStart = timestamp;
        
        const flightMs = timestamp - state.freefallStart;
        if (flightMs >= MIN_FREEFALL_MS) {
          const tFlightSec = flightMs / 1000;
          const halfT = tFlightSec / 2;
          const heightM = 0.5 * GRAVITY_M_S2 * halfT * halfT;
          const heightCm = Math.round(heightM * 100 * 10) / 10;

          state.pendingJump = { heightCm, hangTimeMs: flightMs };
        } else {
          state.pendingJump = null; // Too short
        }
      }
      break;

    case "LANDING":
      if (processedAccel > state.landingPeak) {
        state.landingPeak = processedAccel;
      }

      // End landing when return to ~1g or after 300ms timeout
      if (processedAccel < 1.2 || (timestamp - state.landingStart) > 300) {
        state.jumpState = "GROUNDED";
        if (state.pendingJump) {
          const jumpEvent = {
            heightCm: state.pendingJump.heightCm,
            hangTimeMs: state.pendingJump.hangTimeMs,
            takeoffAccelG: state.takeoffPeak,
            landingImpactG: state.landingPeak,
            twistDeg: Math.round(state.twistPeak * 10) / 10,
            timestamp: state.landingStart, // Use freefall->landing boundary
          };
          state.pendingJump = null;
          return jumpEvent;
        }
      }
      break;
  }

  return null;
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
      const { calibratedAccel, calibratedGyro, processedAccel, rawGyroMag, orientation } =
        processPacket(packet, calibration, state);

      // Calculate Stream Hz counts (Task 2)
      state.packetCount++;

      // ── Build the enriched telemetry document ──────────────
      const doc = {
        sessionId,
        timestamp: packet.timestamp,
        accel: packet.accel, // keep raw accel for reference
        gyro: packet.gyro,
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
        const jump = detectJump(processedAccel, packet, calibratedGyro, state);
        if (jump) {
          console.log(
            `🦘  Jump detected! ${jump.heightCm} cm @ session ${sessionId.slice(0, 8)}…`
          );
          
          // 1. Insert JumpEvent
          JumpEvent.create({
            sessionId,
            timestamp: jump.timestamp,
            heightCm: jump.heightCm,
            hangTimeMs: jump.hangTimeMs,
            landingImpactG: jump.landingImpactG,
            takeoffAccelG: jump.takeoffAccelG,
            twistDeg: jump.twistDeg
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
            { new: true } // ensures return of updated document though not strictly needed here
          ).catch(err => console.error("Error updating Session:", err.message));

          // 3. Emit jump_detected event
          io.emit("jump_detected", {
            sessionId,
            heightCm: jump.heightCm,
            timestamp: jump.timestamp,
            hangTimeMs: jump.hangTimeMs,
            landingImpactG: jump.landingImpactG,
            takeoffAccelG: jump.takeoffAccelG,
            twistDeg: jump.twistDeg
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
