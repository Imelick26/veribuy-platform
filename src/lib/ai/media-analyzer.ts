import { getOpenAI } from "@/lib/openai";
import type { AggregatedRisk, AIAnalysisResult } from "@/types/risk";

interface MediaForAnalysis {
  id: string;
  url: string;
  captureType: string;
}

/**
 * Sends captured photos to GPT-4o Vision to analyze each risk item.
 * Returns a verdict (CONFIRMED / CLEARED / INCONCLUSIVE) per risk
 * with confidence score and explanation.
 *
 * Cost: ~$0.10-0.30 per inspection (20-30 photos).
 */
export async function analyzeRiskMedia(
  vehicle: { year: number; make: string; model: string },
  risks: AggregatedRisk[],
  media: MediaForAnalysis[]
): Promise<AIAnalysisResult[]> {
  if (risks.length === 0 || media.length === 0) return [];

  const openai = getOpenAI();
  const results: AIAnalysisResult[] = [];

  // Process risks in batches to avoid token limits
  // Send all photos with each risk for context
  for (const risk of risks) {
    try {
      const result = await analyzeOneRisk(openai, vehicle, risk, media);
      results.push(result);
    } catch (err) {
      console.error(`[media-analyzer] Failed to analyze risk ${risk.id}:`, err);
      results.push({
        riskId: risk.id,
        verdict: "INCONCLUSIVE",
        confidence: 0,
        explanation: "AI analysis failed for this risk item. Manual inspection recommended.",
        evidenceMediaIds: [],
      });
    }
  }

  return results;
}

async function analyzeOneRisk(
  openai: ReturnType<typeof getOpenAI>,
  vehicle: { year: number; make: string; model: string },
  risk: AggregatedRisk,
  media: MediaForAnalysis[]
): Promise<AIAnalysisResult> {
  // Select the most relevant photos for this risk
  // Include risk-specific evidence photos + general area photos
  const relevantMedia = selectRelevantMedia(risk, media);

  // Build image content blocks (max 5 photos per risk to control costs)
  const imageBlocks = relevantMedia.slice(0, 5).map((m) => ({
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

  const systemPrompt = `You are an expert automotive inspector analyzing photos of a ${vehicle.year} ${vehicle.make} ${vehicle.model}.

You are evaluating ONE specific risk item. Analyze the provided photos carefully for visual evidence that either CONFIRMS or CLEARS this risk.

RESPOND WITH EXACTLY THIS JSON FORMAT (no markdown, no explanation outside JSON):
{
  "verdict": "CONFIRMED" | "CLEARED" | "INCONCLUSIVE",
  "confidence": 0.0 to 1.0,
  "explanation": "2-3 sentence explanation of what you see or don't see in the photos",
  "relevantPhotoIndices": [0, 1, ...]
}

Guidelines:
- CONFIRMED: You can see clear visual evidence of the issue (damage, wear, leaks, misalignment, etc.)
- CLEARED: Photos clearly show the area in good condition with no signs of the reported issue
- INCONCLUSIVE: Photos don't show the relevant area clearly, or evidence is ambiguous
- Be conservative — only CONFIRM if evidence is clear, only CLEAR if the area is clearly visible and in good condition
- Confidence 0.8+ means you're quite sure, 0.5-0.8 means probable, below 0.5 means uncertain`;

  const riskContext = `RISK TO EVALUATE:
Title: ${risk.title}
Category: ${risk.category}
Severity: ${risk.severity}
Description: ${risk.aiSummary || risk.description}
Symptoms to look for: ${risk.symptoms.join(", ") || "None specified"}

I'm sending ${imageBlocks.length} photos of the vehicle. Analyze them for evidence related to this specific risk.`;

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
    max_tokens: 500,
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
    .filter((i: number) => i >= 0 && i < relevantMedia.length)
    .map((i: number) => relevantMedia[i].id);

  return {
    riskId: risk.id,
    verdict: parsed.verdict || "INCONCLUSIVE",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    explanation: parsed.explanation || "No explanation provided.",
    evidenceMediaIds: evidenceIds,
  };
}

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
    ENGINE: ["ENGINE_BAY", "UNDER_HOOD_LABEL", "FRONT_CENTER"],
    TRANSMISSION: ["UNDERCARRIAGE", "ENGINE_BAY"],
    DRIVETRAIN: ["UNDERCARRIAGE", "DRIVER_SIDE", "PASSENGER_SIDE"],
    STRUCTURAL: ["UNDERCARRIAGE", "FRONT_CENTER", "REAR_CENTER", "DRIVER_SIDE", "PASSENGER_SIDE"],
    SUSPENSION: ["UNDERCARRIAGE", "FRONT_34_DRIVER", "FRONT_34_PASSENGER", "REAR_34_DRIVER", "REAR_34_PASSENGER"],
    BRAKES: ["FRONT_34_DRIVER", "FRONT_34_PASSENGER", "REAR_34_DRIVER", "REAR_34_PASSENGER"],
    TIRES_WHEELS: ["FRONT_34_DRIVER", "FRONT_34_PASSENGER", "REAR_34_DRIVER", "REAR_34_PASSENGER", "DRIVER_SIDE", "PASSENGER_SIDE"],
    ELECTRICAL: ["ENGINE_BAY", "FRONT_CENTER", "REAR_CENTER"],
    ELECTRONICS: ["FRONT_CENTER", "DRIVER_SIDE"],
    SAFETY: ["FRONT_CENTER", "REAR_CENTER", "DRIVER_SIDE", "PASSENGER_SIDE"],
    COSMETIC_EXTERIOR: ["FRONT_CENTER", "REAR_CENTER", "DRIVER_SIDE", "PASSENGER_SIDE", "ROOF", "FRONT_34_DRIVER", "FRONT_34_PASSENGER"],
    COSMETIC_INTERIOR: ["DRIVER_SIDE", "PASSENGER_SIDE"],
    HVAC: ["ENGINE_BAY", "DRIVER_SIDE"],
  };

  const relevantTypes = categoryMediaMap[risk.category] || [];
  const areaPhotos = media.filter(
    (m) => relevantTypes.includes(m.captureType) && !riskEvidence.some((re) => re.id === m.id)
  );

  // Risk-specific evidence first, then area photos
  return [...riskEvidence, ...areaPhotos];
}
