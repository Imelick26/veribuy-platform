/**
 * AI-Powered Reconditioning Cost Estimation
 *
 * Replaces simple average of finding low/high cost ranges with
 * contextual AI analysis that considers:
 *   - Local labor rates (ZIP-based)
 *   - Vehicle-specific parts costs
 *   - Independent shop vs dealer rates
 *   - Overlap between repair items (bundled labor)
 *
 * Cost: ~$0.03-0.06 per call (GPT-4o, structured output)
 */

import { validatedAICall, type AIResult, type ValidationResult } from "./validate-and-retry";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ReconEstimatorInput {
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    engine?: string | null;
  };
  zip: string;
  mileage?: number;
  findings: {
    title: string;
    observedCondition?: string;
    costLow?: number;
    costHigh?: number;
    category?: string;
    severity?: string;
  }[];
  baseMarketValue: number;
}

export interface ReconItemizedCost {
  finding: string;
  estimatedCostCents: number;
  laborHours?: number;
  partsEstimate?: number;
  shopType: string;
  reasoning: string;
}

export interface ReconEstimatorResult {
  totalReconCost: number;
  itemizedCosts: ReconItemizedCost[];
  laborRateContext: string;
  totalReasoning: string;
}

/* ------------------------------------------------------------------ */
/*  Core Function                                                      */
/* ------------------------------------------------------------------ */

export async function estimateReconCosts(
  input: ReconEstimatorInput,
): Promise<AIResult<ReconEstimatorResult>> {
  const { vehicle, zip, mileage, findings, baseMarketValue } = input;

  // If no findings, return zero
  if (findings.length === 0) {
    return {
      result: {
        totalReconCost: 0,
        itemizedCosts: [],
        laborRateContext: "No findings to estimate",
        totalReasoning: "No confirmed issues — zero reconditioning cost",
      },
      aiAnalyzed: false,
      fallbackTier: 1,
      retried: false,
      model: "skip",
    };
  }

  const vehicleDesc = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}${vehicle.engine ? `, ${vehicle.engine}` : ""}`;

  const findingsTable = findings.map((f, i) => {
    const parts = [
      `${i + 1}. "${f.title}"`,
      f.observedCondition ? `Condition: ${f.observedCondition}` : null,
      f.severity ? `Severity: ${f.severity}` : null,
      f.costLow !== undefined && f.costHigh !== undefined
        ? `Estimated range: $${(f.costLow / 100).toFixed(0)}-$${(f.costHigh / 100).toFixed(0)}`
        : null,
    ].filter(Boolean);
    return parts.join(" | ");
  }).join("\n");

  return validatedAICall<ReconEstimatorResult>({
    label: "[ReconEstimator]",

    primary: {
      model: "gpt-4o",
      systemPrompt: `You are an automotive repair cost estimator. Your job is to produce realistic reconditioning cost estimates for confirmed vehicle issues.

Key principles:
- Estimate for INDEPENDENT SHOP rates, not dealer. Most used vehicle buyers use independent mechanics.
- Consider labor rate variations by ZIP code (urban = higher, rural = lower).
- Account for parts availability: common vehicles = cheap parts, European luxury = expensive.
- Identify opportunities for bundled labor: if you're already pulling the engine cover for one repair, adjacent work is cheaper.
- Be realistic: don't inflate costs, don't minimize them. Buyers need accurate estimates to negotiate.
- All costs should be in CENTS (multiply dollars by 100).

Labor rate guidelines (independent shops):
- Rural: $65-85/hr
- Suburban: $75-100/hr
- Urban: $90-130/hr
- Coastal metro (NYC, SF, LA): $110-160/hr`,
      userPrompt: `Estimate reconditioning costs for:

VEHICLE: ${vehicleDesc}
LOCATION: ZIP ${zip}${mileage ? `\nMILEAGE: ${mileage.toLocaleString()} miles` : ""}
BASE MARKET VALUE: $${baseMarketValue.toLocaleString()}

CONFIRMED ISSUES:
${findingsTable}

Return a JSON object with:
1. "totalReconCost": Total estimated cost in CENTS (e.g., 285000 = $2,850).

