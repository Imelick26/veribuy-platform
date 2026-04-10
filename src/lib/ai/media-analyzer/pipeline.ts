/**
 * Pipeline Orchestrator v2
 *
 * 4-phase serial pipeline:
 *   Phase 1: Focused per-photo inspection (detect + quantify in one call)
 *   Phase 2: Multi-photo comparison scans (paint, alignment, tires, interior, wear)
 *   Phase 3: Targeted re-scans (conditional, based on high-signal findings)
 *   Phase 4: Score synthesis (all exterior photos + full findings → final scores)
 *
 * Memoized per media set so concurrent calls from Promise.all share one execution.
 */

import type {
  VehicleInfo,
  MediaForAnalysis,
  PipelineResult,
  PipelineMetadata,
  DetectedFinding,
  ComparisonFinding,
} from "./types";
import type { UnexpectedFinding } from "@/types/risk";
import { runPhase1 } from "./passes/pass1-detection";
import { runPhase2 } from "./passes/pass2-quantification";
import { runPhase3, runPhase4 } from "./passes/pass3-correlation";

// ---------------------------------------------------------------------------
//  Memoization cache
// ---------------------------------------------------------------------------

const pipelineCache = new Map<string, Promise<PipelineResult>>();

function buildCacheKey(media: MediaForAnalysis[]): string {
  return media.map((m) => m.id).sort().join(",");
}

export function clearPipelineCache(): void {
  pipelineCache.clear();
}

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

export async function runPipeline(
  vehicle: VehicleInfo,
  media: MediaForAnalysis[],
  inspectorNotes?: string,
): Promise<PipelineResult> {
  const cacheKey = buildCacheKey(media);
  const cached = pipelineCache.get(cacheKey);
  if (cached) {
    console.log("[pipeline] Returning cached pipeline result");
    return cached;
  }

  const promise = executePipeline(vehicle, media, inspectorNotes);
  pipelineCache.set(cacheKey, promise);

  try {
    return await promise;
  } catch (err) {
    pipelineCache.delete(cacheKey);
    throw err;
  }
}

// ---------------------------------------------------------------------------
//  Truck detection
// ---------------------------------------------------------------------------

const TRUCK_BODY_STYLES = [
  "pickup", "truck", "crew cab", "regular cab", "extended cab",
  "double cab", "quad cab", "king cab", "super cab", "mega cab",
];

const KNOWN_TRUCKS = [
  "f-150", "f-250", "f-350", "f150", "f250", "f350",
  "silverado", "sierra", "ram 1500", "ram 2500", "ram 3500",
  "tundra", "tacoma", "titan", "frontier", "ranger", "colorado",
  "canyon", "gladiator", "ridgeline", "maverick", "santa cruz",
];

function isTruck(vehicle: VehicleInfo): boolean {
  const style = (vehicle.bodyStyle || "").toLowerCase();
  if (TRUCK_BODY_STYLES.some((t) => style.includes(t))) return true;
  const model = `${vehicle.make} ${vehicle.model}`.toLowerCase();
  return KNOWN_TRUCKS.some((t) => model.includes(t));
}

// ---------------------------------------------------------------------------
//  Pipeline execution
// ---------------------------------------------------------------------------

