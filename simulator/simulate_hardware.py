#!/usr/bin/env python3
"""
Sports Biomechanics Wearable — Hardware Simulator (v2 – Socket.io + Calibration)
Generates synthetic accelerometer/gyroscope data mimicking a volleyball
jump cycle and sends it via Socket.io to the biomech-backend at 10 Hz.

Usage:
    python simulate_hardware.py --host http://localhost:5000 --duration 30
"""

import argparse
import math
import random
import signal
import sys
import time

import requests
import socketio

# ── Configuration ──────────────────────────────────────────────────────────
SAMPLE_RATE_HZ = 10              # 10 samples per second
SAMPLE_INTERVAL = 1.0 / SAMPLE_RATE_HZ
JUMP_CYCLE_PERIOD = 3.0          # one full jump cycle every 3 seconds
NOISE_SCALE = 0.05               # random noise amplitude (g / deg-s)
BATTERY_DRAIN_PER_SEC = 0.05     # lose ~3% per minute
CALIBRATION_DURATION = 2.0       # seconds of stationary data for calibration


def noise():
    return random.gauss(0, NOISE_SCALE)


# ── Jump-phase boundaries within one 3-second cycle (seconds) ─────────────
GROUND_END  = 0.6   # 0.0 – 0.6 s : grounded
TAKEOFF_END = 1.0   # 0.6 – 1.0 s : takeoff push
FREEFALL_END = 2.0  # 1.0 – 2.0 s : freefall / flight
LANDING_END = 2.4   # 2.0 – 2.4 s : landing impact
                    # 2.4 – 3.0 s : recovery back to ground


def generate_sample(elapsed: float) -> dict:
    """Return one synthetic telemetry sample based on elapsed time."""
    phase_t = elapsed % JUMP_CYCLE_PERIOD
    cycle_frac = phase_t / JUMP_CYCLE_PERIOD

    # ── Accelerometer (units: g) ───────────────────────────────────
    ax = 0.05 * math.sin(2 * math.pi * elapsed * 1.3)
    ay = 0.03 * math.cos(2 * math.pi * elapsed * 0.9)

    if phase_t < GROUND_END:
        az = 1.0 + 0.02 * math.sin(2 * math.pi * phase_t * 2)
    elif phase_t < TAKEOFF_END:
        frac = (phase_t - GROUND_END) / (TAKEOFF_END - GROUND_END)
        az = 1.0 + 1.2 * math.sin(frac * math.pi / 2)
    elif phase_t < FREEFALL_END:
        frac = (phase_t - TAKEOFF_END) / (FREEFALL_END - TAKEOFF_END)
        az = 2.2 * (1 - frac) * math.exp(-3 * frac) + 0.05
    elif phase_t < LANDING_END:
        frac = (phase_t - FREEFALL_END) / (LANDING_END - FREEFALL_END)
        az = 0.05 + 2.75 * math.sin(frac * math.pi)
    else:
        frac = (phase_t - LANDING_END) / (JUMP_CYCLE_PERIOD - LANDING_END)
        az = 1.0 + 0.8 * (1 - frac)

    # ── Gyroscope (units: deg/sec) ─────────────────────────────────
    gx = 15.0 * math.sin(2 * math.pi * cycle_frac)
    gy = 10.0 * math.cos(2 * math.pi * cycle_frac * 2)
    gz = 5.0 * math.sin(2 * math.pi * cycle_frac * 0.5)

    return {
        "accel": {
            "x": round(ax + noise(), 4),
            "y": round(ay + noise(), 4),
            "z": round(az + noise(), 4),
        },
        "gyro": {
            "x": round(gx + noise() * 20, 4),
            "y": round(gy + noise() * 20, 4),
            "z": round(gz + noise() * 20, 4),
        },
    }


def generate_stationary_sample() -> dict:
    """Generate a near-stationary 'at rest' sample for calibration."""
    return {
        "accel": {
            "x": round(0.0 + noise(), 4),
            "y": round(0.0 + noise(), 4),
            "z": round(1.0 + noise(), 4),  # gravity on z-axis
        },
        "gyro": {
            "x": round(0.0 + noise() * 5, 4),
            "y": round(0.0 + noise() * 5, 4),
            "z": round(0.0 + noise() * 5, 4),
        },
    }


