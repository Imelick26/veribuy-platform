/**
 * Per-archetype inspection zone definitions.
 *
 * Each zone defines:
 * - A bounding box for highlight overlays
 * - A default marker position for hotspots
 * - Sub-positions for specific components (e.g., radiator, oil pan)
 *   so hotspots land on the actual vehicle part, not in abstract space
 *
 * Coordinate system (model space, normalized):
 *   X: left (-) to right (+) when facing the front
 *   Y: ground (0) to roof (~1.5)
 *   Z: rear (-) to front (+)
 *
 * Positions will be adjusted per-archetype for correct proportions.
 */

import type { InspectionZone, VehicleArchetypeId } from "@/types/vehicle";

// ---------------------------------------------------------------------------
// Sedan zones (base template — compact/midsize/fullsize scale from here)
// ---------------------------------------------------------------------------

const SEDAN_ZONES: InspectionZone[] = [
  {
    id: "front-body-panels",
    label: "Front Body Panels",
    category: "COSMETIC_EXTERIOR",
    boundingBox: { min: [-0.8, 0, 0.7], max: [0.8, 0.8, 1.3] },
    markerPosition: [0, 0.5, 1.1],
    subPositions: {
      default: [0, 0.5, 1.1],
      bumper: [0, 0.3, 1.25],
      fender_left: [-0.7, 0.5, 0.9],
      fender_right: [0.7, 0.5, 0.9],
      grille: [0, 0.4, 1.2],
      hood: [0, 0.7, 0.8],
    },
    cameraPreset: "front",
  },
  {
    id: "rear-body-panels",
    label: "Rear Body Panels",
    category: "COSMETIC_EXTERIOR",
    boundingBox: { min: [-0.8, 0, -1.3], max: [0.8, 0.8, -0.6] },
    markerPosition: [0, 0.5, -1.1],
    subPositions: {
      default: [0, 0.5, -1.1],
      bumper: [0, 0.3, -1.25],
      trunk: [0, 0.65, -0.8],
      quarter_left: [-0.7, 0.45, -0.8],
      quarter_right: [0.7, 0.45, -0.8],
    },
    cameraPreset: "rear",
  },
  {
    id: "roof",
    label: "Roof",
    category: "COSMETIC_EXTERIOR",
    boundingBox: { min: [-0.6, 1.1, -0.5], max: [0.6, 1.4, 0.5] },
    markerPosition: [0, 1.3, 0],
    subPositions: {
      default: [0, 1.3, 0],
      sunroof: [0, 1.35, 0.1],
      antenna: [0, 1.35, -0.3],
    },
    cameraPreset: "top",
  },
  {
    id: "engine",
    label: "Engine Bay",
    category: "ENGINE",
    boundingBox: { min: [-0.6, 0.2, 0.5], max: [0.6, 0.8, 1.2] },
    markerPosition: [0, 0.5, 0.85],
    subPositions: {
      default: [0, 0.5, 0.85],
      radiator: [0, 0.55, 1.1],
      oil: [0, 0.3, 0.7],
      coolant: [0.2, 0.6, 0.95],
      alternator: [-0.3, 0.45, 0.8],
      exhaust_manifold: [0.3, 0.35, 0.75],
      air_filter: [0.3, 0.65, 0.9],
      turbo: [-0.2, 0.4, 0.85],
      fuel_system: [-0.3, 0.35, 0.65],
    },
    cameraPreset: "front",
  },
  {
    id: "drivetrain",
    label: "Drivetrain",
    category: "DRIVETRAIN",
    boundingBox: { min: [-0.4, 0, -0.3], max: [0.4, 0.3, 0.5] },
    markerPosition: [0, 0.15, 0.2],
    subPositions: {
      default: [0, 0.15, 0.2],
      transmission: [0, 0.2, 0.3],
      driveshaft: [0, 0.1, 0],
      differential: [0, 0.1, -0.7],
      axle_front: [0, 0.1, 0.6],
      axle_rear: [0, 0.1, -0.8],
      steering: [0, 0.3, 0.9],
      cv_joint: [0.4, 0.1, 0.5],
    },
    cameraPreset: "overview",
  },
  {
    id: "suspension",
    label: "Suspension",
    category: "SUSPENSION",
    boundingBox: { min: [-0.9, 0, -1.0], max: [0.9, 0.4, 1.0] },
    markerPosition: [0.7, 0.2, 0.7],
    subPositions: {
      default: [0.7, 0.2, 0.7],
      front_left: [-0.7, 0.2, 0.7],
      front_right: [0.7, 0.2, 0.7],
      rear_left: [-0.7, 0.2, -0.7],
      rear_right: [0.7, 0.2, -0.7],
      strut: [0.65, 0.35, 0.7],
      control_arm: [0.6, 0.1, 0.65],
      sway_bar: [0, 0.15, 0.7],
      shock: [0.65, 0.3, -0.7],
    },
    cameraPreset: "driver",
  },
  {
    id: "wheels-tires",
    label: "Wheels & Tires",
    category: "TIRES_WHEELS",
    boundingBox: { min: [-0.95, 0, -0.9], max: [0.95, 0.35, 0.9] },
    markerPosition: [0.85, 0.18, 0.7],
    subPositions: {
      default: [0.85, 0.18, 0.7],
      front_left: [-0.85, 0.18, 0.7],
      front_right: [0.85, 0.18, 0.7],
      rear_left: [-0.85, 0.18, -0.7],
      rear_right: [0.85, 0.18, -0.7],
    },
    cameraPreset: "driver",
  },
  {
    id: "interior",
    label: "Interior",
    category: "COSMETIC_INTERIOR",
    boundingBox: { min: [-0.5, 0.5, -0.3], max: [0.5, 1.2, 0.4] },
    markerPosition: [0, 0.8, 0.1],
    subPositions: {
      default: [0, 0.8, 0.1],
      dashboard: [0, 0.75, 0.4],
      seats_front: [0, 0.65, 0.2],
      seats_rear: [0, 0.65, -0.2],
      headliner: [0, 1.15, 0],
      carpet: [0, 0.35, 0],
      console: [0, 0.6, 0.3],
    },
    cameraPreset: "driver",
  },
  {
    id: "glass",
    label: "Glass & Mirrors",
    category: "COSMETIC_EXTERIOR",
    boundingBox: { min: [-0.7, 0.8, -0.5], max: [0.7, 1.35, 0.6] },
    markerPosition: [0, 1.0, 0.45],
    subPositions: {
      default: [0, 1.0, 0.45],
      windshield: [0, 1.05, 0.5],
      rear_window: [0, 1.0, -0.5],
      side_left: [-0.7, 0.95, 0],
      side_right: [0.7, 0.95, 0],
      mirror_left: [-0.8, 0.85, 0.35],
      mirror_right: [0.8, 0.85, 0.35],
    },
    cameraPreset: "overview",
  },
  {
    id: "lights",
    label: "Lights & Electrical",
    category: "ELECTRICAL",
    boundingBox: { min: [-0.8, 0.3, 0.9], max: [0.8, 0.7, 1.3] },
    markerPosition: [0.6, 0.45, 1.15],
    subPositions: {
      default: [0.6, 0.45, 1.15],
      headlight_left: [-0.6, 0.45, 1.15],
      headlight_right: [0.6, 0.45, 1.15],
      taillight_left: [-0.6, 0.45, -1.15],
      taillight_right: [0.6, 0.45, -1.15],
      fog_light: [0.5, 0.3, 1.2],
      turn_signal: [0.7, 0.5, 1.1],
      battery: [-0.4, 0.5, 0.9],
    },
    cameraPreset: "front",
  },
  {
    id: "brakes",
    label: "Brakes",
    category: "BRAKES",
    boundingBox: { min: [-0.9, 0, -0.9], max: [0.9, 0.25, 0.9] },
    markerPosition: [0.8, 0.15, 0.7],
    subPositions: {
      default: [0.8, 0.15, 0.7],
      front_left: [-0.8, 0.15, 0.7],
      front_right: [0.8, 0.15, 0.7],
      rear_left: [-0.8, 0.15, -0.7],
      rear_right: [0.8, 0.15, -0.7],
      parking: [0, 0.15, -0.5],
      abs: [0.3, 0.2, 0.5],
    },
    cameraPreset: "driver",
  },
];

