/**
 * AI-Powered Vehicle History Impact Analysis
 *
 * Replaces hardcoded history multipliers with contextual AI analysis:
 *   - Salvage title on a truck retains more value than on a sedan
 *   - A fender bender ≠ frame damage, but both count as "1 accident"
 *   - High condition score with rebuilt title = quality rebuild
 *   - Owner count impact varies by vehicle age and type
 *
 * Cost: ~$0.03-0.06 per call (GPT-4o, structured output)
 */

import { validatedAICall, type AIResult, type ValidationResult } from "./validate-and-retry";
import type { HistoryData } from "@/lib/market-valuation";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface HistoryAdjusterInput {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
  };
  bodyCategory: "truck" | "suv" | "sports" | "sedan" | "other";
  baseMarketValue: number;
  history: HistoryData;
  conditionScore: number;
  mileage?: number;
}

export interface HistoryBreakdownItem {
  factor: number;
  reasoning: string;
}

export interface HistoryAdjusterResult {
  historyMultiplier: number;
  breakdown: {
    titleImpact: HistoryBreakdownItem;
    accidentImpact: HistoryBreakdownItem;
    ownerImpact: HistoryBreakdownItem;
    structuralImpact: HistoryBreakdownItem;
    floodImpact: HistoryBreakdownItem;
    recallImpact: HistoryBreakdownItem;
  };
  combinedReasoning: string;
}

/* ------------------------------------------------------------------ */
/*  Emergency Heuristic (from market-valuation.ts)                     */
/* ------------------------------------------------------------------ */

function heuristicHistoryMultiplier(history: HistoryData): HistoryAdjusterResult {
  const titleFactor = history.titleStatus.toUpperCase().includes("SALVAGE") ? 0.55
    : history.titleStatus.toUpperCase().includes("REBUILT") ? 0.75 : 1.0;
  const accidentFactor = history.accidentCount >= 3 ? 0.70
    : history.accidentCount === 2 ? 0.80
    : history.accidentCount === 1 ? 0.90 : 1.0;
  const ownerFactor = history.ownerCount >= 5 ? 0.90
    : history.ownerCount === 4 ? 0.94
    : history.ownerCount === 3 ? 0.97 : 1.0;
  const structuralFactor = history.structuralDamage ? 0.75 : 1.0;
  const floodFactor = history.floodDamage ? 0.50 : 1.0;
  const recallFactor = history.openRecallCount >= 3 ? 0.95
    : history.openRecallCount >= 1 ? 0.98 : 1.0;

  const combined = titleFactor * accidentFactor * ownerFactor * structuralFactor * floodFactor * recallFactor;

  return {
    historyMultiplier: combined,
    breakdown: {
      titleImpact: { factor: titleFactor, reasoning: "Emergency fallback — fixed lookup" },
      accidentImpact: { factor: accidentFactor, reasoning: "Emergency fallback — fixed lookup" },
      ownerImpact: { factor: ownerFactor, reasoning: "Emergency fallback — fixed lookup" },
      structuralImpact: { factor: structuralFactor, reasoning: "Emergency fallback — fixed lookup" },
      floodImpact: { factor: floodFactor, reasoning: "Emergency fallback — fixed lookup" },
      recallImpact: { factor: recallFactor, reasoning: "Emergency fallback — fixed lookup" },
    },
    combinedReasoning: "Emergency fallback — used hardcoded multiplier table",
  };
}

/* ------------------------------------------------------------------ */
/*  Core Function                                                      */
/* ------------------------------------------------------------------ */

