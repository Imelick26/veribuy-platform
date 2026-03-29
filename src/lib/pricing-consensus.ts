/**
 * Pricing Consensus Engine (v2 — 6-Source)
 *
 * Combines estimates from multiple pricing sources into a single
 * consensus value using weighted median with outlier rejection.
 *
 * Source weights (tunable):
 *   BlackBook:          0.25 — wholesale gold standard, condition-tiered
 *   VehicleDatabases:   0.25 — condition-tiered retail, 12 price points
 *   NADA:               0.20 — dealer/lender standard, loan value
 *   VinAudit:           0.15 — VIN-specific with mileage adjustment
 *   MarketCheck:        0.10 — real dealer inventory (recency signal)
 *   Fallback:           0.05 — category curves (last resort)
 *
 * Consensus methods:
 *   "single"          — Only one source returned data
 *   "weighted-median"  — 2+ sources, use weighted median with outlier rejection
 *   "fallback"        — No API sources, using category curves only
 */

import type { VDBConditionTier, VDBTierPrices } from "./vehicledatabases";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type PricingSourceName =
  | "blackbook"
  | "vehicledatabases"
  | "nada"
  | "vinaudit"
  | "marketcheck"
  | "fallback";

export interface SourceEstimate {
  source: PricingSourceName;
  /** Private party value in dollars (primary comparison point) */
  estimatedValue: number;
  /** Trade-in value in dollars (may be 0 if source doesn't provide) */
  tradeInValue: number;
  /** Dealer retail value in dollars (may be 0 if source doesn't provide) */
  dealerRetailValue: number;
  /** Wholesale value in dollars (0 if source doesn't provide) */
  wholesaleValue: number;
  /** Loan value in dollars (0 if source doesn't provide — NADA-specific) */
  loanValue: number;
  /** Source-level confidence (0-1) */
  confidence: number;
  /** Whether this source provides condition-tiered pricing */
  isConditionTiered: boolean;
  /** Whether this source's value already accounts for trim/config premiums (diesel, manual, 4WD, etc.) */
  isConfigAware?: boolean;
  /** Raw data for debugging */
  raw?: unknown;
}

export interface PricingTraceStep {
  label: string;
  inputDollars: number;
  operation: string;       // "× 1.60", "- $2,400", "starting point"
  outputDollars: number;
  explanation: string;
}

