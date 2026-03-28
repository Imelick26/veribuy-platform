/**
 * AI-Powered Deal Rating Analysis
 *
 * Replaces fixed price bands (≤85% = STRONG_BUY, ≤95% = FAIR_BUY, etc.)
 * and static deal-breaker rules with contextual AI analysis that considers:
 *   - Market velocity (is this vehicle type selling fast or sitting?)
 *   - Configuration desirability (diesel 4WD truck = always in demand)
 *   - Condition + history interplay (minor cosmetic issues on a solid truck = still buyable)
 *   - Reconditioning ROI (cheap fixes on an underpriced vehicle = great deal)
 *
 * Cost: ~$0.01-0.03 per call (GPT-4o-mini primary, GPT-4o fallback)
 */

import { validatedAICall, type AIResult, type ValidationResult } from "./validate-and-retry";
import type { BuyRecommendation } from "@/lib/market-valuation";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DealRaterInput {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
  };
  fairPurchasePrice: number;
  baseMarketValue: number;
  retailValue: number;
  conditionScore: number;
  historyMultiplier: number;
  historySummary: string;
  reconCostCents: number;
  mileage?: number;
  nearbyListingCount?: number;
  avgDaysOnMarket?: number;
}

export interface DealRaterResult {
  rating: BuyRecommendation;
  confidence: number;
  priceBands: {
    strongBuyMax: number;
    fairBuyMax: number;
    overpayingMax: number;
  };
  dealBreakers: string[];
  positives: string[];
  concerns: string[];
  reasoning: string;
}

/* ------------------------------------------------------------------ */
/*  Core Function                                                      */
/* ------------------------------------------------------------------ */