class Simulator:
    def __init__(self, host: str, duration: float):
        self.host = host.rstrip("/")
        self.duration = duration
        self.session_id = None
        self.running = True
        self.battery = 100
        self.jump_count = 0

        # Socket.io client
        self.sio = socketio.Client()
        self._setup_socket_events()

    def _setup_socket_events(self):
        @self.sio.on("connect")
        def on_connect():
            print("   🔌  Socket.io connected")

        @self.sio.on("jump_detected")
        def on_jump(data):
            self.jump_count += 1
            print(
                f"   🦘  JUMP #{self.jump_count} detected! "
                f"Height: {data['heightCm']} cm"
            )

        @self.sio.on("disconnect")
        def on_disconnect():
            print("   🔌  Socket.io disconnected")

    # ── API helpers (REST for session management) ─────────────────
    def start_session(self):
        url = f"{self.host}/api/sessions/start"
        body = {"athleteId": "sim_athlete", "sessionType": "volleyball"}
        resp = requests.post(url, json=body, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        self.session_id = data["sessionId"]
        print(f"\n🏐  Session started: {self.session_id}")
        print(f"    Athlete : sim_athlete")
        print(f"    Type    : volleyball")
        print(f"    Duration: {self.duration}s @ {SAMPLE_RATE_HZ} Hz\n")

    def calibrate(self):
        """Send ~2 seconds of stationary data for calibration."""
        print("   📐  Calibrating (2s of stationary data)...")
        samples = []
        num_samples = int(CALIBRATION_DURATION * SAMPLE_RATE_HZ)
        for _ in range(num_samples):
            samples.append(generate_stationary_sample())
            time.sleep(SAMPLE_INTERVAL)

        url = f"{self.host}/api/sessions/{self.session_id}/calibrate"
        resp = requests.post(url, json={"samples": samples}, timeout=10)
        resp.raise_for_status()
        result = resp.json()
        cal = result["calibrationOffset"]
        print(
            f"   📐  Calibration done → "
            f"accel offset: ({cal['accel']['x']:.4f}, "
            f"{cal['accel']['y']:.4f}, {cal['accel']['z']:.4f})"
        )

    def end_session(self):
        if not self.session_id:
            return
        url = f"{self.host}/api/sessions/{self.session_id}/end"
        try:
            resp = requests.post(url, json={}, timeout=10)
            resp.raise_for_status()
            summary = resp.json()
            print("\n" + "=" * 55)
            print("📊  SESSION SUMMARY")
            print("=" * 55)
            print(f"  Session ID        : {summary.get('sessionId')}")
            print(f"  Status            : {summary.get('status')}")
            print(f"  Total Samples     : {summary.get('totalSamples')}")
            print(f"  Peak Accel (g)    : {summary.get('peakAccelerationG', 0):.4f}")
            print(f"  Avg  Accel (g)    : {summary.get('avgAccelerationG', 0):.4f}")
            print(f"  Jumps Detected    : {self.jump_count}")
            print(f"  Start Time        : {summary.get('startTime')}")
            print(f"  End Time          : {summary.get('endTime')}")
            print("=" * 55 + "\n")
        except Exception as e:
            print(f"\n⚠️  Failed to end session: {e}")

    # ── Main loop ──────────────────────────────────────────────────
    def run(self):
        self.start_session()

        # Connect Socket.io
        print("   🔌  Connecting Socket.io...")
        self.sio.connect(self.host)

        # Calibration phase (Task 3.3)
        self.calibrate()

        print(f"\n   ▶️  Starting live telemetry stream...\n")
        start_time = time.time()
        sample_count = 0

        while self.running:
            elapsed = time.time() - start_time
            if elapsed >= self.duration:
                print(f"\n⏱️  Duration ({self.duration}s) reached.")
                break

            sample = generate_sample(elapsed)
            self.battery = max(0, 100 - elapsed * BATTERY_DRAIN_PER_SEC)

            packet = {
                "sessionId": self.session_id,
                "timestamp": int(time.time() * 1000),
                **sample,
                "battery": int(self.battery),
            }

            try:
                # Send via Socket.io instead of REST
                self.sio.emit("hardware_data", packet)
                sample_count += 1

                # Progress indicator every 10 samples (1 second)
                if sample_count % 10 == 0:
                    az = sample["accel"]["z"]
                    bar = "█" * max(1, int(az * 10))
                    print(
                        f"  [{elapsed:6.1f}s] "
                        f"#{sample_count:4d}  "
                        f"az={az:+.3f}g  "
                        f"bat={int(self.battery)}%  "
                        f"{bar}"
                    )
            except Exception as e:
                print(f"  ⚠️  Send failed: {e}")

            # Sleep to maintain 10 Hz
            next_tick = start_time + (sample_count * SAMPLE_INTERVAL)
            sleep_time = next_tick - time.time()
            if sleep_time > 0:
                time.sleep(sleep_time)

        # Give server a moment to flush the buffer
        print("   ⏳  Waiting for buffer flush...")
        time.sleep(6)

        self.end_session()

        try:
            self.sio.disconnect()
        except Exception:
            pass

    def stop(self):
        print("\n\n🛑  Ctrl+C received — stopping simulator...")
        self.running = False


def main():
    parser = argparse.ArgumentParser(
        description="Sports Biomechanics Hardware Simulator"
    )
    parser.add_argument(
        "--host",
        default="http://localhost:5000",
        help="Backend API URL (default: http://localhost:5000)",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=60,
        help="Simulation duration in seconds (default: 60)",
    )
    args = parser.parse_args()

    sim = Simulator(host=args.host, duration=args.duration)

    def on_sigint(sig, frame):
        sim.stop()

    signal.signal(signal.SIGINT, on_sigint)

    try:
        sim.run()
    except Exception as e:
        print(f"\n❌  Simulator error: {e}")
        sim.end_session()
        sys.exit(1)


if __name__ == "__main__":
    main()
