/**
 * AI-driven condition score persistence.
 *
 * Condition is now assessed independently via GPT-4o Vision photo analysis
 * (4 area scores 1-10 → weighted 0-100 overall). Findings/repair costs are
 * a SEPARATE input to the final market price — they no longer affect the
 * condition score.
 *
 * Fair Price = Market Baseline × Condition Multiplier × History Multiplier − Repair Costs
 */
import { db } from "@/server/db";
import type { ConditionAssessment } from "@/types/risk";
import type { ConditionWeights } from "@/lib/ai/condition-weighter";

/**
 * Persist AI-driven condition scores to the Inspection record.
 * Called after `analyzeVehicleCondition()` completes.
 */
export async function persistConditionScores(
  prisma: typeof db,
  inspectionId: string,
  assessment: ConditionAssessment
) {
  return prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      overallScore: assessment.overallScore,
      // Legacy 4-area scores
      exteriorBodyScore: assessment.exteriorBodyScore,
      interiorScore: assessment.interiorScore,
      mechanicalVisualScore: assessment.mechanicalVisualScore,
      underbodyFrameScore: assessment.underbodyFrameScore,
      // 9-bucket scores
      paintBodyScore: assessment.paintBodyScore,
      panelAlignmentScore: assessment.panelAlignmentScore,
      glassLightingScore: assessment.glassLightingScore,
      interiorSurfacesScore: assessment.interiorSurfacesScore,
      interiorControlsScore: assessment.interiorControlsScore,
      engineBayScore: assessment.engineBayScore,
      tiresWheelsScore: assessment.tiresWheelsScore,
      exhaustScore: assessment.exhaustScore,
      conditionSummary: assessment.summary,
      conditionRawData: JSON.parse(JSON.stringify(assessment)),
    },
  });
}

