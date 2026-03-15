/**
 * VIN → Vehicle Archetype classification engine.
 *
 * Maps decoded NHTSA data (bodyStyle, nhtsaData JSON) to one of 14 vehicle
 * archetypes. The archetype drives which 3D model and inspection zone layout
 * to use in the viewer.
 */

import type { VehicleArchetype, VehicleArchetypeId, VehicleCategory } from "@/types/vehicle";

// ---------------------------------------------------------------------------
// Archetype definitions
// ---------------------------------------------------------------------------

const ARCHETYPES: Record<VehicleArchetypeId, VehicleArchetype> = {
  "sedan-compact": { id: "sedan-compact", category: "sedan", size: "compact", truckConfig: null, displayName: "Compact Sedan" },
  "sedan-midsize": { id: "sedan-midsize", category: "sedan", size: "midsize", truckConfig: null, displayName: "Midsize Sedan" },
  "sedan-fullsize": { id: "sedan-fullsize", category: "sedan", size: "fullsize", truckConfig: null, displayName: "Full-Size Sedan" },
  "suv-compact": { id: "suv-compact", category: "suv", size: "compact", truckConfig: null, displayName: "Compact SUV" },
  "suv-midsize": { id: "suv-midsize", category: "suv", size: "midsize", truckConfig: null, displayName: "Midsize SUV" },
  "suv-fullsize": { id: "suv-fullsize", category: "suv", size: "fullsize", truckConfig: null, displayName: "Full-Size SUV" },
  "truck-crew-short": { id: "truck-crew-short", category: "truck", size: null, truckConfig: { cab: "crew", bed: "short" }, displayName: "Crew Cab Short Bed" },
  "truck-crew-standard": { id: "truck-crew-standard", category: "truck", size: null, truckConfig: { cab: "crew", bed: "standard" }, displayName: "Crew Cab Standard Bed" },
  "truck-regular-long": { id: "truck-regular-long", category: "truck", size: null, truckConfig: { cab: "regular", bed: "long" }, displayName: "Regular Cab Long Bed" },
  "hatchback": { id: "hatchback", category: "hatchback", size: null, truckConfig: null, displayName: "Hatchback" },
  "coupe": { id: "coupe", category: "coupe", size: null, truckConfig: null, displayName: "Coupe" },
  "wagon": { id: "wagon", category: "wagon", size: null, truckConfig: null, displayName: "Wagon" },
  "minivan": { id: "minivan", category: "minivan", size: null, truckConfig: null, displayName: "Minivan" },
  "cargo-van": { id: "cargo-van", category: "cargo-van", size: null, truckConfig: null, displayName: "Cargo Van" },
};

// ---------------------------------------------------------------------------
// Body class pattern matching
// ---------------------------------------------------------------------------

/** Regex patterns to classify NHTSA BodyClass into primary category */
const BODY_CLASS_PATTERNS: Array<{ pattern: RegExp; category: VehicleCategory }> = [
  { pattern: /pickup/i, category: "truck" },
  { pattern: /truck/i, category: "truck" },
  { pattern: /sport utility|suv|multi.?purpose/i, category: "suv" },
  { pattern: /crossover/i, category: "suv" },
  { pattern: /hatchback|liftback/i, category: "hatchback" },
  { pattern: /coupe/i, category: "coupe" },
  { pattern: /wagon|estate/i, category: "wagon" },
  { pattern: /minivan|van.*passenger/i, category: "minivan" },
  { pattern: /cargo.*van|van.*cargo|cutaway/i, category: "cargo-van" },
  { pattern: /van/i, category: "cargo-van" },
  { pattern: /sedan|saloon/i, category: "sedan" },
  { pattern: /convertible|cabriolet/i, category: "coupe" },
];

// ---------------------------------------------------------------------------
// Size classification helpers
// ---------------------------------------------------------------------------

