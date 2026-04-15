/**
 * AI-Powered Fallback Valuation
 *
 * When Black Book returns no data (old vehicles, rare models, brand new years),
 * this module uses GPT-4o's market knowledge to estimate tier values.
 *
 * Dramatically better than hardcoded curves — knows that a '97 Wrangler
 * holds value, a Cummins diesel is worth more than a gas truck, and a
 * high-mile luxury sedan craters post-warranty.
 *
 * Only runs when BB valuation returns null.
 *
 * Cost: ~$0.04-0.08 per call (GPT-4o, structured output)
 */

import { validatedAICall, type AIResult, type ValidationResult } from "./validate-and-retry";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FallbackValuationInput {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    engine?: string | null;
    drivetrain?: string | null;
    transmission?: string | null;
    bodyStyle?: string | null;
  };
  bodyCategory: "truck" | "suv" | "sports" | "sedan" | "other";
  mileage?: number;
  conditionScore: number;
  conditionTier: string;
  region: string; // state abbreviation
}

export interface FallbackTierValues {
  extra_clean: number;
  clean: number;
  average: number;
  rough: number;
}

export interface FallbackValuationResult {
  /** Retail values by tier (dollars) */
  retailByTier: FallbackTierValues;
  /** Wholesale values by tier (dollars) */
  wholesaleByTier: FallbackTierValues;
  /** Trade-in values by tier (dollars) — extra_clean mirrors clean */
  tradeInByTier: { clean: number; average: number; rough: number };
  /** Confidence 0-1 */
  confidence: number;
  /** Explanation of the estimate */
  reasoning: string;
}

/* ------------------------------------------------------------------ */
/*  Core Function                                                      */
/* ------------------------------------------------------------------ */

