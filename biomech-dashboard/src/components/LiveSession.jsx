import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { socket } from "../lib/socket";

const MAX_POINTS = 50;

export default function LiveSession() {
  const [telemetryData, setTelemetryData] = useState([]);
  const [latestJump, setLatestJump] = useState(null);
  const [maxJumpHeight, setMaxJumpHeight] = useState(0);
  const [jumpHistory, setJumpHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [packetCount, setPacketCount] = useState(0);
  const [latestAccel, setLatestAccel] = useState(null);
  const [latestBattery, setLatestBattery] = useState(null);
  const jumpTimeoutRef = useRef(null);

  useEffect(() => {
    // Connect socket
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

      setTelemetryData((prev) => {
        const next = [
          ...prev,
          {
            time: new Date(data.timestamp).toLocaleTimeString("en-US", {
              hour12: false,
              minute: "2-digit",
              second: "2-digit",
            }),
            accel: data.processedAccel,
            timestamp: data.timestamp,
          },
        ];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });
    }

    function onJumpDetected(data) {
      setLatestJump(data);
      setJumpHistory((prev) => [data, ...prev].slice(0, 10));

      setMaxJumpHeight((prev) => {
        if (data.heightCm > prev) return data.heightCm;
        return prev;
      });

      // Flash effect
      if (jumpTimeoutRef.current) clearTimeout(jumpTimeoutRef.current);
      jumpTimeoutRef.current = setTimeout(() => {}, 2000);
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

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* ── Connection Status ── */}
      {!isConnected && (
        <div className="reconnecting-banner">
          ⚡ Connecting to backend...
        </div>
      )}

      {/* ── Hero Metrics Row ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        {/* Max Jump Height — Hero Card */}
        <div
          className="stat-card animate-pulse-glow"
          style={{
            gridColumn: "span 1",
            background:
              "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.08) 100%)",
            borderColor: "var(--accent-emerald)",
            textAlign: "center",
            padding: "2rem 1.5rem",
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--accent-emerald)",
              marginBottom: "0.5rem",
            }}
          >
            🏆 Max Jump Height
          </div>
          <div
            className={maxJumpHeight > 0 ? "animate-count-up" : ""}
            key={maxJumpHeight}
            style={{
              fontSize: "3rem",
              fontWeight: 800,
              color: "var(--accent-emerald)",
              lineHeight: 1,
            }}
          >
            {maxJumpHeight > 0 ? `${maxJumpHeight}` : "—"}
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
              marginTop: "0.25rem",
            }}
          >
            {maxJumpHeight > 0 ? "cm" : "Waiting for jumps..."}
          </div>
        </div>

        {/* Live Accel */}
        <div className="stat-card">
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--accent-cyan)",
              marginBottom: "0.5rem",
            }}
          >
            📊 Current Accel
          </div>
          <div
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {latestAccel !== null ? `${latestAccel.toFixed(3)}` : "—"}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>g</div>
        </div>

        {/* Packets Received */}
        <div className="stat-card">
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--accent-violet)",
              marginBottom: "0.5rem",
            }}
          >
            📦 Packets
          </div>
          <div
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {packetCount}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            received
          </div>
        </div>

        {/* Battery */}
        <div className="stat-card">
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--accent-amber)",
              marginBottom: "0.5rem",
            }}
          >
            🔋 Battery
          </div>
          <div
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              color:
                latestBattery !== null && latestBattery < 20
                  ? "var(--accent-rose)"
                  : "var(--text-primary)",
            }}
          >
            {latestBattery !== null ? `${latestBattery}%` : "—"}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {isConnected ? (
              <span>
                <span className="status-dot live" /> Connected
              </span>
            ) : (
              <span>
                <span className="status-dot offline" /> Offline
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Live Chart ── */}
      <div className="chart-container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h3
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Live Acceleration (g)
          </h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
            }}
          >
            <span className={`status-dot ${isConnected ? "live" : "offline"}`} />
            {isConnected ? "LIVE" : "OFFLINE"}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={telemetryData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148, 163, 184, 0.08)"
            />
            <XAxis
              dataKey="time"
              stroke="var(--text-muted)"
              fontSize={11}
              tick={{ fill: "var(--text-muted)" }}
            />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={11}
              tick={{ fill: "var(--text-muted)" }}
              domain={[0, 3.5]}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontSize: "0.8rem",
              }}
            />
            <ReferenceLine
              y={1}
              stroke="var(--text-muted)"
              strokeDasharray="5 5"
              label={{
                value: "1g (rest)",
                fill: "var(--text-muted)",
                fontSize: 10,
              }}
            />
            <Line
              type="monotone"
              dataKey="accel"
              stroke="var(--accent-cyan)"
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                fill: "var(--accent-cyan)",
                stroke: "#fff",
                strokeWidth: 1,
              }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Recent Jumps Log ── */}
      {jumpHistory.length > 0 && (
        <div className="glass-card" style={{ padding: "1.25rem" }}>
          <h3
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "0.75rem",
            }}
          >
            🦘 Recent Jumps
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {jumpHistory.map((j, i) => (
              <div
                key={`${j.timestamp}-${i}`}
                className="jump-alert animate-slide-in"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "var(--accent-emerald)" }}>
                    {j.heightCm} cm
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {new Date(j.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