// ---------------------------------------------------------------------------
// SUV zones — taller cabin, higher ground clearance
// ---------------------------------------------------------------------------

function createSuvZones(): InspectionZone[] {
  return SEDAN_ZONES.map((zone) => {
    const scaled = { ...zone, subPositions: { ...zone.subPositions } };
    // SUVs are taller — scale Y up by ~15%
    const scaleY = (pos: [number, number, number]): [number, number, number] =>
      [pos[0], pos[1] * 1.15, pos[2]];

    scaled.markerPosition = scaleY(zone.markerPosition);
    scaled.boundingBox = {
      min: scaleY(zone.boundingBox.min),
      max: scaleY(zone.boundingBox.max),
    };
    for (const [key, pos] of Object.entries(zone.subPositions)) {
      scaled.subPositions[key] = scaleY(pos);
    }
    return scaled;
  });
}

// ---------------------------------------------------------------------------
// Truck zones — extended length, bed area
// ---------------------------------------------------------------------------

function createTruckZones(bedLength: "short" | "standard" | "long"): InspectionZone[] {
  const bedOffset = bedLength === "long" ? -0.4 : bedLength === "standard" ? -0.2 : 0;
  const zones = SEDAN_ZONES.map((zone) => {
    const scaled = { ...zone, subPositions: { ...zone.subPositions } };
    // Scale Y up for truck height
    const scaleY = (pos: [number, number, number]): [number, number, number] =>
      [pos[0], pos[1] * 1.2, pos[2]];
    scaled.markerPosition = scaleY(zone.markerPosition);
    scaled.boundingBox = {
      min: scaleY(zone.boundingBox.min),
      max: scaleY(zone.boundingBox.max),
    };
    for (const [key, pos] of Object.entries(zone.subPositions)) {
      scaled.subPositions[key] = scaleY(pos);
    }
    return scaled;
  });

  // Add truck bed zone
  zones.push({
    id: "truck-bed",
    label: "Truck Bed",
    category: "COSMETIC_EXTERIOR",
    boundingBox: {
      min: [-0.7, 0.4, -1.4 + bedOffset],
      max: [0.7, 0.85, -0.4 + bedOffset],
    },
    markerPosition: [0, 0.6, -0.9 + bedOffset],
    subPositions: {
      default: [0, 0.6, -0.9 + bedOffset],
      tailgate: [0, 0.5, -1.35 + bedOffset],
      bed_floor: [0, 0.42, -0.9 + bedOffset],
      bed_liner: [0, 0.45, -0.7 + bedOffset],
      bed_rail_left: [-0.65, 0.8, -0.9 + bedOffset],
      bed_rail_right: [0.65, 0.8, -0.9 + bedOffset],
    },
    cameraPreset: "rear",
  });

  return zones;
}

