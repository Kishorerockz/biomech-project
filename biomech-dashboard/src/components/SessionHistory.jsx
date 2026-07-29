import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
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
  const [searchFilter, setSearchFilter] = useState("");

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sessions/history/${config.defaultAthleteId}`);
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0 && !selectedSession) {
        selectSession(data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch session history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const selectSession = async (session) => {
    setSelectedSession(session);
    setTelemetryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sessions/${session.sessionId}/telemetry`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const chartData = data.map((t, idx) => ({
          idx,
          time: new Date(t.timestamp).toLocaleTimeString("en-US", {
            hour12: false,
            minute: "2-digit",
            second: "2-digit",
          }),
          accel: t.processedAccel ?? Math.sqrt((t.accel?.x || 0) ** 2 + (t.accel?.y || 0) ** 2 + (t.accel?.z || 0) ** 2),
        }));
        setTelemetry(chartData);
      }
    } catch (err) {
      console.error("Failed to fetch telemetry details:", err);
    } finally {
      setTelemetryLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (start, end) => {
    if (!start || !end) return "—";
    const sec = Math.round((new Date(end) - new Date(start)) / 1000);
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  };

  const filteredSessions = sessions.filter(
    (s) =>
      s.sessionType?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.sessionId?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* ── Top Bar ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)" }}>
            📜 Session Analytics Archive
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Review historical biomechanics, peak acceleration G-force, and sample telemetry waveforms.
          </p>
        </div>

        <button className="btn-outline" onClick={fetchSessions} style={{ fontSize: "0.85rem" }}>
          🔄 Refresh Sessions
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedSession ? "340px 1fr" : "1fr", gap: "1.5rem" }}>
        {/* ── Session List Drawer ── */}
        <div className="glass-panel" style={{ padding: "1.25rem", maxHeight: "780px", overflow: "auto" }}>
          <div style={{ marginBottom: "1rem" }}>
            <input
              type="text"
              placeholder="Search session type or ID..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid var(--border-subtle)",
                padding: "0.6rem 0.9rem",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
          </div>

          {loading ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
              Loading session archive...
            </div>
          ) : filteredSessions.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
              No recorded sessions found. Run the simulator to record telemetry!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {filteredSessions.map((s) => {
                const isSelected = selectedSession?.sessionId === s.sessionId;
                return (
                  <div
                    key={s.sessionId}
                    onClick={() => selectSession(s)}
                    style={{
                      background: isSelected ? "rgba(0, 242, 254, 0.12)" : "rgba(255, 255, 255, 0.02)",
                      border: `1px solid ${isSelected ? "var(--neon-cyan)" : "var(--border-subtle)"}`,
                      borderRadius: "var(--radius-md)",
                      padding: "0.9rem 1rem",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)", textTransform: "capitalize" }}>
                        {s.sessionType}
                      </span>
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "var(--radius-sm)",
                          background: s.status === "completed" ? "rgba(0, 245, 160, 0.15)" : "rgba(255, 183, 3, 0.15)",
                          color: s.status === "completed" ? "var(--neon-emerald)" : "var(--neon-amber)",
                        }}
                      >
                        {s.status}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                      <span>{formatDate(s.startTime)}</span>
                      <span>{formatDuration(s.startTime, s.endTime)}</span>
                    </div>

                    {s.peakAccelerationG && (
                      <div style={{ fontSize: "0.75rem", color: "var(--neon-cyan)", marginTop: "0.3rem", fontWeight: 600 }}>
                        Peak: {s.peakAccelerationG.toFixed(2)}g • {s.totalSamples || 0} samples
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Detailed Session View ── */}
        {selectedSession && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
              <div className="metric-card">
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--neon-cyan)", textTransform: "uppercase", marginBottom: "0.3rem" }}>
                  Peak Acceleration
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800 }}>
                  {selectedSession.peakAccelerationG?.toFixed(2) ?? "—"}<span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}> g</span>
                </div>
              </div>

              <div className="metric-card">
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--neon-emerald)", textTransform: "uppercase", marginBottom: "0.3rem" }}>
                  Average Accel
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800 }}>
                  {selectedSession.avgAccelerationG?.toFixed(2) ?? "—"}<span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}> g</span>
                </div>
              </div>

              <div className="metric-card">
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--neon-purple)", textTransform: "uppercase", marginBottom: "0.3rem" }}>
                  Sample Records
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800 }}>
                  {selectedSession.totalSamples ?? "—"}
                </div>
              </div>

              <div className="metric-card">
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--neon-amber)", textTransform: "uppercase", marginBottom: "0.3rem" }}>
                  Total Duration
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800 }}>
                  {formatDuration(selectedSession.startTime, selectedSession.endTime)}
                </div>
              </div>
            </div>

            {/* Session Chart */}
            <div className="glass-panel" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "1rem" }}>
                Session Telemetry Waveform Trace ({selectedSession.sessionId})
              </h3>

              {telemetryLoading ? (
                <div style={{ height: 350, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                  Loading session chart data...
                </div>
              ) : telemetry.length === 0 ? (
                <div style={{ height: 350, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                  No telemetry points logged for this session.
                </div>
              ) : (
                <div style={{ width: "100%", height: 360 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={telemetry}>
                      <defs>
                        <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--neon-purple)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="var(--neon-purple)" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                      <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} tick={{ fill: "var(--text-muted)" }} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} tick={{ fill: "var(--text-muted)" }} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--neon-purple)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-primary)",
                          fontSize: "0.85rem",
                        }}
                      />
                      <ReferenceLine y={1} stroke="var(--text-muted)" strokeDasharray="5 5" label={{ value: "1g", fill: "var(--text-muted)", fontSize: 10 }} />
                      <Area
                        type="monotone"
                        dataKey="accel"
                        stroke="var(--neon-purple)"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#purpleGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
