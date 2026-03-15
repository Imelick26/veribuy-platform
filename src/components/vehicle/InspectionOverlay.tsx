"use client";

/**
 * Inspection zone overlay layer.
 *
 * Renders transparent bounding boxes for each inspection zone.
 * Zones highlight on hover and click, showing tooltips with zone labels.
 */

import { useState } from "react";
import { Html } from "@react-three/drei";
import type { InspectionZone } from "@/types/vehicle";

interface InspectionOverlayProps {
  zones: InspectionZone[];
  activeZone: string | null;
  onZoneClick?: (zoneId: string) => void;
}

function ZoneBox({
  zone,
  isActive,
  onClick,
}: {
  zone: InspectionZone;
  isActive: boolean;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const { min, max } = zone.boundingBox;
  const size: [number, number, number] = [
    max[0] - min[0],
    max[1] - min[1],
    max[2] - min[2],
  ];
  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];

  const visible = hovered || isActive;

  return (
    <group position={center}>
      {/* Clickable volume */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={isActive ? "#3b82f6" : "#60a5fa"}
          transparent
          opacity={visible ? (isActive ? 0.12 : 0.06) : 0}
          depthWrite={false}
        />
      </mesh>

      {/* Wireframe edges */}
      {visible && (
        <mesh>
          <boxGeometry args={size} />
          <meshStandardMaterial
            color="#3b82f6"
            wireframe
            transparent
            opacity={isActive ? 0.4 : 0.2}
          />
        </mesh>
      )}

      {/* Tooltip */}
      {visible && (
        <Html
          distanceFactor={5}
          position={[0, size[1] / 2 + 0.1, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="whitespace-nowrap rounded-md bg-slate-800/90 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur-sm">
            {zone.label}
          </div>
        </Html>
      )}
    </group>
  );
}

export function InspectionOverlay({
  zones,
  activeZone,
  onZoneClick,
}: InspectionOverlayProps) {
  return (
    <group>
      {zones.map((zone) => (
        <ZoneBox
          key={zone.id}
          zone={zone}
          isActive={activeZone === zone.id}
          onClick={() => onZoneClick?.(zone.id)}
        />
      ))}
    </group>
  );
}
