/**
 * Phase 2: Comparison Scans
 *
 * Multi-photo calls that look across the vehicle for cross-panel patterns:
 * - Paint consistency (9 exterior photos)
 * - Panel alignment (9 exterior photos)
 * - Tire comparison (4 tire photos)
 * - Interior wear consistency (3 interior photos)
 * - Wear vs mileage (6 representative photos)
 *
 * All 5 run in parallel.
 */

import type {
  VehicleInfo,
  MediaForAnalysis,
  ComparisonFinding,
  ComparisonResults,
  TireComparisonResult,
  SeverityLevel,
} from "../types";
import type { TireAssessment, TireConditionLevel } from "@/types/risk";
import {
  buildPaintConsistencyPrompt,
  buildPanelAlignmentPrompt,
  buildTireComparisonPrompt,
  buildInteriorConsistencyPrompt,
  buildWearVsMileagePrompt,
} from "../prompts/comparison";
import { callVision, validatePhotoUrls, buildPhotoLabels } from "../utils";

// ---------------------------------------------------------------------------
//  Photo selection helpers
// ---------------------------------------------------------------------------

const EXTERIOR_TYPES = [
  "FRONT_CENTER", "FRONT_34_DRIVER", "FRONT_34_PASSENGER",
  "DRIVER_SIDE", "PASSENGER_SIDE", "REAR_34_DRIVER",
  "REAR_34_PASSENGER", "REAR_CENTER", "ROOF",
];

const TIRE_TYPES = [
  "TIRE_FRONT_DRIVER", "TIRE_FRONT_PASSENGER",
  "TIRE_REAR_DRIVER", "TIRE_REAR_PASSENGER",
];

const INTERIOR_TYPES = ["DASHBOARD_DRIVER", "FRONT_SEATS", "REAR_SEATS"];

const WEAR_REPRESENTATIVE_TYPES = [
  "FRONT_CENTER", "DRIVER_SIDE", "DASHBOARD_DRIVER",
  "ENGINE_BAY", "UNDERCARRIAGE", "TIRE_FRONT_DRIVER",
];

function selectPhotos(media: MediaForAnalysis[], types: string[]): MediaForAnalysis[] {
  return types
    .map((t) => media.find((m) => m.captureType === t))
    .filter((m): m is MediaForAnalysis => !!m);
}

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

export async function runPhase2(
  vehicle: VehicleInfo,
  media: MediaForAnalysis[],
): Promise<ComparisonResults> {
  console.log("[phase2] Running 5 comparison scans (2 batches to avoid rate limits)");

  // Batch 1: exterior scans (paint + alignment)
  const [paintFindings, alignmentFindings] = await Promise.all([
    runPaintScan(vehicle, media),
    runAlignmentScan(vehicle, media),
  ]);

  // Batch 2: remaining scans (tires + interior + wear)
  const [tireResult, interiorFindings, wearFindings] = await Promise.all([
    runTireComparison(vehicle, media),
    runInteriorConsistency(vehicle, media),
    runWearVsMileage(vehicle, media),
  ]);

  const apiCalls = 5; // All 5 always run

  console.log(
    `[phase2] Complete: ${paintFindings.length} paint, ${alignmentFindings.length} alignment, ` +
    `${tireResult.findings.length} tire, ${interiorFindings.length} interior, ${wearFindings.length} wear findings`,
  );

  return { paintFindings, alignmentFindings, tireResult, interiorFindings, wearFindings, apiCalls };
}

// ---------------------------------------------------------------------------
//  Individual comparison scans
// ---------------------------------------------------------------------------

async function runPaintScan(vehicle: VehicleInfo, media: MediaForAnalysis[]): Promise<ComparisonFinding[]> {
  const photos = await validatePhotoUrls(selectPhotos(media, EXTERIOR_TYPES), "phase2:paint");
  if (photos.length < 3) return [];

  const mileageStr = vehicle.mileage ? `${vehicle.mileage.toLocaleString()} miles` : "unknown mileage";
  const prompt = buildPaintConsistencyPrompt(vehicle, mileageStr);

  const response = await callVision<ComparisonResponse>({
    model: "gpt-4o",
    systemPrompt: prompt.system,
    userText: `${prompt.user}\n\nPHOTOS PROVIDED (${photos.length}):\n${buildPhotoLabels(photos)}`,
    photos,
    temperature: 0.2,
    maxTokens: 1200,
    label: "phase2:paint",
  });

  return normalizeComparisonFindings(response, "paint_mismatch", photos);
}

