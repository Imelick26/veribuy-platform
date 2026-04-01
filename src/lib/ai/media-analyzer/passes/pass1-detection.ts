/**
 * Phase 1: Focused Inspection
 *
 * Each photo gets ONE dedicated GPT-4o call with an angle-specific checklist.
 * Each call returns findings WITH full quantification — no separate pass needed.
 * Up to 6 concurrent calls.
 */

import type {
  VehicleInfo,
  MediaForAnalysis,
  DetectedFinding,
  InspectionCallResult,
  AffectsArea,
  PaintDamageLevel,
  SeverityLevel,
} from "../types";
import { getPhotoChecklist, buildPhase1SystemPrompt } from "../prompts/detection";
import { callVision, validatePhotoUrls, processWithConcurrency, buildPhotoLabels } from "../utils";

const MAX_CONCURRENT = 6;

/** Capture types to skip (handled separately) */
const SKIP_TYPES = new Set(["ODOMETER"]);

// ---------------------------------------------------------------------------
//  Photo-to-area mapping
// ---------------------------------------------------------------------------

const CAPTURE_TYPE_AREA: Record<string, AffectsArea> = {
  FRONT_CENTER: "exterior",
  FRONT_34_DRIVER: "exterior",
  FRONT_34_PASSENGER: "exterior",
  DRIVER_SIDE: "exterior",
  PASSENGER_SIDE: "exterior",
  REAR_34_DRIVER: "exterior",
  REAR_34_PASSENGER: "exterior",
  REAR_CENTER: "exterior",
  ROOF: "exterior",
  ENGINE_BAY: "mechanical",
  DOOR_JAMB: "exterior",
  DOOR_JAMB_DRIVER: "exterior",
  UNDERCARRIAGE: "underbody",
  TIRE_FRONT_DRIVER: "mechanical",
  TIRE_REAR_DRIVER: "mechanical",
  TIRE_FRONT_PASSENGER: "mechanical",
  TIRE_REAR_PASSENGER: "mechanical",
  DASHBOARD_DRIVER: "interior",
  FRONT_SEATS: "interior",
  REAR_SEATS: "interior",
  CARGO_AREA: "exterior", // truck bed = exterior, cargo area = interior — overridden below
};

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

export async function runPhase1(
  vehicle: VehicleInfo,
  media: MediaForAnalysis[],
  isTruck: boolean,
): Promise<{ findings: DetectedFinding[]; callResults: InspectionCallResult[]; apiCalls: number }> {
  const mileageStr = vehicle.mileage
    ? `${vehicle.mileage.toLocaleString()} miles`
    : "unknown mileage";

  const systemPrompt = buildPhase1SystemPrompt(vehicle, mileageStr);

  // Filter to photos we should analyze
  const photosToAnalyze = media.filter((m) => !SKIP_TYPES.has(m.captureType));

  if (photosToAnalyze.length === 0) {
    console.warn("[phase1] No photos to analyze");
    return { findings: [], callResults: [], apiCalls: 0 };
  }

  console.log(`[phase1] Running focused inspection: ${photosToAnalyze.length} photos, ${MAX_CONCURRENT} concurrent`);

  const results = await processWithConcurrency(
    photosToAnalyze,
    (photo) => inspectSinglePhoto(vehicle, photo, isTruck, mileageStr, systemPrompt),
    MAX_CONCURRENT,
  );

  const validResults = results.filter((r): r is InspectionCallResult => r !== null);
  const allFindings = validResults.flatMap((r) => r.findings);
  const apiCalls = validResults.length;

  console.log(`[phase1] Complete: ${allFindings.length} findings from ${apiCalls} photos`);
  return { findings: allFindings, callResults: validResults, apiCalls };
}

// ---------------------------------------------------------------------------
//  Single photo inspection
// ---------------------------------------------------------------------------

