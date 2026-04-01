"use client";

/**
 * Risk/damage marker layer.
 *
 * Renders animated hotspot markers at anatomically-correct positions on the
 * vehicle model. Each marker's position is resolved via the archetype's
 * inspection zone sub-positions, so a "radiator leak" marker appears at the
 * front grille, not at a generic engine center.
 *
 * Markers are children of the model group so they rotate WITH the vehicle.
 */

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { VehicleArchetypeId } from "@/types/vehicle";
import { resolveMarkerPosition } from "@/lib/inspection-zones";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RiskMarker {
  id: string;
  severity: "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR" | "INFO";
  title: string;
  category: string;
  /** Component hint for sub-position resolution (e.g., "radiator", "oil") */
  componentHint?: string | null;
  cost?: { low: number; high: number };
}

interface DamageMarkersProps {
  risks: RiskMarker[];
  archetypeId: VehicleArchetypeId;
  activeRiskId: string | null;
  onRiskClick?: (riskId: string) => void;
}

// ---------------------------------------------------------------------------
// Severity colors — green/yellow/red diagnostic palette
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  MAJOR: "#f97316",
  MODERATE: "#eab308",
  MINOR: "#22c55e",
  INFO: "#3b82f6",
};

// ---------------------------------------------------------------------------
// Individual marker
// ---------------------------------------------------------------------------

function Marker({
  risk,
  position,
  isActive,
  isDimmed,
  onClick,
}: {
  risk: RiskMarker;
  position: [number, number, number];
  isActive: boolean;
  /** True when another marker is active and this one isn't */
  isDimmed: boolean;
  onClick?: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Breathing pulse animation — active marker pulses prominently, dimmed ones shrink
  useFrame((state) => {
    if (meshRef.current) {
      let scale: number;
      if (isActive) {
        // Bold pulse for active marker
        scale = 1.4 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
      } else if (isDimmed) {
        // Shrink dimmed markers
        scale = 0.6;
      } else if (hovered) {
        scale = 1.3;
      } else {
        // Normal breathing
        scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      }
      meshRef.current.scale.setScalar(scale);
    }
    // Expanding ring on active marker
    if (ringRef.current && isActive) {
      const ringScale = 1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.3;
      ringRef.current.scale.setScalar(ringScale);
    }
  });

  const color = SEVERITY_COLORS[risk.severity] || "#666";
  const showTooltip = hovered || isActive;

  return (
    <group position={position}>
      {/* Main sphere — large enough to see through transparent body */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        renderOrder={10}
      >
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 1.5 : isDimmed ? 0.2 : hovered ? 1.2 : 0.8}
          transparent
          opacity={isDimmed ? 0.2 : 0.95}
          depthTest={false}
        />
      </mesh>

      {/* Outer pulse ring — hidden when dimmed, prominent when active */}
      <mesh ref={ringRef} renderOrder={9} visible={!isDimmed}>
        <sphereGeometry args={[isActive ? 0.17 : 0.12, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 0.6 : 0.3}
          transparent
          opacity={isActive ? 0.35 : 0.25}
          depthTest={false}
        />
      </mesh>

      {/* Tooltip */}
      {showTooltip && !isDimmed && (
        <Html
          distanceFactor={4}
          style={{ pointerEvents: "none" }}
        >
          <div className="whitespace-nowrap rounded-lg bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur-sm border border-slate-700/50 min-w-[140px]">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[11px] font-semibold text-white">
                {risk.title}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span
                className="font-medium"
                style={{ color }}
              >
                {risk.severity}
              </span>
              {risk.cost && (
                <span className="text-slate-400">
                  ${(risk.cost.low / 100).toLocaleString()} – $
                  {(risk.cost.high / 100).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Marker layer
// ---------------------------------------------------------------------------

export function DamageMarkers({
  risks,
  archetypeId,
  activeRiskId,
  onRiskClick,
}: DamageMarkersProps) {
  const hasActiveSelection = activeRiskId !== null;

  return (
    <group>
      {risks.map((risk) => {
        const position = resolveMarkerPosition(
          risk.category,
          archetypeId,
          risk.componentHint
        );
        const isActive = activeRiskId === risk.id;

        return (
          <Marker
            key={risk.id}
            risk={risk}
            position={position}
            isActive={isActive}
            isDimmed={hasActiveSelection && !isActive}
            onClick={() => onRiskClick?.(risk.id)}
          />
        );
      })}
    </group>
  );
}
