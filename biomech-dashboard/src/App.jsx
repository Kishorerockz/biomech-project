import { useState } from "react";
import LiveSession from "./components/LiveSession";
import SessionHistory from "./components/SessionHistory";
import config from "./lib/config";

export default function App() {
  const [activeTab, setActiveTab] = useState("live");

  return (
    <div style={{ padding: "0 1rem", maxWidth: "1280px", margin: "0 auto", width: "100%" }}>
      {/* ── Header ── */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "2rem 0 1.5rem",
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: "2rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
              marginBottom: "0.25rem",
            }}
          >
            {config.projectTitle}
          </h1>
          <p style={{ color: "var(--accent-cyan)", fontSize: "0.875rem", fontWeight: 500 }}>
            {config.subtitle}
          </p>
        </div>

        {/* Team Members */}
        <div style={{ display: "flex", gap: "1rem", textAlign: "right" }}>
          {config.teamMembers.map((member, idx) => (
            <div key={idx} style={{ fontSize: "0.75rem" }}>
              <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                {member.name}
              </div>
              <div style={{ color: "var(--text-muted)" }}>{member.rollNo}</div>
            </div>
          ))}
        </div>
      </header>

      {/* ── Main Navigation ── */}
      <nav
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "2rem",
          background: "var(--bg-card)",
          padding: "0.5rem",
          borderRadius: "var(--radius-md)",
          width: "fit-content",
        }}
      >
        <button
          className={`nav-tab ${activeTab === "live" ? "active" : ""}`}
          onClick={() => setActiveTab("live")}
        >
          Live Telemetry
        </button>
        <button
          className={`nav-tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Session History
        </button>
      </nav>

      {/* ── Content Area ── */}
      <main style={{ paddingBottom: "4rem" }}>
        {activeTab === "live" ? <LiveSession /> : <SessionHistory />}
      </main>
    </div>
  );
}
