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
      systemPrompt: `You are a vehicle market specialist. Your job is to determine how much MORE (or less) this specific vehicle configuration is worth compared to the base model — based on what BUYERS IN THIS MARKET actually pay more for.

This is NOT about generic feature multipliers. Different buyer pools value different things:

MARKET-AWARE THINKING — EXAMPLES:
- 1996 F-250, 7.3L Powerstroke, manual, 4WD vs base (5.8L gas, auto, 2WD):
  The Powerstroke diesel is the ENTIRE reason people buy old F-250s. Manual + 4WD is the enthusiast trifecta. Premium: 2.0-2.5x over base.

- 2020 Subaru WRX STI vs base Impreza:
  The STI IS the performance model. Turbo + AWD + manual is its identity, not optional features. Premium: 1.8-2.2x over base Impreza.

- 2019 Honda CR-V AWD vs FWD:
  AWD on a CR-V adds maybe $1,500-2,000. It's a checkbox option, not an identity. Premium: 1.05-1.08x.

- 2022 Jeep Wrangler Rubicon vs Sport:
  Rubicon has lockers, disconnecting sway bar, etc. BUT all Wranglers have 4WD — no separate 4WD premium. The Rubicon package IS the premium. Premium: 1.30-1.40x over Sport.

- 2018 Toyota Camry V6 vs 4-cylinder:
  Slight premium for V6 but Camry buyers aren't enthusiasts. Premium: 1.05-1.10x.

- 2021 BMW M3 manual vs auto:
  Manual M3 is RARER and commands a collector premium. The M3 itself is already the performance variant of the 3-series. Manual adds 1.10-1.15x.

- Ford Raptor vs base F-150:
  Performance off-road truck. VIN often decodes as base F-150. Raptor premium has compressed in 2024-2025 as Ford increased production. Premium: 1.50-1.70x currently (down from 2.0x).

- Ram TRX vs base Ram 1500:
  Supercharged Hellcat truck. Significant premium but being discontinued. Premium: 1.60-1.80x.

KEY PRINCIPLES:
1. What does the BUYER POOL for THIS vehicle actually care about?
2. Is this feature STANDARD for the model (no premium) or OPTIONAL/RARE (premium)?
3. Is this feature the vehicle's IDENTITY (Powerstroke = diesel truck) or a checkbox (CR-V AWD)?
4. For older vehicles (15+ years), rare configurations become MORE valuable, not less.
5. Use comp data as a reality check if available.
6. NEVER double-count — if a trim inherently includes 4WD (Wrangler, Raptor), don't add 4WD separately.
7. Consider the specific MODEL YEAR — a 2024 Raptor has less premium than a 2021 because Ford made more of them.

PREMIUM MODE: "${premiumMode}" means: ${premiumMode === "full" ? "The base value is TRIM-BLIND (e.g., base model estimate). Apply the full configuration premium." : "The base value PARTIALLY accounts for trim. Apply 50% of the premium."}.`,
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
