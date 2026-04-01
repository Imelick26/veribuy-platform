/**
 * Phase 3: Targeted Re-scan + Phase 4: Score Synthesis
 *
 * Phase 3 examines findings for high-signal triggers and runs conditional
 * deep-dive re-scans. Phase 4 sends all exterior photos + full findings
 * to produce final condition scores.
 */

import type {
  VehicleInfo,
  MediaForAnalysis,
  DetectedFinding,
  ComparisonFinding,
  RescanTrigger,
  RescanResult,
  SynthesisResult,
  AffectsArea,
  SeverityLevel,
  PaintDamageLevel,
} from "../types";
import type { AreaConditionDetail, TireAssessment, TireConditionLevel } from "@/types/risk";
import { buildRescanPrompt } from "../prompts/rescan";
import { buildSynthesisPrompt } from "../prompts/synthesis";
import { callVision, validatePhotoUrls, processWithConcurrency, buildPhotoLabels } from "../utils";

// ---------------------------------------------------------------------------
//  Photo type groupings for re-scans
// ---------------------------------------------------------------------------

const EXTERIOR_TYPES = [
  "FRONT_CENTER", "FRONT_34_DRIVER", "FRONT_34_PASSENGER",
  "DRIVER_SIDE", "PASSENGER_SIDE", "REAR_34_DRIVER",
  "REAR_34_PASSENGER", "REAR_CENTER", "ROOF",
];

const RESCAN_PHOTO_MAP: Record<RescanTrigger, string[]> = {
  paint_mismatch: ["FRONT_34_DRIVER", "DRIVER_SIDE", "REAR_34_DRIVER", "FRONT_34_PASSENGER", "PASSENGER_SIDE", "REAR_34_PASSENGER"],
  panel_gaps: EXTERIOR_TYPES,
  rust_cluster: ["FRONT_34_DRIVER", "FRONT_34_PASSENGER", "REAR_34_DRIVER", "REAR_34_PASSENGER", "DRIVER_SIDE", "PASSENGER_SIDE", "UNDERCARRIAGE"],
  flood_indicators: ["DASHBOARD_DRIVER", "FRONT_SEATS", "REAR_SEATS", "ENGINE_BAY"],
  heavy_towing: ["UNDERCARRIAGE", "ENGINE_BAY", "REAR_CENTER"],
};

// ---------------------------------------------------------------------------
//  Phase 3: Triggered re-scans
// ---------------------------------------------------------------------------

export async function runPhase3(
  vehicle: VehicleInfo,
  media: MediaForAnalysis[],
  allFindings: DetectedFinding[],
  comparisonFindings: ComparisonFinding[],
): Promise<{ rescanFindings: DetectedFinding[]; rescanComparisonFindings: ComparisonFinding[]; apiCalls: number }> {
  const triggers = detectTriggers(allFindings, comparisonFindings);

  if (triggers.length === 0) {
    console.log("[phase3] No re-scan triggers detected");
    return { rescanFindings: [], rescanComparisonFindings: [], apiCalls: 0 };
  }

  console.log(`[phase3] Running ${triggers.length} targeted re-scans: ${triggers.map((t) => t.trigger).join(", ")}`);

  const results = await processWithConcurrency(
    triggers,
    (t) => runSingleRescan(vehicle, media, t.trigger, t.triggerFindings),
    3, // max 3 concurrent re-scans
  );

  const validResults = results.filter((r): r is RescanResult => r !== null);
  const rescanFindings = validResults.flatMap((r) => r.findings);
  const rescanComparisonFindings = validResults.flatMap((r) => r.comparisonFindings);
  const apiCalls = validResults.reduce((sum, r) => sum + r.apiCalls, 0);

  console.log(`[phase3] Complete: ${rescanFindings.length} additional findings from ${apiCalls} re-scan calls`);
  return { rescanFindings, rescanComparisonFindings, apiCalls };
}

// ---------------------------------------------------------------------------
//  Trigger detection
// ---------------------------------------------------------------------------

interface TriggerInfo {
  trigger: RescanTrigger;
  triggerFindings: (DetectedFinding | ComparisonFinding)[];
}

