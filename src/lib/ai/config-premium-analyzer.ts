/**
 * AI-Powered Configuration Premium Analysis
 *
 * Replaces hardcoded premium table (Raptor=2.0x, diesel=1.3x, etc.) with
 * contextual AI analysis that considers:
 *   - Current market premiums for this specific trim/config
 *   - Double-counting avoidance (Raptor already includes 4WD)
 *   - MarketCheck comp data as reality check
 *   - Premium compression over time (Raptor premium has shrunk since 2024)
 *
 * Cost: ~$0.03-0.06 per call (GPT-4o, structured output)
 */

import { validatedAICall, type AIResult, type ValidationResult } from "./validate-and-retry";
import { calculateConfigPremiums, type VehicleConfig, type ConfigPremium } from "@/lib/config-premiums";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ConfigPremiumInput {
  vehicle: VehicleConfig;
  bodyCategory: "truck" | "suv" | "sports" | "sedan" | "other";
  baseConsensusValue: number;
  premiumMode: "full" | "partial" | "none";
  nearbyListings?: { title: string; price: number }[];
}

export interface ConfigPremiumResult {
  configMultiplier: number;
  premiums: ConfigPremium[];
  marketContext: string;
  combinedReasoning: string;
}

/* ------------------------------------------------------------------ */
/*  Core Function                                                      */
/* ------------------------------------------------------------------ */

export async function analyzeConfigPremiums(
  input: ConfigPremiumInput,
): Promise<AIResult<ConfigPremiumResult>> {
  const { vehicle, bodyCategory, baseConsensusValue, premiumMode, nearbyListings } = input;

  if (premiumMode === "none") {
    return {
      result: { configMultiplier: 1.0, premiums: [], marketContext: "No premiums needed — source fully accounts for config", combinedReasoning: "Premium mode: none" },
      aiAnalyzed: false,
      fallbackTier: 1,
      retried: false,
      model: "skip",
    };
  }

  const vehicleDesc = [
    `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehicle.trim,
    vehicle.engine,
    vehicle.drivetrain,
    vehicle.transmission,
  ].filter(Boolean).join(", ");

  const listingsContext = nearbyListings?.length
    ? `\nNEARBY COMPARABLE LISTINGS (reality check):\n${nearbyListings.slice(0, 10).map((l, i) => `${i + 1}. "${l.title}" — $${l.price.toLocaleString()}`).join("\n")}`
    : "";

  return validatedAICall<ConfigPremiumResult>({
    label: "[ConfigPremium]",

    primary: {
      model: "gpt-4o",
      systemPrompt: `You are a vehicle configuration pricing specialist. Your job is to determine what premium multiplier should be applied when VIN-based pricing doesn't fully capture a vehicle's actual trim/configuration value.

Key scenarios where premiums are needed:
- Performance trims: Raptor VIN decodes as base F-150, TRX as base Ram 1500
- Diesel engines: Worth 20-40% more than gas equivalents in trucks/SUVs
- Manual transmissions: Increasingly rare and valuable in trucks
- 4WD/4x4: Premium over 2WD in trucks and SUVs

CRITICAL RULES:
1. NEVER double-count. If a trim inherently includes a feature (all Raptors are 4WD), don't stack that premium.
2. Consider CURRENT market conditions. Performance trim premiums fluctuate — Raptor premiums compressed significantly in 2024-2025 as Ford increased production.
3. If comp listings are provided, use them as a sanity check. If comps show Raptors selling for 1.7x base, don't say 2.0x.
4. Premium mode "${premiumMode}" means: ${premiumMode === "full" ? "Apply full premium — base pricing is trim-blind" : "Apply 50% of premium — source partially accounts for trim"}.`,
      userPrompt: `Analyze configuration premiums for:
VEHICLE: ${vehicleDesc}
BODY CATEGORY: ${bodyCategory}
BASE CONSENSUS VALUE: $${baseConsensusValue.toLocaleString()} (from VIN-based pricing — may reflect base model, not actual trim)
PREMIUM MODE: ${premiumMode}
${listingsContext}

Return a JSON object with:
1. "configMultiplier": The combined multiplier to apply to the base value (0.8-3.0). If mode is "partial", you should still return the FULL multiplier — the partial reduction will be applied separately.

2. "premiums": Array of individual premium factors:
   [{ "factor": "Raptor trim", "multiplier": 1.70, "explanation": "..." }]
   Include the multiplier as if applied multiplicatively. If no premiums apply, return an empty array and configMultiplier of 1.0.

3. "marketContext": 1-2 sentences about current market conditions for this configuration.

4. "combinedReasoning": Explanation of the final multiplier, including any double-counting avoided.

Return ONLY valid JSON.`,
      temperature: 0.1,
      maxTokens: 800,
    },

    validate: (parsed: unknown): ValidationResult<ConfigPremiumResult> => {
      const p = parsed as Record<string, unknown>;
      const errors: string[] = [];

      const mult = Number(p.configMultiplier);
      if (!mult || mult < 0.8 || mult > 3.0) {
        errors.push(`configMultiplier ${mult} outside range 0.8-3.0`);
      }

      if (!Array.isArray(p.premiums)) {
        errors.push("premiums must be an array");
      }

      if (!p.combinedReasoning || typeof p.combinedReasoning !== "string") {
        errors.push("combinedReasoning missing");
      }

      if (errors.length > 0) {
        return { valid: false, partial: p, errors };
      }

      // Parse premiums array
      const premiums: ConfigPremium[] = (p.premiums as Record<string, unknown>[])
        .filter((item) => item.factor && item.multiplier)
        .map((item) => ({
          factor: String(item.factor),
          multiplier: Math.max(0.8, Math.min(3.0, Number(item.multiplier) || 1.0)),
          explanation: String(item.explanation || item.reasoning || ""),
        }));

      // Apply partial mode reduction if needed
      let finalMultiplier = Math.max(0.8, Math.min(3.0, mult));
      if (premiumMode === "partial" && finalMultiplier > 1.0) {
        finalMultiplier = 1.0 + (finalMultiplier - 1.0) * 0.5;
      }

      // Cap at 2.5 (same as original)
      finalMultiplier = Math.min(2.5, finalMultiplier);

      return {
        valid: true,
        data: {
          configMultiplier: finalMultiplier,
          premiums,
          marketContext: String(p.marketContext || ""),
          combinedReasoning: String(p.combinedReasoning),
        },
      };
    },

    buildFollowUp: (partial, errors) => {
      return `Your response had issues: ${errors.join("; ")}. Partial data: ${JSON.stringify(partial)}. Please return corrected JSON with: configMultiplier (0.8-3.0), premiums (array), marketContext (string), combinedReasoning (string). JSON only.`;
    },

    simplified: {
      model: "gpt-4o",
      buildPrompt: () => {
        return `A ${vehicleDesc} was priced at $${baseConsensusValue.toLocaleString()} using VIN-based lookup (may reflect base model, not actual trim). What multiplier (0.8-3.0) corrects for the actual trim/config? Consider diesel, manual, 4WD, and performance trim premiums. Don't double-count. Return JSON: { "configMultiplier": number, "premiums": [{ "factor": string, "multiplier": number, "explanation": string }], "marketContext": string, "combinedReasoning": string }`;
      },
    },

    emergencyFallback: () => {
      const heuristic = calculateConfigPremiums(vehicle, premiumMode);
      return {
        configMultiplier: heuristic.combinedMultiplier,
        premiums: heuristic.premiums,
        marketContext: "Emergency fallback — used hardcoded premium table",
        combinedReasoning: "Emergency fallback — AI unavailable",
      };
    },
  });
}
