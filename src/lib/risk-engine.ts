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
  description: string;
  category: string;
  severity: Severity;
  likelihood: Likelihood;
  checkMethod?: "photo" | "manual" | "both" | "visual";
  componentHint?: string;
  whatToCheck: string;
  whereToLook: string;
  howToInspect: string;
  signsOfFailure: string[];
  whyItMatters: string;
  /** Plain-English explanation of what this component is */
  whatThisIs?: string;
  /** Step-by-step wayfinding directions to locate the component */
  howToLocate?: string;
  /** Single evidence photo prompt shown only when failure is detected */
  evidencePrompt?: string;
  estimatedCostLow: number;
  estimatedCostHigh: number;
  costTiers?: Array<{
    condition: "MINOR" | "MODERATE" | "SEVERE";
    label: string;
    costLow: number;
    costHigh: number;
  }>;
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

  // 1. Add AI-generated known issues as primary items (deduplicated)
  for (const issue of input.knownIssues) {
    const category = issue.category || "OTHER";

    // Dedup: skip if we already have a risk with a very similar title in the same category
    const isDuplicate = risks.some((existing) => {
      if (existing.category !== category) return false;
      return titlesOverlap(existing.title, issue.title);
    });
    if (isDuplicate) continue;

    coveredCategories.add(category);

    risks.push({
      id: `known-${risks.length}`,
      severity: issue.severity,
      title: issue.title,
      description: issue.description,
      category,
      source: "AI_GENERATED",
      componentHint: issue.componentHint || undefined,
      cost: {
        low: (issue.estimatedCostLow || 0) * 100, // convert dollars to cents
        high: (issue.estimatedCostHigh || 0) * 100,
      },
      costTiers: issue.costTiers?.map((t) => ({
        condition: t.condition,
        label: t.label,
        costLow: t.costLow * 100,  // dollars to cents
        costHigh: t.costHigh * 100,
      })),
      position: getPositionForCategory(category),
      symptoms: issue.signsOfFailure,
      capturePrompts: issue.capturePrompts.length > 0
        ? issue.capturePrompts
        : getCapturePromptList(category),
      inspectionGuidance: issue.howToInspect,
      // Structured fields
      checkMethod: issue.checkMethod === "photo" || issue.checkMethod === "both" ? "visual" : (issue.checkMethod || "visual"),
      whatToCheck: issue.whatToCheck,
      whereToLook: issue.whereToLook,
      howToInspect: issue.howToInspect,
      signsOfFailure: issue.signsOfFailure,
      whyItMatters: issue.whyItMatters,
      likelihood: issue.likelihood,
      whatThisIs: issue.whatThisIs,
      howToLocate: issue.howToLocate,
      evidencePrompt: issue.evidencePrompt,
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

/**
 * Checks if two risk titles refer to the same issue using keyword overlap.
 * Strips common filler words and compares significant terms.
 */
function titlesOverlap(a: string, b: string): boolean {
  const stopWords = new Set(["the", "a", "an", "of", "in", "on", "at", "to", "for", "and", "or", "with", "from", "issue", "issues", "problem", "problems", "failure"]);
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 1 && !stopWords.has(w));

  const wordsA = normalize(a);
  const wordsB = new Set(normalize(b));
  if (wordsA.length === 0 || wordsB.size === 0) return false;

  const overlap = wordsA.filter((w) => wordsB.has(w)).length;
  const minLen = Math.min(wordsA.length, wordsB.size);

  // If 60%+ of the shorter title's significant words match, it's a duplicate
  return minLen > 0 && overlap / minLen >= 0.6;
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
