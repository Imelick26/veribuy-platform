/**
 * Market Valuation Engine
 *
 * Calculates a fair purchase price for a vehicle based on:
 *   1. Market baseline (VinAudit mileage-adjusted estimate)
 *   2. Condition multiplier (smooth curve from inspection score)
 *   3. History multiplier (title, accidents, owners, damage, recalls)
 *   4. Reconditioning cost (subtracted as dollar amount)
 *
 * All tunable constants are exported at the top for easy calibration.
 */

/* ------------------------------------------------------------------ */
/*  Tunable Constants — adjust these during calibration                */
/* ------------------------------------------------------------------ */

/**
 * Condition score → multiplier anchor points.
 * Linear interpolation between points gives a smooth curve.
 * Score 85 = 1.00 baseline (very good condition).
 */
export const CONDITION_ANCHORS: [number, number][] = [
  [100, 1.05],
  [95, 1.05],
  [90, 1.02],
  [85, 1.00],
  [80, 0.97],
  [75, 0.93],
  [70, 0.89],
  [65, 0.84],
  [60, 0.78],
  [55, 0.72],
  [50, 0.65],
  [45, 0.57],
  [40, 0.50],
  [35, 0.40],
  [0, 0.30],
];

/** Title status → multiplier */
export const TITLE_FACTORS: Record<string, number> = {
  CLEAN: 1.0,
  REBUILT: 0.75,
  SALVAGE: 0.55,
};

/** Accident count → multiplier */
export const ACCIDENT_FACTORS: Record<number, number> = {
  0: 1.0,
  1: 0.90,
  2: 0.80,
};
export const ACCIDENT_FACTOR_3_PLUS = 0.70;

/** Owner count → multiplier */
export const OWNER_FACTORS: Record<number, number> = {
  1: 1.0,
  2: 1.0,
  3: 0.97,
  4: 0.94,
};
export const OWNER_FACTOR_5_PLUS = 0.90;

/** Binary damage flags */
export const STRUCTURAL_DAMAGE_FACTOR = 0.75;
export const FLOOD_DAMAGE_FACTOR = 0.50;

/** Open recall count → multiplier */
export const RECALL_FACTORS: Record<string, number> = {
  NONE: 1.0,
  LOW: 0.98,   // 1-2 open recalls
  HIGH: 0.95,  // 3+ open recalls
};

/**
 * Price band discounts from fair market value.
 * Strong Buy  = pay ≤ 85% of fair value → 15%+ below market
 * Fair Buy    = pay ≤ 95% of fair value → up to 5% below market
 * Overpaying  = pay ≤ 105% of fair value → slightly above market
 * Pass        = pay > 105% of fair value → walk away
 */
export const BAND_STRONG_BUY = 0.85;  // ≤ 85% of fair value
export const BAND_FAIR_BUY = 0.95;    // ≤ 95% of fair value
export const BAND_OVERPAYING = 1.05;  // ≤ 105% of fair value
// Anything above BAND_OVERPAYING = PASS

/** Minimum offer floor — fair price will never drop below this fraction of base value */
export const MIN_OFFER_FLOOR_PERCENT = 0.05; // 5% of base market value

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface HistoryData {
  titleStatus: string;       // "CLEAN" | "REBUILT" | "SALVAGE"
  accidentCount: number;
  ownerCount: number;
  structuralDamage: boolean;
  floodDamage: boolean;
  openRecallCount: number;
}

export interface FairPriceResult {
  fairPurchasePrice: number;       // cents — final fair price
  baseMarketValue: number;         // cents — VinAudit baseline
  conditionMultiplier: number;
  conditionGrade: string;
  historyMultiplier: number;       // combined product of all history factors
  historyBreakdown: {
    titleFactor: number;
    accidentFactor: number;
    ownerFactor: number;
    structuralDamageFactor: number;
    floodDamageFactor: number;
    recallFactor: number;
  };
  adjustedValueBeforeRecon: number; // cents — before subtracting recon
  estReconCost: number;            // cents — subtracted
}

export type BuyRecommendation = "STRONG_BUY" | "FAIR_BUY" | "OVERPAYING" | "PASS";

/** Price band — a max purchase price for a given recommendation tier */
export interface PriceBand {
  label: BuyRecommendation;
  maxPriceCents: number;       // buy at or below this price for this tier
  marginPercent: number;       // margin you'd get at this price point
}

export interface DealEconomics {
  fairMarketValue: number;     // cents — what the car is actually worth
  estRetailPrice: number;      // cents — what you can sell it for
  priceBands: PriceBand[];     // price tiers (STRONG_BUY → PASS)
  /** If an asking price is provided, which band does it fall into? */
  askingPrice?: number;        // cents
  askingPriceVerdict?: BuyRecommendation;
}

