/**
 * AI-Powered Condition Value Analysis
 *
 * Replaces the hardcoded 15-point interpolation curve with contextual
 * AI analysis that considers:
 *   - What specific condition issues were found and how they impact value
 *   - Vehicle category (mechanical issues matter more on trucks, cosmetic on luxury)
 *   - Per-area breakdown (underbody rust matters more than interior wear)
 *   - Age/mileage context (what's "normal wear" for this vehicle)
 *
 * Cost: ~$0.03-0.06 per call (GPT-4o, structured output)
 */

import { validatedAICall, type AIResult, type ValidationResult } from "./validate-and-retry";
import { interpolateConditionMultiplier } from "@/lib/market-valuation";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ConditionAdjusterInput {
  vehicle: {
    year: number;
    make: string;
    model: string;
  };
  mileage?: number;
  baseMarketValue: number;
  bodyCategory: "truck" | "suv" | "sports" | "sedan" | "other";
  conditionScore: number;
  areaScores?: {
    paintBody?: number;
    glassLighting?: number;
    interiorSurfaces?: number;
    interiorControls?: number;
    engineBay?: number;
    tiresWheels?: number;
    underbodyFrame?: number;
    exhaust?: number;
  };
  keyObservations?: string[];
  conditionAttenuation: number;
}

export interface ConditionImpactItem {
  adjustment: number;
  reasoning: string;
}

export interface ConditionAdjusterResult {
  conditionMultiplier: number;
  impactBreakdown: {
    exterior: ConditionImpactItem;
    interior: ConditionImpactItem;
    mechanical: ConditionImpactItem;
    underbody: ConditionImpactItem;
  };
  reasoning: string;
}

/* ------------------------------------------------------------------ */
/*  Core Function                                                      */
/* ------------------------------------------------------------------ */

