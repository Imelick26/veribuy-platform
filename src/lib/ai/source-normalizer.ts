/**
 * AI-Powered Source Normalization to Acquisition Cost
 *
 * Each pricing source reports values from a different perspective:
 *   - BlackBook: Wholesale (what dealers pay at auction for clean vehicles)
 *   - VehicleDatabases: Retail-oriented condition-tiered prices
 *   - NADA: Lender/dealer standard (conservative, loan-friendly)
 *   - VinAudit: Retail private-party estimate (not condition-aware)
 *   - MarketCheck: Dealer asking prices (15-25% markup over acquisition)
 *   - AI Fallback: Generic estimate (perspective varies)
 *
 * This module normalizes each source so its `estimatedValue` represents
 * what a DEALER SHOULD PAY to acquire the vehicle — not what it lists for,
 * not what a lender will finance, not auction-damaged wholesale.
 *
 * After normalization, the consensus weighter compares apples-to-apples.
 *
 * Cost: ~$0.01-0.02 per call (GPT-4o-mini, single call for all sources)
 */

import { validatedAICall, type AIResult, type ValidationResult } from "./validate-and-retry";
import type { SourceEstimate, PricingSourceName } from "@/lib/pricing-consensus";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SourceNormalizerInput {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    engine?: string | null;
    drivetrain?: string | null;
    transmission?: string | null;
  };
  conditionScore: number;
  bodyCategory: "truck" | "suv" | "sports" | "sedan" | "other";
  isEnthusiastPlatform: boolean;
  sourceEstimates: SourceEstimate[];
  /** Comp listings for context (source labels tell the AI what kind of data MarketCheck has) */
  compSummary: {
    activeDealer: number;
    soldDealer: number;
    auction: number;
    total: number;
  };
}

export interface NormalizedSource {
  source: PricingSourceName;
  /** Original private-party value reported by this source */
  originalValue: number;
  /** Acquisition-equivalent value (what a dealer should pay) */
  acquisitionValue: number;
  /** Multiplier applied: acquisitionValue / originalValue */
  multiplier: number;
  /** Brief reason for the adjustment */
  reason: string;
}

export interface SourceNormalizerResult {
  normalizedSources: NormalizedSource[];
  reasoning: string;
}

/* ------------------------------------------------------------------ */
/*  Core Function                                                      */
/* ------------------------------------------------------------------ */

