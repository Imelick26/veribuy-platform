/**
 * AI-Powered Regional Pricing Analysis
 *
 * Replaces static state-level lookup table with contextual AI analysis
 * that considers:
 *   - Urban vs rural dynamics within the same state
 *   - Local demand patterns for this vehicle category
 *   - Seasonal and market-condition adjustments
 *   - ZIP-level granularity instead of state-level
 *
 * Cost: ~$0.01-0.03 per call (GPT-4o-mini primary, GPT-4o fallback)
 */

import { validatedAICall, type AIResult, type ValidationResult } from "./validate-and-retry";
import { getRegionalMultiplier, zipToState } from "@/lib/geo-pricing";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GeoPricingInput {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
  };
  bodyCategory: "truck" | "suv" | "sports" | "sedan" | "other";
  zip: string;
  state: string;
  baseValue: number;
  nearbyListingPrices?: number[];
}

export interface GeoPricingResult {
  regionalMultiplier: number;
  marketDynamics: string;
  reasoning: string;
}

/* ------------------------------------------------------------------ */
/*  Core Function                                                      */
/* ------------------------------------------------------------------ */

export async function analyzeRegionalPricing(
  input: GeoPricingInput,
): Promise<AIResult<GeoPricingResult>> {
  const { vehicle, bodyCategory, zip, state, baseValue, nearbyListingPrices } = input;

  const vehicleDesc = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;

  const listingContext = nearbyListingPrices?.length
    ? `\nNearby listings (${nearbyListingPrices.length} found): avg $${Math.round(nearbyListingPrices.reduce((s, p) => s + p, 0) / nearbyListingPrices.length).toLocaleString()}, range $${Math.min(...nearbyListingPrices).toLocaleString()}-$${Math.max(...nearbyListingPrices).toLocaleString()}`
    : "";

  return validatedAICall<GeoPricingResult>({
    label: "[GeoPricing]",

    primary: {
      model: "gpt-4o-mini",
      systemPrompt: `You are a regional vehicle market analyst. Determine what pricing adjustment should be applied for a specific vehicle type in a specific location.

Key regional pricing dynamics:
- Trucks: Higher premiums in Texas, Oklahoma, rural South, mountain states. Lower in urban Northeast.
- SUVs/4WD: Premium in snowy/mountainous regions (Colorado, Utah, Montana, New England).
- Sedans/EVs: Premium in urban coastal markets (CA, NY, NJ, MA, DC).
- Sports cars: Premium in warm-weather states (CA, FL, AZ, TX).
- Urban vs rural WITHIN a state matters significantly.

Your multiplier should reflect how much more/less this vehicle category is worth in this specific location compared to the national average.`,
      userPrompt: `What regional price adjustment for this vehicle?

VEHICLE: ${vehicleDesc}
CATEGORY: ${bodyCategory}
LOCATION: ZIP ${zip}, ${state}
BASE VALUE: $${baseValue.toLocaleString()} (national average)${listingContext}

Return JSON:
{
  "regionalMultiplier": number (0.85-1.20, where 1.0 = national average),
  "marketDynamics": "1-2 sentences about this market for this vehicle type",
  "reasoning": "Brief explanation of the multiplier"
}`,
      temperature: 0.1,
      maxTokens: 400,
    },

    validate: (parsed: unknown): ValidationResult<GeoPricingResult> => {
      const p = parsed as Record<string, unknown>;
      const errors: string[] = [];

      const mult = Number(p.regionalMultiplier);
      if (!mult || mult < 0.85 || mult > 1.20) {
        errors.push(`regionalMultiplier ${mult} outside range 0.85-1.20`);
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
          regionalMultiplier: Math.max(0.85, Math.min(1.20, mult)),
          marketDynamics: String(p.marketDynamics || ""),
          reasoning: String(p.reasoning),
        },
      };
    },

    buildFollowUp: (partial, errors) => {
      return `Your response had issues: ${errors.join("; ")}. Please return JSON with: regionalMultiplier (0.85-1.20), marketDynamics (string), reasoning (string). JSON only.`;
    },

    simplified: {
      model: "gpt-4o",
      buildPrompt: () => {
        return `What regional price adjustment for a ${bodyCategory} vehicle (${vehicleDesc}) in ${state} (ZIP ${zip})? Return JSON: { "regionalMultiplier": number (0.85-1.20, where 1.0=national avg), "marketDynamics": string, "reasoning": string }`;
      },
    },

    emergencyFallback: () => {
      const heuristicMult = getRegionalMultiplier(state, bodyCategory);
      return {
        regionalMultiplier: heuristicMult,
        marketDynamics: "Emergency fallback — used state-level lookup table",
        reasoning: `Emergency fallback: ${state} ${bodyCategory} → ${heuristicMult}x`,
      };
    },
  });
}
