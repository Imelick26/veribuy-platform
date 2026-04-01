/**
 * Risk-specific analysis — analyzes known risks using GPT-4o Vision.
 * Kept separate from the detection pipeline per design decision.
 *
 * Moved from the original media-analyzer.ts without changes.
 */

import { getOpenAI } from "@/lib/openai";
import type {
  AggregatedRisk,
  AIAnalysisResult,
  QuestionAnswer,
} from "@/types/risk";
import type { MediaForAnalysis } from "../types";
import { processWithConcurrency } from "../utils";

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

/**
 * Sends captured photos to GPT-4o Vision to analyze each risk item.
 * Processes up to 4 risks concurrently for ~4x speed improvement.
 */
export async function analyzeRiskMedia(
  vehicle: { year: number; make: string; model: string },
  risks: AggregatedRisk[],
  media: MediaForAnalysis[],
  questionAnswers?: Record<string, QuestionAnswer[]>,
): Promise<AIAnalysisResult[]> {
  if (risks.length === 0 || media.length === 0) return [];

  const openai = getOpenAI();

  return processWithConcurrency(
    risks,
    async (risk) => {
      try {
        return await analyzeOneRisk(openai, vehicle, risk, media, questionAnswers?.[risk.id]);
      } catch (err) {
        console.error(`[media-analyzer] Failed to analyze risk ${risk.id}:`, err);
        return {
          riskId: risk.id,
          verdict: "INCONCLUSIVE" as const,
          confidence: 0,
          explanation: "AI analysis failed for this risk item. Manual inspection recommended.",
          evidenceMediaIds: [],
        };
      }
    },
    4,
  );
}

// ---------------------------------------------------------------------------
//  Single risk analysis
// ---------------------------------------------------------------------------

