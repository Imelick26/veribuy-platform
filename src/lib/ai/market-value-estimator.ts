/**
 * AI-Powered Market Value Estimator
 *
 * Replaces static fallback pricing curves with GPT-4o analysis that
 * understands what makes a vehicle valuable:
 *   - A 1996 7.3L Powerstroke manual 4x4 is $15-25K, not a generic "$9K truck"
 *   - Enthusiast platforms hold value differently than commodity vehicles
 *   - Desirable configurations (diesel, manual, 4x4) command massive premiums on older trucks
 *   - Classic/collector status affects pricing curves non-linearly
 *
 * This is used as the FALLBACK source when pricing APIs fail (too old, no coverage, etc.)
 * but also as a VALIDATION source — if the AI estimate differs wildly from API consensus,
 * it signals something may be wrong with the API data.
 *
 * Cost: ~$0.03-0.06 per call (GPT-4o — worth it, this IS the price when APIs fail)
 */

import { validatedAICall, type AIResult, type ValidationResult } from "./validate-and-retry";
import type { SourceEstimate } from "@/lib/pricing-consensus";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MarketValueEstimatorInput {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    engine?: string | null;
    transmission?: string | null;
    drivetrain?: string | null;
    bodyStyle?: string | null;
  };
  mileage?: number;
  conditionScore: number;
  bodyCategory: "truck" | "suv" | "sports" | "sedan" | "other";
  /** Other source estimates if available (for cross-reference) */
  otherSourceValues?: { source: string; value: number }[];
}

export interface MarketValueEstimate {
  estimatedValue: number;
  valueLow: number;
  valueHigh: number;
  tradeInValue: number;
  dealerRetailValue: number;
  wholesaleValue: number;
  confidence: number;
  reasoning: string;
  marketContext: string;
  isEnthusiastPlatform: boolean;
}

/* ------------------------------------------------------------------ */
/*  Core Function                                                      */
/* ------------------------------------------------------------------ */