async function runAlignmentScan(vehicle: VehicleInfo, media: MediaForAnalysis[]): Promise<ComparisonFinding[]> {
  const photos = await validatePhotoUrls(selectPhotos(media, EXTERIOR_TYPES), "phase2:alignment");
  if (photos.length < 3) return [];

  const mileageStr = vehicle.mileage ? `${vehicle.mileage.toLocaleString()} miles` : "unknown mileage";
  const prompt = buildPanelAlignmentPrompt(vehicle, mileageStr);

  const response = await callVision<ComparisonResponse>({
    model: "gpt-4o",
    systemPrompt: prompt.system,
    userText: `${prompt.user}\n\nPHOTOS PROVIDED (${photos.length}):\n${buildPhotoLabels(photos)}`,
    photos,
    temperature: 0.2,
    maxTokens: 1200,
    label: "phase2:alignment",
  });

  return normalizeComparisonFindings(response, "panel_alignment", photos);
}

async function runTireComparison(vehicle: VehicleInfo, media: MediaForAnalysis[]): Promise<TireComparisonResult> {
  const photos = await validatePhotoUrls(selectPhotos(media, TIRE_TYPES), "phase2:tires");

  // When no tire photos are available, return null assessment so downstream
  // code knows tires were NOT assessed (rather than falsely reporting "GOOD")
  const emptyResult: TireComparisonResult = {
    tireAssessment: null,
    findings: [],
  };

  if (photos.length === 0) return emptyResult;

  const mileageStr = vehicle.mileage ? `${vehicle.mileage.toLocaleString()} miles` : "unknown mileage";
  const prompt = buildTireComparisonPrompt(vehicle, mileageStr);

  const response = await callVision<TireComparisonResponse>({
    model: "gpt-4o",
    systemPrompt: prompt.system,
    userText: `${prompt.user}\n\nPHOTOS PROVIDED (${photos.length}):\n${buildPhotoLabels(photos)}`,
    photos,
    temperature: 0.2,
    maxTokens: 1200,
    label: "phase2:tires",
  });

  if (!response) return emptyResult;

  const ta = response.result.tireAssessment;
  const normTire = (t?: { condition?: string; observations?: string[] }) => ({
    condition: normalizeTireLevel(t?.condition),
    observations: Array.isArray(t?.observations) ? t!.observations.map(String).slice(0, 5) : [],
  });

  return {
    tireAssessment: {
      frontDriver: normTire(ta?.frontDriver),
      frontPassenger: normTire(ta?.frontPassenger),
      rearDriver: normTire(ta?.rearDriver),
      rearPassenger: normTire(ta?.rearPassenger),
      overallTireScore: Math.max(1, Math.min(10, Math.round(Number(ta?.overallTireScore) || 5))),
      summary: String(ta?.summary || "Tire comparison completed"),
    },
    findings: normalizeComparisonFindings(response, "tire_inconsistency", photos),
  };
}

async function runInteriorConsistency(vehicle: VehicleInfo, media: MediaForAnalysis[]): Promise<ComparisonFinding[]> {
  const photos = await validatePhotoUrls(selectPhotos(media, INTERIOR_TYPES), "phase2:interior");
  if (photos.length < 2) return [];

  const mileageStr = vehicle.mileage ? `${vehicle.mileage.toLocaleString()} miles` : "unknown mileage";
  const prompt = buildInteriorConsistencyPrompt(vehicle, mileageStr);

  const response = await callVision<ComparisonResponse>({
    model: "gpt-4o",
    systemPrompt: prompt.system,
    userText: `${prompt.user}\n\nPHOTOS PROVIDED (${photos.length}):\n${buildPhotoLabels(photos)}`,
    photos,
    temperature: 0.2,
    maxTokens: 1000,
    label: "phase2:interior",
  });

  return normalizeComparisonFindings(response, "wear_inconsistency", photos);
}

