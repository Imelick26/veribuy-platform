/**
 * Vehicle model manifest.
 *
 * Maps each archetype to its GLTF/GLB model hosted on Supabase Storage CDN.
 * Models are loaded at runtime from the CDN — not bundled in the build.
 * Falls back to procedural geometry if a model fails to load.
 */

import type {
  CameraPreset,
  VehicleArchetypeId,
  VehicleModelConfig,
} from "@/types/vehicle";
import { getInspectionZones } from "./inspection-zones";

// ---------------------------------------------------------------------------
// CDN base URL (Supabase Storage public bucket)
// ---------------------------------------------------------------------------

const MODEL_CDN = "https://cfuddllkvkyxccpxebme.supabase.co/storage/v1/object/public/vehicle-models";

// ---------------------------------------------------------------------------
// Default camera presets (shared across archetypes, can be overridden)
// ---------------------------------------------------------------------------

const DEFAULT_CAMERA_PRESETS: CameraPreset[] = [
  { name: "overview", label: "Overview", position: [3, 2, 3], target: [0, 0.4, 0] },
  { name: "front", label: "Front", position: [0, 1.2, 3.5], target: [0, 0.4, 0] },
  { name: "rear", label: "Rear", position: [0, 1.2, -3.5], target: [0, 0.4, 0] },
  { name: "driver", label: "Driver", position: [-3.5, 1.2, 0], target: [0, 0.4, 0] },
  { name: "passenger", label: "Passenger", position: [3.5, 1.2, 0], target: [0, 0.4, 0] },
  { name: "top", label: "Top", position: [0, 4.5, 0.1], target: [0, 0, 0] },
];

// Taller presets for SUVs/trucks
const TALL_CAMERA_PRESETS: CameraPreset[] = DEFAULT_CAMERA_PRESETS.map((p) => ({
  ...p,
  position: [p.position[0], p.position[1] * 1.15, p.position[2]] as [number, number, number],
  target: [p.target[0], 0.5, p.target[2]] as [number, number, number],
}));

// ---------------------------------------------------------------------------
// Archetype → actual model file mapping
// Multiple archetypes can share the same model file.
// ---------------------------------------------------------------------------

// All GLB models from Kenney Car Kit (CC0 public domain, ~170KB each)
const ARCHETYPE_MODEL_MAP: Record<VehicleArchetypeId, string> = {
  // Sedans
  "sedan-compact":       `${MODEL_CDN}/kenney/sedan-sports.glb`,
  "sedan-midsize":       `${MODEL_CDN}/kenney/sedan.glb`,
  "sedan-fullsize":      `${MODEL_CDN}/kenney/sedan.glb`,
  // SUVs
  "suv-compact":         `${MODEL_CDN}/kenney/suv.glb`,
  "suv-midsize":         `${MODEL_CDN}/kenney/suv.glb`,
  "suv-fullsize":        `${MODEL_CDN}/kenney/suv-luxury.glb`,
  // Pickup trucks
  "truck-crew-short":    `${MODEL_CDN}/kenney/truck.glb`,
  "truck-crew-standard": `${MODEL_CDN}/kenney/truck.glb`,
  "truck-regular-long":  `${MODEL_CDN}/kenney/truck-flat.glb`,
  // Others
  "hatchback":           `${MODEL_CDN}/kenney/hatchback.glb`,
  "coupe":               `${MODEL_CDN}/kenney/coupe.glb`,
  "wagon":               `${MODEL_CDN}/kenney/wagon.glb`,
  "minivan":             `${MODEL_CDN}/kenney/minivan.glb`,
  "cargo-van":           `${MODEL_CDN}/kenney/cargo-van.glb`,
};

// ---------------------------------------------------------------------------
// Model manifest
// ---------------------------------------------------------------------------

function createConfig(
  archetypeId: VehicleArchetypeId,
  overrides?: Partial<Omit<VehicleModelConfig, "archetypeId" | "inspectionZones">>
): VehicleModelConfig {
  return {
    archetypeId,
    modelPath: ARCHETYPE_MODEL_MAP[archetypeId] || `${MODEL_CDN}/sedan.glb`,
    scale: [1, 1, 1],
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    cameraPresets: DEFAULT_CAMERA_PRESETS,
    inspectionZones: getInspectionZones(archetypeId),
    ...overrides,
  };
}

const MODEL_MANIFEST: Record<VehicleArchetypeId, VehicleModelConfig> = {
  "sedan-compact": createConfig("sedan-compact"),
  "sedan-midsize": createConfig("sedan-midsize"),
  "sedan-fullsize": createConfig("sedan-fullsize"),
  "suv-compact": createConfig("suv-compact", { cameraPresets: TALL_CAMERA_PRESETS }),
  "suv-midsize": createConfig("suv-midsize", { cameraPresets: TALL_CAMERA_PRESETS }),
  "suv-fullsize": createConfig("suv-fullsize", { cameraPresets: TALL_CAMERA_PRESETS }),
  "truck-crew-short": createConfig("truck-crew-short", { cameraPresets: TALL_CAMERA_PRESETS }),
  "truck-crew-standard": createConfig("truck-crew-standard", { cameraPresets: TALL_CAMERA_PRESETS }),
  "truck-regular-long": createConfig("truck-regular-long", { cameraPresets: TALL_CAMERA_PRESETS }),
  "hatchback": createConfig("hatchback"),
  "coupe": createConfig("coupe"),
  "wagon": createConfig("wagon"),
  "minivan": createConfig("minivan", { cameraPresets: TALL_CAMERA_PRESETS }),
  "cargo-van": createConfig("cargo-van", { cameraPresets: TALL_CAMERA_PRESETS }),
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the model config for an archetype.
 */
export function getModelConfig(archetypeId: VehicleArchetypeId): VehicleModelConfig {
  return MODEL_MANIFEST[archetypeId] || MODEL_MANIFEST["sedan-midsize"];
}

/**
 * Get camera presets for an archetype.
 */
export function getCameraPresets(archetypeId: VehicleArchetypeId): CameraPreset[] {
  return getModelConfig(archetypeId).cameraPresets;
}

/**
 * Get the GLTF model path for an archetype.
 */
export function getModelPath(archetypeId: VehicleArchetypeId): string {
  return getModelConfig(archetypeId).modelPath;
}
