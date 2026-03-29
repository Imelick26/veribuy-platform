/**
 * AI-Powered Consensus Source Weighting
 *
 * Replaces fixed source weights (BB=0.25, VDB=0.25, NADA=0.20, etc.) with
 * contextual AI analysis that considers:
 *   - Source reliability for THIS specific vehicle type
 *   - Agreement/disagreement between sources
 *   - Listing volume and data freshness
 *   - Specificity (VIN-match vs category-level estimate)
 *
 * This is the foundation price — everything else builds on top of it.
 *
 * Cost: ~$0.03-0.06 per call (GPT-4o, structured output)
 */

import { validatedAICall, type AIResult, type ValidationResult } from "./validate-and-retry";
import { calculateConsensus, type SourceEstimate, type ConsensusResult } from "@/lib/pricing-consensus";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ConsensusWeighterInput {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    engine?: string | null;
    drivetrain?: string | null;
    transmission?: string | null;
  };
  mileage?: number;
  conditionScore: number;
  conditionTier: string;
  sourceEstimates: SourceEstimate[];
}

export interface ConsensusWeighterResult {
  sourceWeights: Record<string, number>;
  outlierSources: string[];
  outlierReasons: Record<string, string>;
  consensusValue: number;
  tradeInValue: number;
  dealerRetailValue: number;
  wholesaleValue: number;
  loanValue: number;
  confidenceAssessment: number;
  reasoning: string;
  configPremiumMode: "full" | "partial" | "none";
  conditionAttenuation: number;
}

/* ------------------------------------------------------------------ */
/*  Core Function                                                      */
/* ------------------------------------------------------------------ */