2. "itemizedCosts": Array of per-issue estimates:
   [{ "finding": string, "estimatedCostCents": number, "laborHours": number, "partsEstimate": number (cents), "shopType": "independent"|"dealer"|"diy", "reasoning": string }]

3. "laborRateContext": 1 sentence about labor rates in this area.

4. "totalReasoning": 2-3 sentences summarizing the reconditioning scope.

Return ONLY valid JSON.`,
      temperature: 0.1,
      maxTokens: 1200,
    },

    validate: (parsed: unknown): ValidationResult<ReconEstimatorResult> => {
      const p = parsed as Record<string, unknown>;
      const errors: string[] = [];

      let totalCost = Number(p.totalReconCost);
      if (isNaN(totalCost) || totalCost < 0) {
        errors.push("totalReconCost missing or negative");
      }

      // Detect if costs are in dollars instead of cents (< 10000 cents = $100, likely dollars)
      if (totalCost > 0 && totalCost < 500 && findings.length > 0) {
        // Likely in dollars, convert to cents
        totalCost = totalCost * 100;
      }

      // Cap at base market value
      if (totalCost > baseMarketValue * 100) {
        totalCost = Math.round(baseMarketValue * 100);
      }

      if (!Array.isArray(p.itemizedCosts)) {
        errors.push("itemizedCosts must be an array");
      }

      if (!p.totalReasoning || typeof p.totalReasoning !== "string") {
        errors.push("totalReasoning missing");
      }

      if (errors.length > 0) {
        return { valid: false, partial: p, errors };
      }

      const items: ReconItemizedCost[] = (p.itemizedCosts as Record<string, unknown>[])
        .map((item) => {
          let cost = Number(item.estimatedCostCents) || 0;
          // Auto-detect dollars vs cents
          if (cost > 0 && cost < 500 && totalCost > 10000) {
            cost = cost * 100;
          }
          return {
            finding: String(item.finding || ""),
            estimatedCostCents: Math.max(0, Math.round(cost)),
            laborHours: item.laborHours ? Number(item.laborHours) : undefined,
            partsEstimate: item.partsEstimate ? Math.round(Number(item.partsEstimate)) : undefined,
            shopType: String(item.shopType || "independent"),
            reasoning: String(item.reasoning || ""),
          };
        });

      return {
        valid: true,
        data: {
          totalReconCost: Math.round(totalCost),
          itemizedCosts: items,
          laborRateContext: String(p.laborRateContext || ""),
          totalReasoning: String(p.totalReasoning),
        },
      };
    },

    buildFollowUp: (partial, errors) => {
      return `Your response had issues: ${errors.join("; ")}. IMPORTANT: All costs must be in CENTS (e.g., $2,850 = 285000 cents). Please return corrected JSON with totalReconCost (cents), itemizedCosts (array), laborRateContext (string), totalReasoning (string). JSON only.`;
    },

    simplified: {
      model: "gpt-4o",
      buildPrompt: () => {
        const issueList = findings.map((f) => f.title).join("; ");
        return `Estimate total repair cost in CENTS for a ${vehicleDesc} in ZIP ${zip} with these issues: ${issueList}. Return JSON: { "totalReconCost": number (in cents), "itemizedCosts": [{ "finding": string, "estimatedCostCents": number, "shopType": string, "reasoning": string }], "laborRateContext": string, "totalReasoning": string }`;
      },
    },

    emergencyFallback: () => {
      // Simple average of low/high ranges
      let totalLow = 0;
      let totalHigh = 0;
      for (const f of findings) {
        totalLow += f.costLow || 0;
        totalHigh += f.costHigh || 0;
      }
      const avgCost = Math.round((totalLow + totalHigh) / 2);

      return {
        totalReconCost: avgCost,
        itemizedCosts: findings.map((f) => ({
          finding: f.title,
          estimatedCostCents: Math.round(((f.costLow || 0) + (f.costHigh || 0)) / 2),
          shopType: "independent",
          reasoning: "Emergency fallback — average of low/high cost range",
        })),
        laborRateContext: "Emergency fallback — no labor rate analysis available",
        totalReasoning: "Emergency fallback — used average of inspection cost ranges",
      };
    },
  });
}
