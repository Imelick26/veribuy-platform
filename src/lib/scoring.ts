/**
 * Condition score calculation for inspections.
 * Shared between inspection procedures (on finding add) and report generation.
 */
import { db } from "@/server/db";

const WEIGHTS = { structural: 0.45, cosmetic: 0.30, electronics: 0.25 };

const DEDUCTIONS: Record<string, number> = {
  CRITICAL: 30,
  MAJOR: 15,
  MODERATE: 7,
  MINOR: 3,
  INFO: 0,
};

function mapCategory(cat: string): "structural" | "cosmetic" | "electronics" {
  const structural = ["STRUCTURAL", "DRIVETRAIN", "ENGINE", "TRANSMISSION", "BRAKES", "SUSPENSION"];
  const electronics = ["ELECTRICAL", "ELECTRONICS", "SAFETY"];
  if (structural.includes(cat)) return "structural";
  if (electronics.includes(cat)) return "electronics";
  return "cosmetic";
}

/**
 * Recalculate and persist the condition scores for an inspection based on its findings.
 * Returns the updated inspection record.
 */
export async function recalculateScore(prisma: typeof db, inspectionId: string) {
  const findings = await prisma.finding.findMany({
    where: { inspectionId },
  });

  const scores = { structural: 100, cosmetic: 100, electronics: 100 };

  for (const f of findings) {
    const ded = DEDUCTIONS[f.severity] || 0;
    const bucket = mapCategory(f.category);
    scores[bucket] = Math.max(0, scores[bucket] - ded);
  }

  const overall = Math.round(
    scores.structural * WEIGHTS.structural +
    scores.cosmetic * WEIGHTS.cosmetic +
    scores.electronics * WEIGHTS.electronics
  );

  return prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      overallScore: overall,
      structuralScore: scores.structural,
      cosmeticScore: scores.cosmetic,
      electronicsScore: scores.electronics,
    },
  });
}
