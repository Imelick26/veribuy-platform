import { getOpenAI } from "@/lib/openai";
import type { AggregatedRisk, AIAnalysisResult, OverallConditionResult } from "@/types/risk";

interface MediaForAnalysis {
  id: string;
  url: string;
  captureType: string;
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

async function processWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  maxConcurrent: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrent, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Risk-specific analysis (per risk item, parallelized)
// ---------------------------------------------------------------------------

/**
 * Sends captured photos to GPT-4o Vision to analyze each risk item.
 * Processes up to 4 risks concurrently for ~4x speed improvement.
 *
 * Cost: ~$0.10-0.20 per inspection (risk-specific analysis).
 */
export async function analyzeRiskMedia(
  vehicle: { year: number; make: string; model: string },
  risks: AggregatedRisk[],
  media: MediaForAnalysis[]
): Promise<AIAnalysisResult[]> {
  if (risks.length === 0 || media.length === 0) return [];

  const openai = getOpenAI();

  return processWithConcurrency(
    risks,
    async (risk) => {
      try {
        return await analyzeOneRisk(openai, vehicle, risk, media);
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
    4 // max concurrent GPT-4o requests
  );
}

async function analyzeOneRisk(
  openai: ReturnType<typeof getOpenAI>,
  vehicle: { year: number; make: string; model: string },
  risk: AggregatedRisk,
  media: MediaForAnalysis[]
): Promise<AIAnalysisResult> {
  const relevantMedia = selectRelevantMedia(risk, media);

  // Max 5 photos per risk to control costs
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

  // Build signs of failure list from structured data, fallback to symptoms
  const signs = risk.signsOfFailure?.length ? risk.signsOfFailure : risk.symptoms;
  const signsOfFailureList =
    signs.length > 0
      ? signs.map((s, i) => `${i + 1}. ${s}`).join("\n")
      : "None specified";

  // Label each photo so the AI knows what angle it's seeing
  const photoDescriptions = selectedMedia
    .map((m, i) => `Photo ${i}: ${m.captureType.replace(/_/g, " ")}`)
    .join("\n");

  const systemPrompt = `You are an expert automotive inspector analyzing photos of a ${vehicle.year} ${vehicle.make} ${vehicle.model}.

You are evaluating ONE specific risk item. You will receive detailed inspection guidance including the EXACT component to check, its LOCATION on the vehicle, HOW to inspect it, and specific SIGNS OF FAILURE. Use these to guide your analysis.

Only assess what is actually visible in the photos — do not speculate about what you cannot see.

RESPOND WITH EXACTLY THIS JSON FORMAT (no markdown, no explanation outside JSON):
{
  "verdict": "CONFIRMED" | "CLEARED" | "INCONCLUSIVE",
  "confidence": 0.0 to 1.0,
  "explanation": "2-3 sentence explanation of what you see or don't see",
  "relevantPhotoIndices": [0, 1, ...],
  "observedCondition": "GOOD" | "FAIR" | "WORN" | "DAMAGED" | "FAILED",
  "visualObservations": ["specific observation 1", "specific observation 2"],
  "suggestedAction": "brief recommendation if CONFIRMED or INCONCLUSIVE, null if CLEARED"
}

Verdict guidelines:
- CONFIRMED: Clear visual evidence of the issue (damage, wear, leaks, misalignment, discoloration, etc.)
- CLEARED: Photos clearly show the area in good condition with no signs of the reported issue
- INCONCLUSIVE: Photos don't show the relevant area clearly, or evidence is ambiguous
- Be conservative — only CONFIRM if evidence is clear, only CLEAR if the area is clearly visible and in good condition
- Confidence 0.8+ means you're quite sure, 0.5-0.8 means probable, below 0.5 means uncertain

observedCondition guidelines:
- GOOD: Component/area looks clean and well-maintained
- FAIR: Minor wear consistent with age/mileage, no immediate concern
- WORN: Noticeable wear that may need attention soon
- DAMAGED: Visible damage requiring repair
- FAILED: Component has clearly failed or is non-functional`;

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

PHOTOS PROVIDED (${imageBlocks.length} images):
${photoDescriptions}

Analyze these photos for visual evidence of this specific risk. Pay special attention to the exact location described in WHERE TO LOOK and the observable indicators listed in SIGNS OF FAILURE.`;

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

  // Map photo indices back to media IDs
  const evidenceIds = (parsed.relevantPhotoIndices || [])
    .filter((i: number) => i >= 0 && i < selectedMedia.length)
    .map((i: number) => selectedMedia[i].id);

  return {
    riskId: risk.id,
    verdict: parsed.verdict || "INCONCLUSIVE",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    explanation: parsed.explanation || "No explanation provided.",
    evidenceMediaIds: evidenceIds,
    observedCondition: parsed.observedCondition || undefined,
    visualObservations: Array.isArray(parsed.visualObservations) ? parsed.visualObservations : undefined,
    suggestedAction: parsed.suggestedAction || undefined,
  };
}

// ---------------------------------------------------------------------------
// Overall vehicle condition scan
// ---------------------------------------------------------------------------

/** Standard exterior + engine photos used for the overall condition sweep. */
const OVERALL_SCAN_TYPES = [
  "FRONT_CENTER",
  "FRONT_34_DRIVER",
  "FRONT_34_PASSENGER",
  "DRIVER_SIDE",
  "PASSENGER_SIDE",
  "REAR_34_DRIVER",
  "REAR_34_PASSENGER",
  "REAR_CENTER",
  "ENGINE_BAY",
  "ROOF",
];

/**
 * Performs a general vehicle condition assessment across all standard photos.
 * Catches unexpected damage, cosmetic issues, and general wear not covered
 * by the known-risk checklist.
 *
 * Cost: ~$0.15-0.25 per call (10 high-detail images).
 */
export async function analyzeOverallCondition(
  vehicle: { year: number; make: string; model: string },
  media: MediaForAnalysis[]
): Promise<OverallConditionResult> {
  const openai = getOpenAI();

  // Select standard overview photos (up to 10)
  const scanMedia = OVERALL_SCAN_TYPES
    .map((type) => media.find((m) => m.captureType === type))
    .filter((m): m is MediaForAnalysis => !!m);

  if (scanMedia.length === 0) {
    return {
      overallGrade: "FAIR",
      exteriorCondition: "FAIR",
      interiorVisible: false,
      unexpectedFindings: [],
      summary: "No standard photos available for overall condition assessment.",
    };
  }

  const imageBlocks = scanMedia.map((m) => ({
    type: "image_url" as const,
    image_url: { url: m.url, detail: "high" as const },
  }));

  const photoDescriptions = scanMedia
    .map((m, i) => `Photo ${i}: ${m.captureType.replace(/_/g, " ")}`)
    .join("\n");

  const systemPrompt = `You are an expert automotive inspector performing a general condition assessment of a ${vehicle.year} ${vehicle.make} ${vehicle.model}.

You are NOT checking for specific known mechanical issues — those are handled separately. Instead, scan ALL provided photos for:
1. Overall exterior body condition (dents, scratches, rust, paint chips, panel gaps, mismatched paint)
2. Overall cleanliness and presentation
3. Engine bay condition (leaks, corrosion, aftermarket modifications, missing covers)
4. Any UNEXPECTED damage, wear, or concerns not typically on a risk checklist

Be thorough but conservative. Only flag issues you can clearly see.

RESPOND WITH EXACTLY THIS JSON FORMAT (no markdown):
{
  "overallGrade": "EXCELLENT" | "GOOD" | "FAIR" | "POOR",
  "exteriorCondition": "EXCELLENT" | "GOOD" | "FAIR" | "POOR",
  "interiorVisible": true | false,
  "engineBayCondition": "CLEAN" | "NORMAL" | "DIRTY" | "CONCERNING",
  "unexpectedFindings": [
    {
      "title": "Short descriptive title",
      "description": "What you see and why it matters",
      "severity": "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR",
      "category": "COSMETIC_EXTERIOR" | "COSMETIC_INTERIOR" | "STRUCTURAL" | "ENGINE" | "ELECTRICAL" | "SAFETY" | "OTHER",
      "photoIndex": 0,
      "confidence": 0.0 to 1.0
    }
  ],
  "summary": "2-3 sentence overall condition assessment"
}

Grading guidelines:
- EXCELLENT: Looks nearly new, no visible issues
- GOOD: Normal wear for age/mileage, minor cosmetic only
- FAIR: Multiple cosmetic issues or signs of wear beyond normal
- POOR: Significant damage, heavy wear, or neglect visible

Only include unexpectedFindings for issues clearly visible in the photos with confidence > 0.5. Do NOT flag normal age-appropriate wear as findings.`;

  const userContent = `Perform a general condition assessment of this vehicle.

PHOTOS PROVIDED (${imageBlocks.length} images):
${photoDescriptions}

Scan all photos systematically. Note any body damage, paint issues, rust, leaks, or anything unexpected for a ${vehicle.year} ${vehicle.make} ${vehicle.model}.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userContent },
            ...imageBlocks,
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        overallGrade: "FAIR",
        exteriorCondition: "FAIR",
        interiorVisible: false,
        unexpectedFindings: [],
        summary: "AI returned empty response for overall condition scan.",
      };
    }

