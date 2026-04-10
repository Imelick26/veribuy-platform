/**
 * Legacy Compatibility Layer
 *
 * Wraps the new 4-phase pipeline into the original function signatures
 * so inspection.ts requires zero changes. The pipeline runs once via
 * memoization even when these functions are called in Promise.all.
 */

import type {
  ConditionAssessment,
  OverallConditionResult,
  TireAssessment,
} from "@/types/risk";
import type { VehicleInfo, MediaForAnalysis } from "../types";
import { runPipeline } from "../pipeline";

// ---------------------------------------------------------------------------
//  9-bucket default weights (sum = 100) for 0-100 overall score
//  Dynamic weights from condition-weighter are applied later in the pipeline;
//  this layer uses the static defaults.
// ---------------------------------------------------------------------------

const DEFAULT_WEIGHTS = {
  paintBody: 15,
  panelAlignment: 10,
  glassLighting: 8,
  interiorSurfaces: 10,
  interiorControls: 5,
  engineBay: 20,
  tiresWheels: 10,
  underbodyFrame: 15,
  exhaust: 7,
};
const WEIGHT_SUM = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
//  Photo-to-area mapping (for photoCoverage count)
// ---------------------------------------------------------------------------

const AREA_PHOTO_MAP: Record<string, readonly string[]> = {
  exteriorBody: [
    "FRONT_CENTER", "FRONT_34_DRIVER", "FRONT_34_PASSENGER",
    "DRIVER_SIDE", "PASSENGER_SIDE", "REAR_34_DRIVER",
    "REAR_34_PASSENGER", "REAR_CENTER", "ROOF",
  ],
  interior: [
    "DASHBOARD_DRIVER", "FRONT_SEATS", "REAR_SEATS",
    "CARGO_AREA", "ODOMETER",
  ],
  mechanicalVisual: [
    "ENGINE_BAY", "TIRE_FRONT_DRIVER", "TIRE_REAR_DRIVER",
    "TIRE_FRONT_PASSENGER", "TIRE_REAR_PASSENGER",
  ],
  underbodyFrame: ["UNDERCARRIAGE"],
};

// ---------------------------------------------------------------------------
//  analyzeVehicleCondition() — drop-in replacement
// ---------------------------------------------------------------------------

export async function analyzeVehicleCondition(
  vehicle: VehicleInfo,
  media: MediaForAnalysis[],
  inspectorNotes?: string,
): Promise<ConditionAssessment> {
  const result = await runPipeline(vehicle, media, inspectorNotes);
  const scores = result.synthesis.areaScores;

  // --- 9-bucket overall score using default weights ---
  const overallScore = Math.round(
    (scores.paintBody.score / 10) * (DEFAULT_WEIGHTS.paintBody / WEIGHT_SUM) * 100 +
    (scores.panelAlignment.score / 10) * (DEFAULT_WEIGHTS.panelAlignment / WEIGHT_SUM) * 100 +
    (scores.glassLighting.score / 10) * (DEFAULT_WEIGHTS.glassLighting / WEIGHT_SUM) * 100 +
    (scores.interiorSurfaces.score / 10) * (DEFAULT_WEIGHTS.interiorSurfaces / WEIGHT_SUM) * 100 +
    (scores.interiorControls.score / 10) * (DEFAULT_WEIGHTS.interiorControls / WEIGHT_SUM) * 100 +
    (scores.engineBay.score / 10) * (DEFAULT_WEIGHTS.engineBay / WEIGHT_SUM) * 100 +
    (scores.tiresWheels.score / 10) * (DEFAULT_WEIGHTS.tiresWheels / WEIGHT_SUM) * 100 +
    (scores.underbodyFrame.score / 10) * (DEFAULT_WEIGHTS.underbodyFrame / WEIGHT_SUM) * 100 +
    (scores.exhaust.score / 10) * (DEFAULT_WEIGHTS.exhaust / WEIGHT_SUM) * 100,
  );

  // --- Legacy 4-area scores (rounded averages of sub-buckets) ---
  const exteriorBodyScore = Math.round(
    (scores.paintBody.score + scores.panelAlignment.score + scores.glassLighting.score) / 3,
  );
  const interiorScore = Math.round(
    (scores.interiorSurfaces.score + scores.interiorControls.score) / 2,
  );
  const mechanicalVisualScore = Math.round(
    (scores.engineBay.score + scores.tiresWheels.score + scores.exhaust.score) / 3,
  );

  const summary = [
    `Overall condition score: ${overallScore}/100.`,
    scores.exteriorBody.summary,
    scores.interior.summary,
    scores.mechanicalVisual.summary,
    scores.underbodyFrame.summary,
  ].join(" ");

  const captureTypes = new Set(media.map((m) => m.captureType));
  const photoCoverage: Record<string, number> = {};
  for (const [area, types] of Object.entries(AREA_PHOTO_MAP)) {
    photoCoverage[area] = types.filter((t) => captureTypes.has(t)).length;
  }

  return {
    overallScore,

    // Legacy 4-area scores
    exteriorBodyScore,
    interiorScore,
    mechanicalVisualScore,
    underbodyFrameScore: scores.underbodyFrame.score,

    // Legacy 4-area detail objects
    exteriorBody: scores.exteriorBody,
    interior: scores.interior,
    mechanicalVisual: scores.mechanicalVisual,
    underbodyFrame: scores.underbodyFrame,

    // 9-bucket scores (1-10)
    paintBodyScore: scores.paintBody.score,
    panelAlignmentScore: scores.panelAlignment.score,
    glassLightingScore: scores.glassLighting.score,
    interiorSurfacesScore: scores.interiorSurfaces.score,
    interiorControlsScore: scores.interiorControls.score,
    engineBayScore: scores.engineBay.score,
    tiresWheelsScore: scores.tiresWheels.score,
    exhaustScore: scores.exhaust.score,

    // 9-bucket detail objects
    paintBody: scores.paintBody,
    panelAlignment: scores.panelAlignment,
    glassLighting: scores.glassLighting,
    interiorSurfaces: scores.interiorSurfaces,
    interiorControls: scores.interiorControls,
    engineBay: scores.engineBay,
    tiresWheels: scores.tiresWheels,
    exhaust: scores.exhaust,

    summary,
    photoCoverage: {
      exteriorBody: photoCoverage.exteriorBody,
      interior: photoCoverage.interior,
      mechanicalVisual: photoCoverage.mechanicalVisual,
      underbodyFrame: photoCoverage.underbodyFrame,
    },
    tireAssessment: result.synthesis.tireAssessment ?? undefined,
  };
}

// ---------------------------------------------------------------------------
//  scanForUnexpectedIssues() — drop-in replacement
// ---------------------------------------------------------------------------

export async function scanForUnexpectedIssues(
  vehicle: { year: number; make: string; model: string },
  media: MediaForAnalysis[],
): Promise<OverallConditionResult> {
  const result = await runPipeline(vehicle, media);

  return {
    unexpectedFindings: result.unexpectedFindings,
    summary:
      result.unexpectedFindings.length > 0
        ? `Found ${result.unexpectedFindings.length} issues across the vehicle.`
        : "No unexpected issues found.",
  };
}

// ---------------------------------------------------------------------------
//  assessTires() — drop-in replacement
// ---------------------------------------------------------------------------

export async function assessTires(
  vehicle: VehicleInfo,
  media: MediaForAnalysis[],
): Promise<TireAssessment | null> {
  const result = await runPipeline(vehicle, media);
  return result.synthesis.tireAssessment || null;
}