async function executePipeline(
  vehicle: VehicleInfo,
  media: MediaForAnalysis[],
  inspectorNotes?: string,
): Promise<PipelineResult> {
  const startTime = Date.now();
  const vehicleIsTruck = isTruck(vehicle);
  console.log(`[pipeline] Starting 4-phase analysis for ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicleIsTruck ? "truck" : "non-truck"}) with ${media.length} photos`);

  // ── Phase 1: Focused per-photo inspection ──
  const phase1 = await runPhase1(vehicle, media, vehicleIsTruck);

  // ── Phase 2: Multi-photo comparison scans ──
  const phase2 = await runPhase2(vehicle, media);

  // ── Phase 3: Targeted re-scans (conditional) ──
  const allComparisonFindings: ComparisonFinding[] = [
    ...phase2.paintFindings,
    ...phase2.alignmentFindings,
    ...phase2.tireResult.findings,
    ...phase2.interiorFindings,
    ...phase2.wearFindings,
  ];

  const phase3 = await runPhase3(vehicle, media, phase1.findings, allComparisonFindings);

  // Merge all findings
  const allFindings: DetectedFinding[] = [...phase1.findings, ...phase3.rescanFindings];
  const allComparisons: ComparisonFinding[] = [...allComparisonFindings, ...phase3.rescanComparisonFindings];

  // ── Phase 4: Score synthesis with exterior photos ──
  const phase4 = await runPhase4(
    vehicle,
    media,
    allFindings,
    allComparisons,
    phase2.tireResult.tireAssessment,
    inspectorNotes,
  );

  // Merge Phase 4 additional findings (things the synthesis caught that Phase 1 missed)
  const synthesisAdditionalFindings: DetectedFinding[] = []; // Phase 4 additionalFindings handled in normalization

  // ── Build legacy-compatible unexpected findings ──
  const unexpectedFindings = buildUnexpectedFindings(allFindings, allComparisons, media);

  // ── Metadata ──
  const durationMs = Date.now() - startTime;
  const metadata: PipelineMetadata = {
    totalApiCalls: phase1.apiCalls + phase2.apiCalls + phase3.apiCalls + phase4.apiCalls,
    phase1Calls: phase1.apiCalls,
    phase2Calls: phase2.apiCalls,
    phase3Calls: phase3.apiCalls,
    phase4Calls: phase4.apiCalls,
    totalFindings: allFindings.length,
    comparisonFindings: allComparisons.length,
    rescanFindings: phase3.rescanFindings.length,
    durationMs,
  };

  console.log(
    `[pipeline] Complete: ${metadata.totalFindings} findings + ${metadata.comparisonFindings} comparisons, ` +
    `${metadata.totalApiCalls} API calls, ${(durationMs / 1000).toFixed(1)}s`,
  );

  // Use tire assessment from Phase 2, or build from Phase 1 per-tire data as fallback
  let tireAssessment = phase2.tireResult.tireAssessment;
  if (!tireAssessment) {
    // Phase 2 tire comparison failed (rate limit, URL issue, etc.)
    // Build assessment from Phase 1 per-tire callResults using areaCondition
    const tireMap: Record<string, { condition: "GOOD" | "WORN" | "REPLACE"; observations: string[] }> = {};
    for (const result of phase1.callResults) {
      if (result.captureType.startsWith("TIRE_")) {
        // Map areaCondition to tire condition level
        const ac = result.areaCondition;
        const condition: "GOOD" | "WORN" | "REPLACE" = ac === "damaged" ? "REPLACE" : ac === "worn" ? "WORN" : "GOOD";
        // Check findings for more specific info (e.g., second opinion upgrades)
        const hasReplaceFinding = result.findings.some((f) =>
          f.defectType.toLowerCase().includes("replace") || f.severity === "major" || f.severity === "critical"
        );
        const finalCondition: "GOOD" | "WORN" | "REPLACE" = hasReplaceFinding ? "REPLACE" : condition;
        tireMap[result.captureType] = {
          condition: finalCondition,
          observations: result.notes && !result.error ? [result.notes] : [],
        };
      }
    }
    if (Object.keys(tireMap).length > 0) {
      const get = (key: string): { condition: "GOOD" | "WORN" | "REPLACE"; observations: string[] } => tireMap[key] || { condition: "GOOD" as const, observations: [] };
      const conditions = Object.values(tireMap).map((t) => t.condition);
      const replaceCount = conditions.filter((c) => c === "REPLACE").length;
      const wornCount = conditions.filter((c) => c === "WORN").length;
      const score = replaceCount > 0 ? Math.max(1, 10 - replaceCount * 2) : wornCount > 0 ? Math.max(4, 10 - wornCount) : 9;

      tireAssessment = {
        frontDriver: get("TIRE_FRONT_DRIVER"),
        frontPassenger: get("TIRE_FRONT_PASSENGER"),
        rearDriver: get("TIRE_REAR_DRIVER"),
        rearPassenger: get("TIRE_REAR_PASSENGER"),
        overallTireScore: score,
        summary: replaceCount > 0
          ? `${replaceCount} tire(s) need replacement.`
          : wornCount > 0
            ? `${wornCount} tire(s) showing moderate wear.`
            : "All tires in good condition.",
      };
      console.log(`[pipeline] Built tire assessment from Phase 1: ${conditions.join(", ")}`);
    }
  }

  const finalSynthesis = {
    ...phase4.synthesis,
    tireAssessment: tireAssessment ?? undefined,
    crossFindings: allComparisons,
  };

  return {
    findings: allFindings,
    comparisonFindings: allComparisons,
    rescanFindings: phase3.rescanFindings,
    synthesis: finalSynthesis,
    unexpectedFindings,
    metadata,
  };
}

// ---------------------------------------------------------------------------
//  Convert findings to legacy UnexpectedFinding format
// ---------------------------------------------------------------------------

