import { useState, useEffect } from "react";
import LiveSession from "./components/LiveSession";
import SessionHistory from "./components/SessionHistory";
import config from "./lib/config";

export default function App() {
  const [activeTab, setActiveTab] = useState("live");
  const [simRunning, setSimRunning] = useState(false);

  // Quick action to trigger simulation API if requested directly from UI
  const triggerJumpSimulation = async () => {
    try {
      setSimRunning(true);
      const res = await fetch("http://localhost:5000/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: "sim_athlete", sessionType: "volleyball" }),
      });
      const data = await res.json();
      if (data.sessionId) {
        // Send a simulated jump packet directly via REST / WS test
        console.log("Session initiated from UI:", data.sessionId);
      }
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setTimeout(() => setSimRunning(false), 2000);
    }
  };

  useEffect(() => {
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').catch(err => console.log('Wake Lock Error:', err));
    }
  }, []);

  return (
    <div className="bg-surface text-on-surface font-body-sm min-h-screen pb-48">
      {/* ── Sticky Header ── */}
      <header className="fixed top-0 w-full z-50 bg-surface border-b border-outline-variant flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16">
        <div className="flex items-center gap-xs">
          <span className="material-symbols-outlined text-primary-fixed-dim" style={{fontVariationSettings: "'FILL' 1"}}>sensors</span>
          <div className="flex items-center gap-2">
            <span className="font-data-label text-[14px] text-on-surface uppercase">{config.defaultAthleteId || "sim_athlete"}: CONNECTED</span>
            <div className="w-2 h-2 rounded-full bg-[#00ff7f] pulse-dot-green"></div>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-high transition-colors text-on-surface-variant">
          <span className="material-symbols-outlined text-primary-fixed-dim" style={{fontVariationSettings: "'FILL' 1"}}>account_circle</span>
        </button>
      </header>

      {/* ── Main Content Canvas ── */}
      <main className="pt-24 px-margin-mobile md:px-margin-desktop max-w-7xl mx-auto space-y-lg flex flex-col items-center">
        {activeTab === "live" && <LiveSession />}
        {activeTab === "history" && <SessionHistory />}
        {activeTab === "analysis" && (
          <div className="text-on-surface-variant font-body-lg text-center mt-20 p-8 card-base w-full max-w-md">
            <span className="material-symbols-outlined text-4xl mb-4 text-outline">construction</span>
            <p>Analysis Module Under Construction</p>
          </div>
        )}
        {activeTab === "calibration" && (
          <div className="text-on-surface-variant font-body-lg text-center mt-20 p-8 card-base w-full max-w-md">
            <span className="material-symbols-outlined text-4xl mb-4 text-outline">tune</span>
            <p>Hardware Calibration Under Construction</p>
          </div>
        )}
      </main>

      {/* ── Sticky Bottom Action Dock (Only on Live tab for now) ── */}
      {activeTab === "live" && (
        <div className="fixed w-full z-40 bg-surface/80 backdrop-blur-md border-t border-outline-variant p-4 pb-6 md:pb-8 flex justify-center items-center shadow-[0_-10px_40px_rgba(0,0,0,0.5)] bottom-[64px]">
          <button
            className="w-full max-w-md bg-primary-fixed hover:bg-surface-tint text-[#000000] font-data-value text-[18px] py-4 rounded-full transition-transform active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50"
            onClick={triggerJumpSimulation}
            disabled={simRunning}
          >
            <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>
              {simRunning ? "hourglass_top" : "play_circle"}
            </span>
            {simRunning ? "Initializing Session..." : "Trigger Session Start"}
          </button>
        </div>
      )}

      {/* ── Fixed Bottom Navigation Bar ── */}
      <nav className="fixed bottom-0 left-0 w-full bg-surface-container-low border-t border-outline-variant px-margin-mobile md:px-margin-desktop py-2 z-50 flex justify-around items-center">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'live' ? 'text-primary-fixed' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>sensors</span>
          <span className="text-[10px] font-data-label uppercase tracking-wider">Live</span>
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'analysis' ? 'text-primary-fixed' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>analytics</span>
          <span className="text-[10px] font-data-label uppercase tracking-wider">Analysis</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'history' ? 'text-primary-fixed' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>history</span>
          <span className="text-[10px] font-data-label uppercase tracking-wider">History</span>
        </button>
        <button
          onClick={() => setActiveTab('calibration')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'calibration' ? 'text-primary-fixed' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>tune</span>
          <span className="text-[10px] font-data-label uppercase tracking-wider">Calibration</span>
        </button>
      </nav>
    </div>
  );
}
