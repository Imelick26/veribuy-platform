import type { RiskCheckStatus, AggregatedRisk, AIAnalysisResult } from "@/types/risk";

export interface RiskConfidence {
  riskId: string;
  confidence: number; // 0.0 - 1.0
  tier: "VERIFIED" | "EVIDENCED" | "MANUAL" | "SKIPPED" | "UNCHECKED";
  label: string;
}

export interface InspectionConfidence {
  overall: number; // 0.0 - 1.0
  perRisk: RiskConfidence[];
  evidenceCoverage: number; // % of checked risks with photos
  summary: string;
}

const CONFIDENCE_TIERS = {
  VERIFIED: { base: 0.9, label: "AI Verified" },
  EVIDENCED: { base: 0.7, label: "Photo Evidence" },
  MANUAL: { base: 0.45, label: "Manual Only" },
  SKIPPED: { base: 0.15, label: "Skipped" },
  UNCHECKED: { base: 0.0, label: "Not Checked" },
};

export function computeRiskConfidence(
  riskId: string,
  checkStatus: RiskCheckStatus | undefined,
  aiResult: AIAnalysisResult | undefined,
): RiskConfidence {
  if (!checkStatus || checkStatus.status === "NOT_CHECKED") {
    return {
      riskId,
      confidence: CONFIDENCE_TIERS.UNCHECKED.base,
      tier: "UNCHECKED",
      label: CONFIDENCE_TIERS.UNCHECKED.label,
    };
  }

  // Skipped risks get low confidence — AI may still analyze from standard photos
  if (checkStatus.status === "UNABLE_TO_INSPECT") {
    return {
      riskId,
      confidence: CONFIDENCE_TIERS.SKIPPED.base,
      tier: "SKIPPED",
      label: CONFIDENCE_TIERS.SKIPPED.label,
    };
  }

  const hasPhotos = (checkStatus.mediaIds || []).length > 0;
  const hasAI = !!aiResult && aiResult.confidence > 0;

  if (hasPhotos && hasAI) {
    return {
      riskId,
      confidence: Math.max(CONFIDENCE_TIERS.VERIFIED.base, aiResult.confidence),
      tier: "VERIFIED",
      label: CONFIDENCE_TIERS.VERIFIED.label,
    };
  }

  if (hasPhotos) {
    return {
      riskId,
      confidence: CONFIDENCE_TIERS.EVIDENCED.base,
      tier: "EVIDENCED",
      label: CONFIDENCE_TIERS.EVIDENCED.label,
    };
  }

  return {
    riskId,
    confidence: CONFIDENCE_TIERS.MANUAL.base,
    tier: "MANUAL",
    label: CONFIDENCE_TIERS.MANUAL.label,
  };
}

const SEVERITY_WEIGHT: Record<string, number> = {
  CRITICAL: 3,
  MAJOR: 2,
  MODERATE: 1,
  MINOR: 1,
  INFO: 0.5,
};

export function computeInspectionConfidence(
  risks: AggregatedRisk[],
  checkStatuses: Record<string, RiskCheckStatus>,
  aiResults: AIAnalysisResult[],
): InspectionConfidence {
  const aiMap = new Map(aiResults.map((r) => [r.riskId, r]));

  const perRisk = risks.map((risk) =>
    computeRiskConfidence(risk.id, checkStatuses[risk.id], aiMap.get(risk.id)),
  );

  let totalWeight = 0;
  let weightedSum = 0;
  for (let i = 0; i < risks.length; i++) {
    const w = SEVERITY_WEIGHT[risks[i].severity] || 1;
    totalWeight += w;
    weightedSum += perRisk[i].confidence * w;
  }

  const overall = totalWeight > 0 ? weightedSum / totalWeight : 0;

  const checkedRisks = Object.values(checkStatuses).filter(
    (s) => s.status !== "NOT_CHECKED",
  );
  const evidencedRisks = checkedRisks.filter(
    (s) => (s.mediaIds || []).length > 0,
  );
  const evidenceCoverage =
    checkedRisks.length > 0 ? evidencedRisks.length / checkedRisks.length : 0;

  let summary: string;
  if (overall >= 0.85)
    summary = "High confidence — most risks verified with photo evidence";
  else if (overall >= 0.65)
    summary = "Moderate confidence — photo evidence captured for key risks";
  else if (overall >= 0.4)
    summary = "Low confidence — many risks assessed without photo evidence";
  else summary = "Capture photo evidence to increase assessment confidence";

  return { overall, perRisk, evidenceCoverage, summary };
}
