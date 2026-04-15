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
      systemPrompt: `You are an independent vehicle pricing advisor. Black Book is the primary pricing source. Your job is to review the pricing result and flag cases where Black Book values may not tell the full story.

CRITICAL KNOWLEDGE — ENTHUSIAST PLATFORMS:
- 7.3L Powerstroke diesels (1994-2003 Ford F-250/F-350): Worth $12K-30K+. Manual trans adds 20-40%. These are NOT cheap old trucks. Black Book may undervalue these.
- 5.9L/6.7L Cummins (Dodge/Ram 2500/3500): $15K-35K+. Manual premium applies. Strong enthusiast demand BB may not fully capture.
- Duramax diesels (Chevy/GMC 2500/3500): $15K-35K+.
- Toyota Land Cruiser (all years): Holds value extremely well. BB sometimes lags behind real market.
- Jeep Wrangler: Minimal depreciation regardless of age.
- Manual transmission trucks: 20-40% premium, increasingly rare.
- Diesel + manual + 4WD on a heavy-duty truck is the trifecta — VERY valuable.
- 200K miles on a diesel truck is MID-LIFE, not high mileage. These run 400K+.

PRICING MODEL:
Black Book provides condition-tiered retail/wholesale/trade-in values. The condition tier is selected based on VeriBuy's inspection score (0-100). BB values are already adjusted for mileage and region. A market adjustment may be applied if comparable dealer listings diverge significantly from BB retail.

The math is: BB Retail [tier] × market adjustment × history multiplier − recon = estimated retail. Then dealer margin is subtracted to get the buy price.

You should flag issues like:
- Enthusiast platform UNDERPRICED by BB (e.g., clean manual Powerstroke valued at $9K)
- History multiplier too lenient for severe title/damage issues
- History multiplier too harsh (e.g., 1 minor accident on a truck shouldn't drop value 15%)
- Condition tier mapping seems wrong (e.g., score 74 = "average" but issues are cosmetic-only on a work truck)
- Recon cost doesn't match the confirmed findings
- Market adjustment seems off (comps tell a different story than BB)
- Final price outside plausible range for this specific vehicle

ONLY flag real issues. Don't flag things that are correct but unusual.
If everything looks reasonable, approve with a high coherence score.
If the price needs adjustment, provide a suggested retail price in cents. The dealer will decide whether to accept your suggestion or keep the BB price.`,
      userPrompt: `Review this pricing result:

VEHICLE: ${vehicleDesc}${mileage ? ` at ${mileage.toLocaleString()} miles` : ""}

BLACK BOOK: ${sourceSummary}

PRICING CHAIN:
${(input.pricingTrace || []).filter((s) => s.label !== "Fair Purchase Price").map((step, i) => {
  const pad = step.label.padEnd(24);
  return `Step ${i + 1}: ${pad} ${step.operation.padEnd(12)} = $${step.outputDollars.toLocaleString()}  [${step.explanation}]`;
}).join("\n")}

FAIR PURCHASE PRICE: $${fairDollars.toLocaleString()}

YOUR JOB: Does the BB pricing make sense for THIS specific vehicle? Consider the vehicle's history, condition, and how comparable listings align. If you think the retail value should be different, suggest an adjusted price.

FULL VEHICLE CONTEXT:
Category: ${input.bodyCategory || "unknown"}${conditionContext}${areaScoreContext}${findingsContext}${compsContext}

Return JSON:
{
  "approved": boolean,
  "adjustedFairPrice": number | null (in CENTS — only if not approved, your suggested fair purchase price),
  "flags": ["list of specific issues found"],
  "coherenceScore": number (0.0-1.0, how confident are you in the current pricing),
  "reasoning": "2-3 sentences explaining your assessment. If suggesting an adjustment, explain WHY BB may be off for this vehicle."
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
