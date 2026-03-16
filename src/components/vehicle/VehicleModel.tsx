"use client";

/**
 * GLTF model renderer with uniform material override.
 *
 * Loads a .glb file for the given archetype, replaces all materials with
 * a uniform gray matte finish (diagnostic/CAD aesthetic), and positions
 * the model according to the manifest config.
 *
 * Falls back to ProceduralFallback when the .glb file is not available.
 */

import { useEffect, useState, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { ProceduralFallback } from "./ProceduralFallback";
import type { VehicleModelConfig } from "@/types/vehicle";
import { useVehicleViewerStore } from "@/stores/vehicle-viewer-store";

// Uniform semi-transparent material — lets damage hotspots show through
const VEHICLE_MATERIAL = new THREE.MeshPhysicalMaterial({
  color: "#b8c0d0",
  roughness: 0.4,
  metalness: 0.2,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,          // prevents z-fighting with interior markers
  side: THREE.DoubleSide,     // visible from inside too
  transmission: 0.1,          // slight glass-like effect
  clearcoat: 0.3,
});

interface VehicleModelProps {
  config: VehicleModelConfig;
}

function LoadedModel({ config }: VehicleModelProps) {
  const setModelLoaded = useVehicleViewerStore((s) => s.setModelLoaded);
  const [loadError, setLoadError] = useState(false);

  let gltf: { scene: THREE.Group } | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    gltf = useLoader(GLTFLoader, config.modelPath);
  } catch {
    // useLoader throws a promise during loading (Suspense) and an error on failure
  }

  // Clone scene and override materials
  const scene = useMemo(() => {
    if (!gltf?.scene) return null;
    const cloned = gltf.scene.clone(true);
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = VEHICLE_MATERIAL;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return cloned;
  }, [gltf]);

  useEffect(() => {
    if (scene) {
      setModelLoaded(true);
    }
    return () => setModelLoaded(false);
  }, [scene, setModelLoaded]);

  // Check if model file actually exists (handle 404)
  useEffect(() => {
    fetch(config.modelPath, { method: "HEAD" })
      .then((res) => {
        if (!res.ok) setLoadError(true);
      })
      .catch(() => setLoadError(true));
  }, [config.modelPath]);

  if (loadError || !scene) {
    return <ProceduralFallback archetypeId={config.archetypeId} />;
  }

  return (
    <primitive
      object={scene}
      scale={config.scale}
      position={config.position}
      rotation={config.rotation}
    />
  );
}

export function VehicleModel({ config }: VehicleModelProps) {
  const [useGltf, setUseGltf] = useState(true);

  // Pre-check if model file exists before attempting to load
  useEffect(() => {
    fetch(config.modelPath, { method: "HEAD" })
      .then((res) => {
        if (!res.ok) setUseGltf(false);
      })
      .catch(() => setUseGltf(false));
  }, [config.modelPath]);

  if (!useGltf) {
    return <ProceduralFallback archetypeId={config.archetypeId} />;
  }

  return <LoadedModel config={config} />;
}
