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

// Generic Passenger Car Pack by Comrade1280 (CC-BY, ~250-320KB each)
// 10 unbranded modern vehicles covering all 14 archetypes
// Cache-bust version param — increment when re-uploading models
const MODEL_V = "v2";

const ARCHETYPE_MODEL_MAP: Record<VehicleArchetypeId, string> = {
  // Sedans
  "sedan-compact":       `${MODEL_CDN}/comrade1280/compact.glb?${MODEL_V}`,
  "sedan-midsize":       `${MODEL_CDN}/comrade1280/sedan.glb?${MODEL_V}`,
  "sedan-fullsize":      `${MODEL_CDN}/comrade1280/sedan.glb?${MODEL_V}`,
  // SUVs — offroad = Jeep-style (compact), suv = larger crossover (mid/full)
  "suv-compact":         `${MODEL_CDN}/comrade1280/offroad.glb?${MODEL_V}`,
  "suv-midsize":         `${MODEL_CDN}/comrade1280/suv.glb?${MODEL_V}`,
  "suv-fullsize":        `${MODEL_CDN}/comrade1280/suv.glb?${MODEL_V}`,
  // Pickup trucks
  "truck-crew-short":    `${MODEL_CDN}/comrade1280/pickup.glb?${MODEL_V}`,
  "truck-crew-standard": `${MODEL_CDN}/comrade1280/pickup.glb?${MODEL_V}`,
  "truck-regular-long":  `${MODEL_CDN}/comrade1280/pickup.glb?${MODEL_V}`,
  // Others
  "hatchback":           `${MODEL_CDN}/comrade1280/hatchback.glb?${MODEL_V}`,
  "coupe":               `${MODEL_CDN}/comrade1280/coupe.glb?${MODEL_V}`,
  "wagon":               `${MODEL_CDN}/comrade1280/wagon.glb?${MODEL_V}`,
  "minivan":             `${MODEL_CDN}/comrade1280/minivan.glb?${MODEL_V}`,
  "cargo-van":           `${MODEL_CDN}/comrade1280/minivan.glb?${MODEL_V}`,
};

// ---------------------------------------------------------------------------
// Model manifest
// ---------------------------------------------------------------------------

// Comrade1280 models are in centimeters with Y-forward (car pointing up).
// Scale 0.06 → ~3m car length; rotate -90° X to lay flat (Y-up → Z-forward).
const MODEL_SCALE: [number, number, number] = [0.06, 0.06, 0.06];
const MODEL_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0];

function createConfig(
  archetypeId: VehicleArchetypeId,
  overrides?: Partial<Omit<VehicleModelConfig, "archetypeId" | "inspectionZones">>
): VehicleModelConfig {
  return {
    archetypeId,
    modelPath: ARCHETYPE_MODEL_MAP[archetypeId] || `${MODEL_CDN}/comrade1280/sedan.glb`,
    scale: MODEL_SCALE,
    position: [0, 0, 0],
    rotation: MODEL_ROTATION,
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
