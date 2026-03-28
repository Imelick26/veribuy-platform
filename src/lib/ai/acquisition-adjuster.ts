/**
 * AI-Powered Acquisition Cost Adjustment
 *
 * Comps come from dealer listings (retail markup) and auctions (wholesale/damaged).
 * Neither reflects what a dealer should PAY to acquire a vehicle from a private seller.
 *
 * This module adjusts comp-derived values to reflect true acquisition cost:
 *   - Dealer retail listings → strip markup (typically 15-25% over acquisition)
 *   - Auction prices → adjust up for clean-title vehicles (auction = salvage-heavy)
 *   - Private party comps → closest to acquisition, minor adjustment
 *   - Factor in vehicle desirability (hot vehicles = tighter margins)
 *
 * Cost: ~$0.01-0.03 per call (GPT-4o-mini primary, GPT-4o fallback)
 */

import { validatedAICall, type AIResult, type ValidationResult } from "./validate-and-retry";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AcquisitionAdjusterInput {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    engine?: string | null;
    transmission?: string | null;
    drivetrain?: string | null;
  };
  /** Consensus market value in dollars (mix of retail + auction comps) */
  consensusValue: number;
  /** Comparable listings used to derive the consensus */
  comps: {
    title: string;
    price: number;
    source: string; // Contains "Sold", "Auction", "Dealer", etc.
  }[];
  /** How many comps came from each source type */
  compBreakdown: {
    activeDealer: number;
    soldDealer: number;
    auction: number;
    total: number;
  };
  bodyCategory: "truck" | "suv" | "sports" | "sedan" | "other";
  conditionScore: number;
  isEnthusiastPlatform: boolean;
}

export interface AcquisitionAdjusterResult {
  /** Acquisition multiplier to apply to consensus value (typically 0.70-0.95) */
  acquisitionMultiplier: number;
  /** Estimated acquisition cost in dollars */
  acquisitionCost: number;
  /** Estimated dealer retail after reconditioning */
  estimatedRetail: number;
  /** Expected margin percentage */
  expectedMarginPercent: number;
  reasoning: string;
}

/* ------------------------------------------------------------------ */
/*  Core Function                                                      */
/* ------------------------------------------------------------------ */

