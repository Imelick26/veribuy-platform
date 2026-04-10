/**
 * AI-Powered Price Auditor — Cross-Validation Safety Net
 *
 * Reviews the fully assembled pricing result for coherence before it ships.
 * Catches cases where individual AI modules produced reasonable-looking
 * outputs that don't make sense when combined:
 *   - Config premium misapplied (Lariat is NOT a performance trim)
 *   - History multiplier too lenient for salvage title
 *   - Recon cost contradicts condition score
 *   - Final price outside plausible range for this vehicle
 *
 * This is the last line of defense — one bad price kills trust.
 *
 * Cost: ~$0.04-0.08 per call (GPT-4o, needs full context)
 */

import { validatedAICall, type AIResult, type ValidationResult } from "./validate-and-retry";
import type { PricingTraceStep } from "@/lib/pricing-consensus";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PriceAuditInput {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    engine?: string | null;
  };
  mileage?: number;

  /** All source prices for reference */
  sourcePrices: { source: string; value: number }[];

  /** AI consensus value (dollars) */
  consensusValue: number;
  consensusReasoning: string;

  /** Config premium applied */
  configMultiplier: number;
  configReasoning: string;

  /** Regional multiplier */
  regionalMultiplier: number;
  regionalReasoning: string;

  /** Base market value AFTER config + regional (cents) */
  adjustedBaseValueCents: number;

  /** Condition multiplier */
  conditionMultiplier: number;
  conditionScore: number;
  conditionReasoning: string;

  /** History multiplier */
  historyMultiplier: number;
  historyReasoning: string;
  historySummary: string;

  /** Recon cost */
  reconCostCents: number;
  reconReasoning: string;

  /** Final fair purchase price (cents) */
  fairPurchasePrice: number;

  /** Deal rating */
  dealRating: string;
  dealReasoning: string;

  /** Step-by-step pricing math trace */
  pricingTrace?: PricingTraceStep[];

  /** Full vehicle context for informed auditing */
  transmission?: string | null;
  drivetrain?: string | null;
  bodyCategory?: string;
  conditionSummary?: string | null;
  areaScores?: { paintBody?: number; glassLighting?: number; interiorSurfaces?: number; interiorControls?: number; engineBay?: number; tiresWheels?: number; underbodyFrame?: number; exhaust?: number };
  confirmedFindings?: { title: string; severity: string }[];
  comparableListings?: { title: string; price: number; mileage: number; source: string }[];
  nearbyListingCount?: number;
}

export interface PriceAuditResult {
  approved: boolean;
  adjustedFairPrice: number | null;
  flags: string[];
  coherenceScore: number;
  reasoning: string;
}

/* ------------------------------------------------------------------ */
/*  Core Function                                                      */
/* ------------------------------------------------------------------ */

