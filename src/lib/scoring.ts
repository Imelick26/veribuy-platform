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
      exteriorBodyScore: assessment.exteriorBodyScore,
      interiorScore: assessment.interiorScore,
      mechanicalVisualScore: assessment.mechanicalVisualScore,
      underbodyFrameScore: assessment.underbodyFrameScore,
      conditionSummary: assessment.summary,
      conditionRawData: JSON.parse(JSON.stringify(assessment)),
    },
  });
}