function detectTriggers(
  findings: DetectedFinding[],
  comparisonFindings: ComparisonFinding[],
): TriggerInfo[] {
  const triggers: TriggerInfo[] = [];

  // Paint mismatch — from comparison scans
  const paintIssues = comparisonFindings.filter((f) => f.type === "paint_mismatch" && f.confidence >= 0.5);
  if (paintIssues.length > 0) {
    triggers.push({ trigger: "paint_mismatch", triggerFindings: paintIssues });
  }

  // Panel gaps — from comparison scans
  const gapIssues = comparisonFindings.filter((f) => f.type === "panel_alignment" && f.confidence >= 0.5);
  if (gapIssues.length > 0) {
    triggers.push({ trigger: "panel_gaps", triggerFindings: gapIssues });
  }

  // Rust cluster — 2+ rust findings from phase 1
  const rustFindings = findings.filter((f) =>
    f.defectType.toLowerCase().includes("rust") || f.defectType.toLowerCase().includes("corrosion"),
  );
  if (rustFindings.length >= 2) {
    triggers.push({ trigger: "rust_cluster", triggerFindings: rustFindings });
  }

  // Flood indicators — from door jamb findings
  const floodIndicators = findings.filter((f) =>
    (f.captureType === "DOOR_JAMB" || f.captureType === "DOOR_JAMB_DRIVER") && (
      f.defectType.toLowerCase().includes("flood") ||
      f.defectType.toLowerCase().includes("water_line") ||
      f.defectType.toLowerCase().includes("mud_deposit") ||
      f.description.toLowerCase().includes("flood")
    ),
  );
  if (floodIndicators.length > 0) {
    triggers.push({ trigger: "flood_indicators", triggerFindings: floodIndicators });
  }

  // Heavy towing — from phase 1 hitch findings
  const towingFindings = findings.filter((f) =>
    f.defectType.toLowerCase().includes("towing") ||
    f.defectType.toLowerCase().includes("hitch") ||
    f.description.toLowerCase().includes("heavy towing"),
  );
  if (towingFindings.length > 0) {
    triggers.push({ trigger: "heavy_towing", triggerFindings: towingFindings });
  }

  return triggers;
}

// ---------------------------------------------------------------------------
//  Single re-scan execution
// ---------------------------------------------------------------------------

async function runSingleRescan(
  vehicle: VehicleInfo,
  media: MediaForAnalysis[],
  trigger: RescanTrigger,
  triggerFindings: (DetectedFinding | ComparisonFinding)[],
): Promise<RescanResult | null> {
  const photoTypes = RESCAN_PHOTO_MAP[trigger];
  const photos = photoTypes
    .map((t) => media.find((m) => m.captureType === t))
    .filter((m): m is MediaForAnalysis => !!m);

  const validPhotos = await validatePhotoUrls(photos, `phase3:${trigger}`);
  if (validPhotos.length === 0) return null;

  const prompt = buildRescanPrompt(vehicle, trigger, triggerFindings);

  const response = await callVision<RescanResponse>({
    model: "gpt-4o",
    systemPrompt: prompt.system,
    userText: `${prompt.user}\n\nPHOTOS PROVIDED (${validPhotos.length}):\n${buildPhotoLabels(validPhotos)}`,
    photos: validPhotos,
    temperature: 0.2,
    maxTokens: 1200,
    label: `phase3:${trigger}`,
  });

  if (!response) return { trigger, findings: [], comparisonFindings: [], apiCalls: 1 };

  const findings = normalizeRescanFindings(response.result, trigger);
  const comparisonFindings = normalizeRescanToComparison(response.result, trigger);

  return { trigger, findings, comparisonFindings, apiCalls: 1 };
}

// ---------------------------------------------------------------------------
//  Phase 4: Score Synthesis
// ---------------------------------------------------------------------------

