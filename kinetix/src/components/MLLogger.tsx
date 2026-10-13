import React, { useState, useEffect, useRef } from 'react';
import { SensorState } from '../types';

interface MLLoggerProps {
  sensorState: SensorState;
}

export const MLLogger: React.FC<MLLoggerProps> = ({ sensorState }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [actionLabel, setActionLabel] = useState('JumpShot');
  const [recordedSamples, setRecordedSamples] = useState<any[]>([]);
  
  const bufferRef = useRef<any[]>([]);

  useEffect(() => {
    if (isRecording && sensorState.accel) {
      bufferRef.current.push({
        timestamp: performance.now(),
        action: actionLabel,
        x: sensorState.accel.x,
        y: sensorState.accel.y,
        z: sensorState.accel.z
      });
      setRecordedSamples([...bufferRef.current]);
    }
  }, [sensorState.accel, isRecording]);

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      bufferRef.current = [];
      setRecordedSamples([]);
      setIsRecording(true);
    }
  };

  const downloadCSV = () => {
    if (bufferRef.current.length === 0) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "timestamp,action,x,y,z\n";
    
    bufferRef.current.forEach(row => {
      csvContent += `${row.timestamp},${row.action},${row.x},${row.y},${row.z}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ml_training_data_${actionLabel}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(16, 21, 30, 0.98) 0%, rgba(12, 16, 23, 0.98) 100%)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 160, height: 160,
        background: `radial-gradient(circle, #f59e0b22 0%, transparent 70%)`,
        borderRadius: '50%', pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🧠</span>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '15px', letterSpacing: '0.5px' }}>Data Collection Pipeline</span>
        </div>
      </div>
      
      <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '16px' }}>
        Record high-speed accelerometer data to train custom TinyML models.
      </p>
      
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select 
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#e2e8f0',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '13px',
            outline: 'none',
          }}
          value={actionLabel}
          onChange={(e) => setActionLabel(e.target.value)}
          disabled={isRecording}
        >
          <option value="JumpShot">Basketball Jump Shot</option>
          <option value="VolleyballSpike">Volleyball Spike</option>
          <option value="Sprint">Sprint</option>
          <option value="Walk">Walking (Baseline)</option>
        </select>
        
        <button 
          onClick={toggleRecording}
          style={{
            background: isRecording ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
            border: `1px solid ${isRecording ? '#ef4444' : '#f59e0b'}44`,
            color: isRecording ? '#ef4444' : '#f59e0b',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            {isRecording ? 'stop_circle' : 'radio_button_checked'}
          </span>
          {isRecording ? 'STOP RECORDING' : 'START LOGGING'}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
        <div style={{ color: '#64748b', fontSize: '11px' }}>
          Samples Collected: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{bufferRef.current.length}</span>
        </div>
        <button 
          onClick={downloadCSV}
          disabled={bufferRef.current.length === 0 || isRecording}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: (bufferRef.current.length === 0 || isRecording) ? '#64748b' : '#94a3b8',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: (bufferRef.current.length === 0 || isRecording) ? 'not-allowed' : 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>download</span>
          Export CSV
        </button>
      </div>
    </div>
  );
};
