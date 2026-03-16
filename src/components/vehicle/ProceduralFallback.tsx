"use client";

/**
 * Procedural vehicle geometry fallback.
 *
 * Renders a simplified vehicle shape using Three.js primitives when no
 * GLTF model is available. Parameterized by archetype to show the correct
 * body type (sedan, SUV, truck, etc.).
 */

import type { VehicleArchetypeId } from "@/types/vehicle";

// ---------------------------------------------------------------------------
// Archetype dimensions (model-space units)
// ---------------------------------------------------------------------------

interface BodyDimensions {
  bodyLength: number;
  bodyWidth: number;
  bodyHeight: number;
  cabinLength: number;
  cabinHeight: number;
  cabinOffsetZ: number; // forward/back offset
  groundClearance: number;
  wheelRadius: number;
  wheelbaseHalf: number; // half the front-to-rear axle distance
  hasBed: boolean;
  bedLength: number;
}

const DIMENSIONS: Record<string, BodyDimensions> = {
  sedan: {
    bodyLength: 2.6, bodyWidth: 1.0, bodyHeight: 0.45,
    cabinLength: 1.4, cabinHeight: 0.38, cabinOffsetZ: 0.05,
    groundClearance: 0.08, wheelRadius: 0.2, wheelbaseHalf: 0.85,
    hasBed: false, bedLength: 0,
  },
  suv: {
    bodyLength: 2.7, bodyWidth: 1.1, bodyHeight: 0.55,
    cabinLength: 1.7, cabinHeight: 0.48, cabinOffsetZ: -0.1,
    groundClearance: 0.15, wheelRadius: 0.24, wheelbaseHalf: 0.9,
    hasBed: false, bedLength: 0,
  },
  truck: {
    bodyLength: 3.2, bodyWidth: 1.1, bodyHeight: 0.55,
    cabinLength: 1.3, cabinHeight: 0.5, cabinOffsetZ: 0.5,
    groundClearance: 0.18, wheelRadius: 0.26, wheelbaseHalf: 1.1,
    hasBed: true, bedLength: 1.2,
  },
  hatchback: {
    bodyLength: 2.3, bodyWidth: 0.95, bodyHeight: 0.45,
    cabinLength: 1.5, cabinHeight: 0.4, cabinOffsetZ: -0.05,
    groundClearance: 0.08, wheelRadius: 0.19, wheelbaseHalf: 0.78,
    hasBed: false, bedLength: 0,
  },
  coupe: {
    bodyLength: 2.4, bodyWidth: 1.0, bodyHeight: 0.4,
    cabinLength: 1.2, cabinHeight: 0.35, cabinOffsetZ: 0.1,
    groundClearance: 0.06, wheelRadius: 0.2, wheelbaseHalf: 0.82,
    hasBed: false, bedLength: 0,
  },
  minivan: {
    bodyLength: 2.8, bodyWidth: 1.1, bodyHeight: 0.55,
    cabinLength: 2.0, cabinHeight: 0.55, cabinOffsetZ: -0.1,
    groundClearance: 0.1, wheelRadius: 0.22, wheelbaseHalf: 0.95,
    hasBed: false, bedLength: 0,
  },
  van: {
    bodyLength: 3.0, bodyWidth: 1.1, bodyHeight: 0.7,
    cabinLength: 2.2, cabinHeight: 0.65, cabinOffsetZ: -0.15,
    groundClearance: 0.12, wheelRadius: 0.24, wheelbaseHalf: 1.0,
    hasBed: false, bedLength: 0,
  },
};

function getDimensions(archetypeId: VehicleArchetypeId): BodyDimensions {
  if (archetypeId.startsWith("sedan")) return DIMENSIONS.sedan;
  if (archetypeId.startsWith("suv")) return DIMENSIONS.suv;
  if (archetypeId.startsWith("truck")) {
    const dims = { ...DIMENSIONS.truck };
    if (archetypeId === "truck-crew-short") dims.bedLength = 0.9;
    if (archetypeId === "truck-regular-long") {
      dims.cabinLength = 1.0;
      dims.bedLength = 1.6;
      dims.bodyLength = 3.4;
    }
    return dims;
  }
  if (archetypeId === "minivan") return DIMENSIONS.minivan;
  if (archetypeId === "cargo-van") return DIMENSIONS.van;
  if (archetypeId === "coupe") return DIMENSIONS.coupe;
  if (archetypeId === "wagon") return { ...DIMENSIONS.sedan, cabinLength: 1.7, cabinOffsetZ: -0.1 };
  if (archetypeId === "hatchback") return DIMENSIONS.hatchback;
  return DIMENSIONS.sedan;
}

// ---------------------------------------------------------------------------
// Colors — enterprise diagnostic look
// ---------------------------------------------------------------------------

const BODY_COLOR = "#c8c8d4";
const WIREFRAME_COLOR = "#8890a0";
const GLASS_COLOR = "#a8c0d8";
const WHEEL_COLOR = "#2a2a2a";
const RIM_COLOR = "#444444";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProceduralFallbackProps {
  archetypeId: VehicleArchetypeId;
}

