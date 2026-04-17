/**
 * Market Data Fetcher (v5 — Black Book + AI Intelligence)
 *
 * Fetches vehicle market value from Black Book as the sole pricing source.
 * BB provides wholesale, retail, and trade-in values across 4 condition tiers
 * (rough / average / clean / extra_clean), plus mileage+region-adjusted variants.
 *
 * KEY INNOVATION: Condition score interpolation between BB tiers.
 * Instead of snapping to the nearest tier (creating $2,600 cliffs), we
 * interpolate smoothly between tier values. Every point of condition score
 * moves the price proportionally. This is VeriBuy's core value-add.
 *
 * AI Market Intelligence replaces the deterministic comp adjustment.
 * AI Fallback Valuation replaces crude hardcoded curves when BB has no data.
 *
 * BB Retail Market Insights provides comparable dealer inventory + sold stats
 * for market validation and dealer decision context.
 */

import {
  fetchBlackBookValuation,
  fetchBlackBookByYMM,
  fetchBlackBookRetailInsights,
  mapScoreToBBCondition,
  type BBValuation,
  type BBCondition,
  type BBRetailComp,
  type BBRetailInsightsResult,
} from "./blackbook";
import { analyzeMarketIntelligence, type MarketIntelligenceResult } from "./ai/market-intelligence";
import { estimateFallbackValuation } from "./ai/fallback-valuation";
import { reportSuccess, reportFailure, reportMissingKey } from "./api-health";
import { classifyBody, type VehicleConfig } from "./config-premiums";
import { zipToState } from "./geo-pricing";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AcquisitionType = "WHOLESALE" | "TRADE_IN";

export interface BBMarketDataResult {
  /** Full BB valuation (null if using AI fallback) */
  bbValuation: BBValuation | null;
  /** BB condition tier selected based on inspection score */
  conditionTier: BBCondition;
  /** Acquisition value in cents — adjustedWholesale[interpolated] or tradeIn[interpolated] */
  acquisitionValue: number;
  /** BB retail reference in cents — interpolated BB retail for this condition */
  retailValue: number;
  /** Market-validated retail in cents — BB retail adjusted by AI market intelligence */
  marketValidatedRetail: number;
  /** Wholesale value in cents — interpolated BB wholesale */
  wholesaleValue: number;
  /** Trade-in value in cents — interpolated BB trade-in */
  tradeInValue: number;
  /** Market adjustment multiplier from AI (1.0 = no adjustment) */
  marketAdjustment: number;
  /** Human-readable market adjustment explanation */
  marketAdjustmentNote: string;
  /** Market demand signal from AI */
  demandSignal: "strong" | "normal" | "weak";
  /** AI market intelligence flags for the dealer */
  marketFlags: string[];
  /** All BB retail values by tier (cents) */
  bbRetailByTier: Record<BBCondition, number>;
  /** All BB wholesale values by tier (cents) */
  bbWholesaleByTier: Record<BBCondition, number>;
  /** All BB trade-in values by tier (cents) — no extra_clean */
  bbTradeInByTier: { clean: number; average: number; rough: number };
  /** Private party values by tier (cents) — no extra_clean */
  bbPrivatePartyByTier: { clean: number; average: number; rough: number };
  /** Comparable listings from BB Retail Market Insights */
  comparables: BBRetailComp[];
  /** BB Retail Insights aggregate stats */
  retailInsights: BBRetailInsightsResult | null;
  /** "blackbook", "ai_fallback", or "emergency_fallback" */
  dataSource: "blackbook" | "ai_fallback" | "emergency_fallback";
  /** Confidence (0.90 for BB, varies for AI/emergency) */
  confidence: number;
}

/* ------------------------------------------------------------------ */
/*  Condition Score Interpolation                                      */
/* ------------------------------------------------------------------ */

/**
 * Tier boundaries: score ranges that map to each BB condition tier.
 *
 *   90-100 → extra_clean
 *   75-89  → clean
 *   50-74  → average
 *   0-49   → rough
 */