/** Legacy single-recommendation interface (kept for backward compat) */
export interface LegacyDealEconomics {
  fairPurchasePrice: number;  // cents
  estRetailPrice: number;     // cents
  grossMargin: number;        // cents
  marginPercent: number;      // 0-1 decimal
  recommendation: BuyRecommendation;
}

export type ConditionGrade =
  | "EXCELLENT"
  | "VERY_GOOD"
  | "GOOD"
  | "FAIR"
  | "POOR"
  | "SALVAGE";

/* ------------------------------------------------------------------ */
/*  Core Functions                                                     */
/* ------------------------------------------------------------------ */

/**
 * Interpolates a value from the condition anchor table.
 * Uses linear interpolation between the two nearest anchor points.
 */
export function interpolateConditionMultiplier(score: number): number {
  // Clamp score to 0-100
  const s = Math.max(0, Math.min(100, score));

  // Find the two surrounding anchor points
  for (let i = 0; i < CONDITION_ANCHORS.length - 1; i++) {
    const [scoreHigh, multHigh] = CONDITION_ANCHORS[i];
    const [scoreLow, multLow] = CONDITION_ANCHORS[i + 1];

    if (s >= scoreLow && s <= scoreHigh) {
      // Linear interpolation
      const t = (s - scoreLow) / (scoreHigh - scoreLow);
      return multLow + t * (multHigh - multLow);
    }
  }

  // Fallback (shouldn't hit with proper anchors)
  return CONDITION_ANCHORS[CONDITION_ANCHORS.length - 1][1];
}

/**
 * Get the title factor for a given title status string.
 */
function getTitleFactor(titleStatus: string): number {
  const normalized = titleStatus.toUpperCase();
  if (normalized.includes("SALVAGE")) return TITLE_FACTORS.SALVAGE;
  if (normalized.includes("REBUILT")) return TITLE_FACTORS.REBUILT;
  return TITLE_FACTORS.CLEAN;
}

/**
 * Get the accident factor for a given count.
 */
function getAccidentFactor(count: number): number {
  if (count >= 3) return ACCIDENT_FACTOR_3_PLUS;
  return ACCIDENT_FACTORS[count] ?? 1.0;
}

/**
 * Get the owner factor for a given count.
 */
function getOwnerFactor(count: number): number {
  if (count >= 5) return OWNER_FACTOR_5_PLUS;
  return OWNER_FACTORS[count] ?? 1.0;
}

/**
 * Get the recall factor for a given open recall count.
 */
function getRecallFactor(openRecalls: number): number {
  if (openRecalls >= 3) return RECALL_FACTORS.HIGH;
  if (openRecalls >= 1) return RECALL_FACTORS.LOW;
  return RECALL_FACTORS.NONE;
}

/**
 * Calculate the fair purchase price for a vehicle.
 *
 * @param basePriceCents      - Market value in cents (already mileage-adjusted)
 * @param conditionScore      - Overall condition score 0-100
 * @param history             - Vehicle history data (title, accidents, owners, damage)
 * @param reconCostCents      - Estimated reconditioning cost in cents (avg of low/high)
 * @param conditionAttenuation - How much of the condition multiplier to apply (0-1).
 *                               Use 0.4 when the base price already comes from a
 *                               condition-tiered source (VehicleDatabases) to avoid
 *                               double-counting condition adjustments.
 *                               Use 1.0 for sources that don't account for condition.
 */
export function calculateFairPrice(
  basePriceCents: number,
  conditionScore: number,
  history: HistoryData,
  reconCostCents: number = 0,
  conditionAttenuation: number = 1.0,
): FairPriceResult {
  // Condition multiplier (smooth curve), attenuated if source already accounts for condition
  const rawConditionMultiplier = interpolateConditionMultiplier(conditionScore);
  // Attenuate: blend between 1.0 (no adjustment) and raw multiplier
  // attenuation=1.0 → full multiplier, attenuation=0.0 → always 1.0
  const conditionMultiplier = 1.0 + (rawConditionMultiplier - 1.0) * conditionAttenuation;

  // History factors
  const titleFactor = getTitleFactor(history.titleStatus);
  const accidentFactor = getAccidentFactor(history.accidentCount);
  const ownerFactor = getOwnerFactor(history.ownerCount);
  const structuralDamageFactor = history.structuralDamage ? STRUCTURAL_DAMAGE_FACTOR : 1.0;
  const floodDamageFactor = history.floodDamage ? FLOOD_DAMAGE_FACTOR : 1.0;
  const recallFactor = getRecallFactor(history.openRecallCount);

  // Combined history multiplier
  const historyMultiplier =
    titleFactor *
    accidentFactor *
    ownerFactor *
    structuralDamageFactor *
    floodDamageFactor *
    recallFactor;

  // Adjusted value before recon
  const adjustedValueBeforeRecon = Math.round(
    basePriceCents * conditionMultiplier * historyMultiplier,
  );

  // Fair purchase price = adjusted value - recon cost
  // Never drop below MIN_OFFER_FLOOR_PERCENT of the base value (offer must never be $0)
  const minFloor = Math.round(basePriceCents * MIN_OFFER_FLOOR_PERCENT);
  const fairPurchasePrice = Math.max(minFloor, adjustedValueBeforeRecon - reconCostCents);

  return {
    fairPurchasePrice,
    baseMarketValue: basePriceCents,
    conditionMultiplier,
    conditionGrade: getConditionGrade(conditionScore),
    historyMultiplier,
    historyBreakdown: {
      titleFactor,
      accidentFactor,
      ownerFactor,
      structuralDamageFactor,
      floodDamageFactor,
      recallFactor,
    },
    adjustedValueBeforeRecon,
    estReconCost: reconCostCents,
  };
}

