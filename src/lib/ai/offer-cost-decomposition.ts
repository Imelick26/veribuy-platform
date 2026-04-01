/**
 * AI-Powered Offer Cost Decomposition
 *
 * Uses OpenAI to intelligently decompose the gap between VeriBuy's
 * data-driven valuation and the dealer's margin-computed offer into
 * defensible, vehicle-specific cost line items.
 *
 * The AI considers:
 *   - Vehicle type, age, mileage, and segment
 *   - Regional market conditions
 *   - Specific inspection findings
 *   - Average days on market for comparable vehicles
 *   - Industry reconditioning and holding cost data
 *
 * Uses the 3-tier reliability pattern:
 *   Tier 1: GPT-4o-mini with full context
 *   Tier 2: Simplified prompt with GPT-4o
 *   Tier 3: Deterministic heuristic fallback
 */

import { validatedAICall, type AIResult, type ValidationResult } from "./validate-and-retry";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CostLineItem {
  label: string;
  amountCents: number;
  description: string;
}

export interface OfferCostBreakdown {
  /** The VeriBuy data-driven valuation (before dealer costs) in cents */
  valuationCents: number;
  /** The dealer's actual offer in cents */
  offerCents: number;
  /** Identified repairs from inspection (already shown separately) in cents */
  reconCents: number;
  /** Itemized cost lines that explain the remaining gap */
  costItems: CostLineItem[];
  /** Total of all cost items in cents */
  totalCostsCents: number;
  /** AI reasoning for the allocation */
  reasoning?: string;
}

export interface DecomposeParams {
  /** VeriBuy's data-driven valuation in cents */
  valuationCents: number;
  /** Dealer's actual offer in cents */
  offerCents: number;
  /** Recon cost from inspection findings in cents */
  reconCents: number;
  /** Vehicle details */
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    bodyStyle: string | null;
    mileage?: number | null;
  };
  /** Location/region */
  location?: string | null;
  /** Average days on market from comparable data */
  avgDaysOnMarket?: number | null;
  /** Number of confirmed findings from inspection */
  findingsCount?: number;
}

/* ------------------------------------------------------------------ */
/*  AI-Powered Decomposition                                           */
/* ------------------------------------------------------------------ */

