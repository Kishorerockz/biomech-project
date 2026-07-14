require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server: SocketIO } = require("socket.io");
const connectDB = require("./config/db");
const sessionRoutes = require("./routes/sessions");
const Session = require("./models/Session");
const Telemetry = require("./models/Telemetry");

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
  try {
    await Telemetry.insertMany(toInsert);
    console.log(
      `💾  Flushed ${toInsert.length} records for session ${sessionId.slice(0, 8)}…`
    );
  } catch (err) {
    console.error("❌  insertMany failed:", err.message);
    // Push them back so they aren't lost
    telemetryBuffer[sessionId] = toInsert.concat(
      telemetryBuffer[sessionId] || []
    );
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
  const session = await Session.findOne({ sessionId }).lean();
  if (session && session.calibrationOffset) {
    calibrationCache[sessionId] = session.calibrationOffset;
    return session.calibrationOffset;
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
    };
  }
  return sessionState[sessionId];
}

/**
 * Apply calibration offset and compute smoothed accel magnitude.
 * Returns { calibratedAccel, calibratedGyro, processedAccel, rawAccelMag }.
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

  // 3. Simple moving average (5-sample window) on RAW magnitude
  state.movingAvgWindow.push(rawMag);
  if (state.movingAvgWindow.length > 5) {
    state.movingAvgWindow.shift();
  }
  const processedAccel =
    state.movingAvgWindow.reduce((a, b) => a + b, 0) /
    state.movingAvgWindow.length;

  return {
    calibratedAccel: cAccel,
    calibratedGyro: cGyro,
    processedAccel: Math.round(processedAccel * 10000) / 10000,
    rawAccelMag: Math.round(rawMag * 10000) / 10000,
  };
}

/**
 * Jump-detection state machine. Returns a jump event or null.
 */
function detectJump(processedAccel, timestamp, state) {
  switch (state.jumpState) {
    case "GROUNDED":
      if (processedAccel > TAKEOFF_THRESHOLD_G) {
        state.jumpState = "TAKEOFF";
      }
      break;

    case "TAKEOFF":
      if (processedAccel < FREEFALL_THRESHOLD_G) {
        state.jumpState = "FREEFALL";
        state.freefallStart = timestamp;
      }
      break;

    case "FREEFALL":
      if (processedAccel > LANDING_THRESHOLD_G) {
        state.jumpState = "LANDING";
        const flightMs = timestamp - state.freefallStart;

        if (flightMs >= MIN_FREEFALL_MS) {
          // h = 0.5 * g * (t_flight/2)^2
          const tFlightSec = flightMs / 1000;
          const halfT = tFlightSec / 2;
          const heightM = 0.5 * GRAVITY_M_S2 * halfT * halfT;
          const heightCm = Math.round(heightM * 100 * 10) / 10;

          // Reset to GROUNDED for next jump
          state.jumpState = "GROUNDED";
          state.freefallStart = null;

          return { heightCm, timestamp };
        }
        // Too short — ignore
        state.jumpState = "GROUNDED";
        state.freefallStart = null;
      }
      break;

    case "LANDING":
      // Shouldn't linger here, but reset just in case
      state.jumpState = "GROUNDED";
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

      // ── Signal processing (Task 3.4) ───────────────────────
      const { calibratedAccel, calibratedGyro, processedAccel } =
        processPacket(packet, calibration, state);

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

      // ── Broadcast to dashboard clients (Task 3.1) ──────────
      io.emit("dashboard_update", {
        ...doc,
        calibratedAccel,
        calibratedGyro,
      });

      // ── Jump detection (Task 3.4) ──────────────────────────
      const jump = detectJump(processedAccel, packet.timestamp, state);
      if (jump) {
        console.log(
          `🦘  Jump detected! ${jump.heightCm} cm @ session ${sessionId.slice(0, 8)}…`
        );
        io.emit("jump_detected", {
          sessionId,
          heightCm: jump.heightCm,
          timestamp: jump.timestamp,
        });
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
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀  biomech-backend listening on http://0.0.0.0:${PORT}`);
    console.log(`🔌  Socket.io ready`);
  });
}

start();
