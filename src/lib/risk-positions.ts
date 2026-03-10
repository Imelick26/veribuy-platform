/**
 * Maps FindingCategory enum values and NHTSA component strings
 * to 3D coordinates on the wireframe car model.
 *
 * Coordinate system (from Vehicle3D.tsx):
 *   Body: x[-1.2, 1.2], y[-0.1, 0.7], z[-0.55, 0.55]
 *   Front of car = positive x, rear = negative x
 *   Top = positive y, ground = ~0
 *   Driver side = positive z (left when facing front)
 */

const CATEGORY_POSITIONS: Record<string, { x: number; y: number; z: number }> = {
  // Powertrain — front of vehicle
  ENGINE: { x: 0.8, y: 0.3, z: 0 },
  TRANSMISSION: { x: 0.3, y: 0.15, z: 0 },
  DRIVETRAIN: { x: -0.2, y: 0.15, z: 0 },

  // Structural — body / frame
  STRUCTURAL: { x: 0.0, y: 0.1, z: 0 },
  SUSPENSION: { x: 0.5, y: 0.0, z: 0.45 },
  BRAKES: { x: 0.7, y: 0.0, z: 0.5 },
  TIRES_WHEELS: { x: -0.7, y: 0.0, z: 0.5 },

  // Electrical / Electronics — cabin area
  ELECTRICAL: { x: 0.3, y: 0.45, z: 0.3 },
  ELECTRONICS: { x: 0.1, y: 0.5, z: 0.2 },
  SAFETY: { x: 0.0, y: 0.55, z: 0.3 },

  // Exterior / Interior
  COSMETIC_EXTERIOR: { x: -0.5, y: 0.3, z: 0.5 },
  COSMETIC_INTERIOR: { x: 0.0, y: 0.45, z: 0 },
  HVAC: { x: 0.4, y: 0.4, z: 0 },

  // Other
  OTHER: { x: 0.0, y: 0.3, z: 0 },
};

/**
 * Maps NHTSA component description strings to FindingCategory values.
 * NHTSA uses uppercase freetext component names like "ENGINE", "POWER TRAIN",
 * "ELECTRICAL SYSTEM", "AIR BAGS", etc.
 */
const NHTSA_COMPONENT_MAP: Record<string, string> = {
  "ENGINE": "ENGINE",
  "ENGINE AND ENGINE COOLING": "ENGINE",
  "POWER TRAIN": "TRANSMISSION",
  "POWERTRAIN": "TRANSMISSION",
  "FUEL SYSTEM": "ENGINE",
  "FUEL SYSTEM, GASOLINE": "ENGINE",
  "FUEL SYSTEM, DIESEL": "ENGINE",
  "FUEL/PROPULSION SYSTEM": "ENGINE",
  "EXHAUST SYSTEM": "ENGINE",

  "STEERING": "DRIVETRAIN",
  "SUSPENSION": "SUSPENSION",
  "SERVICE BRAKES": "BRAKES",
  "SERVICE BRAKES, HYDRAULIC": "BRAKES",
  "SERVICE BRAKES, AIR": "BRAKES",
  "PARKING BRAKE": "BRAKES",
  "BRAKES": "BRAKES",

  "ELECTRICAL SYSTEM": "ELECTRICAL",
  "ELECTRONIC STABILITY CONTROL": "ELECTRONICS",
  "FORWARD COLLISION AVOIDANCE": "ELECTRONICS",
  "LANE DEPARTURE": "ELECTRONICS",
  "BACK OVER PREVENTION": "ELECTRONICS",

  "AIR BAGS": "SAFETY",
  "SEAT BELTS": "SAFETY",
  "CHILD SEAT": "SAFETY",
  "SEATS": "SAFETY",

  "EXTERIOR LIGHTING": "COSMETIC_EXTERIOR",
  "INTERIOR LIGHTING": "COSMETIC_INTERIOR",
  "VISIBILITY": "COSMETIC_EXTERIOR",
  "STRUCTURE": "STRUCTURAL",
  "BODY STRUCTURE": "STRUCTURAL",
  "LATCHES/LOCKS/LINKAGES": "STRUCTURAL",

  "TIRES": "TIRES_WHEELS",
  "WHEELS": "TIRES_WHEELS",

  "AIR CONDITIONING": "HVAC",
  "EQUIPMENT": "OTHER",
  "EQUIPMENT ADAPTIVE": "OTHER",
  "HYBRID PROPULSION SYSTEM": "ENGINE",
  "VEHICLE SPEED CONTROL": "ELECTRONICS",
};

let jitterCounter = 0;

/**
 * Get 3D position for a FindingCategory with slight jitter
 * to prevent overlapping hotspots.
 */
export function getPositionForCategory(category: string): { x: number; y: number; z: number } {
  const base = CATEGORY_POSITIONS[category] || CATEGORY_POSITIONS.OTHER;
  jitterCounter++;
  // Deterministic jitter based on counter
  const jx = ((jitterCounter * 7) % 11 - 5) * 0.02;
  const jy = ((jitterCounter * 13) % 11 - 5) * 0.015;
  const jz = ((jitterCounter * 17) % 11 - 5) * 0.02;
  return {
    x: Math.round((base.x + jx) * 100) / 100,
    y: Math.round((base.y + jy) * 100) / 100,
    z: Math.round((base.z + jz) * 100) / 100,
  };
}

/**
 * Map an NHTSA component string to a FindingCategory.
 * Falls back to "OTHER" for unrecognized components.
 */
export function mapNHTSAComponent(nhtsaComponent: string): string {
  const upper = nhtsaComponent.toUpperCase().trim();

  // Exact match
  if (NHTSA_COMPONENT_MAP[upper]) return NHTSA_COMPONENT_MAP[upper];

  // Partial match — check if any key is contained in the component string
  for (const [key, category] of Object.entries(NHTSA_COMPONENT_MAP)) {
    if (upper.includes(key)) return category;
  }

  return "OTHER";
}

/** Reset jitter counter (for testing) */
export function resetJitter() {
  jitterCounter = 0;
}
