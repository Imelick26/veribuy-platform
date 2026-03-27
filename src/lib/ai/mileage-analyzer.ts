/**
 * AI-Powered Mileage Normalization for Comparable Listings
 *
 * Uses GPT-4o-mini to analyze comparable listings and determine:
 *   1. Vehicle-specific per-mile depreciation rate
 *   2. Which comps are outliers (wrong trim, rebuilt, etc.)
 *   3. Fair market value at the subject vehicle's exact mileage
 *
 * This is far more accurate than generic $/mile formulas because GPT
 * understands that a Raptor holds value differently than a base F-150,
 * a diesel truck differently than gas, a weekend sports car differently
 * than a commuter sedan.
 *
 * Cost: ~$0.01-0.02 per call (GPT-4o-mini, small structured I/O)
 */

import { getOpenAI } from "@/lib/openai";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MileageAnalysisInput {
  /** Subject vehicle details */
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    engine?: string | null;
    drivetrain?: string | null;
    transmission?: string | null;
  };
  /** Subject vehicle mileage */
  subjectMileage: number;
  /** Comparable listings from MarketCheck */
  comps: {
    title: string;
    price: number;
    mileage: number;
    daysOnMarket?: number;
  }[];
}

export interface MileageAnalysisResult {
  /** Per-mile depreciation rate in dollars (e.g., 0.12 = $0.12/mile) */
  perMileRate: number;
  /** Estimated fair market value at the subject's mileage (dollars) */
  adjustedValue: number;
  /** Low end of range at subject mileage */
  adjustedLow: number;
  /** High end of range at subject mileage */
  adjustedHigh: number;
  /** Indices of comps flagged as outliers (0-based) */
  outlierIndices: number[];
  /** Brief reasoning from GPT */
  reasoning: string;
  /** Whether AI analysis was used (false = fell back to regression) */
  aiAnalyzed: boolean;
}

/* ------------------------------------------------------------------ */
/*  Core Function                                                      */
/* ------------------------------------------------------------------ */

/**
 * Analyze comparable listings with AI to determine mileage-adjusted
 * fair market value for the subject vehicle.
 *
 * Falls back to regression-based analysis if GPT call fails.
 */