export interface ConsensusResult {
  /** Consensus private party value (dollars) */
  estimatedValue: number;
  /** Consensus trade-in value (dollars) */
  tradeInValue: number;
  /** Consensus dealer retail value (dollars) */
  dealerRetailValue: number;
  /** Consensus wholesale value (dollars) */
  wholesaleValue: number;
  /** Consensus loan value (dollars) — from NADA or estimated */
  loanValue: number;
  /** Overall confidence (0-1) */
  confidence: number;
  /** Primary data source name */
  primarySource: PricingSourceName;
  /** Method used to calculate consensus */
  consensusMethod: "single" | "weighted-median" | "fallback";
  /** All source estimates that contributed */
  sourceResults: SourceEstimate[];
  /** Config premium mode recommendation */
  configPremiumMode: "full" | "partial" | "none";
  /** Condition attenuation factor (0-1) */
  conditionAttenuation: number;
  /** Number of sources that contributed data */
  sourceCount: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Default weights per source — total = 1.0 */
const SOURCE_WEIGHTS: Record<PricingSourceName, number> = {
  blackbook: 0.25,
  vehicledatabases: 0.25,
  nada: 0.20,
  vinaudit: 0.15,
  marketcheck: 0.10,
  fallback: 0.05,
};

/**
 * Outlier threshold — if a source's value is more than this % away from
 * the weighted median, its weight is halved.
 */
const OUTLIER_THRESHOLD = 0.40; // 40% deviation

/**
 * Minimum confidence boost when multiple sources agree (within 15%).
 */
const AGREEMENT_CONFIDENCE_BOOST = 0.10;

/* ------------------------------------------------------------------ */
/*  Condition Tier Mapping                                             */
/* ------------------------------------------------------------------ */

/**
 * Map an AI condition score (0-100) to a VehicleDatabases condition tier.
 *
 *   85-100 → Outstanding (exceptional, minimal wear)
 *   70-84  → Clean (good condition, normal wear)
 *   50-69  → Average (some issues, mechanical/cosmetic)
 *   0-49   → Rough (significant problems)
 */
export function mapConditionToTier(score: number): VDBConditionTier {
  if (score >= 85) return "Outstanding";
  if (score >= 70) return "Clean";
  if (score >= 50) return "Average";
  return "Rough";
}

/**
 * Select the appropriate prices from a VDB result based on condition score.
 */
export function selectTierPrices(
  tiers: Record<VDBConditionTier, VDBTierPrices>,
  conditionScore: number,
): { tier: VDBConditionTier; prices: VDBTierPrices } {
  const tier = mapConditionToTier(conditionScore);
  return { tier, prices: tiers[tier] };
}

/* ------------------------------------------------------------------ */
/*  Weighted Median                                                    */
/* ------------------------------------------------------------------ */

/**
 * Calculate the weighted median of a set of values.
 *
 * Unlike weighted mean, the weighted median is robust to outliers —
 * a single crazy value from one source won't skew the result.
 */
function weightedMedian(values: number[], weights: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  // Pair up and sort by value
  const pairs = values
    .map((v, i) => ({ value: v, weight: weights[i] }))
    .filter((p) => p.value > 0 && p.weight > 0)
    .sort((a, b) => a.value - b.value);

  if (pairs.length === 0) return 0;
  if (pairs.length === 1) return pairs[0].value;

  const totalWeight = pairs.reduce((s, p) => s + p.weight, 0);
  const halfWeight = totalWeight / 2;

  let cumWeight = 0;
  for (let i = 0; i < pairs.length; i++) {
    cumWeight += pairs[i].weight;
    if (cumWeight >= halfWeight) {
      // If we're exactly at the boundary and there's a next value, interpolate
      if (i > 0 && cumWeight - pairs[i].weight < halfWeight) {
        const prevWeight = cumWeight - pairs[i].weight;
        const t = (halfWeight - prevWeight) / pairs[i].weight;
        return Math.round(pairs[i - 1].value + t * (pairs[i].value - pairs[i - 1].value));
      }
      return pairs[i].value;
    }
  }

  return pairs[pairs.length - 1].value;
}

/* ------------------------------------------------------------------ */
/*  Consensus Calculator                                               */
/* ------------------------------------------------------------------ */

/**
 * Calculate consensus pricing from multiple source estimates.
 *
 * Uses weighted median with outlier penalty to produce robust pricing
 * that isn't thrown off by a single bad source.
 */
export function calculateConsensus(sources: SourceEstimate[]): ConsensusResult {
  // Filter to sources with actual data
  const validSources = sources.filter((s) => s.estimatedValue > 0);

  // ── No sources → absolute fallback ────────────────────────────
  if (validSources.length === 0) {
    return {
      estimatedValue: 0,
      tradeInValue: 0,
      dealerRetailValue: 0,
      wholesaleValue: 0,
      loanValue: 0,
      confidence: 0,
      primarySource: "fallback",
      consensusMethod: "fallback",
      sourceResults: sources,
      configPremiumMode: "full",
      conditionAttenuation: 1.0,
      sourceCount: 0,
    };
  }

  // ── Single source → use directly ─────────────────────────────
  if (validSources.length === 1) {
    const s = validSources[0];
    const hasConditionTiered = s.isConditionTiered;

    return {
      estimatedValue: s.estimatedValue,
      tradeInValue: s.tradeInValue || Math.round(s.estimatedValue * 0.82),
      dealerRetailValue: s.dealerRetailValue || Math.round(s.estimatedValue * 1.18),
      wholesaleValue: s.wholesaleValue || Math.round(s.estimatedValue * 0.72),
      loanValue: s.loanValue || Math.round(s.estimatedValue * 0.85),
      confidence: s.confidence,
      primarySource: s.source,
      consensusMethod: "single",
      sourceResults: sources,
      configPremiumMode: hasConditionTiered ? "partial" : "full",
      conditionAttenuation: hasConditionTiered ? 0.4 : 1.0,
      sourceCount: 1,
    };
  }

  // ── Multiple sources → weighted median with outlier rejection ──

  // Step 1: Calculate initial weights
  const weights = validSources.map((s) => SOURCE_WEIGHTS[s.source] * s.confidence);

  // Step 2: First-pass weighted median for private party values
  const ppValues = validSources.map((s) => s.estimatedValue);
  const initialMedian = weightedMedian(ppValues, weights);

  // Step 3: Outlier penalty — halve weight for sources > 40% away from median
  const adjustedWeights = weights.map((w, i) => {
    const deviation = Math.abs(ppValues[i] - initialMedian) / initialMedian;
    if (deviation > OUTLIER_THRESHOLD) {
      console.warn(
        `[Consensus] Outlier: ${validSources[i].source} = $${ppValues[i]} is ${(deviation * 100).toFixed(0)}% from median $${initialMedian}`,
      );
      return w * 0.5;
    }
    return w;
  });

  // Step 4: Final weighted median for all perspectives
  const estimatedValue = weightedMedian(ppValues, adjustedWeights);
  const tradeInValue = weightedMedian(
    validSources.map((s) => s.tradeInValue || Math.round(s.estimatedValue * 0.82)),
    adjustedWeights,
  );
  const dealerRetailValue = weightedMedian(
    validSources.map((s) => s.dealerRetailValue || Math.round(s.estimatedValue * 1.18)),
    adjustedWeights,
  );

  // Wholesale: only sources that provide it (BlackBook primarily)
  const wholesaleValues = validSources.map((s) => s.wholesaleValue || Math.round(s.estimatedValue * 0.72));
  const wholesaleValue = weightedMedian(wholesaleValues, adjustedWeights);

  // Loan value: prefer NADA's explicit loan value, otherwise estimate
  const loanValues = validSources.map((s) => s.loanValue || Math.round(s.estimatedValue * 0.85));
  const loanValue = weightedMedian(loanValues, adjustedWeights);

  // Step 5: Calculate overall confidence
  let confidence = validSources.reduce(
    (sum, s, i) => sum + s.confidence * adjustedWeights[i],
    0,
  ) / adjustedWeights.reduce((s, w) => s + w, 0);

  // Boost confidence if multiple sources agree (within 15%)
  const agreeing = validSources.filter(
    (s) => Math.abs(s.estimatedValue - estimatedValue) / estimatedValue < 0.15,
  );
  if (agreeing.length >= 3) {
    confidence = Math.min(0.98, confidence + AGREEMENT_CONFIDENCE_BOOST * 1.5);
  } else if (agreeing.length >= 2) {
    confidence = Math.min(0.98, confidence + AGREEMENT_CONFIDENCE_BOOST);
  }

  // Extra boost for having many sources (more sources = more confidence)
  if (validSources.length >= 4) {
    confidence = Math.min(0.98, confidence + 0.05);
  }

  // Step 6: Determine primary source (highest weight after adjustment)
  const primaryIdx = adjustedWeights.reduce(
    (maxIdx, w, i) => (w > adjustedWeights[maxIdx] ? i : maxIdx),
    0,
  );
  const primarySource = validSources[primaryIdx].source;

  // Step 7: Config premium mode — accounts for both condition-tiered AND config-aware sources
  const conditionTieredCount = validSources.filter((s) => s.isConditionTiered).length;
  const configAwareCount = validSources.filter((s) => s.isConfigAware).length;
  const totalSources = validSources.length;
  const primaryIsConditionTiered = validSources[primaryIdx].isConditionTiered;

  // If ALL sources are config-aware, their values already include config premiums → skip
  // If some are config-aware, reduce to partial. Otherwise check condition-tiered.
  let configPremiumMode: "full" | "partial" | "none";
  if (configAwareCount === totalSources) {
    configPremiumMode = "none";
  } else if (configAwareCount > 0 || conditionTieredCount >= 2) {
    configPremiumMode = "partial";
  } else if (conditionTieredCount >= 1) {
    configPremiumMode = "partial";
  } else {
    configPremiumMode = "full";
  }
  const conditionAttenuation = conditionTieredCount >= 2 ? 0.3 : primaryIsConditionTiered ? 0.4 : 1.0;

  return {
    estimatedValue,
    tradeInValue,
    dealerRetailValue,
    wholesaleValue,
    loanValue,
    confidence,
    primarySource,
    consensusMethod: "weighted-median",
    sourceResults: sources,
    configPremiumMode,
    conditionAttenuation,
    sourceCount: validSources.length,
  };
}
