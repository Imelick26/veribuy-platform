/**
 * AI-Powered Market Intelligence Analyzer
 *
 * Replaces the deterministic market adjustment (±25% cap on comp average)
 * with an AI that sees the full picture: BB tier values, comp data,
 * sold statistics, market supply/demand, and vehicle type context.
 *
 * Catches what simple math can't:
 *   - Cummins/Powerstroke/Wrangler enthusiast premiums
 *   - Rapidly depreciating segments (EVs, certain luxury brands)
 *   - Regional demand patterns the comps reveal
 *   - Low-comp situations where trusting BB blindly is risky
 *
 * Cost: ~$0.04-0.08 per call (GPT-4o, structured output)
 */

import { validatedAICall, type AIResult, type ValidationResult } from "./validate-and-retry";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MarketIntelligenceInput {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    engine?: string | null;
    drivetrain?: string | null;
    transmission?: string | null;
  };
  bodyCategory: "truck" | "suv" | "sports" | "sedan" | "other";
  mileage?: number;
  region: string; // state abbreviation

  /** BB interpolated retail for this vehicle's condition (dollars) */
  bbInterpolatedRetail: number;
  /** All BB retail tier values (dollars) for reference */
  bbRetailByTier: { extra_clean: number; clean: number; average: number; rough: number };
  /** Condition score and tier */
  conditionScore: number;
  conditionTier: string;

  /** Comparable listings (active) */
  activeComps: Array<{
    price: number;
    mileage: number;
    daysOnMarket: number;
    series?: string;
    certified?: boolean;
    distanceToDealer?: number;
  }>;

  /** Active market statistics from BB */
  activeStats: {
    count: number;
    meanPrice: number;
    medianPrice: number;
    meanMileage: number;
    medianMileage: number;
  } | null;

  /** Sold market statistics from BB */
  soldStats: {
    count: number;
    meanPrice: number;
    medianPrice: number;
    meanMileage: number;
    medianMileage: number;
    meanDaysToTurn: number;
    marketDaysSupply: number;
  } | null;
}

export interface MarketIntelligenceResult {
  /** Market adjustment multiplier (typically 0.75–1.30) */
  marketAdjustment: number;
  /** AI's adjusted retail estimate in dollars */
  adjustedRetailEstimate: number;
  /** "strong" = <30 day supply or high sold/active ratio, "weak" = >60 day supply, "normal" = between */
  demandSignal: "strong" | "normal" | "weak";
  /** Human-readable reasoning */
  reasoning: string;
  /** Specific flags for the dealer */
  flags: string[];
  /** 0.0-1.0 — how confident is the AI in its adjustment */
  confidence: number;
}

/* ------------------------------------------------------------------ */
/*  Core Function                                                      */
/* ------------------------------------------------------------------ */