export async function analyzeConsensusWeights(
  input: ConsensusWeighterInput,
): Promise<AIResult<ConsensusWeighterResult>> {
  const { vehicle, mileage, conditionScore, conditionTier, sourceEstimates } = input;
  const validSources = sourceEstimates.filter((s) => s.estimatedValue > 0);

  const vehicleDesc = [
    `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehicle.trim,
    vehicle.engine,
    vehicle.drivetrain,
  ].filter(Boolean).join(", ");

  // Format sources for the prompt
  const sourceTable = validSources.map((s) => {
    const parts = [
      `${s.source}: PP=$${s.estimatedValue.toLocaleString()}`,
      s.tradeInValue ? `Trade=$${s.tradeInValue.toLocaleString()}` : null,
      s.dealerRetailValue ? `Retail=$${s.dealerRetailValue.toLocaleString()}` : null,
      s.wholesaleValue ? `Wholesale=$${s.wholesaleValue.toLocaleString()}` : null,
      s.loanValue ? `Loan=$${s.loanValue.toLocaleString()}` : null,
      `Conf=${(s.confidence * 100).toFixed(0)}%`,
      s.isConditionTiered ? `(condition-tiered)` : `(flat)`,
    ].filter(Boolean);
    return parts.join(", ");
  }).join("\n");

  const allPPValues = validSources.map((s) => s.estimatedValue);
  const minVal = Math.min(...allPPValues);
  const maxVal = Math.max(...allPPValues);

  // ── Deterministic passthrough for 1-2 sources ──────────────────
  // AI consensus adds noise with few sources — it hallucinates about
  // sources that don't exist and arbitrarily adjusts values.
  if (validSources.length <= 2) {
    const deterministicResult = calculateConsensus(validSources);

    // Compute configPremiumMode from source flags
    const conditionTieredCount = validSources.filter((s) => s.isConditionTiered).length;
    const configAwareCount = validSources.filter((s) => s.isConfigAware).length;
    const totalSourceCount = validSources.length;

    let configPremiumMode: "full" | "partial" | "none";
    if (configAwareCount === totalSourceCount) {
      configPremiumMode = "none";
    } else if (configAwareCount > 0 || conditionTieredCount >= 2) {
      configPremiumMode = "partial";
    } else if (conditionTieredCount >= 1) {
      configPremiumMode = "partial";
    } else {
      configPremiumMode = "full";
    }
    const conditionAttenuation = conditionTieredCount >= 2 ? 0.3 : conditionTieredCount >= 1 ? 0.4 : 1.0;

    console.log(`[ConsensusWeighter] Deterministic passthrough (${validSources.length} source${validSources.length > 1 ? "s" : ""}) — configMode: ${configPremiumMode}`);

    return {
      result: {
        sourceWeights: Object.fromEntries(validSources.map((s) => [s.source, 1 / validSources.length])),
        outlierSources: [],
        outlierReasons: {},
        consensusValue: deterministicResult.estimatedValue,
        tradeInValue: deterministicResult.tradeInValue,
        dealerRetailValue: deterministicResult.dealerRetailValue,
        wholesaleValue: deterministicResult.wholesaleValue,
        loanValue: deterministicResult.loanValue,
        confidenceAssessment: deterministicResult.confidence,
        reasoning: `Deterministic passthrough — ${validSources.length} source(s): ${validSources.map((s) => s.source).join(", ")}`,
        configPremiumMode,
        conditionAttenuation,
      },
      aiAnalyzed: false,
      fallbackTier: 1,
      retried: false,
      model: "deterministic",
      reasoning: `Deterministic passthrough (${validSources.length} sources)`,
    };
  }

  // ── AI consensus for 3+ sources ────────────────────────────────
  return validatedAICall<ConsensusWeighterResult>({
    label: "[ConsensusWeighter]",

    primary: {
      model: "gpt-4o",
      systemPrompt: `You are a vehicle pricing analyst specializing in data source evaluation. Your job is to analyze multiple pricing sources for a specific vehicle and determine which sources to trust most, flag outliers, and produce a consensus ACQUISITION value — what a dealer should PAY to acquire this vehicle.

IMPORTANT: All source values have already been normalized to acquisition-equivalent (dealer pay price). Retail markup, auction discounts, and source biases have been stripped. You are comparing apples-to-apples acquisition cost estimates.

Key knowledge about each source's reliability:
- BlackBook: Wholesale gold standard, strong for common vehicles, condition-tiered (4 tiers)
- VehicleDatabases (VDB): Condition-tiered with 12 price points, good coverage
- NADA Guides: Dealer/lender standard, used for loan values, condition-tiered
- VinAudit: VIN-specific with mileage adjustment, but not condition-tiered
- MarketCheck: Based on real dealer inventory — strong when there are many local comps, noisy with few
- Fallback: AI estimate, very generic, last resort only

Your consensus value should represent DEALER ACQUISITION COST — not retail, not private-party. The values you see already target this perspective.

Consider: Which sources are most reliable for THIS specific vehicle? Do the condition-tiered sources agree? Is MarketCheck reflecting real local market conditions?`,
      userPrompt: `Analyze these pricing sources for a ${vehicleDesc}${mileage ? ` at ${mileage.toLocaleString()} miles` : ""}, condition score ${conditionScore}/100 (${conditionTier}):

${sourceTable}

Return a JSON object with:
1. "sourceWeights": Object mapping each source name to a weight (0-1). Weights must sum to approximately 1.0. Weight sources higher if they're more reliable for this vehicle type.

2. "outlierSources": Array of source names that should be flagged as outliers.

3. "outlierReasons": Object mapping outlier source names to the reason they're outliers.

4. "consensusValue": Your best estimate of fair ACQUISITION cost in dollars (what a dealer should pay). Must be between $${minVal.toLocaleString()} and $${maxVal.toLocaleString()} (within the source range).

5. "tradeInValue": Trade-in estimate in dollars.

6. "dealerRetailValue": Dealer retail estimate in dollars.

7. "wholesaleValue": Wholesale estimate in dollars.

8. "loanValue": Loan value estimate in dollars.

9. "confidenceAssessment": Your confidence in this consensus (0.0-1.0). Higher when sources agree, lower when they diverge.

10. "reasoning": 2-3 sentences explaining your weighting rationale and which sources you trust most for this vehicle.

Return ONLY valid JSON.`,
      temperature: 0.1,
      maxTokens: 1000,
    },

    validate: (parsed: unknown): ValidationResult<ConsensusWeighterResult> => {
      const p = parsed as Record<string, unknown>;
      const errors: string[] = [];

      // Validate sourceWeights
      const sw = p.sourceWeights as Record<string, number> | undefined;
      if (!sw || typeof sw !== "object") {
        errors.push("sourceWeights missing or not an object");
      } else {
        const totalWeight = Object.values(sw).reduce((s, v) => s + (Number(v) || 0), 0);
        if (totalWeight < 0.1) errors.push("sourceWeights sum too low");
      }

      // Validate consensusValue
      const cv = Number(p.consensusValue);
      if (!cv || cv < 100) {
        errors.push("consensusValue missing or too low");
      } else if (minVal > 0 && maxVal > 0 && (cv < minVal * 0.85 || cv > maxVal * 1.15)) {
        errors.push(`consensusValue $${cv} outside plausible range ($${minVal}-$${maxVal})`);
      }

      // Validate confidence
      const conf = Number(p.confidenceAssessment);
      if (isNaN(conf)) errors.push("confidenceAssessment missing");

      // Validate reasoning
      if (!p.reasoning || typeof p.reasoning !== "string") {
        errors.push("reasoning missing");
      }

      if (errors.length > 0) {
        return { valid: false, partial: p, errors };
      }

      // Normalize weights to sum to 1.0
      const weights = sw as Record<string, number>;
      const totalWeight = Object.values(weights).reduce((s, v) => s + (Number(v) || 0), 0);
      const normalizedWeights: Record<string, number> = {};
      for (const [k, v] of Object.entries(weights)) {
        normalizedWeights[k] = (Number(v) || 0) / totalWeight;
      }

      // Determine config premium mode — accounts for both condition-tiered AND config-aware sources
      const conditionTieredCount = validSources.filter((s) => s.isConditionTiered).length;
      const configAwareCount = validSources.filter((s) => s.isConfigAware).length;
      const totalSourceCount = validSources.length;

      let configPremiumMode: "full" | "partial" | "none";
      if (configAwareCount === totalSourceCount) {
        configPremiumMode = "none";
      } else if (configAwareCount > 0 || conditionTieredCount >= 2) {
        configPremiumMode = "partial";
      } else if (conditionTieredCount >= 1) {
        configPremiumMode = "partial";
      } else {
        configPremiumMode = "full";
      }
      const conditionAttenuation = conditionTieredCount >= 2 ? 0.3 : conditionTieredCount >= 1 ? 0.4 : 1.0;

      return {
        valid: true,
        data: {
          sourceWeights: normalizedWeights,
          outlierSources: Array.isArray(p.outlierSources) ? (p.outlierSources as string[]).filter((s) => typeof s === "string") : [],
          outlierReasons: (p.outlierReasons && typeof p.outlierReasons === "object") ? p.outlierReasons as Record<string, string> : {},
          consensusValue: Math.round(cv),
          tradeInValue: Math.round(Number(p.tradeInValue) || cv * 0.82),
          dealerRetailValue: Math.round(Number(p.dealerRetailValue) || cv * 1.18),
          wholesaleValue: Math.round(Number(p.wholesaleValue) || cv * 0.72),
          loanValue: Math.round(Number(p.loanValue) || cv * 0.85),
          confidenceAssessment: Math.max(0, Math.min(1, conf)),
          reasoning: String(p.reasoning),
          configPremiumMode,
          conditionAttenuation,
        },
      };
    },

    buildFollowUp: (partial, errors) => {
      return `Your previous response was missing or had invalid fields: ${errors.join("; ")}. Here's what you provided: ${JSON.stringify(partial)}. Please provide a corrected JSON object with ALL required fields. Return ONLY valid JSON.`;
    },

    simplified: {
      model: "gpt-4o",
      buildPrompt: () => {
        const prices = validSources.map((s) => `${s.source}: $${s.estimatedValue.toLocaleString()}`).join(", ");
        return `Here are ${validSources.length} price estimates for a ${vehicleDesc}: ${prices}. Which are most reliable and what's the fair private-party value? Return JSON: { "consensusValue": number, "tradeInValue": number, "dealerRetailValue": number, "wholesaleValue": number, "loanValue": number, "confidenceAssessment": number (0-1), "sourceWeights": { sourceName: weight }, "outlierSources": [], "outlierReasons": {}, "reasoning": "..." }`;
      },
    },

    emergencyFallback: () => {
      // Use the existing weighted median algorithm as emergency fallback
      const fallbackConsensus = calculateConsensus(sourceEstimates);
      return {
        sourceWeights: Object.fromEntries(validSources.map((s) => [s.source, 1 / validSources.length])),
        outlierSources: [],
        outlierReasons: {},
        consensusValue: fallbackConsensus.estimatedValue,
        tradeInValue: fallbackConsensus.tradeInValue,
        dealerRetailValue: fallbackConsensus.dealerRetailValue,
        wholesaleValue: fallbackConsensus.wholesaleValue,
        loanValue: fallbackConsensus.loanValue,
        confidenceAssessment: fallbackConsensus.confidence,
        reasoning: "Emergency fallback — used weighted median algorithm",
        configPremiumMode: fallbackConsensus.configPremiumMode,
        conditionAttenuation: fallbackConsensus.conditionAttenuation,
      };
    },
  });
}