export async function analyzeMileageComps(
  input: MileageAnalysisInput,
): Promise<MileageAnalysisResult> {
  // Need at least 3 comps with mileage data for meaningful analysis
  const validComps = input.comps.filter((c) => c.price > 0 && c.mileage > 0);
  if (validComps.length < 3) {
    return regressionFallback(input);
  }

  try {
    const openai = getOpenAI();

    // Format comps as a compact table for the prompt
    const compTable = validComps
      .map((c, i) => `${i + 1}. "${c.title}" — $${c.price.toLocaleString()} — ${c.mileage.toLocaleString()} mi${c.daysOnMarket ? ` — ${c.daysOnMarket}d listed` : ""}`)
      .join("\n");

    const vehicleDesc = [
      `${input.vehicle.year} ${input.vehicle.make} ${input.vehicle.model}`,
      input.vehicle.trim,
      input.vehicle.engine,
      input.vehicle.drivetrain,
      input.vehicle.transmission,
    ].filter(Boolean).join(", ");

    const prompt = `You are a vehicle pricing analyst. Analyze these comparable dealer listings and determine the fair market value for the subject vehicle at its specific mileage.

SUBJECT VEHICLE: ${vehicleDesc}
SUBJECT MILEAGE: ${input.subjectMileage.toLocaleString()} miles

COMPARABLE LISTINGS:
${compTable}

Analyze these comps and return a JSON object with:

1. "perMileRate": The per-mile depreciation rate in dollars for THIS specific vehicle. Consider:
   - Vehicle category (trucks hold value better per-mile than sedans)
   - Performance/enthusiast factor (Raptors, TRD Pros, etc. depreciate less per mile)
   - Diesel vs gas (diesels depreciate less per mile)
   - Age of vehicle (newer = higher per-mile rate)
   - Typical range: $0.03-0.25/mile

2. "adjustedValue": Your best estimate of fair private-party market value at exactly ${input.subjectMileage.toLocaleString()} miles. Normalize each non-outlier comp to the subject mileage using the perMileRate, then take the median.

3. "adjustedLow": Conservative (15th percentile) estimate at subject mileage.

4. "adjustedHigh": Optimistic (85th percentile) estimate at subject mileage.

5. "outlierIndices": Array of 1-based comp numbers that should be excluded (wrong trim mixed in, likely rebuilt/salvage priced too low, dealer markup outlier priced too high, etc.). Be selective — only flag clear outliers.

6. "reasoning": One sentence explaining your per-mile rate choice and any outliers flagged.

Return ONLY valid JSON, no markdown.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("[MileageAnalyzer] Empty GPT response — falling back to regression");
      return regressionFallback(input);
    }

    const parsed = JSON.parse(content) as {
      perMileRate: number;
      adjustedValue: number;
      adjustedLow: number;
      adjustedHigh: number;
      outlierIndices: number[];
      reasoning: string;
    };

    // Sanity checks
    if (
      !parsed.perMileRate || parsed.perMileRate < 0.01 || parsed.perMileRate > 0.50 ||
      !parsed.adjustedValue || parsed.adjustedValue < 500
    ) {
      console.warn("[MileageAnalyzer] GPT returned implausible values — falling back");
      return regressionFallback(input);
    }

    // Convert 1-based indices to 0-based
    const outlierIndices = (parsed.outlierIndices || [])
      .map((i) => i - 1)
      .filter((i) => i >= 0 && i < validComps.length);

    console.log(
      `[MileageAnalyzer] AI: $${parsed.perMileRate.toFixed(3)}/mi → $${parsed.adjustedValue.toLocaleString()} ` +
      `(${outlierIndices.length} outliers) — ${parsed.reasoning}`,
    );

    return {
      perMileRate: parsed.perMileRate,
      adjustedValue: Math.round(parsed.adjustedValue),
      adjustedLow: Math.round(parsed.adjustedLow),
      adjustedHigh: Math.round(parsed.adjustedHigh),
      outlierIndices,
      reasoning: parsed.reasoning,
      aiAnalyzed: true,
    };
  } catch (err) {
    console.warn(`[MileageAnalyzer] GPT call failed: ${err instanceof Error ? err.message : err}`);
    return regressionFallback(input);
  }
}

/* ------------------------------------------------------------------ */
/*  Regression Fallback                                                */
/* ------------------------------------------------------------------ */

function regressionFallback(input: MileageAnalysisInput): MileageAnalysisResult {
  const validComps = input.comps.filter((c) => c.price > 0 && c.mileage > 0);

  if (validComps.length === 0) {
    return {
      perMileRate: 0.10,
      adjustedValue: 0,
      adjustedLow: 0,
      adjustedHigh: 0,
      outlierIndices: [],
      reasoning: "No valid comps for analysis",
      aiAnalyzed: false,
    };
  }

  // Derive per-mile rate from regression or industry standard
  const perMileRate = regressPerMileRate(validComps);

  // Normalize each comp to subject mileage
  const normalized = validComps.map((c) => {
    const delta = c.mileage - input.subjectMileage;
    const adj = Math.round(delta * perMileRate);
    return Math.max(c.price * 0.5, c.price + adj);
  }).sort((a, b) => a - b);

  const adjustedValue = normalized[Math.floor(normalized.length / 2)];
  const adjustedLow = normalized[Math.floor(normalized.length * 0.15)] || normalized[0];
  const adjustedHigh = normalized[Math.floor(normalized.length * 0.85)] || normalized[normalized.length - 1];

  return {
    perMileRate,
    adjustedValue,
    adjustedLow,
    adjustedHigh,
    outlierIndices: [],
    reasoning: "Regression fallback — AI analysis unavailable",
    aiAnalyzed: false,
  };
}

function regressPerMileRate(comps: { price: number; mileage: number }[]): number {
  if (comps.length >= 5) {
    const mileages = comps.map((c) => c.mileage);
    const spread = Math.max(...mileages) - Math.min(...mileages);

    if (spread >= 15000) {
      const n = comps.length;
      const sumX = comps.reduce((s, c) => s + c.mileage, 0);
      const sumY = comps.reduce((s, c) => s + c.price, 0);
      const sumXY = comps.reduce((s, c) => s + c.mileage * c.price, 0);
      const sumX2 = comps.reduce((s, c) => s + c.mileage * c.mileage, 0);
      const denom = n * sumX2 - sumX * sumX;

      if (denom !== 0) {
        const slope = (n * sumXY - sumX * sumY) / denom;
        if (slope < 0) {
          const rate = Math.abs(slope);
          if (rate >= 0.01 && rate <= 0.50) return rate;
        }
      }
    }
  }

  // Industry standard fallback by price tier
  const avgPrice = comps.reduce((s, c) => s + c.price, 0) / comps.length;
  if (avgPrice >= 60000) return 0.18;
  if (avgPrice >= 40000) return 0.14;
  if (avgPrice >= 25000) return 0.10;
  if (avgPrice >= 12000) return 0.07;
  return 0.04;
}