export function ProceduralFallback({ archetypeId }: ProceduralFallbackProps) {
  const d = getDimensions(archetypeId);
  const baseY = d.groundClearance + d.bodyHeight / 2;
  const cabinY = d.groundClearance + d.bodyHeight + d.cabinHeight / 2;
  const trackWidth = d.bodyWidth / 2 + 0.15;

  const wheelPositions: [number, number, number][] = [
    [trackWidth, d.wheelRadius + d.groundClearance, d.wheelbaseHalf],
    [-trackWidth, d.wheelRadius + d.groundClearance, d.wheelbaseHalf],
    [trackWidth, d.wheelRadius + d.groundClearance, -d.wheelbaseHalf],
    [-trackWidth, d.wheelRadius + d.groundClearance, -d.wheelbaseHalf],
  ];

  return (
    <group>
      {/* Main body */}
      <mesh position={[0, baseY, 0]}>
        <boxGeometry args={[d.bodyWidth, d.bodyHeight, d.bodyLength]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.85} metalness={0.1} />
      </mesh>
      {/* Body wireframe overlay */}
      <mesh position={[0, baseY, 0]}>
        <boxGeometry args={[d.bodyWidth, d.bodyHeight, d.bodyLength]} />
        <meshStandardMaterial color={WIREFRAME_COLOR} wireframe transparent opacity={0.3} />
      </mesh>

      {/* Cabin */}
      <mesh position={[0, cabinY, d.cabinOffsetZ]}>
        <boxGeometry args={[d.bodyWidth * 0.92, d.cabinHeight, d.cabinLength]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.85} metalness={0.1} />
      </mesh>
      {/* Cabin wireframe */}
      <mesh position={[0, cabinY, d.cabinOffsetZ]}>
        <boxGeometry args={[d.bodyWidth * 0.92, d.cabinHeight, d.cabinLength]} />
        <meshStandardMaterial color={WIREFRAME_COLOR} wireframe transparent opacity={0.3} />
      </mesh>

      {/* Windows (glass) */}
      {/* Windshield */}
      <mesh
        position={[0, cabinY + d.cabinHeight * 0.1, d.cabinOffsetZ + d.cabinLength / 2 + 0.01]}
        rotation={[-0.15, 0, 0]}
      >
        <planeGeometry args={[d.bodyWidth * 0.85, d.cabinHeight * 0.75]} />
        <meshStandardMaterial
          color={GLASS_COLOR}
          transparent
          opacity={0.35}
          roughness={0.1}
          metalness={0.3}
          side={2}
        />
      </mesh>
      {/* Rear window */}
      <mesh
        position={[0, cabinY + d.cabinHeight * 0.1, d.cabinOffsetZ - d.cabinLength / 2 - 0.01]}
        rotation={[0.15, Math.PI, 0]}
      >
        <planeGeometry args={[d.bodyWidth * 0.85, d.cabinHeight * 0.65]} />
        <meshStandardMaterial
          color={GLASS_COLOR}
          transparent
          opacity={0.35}
          roughness={0.1}
          metalness={0.3}
          side={2}
        />
      </mesh>

      {/* Hood line */}
      <mesh
        position={[0, d.groundClearance + d.bodyHeight + 0.02, d.bodyLength / 2 - 0.3]}
        rotation={[0, 0, 0]}
      >
        <boxGeometry args={[d.bodyWidth * 0.95, 0.02, d.bodyLength * 0.3]} />
        <meshStandardMaterial color={BODY_COLOR} roughness={0.8} metalness={0.15} />
      </mesh>

      {/* Truck bed */}
      {d.hasBed && (
        <>
          {/* Bed floor */}
          <mesh position={[0, baseY - d.bodyHeight * 0.1, -(d.bodyLength / 2 - d.bedLength / 2)]}>
            <boxGeometry args={[d.bodyWidth * 0.95, 0.05, d.bedLength]} />
            <meshStandardMaterial color={BODY_COLOR} roughness={0.9} metalness={0.05} />
          </mesh>
          {/* Bed walls */}
          {[-1, 1].map((side) => (
            <mesh
              key={`bedwall-${side}`}
              position={[side * d.bodyWidth * 0.47, baseY + d.bodyHeight * 0.15, -(d.bodyLength / 2 - d.bedLength / 2)]}
            >
              <boxGeometry args={[0.04, d.bodyHeight * 0.5, d.bedLength]} />
              <meshStandardMaterial color={BODY_COLOR} roughness={0.85} metalness={0.1} />
            </mesh>
          ))}
          {/* Tailgate */}
          <mesh position={[0, baseY + d.bodyHeight * 0.15, -(d.bodyLength / 2 + 0.02)]}>
            <boxGeometry args={[d.bodyWidth * 0.9, d.bodyHeight * 0.5, 0.04]} />
            <meshStandardMaterial color={BODY_COLOR} roughness={0.85} metalness={0.1} />
          </mesh>
        </>
      )}

      {/* Wheels */}
      {wheelPositions.map((pos, i) => (
        <group key={i} position={pos}>
          {/* Tire */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[d.wheelRadius, d.wheelRadius, 0.12, 20]} />
            <meshStandardMaterial color={WHEEL_COLOR} roughness={0.95} />
          </mesh>
          {/* Rim */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[d.wheelRadius, d.wheelRadius * 0.35, 8, 20]} />
            <meshStandardMaterial color={RIM_COLOR} roughness={0.7} metalness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
