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

import { useEffect, useMemo, Suspense } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { ProceduralFallback } from "./ProceduralFallback";
import type { VehicleModelConfig } from "@/types/vehicle";
import { useVehicleViewerStore } from "@/stores/vehicle-viewer-store";
import { ErrorBoundary } from "react-error-boundary";

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

/**
 * Inner component that actually loads the GLB via useLoader (Suspense-based).
 * Must be wrapped in <Suspense> and <ErrorBoundary>.
 */
function GltfModel({ config }: VehicleModelProps) {
  const setModelLoaded = useVehicleViewerStore((s) => s.setModelLoaded);

  // useLoader suspends until loaded — don't wrap in try/catch
  const gltf = useLoader(GLTFLoader, config.modelPath);

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

  if (!scene) {
    return <ProceduralFallback archetypeId={config.archetypeId} />;
  }

  return (
    <group rotation={config.rotation}>
      <primitive
        object={scene}
        scale={config.scale}
        position={config.position}
      />
    </group>
  );
}

/**
 * Fallback wrapper that shows ProceduralFallback on load error.
 */
function ErrorFallback({ config }: VehicleModelProps) {
  return <ProceduralFallback archetypeId={config.archetypeId} />;
}

export function VehicleModel({ config }: VehicleModelProps) {
  return (
    <ErrorBoundary
      fallback={<ProceduralFallback archetypeId={config.archetypeId} />}
    >
      <Suspense
        fallback={<ProceduralFallback archetypeId={config.archetypeId} />}
      >
        <GltfModel config={config} />
      </Suspense>
    </ErrorBoundary>
  );
}
