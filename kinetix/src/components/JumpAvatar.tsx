import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, PresentationControls } from '@react-three/drei';
import * as THREE from 'three';

interface JumpAvatarProps {
  gyro: { x: number; y: number; z: number };
  accel: { x: number; y: number; z: number };
  connected: boolean;
  orientation?: { x: number; y: number; z: number; w: number };
}

function AvatarModel({ gyro, accel, connected, orientation }: JumpAvatarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const currentQ = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const timeRef = useRef<number>(performance.now());

  useFrame(() => {
    if (!meshRef.current) return;
    
    // Euler integration of gyro rates (deg/s -> rad/s)
    const now = performance.now();
    const dt = (now - timeRef.current) / 1000;
    timeRef.current = now;

    if (connected) {
      if (orientation) {
        // Use true server-side sensor fusion if provided
        const targetQ = new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w);
        currentQ.current.slerp(targetQ, 0.35);
      } else {
        // Fallback: Complementary tilt & rate integration
        // Clamp dt to prevent massive jump if frame paused
        const safeDt = Math.min(0.05, Math.max(0.001, dt));

        // Gyro rates (deg/s -> rad/s)
        const gx = (Number(gyro.x) || 0) * (Math.PI / 180);
        const gy = (Number(gyro.y) || 0) * (Math.PI / 180);
        const gz = (Number(gyro.z) || 0) * (Math.PI / 180);

        const rateLength = Math.sqrt(gx * gx + gy * gy + gz * gz);
        // Only integrate gyro if above sensor noise threshold (> 2 deg/s)
        if (rateLength > 0.035) {
          const deltaQ = new THREE.Quaternion();
          deltaQ.setFromAxisAngle(new THREE.Vector3(gx / rateLength, gy / rateLength, gz / rateLength), rateLength * safeDt);
          currentQ.current.multiply(deltaQ);
        }

        // Accelerometer gravity vector alignment (Pitch & Roll reference)
        const ax = Number(accel.x) || 0;
        const ay = Number(accel.y) || 0;
        const az = Number(accel.z) || 1.0;
        const accelMag = Math.sqrt(ax * ax + ay * ay + az * az);

        // When not in high-g dynamic movement (0.7g - 1.3g), correct tilt towards gravity
        if (accelMag >= 0.7 && accelMag <= 1.3) {
          // In MPU-6050 standard frame: Z is normal, Y is axial, X is lateral
          const measuredDown = new THREE.Vector3(ax, ay, az).normalize();
          const targetDown = new THREE.Vector3(0, 0, 1); // standard upright reference
          const qGravity = new THREE.Quaternion().setFromUnitVectors(measuredDown, targetDown);
          currentQ.current.slerp(qGravity, 0.06);
        }
      }
    } else {
      // Gently return to upright rest pose when disconnected
      currentQ.current.slerp(new THREE.Quaternion(), 0.05);
    }
    
    currentQ.current.normalize();
    meshRef.current.quaternion.slerp(currentQ.current, 0.35);
  });

  return (
    <mesh ref={meshRef}>
      <capsuleGeometry args={[0.5, 1, 4, 16]} />
      <meshStandardMaterial color="#c9a050" metalness={0.7} roughness={0.2} wireframe={!connected} />
      {/* Visual orientation indicator (chest pad) */}
      <mesh position={[0, 0.5, 0.4]}>
        <boxGeometry args={[0.3, 0.5, 0.2]} />
        <meshStandardMaterial color="#00fbfb" emissive="#00fbfb" emissiveIntensity={0.8} />
      </mesh>
    </mesh>
  );
}

export const JumpAvatar: React.FC<JumpAvatarProps> = (props) => {
  return (
    <div className="w-full h-full border border-white/10 rounded-xl overflow-hidden bg-[#131313] relative flex items-center justify-center touch-none">
      <Canvas camera={{ position: [0, 1.5, 4], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 10, 5]} intensity={1.2} color="#ffffff" />
        <directionalLight position={[-10, 10, -5]} intensity={0.8} color="#c9a050" />
        <pointLight position={[0, -2, 2]} intensity={0.5} color="#00fbfb" />
        
        <PresentationControls global rotation={[0, 0, 0]} polar={[-Math.PI / 2, Math.PI / 2]} azimuth={[-Infinity, Infinity]}>
          <group position={[0, -0.5, 0]}>
            <AvatarModel {...props} />
            <ContactShadows position={[0, -1.2, 0]} opacity={0.6} scale={10} blur={2.5} far={4} color="#000000" />
          </group>
        </PresentationControls>
      </Canvas>
      <div className="absolute top-4 left-4 font-data-label text-[10px] uppercase tracking-widest font-bold bg-[#0a0a0a]/80 px-2 py-1 rounded border border-white/5 backdrop-blur shadow select-none">
        {props.connected ? (
          <span className="text-[#00fbfb]">● LIVE 3D TELEMETRY</span>
        ) : (
          <span className="text-white/40">○ OFFLINE (AWAITING SENSOR)</span>
        )}
      </div>
      <div className="absolute bottom-4 right-4 font-data-label text-[9px] uppercase tracking-wider text-white/30 text-right pointer-events-none">
        Drag to rotate<br/>Scroll to zoom
      </div>
    </div>
  );
};