function classifySedanSize(nhtsaData: Record<string, unknown>): "compact" | "midsize" | "fullsize" {
  const wheelbase = parseFloat(String(nhtsaData?.WheelBaseShort || nhtsaData?.WheelBaseLong || "0"));
  const doors = parseInt(String(nhtsaData?.Doors || "4"));

  // Wheelbase-based classification (inches)
  if (wheelbase > 0) {
    if (wheelbase < 104) return "compact";
    if (wheelbase < 112) return "midsize";
    return "fullsize";
  }

  // Fallback: 2-door sedans are typically compact
  if (doors <= 2) return "compact";
  return "midsize";
}

function classifySuvSize(nhtsaData: Record<string, unknown>): "compact" | "midsize" | "fullsize" {
  const wheelbase = parseFloat(String(nhtsaData?.WheelBaseShort || nhtsaData?.WheelBaseLong || "0"));
  const gvwr = String(nhtsaData?.GVWR || "").toLowerCase();

  // GVWR-based (NHTSA class)
  if (gvwr.includes("class 3") || gvwr.includes("class 2")) return "fullsize";

  // Wheelbase-based (inches)
  if (wheelbase > 0) {
    if (wheelbase < 104) return "compact";
    if (wheelbase < 115) return "midsize";
    return "fullsize";
  }

  return "midsize";
}

function classifyTruck(nhtsaData: Record<string, unknown>): VehicleArchetypeId {
  const cabType = String(nhtsaData?.CabType || nhtsaData?.BodyCabType || "").toLowerCase();
  const bedLength = parseFloat(String(nhtsaData?.BedLengthIN || "0"));
  const doors = parseInt(String(nhtsaData?.Doors || "4"));

  // Regular cab (2 doors, single row)
  if (cabType.includes("regular") || cabType.includes("standard") || doors <= 2) {
    return "truck-regular-long";
  }

  // Extended / crew cab
  if (bedLength > 0 && bedLength < 66) {
    return "truck-crew-short"; // Short bed (under 5.5')
  }

  // Default crew cab with standard bed
  return "truck-crew-standard";
}

// ---------------------------------------------------------------------------
// Main classification function
// ---------------------------------------------------------------------------

/**
 * Classify a vehicle into one of the 14 archetypes based on NHTSA decoded data.
 *
 * @param bodyStyle - NHTSA BodyClass string (e.g., "Sedan/Saloon", "Sport Utility Vehicle (SUV)")
 * @param nhtsaData - Full NHTSA decode response stored as JSON
 * @returns VehicleArchetype with id, category, size, and display name
 */
export function classifyVehicle(
  bodyStyle: string | null | undefined,
  nhtsaData: Record<string, unknown> | null | undefined
): VehicleArchetype {
  const data = nhtsaData || {};
  const body = bodyStyle || String(data.BodyClass || "");

  // Match body class to primary category
  let category: VehicleCategory = "sedan"; // fallback
  for (const { pattern, category: cat } of BODY_CLASS_PATTERNS) {
    if (pattern.test(body)) {
      category = cat;
      break;
    }
  }

  // Determine specific archetype within category
  let archetypeId: VehicleArchetypeId;

  switch (category) {
    case "sedan":
      archetypeId = `sedan-${classifySedanSize(data)}` as VehicleArchetypeId;
      break;
    case "suv":
      archetypeId = `suv-${classifySuvSize(data)}` as VehicleArchetypeId;
      break;
    case "truck":
      archetypeId = classifyTruck(data);
      break;
    default:
      archetypeId = category as VehicleArchetypeId;
      break;
  }

  return ARCHETYPES[archetypeId] || ARCHETYPES["sedan-midsize"];
}

/** Get archetype by ID */
export function getArchetype(id: VehicleArchetypeId): VehicleArchetype {
  return ARCHETYPES[id] || ARCHETYPES["sedan-midsize"];
}

/** Get all archetype definitions */
export function getAllArchetypes(): VehicleArchetype[] {
  return Object.values(ARCHETYPES);
}
