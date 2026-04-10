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
import { getPhotoChecklist, buildPhase1SystemPrompt, buildTireSystemPrompt } from "../prompts/detection";
import { callVision, validatePhotoUrls, processWithConcurrency, buildPhotoLabels } from "../utils";

// 3 concurrent keeps us under the 30K TPM rate limit for gpt-4o
// Each vision call uses ~2-3K tokens; 3 concurrent = ~9K TPM headroom
const MAX_CONCURRENT = 3;

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

/** Capture types that should get zone-cropped analysis */
const TIRE_CAPTURE_TYPES = new Set([
  "TIRE_FRONT_DRIVER", "TIRE_REAR_DRIVER",
  "TIRE_FRONT_PASSENGER", "TIRE_REAR_PASSENGER",
]);

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

  // Tire photos use a dedicated system prompt that forces per-zone tread analysis
  const isTire = TIRE_CAPTURE_TYPES.has(photo.captureType);
  const activeSystemPrompt = isTire
    ? buildTireSystemPrompt(vehicle, mileageStr)
    : systemPrompt;

  const userPrompt = `Inspect this photo using the checklist below. For each defect found, provide full quantification (dimensions, repair approach, cost estimate).\n\nPHOTO: ${photoLabel}\n\n${checklist}`;

  const response = await callVision<Phase1Response>({
    model: "gpt-4o",
    systemPrompt: activeSystemPrompt,
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
      areaCondition: "good",
      notes: "",
      error: "API call failed",
    };
  }

  // Determine which area this photo affects
  let defaultArea = CAPTURE_TYPE_AREA[photo.captureType] || "exterior";
  if (photo.captureType === "CARGO_AREA" && !isTruck) {
    defaultArea = "interior";
  }

  let findings = normalizeFindings(response.result, photo, defaultArea);

  // ── Tire second opinion: challenge any non-REPLACE tire verdict ──
  if (isTire && response.result.treadAnalysis) {
    const ta = response.result.treadAnalysis as TreadAnalysisResponse;
    const overall = String(ta.overall || "").toUpperCase();

    // If the first read says GOOD or WORN, get a second opinion
    if (overall !== "REPLACE") {
      const secondOpinion = await getTireSecondOpinion(
        vehicle, mileageStr, validPhotos, ta, photo.captureType,
      );
      if (secondOpinion) {
        // Second opinion disagrees — upgrade the findings
        console.log(`[phase1:tire] Second opinion upgraded ${photo.captureType}: ${overall} → ${secondOpinion.overall}`);
        findings = mergeSecondOpinionFindings(findings, secondOpinion, photo, defaultArea);
      }
    }
  }

  return {
    captureType: photo.captureType,
    photoId: photo.id,
    findings,
    areaCondition: normalizeAreaCondition(response.result.areaCondition),
    notes: String(response.result.notes || ""),
  };
}

// ---------------------------------------------------------------------------
//  Tire second opinion
// ---------------------------------------------------------------------------

interface TreadAnalysisResponse {
  innerEdge?: { rating?: string; grooveDepth?: string; notes?: string };
  center?: { rating?: string; grooveDepth?: string; notes?: string };
  outerEdge?: { rating?: string; grooveDepth?: string; notes?: string };
  overall?: string;
}

interface SecondOpinionResult {
  overall: string;
  centerVerdict: string;
  reasoning: string;
  shouldUpgrade: boolean;
}

/**
 * Sends the same tire photo to GPT-4o with a challenge prompt:
 * "The first analysis said X — look specifically at center vs edge
 * groove depth. Is this correct or should it be worse?"
 *
 * Only called when first read is GOOD or WORN — we don't second-guess REPLACE.
 */