export async function analyzeMarketIntelligence(
  input: MarketIntelligenceInput,
): Promise<AIResult<MarketIntelligenceResult>> {
  const { vehicle, mileage, bbInterpolatedRetail } = input;
  const vehicleDesc = [
    `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehicle.trim, vehicle.engine, vehicle.transmission, vehicle.drivetrain,
  ].filter(Boolean).join(", ");

  // Build comp summary
  const activeCompsSummary = input.activeComps.length > 0
    ? input.activeComps.slice(0, 15).map((c, i) =>
      `  ${i + 1}. $${c.price.toLocaleString()} | ${c.mileage.toLocaleString()} mi | ${c.daysOnMarket} DOM${c.certified ? " | CPO" : ""}${c.distanceToDealer ? ` | ${Math.round(c.distanceToDealer)} mi away` : ""}`
    ).join("\n")
    : "  None available";

  const activeStatsStr = input.activeStats
    ? `Active: ${input.activeStats.count} listings, mean $${input.activeStats.meanPrice.toLocaleString()}, median $${input.activeStats.medianPrice.toLocaleString()}, mean mileage ${input.activeStats.meanMileage.toLocaleString()}`
    : "Active stats: unavailable";

  const soldStatsStr = input.soldStats
    ? `Sold: ${input.soldStats.count} in window, mean $${input.soldStats.meanPrice.toLocaleString()}, median $${input.soldStats.medianPrice.toLocaleString()}, mean mileage ${input.soldStats.meanMileage.toLocaleString()}, avg ${input.soldStats.meanDaysToTurn.toFixed(0)} days to turn, ${input.soldStats.marketDaysSupply.toFixed(0)}-day market supply`
    : "Sold stats: unavailable";

  const tierStr = `Rough: $${input.bbRetailByTier.rough.toLocaleString()} | Avg: $${input.bbRetailByTier.average.toLocaleString()} | Clean: $${input.bbRetailByTier.clean.toLocaleString()} | Extra Clean: $${input.bbRetailByTier.extra_clean.toLocaleString()}`;

  return validatedAICall<MarketIntelligenceResult>({
    label: "[MarketIntelligence]",

    primary: {
      model: "gpt-4o",
      systemPrompt: `You are a vehicle market intelligence analyst. Your job is to evaluate whether Black Book's retail value accurately reflects the real market for a specific vehicle, using comparable listing data and market statistics.

BLACK BOOK CONTEXT:
- BB provides retail values by condition tier (rough/average/clean/extra_clean)
- BB values are already adjusted for mileage and region
- The interpolated value is calculated between tier boundaries based on the inspection condition score
- BB is generally accurate for mainstream vehicles but can lag or miss:
  * Enthusiast/specialty demand (diesel trucks, manual sports cars, Wranglers, Land Cruisers)
  * Rapid market shifts (EVs, post-recall vehicles, viral TikTok vehicles)
  * Hyper-local demand patterns
  * Low-production or special edition models

MARKET DATA YOU RECEIVE:
- Active listings: what dealers are currently asking
- Sold statistics: what actually transacted (more reliable than active)
- Market days supply: <30 = strong demand, 30-60 = balanced, >60 = oversupplied
- Mean days to turn: how quickly vehicles sell in this segment

YOUR JOB:
1. Compare BB interpolated retail to what the market data shows
2. Determine if BB is accurate, low, or high for this specific vehicle
3. Output a market adjustment multiplier
4. Flag anything the dealer should know

RULES:
- Multiplier between 0.75 and 1.30 (±25-30% max)
- Use SOLD data as primary validation when available (sold = reality, active = aspiration)
- If few comps (<5) or no sold data, lean toward trusting BB (multiplier near 1.0) but flag the uncertainty
- For enthusiast platforms, comps matter MORE than BB — diesel trucks, Wranglers, manual sports cars trade at premiums BB often undervalues
- Don't adjust just because comps are slightly different — only adjust for meaningful divergence (>10%)
- High days-on-market across comps suggests the market is softer than prices indicate

RETURN JSON ONLY.`,
      userPrompt: `VEHICLE: ${vehicleDesc}${mileage ? ` | ${mileage.toLocaleString()} miles` : ""}
Category: ${input.bodyCategory} | Region: ${input.region}
Condition: ${input.conditionScore}/100 (${input.conditionTier} tier)

BB RETAIL TIERS: ${tierStr}
BB INTERPOLATED RETAIL (this vehicle's condition): $${bbInterpolatedRetail.toLocaleString()}

MARKET STATISTICS:
${activeStatsStr}
${soldStatsStr}

ACTIVE COMPARABLE LISTINGS:
${activeCompsSummary}

Return JSON:
{
  "marketAdjustment": number (0.75-1.30, multiplier on BB interpolated retail),
  "adjustedRetailEstimate": number (BB interpolated retail × your adjustment, in whole dollars),
  "demandSignal": "strong" | "normal" | "weak",
  "reasoning": "2-4 sentences. Compare BB value to market data. Explain your adjustment or lack thereof. Note any enthusiast/specialty factors.",
  "flags": ["specific alerts for the dealer — empty array if none"],
  "confidence": number (0.0-1.0, how sure are you in this assessment)
}`,
      temperature: 0.1,
      maxTokens: 600,
    },

    validate: (parsed: unknown): ValidationResult<MarketIntelligenceResult> => {
      const p = parsed as Record<string, unknown>;
      const errors: string[] = [];

      const adj = Number(p.marketAdjustment);
      if (isNaN(adj) || adj < 0.50 || adj > 1.50) {
        errors.push("marketAdjustment must be 0.50-1.50");
      }

      const est = Number(p.adjustedRetailEstimate);
      if (isNaN(est) || est <= 0) {
        errors.push("adjustedRetailEstimate must be positive");
      }

      const demand = String(p.demandSignal);
      if (!["strong", "normal", "weak"].includes(demand)) {
        errors.push("demandSignal must be strong, normal, or weak");
      }

      if (!p.reasoning || typeof p.reasoning !== "string") {
        errors.push("reasoning missing");
      }

      const conf = Number(p.confidence);
      if (isNaN(conf) || conf < 0 || conf > 1) {
        errors.push("confidence must be 0.0-1.0");
      }

      if (errors.length > 0) {
        return { valid: false, partial: p, errors };
      }

      // Clamp the adjustment to safe range
      const clampedAdj = Math.max(0.75, Math.min(1.30, adj));

      return {
        valid: true,
        data: {
          marketAdjustment: clampedAdj,
          adjustedRetailEstimate: Math.round(est),
          demandSignal: demand as "strong" | "normal" | "weak",
          reasoning: String(p.reasoning),
          flags: Array.isArray(p.flags) ? (p.flags as string[]).map(String) : [],
          confidence: Math.max(0, Math.min(1, conf)),
        },
      };
    },

    buildFollowUp: (partial, errors) => {
      return `Your response had issues: ${errors.join("; ")}. Return corrected JSON: { "marketAdjustment": number (0.75-1.30), "adjustedRetailEstimate": number (dollars), "demandSignal": "strong"|"normal"|"weak", "reasoning": string, "flags": string[], "confidence": 0-1 }. JSON only.`;
    },

    simplified: {
      model: "gpt-4o",
      buildPrompt: () => {
        const compPrices = input.activeComps.filter(c => c.price > 0).map(c => c.price);
        const avgComp = compPrices.length > 0 ? Math.round(compPrices.reduce((a, b) => a + b, 0) / compPrices.length) : 0;
        return `Quick market check: ${vehicleDesc}${mileage ? ` at ${mileage.toLocaleString()} mi` : ""}. BB retail: $${bbInterpolatedRetail.toLocaleString()}. ${compPrices.length} comps avg $${avgComp.toLocaleString()}. ${input.soldStats ? `${input.soldStats.count} sold, median $${input.soldStats.medianPrice.toLocaleString()}, ${input.soldStats.marketDaysSupply.toFixed(0)}-day supply.` : "No sold data."} Is BB accurate? Return JSON: { "marketAdjustment": number (0.75-1.30), "adjustedRetailEstimate": number (dollars), "demandSignal": "strong"|"normal"|"weak", "reasoning": string, "flags": string[], "confidence": 0-1 }`;
      },
    },

    emergencyFallback: () => {
      // If AI fails, trust BB (no adjustment)
      return {
        marketAdjustment: 1.0,
        adjustedRetailEstimate: bbInterpolatedRetail,
        demandSignal: "normal" as const,
        reasoning: "Market intelligence AI unavailable — using BB retail as-is",
        flags: ["Market intelligence unavailable — BB retail used without validation"],
        confidence: 0.5,
      };
    },
  });
}