const TIER_BOUNDARIES: Array<{ tier: BBCondition; low: number; high: number }> = [
  { tier: "rough",       low: 0,  high: 49 },
  { tier: "average",     low: 50, high: 74 },
  { tier: "clean",       low: 75, high: 89 },
  { tier: "extra_clean", low: 90, high: 100 },
];

/**
 * Interpolate a value between BB condition tiers based on condition score.
 *
 * Instead of snapping to the nearest tier (e.g., score 74 → "average" = $20,500),
 * we interpolate between the two nearest tier values:
 *
 *   Score 82 (between average@75 and clean@90):
 *     position = (82 - 75) / (90 - 75) = 0.467
 *     value = average + 0.467 × (clean - average)
 *
 * This eliminates pricing cliffs at tier boundaries and makes every
 * point of condition score meaningful.
 */
function interpolateTierValue(
  score: number,
  tierValues: Record<BBCondition, number>,
): number {
  // Clamp score to 0-100
  const s = Math.max(0, Math.min(100, score));

  // Order: rough(0-49) → average(50-74) → clean(75-89) → extra_clean(90-100)
  const ordered: Array<{ tier: BBCondition; midpoint: number }> = [
    { tier: "rough",       midpoint: 25 },
    { tier: "average",     midpoint: 62 },
    { tier: "clean",       midpoint: 82 },
    { tier: "extra_clean", midpoint: 95 },
  ];

  // If at or below the lowest midpoint, return rough
  if (s <= ordered[0].midpoint) return tierValues.rough;
  // If at or above the highest midpoint, return extra_clean
  if (s >= ordered[ordered.length - 1].midpoint) return tierValues.extra_clean;

  // Find the two surrounding midpoints
  for (let i = 0; i < ordered.length - 1; i++) {
    const lower = ordered[i];
    const upper = ordered[i + 1];
    if (s >= lower.midpoint && s <= upper.midpoint) {
      const position = (s - lower.midpoint) / (upper.midpoint - lower.midpoint);
      const lowerVal = tierValues[lower.tier];
      const upperVal = tierValues[upper.tier];
      return Math.round(lowerVal + position * (upperVal - lowerVal));
    }
  }

  // Shouldn't reach here, but fallback to nearest tier
  return tierValues[mapScoreToBBCondition(s)];
}

/**
 * Interpolate trade-in values (no extra_clean tier).
 */
function interpolateTradeInValue(
  score: number,
  tradeInValues: { clean: number; average: number; rough: number },
): number {
  const s = Math.max(0, Math.min(100, score));

  // Trade-in uses: rough(0-49) → average(50-74) → clean(75+)
  const ordered = [
    { midpoint: 25,  value: tradeInValues.rough },
    { midpoint: 62,  value: tradeInValues.average },
    { midpoint: 82,  value: tradeInValues.clean },
  ];

  if (s <= ordered[0].midpoint) return tradeInValues.rough;
  if (s >= ordered[ordered.length - 1].midpoint) return tradeInValues.clean;

  for (let i = 0; i < ordered.length - 1; i++) {
    if (s >= ordered[i].midpoint && s <= ordered[i + 1].midpoint) {
      const position = (s - ordered[i].midpoint) / (ordered[i + 1].midpoint - ordered[i].midpoint);
      return Math.round(ordered[i].value + position * (ordered[i + 1].value - ordered[i].value));
    }
  }

  return tradeInValues.average;
}

/* ------------------------------------------------------------------ */
/*  Emergency Fallback (when AI fallback also fails)                   */
/* ------------------------------------------------------------------ */