export async function decomposeOfferGap(
  params: DecomposeParams
): Promise<AIResult<OfferCostBreakdown>> {
  const {
    valuationCents,
    offerCents,
    reconCents,
    vehicle,
    location,
    avgDaysOnMarket,
    findingsCount,
  } = params;

  const totalGap = valuationCents - offerCents - reconCents;

  // No gap to explain
  if (totalGap <= 0) {
    return {
      result: {
        valuationCents,
        offerCents,
        reconCents,
        costItems: [],
        totalCostsCents: 0,
      },
      aiAnalyzed: false,
      fallbackTier: 3,
      retried: false,
      model: "none",
    };
  }

  const gapDollars = Math.round(totalGap / 100);
  const valuationDollars = Math.round(valuationCents / 100);
  const vehicleDesc = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;
  const mileageStr = vehicle.mileage ? `${vehicle.mileage.toLocaleString()} miles` : "unknown mileage";
  const daysOnMarket = avgDaysOnMarket ?? 42;

  const systemPrompt = `You are a vehicle acquisition cost analyst. You decompose the costs a dealer incurs between acquiring a vehicle and having it ready for resale. You produce specific, defensible dollar amounts backed by industry data. Your output must be precise — every dollar of the gap must be accounted for. Never mention dealer profit, margin, or markup. Frame everything as legitimate business costs the dealer absorbs.`;

  const userPrompt = `A dealer is acquiring a ${vehicleDesc} (${mileageStr}, ${vehicle.bodyStyle || "unknown body style"}) in ${location || "the US market"}.

The gap between the vehicle's market valuation and the dealer's offer (EXCLUDING already-identified mechanical repairs) is $${gapDollars.toLocaleString()}.

Context:
- Vehicle market valuation: $${valuationDollars.toLocaleString()}
- Average days on market for comparable vehicles: ${daysOnMarket} days
- Number of inspection findings: ${findingsCount ?? 0}
- Vehicle body type: ${vehicle.bodyStyle || "unknown"}

Break down this $${gapDollars.toLocaleString()} gap into specific dealer costs. Use these categories (include all that apply, amounts must sum to exactly $${gapDollars.toLocaleString()}):

1. Reconditioning & certification — detail, paint correction, interior restoration, safety certification, cosmetic prep
2. Holding cost — lot space, insurance, financing cost while vehicle is held (use daily rate × expected days)
3. Transaction & compliance — title transfer, registration, advertising, listing fees, compliance/emissions
4. Market depreciation — value loss during the holding period based on this vehicle's depreciation curve

Return JSON:
{
  "costItems": [
    { "label": "category name", "amount": dollar amount (integer), "description": "specific explanation for this vehicle" }
  ],
  "reasoning": "1-2 sentence explanation of the overall allocation"
}

CRITICAL: The amounts MUST sum to exactly $${gapDollars.toLocaleString()}. Use integers only.`;

  interface AIResponse {
    costItems: Array<{ label: string; amount: number; description: string }>;
    reasoning: string;
  }

  function validate(parsed: unknown): ValidationResult<AIResponse> {
    const p = parsed as Record<string, unknown>;
    if (!Array.isArray(p.costItems) || p.costItems.length === 0) {
      return { valid: false, partial: p, errors: ["costItems must be a non-empty array"] };
    }
    const items = p.costItems as Array<Record<string, unknown>>;
    for (const item of items) {
      if (!item.label || typeof item.amount !== "number" || !item.description) {
        return { valid: false, partial: p, errors: ["Each cost item needs label, amount (number), and description"] };
      }
    }
    const sum = items.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    if (Math.abs(sum - gapDollars) > 5) {
      // Fix: scale items to hit exact target
      const scale = gapDollars / sum;
      let running = 0;
      for (let i = 0; i < items.length - 1; i++) {
        items[i].amount = Math.round(Number(items[i].amount) * scale);
        running += Number(items[i].amount);
      }
      // Last item absorbs remainder
      items[items.length - 1].amount = gapDollars - running;
    }
    return {
      valid: true,
      data: {
        costItems: items.map((c) => ({
          label: String(c.label),
          amount: Number(c.amount),
          description: String(c.description),
        })),
        reasoning: String(p.reasoning || ""),
      },
    };
  }

  const aiResult = await validatedAICall<AIResponse>({
    label: "[OfferCostDecomposition]",
    primary: {
      model: "gpt-4o-mini",
      systemPrompt,
      userPrompt,
      temperature: 0.2,
      maxTokens: 800,
    },
    validate,
    buildFollowUp: (_partial, errors) =>
      `Your previous response had issues: ${errors.join("; ")}. Please return the corrected JSON with costItems that sum to exactly $${gapDollars.toLocaleString()}.`,
    simplified: {
      model: "gpt-4o",
      buildPrompt: () =>
        `Break down $${gapDollars.toLocaleString()} in dealer acquisition costs for a ${vehicleDesc} into: reconditioning, holding cost (${daysOnMarket} days), transaction/compliance, and depreciation. Amounts MUST sum to exactly $${gapDollars.toLocaleString()}. Return JSON: { "costItems": [{ "label": string, "amount": integer, "description": string }], "reasoning": string }`,
    },
    emergencyFallback: () => deterministicDecomposition(totalGap, daysOnMarket, valuationCents, vehicle.bodyStyle),
  });

  return {
    ...aiResult,
    result: {
      valuationCents,
      offerCents,
      reconCents,
      costItems: aiResult.result.costItems.map((c) => ({
        label: c.label,
        amountCents: c.amount * 100,
        description: c.description,
      })),
      totalCostsCents: aiResult.result.costItems.reduce((s, c) => s + c.amount, 0) * 100,
      reasoning: aiResult.result.reasoning,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Tier 3: Deterministic Fallback                                     */
/* ------------------------------------------------------------------ */

interface FallbackResponse {
  costItems: Array<{ label: string; amount: number; description: string }>;
  reasoning: string;
}

function deterministicDecomposition(
  gapCents: number,
  daysOnMarket: number,
  vehicleValueCents: number,
  bodyStyle: string | null,
): FallbackResponse {
  const gapDollars = Math.round(gapCents / 100);
  const bs = (bodyStyle || "").toLowerCase();
  const isTruck = bs.includes("truck") || bs.includes("pickup");
  const isLuxury = bs.includes("luxury");

  // Proportional allocation
  const recondPct = isTruck ? 0.35 : isLuxury ? 0.40 : 0.32;
  const holdingPct = 0.22;
  const transactionPct = 0.16;
  // Depreciation = remainder

  const reconditioning = Math.round(gapDollars * recondPct);
  const holding = Math.round(gapDollars * holdingPct);
  const transaction = Math.round(gapDollars * transactionPct);
  const depreciation = gapDollars - reconditioning - holding - transaction;

  const dailyRate = Math.round(vehicleValueCents * 0.00013 / 100);
  const items: FallbackResponse["costItems"] = [];

  if (reconditioning > 0) {
    items.push({
      label: "Reconditioning & certification",
      amount: reconditioning,
      description: "Detail, safety inspection, cosmetic prep",
    });
  }
  if (holding > 0) {
    items.push({
      label: "Holding cost",
      amount: holding,
      description: `Est. ${daysOnMarket} days at ~$${dailyRate}/day`,
    });
  }
  if (transaction > 0) {
    items.push({
      label: "Transaction & compliance",
      amount: transaction,
      description: "Title, transport, advertising, registration",
    });
  }
  if (depreciation > 0) {
    items.push({
      label: "Market depreciation during hold",
      amount: depreciation,
      description: `Est. ${(daysOnMarket / 30).toFixed(1)} months of depreciation`,
    });
  }

  return {
    costItems: items,
    reasoning: "Cost allocation based on industry averages for this vehicle segment.",
  };
}
