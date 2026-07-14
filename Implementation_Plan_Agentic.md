# Implementation Plan — Sports Biomechanics Wearable
## Structured for agentic IDE execution (e.g. Antigravity)

This plan is broken into discrete tasks with explicit inputs, outputs, and acceptance
criteria so an AI coding agent can execute them one at a time and be checked for
correctness before moving on. Feed one task (or one phase) to the agent at a time —
don't hand over the whole document at once, or it'll lose track of verification steps.

**Current state:** Phase 1 (DB + REST API) is already scaffolded in `biomech-backend/`.
Start from Task 2.1 unless you want the agent to review/refactor Phase 1 first (Task 1.0, optional).

---

## Conventions for every task

Give the agent this context block once at the start of a session, then the specific task:

```
Project: Wearable IoT sports biomechanics system.
Stack: Node.js + Express + Socket.io + MongoDB (Mongoose) backend,
React + Vite + recharts + socket.io-client frontend, Python simulator for hardware mocking.
Existing backend lives in ./biomech-backend (Session + Telemetry models, REST routes already built).
Data contract (do not change field names):
{
  "sessionId": "string",
  "timestamp": <epoch ms>,
  "accel": { "x": float, "y": float, "z": float },   // units: g
  "gyro":  { "x": float, "y": float, "z": float },   // units: deg/sec
  "battery": int (optional, 0-100)
}
```

After each task, ask the agent to (a) list every file it created/changed, (b) run/lint
the code if possible, (c) state explicitly whether the acceptance criteria are met.

---

## Task 1.0 (Optional) — Review existing Phase 1 scaffold

**Prompt to agent:**
> Review the code in `./biomech-backend`. Confirm the Session and Telemetry Mongoose
> schemas match the data contract above. Confirm all 5 REST routes work with `npm run dev`
> and a local/Atlas MongoDB connection. Do not change the schema field names. Report any
> bugs found, but don't fix silently — list them first.

**Acceptance:** Agent produces a short review; no unrequested refactors.

---

## Phase 2 — Python Hardware Simulator

### Task 2.1 — Build the simulator script

**Prompt to agent:**
> Create `simulator/simulate_hardware.py`. It should:
> - Call `POST /api/sessions/start` once at startup with `athleteId="sim_athlete"`,
>   `sessionType="volleyball"`, and store the returned `sessionId`.
> - Loop at 10Hz (use `time.sleep(0.1)`), generating synthetic accel/gyro values using
>   sine/cosine functions plus small random noise, to mimic a repeating jump motion
>   (baseline ~1g on z-axis at rest, dropping toward 0g during a simulated "flight" phase
>   every ~3 seconds, then a spike on landing).
> - POST each generated packet to `POST /api/sessions/:sessionId/telemetry` matching the
>   data contract exactly.
> - Accept `--host` (default `http://localhost:5000`) and `--duration` (seconds, default 60)
>   as CLI args via `argparse`.
> - On Ctrl+C or after `--duration`, call `POST /api/sessions/:sessionId/end` and print
>   the final session summary returned by the API.
> - Add a `requirements.txt` with `requests`.

**Acceptance:**
- `python simulate_hardware.py --duration 15` runs against the local backend without errors.
- Telemetry records appear in MongoDB (verify via `GET /api/sessions/:sessionId/telemetry`).
- Session ends and shows a non-null `peakAccelerationG` — *note: this will still be raw
  since Phase 3's filtering hasn't run yet; that's expected at this stage.*

---

## Phase 3 — WebSocket Layer + Signal Processing

### Task 3.1 — Add Socket.io to the backend