export async function runPhase4(
  vehicle: VehicleInfo,
  media: MediaForAnalysis[],
  allFindings: DetectedFinding[],
  comparisonFindings: ComparisonFinding[],
  tireAssessment: TireAssessment | undefined,
  inspectorNotes?: string,
): Promise<{ synthesis: SynthesisResult; apiCalls: number }> {
  console.log(`[phase4] Running score synthesis with ${allFindings.length} findings + exterior photos`);

  // Get all exterior photos for visual verification
  const exteriorPhotos = EXTERIOR_TYPES
    .map((t) => media.find((m) => m.captureType === t))
    .filter((m): m is MediaForAnalysis => !!m);

  const validPhotos = await validatePhotoUrls(exteriorPhotos, "phase4:synthesis");
  const prompt = buildSynthesisPrompt(vehicle, allFindings, comparisonFindings, tireAssessment, inspectorNotes);

  const response = await callVision<SynthesisResponse>({
    model: "gpt-4o",
    systemPrompt: prompt.system,
    userText: `${prompt.user}\n\nEXTERIOR PHOTOS (${validPhotos.length}):\n${buildPhotoLabels(validPhotos)}`,
    photos: validPhotos,
    temperature: 0.2,
    maxTokens: 2500,
    label: "phase4:synthesis",
  });

  if (!response) {
    console.error("[phase4] Synthesis call failed, using fallback scores");
    return {
      synthesis: buildFallbackSynthesis(vehicle, allFindings, comparisonFindings, tireAssessment),
      apiCalls: 1,
    };
  }

  const synthesis = normalizeSynthesis(response.result, vehicle, allFindings, tireAssessment);
  console.log(`[phase4] Complete: scores ext=${synthesis.areaScores.exteriorBody.score} int=${synthesis.areaScores.interior.score} mech=${synthesis.areaScores.mechanicalVisual.score} under=${synthesis.areaScores.underbodyFrame.score}`);

  return { synthesis, apiCalls: 1 };
}

// ---------------------------------------------------------------------------
//  Response types
// ---------------------------------------------------------------------------

interface RescanResponse {
  confirmed?: boolean;
  findings?: RescanFindingResponse[];
  assessment?: string;
}

interface RescanFindingResponse {
  defectType?: string;
  location?: string;
  severity?: string;
  confidence?: number;
  description?: string;
  repairApproach?: string;
  repairCostLow?: number;
  repairCostHigh?: number;
}

interface SynthesisResponse {
  areaScores?: {
    exteriorBody?: AreaScoreResponse;
    interior?: AreaScoreResponse;
    mechanicalVisual?: AreaScoreResponse;
    underbodyFrame?: AreaScoreResponse;
  };
  additionalFindings?: RescanFindingResponse[];
  redFlags?: string[];
  overallSummary?: string;
}

interface AreaScoreResponse {
  score?: number;
  confidence?: number;
  keyObservations?: string[];
  concerns?: string[];
  summary?: string;
  scoreJustification?: string;
}

// ---------------------------------------------------------------------------
//  Normalization helpers
// ---------------------------------------------------------------------------

const VALID_SEVERITIES: SeverityLevel[] = ["minor", "moderate", "major", "critical"];
const TRIGGER_AREA: Record<RescanTrigger, AffectsArea> = {
  paint_mismatch: "exterior",
  panel_gaps: "exterior",
  rust_cluster: "exterior",
  flood_indicators: "interior",
  heavy_towing: "mechanical",
};

function normalizeRescanFindings(response: RescanResponse, trigger: RescanTrigger): DetectedFinding[] {
  if (!Array.isArray(response.findings)) return [];

  return response.findings
    .filter((f) => f.defectType && f.location && (typeof f.confidence !== "number" || f.confidence >= 0.4))
    .map((f) => {
      let costLow = Number(f.repairCostLow) || 0;
      let costHigh = Number(f.repairCostHigh) || 0;
      if (costLow > 0 && costLow < 500 && costHigh < 5000) { costLow *= 100; costHigh *= 100; }
      if (costHigh < costLow) costHigh = costLow;
      costLow = Math.max(1000, Math.min(5000000, costLow || 5000));
      costHigh = Math.max(costLow, Math.min(5000000, costHigh || 10000));

      return {
        defectType: String(f.defectType),
        location: String(f.location),
        severity: VALID_SEVERITIES.includes(f.severity as SeverityLevel) ? (f.severity as SeverityLevel) : "moderate",
        confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0.5)),
        repairApproach: String(f.repairApproach || "Repair required"),
        repairCostLow: costLow,
        repairCostHigh: costHigh,
        description: String(f.description || `${f.defectType} at ${f.location}`),
        photoId: "",
        captureType: `RESCAN_${trigger.toUpperCase()}`,
        affectsArea: TRIGGER_AREA[trigger],
      };
    });
}

function normalizeRescanToComparison(response: RescanResponse, trigger: RescanTrigger): ComparisonFinding[] {
  if (!response.confirmed || !response.assessment) return [];

  return [{
    title: `${trigger.replace(/_/g, " ")} confirmed by re-scan`,
    description: String(response.assessment),
    severity: "major",
    confidence: 0.8,
    type: trigger === "paint_mismatch" ? "paint_mismatch" : trigger === "panel_gaps" ? "panel_alignment" : "other",
    affectedAreas: [],
  }];
}