    const parsed = JSON.parse(content);

    // Validate and sanitize unexpected findings
    const unexpectedFindings = Array.isArray(parsed.unexpectedFindings)
      ? parsed.unexpectedFindings
          .filter(
            (f: Record<string, unknown>) =>
              f.title &&
              f.description &&
              typeof f.confidence === "number" &&
              f.confidence > 0.5
          )
          .map((f: Record<string, unknown>) => ({
            title: String(f.title),
            description: String(f.description),
            severity: (["CRITICAL", "MAJOR", "MODERATE", "MINOR"].includes(String(f.severity))
              ? f.severity
              : "MINOR") as "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR",
            category: String(f.category || "OTHER"),
            photoIndex: typeof f.photoIndex === "number" ? f.photoIndex : -1,
            confidence: f.confidence as number,
          }))
      : [];

    return {
      overallGrade: parsed.overallGrade || "FAIR",
      exteriorCondition: parsed.exteriorCondition || "FAIR",
      interiorVisible: !!parsed.interiorVisible,
      engineBayCondition: parsed.engineBayCondition || undefined,
      unexpectedFindings,
      summary: parsed.summary || "Overall condition assessment completed.",
    };
  } catch (err) {
    console.error("[media-analyzer] Overall condition scan failed:", err);
    return {
      overallGrade: "FAIR",
      exteriorCondition: "FAIR",
      interiorVisible: false,
      unexpectedFindings: [],
      summary: "Overall condition scan failed. Manual assessment recommended.",
    };
  }
}

// ---------------------------------------------------------------------------
// Photo relevance selection
// ---------------------------------------------------------------------------

/**
 * Selects the most relevant photos for a given risk based on capture type matching.
 */
function selectRelevantMedia(risk: AggregatedRisk, media: MediaForAnalysis[]): MediaForAnalysis[] {
  // First, add any photos specifically captured for this risk
  const riskEvidence = media.filter((m) =>
    m.captureType.startsWith(`FINDING_EVIDENCE_${risk.id}`)
  );

  // Then add area-relevant standard photos based on risk category
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
    (m) => relevantTypes.includes(m.captureType) && !riskEvidence.some((re) => re.id === m.id)
  );

  // Risk-specific evidence first, then area photos
  return [...riskEvidence, ...areaPhotos];
}
