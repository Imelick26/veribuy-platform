"use client";

import React, { Suspense, useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { motion, useInView } from "framer-motion";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// 4 key NHTSA issues for 2023 Ford Super Duty — spread across the truck for visibility
// Model coords: +X=front, -X=rear, +Y=up, +Z=passenger side. Scale=6.5
const HOTSPOTS = [
  {
    label: "Steering Column Recall",
    position: [-0.8, 0.45, 0.5] as [number, number, number], // steering wheel, driver side cab
    color: "#ef4444",
  },
  {
    label: "Fuel Pump Failure",
    position: [-2.6, 0.1, 0.0] as [number, number, number], // front engine bay
    color: "#ef4444",
  },
  {
    label: "Rear Camera Recall",
    position: [3.25, 0.0, 0.0] as [number, number, number], // very rear of tailgate
    color: "#ef4444",
  },
];

/* ─── 3D hotspot marker with label ─── */
function Hotspot3D({
  position,
  color,
  label,
}: {
  position: [number, number, number];
  color: string;
  label: string;
}) {
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 0.85 + Math.sin(t * 2.5 + position[0] * 3) * 0.15;
    if (innerRef.current) {
      innerRef.current.scale.setScalar(pulse);
    }
    if (outerRef.current) {
      outerRef.current.scale.setScalar(0.8 + Math.sin(t * 1.5 + position[0] * 2) * 0.4);
      (outerRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.1 + Math.sin(t * 2 + position[0] * 3) * 0.08;
    }
  });

  return (
    <group position={position}>
      {/* Inner bright dot */}
      <mesh ref={innerRef as React.RefObject<THREE.Mesh>}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={1.0} />
      </mesh>
      {/* Outer glow ring */}
      <mesh ref={outerRef as React.RefObject<THREE.Mesh>}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
      {/* Label */}
      <Html
        position={[0, 0.35, 0]}
        center
        distanceFactor={6}
        style={{ pointerEvents: "none" }}
      >
        <div
          className="whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold"
          style={{
            backgroundColor: "rgba(0,0,0,0.7)",
            borderLeft: `2px solid ${color}`,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

/* ─── Wireframe truck with hotspots ─── */
function TruckModel() {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    dracoLoader.setDecoderConfig({ type: "js" });

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      "/models/f450.glb",
      (gltf) => {
        const scene = gltf.scene;

        const box = new THREE.Box3().setFromObject(scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const s = 6.5 / maxDim;

        // Wireframe only — no solid fill
        const wireMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color("#b0c8e0"),
          wireframe: true,
          transparent: true,
          opacity: 0.10,
        });

        scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.material = wireMat;
          }
        });

        scene.scale.setScalar(s);
        scene.position.set(-center.x * s, -center.y * s, -center.z * s);

        if (groupRef.current) {
          groupRef.current.add(scene);
        }

        dracoLoader.dispose();
      },
      undefined,
      (err) => {
        console.error("Model load error:", err);
        dracoLoader.dispose();
      }
    );
  }, []);

  return (
    <group ref={groupRef}>
      {HOTSPOTS.map((h) => (
        <Hotspot3D key={h.label} position={h.position} color={h.color} label={h.label} />
      ))}
    </group>
  );
}

/* ─── Scanning line that sweeps over the vehicle ─── */
function ScanLine() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.position.x = Math.sin(t * 0.3) * 3;
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.03 + Math.sin(t * 0.6) * 0.02;
    }
  });

  return (
    <mesh ref={meshRef as React.RefObject<THREE.Mesh>} rotation={[0, 0, 0]}>
      <planeGeometry args={[0.03, 5]} />
      <meshBasicMaterial color="#ff4289" transparent opacity={0.04} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ─── Ground grid ─── */
function GroundGrid() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]}>
      <planeGeometry args={[24, 24, 50, 50]} />
      <meshBasicMaterial color="#1a2040" wireframe transparent opacity={0.035} />
    </mesh>
  );
}

/* ─── Loading ─── */
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span className="text-[11px] text-gray-600 tracking-wide">Initializing vehicle model...</span>
      </div>
    </div>
  );
}


