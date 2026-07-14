import { useState, useEffect } from "react";
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
import { API_BASE } from "../lib/socket";
import config from "../lib/config";

export default function SessionHistory() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [telemetryLoading, setTelemetryLoading] = useState(false);

  // Fetch session history
  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch(
          `${API_BASE}/sessions/history/${config.defaultAthleteId}`
        );
        const data = await res.json();
        setSessions(data);
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  // Fetch telemetry when a session is selected
  async function selectSession(session) {
    setSelectedSession(session);
    setTelemetryLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/sessions/${session.sessionId}/telemetry`
      );
      const data = await res.json();
      // Map for chart
      const chartData = data.map((t, idx) => ({
        idx,
        time: new Date(t.timestamp).toLocaleTimeString("en-US", {
          hour12: false,
          minute: "2-digit",
          second: "2-digit",
        }),
        accel:
          t.processedAccel ??
          Math.sqrt(t.accel.x ** 2 + t.accel.y ** 2 + t.accel.z ** 2),
      }));
      setTelemetry(chartData);
    } catch (err) {
      console.error("Failed to fetch telemetry:", err);
    } finally {
      setTelemetryLoading(false);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDuration(start, end) {
    if (!start || !end) return "—";
    const ms = new Date(end) - new Date(start);
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: selectedSession ? "1fr 2fr" : "1fr",
          gap: "1.5rem",
          minHeight: "400px",
        }}
      >
        {/* ── Session List ── */}
        <div className="glass-card" style={{ padding: "1.25rem", overflow: "auto", maxHeight: "80vh" }}>
          <h3
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "1rem",
            }}
          >
            📋 Past Sessions
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 400,
                color: "var(--text-muted)",
                marginLeft: "0.5rem",
              }}
            >
              ({sessions.length})
            </span>
          </h3>

          {loading ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
              No sessions found. Run the simulator first!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {sessions.map((s, i) => (
                <div
                  key={s.sessionId}
                  className={`session-item animate-slide-in`}
                  style={{
                    animationDelay: `${i * 0.05}s`,
                    borderColor:
                      selectedSession?.sessionId === s.sessionId
                        ? "var(--accent-cyan)"
                        : undefined,
                    background:
                      selectedSession?.sessionId === s.sessionId
                        ? "var(--bg-card-hover)"
                        : undefined,
                  }}
                  onClick={() => selectSession(s)}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.25rem",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: "var(--text-primary)",
                        textTransform: "capitalize",
                      }}
                    >
                      {s.sessionType}
                    </span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "var(--radius-sm)",
                        background:
                          s.status === "completed"
                            ? "rgba(16, 185, 129, 0.15)"
                            : "rgba(245, 158, 11, 0.15)",
                        color:
                          s.status === "completed"
                            ? "var(--accent-emerald)"
                            : "var(--accent-amber)",
                      }}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{formatDate(s.startTime)}</span>
                    <span>{formatDuration(s.startTime, s.endTime)}</span>
                  </div>
                  {s.peakAccelerationG && (
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-secondary)",
                        marginTop: "0.25rem",
                      }}
                    >
                      Peak: {s.peakAccelerationG.toFixed(2)}g • Samples:{" "}
                      {s.totalSamples}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Selected Session Detail ── */}
        {selectedSession && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Summary Stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "0.75rem",
              }}
            >
              <div className="stat-card">
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--accent-cyan)",
                    marginBottom: "0.375rem",
                  }}
                >
                  Peak Accel
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                  {selectedSession.peakAccelerationG?.toFixed(2) ?? "—"}
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {" "}g
                  </span>
                </div>
              </div>
              <div className="stat-card">
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--accent-emerald)",
                    marginBottom: "0.375rem",
                  }}
                >
                  Avg Accel
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                  {selectedSession.avgAccelerationG?.toFixed(2) ?? "—"}
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {" "}g
                  </span>
                </div>
              </div>
              <div className="stat-card">
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--accent-violet)",
                    marginBottom: "0.375rem",
                  }}
                >
                  Samples
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                  {selectedSession.totalSamples ?? "—"}
                </div>
              </div>
              <div className="stat-card">
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--accent-amber)",
                    marginBottom: "0.375rem",
                  }}
                >
                  Duration
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                  {formatDuration(
                    selectedSession.startTime,
                    selectedSession.endTime
                  )}
                </div>
              </div>
            </div>

            {/* Telemetry Chart */}
            <div className="chart-container">
              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: "1rem",
                }}
              >
                Acceleration Over Time
              </h3>

              {telemetryLoading ? (
                <div
                  style={{
                    height: 300,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  Loading telemetry...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={telemetry}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148, 163, 184, 0.08)"
                    />
                    <XAxis
                      dataKey="time"
                      stroke="var(--text-muted)"
                      fontSize={10}
                      tick={{ fill: "var(--text-muted)" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tick={{ fill: "var(--text-muted)" }}
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
                        value: "1g",
                        fill: "var(--text-muted)",
                        fontSize: 10,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="accel"
                      stroke="var(--accent-cyan)"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