function buildUnexpectedFindings(
  findings: DetectedFinding[],
  comparisonFindings: ComparisonFinding[],
  media: MediaForAnalysis[],
): UnexpectedFinding[] {
  const severityMap: Record<string, UnexpectedFinding["severity"]> = {
    minor: "MINOR", moderate: "MODERATE", major: "MAJOR", critical: "CRITICAL",
  };

  const categoryMap: Record<string, string> = {
    exterior: "COSMETIC_EXTERIOR",
    interior: "COSMETIC_INTERIOR",
    mechanical: "ENGINE",
    underbody: "STRUCTURAL",
  };

  // Category mapping for comparison findings (instead of blanket "OTHER")
  const comparisonCategoryMap: Record<string, string> = {
    paint_mismatch: "COSMETIC_EXTERIOR",
    panel_alignment: "COSMETIC_EXTERIOR",
    interior_consistency: "COSMETIC_INTERIOR",
    // tire_inconsistency, wear_inconsistency, mileage_discrepancy, other → default "OTHER"
  };

  // Exclude tire photo findings — tires have their own dedicated assessment path
  // (Phase 2 tire comparison + auto-created tire finding in runConditionScan)
  const TIRE_CAPTURE_TYPES = new Set([
    "TIRE_FRONT_DRIVER", "TIRE_REAR_DRIVER",
    "TIRE_FRONT_PASSENGER", "TIRE_REAR_PASSENGER",
  ]);

  const nonTireFindings = findings.filter((f) => !TIRE_CAPTURE_TYPES.has(f.captureType));

  const fromFindings: UnexpectedFinding[] = nonTireFindings.map((f) => ({
    title: `${f.defectType.replace(/_/g, " ")} — ${f.location}`,
    description: f.description,
    severity: severityMap[f.severity] || "MINOR",
    category: categoryMap[f.affectsArea] || "OTHER",
    photoIndex: media.findIndex((m) => m.id === f.photoId),
    confidence: f.confidence,
  }));

  // Filter comparison findings: minimum 0.5 confidence, exclude tire comparisons
  const filteredComparisons = comparisonFindings.filter(
    (f) => f.confidence >= 0.5 && f.type !== "tire_inconsistency",
  );

  // Map comparison finding types to the most relevant source photo
  const comparisonPhotoMap: Record<string, string[]> = {
    paint_mismatch: ["FRONT_CENTER", "FRONT_34_DRIVER", "DRIVER_SIDE"],
    interior_consistency: ["FRONT_SEATS", "DASHBOARD_DRIVER", "REAR_SEATS"],
    wear_inconsistency: ["DASHBOARD_DRIVER", "FRONT_SEATS", "ENGINE_BAY"],
    mileage_discrepancy: ["ODOMETER", "DASHBOARD_DRIVER"],
    other: ["FRONT_CENTER"],
  };

  const fromComparisons: UnexpectedFinding[] = filteredComparisons.map((f) => {
    // Find the best matching photo for this comparison finding
    const preferredTypes = comparisonPhotoMap[f.type] || ["FRONT_CENTER"];
    let bestPhotoIndex = -1;
    for (const captureType of preferredTypes) {
      const idx = media.findIndex((m) => m.captureType === captureType);
      if (idx >= 0) { bestPhotoIndex = idx; break; }
    }

    return {
      title: f.title,
      description: f.description,
      severity: severityMap[f.severity] || "MINOR",
      category: comparisonCategoryMap[f.type] || "OTHER",
      photoIndex: bestPhotoIndex,
      confidence: f.confidence,
    };
  });

  // Deduplicate: Phase 1 and Phase 2/3 often detect the same issue with different titles.
  // e.g. "gap misalignment — hood, fender" (Phase 1) vs "Hood-to-Fender Gap Asymmetry" (Phase 2)
  return deduplicateFindings([...fromFindings, ...fromComparisons]);
}

/**
 * Fuzzy dedup: normalize titles, group by similarity, keep highest-confidence per group.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*—\s*.+$/, "")   // strip " — location" suffix from Phase 1 findings
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titlesOverlap(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return true;
  // Check if one title's core is contained in the other
  // "hood to fender gap asymmetry" contains "gap" which is too broad —
  // require at least 2 shared significant words (3+ chars each)
  const wordsA = na.split(" ").filter((w) => w.length >= 3);
  const wordsB = nb.split(" ").filter((w) => w.length >= 3);
  const shared = wordsA.filter((w) => wordsB.includes(w));
  return shared.length >= 2;
}

function deduplicateFindings(findings: UnexpectedFinding[]): UnexpectedFinding[] {
  const kept: UnexpectedFinding[] = [];
  const used = new Set<number>();

  for (let i = 0; i < findings.length; i++) {
    if (used.has(i)) continue;

    let best = findings[i];
    // Check remaining findings for overlapping titles
    for (let j = i + 1; j < findings.length; j++) {
      if (used.has(j)) continue;
      if (titlesOverlap(best.title, findings[j].title)) {
        used.add(j);
        // Keep the one with higher confidence
        if (findings[j].confidence > best.confidence) {
          best = findings[j];
        }
      }
    }
    kept.push(best);
  }

  if (kept.length < findings.length) {
    console.log(`[pipeline] Dedup: ${findings.length} → ${kept.length} findings (removed ${findings.length - kept.length} duplicates)`);
  }

  return kept;
}