export async function estimateMarketValue(
  input: MarketValueEstimatorInput,
): Promise<AIResult<MarketValueEstimate>> {
  const { vehicle, mileage, conditionScore, bodyCategory, otherSourceValues } = input;

  const vehicleDesc = [
    `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehicle.trim,
    vehicle.engine,
    vehicle.transmission,
    vehicle.drivetrain,
  ].filter(Boolean).join(", ");

  const otherSourceContext = otherSourceValues?.length
    ? `\nOTHER PRICING SOURCES (for cross-reference):\n${otherSourceValues.map((s) => `  ${s.source}: $${s.value.toLocaleString()}`).join("\n")}`
    : "\nNo other pricing sources available — this is the primary estimate.";

  return validatedAICall<MarketValueEstimate>({
    label: "[MarketValueEstimator]",

    primary: {
      model: "gpt-4o",
      systemPrompt: `You are a vehicle market value expert with deep knowledge of both mainstream and enthusiast vehicle markets. Your job is to estimate the fair private-party market value of a specific vehicle.

CRITICAL: You must consider the FULL vehicle specification, not just year/make/model. Configuration massively affects value:

ENTHUSIAST PLATFORMS (these hold value far above generic curves):
- 7.3L Powerstroke diesels (1994-2003 Ford F-250/F-350): $12K-30K+ depending on condition, manual trans adds 20-40%
- 5.9L/6.7L Cummins (Dodge/Ram 2500/3500): $15K-35K+, manual trans premium
- Duramax diesels (Chevy/GMC 2500/3500): $15K-35K+
- Toyota Land Cruiser (all years): Holds value extremely well, older = collector
- Jeep Wrangler (all years): Minimal depreciation, Rubicon/manual premium
- Ford Bronco (classic and new): Strong enthusiast demand
- Manual transmission trucks (any era): 20-40% premium, increasingly rare
- Performance trims (Raptor, TRX, ZR2, etc.): See dedicated pricing

CONDITION SCORE INTERPRETATION:
- 80-100: Excellent/Very Good — premium pricing
- 65-79: Good — standard market pricing
- 50-64: Fair — moderate discount
- 35-49: Poor — significant discount
- Below 35: Rough/Salvage territory

MILEAGE CONTEXT:
- Diesel trucks: 200K miles is mid-life, not high-mileage. These engines run 400K+
- Sports cars: 100K is high-mileage
- Commuter sedans: 150K is getting old
- If no mileage provided, assume average for the vehicle age/type

Provide your estimate as PRIVATE PARTY value (what a private seller gets, between trade-in and dealer retail).`,
      userPrompt: `Estimate the fair market value for:

VEHICLE: ${vehicleDesc}
CATEGORY: ${bodyCategory}
CONDITION SCORE: ${conditionScore}/100${mileage ? `\nMILEAGE: ${mileage.toLocaleString()} miles` : "\nMILEAGE: Unknown (assume typical for age)"}
${otherSourceContext}

Return a JSON object with:
1. "estimatedValue": Fair private-party value in dollars. This is your best estimate.
2. "valueLow": Conservative estimate (15th percentile — quick sale price)
3. "valueHigh": Optimistic estimate (85th percentile — patient seller, right buyer)
4. "tradeInValue": What a dealer would offer on trade (typically 70-85% of private party)
5. "dealerRetailValue": What a dealer would list it for (typically 115-130% of private party)
6. "wholesaleValue": Auction/wholesale value (typically 65-80% of private party)
7. "confidence": Your confidence in this estimate (0.0-1.0). Higher if you know this market well.
8. "reasoning": 2-3 sentences explaining your valuation. Mention specific factors.
9. "marketContext": 1-2 sentences about current market conditions for this vehicle.
10. "isEnthusiastPlatform": boolean — true if this is a vehicle with enthusiast/collector demand above its generic category.

Return ONLY valid JSON.`,
      temperature: 0.15,
      maxTokens: 800,
    },

    validate: (parsed: unknown): ValidationResult<MarketValueEstimate> => {
      const p = parsed as Record<string, unknown>;
      const errors: string[] = [];

      const ev = Number(p.estimatedValue);
      if (!ev || ev < 500) errors.push(`estimatedValue ${ev} too low`);
      if (ev > 500000) errors.push(`estimatedValue ${ev} implausibly high`);

      const conf = Number(p.confidence);
      if (isNaN(conf)) errors.push("confidence missing");

      if (!p.reasoning || typeof p.reasoning !== "string") errors.push("reasoning missing");

      const low = Number(p.valueLow) || ev * 0.75;
      const high = Number(p.valueHigh) || ev * 1.25;

      if (errors.length > 0) {
        return { valid: false, partial: p, errors };
      }

      return {
        valid: true,
        data: {
          estimatedValue: Math.round(ev),
          valueLow: Math.round(low),
          valueHigh: Math.round(high),
          tradeInValue: Math.round(Number(p.tradeInValue) || ev * 0.80),
          dealerRetailValue: Math.round(Number(p.dealerRetailValue) || ev * 1.20),
          wholesaleValue: Math.round(Number(p.wholesaleValue) || ev * 0.70),
          confidence: Math.max(0, Math.min(1, conf)),
          reasoning: String(p.reasoning),
          marketContext: String(p.marketContext || ""),
          isEnthusiastPlatform: Boolean(p.isEnthusiastPlatform),
        },
      };
    },

    buildFollowUp: (partial, errors) => {
      return `Your response had issues: ${errors.join("; ")}. Please return corrected JSON with all required fields. estimatedValue must be in dollars (not cents). Return ONLY valid JSON.`;
    },

    simplified: {
      model: "gpt-4o",
      buildPrompt: () => {
        return `What is the fair private-party market value of a ${vehicleDesc}${mileage ? ` with ${mileage.toLocaleString()} miles` : ""}, condition ${conditionScore}/100? Consider ALL configuration details — diesel, manual trans, 4WD, enthusiast demand. Return JSON: { "estimatedValue": dollars, "valueLow": dollars, "valueHigh": dollars, "tradeInValue": dollars, "dealerRetailValue": dollars, "wholesaleValue": dollars, "confidence": 0-1, "reasoning": string, "marketContext": string, "isEnthusiastPlatform": boolean }`;
      },
    },

    emergencyFallback: () => {
      // Very last resort — use a rough estimate based on category
      const age = new Date().getFullYear() - vehicle.year;
      const baseCurves: Record<string, number> = {
        truck: age > 25 ? 8000 : age > 15 ? 14000 : age > 10 ? 22000 : 32000,
        suv: age > 25 ? 6000 : age > 15 ? 10000 : age > 10 ? 18000 : 28000,
        sports: age > 25 ? 7000 : age > 15 ? 12000 : age > 10 ? 18000 : 26000,
        sedan: age > 25 ? 3000 : age > 15 ? 5000 : age > 10 ? 10000 : 20000,
        other: age > 25 ? 4000 : age > 15 ? 7000 : age > 10 ? 14000 : 24000,
      };
      const base = baseCurves[bodyCategory] || 5000;
      return {
        estimatedValue: base,
        valueLow: Math.round(base * 0.75),
        valueHigh: Math.round(base * 1.25),
        tradeInValue: Math.round(base * 0.80),
        dealerRetailValue: Math.round(base * 1.20),
        wholesaleValue: Math.round(base * 0.70),
        confidence: 0.15,
        reasoning: "Emergency fallback — no AI or API data available",
        marketContext: "Unable to assess market conditions",
        isEnthusiastPlatform: false,
      };
    },
  });
}

/**
 * Convert an AI market value estimate into a SourceEstimate for the consensus engine.
 */
export function toSourceEstimate(result: MarketValueEstimate): SourceEstimate {
  return {
    source: "fallback",
    estimatedValue: result.estimatedValue,
    tradeInValue: result.tradeInValue,
    dealerRetailValue: result.dealerRetailValue,
    wholesaleValue: result.wholesaleValue,
    loanValue: Math.round(result.tradeInValue * 1.05),
    confidence: Math.min(result.confidence, 0.70), // Cap at 0.70 since it's AI-only, not API-backed
    isConditionTiered: false,
  };
}
