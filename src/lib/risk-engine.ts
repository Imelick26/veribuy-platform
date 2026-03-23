import type {
  NHTSARecall,
  NHTSAInvestigation,
  AggregatedRisk,
  AggregatedRiskProfile,
  Severity,
  Likelihood,
} from "@/types/risk";
import { getPositionForCategory, mapNHTSAComponent, resetJitter } from "./risk-positions";
import { getCapturePromptList, getInspectionGuidance } from "./capture-prompts";

interface KnownIssueInput {
  title: string;
  category: string;
  severity: Severity;
  likelihood: Likelihood;
  whatToCheck: string;
  whereToLook: string;
  howToInspect: string;
  signsOfFailure: string[];
  whyItMatters: string;
  estimatedCostLow: number;
  estimatedCostHigh: number;
  capturePrompts: string[];
  inspectionQuestions?: Array<{
    question: string;
    failureAnswer: "yes" | "no";
    mediaPrompt?: string;
    id?: string;
    order?: number;
  }>;
}

interface BuildProfileInput {
  vehicleId: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  knownIssues: KnownIssueInput[];
  recalls: NHTSARecall[];
  investigations: NHTSAInvestigation[];
  complaintCount: number;
  curatedProfileId?: string;
}

/**
 * Builds a unified risk profile from AI-generated known issues,
 * NHTSA recalls, and NHTSA investigations.
 *
 * Priority:
 * 1. AI-generated known issues (primary — expert knowledge)
 * 2. NHTSA recalls (added if not already covered by AI items)
 * 3. NHTSA investigations (boost severity of matching items or add new)
 */
export function buildRiskProfile(input: BuildProfileInput): AggregatedRiskProfile {
  resetJitter();

  const risks: AggregatedRisk[] = [];
  const coveredCategories = new Set<string>();

  // 1. Add AI-generated known issues as primary items
  for (const issue of input.knownIssues) {
    const category = issue.category || "OTHER";
    coveredCategories.add(category);

    risks.push({
      id: `known-${risks.length}`,
      severity: issue.severity,
      title: issue.title,
      description: issue.whyItMatters,
      category,
      source: "AI_GENERATED",
      cost: {
        low: (issue.estimatedCostLow || 0) * 100, // convert dollars to cents
        high: (issue.estimatedCostHigh || 0) * 100,
      },
      position: getPositionForCategory(category),
      symptoms: issue.signsOfFailure,
      capturePrompts: issue.capturePrompts.length > 0
        ? issue.capturePrompts
        : getCapturePromptList(category),
      inspectionGuidance: issue.howToInspect,
      // New structured fields
      whatToCheck: issue.whatToCheck,
      whereToLook: issue.whereToLook,
      howToInspect: issue.howToInspect,
      signsOfFailure: issue.signsOfFailure,
      whyItMatters: issue.whyItMatters,
      likelihood: issue.likelihood,
      inspectionQuestions: issue.inspectionQuestions?.map((q, idx) => ({
        id: q.id || `q${idx}`,
        question: q.question,
        failureAnswer: q.failureAnswer,
        mediaPrompt: q.mediaPrompt,
        order: q.order ?? idx,
      })),
    });
  }

  // 2. Tag AI items that have related recalls (recalls are free dealer fixes, not listed separately)
  for (const recall of input.recalls) {
    const category = mapNHTSAComponent(recall.component);
    const existingIdx = risks.findIndex((r) => r.category === category);

    if (existingIdx !== -1) {
      risks[existingIdx].hasActiveRecall = true;
      if (!risks[existingIdx].relatedRecalls) {
        risks[existingIdx].relatedRecalls = [];
      }
      risks[existingIdx].relatedRecalls!.push(recall);
    }
    // Don't add standalone recall items — recalls are free to fix at dealers
  }

  // 3. Tag AI items that have related investigations
  for (const inv of input.investigations) {
    const category = mapNHTSAComponent(inv.component);
    const existingIdx = risks.findIndex((r) => r.category === category);

    if (existingIdx !== -1) {
      risks[existingIdx].investigationId = inv.investigationId;
    }
  }

  // Sort by estimated repair cost (most expensive first — these drive purchase decisions)
  risks.sort((a, b) => b.cost.high - a.cost.high || b.cost.low - a.cost.low);

  // Count complaints by component from raw data (for summary display)
  const complaintsByComponent: Record<string, number> = {};

  return {
    vehicleId: input.vehicleId,
    vin: input.vin,
    make: input.make,
    model: input.model,
    year: input.year,
    curatedProfileId: input.curatedProfileId,
    nhtsaData: {
      complaintCount: input.complaintCount,
      recallCount: input.recalls.length,
      investigationCount: input.investigations.length,
      complaintsByComponent,
    },
    aggregatedRisks: risks,
    generatedAt: new Date().toISOString(),
  };
}

function severityRank(severity: Severity | string): number {
  const ranks: Record<string, number> = {
    CRITICAL: 4,
    MAJOR: 3,
    MODERATE: 2,
    MINOR: 1,
    INFO: 0,
  };
  return ranks[severity] ?? 0;
}
