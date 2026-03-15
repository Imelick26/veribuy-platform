/**
 * Vehicle archetype and 3D visualization types.
 *
 * These types drive the VIN→archetype→3D model pipeline.
 */

// ---------------------------------------------------------------------------
// Archetype IDs
// ---------------------------------------------------------------------------

export type VehicleArchetypeId =
  | "sedan-compact"
  | "sedan-midsize"
  | "sedan-fullsize"
  | "suv-compact"
  | "suv-midsize"
  | "suv-fullsize"
  | "truck-crew-short"
  | "truck-crew-standard"
  | "truck-regular-long"
  | "hatchback"
  | "coupe"
  | "wagon"
  | "minivan"
  | "cargo-van";

export type VehicleCategory =
  | "sedan"
  | "suv"
  | "truck"
  | "hatchback"
  | "coupe"
  | "wagon"
  | "minivan"
  | "cargo-van";

export type VehicleSize = "compact" | "midsize" | "fullsize" | null;

// ---------------------------------------------------------------------------
// Archetype classification result
// ---------------------------------------------------------------------------

export interface VehicleArchetype {
  id: VehicleArchetypeId;
  category: VehicleCategory;
  size: VehicleSize;
  truckConfig: { cab: string; bed: string } | null;
  displayName: string;
}

// ---------------------------------------------------------------------------
// 3D Inspection zones
// ---------------------------------------------------------------------------

export interface InspectionZone {
  id: string;
  label: string;
  /** Maps to FindingCategory (ENGINE, BRAKES, etc.) */
  category: string;
  /** Axis-aligned bounding box in model space */
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  /** Default hotspot anchor point in model space */
  markerPosition: [number, number, number];
  /** Sub-positions for specific components within this zone */
  subPositions: Record<string, [number, number, number]>;
  /** Preferred camera preset when focusing this zone */
  cameraPreset?: string;
}

// ---------------------------------------------------------------------------
// Camera presets
// ---------------------------------------------------------------------------

export interface CameraPreset {
  name: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
}

// ---------------------------------------------------------------------------
// Model configuration (manifest entry)
// ---------------------------------------------------------------------------

export interface VehicleModelConfig {
  archetypeId: VehicleArchetypeId;
  modelPath: string;
  /** Scale correction for imported GLTF */
  scale: [number, number, number];
  /** Position offset */
  position: [number, number, number];
  /** Rotation offset (Euler radians) */
  rotation: [number, number, number];
  /** Per-archetype camera presets */
  cameraPresets: CameraPreset[];
  /** Per-archetype inspection zones */
  inspectionZones: InspectionZone[];
}

// ---------------------------------------------------------------------------
// Viewer state
// ---------------------------------------------------------------------------

export type ViewMode = "zones" | "findings" | "heatmap" | "clean";

export type CameraPresetName =
  | "overview"
  | "front"
  | "rear"
  | "driver"
  | "passenger"
  | "top";
