"use client";

import { useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";

export interface Hotspot {
  id: string;
  position: [number, number, number];
  severity: "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR" | "INFO";
  label: string;
}

interface Vehicle3DProps {
  hotspots?: Hotspot[];
  onHotspotClick?: (id: string) => void;
  activeHotspot?: string | null;
  className?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#b91c1c",
  MAJOR: "#dc2626",
  MODERATE: "#9898b0",
  MINOR: "#ab6dd9",
  INFO: "#2563eb",
};

function CarBody() {
  return (
    <group>
      {/* Main body */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[2.4, 0.5, 1.1]} />
        <meshStandardMaterial color="#5c0099" transparent opacity={0.2} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[2.4, 0.5, 1.1]} />
        <meshStandardMaterial color="#a0a0b4" wireframe />
      </mesh>

      {/* Cabin */}
      <mesh position={[0.1, 0.72, 0]}>
        <boxGeometry args={[1.4, 0.4, 1.0]} />
        <meshStandardMaterial color="#5c0099" transparent opacity={0.15} />
      </mesh>
      <mesh position={[0.1, 0.72, 0]}>
        <boxGeometry args={[1.4, 0.4, 1.0]} />
        <meshStandardMaterial color="#a0a0b4" wireframe />
      </mesh>

      {/* Hood */}
      <mesh position={[0.95, 0.45, 0]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[0.7, 0.08, 1.05]} />
        <meshStandardMaterial color="#d4bfe8" transparent opacity={0.3} />
      </mesh>

      {/* Wheels */}
      {[
        [0.75, 0.1, 0.6],
        [0.75, 0.1, -0.6],
        [-0.75, 0.1, 0.6],
        [-0.75, 0.1, -0.6],
      ].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.12, 16]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.2, 0.08, 8, 16]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function HotspotMarker({
  hotspot,
  onClick,
  isActive,
}: {
  hotspot: Hotspot;
  onClick?: () => void;
  isActive: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      const scale = isActive || hovered ? 1.4 : 1 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
      meshRef.current.scale.setScalar(scale);
    }
  });

  const color = SEVERITY_COLORS[hotspot.severity] || "#666";

  return (
    <group position={hotspot.position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive || hovered ? 0.8 : 0.4}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Outer pulse ring */}
      <mesh>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.2}
          wireframe
        />
      </mesh>

      {(hovered || isActive) && (
        <Html distanceFactor={4} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-lg bg-gray-800/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
            <span
              className="mr-1.5 inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            {hotspot.label}
          </div>
        </Html>
      )}
    </group>
  );
}

function Scene({
  hotspots,
  onHotspotClick,
  activeHotspot,
}: {
  hotspots: Hotspot[];
  onHotspotClick?: (id: string) => void;
  activeHotspot?: string | null;
}) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-3, 3, -3]} intensity={0.3} />

      <CarBody />

      {hotspots.map((h) => (
        <HotspotMarker
          key={h.id}
          hotspot={h}
          onClick={() => onHotspotClick?.(h.id)}
          isActive={activeHotspot === h.id}
        />
      ))}

      {/* Ground grid */}
      <gridHelper args={[6, 20, "#a0a0b4", "#c0c0d0"]} position={[0, -0.05, 0]} />

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.5}
        enablePan={false}
        minDistance={2}
        maxDistance={6}
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  );
}

export function Vehicle3D({
  hotspots = [],
  onHotspotClick,
  activeHotspot,
  className = "",
}: Vehicle3DProps) {
  return (
    <div className={`w-full h-full min-h-[400px] rounded-xl bg-gradient-to-b from-brand-900 to-brand-800 ${className}`}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        }
      >
        <Canvas
          camera={{ position: [3, 2, 3], fov: 45 }}
          style={{ borderRadius: "0.75rem" }}
        >
          <Scene
            hotspots={hotspots}
            onHotspotClick={onHotspotClick}
            activeHotspot={activeHotspot}
          />
        </Canvas>
      </Suspense>
    </div>
  );
}
