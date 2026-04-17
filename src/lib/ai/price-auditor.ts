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

  /** Wholesale value in cents — primary buy-side benchmark */
  wholesaleValue?: number;
  /** Trade-in value in cents — alternate buy-side benchmark */
  tradeInValue?: number;
  /** Dealer's target margin percent (for context, e.g. 25) */
  targetMarginPercent?: number;
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
      systemPrompt: `You are a second-opinion vehicle acquisition advisor. Your only job is to sanity-check a proposed dealer BUY price against other dealer BUY-side benchmarks for the same vehicle, and flag it only if it is way off.

KEY FRAMING: The proposed price you are reviewing is a DEALER ACQUISITION TARGET — what a dealer should pay to buy this vehicle for inventory. It is intentionally BELOW retail (dealers need margin). The correct comparison is BUY-TO-BUY, not buy-to-retail.

BUY-SIDE BENCHMARKS to compare against:
- Wholesale value (auction market price) — the primary benchmark
- Trade-in value — what a dealer would offer on trade
- Retail listings MINUS typical dealer margin (~20-30%) — rough derived buy benchmark

DEFAULT ANSWER IS APPROVE. Only flag as "way off" when the proposed buy price is obviously wrong:
- Way too high: proposed buy is at or above wholesale + 20% (dealer overpaying)
- Way too low: proposed buy is well below wholesale (dealer expecting too much discount)
- Clearly wrong for platform: e.g., proposing $8K buy on a clean enthusiast platform worth $20K+ at wholesale

CRITICAL KNOWLEDGE — SPECIALTY PLATFORMS WHERE WHOLESALE BENCHMARKS MAY LAG:
- 7.3L Powerstroke diesels: enthusiast wholesale often $15K+ even if generic wholesale shows less.
- 5.9L/6.7L Cummins: strong wholesale demand.
- Duramax diesels: strong wholesale demand.
- Toyota Land Cruiser: wholesale holds extremely well.
- Jeep Wrangler: minimal wholesale depreciation.
- Ford Raptor / Ram TRX / Chevy ZR2: wholesale premiums over base trims.
- Manual transmission trucks: 20-40% wholesale premium.

WHAT NOT TO DO:
- Do NOT compare the proposed buy price against retail — those are different numbers for a reason.
- Do NOT comment on how the price was calculated. No mentions of multipliers, adjustments, pricing steps, modules, or pipeline mechanics.
- Do NOT nitpick. Small differences from wholesale are normal — a buy slightly above wholesale is fine for a clean unit in demand.
- Do NOT flag a price just because it's below retail — that's the whole point.

If the proposed buy is reasonably aligned with wholesale/trade-in benchmarks for this vehicle's condition and platform, APPROVE with a high coherence score. Only DISAGREE when the price is genuinely way off.`,
      userPrompt: `Sanity-check this proposed dealer buy price against buy-side benchmarks.

VEHICLE: ${vehicleDesc}${mileage ? ` at ${mileage.toLocaleString()} miles` : ""}
Category: ${input.bodyCategory || "unknown"}${conditionContext}${areaScoreContext}${findingsContext}

TITLE / HISTORY: ${input.historySummary || "No significant history reported"}

BUY-SIDE BENCHMARKS:
- Wholesale value: ${input.wholesaleValue ? `$${Math.round(input.wholesaleValue / 100).toLocaleString()}` : "not available"}
- Trade-in value: ${input.tradeInValue ? `$${Math.round(input.tradeInValue / 100).toLocaleString()}` : "not available"}${input.targetMarginPercent ? `\n- Dealer's target margin: ${input.targetMarginPercent}%` : ""}

RETAIL CONTEXT (for reference only — do NOT compare buy price directly to retail):
${sourceSummary}${compsContext}

PROPOSED DEALER BUY PRICE: $${fairDollars.toLocaleString()}

YOUR JOB: Is $${fairDollars.toLocaleString()} reasonably aligned with the BUY-SIDE BENCHMARKS above for this specific vehicle? Approve unless the proposed buy is way off (much too high above wholesale, or much too low below wholesale for a vehicle of this condition/platform).

Return JSON:
{
  "approved": boolean,
  "adjustedFairPrice": number | null (in CENTS — only if NOT approved AND the price is way off; your suggested buy price),
  "flags": ["only include if way off — short vehicle-level reasons. Never reference calculation steps or compare to retail."],
  "coherenceScore": number (0.0-1.0, how aligned the proposed buy is with wholesale/trade-in benchmarks),
  "reasoning": "1-2 sentences. If approving: confirm the buy is aligned with wholesale/trade-in for this vehicle. If disagreeing: state the wholesale/buy-side number you expect and why."
}`,
      temperature: 0.1,
      maxTokens: 500,
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
        const wholesaleDollars = input.wholesaleValue ? Math.round(input.wholesaleValue / 100).toLocaleString() : "n/a";
        const tradeInDollars = input.tradeInValue ? Math.round(input.tradeInValue / 100).toLocaleString() : "n/a";
        return `Sanity check: dealer buy price $${fairDollars.toLocaleString()} for a ${vehicleDesc}${mileage ? ` at ${mileage.toLocaleString()} mi` : ""}, condition ${input.conditionScore}/100, history ${input.historySummary || "clean"}. Buy-side benchmarks: wholesale $${wholesaleDollars}, trade-in $${tradeInDollars}. Approve unless the buy price is WAY off the wholesale benchmark. Do NOT compare to retail. Return JSON: { "approved": boolean, "adjustedFairPrice": number|null (cents, only if way off), "flags": string[] (empty if approved), "coherenceScore": 0-1, "reasoning": "1 sentence" }`;
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