async function getTireSecondOpinion(
  vehicle: VehicleInfo,
  mileageStr: string,
  photos: MediaForAnalysis[],
  firstRead: TreadAnalysisResponse,
  captureType: string,
): Promise<SecondOpinionResult | null> {
  const centerNotes = firstRead.center?.notes || "no details";
  const centerDepth = firstRead.center?.grooveDepth || "unknown";
  const firstOverall = firstRead.overall || "WORN";

  const systemPrompt = `You are a tire safety auditor reviewing a previous inspection of a ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Your job: challenge the initial assessment. The first read said "${firstOverall}" — your job is to look for reasons this should be WORSE, not to confirm it.

RESPOND WITH EXACTLY THIS JSON:
{
  "centerGrooveDepth": "deep|shallow|flush|bald",
  "centerVsEdgeRatio": "describe how center compares to edge groove depth",
  "overallTreadAssessment": "describe the overall tread condition — is there significant rubber remaining or does the tire look worn down?",
  "shouldUpgrade": true/false,
  "upgradeTo": "WORN|REPLACE",
  "reasoning": "1-2 sentences explaining your verdict"
}

RULES:
- Look at the ENTIRE tread surface. Does this tire look like it has significant life left, or does it look worn down?
- A tire with deep, clearly visible grooves that cast shadows = GOOD. If you can't clearly see deep grooves, it's at least WORN.
- A tire that looks smooth, flat, or "low on tread" across ANY zone = REPLACE.
- Compare the CENTER zone groove depth to the EDGE zone groove depth.
- If center grooves are less than HALF the depth of the edge grooves → centerGrooveDepth = "flush" → shouldUpgrade to REPLACE.
- If ANY zone's surface appears flat or smooth while other zones have deep channels → that zone is "flush" regardless of tire type.
- "flush" = tread blocks nearly level with groove floor. Surface appears smooth or flat compared to deeper zones.
- IMPORTANT: On high-mileage vehicles, the most common error is rating worn tires as GOOD. When in doubt, upgrade severity.
- If you agree with the initial "${firstOverall}" rating AND the tire genuinely looks like it has plenty of tread remaining, set shouldUpgrade = false.`;

  const userPrompt = `INITIAL ASSESSMENT said this tire is "${firstOverall}" with center tread "${centerDepth}" — "${centerNotes}".

Look at this tire photo again. Focus ONLY on the center tread strip:
1. How deep are the CENTER grooves compared to the OUTER EDGE grooves?
2. Could the center be closer to "flush" than "${centerDepth}"?
3. Is "${firstOverall}" the right call, or should this be worse?`;

  const response = await callVision<{
    centerGrooveDepth?: string;
    centerVsEdgeRatio?: string;
    shouldUpgrade?: boolean;
    upgradeTo?: string;
    reasoning?: string;
  }>({
    model: "gpt-4o",
    systemPrompt,
    userText: userPrompt,
    photos,
    temperature: 0.3, // Slightly higher temp for independent judgment
    maxTokens: 400,
    label: `phase1:tire-second-opinion:${captureType}`,
  });

  if (!response) return null;

  const r = response.result;
  if (!r.shouldUpgrade) {
    console.log(`[phase1:tire] Second opinion agrees with ${firstOverall}: ${r.reasoning}`);
    return null;
  }

  return {
    overall: String(r.upgradeTo || "REPLACE"),
    centerVerdict: String(r.centerGrooveDepth || "flush"),
    reasoning: String(r.reasoning || "Second opinion upgraded tire rating"),
    shouldUpgrade: true,
  };
}

/**
 * Merges second opinion findings: if the upgrade says REPLACE, ensure
 * there's a finding with severity "major" instead of "moderate".
 */
function mergeSecondOpinionFindings(
  existing: DetectedFinding[],
  secondOpinion: SecondOpinionResult,
  photo: MediaForAnalysis,
  defaultArea: AffectsArea,
): DetectedFinding[] {
  // Upgrade any existing tire wear findings to major
  const upgraded = existing.map((f) => {
    if (f.defectType.includes("wear") || f.defectType.includes("bald") || f.defectType.includes("tread")) {
      return {
        ...f,
        severity: "major" as const,
        description: `${f.description} [Second opinion: center tread is ${secondOpinion.centerVerdict}. ${secondOpinion.reasoning}]`,
      };
    }
    return f;
  });

  // If no existing tread finding, add one
  const hasTreadFinding = upgraded.some((f) =>
    f.defectType.includes("wear") || f.defectType.includes("bald") || f.defectType.includes("tread"),
  );

  if (!hasTreadFinding) {
    upgraded.push({
      defectType: "center_bald",
      location: "center tread strip",
      severity: "major",
      confidence: 0.85,
      repairApproach: "replace tire",
      repairCostLow: 15000,
      repairCostHigh: 35000,
      description: `Center tread is ${secondOpinion.centerVerdict} — needs replacement. ${secondOpinion.reasoning}`,
      photoId: photo.id,
      captureType: photo.captureType,
      affectsArea: defaultArea,
    });
  }

  return upgraded;
}

// ---------------------------------------------------------------------------
//  Response types and normalization
// ---------------------------------------------------------------------------

interface Phase1Response {
  findings?: Phase1FindingResponse[];
  treadAnalysis?: TreadAnalysisResponse;
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
