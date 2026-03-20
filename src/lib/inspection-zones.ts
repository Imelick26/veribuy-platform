/**
 * Per-archetype inspection zone definitions.
 *
 * Each zone defines:
 * - A bounding box for highlight overlays
 * - A default marker position for hotspots
 * - Sub-positions for specific components (e.g., radiator, oil pan)
 *   so hotspots land on the actual vehicle part, not in abstract space
 *
 * Coordinate system (world space after model transform):
 *   X: left (-) to right (+) when facing the front
 *   Y: ground (0) to roof (~0.85 for sedans, ~1.1 for trucks/SUVs)
 *   Z: rear (-) to front (+)
 *
 * Positions calibrated for Comrade1280 models at 0.55 scale.
 */

import type { InspectionZone, VehicleArchetypeId } from "@/types/vehicle";

// ---------------------------------------------------------------------------
// Sedan zones (base template — compact/midsize/fullsize scale from here)
// ---------------------------------------------------------------------------

// Sedan at 0.55 scale: W≈1.20 H≈0.83 L≈2.70 → X±0.60, Y[0,0.83], Z±1.35
const SEDAN_ZONES: InspectionZone[] = [
  {
    id: "front-body-panels",
    label: "Front Body Panels",
    category: "COSMETIC_EXTERIOR",
    boundingBox: { min: [-0.6, 0, 0.7], max: [0.6, 0.55, 1.35] },
    markerPosition: [0, 0.35, 1.1],
    subPositions: {
      default: [0, 0.35, 1.1],
      bumper: [0, 0.2, 1.3],
      fender_left: [-0.55, 0.35, 0.9],
      fender_right: [0.55, 0.35, 0.9],
      grille: [0, 0.28, 1.25],
      hood: [0, 0.5, 0.8],
    },
    cameraPreset: "front",
  },
  {
    id: "rear-body-panels",
    label: "Rear Body Panels",
    category: "COSMETIC_EXTERIOR",
    boundingBox: { min: [-0.6, 0, -1.35], max: [0.6, 0.55, -0.6] },
    markerPosition: [0, 0.35, -1.1],
    subPositions: {
      default: [0, 0.35, -1.1],
      bumper: [0, 0.2, -1.3],
      trunk: [0, 0.5, -0.8],
      quarter_left: [-0.55, 0.35, -0.8],
      quarter_right: [0.55, 0.35, -0.8],
    },
    cameraPreset: "rear",
  },
  {
    id: "roof",
    label: "Roof",
    category: "COSMETIC_EXTERIOR",
    boundingBox: { min: [-0.45, 0.7, -0.4], max: [0.45, 0.85, 0.4] },
    markerPosition: [0, 0.82, 0],
    subPositions: {
      default: [0, 0.82, 0],
      sunroof: [0, 0.84, 0.1],
      antenna: [0, 0.84, -0.25],
    },
    cameraPreset: "top",
  },
  {
    id: "engine",
    label: "Engine Bay",
    category: "ENGINE",
    boundingBox: { min: [-0.5, 0.15, 0.5], max: [0.5, 0.55, 1.2] },
    markerPosition: [0, 0.35, 0.85],
    subPositions: {
      default: [0, 0.35, 0.85],
      radiator: [0, 0.38, 1.1],
      oil: [0, 0.2, 0.7],
      coolant: [0.15, 0.42, 0.95],
      alternator: [-0.25, 0.32, 0.8],
      exhaust_manifold: [0.25, 0.25, 0.75],
      air_filter: [0.25, 0.48, 0.9],
      turbo: [-0.15, 0.28, 0.85],
      fuel_system: [-0.25, 0.25, 0.65],
    },
    cameraPreset: "front",
  },
  {
    id: "drivetrain",
    label: "Drivetrain",
    category: "DRIVETRAIN",
    boundingBox: { min: [-0.3, 0, -0.3], max: [0.3, 0.2, 0.5] },
    markerPosition: [0, 0.1, 0.2],
    subPositions: {
      default: [0, 0.1, 0.2],
      transmission: [0, 0.12, 0.3],
      driveshaft: [0, 0.08, 0],
      differential: [0, 0.08, -0.7],
      axle_front: [0, 0.08, 0.6],
      axle_rear: [0, 0.08, -0.8],
      steering: [0, 0.2, 0.9],
      cv_joint: [0.35, 0.08, 0.5],
    },
    cameraPreset: "overview",
  },
  {
    id: "suspension",
    label: "Suspension",
    category: "SUSPENSION",
    boundingBox: { min: [-0.65, 0, -1.0], max: [0.65, 0.3, 1.0] },
    markerPosition: [0.55, 0.15, 0.7],
    subPositions: {
      default: [0.55, 0.15, 0.7],
      front_left: [-0.55, 0.15, 0.7],
      front_right: [0.55, 0.15, 0.7],
      rear_left: [-0.55, 0.15, -0.7],
      rear_right: [0.55, 0.15, -0.7],
      strut: [0.5, 0.25, 0.7],
      control_arm: [0.48, 0.08, 0.65],
      sway_bar: [0, 0.1, 0.7],
      shock: [0.5, 0.22, -0.7],
    },
    cameraPreset: "driver",
  },
  {
    id: "wheels-tires",
    label: "Wheels & Tires",
    category: "TIRES_WHEELS",
    boundingBox: { min: [-0.65, 0, -0.9], max: [0.65, 0.25, 0.9] },
    markerPosition: [0.58, 0.14, 0.7],
    subPositions: {
      default: [0.58, 0.14, 0.7],
      front_left: [-0.58, 0.14, 0.7],
      front_right: [0.58, 0.14, 0.7],
      rear_left: [-0.58, 0.14, -0.7],
      rear_right: [0.58, 0.14, -0.7],
    },
    cameraPreset: "driver",
  },
  {
    id: "interior",
    label: "Interior",
    category: "COSMETIC_INTERIOR",
    boundingBox: { min: [-0.4, 0.35, -0.3], max: [0.4, 0.75, 0.4] },
    markerPosition: [0, 0.55, 0.1],
    subPositions: {
      default: [0, 0.55, 0.1],
      dashboard: [0, 0.52, 0.4],
      seats_front: [0, 0.45, 0.2],
      seats_rear: [0, 0.45, -0.2],
      headliner: [0, 0.75, 0],
      carpet: [0, 0.25, 0],
      console: [0, 0.42, 0.3],
    },
    cameraPreset: "driver",
  },
  {
    id: "glass",
    label: "Glass & Mirrors",
    category: "COSMETIC_EXTERIOR",
    boundingBox: { min: [-0.55, 0.55, -0.4], max: [0.55, 0.82, 0.5] },
    markerPosition: [0, 0.68, 0.4],
    subPositions: {
      default: [0, 0.68, 0.4],
      windshield: [0, 0.7, 0.45],
      rear_window: [0, 0.68, -0.4],
      side_left: [-0.55, 0.62, 0],
      side_right: [0.55, 0.62, 0],
      mirror_left: [-0.6, 0.55, 0.3],
      mirror_right: [0.6, 0.55, 0.3],
    },
    cameraPreset: "overview",
  },
  {
    id: "lights",
    label: "Lights & Electrical",
    category: "ELECTRICAL",
    boundingBox: { min: [-0.6, 0.2, 0.9], max: [0.6, 0.5, 1.35] },
    markerPosition: [0.45, 0.32, 1.15],
    subPositions: {
      default: [0.45, 0.32, 1.15],
      headlight_left: [-0.45, 0.32, 1.15],
      headlight_right: [0.45, 0.32, 1.15],
      taillight_left: [-0.45, 0.32, -1.15],
      taillight_right: [0.45, 0.32, -1.15],
      fog_light: [0.4, 0.2, 1.2],
      turn_signal: [0.55, 0.35, 1.1],
      battery: [-0.3, 0.35, 0.9],
    },
    cameraPreset: "front",
  },
  {
    id: "brakes",
    label: "Brakes",
    category: "BRAKES",
    boundingBox: { min: [-0.65, 0, -0.9], max: [0.65, 0.2, 0.9] },
    markerPosition: [0.58, 0.1, 0.7],
    subPositions: {
      default: [0.58, 0.1, 0.7],
      front_left: [-0.58, 0.1, 0.7],
      front_right: [0.58, 0.1, 0.7],
      rear_left: [-0.58, 0.1, -0.7],
      rear_right: [0.58, 0.1, -0.7],
      parking: [0, 0.1, -0.5],
      abs: [0.25, 0.15, 0.5],
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