export async function auditPrice(
  input: PriceAuditInput,
): Promise<AIResult<PriceAuditResult>> {
  const { vehicle, mileage } = input;
  const vehicleDesc = [
    `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehicle.trim, vehicle.engine, input.transmission, input.drivetrain,
  ].filter(Boolean).join(", ");
  const fairDollars = Math.round(input.fairPurchasePrice / 100);
  const baseDollars = Math.round(input.adjustedBaseValueCents / 100);
  const reconDollars = Math.round(input.reconCostCents / 100);

  const sourceSummary = input.sourcePrices.map((s) => `${s.source}: $${s.value.toLocaleString()}`).join(", ");

  // Build full context sections
  const conditionContext = input.conditionSummary
    ? `\nCONDITION SUMMARY: ${input.conditionSummary}`
    : "";
  const areaScoreContext = input.areaScores
    ? `\nAREA SCORES: Paint & Body ${input.areaScores.paintBody ?? "?"}/100, Glass & Lighting ${input.areaScores.glassLighting ?? "?"}/100, Interior Surfaces ${input.areaScores.interiorSurfaces ?? "?"}/100, Interior Controls ${input.areaScores.interiorControls ?? "?"}/100, Engine Bay ${input.areaScores.engineBay ?? "?"}/100, Tires & Wheels ${input.areaScores.tiresWheels ?? "?"}/100, Underbody ${input.areaScores.underbodyFrame ?? "?"}/100, Exhaust ${input.areaScores.exhaust ?? "?"}/100`
    : "";
  const findingsContext = input.confirmedFindings?.length
    ? `\nCONFIRMED FINDINGS:\n${input.confirmedFindings.map((f) => `  - ${f.title} (${f.severity})`).join("\n")}`
    : "\nNO CONFIRMED FINDINGS";
  const compsContext = input.comparableListings?.length
    ? `\nCOMPARABLE LISTINGS (${input.nearbyListingCount || input.comparableListings.length} total):\n${input.comparableListings.slice(0, 8).map((c) => `  ${c.title} — $${c.price.toLocaleString()} — ${c.mileage.toLocaleString()} mi — ${c.source}`).join("\n")}`
    : "\nNO COMPARABLE LISTINGS FOUND";

  return validatedAICall<PriceAuditResult>({
    label: "[PriceAuditor]",

    primary: {
      model: "gpt-4o",
      systemPrompt: `You are a pricing quality auditor for a vehicle valuation platform. Your job is to review a fully assembled pricing result and check for coherence issues.

CRITICAL KNOWLEDGE — ENTHUSIAST PLATFORMS:
- 7.3L Powerstroke diesels (1994-2003 Ford F-250/F-350): Worth $12K-30K+. Manual trans adds 20-40%. These are NOT cheap old trucks.
- 5.9L/6.7L Cummins (Dodge/Ram 2500/3500): $15K-35K+. Manual premium applies.
- Duramax diesels (Chevy/GMC 2500/3500): $15K-35K+.
- Toyota Land Cruiser (all years): Holds value extremely well.
- Jeep Wrangler: Minimal depreciation regardless of age.
- Manual transmission trucks: 20-40% premium, increasingly rare.
- Diesel + manual + 4WD on a heavy-duty truck is the trifecta — VERY valuable.
- 200K miles on a diesel truck is MID-LIFE, not high mileage. These run 400K+.

IMPORTANT — ACQUISITION-BASED PRICING:
The consensus value represents DEALER ACQUISITION COST, not retail or private-party price. Each source has been pre-normalized to strip dealer markup, adjust auction bias, etc. before consensus. So the source prices you see ARE acquisition-equivalent already. Do NOT re-apply acquisition discounts or try to strip markup — that's already done.

The math should be: consensus × config × regional = adjusted base → × condition × history − recon = fair purchase price.
Verify the math follows this chain. If you recalculate, use the adjusted base as your starting point, NOT the raw consensus.

You should flag issues like:
- Config premium misapplied (e.g., Lariat/XLT treated like a performance trim)
- Enthusiast platform UNDERPRICED (e.g., a clean manual Powerstroke priced at $9K is wrong)
- History multiplier inconsistent with title status severity
- Condition multiplier doesn't match the condition score magnitude
- Recon cost inconsistent with condition findings
- Final price outside plausible range for this specific vehicle configuration
- Individual reasoning contradicts the numbers
- Double-counting (condition penalized twice, etc.)

ONLY flag real issues. Don't flag things that are correct but unusual.
If everything looks reasonable, approve with high coherence score.
If the price is clearly wrong for this platform/config, provide an adjusted price.`,
      userPrompt: `Audit this pricing result for coherence:

VEHICLE: ${vehicleDesc}${mileage ? ` at ${mileage.toLocaleString()} miles` : ""}

SOURCE PRICES (acquisition-normalized): ${sourceSummary}

VERIFIED MATH TRACE (each step's output feeds the next step's input):
${(input.pricingTrace || []).filter((s) => s.label !== "Fair Purchase Price").map((step, i) => {
  const pad = step.label.padEnd(24);
  return `Step ${i + 1}: ${pad} ${step.operation.padEnd(12)} = $${step.outputDollars.toLocaleString()}  [${step.explanation}]`;
}).join("\n")}

FAIR PURCHASE PRICE: $${fairDollars.toLocaleString()}
Deal rating: ${input.dealRating} — "${input.dealReasoning}"

YOUR JOB: Verify each step's multiplier/amount makes sense for THIS vehicle.
Do NOT recalculate from scratch — verify each step independently.

FULL VEHICLE CONTEXT:
Category: ${input.bodyCategory || "unknown"}${conditionContext}${areaScoreContext}${findingsContext}${compsContext}

Return JSON:
{
  "approved": boolean,
  "adjustedFairPrice": number | null (in CENTS — only if not approved, your corrected estimate),
  "flags": ["list of specific issues found"],
  "coherenceScore": number (0.0-1.0, how internally consistent is this result),
  "reasoning": "2-3 sentences explaining your audit conclusion"
}`,
      temperature: 0.1,
      maxTokens: 800,
    },

    validate: (parsed: unknown): ValidationResult<PriceAuditResult> => {
      const p = parsed as Record<string, unknown>;
      const errors: string[] = [];

      if (typeof p.approved !== "boolean") {
        errors.push("approved must be boolean");
      }

      const cs = Number(p.coherenceScore);
      if (isNaN(cs) || cs < 0 || cs > 1) {
        errors.push("coherenceScore must be 0.0-1.0");
      }

      if (!p.reasoning || typeof p.reasoning !== "string") {
        errors.push("reasoning missing");
      }

      // If not approved, adjustedFairPrice is required
      if (p.approved === false) {
        let adj = Number(p.adjustedFairPrice);
        if (!adj || adj <= 0) {
          errors.push("adjustedFairPrice required when not approved");
        } else {
          // Detect if in dollars (< 10000 for any vehicle is likely dollars, not cents)
          if (adj < 10000 && fairDollars > 1000) {
            // Likely in dollars, convert to cents
            adj = adj * 100;
          }
          // Must be within 50% of original
          if (Math.abs(adj - input.fairPurchasePrice) / input.fairPurchasePrice > 0.50) {
            errors.push(`adjustedFairPrice ${adj} is >50% different from original ${input.fairPurchasePrice}`);
          }
        }
      }

      if (errors.length > 0) {
        return { valid: false, partial: p, errors };
      }

      let adjustedPrice: number | null = null;
      if (p.approved === false && p.adjustedFairPrice) {
        adjustedPrice = Number(p.adjustedFairPrice);
        // Auto-detect dollars vs cents
        if (adjustedPrice < 10000 && fairDollars > 1000) {
          adjustedPrice = adjustedPrice * 100;
        }
        adjustedPrice = Math.round(adjustedPrice);
      }

      return {
        valid: true,
        data: {
          approved: Boolean(p.approved),
          adjustedFairPrice: adjustedPrice,
          flags: Array.isArray(p.flags) ? (p.flags as string[]).map(String) : [],
          coherenceScore: Math.max(0, Math.min(1, cs)),
          reasoning: String(p.reasoning),
        },
      };
    },

    buildFollowUp: (partial, errors) => {
      return `Your response had issues: ${errors.join("; ")}. Return corrected JSON: { "approved": boolean, "adjustedFairPrice": number|null (in CENTS, required if not approved), "flags": string[], "coherenceScore": 0-1, "reasoning": string }. JSON only.`;
    },

    simplified: {
      model: "gpt-4o",
      buildPrompt: () => {
        return `Quick audit: A ${vehicleDesc} priced at $${fairDollars.toLocaleString()} fair purchase price. Consensus $${input.consensusValue.toLocaleString()}, config ${input.configMultiplier.toFixed(2)}x, condition ${input.conditionScore}/100 (${input.conditionMultiplier.toFixed(2)}x), history ${input.historyMultiplier.toFixed(2)}x, -$${reconDollars.toLocaleString()} recon. Does this make sense? Return JSON: { "approved": boolean, "adjustedFairPrice": number|null (cents, if not approved), "flags": string[], "coherenceScore": 0-1, "reasoning": string }`;
      },
    },

    emergencyFallback: () => {
      // If auditor fails, approve by default (don't block the pipeline)
      return {
        approved: true,
        adjustedFairPrice: null,
        flags: ["Price auditor unavailable — auto-approved"],
        coherenceScore: 0.5,
        reasoning: "Emergency fallback — auditor AI unavailable, auto-approved",
      };
    },
  });
}
