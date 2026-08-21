import React, { useState, useEffect, useRef } from 'react';
import { SensorState, AthleteProfile } from '../types';
import { formatMetricHeight } from '../data';
import { audioEngine } from '../utils/audio';

interface LiveTabProps {
  sensorState: SensorState;
  setSensorState: React.Dispatch<React.SetStateAction<SensorState>>;
  athleteProfile: AthleteProfile;
  onTriggerSessionStart: () => void;
  onRecordJump: (jumpCm: number) => void;
}

export const LiveTab: React.FC<LiveTabProps> = ({
  sensorState,
  setSensorState,
  athleteProfile,
  onTriggerSessionStart,
  onRecordJump,
}) => {
  const [isSimulatingStream, setIsSimulatingStream] = useState(true);
  const [jumpAnimation, setJumpAnimation] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataPointsRef = useRef<number[]>([]);

  // Initialize buffer for accelerometer graph
  useEffect(() => {
    const pointsCount = 120;
    const initial = Array(pointsCount).fill(50);
    dataPointsRef.current = initial;
  }, []);

  // Socket.io Integration
  useEffect(() => {
    import('../utils/socket').then(({ socketService }) => {
      socketService.connect();

      const handleDashboardUpdate = (data: any) => {
        if (!socketService.socket) return;
        
        // Update sensor state
        setSensorState(prev => ({ 
          ...prev, 
          procAccelG: typeof data.processedAccel === 'number' ? data.processedAccel : prev.procAccelG, 
          batteryPercent: typeof data.battery === 'number' ? data.battery : prev.batteryPercent 
        }));

        // Update waveform points
        const points = dataPointsRef.current;
        points.shift();
        
        // Z-axis data from accel or processedAccel
        const rawZ = data.accel?.z || Math.random() * 2;
        // scale to canvas 10-90
        const yVal = Math.max(10, Math.min(90, 50 + (rawZ * 15)));
        points.push(yVal);
      };

      const handleJumpDetected = (data: any) => {
        const newJump = data.heightCm;
        setJumpAnimation(true);
        
        // Visual indicator of jump spike on canvas
        const points = dataPointsRef.current;
        if (points.length > 10) {
          points[points.length - 8] = 95;
          points[points.length - 6] = 10;
          points[points.length - 4] = 85;
          points[points.length - 2] = 30;
        }

        setTimeout(() => {
          setJumpAnimation(false);
          
          setSensorState(prev => {
            const isPeak = newJump > prev.maxJumpCm;
            audioEngine.playJumpChime(isPeak); // Play sound dynamically based on correct prev
            
            return {
              ...prev,
              lastJumpCm: newJump,
              maxJumpCm: Math.max(prev.maxJumpCm, newJump),
              totalJumps: prev.totalJumps + 1,
              isNewPeak: isPeak,
            };
          });
          
          onRecordJump(newJump);
        }, 400);
      };

      if (socketService.socket) {
        setIsConnected(true);
        socketService.socket.on('dashboard_update', handleDashboardUpdate);
        socketService.socket.on('jump_detected', handleJumpDetected);
        socketService.socket.on('connect', () => setIsConnected(true));
        socketService.socket.on('disconnect', () => setIsConnected(false));
      }
      
    });

    return () => {
      import('../utils/socket').then(({ socketService }) => {
        if (socketService.socket) {
          socketService.socket.off('dashboard_update');
          socketService.socket.off('jump_detected');
          socketService.socket.off('connect');
          socketService.socket.off('disconnect');
        }
      });
    };
  }, [setSensorState, onRecordJump]);

  // Animate accelerometer waveform loop for rendering
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;

          if (isSimulatingStream) {
             const points = dataPointsRef.current;
             points.shift();
             let noise = (Math.random() - 0.5) * 6;
             if (Math.random() < 0.02) noise = (Math.random() > 0.5 ? 1 : -1) * (25 + Math.random() * 20);
             points.push(Math.max(10, Math.min(90, 50 + noise)));
          }

          const points = dataPointsRef.current;

          // Draw Canvas background & grid
          ctx.clearRect(0, 0, width, height);

          // Grid lines
          ctx.strokeStyle = 'rgba(42, 42, 42, 0.5)';
          ctx.lineWidth = 1;
          for (let y = 0; y < height; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }

          // Draw Gradient under curve
          const gradient = ctx.createLinearGradient(0, 0, 0, height);
          gradient.addColorStop(0, 'rgba(201, 160, 80, 0.35)');
          gradient.addColorStop(1, 'rgba(201, 160, 80, 0)');

          ctx.beginPath();
          const dx = width / (points.length - 1);
          ctx.moveTo(0, height);
          ctx.lineTo(0, points[0]);

          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(i * dx, points[i]);
          }

          ctx.lineTo(width, height);
          ctx.closePath();
          ctx.fillStyle = gradient;
          ctx.fill();

          // Draw Stroke line
          ctx.beginPath();
          ctx.moveTo(0, points[0]);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(i * dx, points[i]);
          }
          ctx.strokeStyle = '#c9a050';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isSimulatingStream]);

  // Sound Feedback Toggle State
  const [audioEnabled, setAudioEnabled] = useState(true);

  const toggleAudio = () => {
    audioEngine.enabled = !audioEnabled;
    setAudioEnabled(!audioEnabled);
  };

  // Trigger manual simulated jump
  const handleSimulateJump = () => {
    setJumpAnimation(true);
    const newJump = parseFloat((42 + Math.random() * 7).toFixed(1)); // 42.0 to 49.0 cm
    
    // Inject a massive waveform spike
    const points = dataPointsRef.current;
    if (points.length > 10) {
      points[points.length - 8] = 95;
      points[points.length - 6] = 10;
      points[points.length - 4] = 85;
      points[points.length - 2] = 30;
    }

    setTimeout(() => {
      setJumpAnimation(false);
      const isPeak = newJump > sensorState.maxJumpCm;
      
      // Play synthesis audio feedback chime
      audioEngine.playJumpChime(isPeak);

      setSensorState((prev) => ({
        ...prev,
        lastJumpCm: newJump,
        maxJumpCm: Math.max(prev.maxJumpCm, newJump),
        totalJumps: prev.totalJumps + 1,
        isNewPeak: isPeak,
      }));
      onRecordJump(newJump);
    }, 400);
  };

  return (
    <div className="pt-20 md:pt-24 px-5 md:px-10 max-w-4xl mx-auto space-y-6 pb-48 flex flex-col items-center">
      {/* Top Telemetry Status Header */}
      <div className="w-full flex justify-between items-center bg-white/5 border border-white/10 px-5 py-3 rounded-2xl backdrop-blur-md gap-3">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined ${isConnected ? 'text-[#c9a050]' : 'text-red-500'} filled`}>
            {isConnected ? 'sensors' : 'sensors_off'}
          </span>
          <span className="font-data-label text-xs sm:text-sm text-white/80">
            {isConnected ? 'ESP32: CONNECTED' : 'RECONNECTING...'}
          </span>
          <div className={`w-2.5 h-2.5 rounded-full ml-1 ${isConnected ? 'bg-[#00ff7f] pulse-dot-green' : 'bg-red-500 animate-pulse'}`} />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleAudio}
            className={`font-data-label text-xs flex items-center gap-1 uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
              audioEnabled
                ? 'bg-[#c9a050]/20 border-[#c9a050]/50 text-[#c9a050]'
                : 'bg-white/5 border-white/10 text-white/40'
            }`}
            title={audioEnabled ? 'Audio Feedback Enabled' : 'Audio Feedback Muted'}
          >
            <span className="material-symbols-outlined text-sm">
              {audioEnabled ? 'volume_up' : 'volume_off'}
            </span>
            <span className="hidden sm:inline">{audioEnabled ? 'Audio On' : 'Muted'}</span>
          </button>

          <button
            onClick={() => setIsSimulatingStream(!isSimulatingStream)}
            className="font-data-label text-xs text-[#c9a050] hover:underline flex items-center gap-1 uppercase tracking-widest font-semibold cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">
              {isSimulatingStream ? 'pause_circle' : 'play_circle'}
            </span>
            <span className="hidden sm:inline">{isSimulatingStream ? 'Live Streaming' : 'Paused'}</span>
          </button>
        </div>
      </div>

      {/* Hero Card: Massive Centered Card for Last Jump */}
      <section className="w-full max-w-md">
        <div className="card-base p-6 md:p-8 relative flex flex-col items-center justify-center text-center overflow-hidden border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl">
          {/* Radial gold glow effect */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at center, #c9a050 0%, transparent 75%)',
            }}
          />

          <div className="mt-2 mb-4 flex flex-col items-center">
            {sensorState.isNewPeak && (
              <div className="mb-3 flex items-center gap-2 bg-[#c9a050]/20 border border-[#c9a050]/50 px-3 py-1 rounded-full animate-bounce">
                <div className="w-2 h-2 rounded-full bg-[#c9a050] pulse-dot-cyan" />
                <span className="font-data-label text-[11px] tracking-wider text-[#c9a050] uppercase font-bold">
                  NEW PEAK
                </span>
              </div>
            )}
            <h2 className="font-data-label text-xs text-white/50 tracking-[0.3em] uppercase mb-2 font-bold">
              Last Jump
            </h2>
            <div
              className={`font-display-metrics text-5xl md:text-6xl text-[#c9a050] transition-transform duration-300 ${
                jumpAnimation ? 'scale-110' : 'scale-100'
              }`}
            >
              {athleteProfile.units === 'imperial'
                ? (sensorState.lastJumpCm / 2.54).toFixed(1)
                : sensorState.lastJumpCm.toFixed(1)}
              <span className="text-xl md:text-2xl text-white/50 ml-1 font-body-lg">
                {athleteProfile.units === 'imperial' ? 'in' : 'cm'}
              </span>
            </div>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSimulateJump}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-[#c9a050] rounded-full font-data-label text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer font-bold uppercase tracking-wider"
            >
              <span className="material-symbols-outlined text-sm">flight_takeoff</span>
              Simulate Spike Jump
            </button>
          </div>
        </div>
      </section>

      {/* Accelerometer Waveform Card */}
      <section className="w-full max-w-3xl">
        <div className="card-base p-4 md:p-6 flex flex-col gap-3 bg-white/5 border-white/10">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <span className="font-data-label text-xs text-white/60 uppercase tracking-[0.2em]">
                LIVE TELEMETRY (Z-AXIS)
              </span>
            </div>
            <span className="font-data-label text-[11px] text-[#c9a050] bg-[#c9a050]/10 px-2.5 py-0.5 rounded-full border border-[#c9a050]/30 font-bold">
              SYNCING {sensorState.samplingRateHz}Hz
            </span>
          </div>

          {/* Real-time Canvas Waveform */}
          <div className="w-full h-36 bg-[#0a0a0a] rounded-xl border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-[#c9a050]/15 to-transparent pointer-events-none" />
            <canvas
              ref={canvasRef}
              width={600}
              height={144}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Metrics Bento Grid */}
      <section className="w-full max-w-3xl grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Card 1: Max Jump */}
        <div className="card-base p-4 flex flex-col justify-between items-start gap-3 hover:border-white/30 transition-colors group bg-white/5 border-white/10">
          <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-[#c9a050] transition-colors">
            <span className="material-symbols-outlined text-white/60 group-hover:text-[#c9a050] text-base filled">
              flight_takeoff
            </span>
          </div>
          <div>
            <div className="font-data-label text-[11px] text-white/50 tracking-wider uppercase mb-1">
              Max Jump
            </div>
            <div className="font-data-value text-lg text-white">
              {formatMetricHeight(sensorState.maxJumpCm, athleteProfile.units)}
            </div>
          </div>
        </div>

        {/* Card 2: Total Jumps */}
        <div className="card-base p-4 flex flex-col justify-between items-start gap-3 hover:border-white/30 transition-colors group bg-white/5 border-white/10">
          <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-[#c9a050] transition-colors">
            <span className="material-symbols-outlined text-white/60 group-hover:text-[#c9a050] text-base filled">
              repeat
            </span>
          </div>
          <div>
            <div className="font-data-label text-[11px] text-white/50 tracking-wider uppercase mb-1">
              Total Jumps
            </div>
            <div className="font-data-value text-lg text-white">{sensorState.totalJumps}</div>
          </div>
        </div>

        {/* Card 3: Proc Accel */}
        <div className="card-base p-4 flex flex-col justify-between items-start gap-3 hover:border-white/30 transition-colors group bg-white/5 border-white/10">
          <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-[#c9a050] transition-colors">
            <span className="material-symbols-outlined text-white/60 group-hover:text-[#c9a050] text-base filled">
              speed
            </span>
          </div>
          <div>
            <div className="font-data-label text-[11px] text-white/50 tracking-wider uppercase mb-1">
              Proc. Accel
            </div>
            <div className="font-data-value text-lg text-white">{sensorState.procAccelG}g</div>
          </div>
        </div>

        {/* Card 4: Stream */}
        <div className="card-base p-4 flex flex-col justify-between items-start gap-3 hover:border-white/30 transition-colors group bg-white/5 border-white/10">
          <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-[#c9a050] transition-colors">
            <span className="material-symbols-outlined text-white/60 group-hover:text-[#c9a050] text-base filled">
              wifi_tethering
            </span>
          </div>
          <div>
            <div className="font-data-label text-[11px] text-white/50 tracking-wider uppercase mb-1">
              Stream
            </div>
            <div className="font-data-value text-lg text-white">
              {sensorState.samplingRateHz}Hz
            </div>
          </div>
        </div>
      </section>

      {/* Fixed Bottom Action Dock */}
      <div className="fixed w-full z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-t border-white/10 p-4 pb-6 md:pb-6 flex justify-center items-center shadow-[0_-10px_40px_rgba(0,0,0,0.8)] bottom-20 md:bottom-0">
        <button
          onClick={onTriggerSessionStart}
          className="w-full max-w-md bg-[#c9a050] hover:bg-[#d9b060] text-black font-data-value text-sm py-4 rounded-full transition-transform active:scale-95 flex justify-center items-center gap-2 shadow-lg cursor-pointer uppercase tracking-[0.2em] font-bold"
        >
          <span className="material-symbols-outlined filled">play_circle</span>
          Trigger Session Start
        </button>
      </div>
    </div>
  );
};