export async function analyzeAcquisitionCost(
  input: AcquisitionAdjusterInput,
): Promise<AIResult<AcquisitionAdjusterResult>> {
  const { vehicle, consensusValue, comps, compBreakdown, bodyCategory, conditionScore, isEnthusiastPlatform } = input;

  const vehicleDesc = [
    `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehicle.trim, vehicle.engine, vehicle.transmission, vehicle.drivetrain,
  ].filter(Boolean).join(", ");

  const compSummary = comps.slice(0, 8).map((c) => `${c.title}: $${c.price.toLocaleString()} (${c.source})`).join("\n");

  return validatedAICall<AcquisitionAdjusterResult>({
    label: "[AcquisitionAdjuster]",

    primary: {
      model: "gpt-4o-mini",
      systemPrompt: `You are a dealer acquisition cost specialist. Your job is to determine what a dealer should PAY to acquire a vehicle, given market comp data.

The comps come from multiple sources with different biases:
- DEALER RETAIL LISTINGS: Marked up 15-25% over acquisition. A $20K listing means the dealer paid ~$16-17K.
- SOLD DEALER LISTINGS: Similar to retail but confirmed sold. Still includes dealer markup.
- AUCTION PRICES (Copart/IAAI): Wholesale prices, often for damaged/salvage vehicles. Clean-title vehicles at auction sell for MORE than these prices suggest.
- AI ESTIMATES: Already account for condition but may not strip dealer markup.

Key acquisition cost factors:
- Hot/enthusiast vehicles (Powerstroke, Cummins, Wrangler, Land Cruiser): Tighter margins. Dealers pay 85-95% of retail because demand is strong and inventory is scarce.
- Commodity vehicles (Camry, Civic, mainstream sedans): Standard margins. Dealers pay 70-80% of retail.
- Luxury vehicles: Wider margins but slower turns. Dealers pay 75-85% of retail.
- Condition matters: Higher condition = closer to retail. Rough condition = bigger discount.
- Older vehicles: Typically tighter margins because the buyer pool is smaller and more knowledgeable.

Your multiplier should reflect: what % of the consensus value should a dealer pay to acquire this vehicle from a private seller?`,
      userPrompt: `What should a dealer pay to acquire this vehicle?

VEHICLE: ${vehicleDesc}
CATEGORY: ${bodyCategory}
CONDITION: ${conditionScore}/100
ENTHUSIAST PLATFORM: ${isEnthusiastPlatform ? "YES — high demand, scarce inventory" : "No"}
CONSENSUS MARKET VALUE: $${consensusValue.toLocaleString()}

COMP BREAKDOWN: ${compBreakdown.activeDealer} active dealer, ${compBreakdown.soldDealer} sold dealer, ${compBreakdown.auction} auction (${compBreakdown.total} total)

COMPARABLE DATA:
${compSummary}

Return JSON:
{
  "acquisitionMultiplier": number (0.60-0.95, what fraction of consensus value to pay),
  "acquisitionCost": number (dollars — consensus × multiplier),
  "estimatedRetail": number (dollars — what dealer can list it for after recon),
  "expectedMarginPercent": number (0.0-0.40 — expected gross margin as decimal),
  "reasoning": "2-3 sentences explaining the acquisition strategy for this vehicle"
}`,
      temperature: 0.1,
      maxTokens: 500,
    },

    validate: (parsed: unknown): ValidationResult<AcquisitionAdjusterResult> => {
      const p = parsed as Record<string, unknown>;
      const errors: string[] = [];

      const mult = Number(p.acquisitionMultiplier);
      if (!mult || mult < 0.60 || mult > 0.95) {
        errors.push(`acquisitionMultiplier ${mult} outside range 0.60-0.95`);
      }

      const acqCost = Number(p.acquisitionCost);
      if (!acqCost || acqCost < 100) {
        errors.push("acquisitionCost missing or too low");
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
          acquisitionMultiplier: Math.max(0.60, Math.min(0.95, mult)),
          acquisitionCost: Math.round(acqCost),
          estimatedRetail: Math.round(Number(p.estimatedRetail) || acqCost * 1.20),
          expectedMarginPercent: Math.max(0, Math.min(0.40, Number(p.expectedMarginPercent) || 0.15)),
          reasoning: String(p.reasoning),
        },
      };
    },

    buildFollowUp: (partial, errors) => {
      return `Your response had issues: ${errors.join("; ")}. Return JSON with acquisitionMultiplier (0.60-0.95), acquisitionCost (dollars), estimatedRetail (dollars), expectedMarginPercent (0-0.40), reasoning (string). JSON only.`;
    },

    simplified: {
      model: "gpt-4o",
      buildPrompt: () => {
        return `A ${vehicleDesc} (${bodyCategory}, condition ${conditionScore}/100${isEnthusiastPlatform ? ", enthusiast platform" : ""}) has a consensus market value of $${consensusValue.toLocaleString()} based on ${compBreakdown.total} comps (${compBreakdown.activeDealer} dealer, ${compBreakdown.auction} auction). What should a dealer pay to acquire it? Return JSON: { "acquisitionMultiplier": 0.60-0.95, "acquisitionCost": dollars, "estimatedRetail": dollars, "expectedMarginPercent": 0-0.40, "reasoning": string }`;
      },
    },

    emergencyFallback: () => {
      // Simple heuristic: enthusiast = 88%, standard = 78%
      const mult = isEnthusiastPlatform ? 0.88 : 0.78;
      const acqCost = Math.round(consensusValue * mult);
      return {
        acquisitionMultiplier: mult,
        acquisitionCost: acqCost,
        estimatedRetail: Math.round(consensusValue * 1.15),
        expectedMarginPercent: isEnthusiastPlatform ? 0.12 : 0.22,
        reasoning: "Emergency fallback — standard acquisition multiplier applied",
      };
    },
  });
}
