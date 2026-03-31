"use client";

/**
 * VehicleViewer — top-level 3D vehicle visualization orchestrator.
 *
 * Accepts vehicle data (bodyStyle + nhtsaData) and risks, classifies into
 * an archetype, loads the correct model, and renders inspection overlays.
 *
 * Features:
 * - Auto-rotating turntable (pauses on interaction, resumes after 3s)
 * - Camera preset toolbar (overview, front, rear, driver, passenger, top)
 * - View mode toggle (findings / zones / heatmap / clean)
 * - GLTF model loading with procedural fallback
 * - Anatomically-correct damage markers
 * - Inspection zone overlays
 * - Risk heatmap
 */

import { Suspense, useMemo, useCallback, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { classifyVehicle } from "@/lib/vehicle-archetypes";
import { getModelConfig } from "@/lib/vehicle-models";
import { useVehicleViewerStore } from "@/stores/vehicle-viewer-store";
import { VehicleModel } from "./VehicleModel";
import { DamageMarkers, type RiskMarker } from "./DamageMarkers";
import {
  Crosshair,
  RotateCcw,
  MoveHorizontal,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RiskInput {
  id: string;
  severity: string;
  title: string;
  category: string;
  cost: { low: number; high: number };
  position: { x: number; y: number; z: number };
  symptoms: string[];
  description?: string;
  whatToCheck?: string;
  componentHint?: string;
}

interface VehicleViewerProps {
  vehicle: {
    bodyStyle: string | null;
    nhtsaData: Record<string, unknown> | null;
  };
  risks: RiskInput[];
  activeRiskId?: string | null;
  onRiskClick?: (riskId: string) => void;
  onZoneClick?: (zoneId: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Camera controller with animated transitions
// ---------------------------------------------------------------------------

function CameraController() {
  const { camera } = useThree();
  const cameraPreset = useVehicleViewerStore((s) => s.cameraPreset);
  const archetypeId = useVehicleViewerStore((s) => s.archetypeId);
  const targetRef = useRef(new THREE.Vector3(0, 0.4, 0));
  const posRef = useRef(new THREE.Vector3(3, 2, 3));
  const isAnimating = useRef(false);

  const config = archetypeId ? getModelConfig(archetypeId) : null;
  const preset = config?.cameraPresets.find((p) => p.name === cameraPreset);

  useEffect(() => {
    if (preset) {
      posRef.current.set(...preset.position);
      targetRef.current.set(...preset.target);
      isAnimating.current = true;
    }
  }, [preset]);

  useFrame(() => {
    if (isAnimating.current) {
      const cam = camera as THREE.PerspectiveCamera;
      const currentPos = new THREE.Vector3().copy(cam.position);
      const diff = posRef.current.clone().sub(currentPos);

      if (diff.length() < 0.05) {
        cam.position.copy(posRef.current);
        isAnimating.current = false;
      } else {
        cam.position.lerp(posRef.current, 0.08);
      }
      cam.lookAt(targetRef.current);
    }
  });

  return null;
}

// ---------------------------------------------------------------------------
// Auto-rotate controller
// ---------------------------------------------------------------------------

function AutoRotateController({
  controlsRef,
}: {
  controlsRef: React.RefObject<InstanceType<typeof import("three/examples/jsm/controls/OrbitControls.js").OrbitControls> | null>;
}) {
  const lastInteraction = useRef(0);
  const autoRotate = useRef(true);

  useFrame(() => {
    if (!controlsRef.current) return;
    const now = Date.now();
    const timeSinceInteraction = now - lastInteraction.current;

    // Resume auto-rotate after 3 seconds of inactivity
    if (timeSinceInteraction > 3000) {
      if (!autoRotate.current) {
        autoRotate.current = true;
        controlsRef.current.autoRotate = true;
      }
    }
  });

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleStart = () => {
      lastInteraction.current = Date.now();
      autoRotate.current = false;
      controls.autoRotate = false;
    };

    controls.addEventListener("start", handleStart);
    return () => controls.removeEventListener("start", handleStart);
  }, [controlsRef]);

  return null;
}

// ---------------------------------------------------------------------------
// 3D Scene
// ---------------------------------------------------------------------------

function Scene({
  config,
  risks,
  activeRiskId,
  onRiskClick,
  onZoneClick,
}: {
  config: ReturnType<typeof getModelConfig>;
  risks: RiskMarker[];
  activeRiskId: string | null;
  onRiskClick?: (riskId: string) => void;
  onZoneClick?: (zoneId: string) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  return (
    <>
      {/* CAD-style lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} />
      <directionalLight position={[-3, 4, -3]} intensity={0.3} />

      {/* Vehicle model */}
      <VehicleModel config={config} />

      {/* Always show damage markers (hotspots) */}
      <DamageMarkers
        risks={risks}
        archetypeId={config.archetypeId}
        activeRiskId={activeRiskId}
        onRiskClick={onRiskClick}
      />

      {/* Ground grid (stationary) */}
      <gridHelper
        args={[8, 24, "#3a3f52", "#2a2f42"]}
        position={[0, -0.01, 0]}
      />

      {/* Camera & controls */}
      <CameraController />
      <OrbitControls
        ref={controlsRef}
        autoRotate
        autoRotateSpeed={0.5}
        enablePan={false}
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={8}
        maxPolarAngle={Math.PI / 2.1}
      />
      <AutoRotateController controlsRef={controlsRef} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Camera preset button bar
// ---------------------------------------------------------------------------

const PRESET_LABELS = [
  { name: "overview", label: "3/4", icon: RotateCcw },
  { name: "front", label: "Front", icon: MoveHorizontal },
  { name: "rear", label: "Rear", icon: MoveHorizontal },
  { name: "driver", label: "Left", icon: MoveHorizontal },
  { name: "passenger", label: "Right", icon: MoveHorizontal },
  { name: "top", label: "Top", icon: Crosshair },
] as const;


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VehicleViewer({
  vehicle,
  risks: rawRisks,
  activeRiskId = null,
  onRiskClick,
  onZoneClick,
  className = "",
}: VehicleViewerProps) {
  const cameraPreset = useVehicleViewerStore((s) => s.cameraPreset);
  const setCameraPreset = useVehicleViewerStore((s) => s.setCameraPreset);
  const setArchetypeId = useVehicleViewerStore((s) => s.setArchetypeId);

  // Classify vehicle
  const archetype = useMemo(
    () => classifyVehicle(vehicle.bodyStyle, vehicle.nhtsaData),
    [vehicle.bodyStyle, vehicle.nhtsaData]
  );

  // Get model config
  const config = useMemo(
    () => getModelConfig(archetype.id),
    [archetype.id]
  );

  // Update store
  useEffect(() => {
    setArchetypeId(archetype.id);
  }, [archetype.id, setArchetypeId]);

  // Map risks to markers
  const risks: RiskMarker[] = useMemo(
    () =>
      rawRisks.map((r) => ({
        id: r.id,
        severity: r.severity as RiskMarker["severity"],
        title: r.title,
        category: r.category,
        componentHint: r.componentHint || r.whatToCheck || null,
        cost: r.cost,
      })),
    [rawRisks]
  );

  const handleRiskClick = useCallback(
    (riskId: string) => {
      onRiskClick?.(riskId);
    },
    [onRiskClick]
  );

  const handleZoneClick = useCallback(
    (zoneId: string) => {
      onZoneClick?.(zoneId);
    },
    [onZoneClick]
  );

  return (
    <div className={`relative w-full ${className}`}>
      {/* Archetype label */}
      <div className="absolute top-3 left-3 z-10">
        <span className="rounded-md bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 backdrop-blur-sm">
          {archetype.displayName}
        </span>
      </div>

      {/* Camera preset toolbar */}
      <div className="absolute top-3 right-3 z-10 flex gap-1">
        {PRESET_LABELS.map(({ name, label }) => (
          <button
            key={name}
            onClick={() => setCameraPreset(name)}
            className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
              cameraPreset === name
                ? "bg-brand-600/80 text-white"
                : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/70 hover:text-slate-200"
            } backdrop-blur-sm`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Hotspots always visible — no mode toggle needed */}

      {/* 3D Canvas */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full min-h-[400px] rounded-xl bg-[#1a1f2e]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Loading vehicle model...</p>
            </div>
          </div>
        }
      >
        <Canvas
          camera={{ position: [3, 2, 3], fov: 45 }}
          style={{ borderRadius: "0.75rem", minHeight: "400px" }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={["#1a1f2e"]} />
          <Scene
            config={config}
            risks={risks}
            activeRiskId={activeRiskId}
            onRiskClick={handleRiskClick}
            onZoneClick={handleZoneClick}
          />
        </Canvas>
      </Suspense>
    </div>
  );
}