export async function analyzeConditionValue(
  input: ConditionAdjusterInput,
): Promise<AIResult<ConditionAdjusterResult>> {
  const { vehicle, mileage, baseMarketValue, bodyCategory, conditionScore, areaScores, keyObservations, conditionAttenuation } = input;

  const vehicleDesc = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  const areaContext = areaScores ? [
    areaScores.paintBody !== undefined ? `Paint & Body: ${areaScores.paintBody}/100` : null,
    areaScores.glassLighting !== undefined ? `Glass & Lighting: ${areaScores.glassLighting}/100` : null,
    areaScores.interiorSurfaces !== undefined ? `Interior Surfaces: ${areaScores.interiorSurfaces}/100` : null,
    areaScores.interiorControls !== undefined ? `Interior Controls: ${areaScores.interiorControls}/100` : null,
    areaScores.engineBay !== undefined ? `Engine Bay: ${areaScores.engineBay}/100` : null,
    areaScores.tiresWheels !== undefined ? `Tires & Wheels: ${areaScores.tiresWheels}/100` : null,
    areaScores.underbodyFrame !== undefined ? `Underbody/Frame: ${areaScores.underbodyFrame}/100` : null,
    areaScores.exhaust !== undefined ? `Exhaust: ${areaScores.exhaust}/100` : null,
  ].filter(Boolean).join(", ") : "No per-area breakdown available";

  const observationsContext = keyObservations?.length
    ? `\nKEY OBSERVATIONS:\n${keyObservations.map((o) => `- ${o}`).join("\n")}`
    : "";

  return validatedAICall<ConditionAdjusterResult>({
    label: "[ConditionAdjuster]",

    primary: {
      model: "gpt-4o",
      systemPrompt: `You are a vehicle condition valuation specialist. Your job is to determine how a vehicle's physical condition should impact its market value.

Key insights:
- A condition score of 65 on a $50K truck means different things than 65 on a $5K sedan. The value impact is not a simple linear curve.
- For trucks: mechanical and underbody condition matter most. Minor cosmetic issues have less value impact because truck buyers expect wear.
- For luxury/sports cars: cosmetic condition matters much more. Buyers expect pristine interiors and paint.
- Context matters: a mechanical score of 70/100 at 120K miles is actually GOOD. The same score at 20K miles is concerning.
- Underbody rust on a 10-year-old truck in the salt belt is expected — less penalty than the same on a 3-year-old in Arizona.

The multiplier should reflect how this condition affects fair market value:
- 1.05 = exceptional condition, slight premium
- 1.00 = very good, expected condition for the age/mileage
- 0.90 = some issues but nothing major
- 0.70-0.80 = significant condition concerns
- 0.50 and below = serious problems, approaching rebuild territory

IMPORTANT: A condition attenuation of ${conditionAttenuation} will be applied to your multiplier. This means your raw multiplier will be blended: final = 1.0 + (your_multiplier - 1.0) × ${conditionAttenuation}. Return the RAW multiplier before attenuation.`,
      userPrompt: `Analyze condition impact on value for:

VEHICLE: ${vehicleDesc}
CATEGORY: ${bodyCategory}
BASE MARKET VALUE: $${baseMarketValue.toLocaleString()}${mileage ? `\nMILEAGE: ${mileage.toLocaleString()} miles` : ""}
OVERALL CONDITION SCORE: ${conditionScore}/100
PER-AREA SCORES: ${areaContext}${observationsContext}

Return a JSON object with:
1. "conditionMultiplier": Raw multiplier (0.20-1.15). This is the multiplier BEFORE condition attenuation is applied.

2. "impactBreakdown": Object with these keys, each containing { "adjustment": number (-0.30 to +0.10), "reasoning": string }:
   - "exterior"
   - "interior"
   - "mechanical"
   - "underbody"
   The adjustments should roughly sum to (conditionMultiplier - 1.0).

3. "reasoning": 2-3 sentences explaining how this vehicle's condition affects its value specifically.

Return ONLY valid JSON.`,
      temperature: 0.1,
      maxTokens: 800,
    },

    validate: (parsed: unknown): ValidationResult<ConditionAdjusterResult> => {
      const p = parsed as Record<string, unknown>;
      const errors: string[] = [];

      const mult = Number(p.conditionMultiplier);
      if (!mult || mult < 0.20 || mult > 1.15) {
        errors.push(`conditionMultiplier ${mult} outside range 0.20-1.15`);
      }

      const bd = p.impactBreakdown as Record<string, Record<string, unknown>> | undefined;
      const requiredKeys = ["exterior", "interior", "mechanical", "underbody"];
      if (!bd || typeof bd !== "object") {
        errors.push("impactBreakdown missing");
      } else {
        for (const key of requiredKeys) {
          if (!bd[key]) {
            errors.push(`impactBreakdown.${key} missing`);
          } else {
            const adj = Number(bd[key].adjustment);
            if (isNaN(adj) || adj < -0.30 || adj > 0.10) {
              errors.push(`impactBreakdown.${key}.adjustment ${adj} outside range`);
            }
          }
        }
      }

      if (!p.reasoning || typeof p.reasoning !== "string") {
        errors.push("reasoning missing");
      }

      if (errors.length > 0) {
        return { valid: false, partial: p, errors };
      }

      const parseItem = (item: Record<string, unknown>): ConditionImpactItem => ({
        adjustment: Math.max(-0.30, Math.min(0.10, Number(item.adjustment) || 0)),
        reasoning: String(item.reasoning || ""),
      });

      const rawMult = Math.max(0.20, Math.min(1.15, mult));
      // Apply condition attenuation: blend between 1.0 and raw multiplier
      const attenuatedMult = 1.0 + (rawMult - 1.0) * conditionAttenuation;

      return {
        valid: true,
        data: {
          conditionMultiplier: attenuatedMult,
          impactBreakdown: {
            exterior: parseItem(bd!.exterior),
            interior: parseItem(bd!.interior),
            mechanical: parseItem(bd!.mechanical),
            underbody: parseItem(bd!.underbody),
          },
          reasoning: String(p.reasoning),
        },
      };
    },

    buildFollowUp: (partial, errors) => {
      return `Your response had issues: ${errors.join("; ")}. Please return corrected JSON with conditionMultiplier (0.20-1.15), impactBreakdown (exterior/interior/mechanical/underbody each with adjustment and reasoning), and reasoning string. JSON only.`;
    },

    simplified: {
      model: "gpt-4o",
      buildPrompt: () => {
        return `A ${vehicleDesc} (${bodyCategory}) at ${mileage?.toLocaleString() || "unknown"} miles scored ${conditionScore}/100 on condition (${areaContext}). Base value $${baseMarketValue.toLocaleString()}. What value multiplier (0.20-1.15)? Return JSON: { "conditionMultiplier": number, "impactBreakdown": { "exterior": { "adjustment": num, "reasoning": str }, "interior": { "adjustment": num, "reasoning": str }, "mechanical": { "adjustment": num, "reasoning": str }, "underbody": { "adjustment": num, "reasoning": str } }, "reasoning": string }`;
      },
    },

    emergencyFallback: () => {
      const rawMult = interpolateConditionMultiplier(conditionScore);
      const attenuatedMult = 1.0 + (rawMult - 1.0) * conditionAttenuation;
      return {
        conditionMultiplier: attenuatedMult,
        impactBreakdown: {
          exterior: { adjustment: 0, reasoning: "Emergency fallback" },
          interior: { adjustment: 0, reasoning: "Emergency fallback" },
          mechanical: { adjustment: 0, reasoning: "Emergency fallback" },
          underbody: { adjustment: 0, reasoning: "Emergency fallback" },
        },
        reasoning: `Emergency fallback — score ${conditionScore} → ${rawMult.toFixed(3)} raw, ${attenuatedMult.toFixed(3)} attenuated`,
      };
    },
  });
}
