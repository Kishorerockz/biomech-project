import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

export default function LiveWaveform({ streamData }) {
  return (
    <section className="w-full max-w-3xl">
      <div className="card-base p-md flex flex-col gap-sm">
        <div className="flex justify-between items-center px-2">
          <span className="font-data-label text-[14px] text-on-surface-variant uppercase">
            LIVE TELEMETRY (Z-AXIS)
          </span>
          <span className="font-data-label text-xs text-primary-fixed bg-primary-fixed/10 px-2 py-0.5 rounded">
            SYNCING
          </span>
        </div>
        
        <div className="w-full h-32 bg-[#121212] rounded-lg border border-[#2A2A2A] relative overflow-hidden flex items-end">
          {/* Critical Zone overlay */}
          <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-secondary-container/20 to-transparent pointer-events-none z-10"></div>
          
          <div className="flex-grow w-full h-full relative z-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={streamData}>
                <YAxis domain={[-2, 5]} hide />
                <Line 
                  type="monotone" 
                  dataKey="accelZ" 
                  stroke="var(--color-primary-fixed)" 
                  strokeWidth={2} 
                  dot={false} 
                  isAnimationActive={false} // Disable Recharts animation for raw live streams to prevent CPU lagging
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