async function runWearVsMileage(vehicle: VehicleInfo, media: MediaForAnalysis[]): Promise<ComparisonFinding[]> {
  const photos = await validatePhotoUrls(selectPhotos(media, WEAR_REPRESENTATIVE_TYPES), "phase2:wear");
  if (photos.length < 3) return [];

  const mileageStr = vehicle.mileage ? `${vehicle.mileage.toLocaleString()} miles` : "unknown mileage";
  const prompt = buildWearVsMileagePrompt(vehicle, mileageStr);

  const response = await callVision<ComparisonResponse>({
    model: "gpt-4o",
    systemPrompt: prompt.system,
    userText: `${prompt.user}\n\nPHOTOS PROVIDED (${photos.length}):\n${buildPhotoLabels(photos)}`,
    photos,
    temperature: 0.2,
    maxTokens: 1000,
    label: "phase2:wear",
  });

  return normalizeComparisonFindings(response, "mileage_discrepancy", photos);
}

// ---------------------------------------------------------------------------
//  Response normalization
// ---------------------------------------------------------------------------

interface ComparisonResponse {
  findings?: ComparisonResponseFinding[];
  notes?: string;
}

interface ComparisonResponseFinding {
  title?: string;
  description?: string;
  severity?: string;
  confidence?: number;
  affectedAreas?: string[];
  /**
   * 1-based index into the PHOTOS PROVIDED list identifying the single photo
   * that most clearly shows this issue. Used to correlate the finding back to
   * the actual image for display.
   */
  sourcePhotoIndex?: number;
  /** Optional multiple indices if more than one photo is relevant */
  sourcePhotoIndices?: number[];
}

interface TireComparisonResponse extends ComparisonResponse {
  tireAssessment?: {
    frontDriver?: { condition?: string; observations?: string[] };
    frontPassenger?: { condition?: string; observations?: string[] };
    rearDriver?: { condition?: string; observations?: string[] };
    rearPassenger?: { condition?: string; observations?: string[] };
    overallTireScore?: number;
    summary?: string;
  };
}

const VALID_SEVERITIES: SeverityLevel[] = ["minor", "moderate", "major", "critical"];

function normalizeComparisonFindings(
  response: { result: ComparisonResponse; raw: string } | null,
  type: ComparisonFinding["type"],
  sourcePhotos: MediaForAnalysis[],
): ComparisonFinding[] {
  if (!response || !Array.isArray(response.result.findings)) return [];

  return response.result.findings
    .filter((f) => f.title && f.description)
    .map((f) => {
      // Resolve AI's 1-based photo indices back to photoIds from the photo set
      // we actually sent to this call. Fallback: all sent photos in order.
      const aiIndices: number[] = [];
      if (typeof f.sourcePhotoIndex === "number") aiIndices.push(f.sourcePhotoIndex);
      if (Array.isArray(f.sourcePhotoIndices)) {
        for (const n of f.sourcePhotoIndices) {
          if (typeof n === "number" && !aiIndices.includes(n)) aiIndices.push(n);
        }
      }
      const resolvedIds = aiIndices
        .map((i) => sourcePhotos[Math.max(0, Math.min(sourcePhotos.length - 1, i - 1))]?.id)
        .filter((id): id is string => !!id);

      // Ensure we always have at least one source photo ID so the UI never
      // falls back to the old hardcoded map. If the AI didn't provide an
      // index, use all photos that were sent to this scan (the UI will
      // display the first one).
      const sourcePhotoIds = resolvedIds.length > 0
        ? resolvedIds
        : sourcePhotos.map((p) => p.id);

      return {
        title: String(f.title),
        description: String(f.description),
        severity: VALID_SEVERITIES.includes(f.severity as SeverityLevel)
          ? (f.severity as SeverityLevel)
          : "minor",
        confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0.5)),
        type,
        affectedAreas: Array.isArray(f.affectedAreas) ? f.affectedAreas.map(String) : [],
        sourcePhotoIds,
      };
    });
}

function normalizeTireLevel(condition?: string): TireConditionLevel {
  const upper = String(condition || "GOOD").toUpperCase();
  if (upper === "REPLACE" || upper === "NEEDS_REPLACEMENT") return "REPLACE";
  if (upper === "WORN" || upper === "HALF_WORN") return "WORN";
  return "GOOD";
}
