/**
 * AI-Powered Condition Scoring Weight Determination
 *
 * At VIN decode time, determines how much each of the 9 condition areas
 * matters for this specific vehicle's market value. A diesel truck's
 * engine bay and underbody matter far more than a sedan's. A luxury car's
 * paint and interior matter more than a work truck's.
 *
 * Weights are stored on the Inspection record and used for:
 *   - Overall condition score calculation (weighted sum of 9 area scores)
 *   - Condition review recalculation (after inspector verification)
 *   - Market analysis context (tells the AI what matters for this vehicle)
 *
 * Cost: ~$0.005-0.01 per call (GPT-4o-mini primary)
 */

import { validatedAICall, type AIResult, type ValidationResult } from "./validate-and-retry";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ConditionWeighterInput {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    engine?: string | null;
    drivetrain?: string | null;
    bodyStyle?: string | null;
  };
  mileage?: number | null;
}

/** 9-bucket weights — must sum to 100 */
export interface ConditionWeights {
  paintBody: number;
  panelAlignment: number;
  glassLighting: number;
  interiorSurfaces: number;
  interiorControls: number;
  engineBay: number;
  tiresWheels: number;
  underbodyFrame: number;
  exhaust: number;
}

export interface ConditionWeighterResult {
  weights: ConditionWeights;
  reasoning: string;
}

/* ------------------------------------------------------------------ */
/*  Default weights by body category (Tier 3 fallback)                 */
/* ------------------------------------------------------------------ */

const DEFAULT_WEIGHTS: Record<string, ConditionWeights> = {
  truck: {
    paintBody: 10, panelAlignment: 8, glassLighting: 5,
    interiorSurfaces: 8, interiorControls: 4, engineBay: 25,
    tiresWheels: 10, underbodyFrame: 22, exhaust: 8,
  },
  suv: {
    paintBody: 12, panelAlignment: 8, glassLighting: 8,
    interiorSurfaces: 10, interiorControls: 5, engineBay: 20,
    tiresWheels: 10, underbodyFrame: 18, exhaust: 9,
  },
  sedan: {
    paintBody: 18, panelAlignment: 10, glassLighting: 8,
    interiorSurfaces: 12, interiorControls: 7, engineBay: 18,
    tiresWheels: 10, underbodyFrame: 12, exhaust: 5,
  },
  luxury: {
    paintBody: 20, panelAlignment: 12, glassLighting: 8,
    interiorSurfaces: 15, interiorControls: 8, engineBay: 15,
    tiresWheels: 8, underbodyFrame: 10, exhaust: 4,
  },
  default: {
    paintBody: 15, panelAlignment: 10, glassLighting: 8,
    interiorSurfaces: 10, interiorControls: 5, engineBay: 20,
    tiresWheels: 10, underbodyFrame: 15, exhaust: 7,
  },
};

const WEIGHT_KEYS: (keyof ConditionWeights)[] = [
  "paintBody", "panelAlignment", "glassLighting",
  "interiorSurfaces", "interiorControls", "engineBay",
  "tiresWheels", "underbodyFrame", "exhaust",
];

/* ------------------------------------------------------------------ */
/*  Body category detection                                            */
/* ------------------------------------------------------------------ */

const TRUCK_MODELS = ["f-150", "f-250", "f-350", "silverado", "sierra", "ram", "tundra", "titan", "tacoma", "ranger", "colorado", "canyon", "gladiator", "ridgeline", "maverick", "frontier"];
const LUXURY_MAKES = ["mercedes", "bmw", "audi", "lexus", "porsche", "maserati", "bentley", "rolls", "ferrari", "lamborghini", "aston", "genesis", "lincoln", "cadillac", "infiniti", "acura"];

function detectBodyCategory(vehicle: ConditionWeighterInput["vehicle"]): string {
  const make = vehicle.make.toLowerCase();
  const model = `${vehicle.make} ${vehicle.model}`.toLowerCase();
  const body = (vehicle.bodyStyle || "").toLowerCase();

  if (TRUCK_MODELS.some((t) => model.includes(t)) || body.includes("truck") || body.includes("pickup")) return "truck";
  if (LUXURY_MAKES.some((l) => make.includes(l))) return "luxury";
  if (body.includes("suv") || body.includes("crossover") || model.includes("4runner") || model.includes("tahoe") || model.includes("suburban") || model.includes("expedition")) return "suv";
  return "sedan";
}

/* ------------------------------------------------------------------ */
/*  Prompts                                                            */
/* ------------------------------------------------------------------ */

