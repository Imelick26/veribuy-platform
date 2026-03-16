"use client";

/**
 * Risk heatmap overlay.
 *
 * Colors each inspection zone based on the worst severity of risks in
 * that zone. Provides a quick visual "health map" of the vehicle.
 *
 * Green = clear/minor, Yellow = moderate, Red = major/critical
 */

import type { InspectionZone, VehicleArchetypeId } from "@/types/vehicle";
import type { RiskMarker } from "./DamageMarkers";
import { getInspectionZones } from "@/lib/inspection-zones";

interface RiskHeatmapProps {
  risks: RiskMarker[];
  archetypeId: VehicleArchetypeId;
}

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 4,
  MAJOR: 3,
  MODERATE: 2,
  MINOR: 1,
  INFO: 0,
};

const HEATMAP_COLORS: Record<string, string> = {
  clear: "#22c55e",   // green — no issues
  minor: "#22c55e",   // green — minor/info only
  moderate: "#eab308", // yellow — moderate
  major: "#ef4444",    // red — major/critical
};

function getZoneSeverity(
  zone: InspectionZone,
  risks: RiskMarker[]
): string {
  const zoneRisks = risks.filter((r) => r.category === zone.category);
  if (zoneRisks.length === 0) return "clear";

  const maxRank = Math.max(...zoneRisks.map((r) => SEVERITY_RANK[r.severity] || 0));
  if (maxRank >= 3) return "major";
  if (maxRank >= 2) return "moderate";
  return "minor";
}

export function RiskHeatmap({ risks, archetypeId }: RiskHeatmapProps) {
  const zones = getInspectionZones(archetypeId);

  return (
    <group>
      {zones.map((zone) => {
        const severity = getZoneSeverity(zone, risks);
        const color = HEATMAP_COLORS[severity];
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

        return (
          <mesh key={zone.id} position={center}>
            <boxGeometry args={size} />
            <meshStandardMaterial
              color={color}
              transparent
              opacity={severity === "clear" ? 0.04 : severity === "minor" ? 0.08 : 0.15}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