export async function rateDeal(
  input: DealRaterInput,
): Promise<AIResult<DealRaterResult>> {
  const { vehicle, fairPurchasePrice, baseMarketValue, retailValue, conditionScore, historyMultiplier, historySummary, reconCostCents, mileage, nearbyListingCount, avgDaysOnMarket } = input;

  const vehicleDesc = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;
  const fairPriceDollars = Math.round(fairPurchasePrice / 100);
  const baseDollars = Math.round(baseMarketValue / 100);
  const retailDollars = Math.round(retailValue / 100);
  const reconDollars = Math.round(reconCostCents / 100);

  return validatedAICall<DealRaterResult>({
    label: "[DealRater]",

    primary: {
      model: "gpt-4o-mini",
      systemPrompt: `You are a vehicle deal evaluation specialist. Rate deals for vehicle buyers/dealers and set appropriate price bands.

Deal rating tiers:
- STRONG_BUY: Exceptional value — significant upside after recon, strong demand vehicle
- FAIR_BUY: Good value — reasonable price, acceptable risk
- OVERPAYING: Above market — thin or no margin, may still be acceptable for specific needs
- PASS: Walk away — deal-breakers present, excessive price, or unacceptable risk

ENTHUSIAST PLATFORMS (high demand, sell fast):
- Diesel trucks (Powerstroke, Cummins, Duramax): Always in demand, especially manual trans + 4WD
- Toyota Land Cruiser: Cult following, minimal depreciation
- Jeep Wrangler: Strong resale regardless of age
- Manual transmission trucks: Increasingly rare, premium pricing
- 200K miles on a diesel is MID-LIFE, not high-mileage

Consider:
1. Price relative to fair market value and retail potential
2. Reconditioning cost as % of purchase — cheap fixes = opportunity
3. Market velocity — high demand vehicles sell faster, enthusiast platforms especially
4. Condition + history interplay — a high-condition rebuilt truck is different from low-condition rebuilt sedan
5. Deal-breakers: flood damage is almost always PASS. Salvage title requires very low price. Condition <35 is typically PASS.

Set price bands as FULL DOLLAR AMOUNTS (e.g., 8500 = $8,500, NOT 8.5).`,
      userPrompt: `Rate this deal:

VEHICLE: ${vehicleDesc}${mileage ? ` at ${mileage.toLocaleString()} miles` : ""}
FAIR PURCHASE PRICE: $${fairPriceDollars.toLocaleString()} (computed from market data + adjustments)
BASE MARKET VALUE: $${baseDollars.toLocaleString()} (consensus market value)
ESTIMATED RETAIL: $${retailDollars.toLocaleString()} (what buyer could sell for)
CONDITION SCORE: ${conditionScore}/100
HISTORY MULTIPLIER: ${historyMultiplier.toFixed(3)} (1.0 = clean, lower = more issues)
HISTORY SUMMARY: ${historySummary}
RECON COST: $${reconDollars.toLocaleString()}${nearbyListingCount ? `\nNEARBY COMPS: ${nearbyListingCount} found` : ""}${avgDaysOnMarket ? `\nAVG DAYS ON MARKET: ${avgDaysOnMarket}` : ""}

Return JSON:
{
  "rating": "STRONG_BUY" | "FAIR_BUY" | "OVERPAYING" | "PASS",
  "confidence": number (0.0-1.0),
  "priceBands": {
    "strongBuyMax": number (full dollar amount, e.g., 8500 means $8,500 — NOT 8.5 or 8500.00),
    "fairBuyMax": number (full dollar amount, must be HIGHER than strongBuyMax),
    "overpayingMax": number (full dollar amount, must be HIGHER than fairBuyMax)
  },
  "dealBreakers": ["list of any deal-breaking issues"],
  "positives": ["list of positive factors"],
  "concerns": ["list of concerns"],
  "reasoning": "2-3 sentences explaining the rating"
}

IMPORTANT: Price bands must be full dollar amounts. For a $10,500 fair price, strongBuyMax might be $8,925 (85%), fairBuyMax $9,975 (95%), overpayingMax $11,025 (105%). Never return single-digit or double-digit prices.`,
      temperature: 0.1,
      maxTokens: 800,
    },

    validate: (parsed: unknown): ValidationResult<DealRaterResult> => {
      const p = parsed as Record<string, unknown>;
      const errors: string[] = [];

      const validRatings: BuyRecommendation[] = ["STRONG_BUY", "FAIR_BUY", "OVERPAYING", "PASS"];
      if (!validRatings.includes(p.rating as BuyRecommendation)) {
        errors.push(`rating "${p.rating}" not one of ${validRatings.join(", ")}`);
      }

      const conf = Number(p.confidence);
      if (isNaN(conf) || conf < 0 || conf > 1) {
        errors.push("confidence must be 0.0-1.0");
      }

      const bands = p.priceBands as Record<string, number> | undefined;
      if (!bands || typeof bands !== "object") {
        errors.push("priceBands missing");
      } else {
        const sb = Number(bands.strongBuyMax);
        const fb = Number(bands.fairBuyMax);
        const op = Number(bands.overpayingMax);
        if (!sb || !fb || !op) {
          errors.push("priceBands values missing");
        } else if (sb >= fb || fb >= op) {
          errors.push("priceBands must be in ascending order: strongBuyMax < fairBuyMax < overpayingMax");
        }
      }

      if (!p.reasoning || typeof p.reasoning !== "string") {
        errors.push("reasoning missing");
      }

      if (errors.length > 0) {
        return { valid: false, partial: p, errors };
      }

      // Convert price bands to cents — detect if AI returned wrong scale
      let sbRaw = Number(bands!.strongBuyMax);
      let fbRaw = Number(bands!.fairBuyMax);
      let opRaw = Number(bands!.overpayingMax);

      // If all bands are < 100, AI likely returned thousands (e.g., 9 = $9K)
      if (sbRaw < 100 && fbRaw < 100 && opRaw < 100) {
        sbRaw *= 1000;
        fbRaw *= 1000;
        opRaw *= 1000;
      }

      const sbMax = Math.round(sbRaw * 100);
      const fbMax = Math.round(fbRaw * 100);
      const opMax = Math.round(opRaw * 100);

      return {
        valid: true,
        data: {
          rating: p.rating as BuyRecommendation,
          confidence: Math.max(0, Math.min(1, conf)),
          priceBands: {
            strongBuyMax: sbMax,
            fairBuyMax: fbMax,
            overpayingMax: opMax,
          },
          dealBreakers: Array.isArray(p.dealBreakers) ? (p.dealBreakers as string[]).map(String) : [],
          positives: Array.isArray(p.positives) ? (p.positives as string[]).map(String) : [],
          concerns: Array.isArray(p.concerns) ? (p.concerns as string[]).map(String) : [],
          reasoning: String(p.reasoning),
        },
      };
    },

    buildFollowUp: (partial, errors) => {
      return `Your response had issues: ${errors.join("; ")}. Return corrected JSON with: rating (STRONG_BUY|FAIR_BUY|OVERPAYING|PASS), confidence (0-1), priceBands ({ strongBuyMax, fairBuyMax, overpayingMax } in dollars, ascending), dealBreakers, positives, concerns (arrays), reasoning (string). JSON only.`;
    },

    simplified: {
      model: "gpt-4o",
      buildPrompt: () => {
        return `Rate this deal: ${vehicleDesc} at $${fairPriceDollars.toLocaleString()}, market value $${baseDollars.toLocaleString()}, condition ${conditionScore}/100, history ${historyMultiplier.toFixed(2)}x, ~$${reconDollars.toLocaleString()} in repairs. Return JSON: { "rating": "STRONG_BUY"|"FAIR_BUY"|"OVERPAYING"|"PASS", "confidence": number, "priceBands": { "strongBuyMax": dollars, "fairBuyMax": dollars, "overpayingMax": dollars }, "dealBreakers": [], "positives": [], "concerns": [], "reasoning": string }`;
      },
    },

    emergencyFallback: () => {
      // Use fixed bands as emergency fallback
      const strongBuyMax = Math.round(fairPurchasePrice * 0.85);
      const fairBuyMax = Math.round(fairPurchasePrice * 0.95);
      const overpayingMax = Math.round(fairPurchasePrice * 1.05);

      const hasDealBreaker = conditionScore < 40 || historyMultiplier < 0.50;
      const rating: BuyRecommendation = hasDealBreaker ? "PASS" : "FAIR_BUY";

      return {
        rating,
        confidence: 0.5,
        priceBands: { strongBuyMax, fairBuyMax, overpayingMax },
        dealBreakers: hasDealBreaker ? ["Emergency fallback — potential deal-breaker detected"] : [],
        positives: [],
        concerns: ["Emergency fallback — AI rating unavailable"],
        reasoning: "Emergency fallback — used fixed price bands",
      };
    },
  });
}