export async function estimateFallbackValuation(
  input: FallbackValuationInput,
): Promise<AIResult<FallbackValuationResult>> {
  const { vehicle, mileage, conditionScore, conditionTier, region, bodyCategory } = input;
  const vehicleDesc = [
    `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehicle.trim, vehicle.engine, vehicle.transmission, vehicle.drivetrain,
  ].filter(Boolean).join(", ");

  const age = new Date().getFullYear() - vehicle.year;

  return validatedAICall<FallbackValuationResult>({
    label: "[FallbackValuation]",

    primary: {
      model: "gpt-4o",
      systemPrompt: `You are a vehicle valuation expert. Black Book has no data for this vehicle, so you need to estimate retail, wholesale, and trade-in values across 4 condition tiers.

YOUR KNOWLEDGE:
- You understand vehicle depreciation curves by segment
- You know which vehicles hold value (Wranglers, Tacomas, Land Cruisers, diesel trucks)
- You know which vehicles crater (high-mile luxury, certain EVs, Korean sedans pre-2018)
- You understand mileage impact varies by vehicle type (diesel trucks tolerate high miles, sports cars don't)
- You know regional demand (trucks premium in TX/SE, sedans in CA/NE)
- You understand the relationship between retail, wholesale, and trade-in values:
  * Wholesale ≈ 55-70% of retail (varies by demand)
  * Trade-in ≈ 65-80% of retail (between wholesale and retail)
  * The spread tightens on high-demand vehicles (Wrangler wholesale is 80%+ of retail)

RETURN VALUES IN WHOLE US DOLLARS (not cents).
Values must decrease from extra_clean → clean → average → rough.
Wholesale must be less than retail at every tier.
Trade-in must be between wholesale and retail at every tier.

RETURN JSON ONLY.`,
      userPrompt: `Estimate values for a vehicle Black Book has no data on:

VEHICLE: ${vehicleDesc}
AGE: ${age} years old
MILEAGE: ${mileage ? `${mileage.toLocaleString()} miles` : "Unknown"}
CONDITION: ${conditionScore}/100 (${conditionTier} tier)
CATEGORY: ${bodyCategory}
REGION: ${region}

Return JSON:
{
  "retailByTier": { "extra_clean": number, "clean": number, "average": number, "rough": number },
  "wholesaleByTier": { "extra_clean": number, "clean": number, "average": number, "rough": number },
  "tradeInByTier": { "clean": number, "average": number, "rough": number },
  "confidence": number (0.0-1.0 — lower for rare/unusual vehicles),
  "reasoning": "2-3 sentences explaining your estimate. What vehicles/market data informed it."
}`,
      temperature: 0.1,
      maxTokens: 600,
    },

    validate: (parsed: unknown): ValidationResult<FallbackValuationResult> => {
      const p = parsed as Record<string, unknown>;
      const errors: string[] = [];

      // Validate retail tiers
      const retail = p.retailByTier as Record<string, unknown> | undefined;
      if (!retail || typeof retail !== "object") {
        errors.push("retailByTier missing");
      } else {
        for (const tier of ["extra_clean", "clean", "average", "rough"]) {
          if (typeof retail[tier] !== "number" || Number(retail[tier]) <= 0) {
            errors.push(`retailByTier.${tier} must be positive number`);
          }
        }
        // Ensure descending order
        if (Number(retail.extra_clean) < Number(retail.clean) ||
            Number(retail.clean) < Number(retail.average) ||
            Number(retail.average) < Number(retail.rough)) {
          // Don't error — just note it (AI sometimes produces valid but slightly out-of-order)
        }
      }

      // Validate wholesale tiers
      const wholesale = p.wholesaleByTier as Record<string, unknown> | undefined;
      if (!wholesale || typeof wholesale !== "object") {
        errors.push("wholesaleByTier missing");
      } else {
        for (const tier of ["extra_clean", "clean", "average", "rough"]) {
          if (typeof wholesale[tier] !== "number" || Number(wholesale[tier]) <= 0) {
            errors.push(`wholesaleByTier.${tier} must be positive number`);
          }
        }
      }

      // Validate trade-in tiers
      const tradeIn = p.tradeInByTier as Record<string, unknown> | undefined;
      if (!tradeIn || typeof tradeIn !== "object") {
        errors.push("tradeInByTier missing");
      } else {
        for (const tier of ["clean", "average", "rough"]) {
          if (typeof tradeIn[tier] !== "number" || Number(tradeIn[tier]) <= 0) {
            errors.push(`tradeInByTier.${tier} must be positive number`);
          }
        }
      }

      const conf = Number(p.confidence);
      if (isNaN(conf) || conf < 0 || conf > 1) {
        errors.push("confidence must be 0.0-1.0");
      }

      if (!p.reasoning || typeof p.reasoning !== "string") {
        errors.push("reasoning missing");
      }

      if (errors.length > 0) {
        return { valid: false, partial: p, errors };
      }

      // Enforce ordering: extra_clean >= clean >= average >= rough
      const fixOrder = (tiers: Record<string, number>): Record<string, number> => {
        const ec = Number(tiers.extra_clean) || 0;
        const cl = Number(tiers.clean) || 0;
        const av = Number(tiers.average) || 0;
        const ro = Number(tiers.rough) || 0;
        const sorted = [ec, cl, av, ro].sort((a, b) => b - a);
        return { extra_clean: sorted[0], clean: sorted[1], average: sorted[2], rough: sorted[3] };
      };

      const retailFixed = fixOrder(retail as Record<string, number>);
      const wholesaleFixed = fixOrder(wholesale as Record<string, number>);
      const ti = tradeIn as Record<string, number>;
      const tradeInSorted = [Number(ti.clean), Number(ti.average), Number(ti.rough)].sort((a, b) => b - a);

      return {
        valid: true,
        data: {
          retailByTier: retailFixed as unknown as FallbackTierValues,
          wholesaleByTier: wholesaleFixed as unknown as FallbackTierValues,
          tradeInByTier: { clean: tradeInSorted[0], average: tradeInSorted[1], rough: tradeInSorted[2] },
          confidence: Math.max(0, Math.min(1, conf)),
          reasoning: String(p.reasoning),
        },
      };
    },

    buildFollowUp: (partial, errors) => {
      return `Your response had issues: ${errors.join("; ")}. Return corrected JSON with retailByTier (4 tiers), wholesaleByTier (4 tiers), tradeInByTier (3 tiers: clean/average/rough), confidence (0-1), reasoning. All values in whole dollars. JSON only.`;
    },

    simplified: {
      model: "gpt-4o",
      buildPrompt: () => {
        return `Estimate values for: ${vehicleDesc}${mileage ? ` at ${mileage.toLocaleString()} mi` : ""}, ${bodyCategory}, ${region}. Return JSON: { "retailByTier": {"extra_clean":$,"clean":$,"average":$,"rough":$}, "wholesaleByTier": {"extra_clean":$,"clean":$,"average":$,"rough":$}, "tradeInByTier": {"clean":$,"average":$,"rough":$}, "confidence": 0-1, "reasoning": string }. Whole dollars, descending order.`;
      },
    },

    emergencyFallback: () => {
      // Very crude fallback — this should rarely fire since it's already the fallback path
      const baseRetail = mileage && mileage > 150000 ? 5000 : mileage && mileage > 100000 ? 8000 : 15000;
      return {
        retailByTier: {
          extra_clean: Math.round(baseRetail * 1.15),
          clean: baseRetail,
          average: Math.round(baseRetail * 0.80),
          rough: Math.round(baseRetail * 0.60),
        },
        wholesaleByTier: {
          extra_clean: Math.round(baseRetail * 0.75),
          clean: Math.round(baseRetail * 0.65),
          average: Math.round(baseRetail * 0.52),
          rough: Math.round(baseRetail * 0.39),
        },
        tradeInByTier: {
          clean: Math.round(baseRetail * 0.72),
          average: Math.round(baseRetail * 0.58),
          rough: Math.round(baseRetail * 0.43),
        },
        confidence: 0.15,
        reasoning: "Emergency fallback — all AI calls failed. Values are rough estimates only.",
      };
    },
  });
}