function getEmergencyFallbackResult(
  vehicle: VehicleConfig,
  conditionTier: BBCondition,
  conditionScore: number,
  acquisitionType: AcquisitionType,
  mileage?: number,
): BBMarketDataResult {
  const bodyType = classifyBody(vehicle);
  const age = new Date().getFullYear() - vehicle.year;

  // Very crude curves — only used when both BB AND AI fallback fail
  const CURVES: Record<string, Record<string, number>> = {
    truck:  { "0-5": 38000, "5-10": 28000, "10-15": 20000, "15-20": 16000, "20-25": 12000, "25-30": 9000, "30+": 7000 },
    suv:    { "0-5": 32000, "5-10": 24000, "10-15": 16000, "15-20": 12000, "20-25": 9000,  "25-30": 7000, "30+": 5000 },
    sports: { "0-5": 30000, "5-10": 22000, "10-15": 15000, "15-20": 11000, "20-25": 8000,  "25-30": 6000, "30+": 5000 },
    sedan:  { "0-5": 24000, "5-10": 16000, "10-15": 10000, "15-20": 6000,  "20-25": 4000,  "25-30": 3000, "30+": 2500 },
    other:  { "0-5": 28000, "5-10": 20000, "10-15": 12000, "15-20": 8000,  "20-25": 6000,  "25-30": 4500, "30+": 3500 },
  };
  const AVG_MILES: Record<string, number> = { truck: 13500, suv: 12500, sedan: 12000, sports: 8000, other: 12000 };

  const bracket = age <= 5 ? "0-5" : age <= 10 ? "5-10" : age <= 15 ? "10-15" : age <= 20 ? "15-20" : age <= 25 ? "20-25" : age <= 30 ? "25-30" : "30+";
  let estimated = (CURVES[bodyType] || CURVES.other)[bracket] || 5000;

  if (mileage && age > 0) {
    const avgAnnual = AVG_MILES[bodyType] || 12000;
    const milesDelta = mileage - avgAnnual * age;
    const rate = estimated >= 30000 ? 0.12 : estimated >= 15000 ? 0.08 : 0.05;
    const adj = Math.round(milesDelta * rate);
    const cap = Math.round(estimated * 0.30);
    estimated = Math.max(1000, estimated - Math.max(-cap, Math.min(cap, adj)));
  }

  const retailCents = Math.round(estimated * 1.25) * 100;
  const wholesaleCents = Math.round(estimated * 0.65) * 100;
  const tradeInCents = Math.round(estimated * 0.75) * 100;

  const bbRetailByTier: Record<BBCondition, number> = {
    extra_clean: Math.round(retailCents * 1.10),
    clean: retailCents,
    average: Math.round(retailCents * 0.85),
    rough: Math.round(retailCents * 0.70),
  };
  const bbWholesaleByTier: Record<BBCondition, number> = {
    extra_clean: Math.round(wholesaleCents * 1.10),
    clean: wholesaleCents,
    average: Math.round(wholesaleCents * 0.85),
    rough: Math.round(wholesaleCents * 0.70),
  };
  const bbTradeInByTier = {
    clean: tradeInCents,
    average: Math.round(tradeInCents * 0.85),
    rough: Math.round(tradeInCents * 0.70),
  };
  const bbPrivatePartyByTier = {
    clean: Math.round(tradeInCents * 1.10),
    average: Math.round(tradeInCents * 0.95),
    rough: Math.round(tradeInCents * 0.80),
  };

  const interpRetail = interpolateTierValue(conditionScore, bbRetailByTier);
  const interpWholesale = interpolateTierValue(conditionScore, bbWholesaleByTier);
  const interpTradeIn = interpolateTradeInValue(conditionScore, bbTradeInByTier);

  return {
    bbValuation: null,
    conditionTier,
    acquisitionValue: acquisitionType === "TRADE_IN" ? interpTradeIn : interpWholesale,
    retailValue: interpRetail,
    marketValidatedRetail: interpRetail,
    wholesaleValue: interpWholesale,
    tradeInValue: interpTradeIn,
    marketAdjustment: 1.0,
    marketAdjustmentNote: "Black Book and AI fallback unavailable — using emergency estimates",
    demandSignal: "normal",
    marketFlags: ["Emergency fallback pricing — values are rough estimates only"],
    bbRetailByTier,
    bbWholesaleByTier,
    bbTradeInByTier,
    bbPrivatePartyByTier,
    comparables: [],
    retailInsights: null,
    dataSource: "emergency_fallback",
    confidence: 0.15,
  };
}