**Prompt to agent:**
> In `biomech-backend`, install `socket.io`. Modify `src/server.js` to wrap the Express
> app in an `http.Server`, attach a Socket.io instance with CORS allowing all origins
> (dev only), and listen on the same port. Add a `hardware_data` event listener that:
> - Receives a telemetry packet matching the data contract.
> - Immediately re-broadcasts it to all connected clients via a `dashboard_update` event
>   (no DB write yet — that's the next task).
> Keep all existing REST routes working unchanged.

**Acceptance:** A simple test client (agent should write a throwaway script or use
`socket.io-client` in a scratch file) connects, emits `hardware_data`, and receives
`dashboard_update` back with the same payload.

### Task 3.2 — Batched DB writes via in-memory buffer

**Prompt to agent:**
> Add an in-memory array buffer in the Socket.io `hardware_data` handler. Push each
> incoming packet into the buffer. When the buffer reaches 50 records, insert all of
> them into the `Telemetry` collection using `Telemetry.insertMany()`, then clear the
> buffer. Also flush the buffer on a 5-second interval regardless of size (so short
> test sessions under 50 packets still persist). Log a line to console each time a
> flush happens with the record count.

**Acceptance:** Run the Phase 2 simulator against this — confirm via `GET
/api/sessions/:sessionId/telemetry` that records were written in batches, not one at a time
(check server console logs show batch flushes, not 1-by-1 inserts).

### Task 3.3 — Calibration

**Prompt to agent:**
> Add a calibration step: when a session starts, the client (simulator or dashboard)
> should first send ~2 seconds of stationary telemetry. Add a new endpoint
> `POST /api/sessions/:sessionId/calibrate` that accepts an array of raw telemetry
> samples, computes the mean per-axis offset for accel and gyro, and stores it on the
> Session document as `calibrationOffset: { accel: {x,y,z}, gyro: {x,y,z} }`. Update the
> Session schema accordingly. This offset will be subtracted from all telemetry in the
> next task.

**Acceptance:** Posting a batch of near-identical "at rest" samples returns a
calibration offset close to `{accel: {x:0,y:0,z:1}, gyro:{x:0,y:0,z:0}}` (since rest
should read ~1g on z-axis).

### Task 3.4 — Noise filtering + jump detection state machine

**Prompt to agent:**
> In the `hardware_data` Socket.io handler, before buffering a packet:
> 1. Subtract the session's `calibrationOffset` (fetch/cache it per session) from the
>    raw accel/gyro values.
> 2. Apply a simple moving average (5-sample window, per session, kept in memory) to
>    smooth the calibrated accel magnitude. Store this as `processedAccel` on the
>    Telemetry record before buffering.
> 3. Implement a per-session jump-detection state machine with states
>    `GROUNDED → TAKEOFF → FREEFALL → LANDING`:
>    - `GROUNDED → TAKEOFF`: processedAccel exceeds a takeoff threshold (e.g. > 1.5g).
>    - `TAKEOFF → FREEFALL`: processedAccel drops below a freefall threshold (e.g. < 0.3g).
>    - `FREEFALL → LANDING`: processedAccel spikes again above a landing threshold.
>    - On reaching `LANDING`, if freefall duration was above a minimum (e.g. 100ms),
>      compute jump height using `h = 0.5 * g * (t_flight/2)^2` and emit a
>      `jump_detected` Socket.io event with `{ heightCm, timestamp }`. Reset to `GROUNDED`.
> 4. Make the thresholds configurable constants at the top of the file, clearly commented,
>    since they'll need tuning once real hardware is in use.

**Acceptance:** Run the simulator (Task 2.1) with its simulated jump pattern — confirm
`jump_detected` events fire at roughly the expected intervals (every ~3 seconds per the
simulator's design) with plausible height values (not wildly negative or absurd).

---

## Phase 4 — React Dashboard

### Task 4.1 — Project setup

**Prompt to agent:**
> Create a new Vite + React project in `./biomech-dashboard`. Install `recharts`,
> `socket.io-client`, and Tailwind CSS. Set up a basic layout with a header
> (project title, team names placeholder) and a main content area.

### Task 4.2 — Live telemetry view

**Prompt to agent:**
> In the dashboard, create a `LiveSession` component that:
> - Connects to the backend Socket.io server on mount (env var for backend URL).
> - Listens for `dashboard_update` events, appending `processedAccel` values to a
>   rolling array state capped at the last 50 points.
> - Renders this as a live line chart using `recharts`.
> - Listens for `jump_detected` events and displays the latest jump height in a
>   prominent "Hero Metric" card, updating only when a new jump exceeds the current
>   session max (track max in local state).

**Acceptance:** Running the simulator while the dashboard is open shows a live-updating
chart and jump height card without manual refresh.

### Task 4.3 — Session history / report view

**Prompt to agent:**
> Create a `SessionHistory` component that calls `GET /api/sessions/history/:athleteId`
> and lists past sessions (date, type, peak metrics). Clicking a session calls
> `GET /api/sessions/:sessionId/telemetry` and renders a static (non-live) recharts
> line chart of that session's `processedAccel` over time, plus the session's summary
> stats. Add simple routing (React Router or state-based tab switching) between
> "Live Session" and "History" views.

**Acceptance:** After running a few simulated sessions, they appear in history and are
individually viewable with correct charts.

---

## Phase 5 — Hardware Integration (Ruhan's track — flag as separate task set)

Not for the coding agent to implement in software repo, but the agent can scaffold the
ESP32 Arduino sketch skeleton if asked:

**Prompt to agent (optional, hand to Ruhan):**
> Write an Arduino sketch skeleton for ESP32 + MPU-6050 that reads accel/gyro at 10Hz
> over I2C, connects to WiFi, and either (a) emits Socket.io events matching the
> `hardware_data` contract using a Socket.io Arduino client library, or (b) POSTs JSON
> to `/api/sessions/:sessionId/telemetry` via HTTPClient if Socket.io libraries prove
> unreliable on ESP32. Include a small ring buffer (e.g. last 20 readings) that holds
> data if WiFi is disconnected, flushing on reconnect.

---

## Phase 6 — Polish

### Task 6.1 — Reconnection handling

**Prompt to agent:**
> On both backend and dashboard, handle Socket.io `disconnect`/`reconnect` events
> gracefully: backend should not lose the in-memory jump-detection state machine state
> for a session on a brief client disconnect (keep it keyed by `sessionId`, not by
> socket connection). Dashboard should show a "reconnecting..." indicator instead of
> silently freezing the live chart.

### Task 6.2 — Demo readiness

**Prompt to agent:**
> Add a `.env.example` for the dashboard, a top-level `README.md` for the whole repo
> (backend + simulator + dashboard) with setup instructions, and placeholders in the
> dashboard header for team names / roll numbers / project title, editable via a
> config file rather than hardcoded in JSX.

---

## How to feed this to Antigravity's agent

- Paste the **Conventions block** once per session so the agent has context it can refer back to.
- Give it **one task at a time**, in order — don't batch multiple tasks into one prompt, since verification between tasks (running the simulator, checking DB state) is what catches integration bugs early.
- After each task, actually run the acceptance check yourself (or ask the agent to run it) before moving to the next task — this is the main defense against an agent quietly introducing a bug in Phase 3 that only surfaces in Phase 4.
- If the agent's output diverges from the data contract (renamed fields, changed units), reject it and ask it to conform — that contract is what keeps Ruhan's hardware integration painless later.