async function analyzeOneRisk(
  openai: ReturnType<typeof getOpenAI>,
  vehicle: { year: number; make: string; model: string },
  risk: AggregatedRisk,
  media: MediaForAnalysis[],
  riskAnswers?: QuestionAnswer[],
): Promise<AIAnalysisResult> {
  const relevantMedia = selectRelevantMedia(risk, media);
  const selectedMedia = relevantMedia.slice(0, 5);
  const imageBlocks = selectedMedia.map((m) => ({
    type: "image_url" as const,
    image_url: { url: m.url, detail: "high" as const },
  }));

  if (imageBlocks.length === 0) {
    return {
      riskId: risk.id,
      verdict: "INCONCLUSIVE",
      confidence: 0.1,
      explanation: "No relevant photos available for this risk area. Manual inspection needed.",
      evidenceMediaIds: [],
    };
  }

  const signs = risk.signsOfFailure?.length ? risk.signsOfFailure : risk.symptoms;
  const signsOfFailureList =
    signs.length > 0
      ? signs.map((s, i) => `${i + 1}. ${s}`).join("\n")
      : "None specified";

  const photoDescriptions = selectedMedia
    .map((m, i) => `Photo ${i}: ${m.captureType.replace(/_/g, " ")}`)
    .join("\n");

  const systemPrompt = `You are analyzing inspection photos of a ${vehicle.year} ${vehicle.make} ${vehicle.model} to assess the condition of a KNOWN issue that was identified through NHTSA complaint data, recall records, and platform-specific failure databases.

The issue has already been identified by real data — your job is to ASSESS ITS CURRENT CONDITION on this specific vehicle based on the photos and any hands-on observations the inspector reported.

You are a ${vehicle.make} ${vehicle.model} specialist. You know exactly what healthy vs. failing components look like on this platform because you've seen hundreds of these vehicles.

YOUR DIAGNOSTIC APPROACH:
1. Examine ALL provided photos — multiple angles of the same area give you a complete picture. Close-ups reveal depth/severity, wide shots reveal extent/spread.
2. Look for the specific signs of failure listed below — you know exactly what they look like on this platform.
3. Make a CONFIDENT call. If you can see the component clearly, commit to a definitive assessment. The inspector took specific photos at your direction — use them.
4. If the inspector also performed hands-on checks (questions answered), weight their firsthand observations heavily — they can feel, hear, and smell things photos cannot show.
5. Match what you see to the COST TIER DESCRIPTIONS provided — each tier describes exactly what this issue looks like at MINOR, MODERATE, and SEVERE stages.

Only mark INCONCLUSIVE if the relevant area is genuinely not visible or obstructed. If you can see the component, commit to a verdict.

RESPOND WITH EXACTLY THIS JSON FORMAT (no markdown, no explanation outside JSON):
{
  "verdict": "CONFIRMED" | "CLEARED" | "INCONCLUSIVE",
  "confidence": 0.0 to 1.0,
  "explanation": "2-3 sentence expert diagnosis. Reference specific components by their ${vehicle.make} ${vehicle.model} platform names. State what you see and what it means for this known issue.",
  "relevantPhotoIndices": [0, 1, ...],
  "observedCondition": "GOOD" | "FAIR" | "WORN" | "DAMAGED" | "FAILED",
  "visualObservations": ["specific observation 1", "specific observation 2"],
  "suggestedAction": "brief recommendation if CONFIRMED or INCONCLUSIVE, null if CLEARED"
}

Verdict guidelines:
- CONFIRMED: Photos and/or inspector observations show evidence of this known issue on this vehicle.
- CLEARED: The component/area is clearly visible and shows no signs of this known failure.
- INCONCLUSIVE: Photos don't show the relevant area clearly enough — not enough evidence to make a call.
- Confidence 0.8+ = definitive assessment, 0.5-0.8 = probable but limited view, below 0.5 = poor visibility

observedCondition — THIS DIRECTLY DETERMINES THE REPAIR COST ESTIMATE:
- GOOD: No signs of this known failure, component looks well-maintained → MINOR repair tier
- FAIR: Minor age-appropriate wear, no active failure indicators → MINOR repair tier
- WORN: Early/mid stages of this known failure developing → MODERATE repair tier
- DAMAGED: Active failure in progress, component needs repair → SEVERE repair tier
- FAILED: Component has clearly failed or is unsafe → SEVERE repair tier

When cost tier descriptions are provided below, match what you see to the specific tier description that fits. The tier labels describe exactly what each stage looks like for THIS specific issue on THIS platform.`;

  const riskContext = `RISK TO EVALUATE:
Title: ${risk.title}
Category: ${risk.category}
Severity: ${risk.severity}
Likelihood: ${risk.likelihood || "UNKNOWN"}

WHAT TO CHECK: ${risk.whatToCheck || risk.title}
WHERE TO LOOK: ${risk.whereToLook || "See category area"}
HOW TO INSPECT: ${risk.howToInspect || "Visual inspection of the relevant area"}

SIGNS OF FAILURE TO LOOK FOR:
${signsOfFailureList}

BACKGROUND: ${risk.aiSummary || risk.description}
WHY IT MATTERS: ${risk.whyItMatters || "Potential safety or reliability concern"}
${buildCostTierContext(risk)}
PHOTOS PROVIDED (${imageBlocks.length} images):
${photoDescriptions}

Analyze these photos for visual evidence of this specific risk. Pay special attention to the exact location described in WHERE TO LOOK and the observable indicators listed in SIGNS OF FAILURE.${risk.costTiers?.length ? " Use the COST TIER DESCRIPTIONS above to calibrate your observedCondition — match what you see to the tier that best fits." : ""}${buildInspectorObservationsContext(risk, riskAnswers)}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: riskContext },
          ...imageBlocks,
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 600,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      riskId: risk.id,
      verdict: "INCONCLUSIVE",
      confidence: 0,
      explanation: "AI returned empty response.",
      evidenceMediaIds: [],
    };
  }

  const parsed = JSON.parse(content);

  const evidenceIds = (parsed.relevantPhotoIndices || [])
    .filter((i: number) => i >= 0 && i < selectedMedia.length)
    .map((i: number) => selectedMedia[i].id);

  const refinedCost = selectCostTier(risk, parsed.observedCondition);

  return {
    riskId: risk.id,
    verdict: parsed.verdict || "INCONCLUSIVE",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    explanation: parsed.explanation || "No explanation provided.",
    evidenceMediaIds: evidenceIds,
    observedCondition: parsed.observedCondition || undefined,
    visualObservations: Array.isArray(parsed.visualObservations) ? parsed.visualObservations : undefined,
    suggestedAction: parsed.suggestedAction || undefined,
    refinedCost,
  };
}

// ---------------------------------------------------------------------------
//  Helpers (moved from original)
// ---------------------------------------------------------------------------

function selectRelevantMedia(risk: AggregatedRisk, media: MediaForAnalysis[]): MediaForAnalysis[] {
  const riskEvidence = media.filter((m) =>
    m.captureType.startsWith(`FINDING_EVIDENCE_${risk.id}`) ||
    m.captureType.startsWith(`RISK_Q_${risk.id}_`),
  );

  const categoryMediaMap: Record<string, string[]> = {
    ENGINE: ["ENGINE_BAY", "UNDER_HOOD_LABEL", "FRONT_CENTER", "UNDERCARRIAGE"],
    TRANSMISSION: ["UNDERCARRIAGE", "ENGINE_BAY", "DRIVER_SIDE"],
    DRIVETRAIN: ["UNDERCARRIAGE", "DRIVER_SIDE", "PASSENGER_SIDE"],
    STRUCTURAL: ["UNDERCARRIAGE", "FRONT_CENTER", "REAR_CENTER", "DRIVER_SIDE", "PASSENGER_SIDE", "FRONT_34_DRIVER", "REAR_34_DRIVER"],
    SUSPENSION: ["UNDERCARRIAGE", "FRONT_34_DRIVER", "FRONT_34_PASSENGER", "REAR_34_DRIVER", "REAR_34_PASSENGER", "TIRES_DETAIL"],
    BRAKES: ["FRONT_34_DRIVER", "FRONT_34_PASSENGER", "REAR_34_DRIVER", "REAR_34_PASSENGER", "TIRES_DETAIL"],
    TIRES_WHEELS: ["TIRES_DETAIL", "FRONT_34_DRIVER", "FRONT_34_PASSENGER", "REAR_34_DRIVER", "REAR_34_PASSENGER", "DRIVER_SIDE", "PASSENGER_SIDE"],
    ELECTRICAL: ["ENGINE_BAY", "FRONT_CENTER", "REAR_CENTER", "DASHBOARD", "INSTRUMENT_CLUSTER"],
    ELECTRONICS: ["DASHBOARD", "INFOTAINMENT", "INSTRUMENT_CLUSTER", "FRONT_CENTER"],
    SAFETY: ["FRONT_CENTER", "REAR_CENTER", "DRIVER_SIDE", "PASSENGER_SIDE", "DASHBOARD"],
    COSMETIC_EXTERIOR: ["FRONT_CENTER", "REAR_CENTER", "DRIVER_SIDE", "PASSENGER_SIDE", "ROOF", "FRONT_34_DRIVER", "FRONT_34_PASSENGER", "REAR_34_DRIVER", "REAR_34_PASSENGER"],
    COSMETIC_INTERIOR: ["DASHBOARD", "FRONT_SEATS", "REAR_SEATS", "CENTER_CONSOLE", "INFOTAINMENT"],
    HVAC: ["ENGINE_BAY", "DASHBOARD", "CENTER_CONSOLE"],
    INTERIOR: ["DASHBOARD", "FRONT_SEATS", "REAR_SEATS", "CENTER_CONSOLE", "INFOTAINMENT", "INSTRUMENT_CLUSTER"],
    CARGO: ["TRUCK_BED", "REAR_CENTER", "REAR_34_DRIVER", "REAR_34_PASSENGER"],
  };

  const relevantTypes = categoryMediaMap[risk.category] || [];
  const areaPhotos = media.filter(
    (m) => relevantTypes.includes(m.captureType) && !riskEvidence.some((re) => re.id === m.id),
  );

  return [...riskEvidence, ...areaPhotos];
}

const CONDITION_TO_TIER: Record<string, "MINOR" | "MODERATE" | "SEVERE"> = {
  GOOD: "MINOR",
  FAIR: "MINOR",
  WORN: "MODERATE",
  DAMAGED: "SEVERE",
  FAILED: "SEVERE",
};

function selectCostTier(
  risk: AggregatedRisk,
  observedCondition?: string,
): AIAnalysisResult["refinedCost"] {
  if (!risk.costTiers?.length || !observedCondition) return undefined;
  const tierCondition = CONDITION_TO_TIER[observedCondition] || "MODERATE";
  const tier = risk.costTiers.find((t) => t.condition === tierCondition);
  if (!tier) return undefined;
  return {
    low: tier.costLow,
    high: tier.costHigh,
    tierCondition: tier.condition,
    tierLabel: tier.label,
  };
}

/**
 * Maps manual inspection question failure count to a cost tier.
 * Exported for use in inspection procedures for manual-only checks.
 */
export function selectCostTierFromFailures(
  risk: AggregatedRisk,
  failureCount: number,
): AIAnalysisResult["refinedCost"] {
  if (!risk.costTiers?.length) return undefined;
  const tierCondition: "MINOR" | "MODERATE" | "SEVERE" =
    failureCount === 0 ? "MINOR" : failureCount === 1 ? "MODERATE" : "SEVERE";
  const tier = risk.costTiers.find((t) => t.condition === tierCondition);
  if (!tier) return undefined;
  return {
    low: tier.costLow,
    high: tier.costHigh,
    tierCondition: tier.condition,
    tierLabel: tier.label,
  };
}

function buildCostTierContext(risk: AggregatedRisk): string {
  if (!risk.costTiers?.length) return "";
  const lines: string[] = [];
  lines.push("\nCOST TIER DESCRIPTIONS (use these to calibrate your observedCondition):");
  for (const tier of risk.costTiers) {
    const low = (tier.costLow / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    const high = (tier.costHigh / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    const conditionMap: Record<string, string> = {
      MINOR: "GOOD/FAIR",
      MODERATE: "WORN",
      SEVERE: "DAMAGED/FAILED",
    };
    lines.push(`- ${tier.condition} (${low}–${high}): "${tier.label}" → observedCondition = ${conditionMap[tier.condition] || tier.condition}`);
  }
  lines.push("");
  return lines.join("\n");
}

function buildInspectorObservationsContext(
  risk: AggregatedRisk,
  riskAnswers?: QuestionAnswer[],
): string {
  if (!riskAnswers || riskAnswers.length === 0 || !risk.inspectionQuestions?.length) {
    return "";
  }

  const lines: string[] = [];
  lines.push("\n\nINSPECTOR HANDS-ON OBSERVATIONS:");
  lines.push("The inspector performed physical checks and reported the following:");

  for (const qa of riskAnswers) {
    if (qa.answer == null) continue;
    const qDef = risk.inspectionQuestions.find((q) => q.id === qa.questionId);
    if (!qDef) continue;

    const isFailure = qa.answer === qDef.failureAnswer;
    const indicator = isFailure ? "(⚠ indicates failure)" : "(✓ no issue)";
    lines.push(`- Q: "${qDef.question}" → ${qa.answer.toUpperCase()} ${indicator}`);
    if (qa.mediaIds && qa.mediaIds.length > 0) {
      lines.push(`  [Inspector attached ${qa.mediaIds.length} photo(s) as evidence]`);
    }
  }

  lines.push("");
  lines.push("Weight these firsthand observations heavily — inspectors can feel, hear, and smell things that photos cannot capture. If the inspector confirmed a failure through hands-on testing, treat that as strong evidence even if photos are inconclusive.");

  return lines.join("\n");
}
