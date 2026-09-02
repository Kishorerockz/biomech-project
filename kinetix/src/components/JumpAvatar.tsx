import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, ContactShadows, PresentationControls } from '@react-three/drei';
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
        // Use true server-side sensor fusion
        const targetQ = new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w);
        currentQ.current.slerp(targetQ, 0.4);
      } else {
        // Fallback: Euler integration when backend PB does not supply orientation
        const gx = gyro.x * (Math.PI / 180);
        const gy = gyro.y * (Math.PI / 180);
        const gz = gyro.z * (Math.PI / 180);

      const deltaQ = new THREE.Quaternion();
      const length = Math.sqrt(gx * gx + gy * gy + gz * gz);
      if (length > 0) {
        deltaQ.setFromAxisAngle(new THREE.Vector3(gx / length, gy / length, gz / length), length * dt);
        currentQ.current.multiply(deltaQ);
      }
      
      // Simplistic complementary filter against acceleration (gravity)
      const accelMagnitude = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);
      // Ensure we're roughly stationary to trust the accelerometer for tilt
      if (Math.abs(accelMagnitude - 1.0) < 0.2) { 
        const accelVec = new THREE.Vector3(-accel.x, -accel.y, accel.z).normalize();
        const upVec = new THREE.Vector3(0, 1, 0); 
        const qCorr = new THREE.Quaternion().setFromUnitVectors(accelVec, upVec);
        currentQ.current.slerp(qCorr, 0.02); 
      }
    }
  } else {
    // Gently return to idle state when disconnected
      currentQ.current.slerp(new THREE.Quaternion(), 0.05);
    }
    
    currentQ.current.normalize();
    meshRef.current.quaternion.slerp(currentQ.current, 0.3);
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
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} color="#ffffff" />
        <directionalLight position={[-10, 10, -5]} intensity={0.5} color="#c9a050" />
        
        <PresentationControls global rotation={[0, 0, 0]} polar={[-Math.PI / 2, Math.PI / 2]} azimuth={[-Infinity, Infinity]}>
          <group position={[0, -0.5, 0]}>
            <AvatarModel {...props} />
            <ContactShadows position={[0, -1.2, 0]} opacity={0.6} scale={10} blur={2.5} far={4} color="#000000" />
          </group>
        </PresentationControls>
        
        <Environment preset="city" />
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