async function inspectSinglePhoto(
  vehicle: VehicleInfo,
  photo: MediaForAnalysis,
  isTruck: boolean,
  mileageStr: string,
  systemPrompt: string,
): Promise<InspectionCallResult | null> {
  // Validate URL
  const validPhotos = await validatePhotoUrls([photo], `phase1:${photo.captureType}`);
  if (validPhotos.length === 0) return null;

  // Get the angle-specific checklist for this photo
  const checklist = getPhotoChecklist(photo.captureType, vehicle, isTruck);
  const photoLabel = buildPhotoLabels(validPhotos);

  const userPrompt = `Inspect this photo using the checklist below. For each defect found, provide full quantification (dimensions, repair approach, cost estimate).\n\nPHOTO: ${photoLabel}\n\n${checklist}`;

  const response = await callVision<Phase1Response>({
    model: "gpt-4o",
    systemPrompt,
    userText: userPrompt,
    photos: validPhotos,
    temperature: 0.2,
    maxTokens: 1500,
    label: `phase1:${photo.captureType}`,
  });

  if (!response) {
    return {
      captureType: photo.captureType,
      photoId: photo.id,
      findings: [],
      areaCondition: "fair",
      notes: "API call failed",
      error: "API call failed",
    };
  }

  // Determine which area this photo affects
  let defaultArea = CAPTURE_TYPE_AREA[photo.captureType] || "exterior";
  if (photo.captureType === "CARGO_AREA" && !isTruck) {
    defaultArea = "interior";
  }

  const findings = normalizeFindings(response.result, photo, defaultArea);

  return {
    captureType: photo.captureType,
    photoId: photo.id,
    findings,
    areaCondition: normalizeAreaCondition(response.result.areaCondition),
    notes: String(response.result.notes || ""),
  };
}

// ---------------------------------------------------------------------------
//  Response types and normalization
// ---------------------------------------------------------------------------

interface Phase1Response {
  findings?: Phase1FindingResponse[];
  areaCondition?: string;
  notes?: string;
}

interface Phase1FindingResponse {
  defectType?: string;
  location?: string;
  severity?: string;
  confidence?: number;
  dimensions?: string;
  paintDamage?: string;
  repairApproach?: string;
  repairCostLow?: number;
  repairCostHigh?: number;
  description?: string;
}

const VALID_SEVERITIES: SeverityLevel[] = ["minor", "moderate", "major", "critical"];
const VALID_PAINT_DAMAGE: PaintDamageLevel[] = ["none", "clear_coat", "base_coat", "bare_metal"];
const VALID_AREA_CONDITIONS = ["good", "fair", "worn", "damaged"] as const;

function normalizeFindings(
  response: Phase1Response,
  photo: MediaForAnalysis,
  defaultArea: AffectsArea,
): DetectedFinding[] {
  if (!Array.isArray(response.findings)) return [];

  return response.findings
    .filter((f) => {
      if (!f.defectType || !f.location) return false;
      if (typeof f.confidence !== "number" || f.confidence < 0.4) return false;
      return true;
    })
    .map((f) => {
      // Normalize severity
      const severity = VALID_SEVERITIES.includes(f.severity as SeverityLevel)
        ? (f.severity as SeverityLevel)
        : "minor";

      // Normalize paint damage
      const paintDamage = VALID_PAINT_DAMAGE.includes(f.paintDamage as PaintDamageLevel)
        ? (f.paintDamage as PaintDamageLevel)
        : undefined;

      // Normalize costs
      let costLow = Number(f.repairCostLow) || 0;
      let costHigh = Number(f.repairCostHigh) || 0;
      // Detect dollars vs cents
      if (costLow > 0 && costLow < 500 && costHigh < 5000) {
        costLow *= 100;
        costHigh *= 100;
      }
      if (costHigh < costLow) costHigh = costLow;
      costLow = Math.max(1000, Math.min(5000000, costLow));
      costHigh = Math.max(costLow, Math.min(5000000, costHigh));

      return {
        defectType: String(f.defectType),
        location: String(f.location),
        severity,
        confidence: Math.max(0, Math.min(1, Number(f.confidence))),
        dimensions: f.dimensions ? String(f.dimensions) : undefined,
        paintDamage,
        repairApproach: String(f.repairApproach || "Repair required"),
        repairCostLow: costLow,
        repairCostHigh: costHigh,
        description: String(f.description || `${f.defectType} at ${f.location}`),
        photoId: photo.id,
        captureType: photo.captureType,
        affectsArea: defaultArea,
      };
    });
}

function normalizeAreaCondition(raw?: string): InspectionCallResult["areaCondition"] {
  const lower = String(raw || "fair").toLowerCase();
  if (VALID_AREA_CONDITIONS.includes(lower as typeof VALID_AREA_CONDITIONS[number])) {
    return lower as InspectionCallResult["areaCondition"];
  }
  return "fair";
}
