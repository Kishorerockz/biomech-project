import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useSpring, useMotionValue, useMotionValueEvent } from "motion/react";
import { socket } from "../lib/socket";
import HeroMetricCard from "./HeroMetricCard";
import LiveWaveform from "./LiveWaveform";

const MAX_POINTS = 60;

function AnimatedNumber({ value, isFloat = false }) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 50, stiffness: 200 });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useMotionValueEvent(springValue, "change", (latest) => {
    if (isFloat) {
      setDisplay(latest.toFixed(3));
    } else {
      setDisplay(Math.round(latest));
    }
  });

  return <span>{display}</span>;
}

export default function LiveSession() {
  const [telemetryData, setTelemetryData] = useState([]);
  const [latestJump, setLatestJump] = useState(null);
  const [maxJumpHeight, setMaxJumpHeight] = useState(0);
  const [totalJumpsCount, setTotalJumpsCount] = useState(0);
  const [jumpHistory, setJumpHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [packetCount, setPacketCount] = useState(0);
  const [latestAccel, setLatestAccel] = useState(null);
  const [latestRawAxes, setLatestRawAxes] = useState({ accel: { x: 0, y: 0, z: 1.0 }, gyro: { x: 0, y: 0, z: 0 } });
  const [latestBattery, setLatestBattery] = useState(null);
  const [activeChartMetric, setActiveChartMetric] = useState("processed");
  const [calibrationNotice, setCalibrationNotice] = useState(false);
  const chartDataRef = useRef([]);
  const jumpFlashRef = useRef(null);

  useEffect(() => {
    // Throttle chart rendering to ~24Hz (41ms)
    const interval = setInterval(() => {
      if (chartDataRef.current.length > 0) {
        setTelemetryData([...chartDataRef.current]);
      }
    }, 41);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    socket.connect();

    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onDashboardUpdate(data) {
      setPacketCount((c) => c + 1);
      setLatestAccel(data.processedAccel);
      setLatestBattery(data.battery);

      if (data.accel && data.gyro) {
        setLatestRawAxes({
          accel: data.accel,
          gyro: data.gyro,
        });
      }

      const timestampFormatted = new Date(data.timestamp).toLocaleTimeString("en-US", {
        hour12: false,
        minute: "2-digit",
        second: "2-digit",
      });

      const nextPoint = {
        time: timestampFormatted,
        processed: data.processedAccel ?? 1.0,
        accelZ: data.accel?.z ?? 1.0,
        gyroX: data.gyro?.x ?? 0,
        timestamp: data.timestamp,
      };

      const prev = chartDataRef.current;
      const updated = [...prev, nextPoint];
      chartDataRef.current = updated.length > MAX_POINTS ? updated.slice(-MAX_POINTS) : updated;
    }

    function onJumpDetected(data) {
      setLatestJump(data);
      setTotalJumpsCount((c) => c + 1);
      setJumpHistory((prev) => [data, ...prev].slice(0, 10));

      setMaxJumpHeight((prev) => Math.max(prev, data.heightCm));

      // Trigger visual flash
      setCalibrationNotice(true);
      if (jumpFlashRef.current) clearTimeout(jumpFlashRef.current);
      jumpFlashRef.current = setTimeout(() => {
        setCalibrationNotice(false);
      }, 3000);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("dashboard_update", onDashboardUpdate);
    socket.on("jump_detected", onJumpDetected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("dashboard_update", onDashboardUpdate);
      socket.off("jump_detected", onJumpDetected);
      socket.disconnect();
    };
  }, []);

  const getJumpRank = (height) => {
    if (!height || height === 0) return { label: "Awaiting Jump", color: "text-gray-500", icon: "⏱️" };
    if (height < 30) return { label: "Standard Hop", color: "text-amber-500", icon: "👟" };
    if (height < 55) return { label: "Athletic Jump", color: "text-cyan-400", icon: "⚡" };
    if (height < 75) return { label: "Pro Level Jump", color: "text-emerald-400", icon: "🚀" };
    return { label: "Elite World Class", color: "text-purple-500", icon: "💥" };
  };

  const jumpRank = getJumpRank(maxJumpHeight);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Connection Banner ── */}
      {!isConnected && (
        <div
          style={{
            background: "linear-gradient(90deg, #ffb703, #fb8500)",
            color: "#000",
            padding: "0.75rem 1.25rem",
            borderRadius: "var(--radius-md)",
            fontWeight: 700,
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>⚡ WebSocket Disconnected. Waiting for Backend Server on http://localhost:5000...</span>
          <button
            onClick={() => socket.connect()}
            style={{
              background: "#000",
              color: "#fff",
              border: "none",
              padding: "0.3rem 0.8rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reconnect Now
          </button>
        </div>
      )}

      {/* ── Removed Jump Splash Notification ── */}

      {/* ── Main Arena Grid: 1 Col Mobile -> 12 Cols Laptop ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Max Jump Height — Hero Card (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col justify-center">
          <HeroMetricCard liveJumpHeight={latestJump ? latestJump.heightCm : 0} />
        </div>

        {/* ── Live Acceleration Chart (8 Cols) ── */}
        <div className="lg:col-span-8 flex flex-col h-[320px] sm:h-[380px]">
          <LiveWaveform streamData={telemetryData} />
        </div>
      </div>

      {/* ── Metrics Grid: 2-Cols Mobile, 3-Cols Laptop ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Live Accel G-Force */}
        <div className="bg-card border border-border shadow-md rounded-xl p-5 flex flex-col justify-center">
          <div className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
            📊 Proc. Accel (g)
          </div>
          <div className="text-3xl font-black text-foreground leading-none font-mono tracking-tighter">
            {latestAccel !== null ? <AnimatedNumber value={latestAccel} isFloat={true} /> : "1.000"}
          </div>
          <div className="text-[10px] text-gray-500 mt-2 uppercase tracking-wide">
            Moving Avg Filter
          </div>
        </div>

        {/* Total Jumps Counter */}
        <div className="bg-card border border-border shadow-md rounded-xl p-5 flex flex-col justify-center">
          <div className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">
            🦘 Total Jumps
          </div>
          <div className="text-3xl font-black text-foreground leading-none font-mono tracking-tighter">
            <AnimatedNumber value={totalJumpsCount} />
          </div>
          <div className="text-[10px] text-gray-500 mt-2 uppercase tracking-wide">
            Current Session
          </div>
        </div>

        {/* Telemetry Packets & Battery */}
        <div className="bg-card border border-border shadow-md rounded-xl p-5 col-span-2 lg:col-span-1 flex flex-col justify-center">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">
            🔋 Hardware Stream
          </div>
          <div className="flex justify-between items-baseline">
            <div>
              <span className="text-2xl font-black text-foreground font-mono tracking-tighter">
                <AnimatedNumber value={packetCount} />
              </span>
              <span className="text-[10px] text-gray-500 ml-1 uppercase">pkts</span>
            </div>
            <div className="text-right">
              <span className={`text-lg font-bold ${latestBattery !== null && latestBattery < 20 ? "text-destructive" : "text-emerald-400"}`}>
                {latestBattery !== null ? `${latestBattery}%` : "100%"}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-gray-500 mt-2 flex items-center gap-2 uppercase tracking-wide">
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-primary animate-pulse" : "bg-gray-600"}`} />
            {isConnected ? "10Hz Active" : "Paused"}
          </div>
        </div>
      </div>

      {/* ── Real-Time Sensor Raw Vector Accordion ── */}
      <details className="bg-card border border-border shadow-md rounded-xl group">
        <summary className="p-4 font-bold text-foreground cursor-pointer outline-none marker:text-primary select-none">
          📐 Raw MPU-6050 Vectors (Expand for Debug)
        </summary>
        <div className="p-4 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Accelerometer Axes */}
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--neon-cyan)", marginBottom: "0.75rem" }}>
              ACCELEROMETER (g)
            </div>
            {["x", "y", "z"].map((axis) => {
              const val = latestRawAxes.accel[axis] || 0;
              const percent = Math.min(100, Math.max(0, ((val + 3) / 6) * 100)); // Map -3g to +3g
              return (
                <div key={axis} style={{ marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                    <span style={{ textTransform: "uppercase", fontWeight: 700 }}>Axis {axis}</span>
                    <span style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>{val.toFixed(3)}g</span>
                  </div>
                  <div className="gauge-bar-track">
                    <div
                      className="gauge-bar-fill"
                      style={{
                        width: `${percent}%`,
                        background: axis === "z" ? "var(--neon-cyan)" : axis === "x" ? "var(--neon-purple)" : "var(--neon-emerald)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gyroscope Axes */}
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--neon-purple)", marginBottom: "0.75rem" }}>
              GYROSCOPE (deg/sec)
            </div>
            {["x", "y", "z"].map((axis) => {
              const val = latestRawAxes.gyro[axis] || 0;
              const percent = Math.min(100, Math.max(0, ((val + 50) / 100) * 100));
              return (
                <div key={axis} style={{ marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                    <span style={{ textTransform: "uppercase", fontWeight: 700 }}>Gyro {axis}</span>
                    <span style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>{val.toFixed(2)}°/s</span>
                  </div>
                  <div className="gauge-bar-track">
                    <div
                      className="gauge-bar-fill"
                      style={{
                        width: `${percent}%`,
                        background: "var(--neon-purple)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      </details>

      {/* ── Recent Jump Logs ── */}
      <div className="bg-card border border-border shadow-md rounded-xl p-6">
        <h3 className="text-base font-bold text-foreground mb-4">
          📜 Jump Performance Audit Log ({jumpHistory.length})
        </h3>

        {jumpHistory.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No jumps detected yet in this live session. Trigger simulation or perform jump movements!
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {jumpHistory.map((j, i) => {
                const rank = getJumpRank(j.heightCm);
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 50 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    key={`${j.timestamp}-${j.heightCm}`}
                    className="flex justify-between items-center bg-background/30 p-4 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{rank.icon}</span>
                      <div>
                        <div className={`font-black text-[1rem] ${rank.color}`}>
                          {j.heightCm} cm
                        </div>
                        <div className="text-xs text-gray-500">
                          Recorded @ {new Date(j.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 bg-background/50 rounded-md text-xs font-bold border border-border ${rank.color}`}
                    >
                      {rank.label}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