export async function normalizeSourcesForAcquisition(
  input: SourceNormalizerInput,
): Promise<AIResult<SourceNormalizerResult>> {
  const { vehicle, conditionScore, bodyCategory, isEnthusiastPlatform, sourceEstimates, compSummary } = input;

  const validSources = sourceEstimates.filter((s) => s.estimatedValue > 0);
  if (validSources.length === 0) {
    return {
      result: { normalizedSources: [], reasoning: "No sources to normalize" },
      aiAnalyzed: false,
      model: "none",
      fallbackTier: 3 as const,
      retried: false,
      reasoning: "No sources",
    };
  }


  const vehicleDesc = [
    `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehicle.trim, vehicle.engine, vehicle.drivetrain, vehicle.transmission,
  ].filter(Boolean).join(", ");

  // Format each source as a clear block so the AI doesn't confuse price labels with source names
  const sourceTable = validSources.map((s) => {
    const prices = [
      `Private-Party Value: $${s.estimatedValue.toLocaleString()}`,
      s.tradeInValue ? `Trade-In Value: $${s.tradeInValue.toLocaleString()}` : null,
      s.dealerRetailValue ? `Dealer Retail Value: $${s.dealerRetailValue.toLocaleString()}` : null,
      s.wholesaleValue ? `Wholesale Value: $${s.wholesaleValue.toLocaleString()}` : null,
      s.loanValue ? `Loan Value: $${s.loanValue.toLocaleString()}` : null,
    ].filter(Boolean).join(", ");
    return `SOURCE NAME: "${s.source}" | ${prices} | Confidence: ${(s.confidence * 100).toFixed(0)}% | ${s.isConditionTiered ? "Condition-tiered" : "Flat"}`;
  }).join("\n");

  const sourceNameList = validSources.map((s) => `"${s.source}"`).join(", ");

  return validatedAICall<SourceNormalizerResult>({
    label: "[SourceNormalizer]",

    primary: {
      model: "gpt-4o",
      systemPrompt: `You normalize vehicle pricing sources to ACQUISITION COST — what a dealer should pay a private seller to acquire this vehicle.

Each source reports prices from a different perspective. Your job is to apply the correct multiplier to each source so they all represent the same thing: dealer acquisition cost.

SOURCE BIASES:
- **blackbook**: Reports wholesale values. Wholesale = what dealers pay at auction for CLEAN vehicles. For a private-seller acquisition, this is close to acquisition cost already. Multiplier: typically 0.95-1.05x (wholesale is already near acquisition).
- **vehicledatabases**: Reports condition-tiered retail/private-party values. These are what a private buyer would pay, NOT what a dealer pays. Multiplier: typically 0.80-0.90x to strip the retail premium.
- **nada**: Reports lender-standard values (conservative). Trade-in is close to acquisition; private-party is higher. Use trade-in as acquisition proxy. Multiplier on PP: typically 0.78-0.88x.
- **vinaudit**: Reports retail private-party. Not condition-tiered, so may be inaccurate. Multiplier: typically 0.78-0.88x.
- **marketcheck**: Reports dealer ASKING prices from real listings. These include 15-25% dealer markup. Multiplier: typically 0.75-0.85x to strip markup.
- **fallback**: AI estimate — usually targets private-party retail. Multiplier: typically 0.80-0.90x.

VEHICLE-SPECIFIC ADJUSTMENTS:
- Enthusiast/hot vehicles (Powerstroke, Cummins, Wrangler, Land Cruiser, muscle cars): Tighter margins — multipliers shift UP by 0.03-0.08 because dealers must pay closer to retail to secure inventory.
- Commodity vehicles: Standard multipliers apply.
- Poor condition (<50 score): Wider multipliers (dealers discount more for condition risk).
- Excellent condition (>80): Tighter multipliers (less room for improvement = less dealer margin needed).

IMPORTANT: Each source already reports DIFFERENT perspectives. BlackBook wholesale ≠ MarketCheck dealer retail. Normalize them all to the SAME target: acquisition cost.`,

      userPrompt: `Normalize these pricing sources to dealer acquisition cost for:

VEHICLE: ${vehicleDesc}
CATEGORY: ${bodyCategory}
CONDITION: ${conditionScore}/100
ENTHUSIAST PLATFORM: ${isEnthusiastPlatform ? "YES" : "No"}
COMP MIX: ${compSummary.activeDealer} active dealer, ${compSummary.soldDealer} sold dealer, ${compSummary.auction} auction (${compSummary.total} total)

SOURCES (${validSources.length} total):
${sourceTable}

CRITICAL: The "source" field in your response MUST use EXACTLY these source names: ${sourceNameList}
You MUST return one entry for each source listed above. Do NOT use price label names like "PP" or "Trade" as source names.

For each source, determine the multiplier to convert its Private-Party Value to acquisition cost.

Return JSON:
{
  "normalizedSources": [
    {
      "source": "<EXACT source name from list above, e.g. fallback>",
      "originalValue": <the Private-Party Value number from that source>,
      "acquisitionValue": <originalValue × multiplier, rounded to whole dollars>,
      "multiplier": <0.70-1.10>,
      "reason": "<brief explanation>"
    }
  ],
  "reasoning": "2-3 sentences on overall normalization strategy for this vehicle"
}`,
      temperature: 0.1,
      maxTokens: 800,
    },

    validate: (parsed: unknown): ValidationResult<SourceNormalizerResult> => {
      const p = parsed as Record<string, unknown>;
      const errors: string[] = [];

      if (!Array.isArray(p.normalizedSources)) {
        errors.push("normalizedSources must be an array");
        return { valid: false, partial: p, errors };
      }

      const normalized = p.normalizedSources as Record<string, unknown>[];
      const sourceNames = validSources.map((s) => s.source);

      for (const ns of normalized) {
        const src = String(ns.source);
        if (!sourceNames.includes(src as PricingSourceName)) {
          errors.push(`Unknown source: ${src}`);
        }
        const mult = Number(ns.multiplier);
        if (!mult || mult < 0.50 || mult > 1.15) {
          errors.push(`${src} multiplier ${mult} outside range 0.50-1.15`);
        }
        const origVal = Number(ns.originalValue);
        const acqVal = Number(ns.acquisitionValue);
        if (!origVal || origVal < 100) {
          errors.push(`${src} originalValue missing or too low`);
        }
        if (!acqVal || acqVal < 100) {
          errors.push(`${src} acquisitionValue missing or too low`);
        }
      }

      // Ensure we got entries for all valid sources
      const normalizedNames = normalized.map((ns) => String(ns.source));
      for (const sn of sourceNames) {
        if (!normalizedNames.includes(sn)) {
          errors.push(`Missing normalization for source: ${sn}`);
        }
      }

      if (!p.reasoning || typeof p.reasoning !== "string") {
        errors.push("reasoning missing");
      }

      if (errors.length > 0) {
        return { valid: false, partial: p, errors };
      }

      return {
        valid: true,
        data: {
          normalizedSources: normalized.map((ns) => ({
            source: String(ns.source) as PricingSourceName,
            originalValue: Number(ns.originalValue),
            acquisitionValue: Math.round(Number(ns.acquisitionValue)),
            multiplier: Math.max(0.50, Math.min(1.15, Number(ns.multiplier))),
            reason: String(ns.reason || ""),
          })),
          reasoning: String(p.reasoning),
        },
      };
    },

    buildFollowUp: (partial, errors) => {
      return `Issues: ${errors.join("; ")}. Return JSON with normalizedSources array (one entry per source: source, originalValue, acquisitionValue, multiplier 0.50-1.15, reason) and reasoning string. Sources needed: ${validSources.map((s) => s.source).join(", ")}. JSON only.`;
    },

    simplified: {
      model: "gpt-4o",
      buildPrompt: () => {
        return `Normalize these vehicle pricing sources to dealer acquisition cost for a ${vehicleDesc} (${bodyCategory}, condition ${conditionScore}/100${isEnthusiastPlatform ? ", enthusiast platform" : ""}). Sources:\n${sourceTable}\n\nReturn JSON: { "normalizedSources": [{ "source": string, "originalValue": number, "acquisitionValue": number, "multiplier": 0.50-1.15, "reason": string }], "reasoning": string }`;
      },
    },

    emergencyFallback: () => {
      // Simple heuristic multipliers per source type
      const defaultMultipliers: Record<string, number> = {
        blackbook: isEnthusiastPlatform ? 1.02 : 0.98,
        vehicledatabases: isEnthusiastPlatform ? 0.88 : 0.83,
        nada: isEnthusiastPlatform ? 0.85 : 0.80,
        vinaudit: isEnthusiastPlatform ? 0.87 : 0.82,
        marketcheck: isEnthusiastPlatform ? 0.83 : 0.78,
        fallback: isEnthusiastPlatform ? 0.88 : 0.83,
      };

      return {
        normalizedSources: validSources.map((s) => {
          const mult = defaultMultipliers[s.source] || 0.83;
          return {
            source: s.source,
            originalValue: s.estimatedValue,
            acquisitionValue: Math.round(s.estimatedValue * mult),
            multiplier: mult,
            reason: "Emergency fallback — standard source multiplier",
          };
        }),
        reasoning: "Emergency fallback — standard acquisition multipliers per source type",
      };
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Helper: Apply normalization to SourceEstimate array                */
/* ------------------------------------------------------------------ */

/**
 * Returns a new array of SourceEstimates with estimatedValue replaced
 * by the acquisition-normalized value. All other fields preserved.
 */
export function applyNormalization(
  originals: SourceEstimate[],
  normResult: SourceNormalizerResult,
): SourceEstimate[] {
  const normMap = new Map(normResult.normalizedSources.map((ns) => [ns.source, ns]));

  return originals.map((se) => {
    const norm = normMap.get(se.source);
    if (!norm || se.estimatedValue <= 0) return se;

    return {
      ...se,
      // Replace the primary value with acquisition-equivalent
      estimatedValue: norm.acquisitionValue,
      // Scale trade-in/wholesale proportionally (they're already closer to acquisition)
      tradeInValue: se.tradeInValue > 0 ? Math.round(se.tradeInValue * Math.min(1.0, norm.multiplier * 1.05)) : 0,
      wholesaleValue: se.wholesaleValue > 0 ? Math.round(se.wholesaleValue * Math.min(1.0, norm.multiplier * 1.08)) : 0,
      // Dealer retail stays unchanged — that's a useful reference point
      dealerRetailValue: se.dealerRetailValue,
      // Loan value stays close to original (lender perspective)
      loanValue: se.loanValue,
    };
  });
}
