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
//  Weighted area contribution to 0-100 overall score
// ---------------------------------------------------------------------------

const AREA_WEIGHTS = {
  exteriorBody: 0.30,
  interior: 0.15,
  mechanicalVisual: 0.35,
  underbodyFrame: 0.20,
};

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

  const overallScore = Math.round(
    (scores.exteriorBody.score / 10) * AREA_WEIGHTS.exteriorBody * 100 +
    (scores.interior.score / 10) * AREA_WEIGHTS.interior * 100 +
    (scores.mechanicalVisual.score / 10) * AREA_WEIGHTS.mechanicalVisual * 100 +
    (scores.underbodyFrame.score / 10) * AREA_WEIGHTS.underbodyFrame * 100,
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
    exteriorBodyScore: scores.exteriorBody.score,
    interiorScore: scores.interior.score,
    mechanicalVisualScore: scores.mechanicalVisual.score,
    underbodyFrameScore: scores.underbodyFrame.score,
    exteriorBody: scores.exteriorBody,
    interior: scores.interior,
    mechanicalVisual: scores.mechanicalVisual,
    underbodyFrame: scores.underbodyFrame,
    summary,
    photoCoverage: {
      exteriorBody: photoCoverage.exteriorBody,
      interior: photoCoverage.interior,
      mechanicalVisual: photoCoverage.mechanicalVisual,
      underbodyFrame: photoCoverage.underbodyFrame,
    },
    tireAssessment: result.synthesis.tireAssessment,
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