function buildSystemPrompt(): string {
  return `You are a vehicle acquisition specialist who understands what condition areas matter most for different vehicle types when determining market value.

Given a vehicle's specs, determine the ideal inspection weight for each of 9 condition areas. Weights must sum to exactly 100.

THE 9 CONDITION AREAS:
1. paintBody — Dents, scratches, rust, paint chips, fade, respray evidence
2. panelAlignment — Gap asymmetry, bumper fitment, door gaps, collision repair evidence
3. glassLighting — Windshield, headlights, taillights, fog lights, mirrors
4. interiorSurfaces — Seats, carpet, headliner, door panels, steering wheel, dashboard
5. interiorControls — Infotainment, HVAC, gauges, switches, electronics
6. engineBay — Fluid leaks, belts, hoses, battery, aftermarket mods
7. tiresWheels — Tread depth, sidewalls, rims, wear patterns
8. underbodyFrame — Frame rails, structural rust, suspension, splash shields
9. exhaust — Pipes, muffler, catalytic converter, hangers, tips

RESPOND WITH EXACTLY THIS JSON (no markdown):
{
  "weights": {
    "paintBody": <number>,
    "panelAlignment": <number>,
    "glassLighting": <number>,
    "interiorSurfaces": <number>,
    "interiorControls": <number>,
    "engineBay": <number>,
    "tiresWheels": <number>,
    "underbodyFrame": <number>,
    "exhaust": <number>
  },
  "reasoning": "1-2 sentence explanation of weight choices"
}

All weights must be positive integers that sum to exactly 100.`;
}

function buildUserPrompt(input: ConditionWeighterInput): string {
  const v = input.vehicle;
  const parts = [
    `${v.year} ${v.make} ${v.model}`,
    v.trim ? `Trim: ${v.trim}` : null,
    v.engine ? `Engine: ${v.engine}` : null,
    v.drivetrain ? `Drivetrain: ${v.drivetrain}` : null,
    v.bodyStyle ? `Body: ${v.bodyStyle}` : null,
    input.mileage ? `Mileage: ${input.mileage.toLocaleString()} miles` : null,
  ].filter(Boolean);

  return `Determine the ideal condition scoring weights for:\n${parts.join("\n")}\n\nWhat matters most for this vehicle's market value? Which areas should be weighted heaviest in the condition score?`;
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

function validate(parsed: unknown): ValidationResult<ConditionWeighterResult> {
  const obj = parsed as Record<string, unknown>;
  const weights = obj?.weights as Record<string, unknown> | undefined;
  const reasoning = String(obj?.reasoning || "");

  if (!weights) {
    return { valid: false, partial: obj, errors: ["Missing 'weights' object"] };
  }

  const errors: string[] = [];
  const result: Partial<ConditionWeights> = {};
  let sum = 0;

  for (const key of WEIGHT_KEYS) {
    const val = Number(weights[key]);
    if (!val || val <= 0 || !Number.isFinite(val)) {
      errors.push(`Missing or invalid weight: ${key}`);
    } else {
      result[key] = Math.round(val);
      sum += Math.round(val);
    }
  }

  if (errors.length > 0) {
    return { valid: false, partial: { weights: result, reasoning }, errors };
  }

  // Normalize if sum isn't exactly 100 (AI sometimes returns 99 or 101)
  if (sum !== 100) {
    const factor = 100 / sum;
    let normalized = 0;
    for (const key of WEIGHT_KEYS) {
      result[key] = Math.round((result[key] || 0) * factor);
      normalized += result[key]!;
    }
    // Fix rounding error on last key
    if (normalized !== 100) {
      result[WEIGHT_KEYS[WEIGHT_KEYS.length - 1]]! += 100 - normalized;
    }
  }

  return {
    valid: true,
    data: { weights: result as ConditionWeights, reasoning },
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function determineConditionWeights(
  input: ConditionWeighterInput,
): Promise<AIResult<ConditionWeighterResult>> {
  const bodyCategory = detectBodyCategory(input.vehicle);

  return validatedAICall<ConditionWeighterResult>({
    label: "[ConditionWeighter]",

    primary: {
      model: "gpt-4o-mini",
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt(input),
      temperature: 0.3,
      maxTokens: 500,
    },

    validate,

    buildFollowUp: (partial, errors) =>
      `Your previous response had issues: ${errors.join("; ")}. ` +
      `Please provide all 9 weights as positive integers summing to exactly 100.`,

    simplified: {
      model: "gpt-4o",
      buildPrompt: () =>
        `${buildSystemPrompt()}\n\n${buildUserPrompt(input)}\n\nIMPORTANT: All 9 weights must be positive integers summing to exactly 100.`,
    },

    emergencyFallback: () => ({
      weights: DEFAULT_WEIGHTS[bodyCategory] || DEFAULT_WEIGHTS.default,
      reasoning: `Deterministic fallback for ${bodyCategory} body category`,
    }),
  });
}

/** Get default weights for a body category (used when AI weights aren't available) */
export function getDefaultWeights(bodyCategory?: string): ConditionWeights {
  return DEFAULT_WEIGHTS[bodyCategory || "default"] || DEFAULT_WEIGHTS.default;
}

export { WEIGHT_KEYS };