/* ------------------------------------------------------------------ */
/*  Main Fetcher                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch market data from Black Book (valuations + retail market insights).
 *
 * Pipeline:
 *   1. BB Used Car API → tier values (or AI fallback if BB fails)
 *   2. Interpolate between tiers using condition score
 *   3. BB Retail Listings API → comps + sold stats
 *   4. AI Market Intelligence → validates BB against real market data
 *
 * @param vehicle        - Vehicle with VIN and decoded specs
 * @param zip            - ZIP code for regional adjustment
 * @param mileage        - Current odometer reading
 * @param conditionScore - Inspection condition score (0-100), defaults to 70
 * @param acquisitionType - "WHOLESALE" or "TRADE_IN"
 */
export async function fetchMarketData(
  vehicle: VehicleConfig & { vin: string },
  zip: string = "97201",
  mileage?: number,
  conditionScore: number = 70,
  acquisitionType: AcquisitionType = "WHOLESALE",
): Promise<BBMarketDataResult> {
  const state = zipToState(zip);
  const conditionTier = mapScoreToBBCondition(conditionScore);
  const bodyCategory = classifyBody(vehicle);

  if (!process.env.BLACKBOOK_USERNAME) {
    reportMissingKey("BlackBook", "BLACKBOOK_USERNAME").catch(() => {});
  }

  // ── Step 1: BB Valuation (VIN first, YMM fallback) ──────────────
  let bbValuation: BBValuation | null = null;
  let bbFailureReason: string | null = null;
  try {
    bbValuation = await fetchBlackBookValuation(vehicle.vin, mileage, state);
    if (!bbValuation) {
      console.log(`[MarketData] BB VIN lookup returned no data for ${vehicle.vin} — trying YMM fallback`);
      bbValuation = await fetchBlackBookByYMM(vehicle.year, vehicle.make, vehicle.model, mileage, state);
      if (!bbValuation) {
        bbFailureReason = `Black Book has no data for VIN ${vehicle.vin} or YMM ${vehicle.year} ${vehicle.make} ${vehicle.model}`;
      }
    }
    if (bbValuation) reportSuccess("BlackBook");
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    bbFailureReason = `Black Book API error: ${errMsg}`;
    const statusMatch = String(err).match(/\((\d{3})\)/);
    reportFailure("BlackBook", err instanceof Error ? err : String(err), statusMatch ? Number(statusMatch[1]) : undefined, vehicle.vin).catch(() => {});
    console.error(`[MarketData] BlackBook valuation failed: ${errMsg}`);
  }

  // ── Step 1b: AI Fallback if BB has no data ────────────────────────
  let dataSource: "blackbook" | "ai_fallback" | "emergency_fallback" = "blackbook";
  let bbRetailByTier: Record<BBCondition, number>;
  let bbWholesaleByTier: Record<BBCondition, number>;
  let bbTradeInByTier: { clean: number; average: number; rough: number };
  let bbPrivatePartyByTier: { clean: number; average: number; rough: number };
  let baseConfidence: number;

  if (bbValuation) {
    // Convert BB dollar values to cents for all tiers
    bbRetailByTier = {
      extra_clean: Math.round((bbValuation.adjustedRetail.extra_clean || bbValuation.retail.extra_clean) * 100),
      clean: Math.round((bbValuation.adjustedRetail.clean || bbValuation.retail.clean) * 100),
      average: Math.round((bbValuation.adjustedRetail.average || bbValuation.retail.average) * 100),
      rough: Math.round((bbValuation.adjustedRetail.rough || bbValuation.retail.rough) * 100),
    };
    bbWholesaleByTier = {
      extra_clean: Math.round((bbValuation.adjustedWholesale.extra_clean || bbValuation.wholesale.extra_clean) * 100),
      clean: Math.round((bbValuation.adjustedWholesale.clean || bbValuation.wholesale.clean) * 100),
      average: Math.round((bbValuation.adjustedWholesale.average || bbValuation.wholesale.average) * 100),
      rough: Math.round((bbValuation.adjustedWholesale.rough || bbValuation.wholesale.rough) * 100),
    };
    bbTradeInByTier = {
      clean: Math.round((bbValuation.adjustedTradeIn.clean || bbValuation.tradeIn.clean) * 100),
      average: Math.round((bbValuation.adjustedTradeIn.average || bbValuation.tradeIn.average) * 100),
      rough: Math.round((bbValuation.adjustedTradeIn.rough || bbValuation.tradeIn.rough) * 100),
    };
    bbPrivatePartyByTier = {
      clean: Math.round((bbValuation.adjustedPrivateParty.clean || bbValuation.privateParty.clean) * 100),
      average: Math.round((bbValuation.adjustedPrivateParty.average || bbValuation.privateParty.average) * 100),
      rough: Math.round((bbValuation.adjustedPrivateParty.rough || bbValuation.privateParty.rough) * 100),
    };
    baseConfidence = 0.90;
  } else {
    // BB failed — use AI fallback valuation
    console.warn(`[MarketData] Black Book unavailable — trying AI fallback valuation`);
    try {
      const aiResult = await estimateFallbackValuation({
        vehicle: {
          year: vehicle.year, make: vehicle.make, model: vehicle.model,
          trim: vehicle.trim, engine: vehicle.engine, drivetrain: vehicle.drivetrain,
          transmission: vehicle.transmission, bodyStyle: vehicle.bodyStyle,
        },
        bodyCategory,
        mileage,
        conditionScore,
        conditionTier,
        region: state,
      });

      const fb = aiResult.result;
      bbRetailByTier = {
        extra_clean: Math.round(fb.retailByTier.extra_clean * 100),
        clean: Math.round(fb.retailByTier.clean * 100),
        average: Math.round(fb.retailByTier.average * 100),
        rough: Math.round(fb.retailByTier.rough * 100),
      };
      bbWholesaleByTier = {
        extra_clean: Math.round(fb.wholesaleByTier.extra_clean * 100),
        clean: Math.round(fb.wholesaleByTier.clean * 100),
        average: Math.round(fb.wholesaleByTier.average * 100),
        rough: Math.round(fb.wholesaleByTier.rough * 100),
      };
      bbTradeInByTier = {
        clean: Math.round(fb.tradeInByTier.clean * 100),
        average: Math.round(fb.tradeInByTier.average * 100),
        rough: Math.round(fb.tradeInByTier.rough * 100),
      };
      bbPrivatePartyByTier = {
        clean: Math.round(fb.tradeInByTier.clean * 110), // ~10% above trade-in
        average: Math.round(fb.tradeInByTier.average * 110),
        rough: Math.round(fb.tradeInByTier.rough * 110),
      };
      dataSource = "ai_fallback";
      baseConfidence = fb.confidence;
      console.log(`[MarketData] AI fallback valuation: retail clean=$${fb.retailByTier.clean.toLocaleString()} (confidence ${fb.confidence.toFixed(2)}, tier ${aiResult.fallbackTier})`);
    } catch (fbErr) {
      console.error(`[MarketData] AI fallback also failed: ${fbErr instanceof Error ? fbErr.message : fbErr}`);
      return getEmergencyFallbackResult(vehicle, conditionTier, conditionScore, acquisitionType, mileage);
    }
  }

  // ── Step 2: Interpolate between tiers ─────────────────────────────
  const retailValue = interpolateTierValue(conditionScore, bbRetailByTier);
  const wholesaleValue = interpolateTierValue(conditionScore, bbWholesaleByTier);
  const tradeInValue = interpolateTradeInValue(conditionScore, bbTradeInByTier);
  const acquisitionValue = acquisitionType === "TRADE_IN" ? tradeInValue : wholesaleValue;

  // ── Step 3: BB Retail Insights (needs UVC from valuation) ─────────
  let insights: BBRetailInsightsResult | null = null;
  if (bbValuation?.uvc) {
    try {
      insights = await fetchBlackBookRetailInsights(bbValuation.uvc, zip, mileage);
    } catch (err) {
      console.warn(`[MarketData] BB Retail Insights failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ── Step 4: AI Market Intelligence ────────────────────────────────
  const retailDollars = Math.round(retailValue / 100);
  const comps = insights?.comps ?? [];

  let marketAdjustment = 1.0;
  let marketAdjustmentNote = "No comparable listings available";
  let demandSignal: "strong" | "normal" | "weak" = "normal";
  let marketFlags: string[] = [];
  let marketConfidence = 0.5;

  // Surface BB failure in the flags that the dealer UI reads so problems
  // are visible instead of silently drifting to AI fallback values.
  if (bbFailureReason && dataSource !== "blackbook") {
    marketFlags = [bbFailureReason, ...marketFlags];
  }

  try {
    const mktResult = await analyzeMarketIntelligence({
      vehicle: {
        year: vehicle.year, make: vehicle.make, model: vehicle.model,
        trim: vehicle.trim, engine: vehicle.engine,
        drivetrain: vehicle.drivetrain, transmission: vehicle.transmission,
      },
      bodyCategory,
      mileage,
      region: state,
      bbInterpolatedRetail: retailDollars,
      bbRetailByTier: {
        extra_clean: Math.round(bbRetailByTier.extra_clean / 100),
        clean: Math.round(bbRetailByTier.clean / 100),
        average: Math.round(bbRetailByTier.average / 100),
        rough: Math.round(bbRetailByTier.rough / 100),
      },
      conditionScore,
      conditionTier,
      activeComps: comps.map((c) => ({
        price: c.price,
        mileage: c.mileage,
        daysOnMarket: c.daysOnMarket,
        series: c.series,
        certified: c.certified,
        distanceToDealer: c.distanceToDealer,
      })),
      activeStats: insights ? {
        count: insights.activeCount,
        meanPrice: insights.activeMeanPrice,
        medianPrice: insights.activeMedianPrice,
        meanMileage: insights.activeMeanMileage,
        medianMileage: 0, // not stored separately
      } : null,
      soldStats: insights?.soldCount ? {
        count: insights.soldCount,
        meanPrice: insights.soldMeanPrice,
        medianPrice: insights.soldMedianPrice,
        meanMileage: insights.soldMeanMileage,
        medianMileage: 0,
        meanDaysToTurn: insights.soldMeanDaysToTurn ?? 0,
        marketDaysSupply: insights.marketDaysSupply ?? 0,
      } : null,
    });

    marketAdjustment = mktResult.result.marketAdjustment;
    marketAdjustmentNote = mktResult.result.reasoning;
    demandSignal = mktResult.result.demandSignal;
    marketFlags = mktResult.result.flags;
    marketConfidence = mktResult.result.confidence;

    console.log(
      `[MarketData] AI Market Intelligence: adj=${marketAdjustment.toFixed(2)}x, ` +
      `demand=${demandSignal}, confidence=${marketConfidence.toFixed(2)}, ` +
      `tier ${mktResult.fallbackTier}${marketFlags.length > 0 ? `, flags: ${marketFlags.join("; ")}` : ""}`,
    );
  } catch (err) {
    console.warn(`[MarketData] Market intelligence failed, using BB as-is: ${err instanceof Error ? err.message : err}`);
    marketAdjustmentNote = "Market intelligence unavailable — using BB retail as-is";
    marketFlags = ["Market intelligence unavailable"];
  }

  const marketValidatedRetail = Math.round(retailValue * marketAdjustment);

  console.log(
    `[MarketData] Final (${conditionTier} tier, score ${conditionScore}, ${acquisitionType}): ` +
    `Interpolated Retail $${(retailValue / 100).toLocaleString()} | ` +
    `Market Adj ${marketAdjustment.toFixed(2)}x → $${(marketValidatedRetail / 100).toLocaleString()} | ` +
    `Wholesale $${(wholesaleValue / 100).toLocaleString()} | Trade-In $${(tradeInValue / 100).toLocaleString()} | ` +
    `${comps.length} comps | Source: ${dataSource}`,
  );

  return {
    bbValuation,
    conditionTier,
    acquisitionValue,
    retailValue,
    marketValidatedRetail,
    wholesaleValue,
    tradeInValue,
    marketAdjustment,
    marketAdjustmentNote,
    demandSignal,
    marketFlags,
    bbRetailByTier,
    bbWholesaleByTier,
    bbTradeInByTier,
    bbPrivatePartyByTier,
    comparables: comps,
    retailInsights: insights,
    dataSource,
    confidence: baseConfidence * marketConfidence,
  };
}