export async function analyzeHistoryImpact(
  input: HistoryAdjusterInput,
): Promise<AIResult<HistoryAdjusterResult>> {
  const { vehicle, bodyCategory, baseMarketValue, history, conditionScore, mileage } = input;

  const vehicleDesc = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;

  const historyFlags = [
    `Title: ${history.titleStatus}`,
    `Accidents: ${history.accidentCount}`,
    `Owners: ${history.ownerCount}`,
    `Structural damage: ${history.structuralDamage ? "YES" : "No"}`,
    `Flood damage: ${history.floodDamage ? "YES" : "No"}`,
  ].join("\n");

  return validatedAICall<HistoryAdjusterResult>({
    label: "[HistoryAdjuster]",

    primary: {
      model: "gpt-4o",
      systemPrompt: `You are a vehicle history valuation specialist. Your job is to determine how a vehicle's history (title status, accidents, owners, damage) should impact its market value.

Key insights:
- Title status impact is vehicle-dependent: rebuilt title on trucks/SUVs retains more value due to strong aftermarket demand. Rebuilt luxury cars lose more because buyers are pickier.
- Accident count alone is insufficient — but we don't have accident details, so assess based on condition score as proxy. High condition + 1 accident = likely minor repair done well.
- Owner count impact decreases with vehicle age. 3 owners on a 15-year-old truck is normal. 3 owners on a 3-year-old car is a red flag.
- Structural damage with high condition score suggests quality repair. Structural damage with low score = compounding problems.
- Flood damage is almost always severe — but for very old, very cheap vehicles, it matters less.
Each factor is a multiplier between 0.10 and 1.0 (where 1.0 = no impact). The combined multiplier is the PRODUCT of all factors.`,
      userPrompt: `Analyze the history impact on value for:

VEHICLE: ${vehicleDesc}
CATEGORY: ${bodyCategory}
BLACK BOOK RETAIL VALUE: $${baseMarketValue.toLocaleString()} (condition-tiered, mileage+region adjusted)
CONDITION SCORE: ${conditionScore}/100${mileage ? `\nMILEAGE: ${mileage.toLocaleString()} miles` : ""}

HISTORY:
${historyFlags}

Return a JSON object with:
1. "historyMultiplier": Combined multiplier (0.10-1.0). This is the product of all individual factors.

2. "breakdown": Object with exactly these keys, each containing { "factor": number (0.10-1.0), "reasoning": string }:
   - "titleImpact"
   - "accidentImpact"
   - "ownerImpact"
   - "structuralImpact"
   - "floodImpact"
   For factors with no impact, return factor: 1.0.

3. "combinedReasoning": 2-3 sentences explaining the overall history impact on this specific vehicle.

Return ONLY valid JSON.`,
      temperature: 0.1,
      maxTokens: 800,
    },

    validate: (parsed: unknown): ValidationResult<HistoryAdjusterResult> => {
      const p = parsed as Record<string, unknown>;
      const errors: string[] = [];

      const mult = Number(p.historyMultiplier);
      if (!mult || mult < 0.10 || mult > 1.0) {
        errors.push(`historyMultiplier ${mult} outside range 0.10-1.0`);
      }

      const bd = p.breakdown as Record<string, Record<string, unknown>> | undefined;
      const requiredKeys = ["titleImpact", "accidentImpact", "ownerImpact", "structuralImpact", "floodImpact"];
      if (!bd || typeof bd !== "object") {
        errors.push("breakdown missing or not an object");
      } else {
        for (const key of requiredKeys) {
          if (!bd[key]) {
            errors.push(`breakdown.${key} missing`);
          } else {
            const f = Number(bd[key].factor);
            if (!f || f < 0.10 || f > 1.0) {
              errors.push(`breakdown.${key}.factor ${f} outside range 0.10-1.0`);
            }
          }
        }
      }

      if (!p.combinedReasoning || typeof p.combinedReasoning !== "string") {
        errors.push("combinedReasoning missing");
      }

      if (errors.length > 0) {
        return { valid: false, partial: p, errors };
      }

      const parseItem = (item: Record<string, unknown>): HistoryBreakdownItem => ({
        factor: Math.max(0.10, Math.min(1.0, Number(item.factor) || 1.0)),
        reasoning: String(item.reasoning || ""),
      });

      const breakdown = {
        titleImpact: parseItem(bd!.titleImpact),
        accidentImpact: parseItem(bd!.accidentImpact),
        ownerImpact: parseItem(bd!.ownerImpact),
        structuralImpact: parseItem(bd!.structuralImpact),
        floodImpact: parseItem(bd!.floodImpact),
        recallImpact: { factor: 1.0, reasoning: "" },
      };

      // Cross-check: product of factors should be close to historyMultiplier
      const productCheck = Object.values(breakdown).reduce((p, b) => p * b.factor, 1);
      const finalMult = Math.max(0.10, Math.min(1.0, mult));

      if (Math.abs(productCheck - finalMult) / finalMult > 0.15) {
        // Use the product of individual factors as the true multiplier
        console.warn(`[HistoryAdjuster] Product of factors (${productCheck.toFixed(3)}) differs from stated multiplier (${finalMult.toFixed(3)}) — using product`);
      }

      return {
        valid: true,
        data: {
          historyMultiplier: Math.max(0.10, Math.min(1.0, productCheck)),
          breakdown,
          combinedReasoning: String(p.combinedReasoning),
        },
      };
    },

    buildFollowUp: (partial, errors) => {
      return `Your response had issues: ${errors.join("; ")}. Please return corrected JSON with historyMultiplier (0.10-1.0) and breakdown object with all 6 keys (titleImpact, accidentImpact, ownerImpact, structuralImpact, floodImpact, recallImpact), each containing { factor: number, reasoning: string }. Also include combinedReasoning. JSON only.`;
    },

    simplified: {
      model: "gpt-4o",
      buildPrompt: () => {
        return `A ${vehicleDesc} (${bodyCategory}) worth ~$${baseMarketValue.toLocaleString()} has: title=${history.titleStatus}, ${history.accidentCount} accidents, ${history.ownerCount} owners, structural=${history.structuralDamage}, flood=${history.floodDamage}, ${history.openRecallCount} open recalls. Condition score: ${conditionScore}/100. What's the combined history multiplier (0.10-1.0)? Return JSON: { "historyMultiplier": number, "breakdown": { "titleImpact": {"factor": num, "reasoning": str}, "accidentImpact": {"factor": num, "reasoning": str}, "ownerImpact": {"factor": num, "reasoning": str}, "structuralImpact": {"factor": num, "reasoning": str}, "floodImpact": {"factor": num, "reasoning": str}, "recallImpact": {"factor": num, "reasoning": str} }, "combinedReasoning": string }`;
      },
    },

    emergencyFallback: () => heuristicHistoryMultiplier(history),
  });
}