function normalizeSynthesis(
  response: SynthesisResponse,
  vehicle: VehicleInfo,
  allFindings: DetectedFinding[],
  tireAssessment: TireAssessment | undefined,
): SynthesisResult {
  const scores = response.areaScores || {};

  return {
    areaScores: {
      exteriorBody: normalizeAreaScore(scores.exteriorBody, "Exterior Body", allFindings, "exterior"),
      interior: normalizeAreaScore(scores.interior, "Interior", allFindings, "interior"),
      mechanicalVisual: normalizeAreaScore(scores.mechanicalVisual, "Mechanical / Visual", allFindings, "mechanical"),
      underbodyFrame: normalizeAreaScore(scores.underbodyFrame, "Underbody / Frame", allFindings, "underbody"),
    },
    tireAssessment: tireAssessment || {
      frontDriver: { condition: "GOOD", observations: [] },
      frontPassenger: { condition: "GOOD", observations: [] },
      rearDriver: { condition: "GOOD", observations: [] },
      rearPassenger: { condition: "GOOD", observations: [] },
      overallTireScore: 5,
      summary: "No tire data available",
    },
    crossFindings: [],
    redFlags: Array.isArray(response.redFlags) ? response.redFlags.map(String) : [],
    overallSummary: String(response.overallSummary || "Condition assessment completed."),
  };
}

function normalizeAreaScore(
  raw: AreaScoreResponse | undefined,
  areaName: string,
  findings: DetectedFinding[],
  area: string,
): AreaConditionDetail {
  if (!raw || typeof raw.score !== "number" || raw.score < 1 || raw.score > 10) {
    // Fallback from finding count
    const areaFindings = findings.filter((f) => f.affectsArea === area);
    const score = Math.max(1, Math.min(10, 10 - areaFindings.length));
    return {
      score,
      confidence: 0.3,
      keyObservations: [`${areaFindings.length} defects detected`],
      concerns: areaFindings.slice(0, 4).map((f) => `${f.defectType} at ${f.location}`),
      summary: `${areaName} scored from ${areaFindings.length} defects (synthesis failed).`,
      scoreJustification: "Fallback score.",
    };
  }

  return {
    score: Math.max(1, Math.min(10, Math.round(raw.score))),
    confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0.5)),
    keyObservations: Array.isArray(raw.keyObservations) ? raw.keyObservations.map(String) : [],
    concerns: Array.isArray(raw.concerns) ? raw.concerns.map(String) : [],
    summary: String(raw.summary || `${areaName} assessment completed.`),
    scoreJustification: raw.scoreJustification ? String(raw.scoreJustification) : undefined,
  };
}

function buildFallbackSynthesis(
  vehicle: VehicleInfo,
  findings: DetectedFinding[],
  comparisonFindings: ComparisonFinding[],
  tireAssessment: TireAssessment | undefined,
): SynthesisResult {
  const buildArea = (area: string, name: string): AreaConditionDetail => {
    const areaFindings = findings.filter((f) => f.affectsArea === area);
    const score = Math.max(1, Math.min(10, 10 - areaFindings.length));
    return {
      score,
      confidence: 0.3,
      keyObservations: [`${areaFindings.length} defects detected`],
      concerns: areaFindings.slice(0, 4).map((f) => `${f.defectType} at ${f.location}`),
      summary: `${name}: ${areaFindings.length} defects (fallback scoring).`,
      scoreJustification: "Emergency fallback.",
    };
  };

  return {
    areaScores: {
      exteriorBody: buildArea("exterior", "Exterior Body"),
      interior: buildArea("interior", "Interior"),
      mechanicalVisual: buildArea("mechanical", "Mechanical / Visual"),
      underbodyFrame: buildArea("underbody", "Underbody / Frame"),
    },
    tireAssessment: tireAssessment || {
      frontDriver: { condition: "GOOD", observations: [] },
      frontPassenger: { condition: "GOOD", observations: [] },
      rearDriver: { condition: "GOOD", observations: [] },
      rearPassenger: { condition: "GOOD", observations: [] },
      overallTireScore: 5,
      summary: "Fallback tire assessment",
    },
    crossFindings: comparisonFindings,
    redFlags: [],
    overallSummary: `Condition assessment for ${vehicle.year} ${vehicle.make} ${vehicle.model} (fallback scoring — ${findings.length} defects found).`,
  };
}