/**
 * Calculate deal economics with price bands.
 *
 * Returns price tiers based on the car's fair market value so the dealer knows:
 *   "This car is worth $X. Buy at ≤ $Y for a strong deal," etc.
 *
 * Bands are percentages of fair market value:
 *   Strong Buy  ≤ 85% of fair value (great deal, well below market)
 *   Fair Buy    ≤ 95% of fair value (solid, slightly below market)
 *   Overpaying  ≤ 105% of fair value (paying above market, thin margin)
 *   Pass        > 105% of fair value (walk away)
 *
 * @param fairMarketValueCents - Fair market value in cents (from calculateFairPrice)
 * @param retailPriceCents - Estimated retail/resale price in cents
 * @param conditionScore - Overall condition score 0-100
 * @param history - Vehicle history data for deal-breaker flags
 * @param askingPriceCents - Optional: the seller's asking price to evaluate
 */
export function calculateDealEconomics(
  fairMarketValueCents: number,
  retailPriceCents: number,
  conditionScore: number,
  history: HistoryData,
  askingPriceCents?: number,
): DealEconomics {
  // Price bands based on fair market value
  const strongBuyMax = Math.round(fairMarketValueCents * BAND_STRONG_BUY);
  const fairBuyMax = Math.round(fairMarketValueCents * BAND_FAIR_BUY);
  const overpayingMax = Math.round(fairMarketValueCents * BAND_OVERPAYING);

  const priceBands: PriceBand[] = [
    { label: "STRONG_BUY", maxPriceCents: strongBuyMax, marginPercent: 1 - BAND_STRONG_BUY },
    { label: "FAIR_BUY", maxPriceCents: fairBuyMax, marginPercent: 1 - BAND_FAIR_BUY },
    { label: "OVERPAYING", maxPriceCents: overpayingMax, marginPercent: 0 },
    { label: "PASS", maxPriceCents: overpayingMax, marginPercent: 0 },
  ];

  // Check for deal-breaker flags that force PASS regardless of price
  const hasDealBreaker =
    conditionScore < 40 ||
    history.floodDamage ||
    history.titleStatus.toUpperCase().includes("SALVAGE");

  // Evaluate asking price against bands
  let askingPriceVerdict: BuyRecommendation | undefined;
  if (askingPriceCents !== undefined) {
    if (hasDealBreaker) {
      askingPriceVerdict = "PASS";
    } else if (askingPriceCents <= strongBuyMax) {
      askingPriceVerdict = "STRONG_BUY";
    } else if (askingPriceCents <= fairBuyMax) {
      askingPriceVerdict = "FAIR_BUY";
    } else if (askingPriceCents <= overpayingMax) {
      askingPriceVerdict = "OVERPAYING";
    } else {
      askingPriceVerdict = "PASS";
    }
  }

  return {
    fairMarketValue: fairMarketValueCents,
    estRetailPrice: retailPriceCents,
    priceBands,
    askingPrice: askingPriceCents,
    askingPriceVerdict,
  };
}

/**
 * Legacy helper: evaluate a single asking price and return the old-style recommendation.
 * Use this where the old interface is expected.
 */
export function evaluateAskingPrice(
  fairMarketValueCents: number,
  retailPriceCents: number,
  conditionScore: number,
  history: HistoryData,
  askingPriceCents: number,
): LegacyDealEconomics {
  const econ = calculateDealEconomics(
    fairMarketValueCents, retailPriceCents, conditionScore, history, askingPriceCents,
  );
  const grossMargin = retailPriceCents - askingPriceCents;
  const marginPercent = retailPriceCents > 0 ? grossMargin / retailPriceCents : 0;

  return {
    fairPurchasePrice: askingPriceCents,
    estRetailPrice: retailPriceCents,
    grossMargin,
    marginPercent,
    recommendation: econ.askingPriceVerdict ?? "PASS",
  };
}

/**
 * Map a condition score to a human-readable grade.
 */
export function getConditionGrade(score: number): ConditionGrade {
  if (score >= 90) return "EXCELLENT";
  if (score >= 78) return "VERY_GOOD";
  if (score >= 65) return "GOOD";
  if (score >= 50) return "FAIR";
  if (score >= 35) return "POOR";
  return "SALVAGE";
}