// 9-bucket default weights (sum = 100) matching compat.ts
const AREA_WEIGHTS = {
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
const WEIGHT_SUM = Object.values(AREA_WEIGHTS).reduce((a, b) => a + b, 0);

// Map finding categories to the 9-bucket area they affect.
// TIRES_WHEELS is excluded — tires have their own dedicated assessment.
const CATEGORY_TO_AREA: Record<string, keyof typeof AREA_WEIGHTS> = {
  // Exterior — paint & body
  COSMETIC_EXTERIOR: "paintBody",
  BODY: "paintBody",
  // Interior — surfaces
  COSMETIC_INTERIOR: "interiorSurfaces",
  INTERIOR: "interiorSurfaces",
  // Interior — controls / electronics
  ELECTRONICS: "interiorControls",
  HVAC: "interiorControls",
  // Engine bay (includes drivetrain & safety-critical)
  ENGINE: "engineBay",
  TRANSMISSION: "engineBay",
  DRIVETRAIN: "engineBay",
  ELECTRICAL: "engineBay",
  BRAKES: "engineBay",
  SAFETY: "engineBay",
  // Underbody / structural
  STRUCTURAL: "underbodyFrame",
  UNDERCARRIAGE: "underbodyFrame",
  FRAME: "underbodyFrame",
  SUSPENSION: "underbodyFrame",
  // TIRES_WHEELS: intentionally omitted — scored separately
  // OTHER: intentionally omitted — defaults to "paintBody" in recalculation
};

export interface PreliminaryFinding {
  index: number;
  title: string;
  description: string;
  severity: string;
  category: string;
  confidence: number;
  photoIndex: number;
  photoId: string | null;
}

export interface FindingReview {
  verified: boolean;
  notes?: string;
  mediaId?: string;
  reviewedAt: string;
}

/**
 * Recalculate condition scores after inspector verification.
 *
 * Two recovery mechanisms:
 * 1. Per-finding recovery: dismissed findings bump their area score proportionally
 * 2. Area-level recovery: if an area has few/no confirmed findings but a low AI score,
 *    blend toward a "clean" baseline (8/10) proportional to the dismissal rate.
 *    The AI scores areas holistically from photos — not just from discrete findings —
 *    so a low score may be driven by observations the inspector just dismissed.
 */
export function recalculateScores(
  originalAssessment: ConditionAssessment,
  preliminaryFindings: PreliminaryFinding[],
  reviews: Record<string, FindingReview>,
  weights?: ConditionWeights,
): ConditionAssessment {
  // Start with the original AI 9-bucket area scores (1-10)
  const areaScores: Record<keyof typeof AREA_WEIGHTS, number> = {
    paintBody: originalAssessment.paintBodyScore,
    panelAlignment: originalAssessment.panelAlignmentScore,
    glassLighting: originalAssessment.glassLightingScore,
    interiorSurfaces: originalAssessment.interiorSurfacesScore,
    interiorControls: originalAssessment.interiorControlsScore,
    engineBay: originalAssessment.engineBayScore,
    tiresWheels: originalAssessment.tiresWheelsScore,
    underbodyFrame: originalAssessment.underbodyFrameScore,
    exhaust: originalAssessment.exhaustScore,
  };

  // Severity weight for confirmed findings (how much a confirmed finding should depress the score)
  const severityPenalty: Record<string, number> = {
    CRITICAL: 3.0,
    MAJOR: 2.0,
    MODERATE: 1.0,
    MINOR: 0.5,
    INFO: 0.0,
  };

  // Count confirmed vs total findings per area
  const areaStats: Record<string, { confirmed: number; dismissed: number; totalSeverityPenalty: number }> = {};
  for (const area of Object.keys(areaScores)) {
    areaStats[area] = { confirmed: 0, dismissed: 0, totalSeverityPenalty: 0 };
  }

  // Categories scored separately (not part of condition score)
  const EXCLUDED_CATEGORIES = new Set(["TIRES_WHEELS"]);

  for (const finding of preliminaryFindings) {
    const review = reviews[String(finding.index)];
    if (!review) continue;
    if (EXCLUDED_CATEGORIES.has(finding.category)) continue; // Tires scored separately
    const area = CATEGORY_TO_AREA[finding.category] || "paintBody";
    if (review.verified) {
      areaStats[area].confirmed++;
      areaStats[area].totalSeverityPenalty += severityPenalty[finding.severity] || 0.5;
    } else {
      areaStats[area].dismissed++;
    }
  }

  // Clean baseline: what an area would score with no issues (8/10, not 10 — photo quality limits certainty)
  const CLEAN_BASELINE = 8;

  for (const [area, stats] of Object.entries(areaStats)) {
    const key = area as keyof typeof areaScores;
    const original = areaScores[key];
    const total = stats.confirmed + stats.dismissed;

    if (total === 0) {
      if (original < CLEAN_BASELINE) {
        areaScores[key] = original + (CLEAN_BASELINE - original) * 0.5;
      }
      continue;
    }

    const dismissalRate = stats.dismissed / total;
    const blendedScore = original + (CLEAN_BASELINE - original) * dismissalRate;
    areaScores[key] = Math.max(1, Math.min(10, blendedScore));
  }

  // Round 9-bucket area scores to nearest integer
  const finalScores = Object.fromEntries(
    Object.entries(areaScores).map(([k, v]) => [k, Math.round(v)]),
  ) as Record<keyof typeof AREA_WEIGHTS, number>;

  // Use provided weights or defaults for overall score
  const w = weights ?? AREA_WEIGHTS;
  const wSum = (Object.values(w) as number[]).reduce((a, b) => a + b, 0);

  // Recalculate overall (0-100) from weighted 9-bucket scores
  const overallScore = Math.round(
    (finalScores.paintBody / 10) * (w.paintBody / wSum) * 100 +
    (finalScores.panelAlignment / 10) * (w.panelAlignment / wSum) * 100 +
    (finalScores.glassLighting / 10) * (w.glassLighting / wSum) * 100 +
    (finalScores.interiorSurfaces / 10) * (w.interiorSurfaces / wSum) * 100 +
    (finalScores.interiorControls / 10) * (w.interiorControls / wSum) * 100 +
    (finalScores.engineBay / 10) * (w.engineBay / wSum) * 100 +
    (finalScores.tiresWheels / 10) * (w.tiresWheels / wSum) * 100 +
    (finalScores.underbodyFrame / 10) * (w.underbodyFrame / wSum) * 100 +
    (finalScores.exhaust / 10) * (w.exhaust / wSum) * 100,
  );

  // Legacy 4-area scores (rounded averages of sub-buckets)
  const legacyExteriorBody = Math.round(
    (finalScores.paintBody + finalScores.panelAlignment + finalScores.glassLighting) / 3,
  );
  const legacyInterior = Math.round(
    (finalScores.interiorSurfaces + finalScores.interiorControls) / 2,
  );
  const legacyMechanicalVisual = Math.round(
    (finalScores.engineBay + finalScores.tiresWheels + finalScores.exhaust) / 3,
  );

  // Count confirmed vs dismissed for summary
  const confirmed = preliminaryFindings.filter((f) => reviews[String(f.index)]?.verified).length;
  const dismissed = preliminaryFindings.filter((f) => reviews[String(f.index)] && !reviews[String(f.index)].verified).length;

  const summaryParts = [
    `Overall condition score: ${overallScore}/100 (verified).`,
    originalAssessment.summary.replace(/^Overall condition score: \d+\/100\.?\s*/, ""),
    dismissed > 0 ? `Inspector dismissed ${dismissed} AI-flagged issue${dismissed > 1 ? "s" : ""}.` : "",
    confirmed > 0 ? `Inspector confirmed ${confirmed} issue${confirmed > 1 ? "s" : ""}.` : "",
  ].filter(Boolean);

  return {
    ...originalAssessment,
    overallScore,

    // Legacy 4-area scores
    exteriorBodyScore: legacyExteriorBody,
    interiorScore: legacyInterior,
    mechanicalVisualScore: legacyMechanicalVisual,
    underbodyFrameScore: finalScores.underbodyFrame,

    // Legacy 4-area detail objects (update score field)
    exteriorBody: { ...originalAssessment.exteriorBody, score: legacyExteriorBody },
    interior: { ...originalAssessment.interior, score: legacyInterior },
    mechanicalVisual: { ...originalAssessment.mechanicalVisual, score: legacyMechanicalVisual },
    underbodyFrame: { ...originalAssessment.underbodyFrame, score: finalScores.underbodyFrame },

    // 9-bucket scores
    paintBodyScore: finalScores.paintBody,
    panelAlignmentScore: finalScores.panelAlignment,
    glassLightingScore: finalScores.glassLighting,
    interiorSurfacesScore: finalScores.interiorSurfaces,
    interiorControlsScore: finalScores.interiorControls,
    engineBayScore: finalScores.engineBay,
    tiresWheelsScore: finalScores.tiresWheels,
    exhaustScore: finalScores.exhaust,

    // 9-bucket detail objects (update score field)
    paintBody: { ...originalAssessment.paintBody, score: finalScores.paintBody },
    panelAlignment: { ...originalAssessment.panelAlignment, score: finalScores.panelAlignment },
    glassLighting: { ...originalAssessment.glassLighting, score: finalScores.glassLighting },
    interiorSurfaces: { ...originalAssessment.interiorSurfaces, score: finalScores.interiorSurfaces },
    interiorControls: { ...originalAssessment.interiorControls, score: finalScores.interiorControls },
    engineBay: { ...originalAssessment.engineBay, score: finalScores.engineBay },
    tiresWheels: { ...originalAssessment.tiresWheels, score: finalScores.tiresWheels },
    exhaust: { ...originalAssessment.exhaust, score: finalScores.exhaust },

    summary: summaryParts.join(" "),
  };
}