/* ─── Premium phone — finished inspection report ─── */
function PremiumPhone({ isVisible }: { isVisible: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.9, delay: 0.8, ease: "easeOut" }}
      className="w-[130px] md:w-[155px]"
    >
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[80%] h-4 bg-black/20 blur-xl rounded-full" />
      <div className="relative rounded-[24px] border border-white/8 bg-[#080c14]/95 backdrop-blur-md p-[5px] shadow-2xl shadow-black/60">
        <div className="absolute top-4 right-3 w-12 h-24 bg-white/[0.015] rounded-full rotate-12 blur-sm pointer-events-none" />
        <div className="mx-auto w-14 h-[6px] bg-black rounded-full mt-0.5 mb-1" />
        <div className="rounded-[20px] bg-[#0c1220] overflow-hidden">
          <div className="flex items-center justify-between px-3 pt-1.5 pb-1">
            <span className="text-[4.5px] text-white/40 font-medium">9:41</span>
            <div className="flex items-center gap-[2px]">
              <div className="w-[5px] h-[3px] bg-white/30 rounded-[0.5px]" />
              <div className="w-[5px] h-[3px] bg-white/30 rounded-[0.5px]" />
              <div className="w-[7px] h-[3px] bg-emerald-400/60 rounded-[0.5px]" />
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.04]">
            <div className="flex items-center gap-1.5">
              <div className="w-[14px] h-[14px] rounded-[5px] bg-gradient-to-br from-accent-pink to-[#1a3a7a] flex items-center justify-center">
                <span className="text-[5px] text-white font-black">V</span>
              </div>
              <span className="text-[6px] text-white/90 font-bold tracking-tight">Inspection Report</span>
            </div>
            <div className="w-[10px] h-[10px] rounded-full border border-white/8 flex items-center justify-center">
              <span className="text-[5px] text-white/20">↗</span>
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="mb-2">
              <p className="text-[5px] text-white/30 font-medium uppercase tracking-wider">2023 Ford F-450 Super Duty</p>
              <p className="text-[4px] text-white/15 font-mono mt-0.5">VIN: 1FT8W4DT2P•••4019</p>
            </div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="relative w-[32px] h-[32px]">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke="url(#scoreGrad)" strokeWidth="3" strokeDasharray="94.2" strokeDashoffset="20.7" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ff4289" />
                      <stop offset="100%" stopColor="#ffffff" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-extrabold text-white">78</span>
                </div>
              </div>
              <div>
                <p className="text-[5.5px] text-white/70 font-semibold">Fair Condition</p>
                <p className="text-[4px] text-white/20 mt-0.5">4 areas inspected</p>
              </div>
            </div>
            <div className="space-y-[3px] mb-2.5">
              {[
                { label: "Exterior", score: 82 },
                { label: "Interior", score: 88 },
                { label: "Mechanical", score: 65 },
                { label: "Underbody", score: 74 },
              ].map((area) => (
                <div key={area.label} className="flex items-center gap-1.5">
                  <span className="text-[4px] text-white/25 w-[28px] text-right">{area.label}</span>
                  <div className="flex-1 h-[3px] bg-white/[0.03] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={isVisible ? { width: `${area.score}%` } : { width: 0 }}
                      transition={{ duration: 1, delay: 1.5 }}
                      className="h-full rounded-full"
                      style={{ background: area.score < 70 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.4)" }}
                    />
                  </div>
                  <span className="text-[4px] text-white/30 w-[10px]">{area.score}</span>
                </div>
              ))}
            </div>
            <div className="h-[1px] bg-white/[0.03] mb-2" />
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <p className="text-[4px] text-white/20 uppercase tracking-wider font-medium">Fair Acquisition</p>
                <p className="text-[9px] text-white font-extrabold">$38,200</p>
              </div>
              <div className="text-right">
                <p className="text-[4px] text-white/20 uppercase tracking-wider font-medium">Recon Est.</p>
                <p className="text-[8px] text-white/70 font-bold">$1,380</p>
              </div>
            </div>
            <div className="flex items-center gap-1 border border-white/[0.06] rounded-md px-1.5 py-[3px] mb-2 bg-white/[0.015]">
              <div className="w-[5px] h-[5px] rounded-full bg-accent-pink/50" />
              <span className="text-[4.5px] text-white/60 font-semibold">FAIR BUY</span>
              <span className="text-[3.5px] text-white/15 ml-auto">6 sources</span>
            </div>
            <div className="space-y-[3px]">
              <div className="flex items-center gap-1 bg-white/[0.015] rounded px-1.5 py-[3px]">
                <div className="w-[5px] h-[5px] rounded-full bg-white/15" />
                <span className="text-[4px] text-white/30">Front bumper scuff</span>
                <span className="text-[3.5px] text-white/20 ml-auto">$420</span>
              </div>
              <div className="flex items-center gap-1 bg-white/[0.015] rounded px-1.5 py-[3px]">
                <div className="w-[5px] h-[5px] rounded-full bg-white/15" />
                <span className="text-[4px] text-white/30">Rear tire wear</span>
                <span className="text-[3.5px] text-white/20 ml-auto">$960</span>
              </div>
              <div className="flex items-center gap-1 bg-white/[0.015] rounded px-1.5 py-[3px]">
                <div className="w-[5px] h-[5px] rounded-full bg-white/20" />
                <span className="text-[4px] text-white/30">No recalls found</span>
                <span className="text-[3.5px] text-white/20 ml-auto">Clear</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-around px-3 py-1.5 border-t border-white/[0.03] mt-1">
            <div className="w-[4px] h-[4px] rounded-full bg-white/10" />
            <div className="w-[4px] h-[4px] rounded-sm bg-accent-pink/30" />
            <div className="w-[4px] h-[4px] rounded-full bg-white/10" />
          </div>
          <div className="mx-auto w-10 h-[3px] bg-white/8 rounded-full my-1" />
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main ─── */
export default function VehicleInspectionVisual() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: false, margin: "-80px" });

  return (
    <div ref={sectionRef} className="relative w-full max-w-6xl mx-auto">
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[300px] bg-accent-pink/[0.02] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[250px] bg-[#1a3a7a]/[0.03] rounded-full blur-[80px] pointer-events-none" />

      <div className="relative w-full aspect-[16/9] md:aspect-[2/1]">
        <Suspense fallback={<LoadingFallback />}>
          <Canvas
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: true }}
            camera={{ position: [5.5, 3, 5.5], fov: 40 }}
            style={{ background: "transparent" }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 14, 8]} intensity={0.85} color="#e4e8ec" />
            <directionalLight position={[-8, 8, -4]} intensity={0.35} color="#c0d0e4" />
            <directionalLight position={[0, -3, 10]} intensity={0.15} color="#b0c0d0" />
            <directionalLight position={[-10, 6, -10]} intensity={0.3} color="#5878a0" />
            <OrbitControls
              autoRotate
              autoRotateSpeed={0.5}
              enablePan={false}
              minDistance={3}
              maxDistance={8}
              maxPolarAngle={Math.PI / 2.1}
            />
            <TruckModel />
            <ScanLine />
            <GroundGrid />
          </Canvas>
        </Suspense>
      </div>

      <div className="absolute -bottom-6 right-2 md:right-8 z-10 pointer-events-none">
        <PremiumPhone isVisible={isInView} />
      </div>
    </div>
  );
}
