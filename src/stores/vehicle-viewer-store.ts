import { create } from "zustand";
import type { VehicleArchetypeId, CameraPresetName, ViewMode } from "@/types/vehicle";

interface VehicleViewerState {
  // Model state
  archetypeId: VehicleArchetypeId | null;
  modelLoaded: boolean;
  loadProgress: number;

  // Interaction state
  activeZone: string | null;
  activeRiskId: string | null;
  cameraPreset: CameraPresetName;
  viewMode: ViewMode;

  // Actions
  setArchetypeId: (id: VehicleArchetypeId | null) => void;
  setModelLoaded: (loaded: boolean) => void;
  setLoadProgress: (progress: number) => void;
  setActiveZone: (zoneId: string | null) => void;
  setActiveRiskId: (riskId: string | null) => void;
  setCameraPreset: (preset: CameraPresetName) => void;
  setViewMode: (mode: ViewMode) => void;
  reset: () => void;
}

const initialState = {
  archetypeId: null as VehicleArchetypeId | null,
  modelLoaded: false,
  loadProgress: 0,
  activeZone: null as string | null,
  activeRiskId: null as string | null,
  cameraPreset: "overview" as CameraPresetName,
  viewMode: "findings" as ViewMode,
};

export const useVehicleViewerStore = create<VehicleViewerState>((set) => ({
  ...initialState,

  setArchetypeId: (id) => set({ archetypeId: id }),
  setModelLoaded: (loaded) => set({ modelLoaded: loaded }),
  setLoadProgress: (progress) => set({ loadProgress: progress }),
  setActiveZone: (zoneId) => set({ activeZone: zoneId }),
  setActiveRiskId: (riskId) => set({ activeRiskId: riskId }),
  setCameraPreset: (preset) => set({ cameraPreset: preset }),
  setViewMode: (mode) => set({ viewMode: mode }),
  reset: () => set(initialState),
}));