// ---------------------------------------------------------------------------
// Zone registry
// ---------------------------------------------------------------------------

const ARCHETYPE_ZONES: Record<VehicleArchetypeId, InspectionZone[]> = {
  "sedan-compact": SEDAN_ZONES,
  "sedan-midsize": SEDAN_ZONES,
  "sedan-fullsize": SEDAN_ZONES,
  "suv-compact": createSuvZones(),
  "suv-midsize": createSuvZones(),
  "suv-fullsize": createSuvZones(),
  "truck-crew-short": createTruckZones("short"),
  "truck-crew-standard": createTruckZones("standard"),
  "truck-regular-long": createTruckZones("long"),
  "hatchback": SEDAN_ZONES,
  "coupe": SEDAN_ZONES,
  "wagon": SEDAN_ZONES,
  "minivan": createSuvZones(),
  "cargo-van": createSuvZones(),
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get all inspection zones for a given archetype.
 */
export function getInspectionZones(archetypeId: VehicleArchetypeId): InspectionZone[] {
  return ARCHETYPE_ZONES[archetypeId] || SEDAN_ZONES;
}

/**
 * Find the inspection zone that matches a finding category.
 */
export function getZoneForCategory(
  category: string,
  archetypeId: VehicleArchetypeId
): InspectionZone | null {
  const zones = getInspectionZones(archetypeId);
  return zones.find((z) => z.category === category) || null;
}

/**
 * Resolve a precise 3D position for a risk marker based on its category
 * and optional component hint (e.g., "radiator", "oil").
 *
 * Falls back: subPosition → zone markerPosition → default position.
 */
export function resolveMarkerPosition(
  category: string,
  archetypeId: VehicleArchetypeId,
  componentHint?: string | null
): [number, number, number] {
  const zone = getZoneForCategory(category, archetypeId);
  if (!zone) return [0, 0.5, 0]; // absolute fallback

  // Try to match component hint to a sub-position
  if (componentHint) {
    const hint = componentHint.toLowerCase().replace(/[^a-z0-9]/g, "_");
    // Exact match
    if (zone.subPositions[hint]) return zone.subPositions[hint];
    // Partial match
    for (const [key, pos] of Object.entries(zone.subPositions)) {
      if (hint.includes(key) || key.includes(hint)) return pos;
    }
  }

  return zone.subPositions.default || zone.markerPosition;
}
