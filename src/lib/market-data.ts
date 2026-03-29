/**
 * Market Data Orchestrator (v3 — 6-Source Consensus)
 *
 * Fetches vehicle market value from up to 5 API sources in parallel,
 * then combines them using a weighted consensus algorithm.
 *
 * Sources (parallel fan-out via Promise.allSettled):
 *   1. Black Book — wholesale + retail (condition-tiered)
 *   2. VehicleDatabases.com — condition-tiered retail pricing
 *   3. NADA Guides — dealer/lender standard with loan value
 *   4. VinAudit — VIN-based market value
 *   5. MarketCheck — real dealer inventory
 *   6. Category-aware fallback curves (always available, lowest weight)
 *
 * After consensus, configuration premiums are applied with a mode
 * determined by the consensus engine (full/partial/none).
 */

import { fetchVehicleDatabasesData, fetchVDBAuctionHistory } from "./vehicledatabases";
import { fetchMarketValue as fetchVinAuditValue } from "./vinaudit";
import { reportSuccess, reportFailure, reportMissingKey } from "./api-health";
import { fetchMarketCheckData } from "./marketcheck";
import { fetchNADAValuation, fetchNADAByYMM } from "./nada-guides";
import { fetchBlackBookValuation, fetchBlackBookByYMM, mapScoreToBBCondition } from "./blackbook";
import {
  calculateConfigPremiums,
  classifyBody,
  type ConfigPremium,
  type VehicleConfig,
} from "./config-premiums";
import { zipToState, getRegionalMultiplier } from "./geo-pricing";
import {
  calculateConsensus,
  selectTierPrices,
  mapConditionToTier,
  type SourceEstimate,
  type ConsensusResult,
  type PricingTraceStep,
} from "./pricing-consensus";
import type { NormalizedListing } from "./marketcheck";
import { analyzeConsensusWeights } from "./ai/consensus-weighter";
import { analyzeConfigPremiums } from "./ai/config-premium-analyzer";
import { analyzeRegionalPricing } from "./ai/geo-pricing-analyzer";
import { estimateMarketValue, toSourceEstimate } from "./ai/market-value-estimator";
import { normalizeSourcesForAcquisition, applyNormalization } from "./ai/source-normalizer";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MarketDataResult {
  /** Consensus estimated value in dollars (private party, after config premiums) */
  estimatedValue: number;
  /** Low end of range in dollars (trade-in based) */
  valueLow: number;
  /** High end of range in dollars (dealer retail based) */
  valueHigh: number;
  /** Mileage adjustment in dollars */
  mileageAdjustment: number;
  /** Comparable listings from all sources */
  nearbyListings: NormalizedListing[];

  /** Primary data source */
  dataSource: string;
  /** Confidence in the consensus price (0-1) */
  confidence: number;
  /** Base value BEFORE config premiums (dollars) */
  baseValuePreConfig: number;
  /** Applied configuration premiums */
  configPremiums: ConfigPremium[];
  /** Combined config premium multiplier */
  configMultiplier: number;

  /** Five-perspective pricing (dollars) */
  tradeInValue: number;
  privatePartyValue: number;
  dealerRetailValue: number;
  wholesaleValue: number;
  loanValue: number;

  /** VDB condition tier used (if applicable) */
  vdbConditionTier: string | null;

  /** All individual source results for transparency */
  sourceResults: SourceEstimate[];
  /** Consensus method used */
  consensusMethod: string;
  /** Config premium mode used */
  configPremiumMode: "full" | "partial" | "none";
  /** Condition attenuation factor applied */
  conditionAttenuation: number;
  /** Number of sources that contributed */
  sourceCount: number;

  /** AI valuation metadata */
  /** Step-by-step dollar trace of the pricing chain */
  pricingTrace: PricingTraceStep[];

  aiMetadata?: {
    consensusTier: number;
    configPremiumTier: number;
    geoPricingTier: number;
    sourceNormTier: number;
    consensusReasoning?: string;
    configReasoning?: string;
    geoReasoning?: string;
    sourceNormReasoning?: string;
    /** Per-source normalization details */
    sourceNormalization?: Array<{
      source: string;
      originalValue: number;
      acquisitionValue: number;
      multiplier: number;
      reason: string;
    }>;
  };
}

/* ------------------------------------------------------------------ */
/*  Category-Aware Fallback Curves                                     */
/* ------------------------------------------------------------------ */

const FALLBACK_CURVES: Record<string, Record<string, number>> = {
  truck: {
    "0-5": 38000, "5-10": 28000, "10-15": 20000, "15-20": 16000,
    "20-25": 12000, "25-30": 9000, "30+": 7000,
  },
  suv: {
    "0-5": 32000, "5-10": 24000, "10-15": 16000, "15-20": 12000,
    "20-25": 9000, "25-30": 7000, "30+": 5000,
  },
  sports: {
    "0-5": 30000, "5-10": 22000, "10-15": 15000, "15-20": 11000,
    "20-25": 8000, "25-30": 6000, "30+": 5000,
  },
  sedan: {
    "0-5": 24000, "5-10": 16000, "10-15": 10000, "15-20": 6000,
    "20-25": 4000, "25-30": 3000, "30+": 2500,
  },
  other: {
    "0-5": 28000, "5-10": 20000, "10-15": 12000, "15-20": 8000,
    "20-25": 6000, "25-30": 4500, "30+": 3500,
  },
};

function getAgeBracket(age: number): string {
  if (age <= 5) return "0-5";
  if (age <= 10) return "5-10";
  if (age <= 15) return "10-15";
  if (age <= 20) return "15-20";
  if (age <= 25) return "20-25";
  if (age <= 30) return "25-30";
  return "30+";
}

/**
 * Average annual mileage by vehicle category (industry data).
 * Used for mileage adjustment on sources that don't account for mileage.
 */
const AVG_ANNUAL_MILES: Record<string, number> = {
  truck: 13500,   // trucks driven more (towing, rural)
  suv: 12500,
  sedan: 12000,
  sports: 8000,   // sports cars driven less (weekend cars)
  other: 12000,
};

/**
 * Per-mile adjustment rate by price tier.
 * Higher-value vehicles lose more per excess mile.
 * Expressed as dollars per mile of deviation from expected.
 */
function getMileageAdjustmentRate(baseValue: number): number {
  if (baseValue >= 50000) return 0.15;   // $0.15/mi for expensive vehicles
  if (baseValue >= 30000) return 0.12;
  if (baseValue >= 15000) return 0.08;
  if (baseValue >= 8000) return 0.05;
  return 0.03;                           // cheap cars: mileage matters less
}

function getFallbackEstimate(vehicle: VehicleConfig, mileage?: number): SourceEstimate {
  const bodyType = classifyBody(vehicle);
  const age = new Date().getFullYear() - vehicle.year;
  const bracket = getAgeBracket(age);
  const curve = FALLBACK_CURVES[bodyType] || FALLBACK_CURVES.other;
  let estimated = curve[bracket] || 5000;

  // Apply mileage adjustment — compare actual to expected
  if (mileage && age > 0) {
    const avgAnnual = AVG_ANNUAL_MILES[bodyType] || 12000;
    const expectedMiles = avgAnnual * age;
    const milesDelta = mileage - expectedMiles; // positive = over-mileage
    const rate = getMileageAdjustmentRate(estimated);
    const adjustment = Math.round(milesDelta * rate);

    // Cap adjustment at ±30% of base value
    const maxAdj = Math.round(estimated * 0.30);
    const clampedAdj = Math.max(-maxAdj, Math.min(maxAdj, adjustment));
    estimated = Math.max(1000, estimated - clampedAdj);
  }

  return {
    source: "fallback",
    estimatedValue: estimated,
    tradeInValue: Math.round(estimated * 0.75),
    dealerRetailValue: Math.round(estimated * 1.25),
    wholesaleValue: Math.round(estimated * 0.65),
    loanValue: Math.round(estimated * 0.80),
    confidence: 0.25,
    isConditionTiered: false,
  };
}

/* ------------------------------------------------------------------ */
/*  Source Fetchers (return SourceEstimate | null)                      */
/* ------------------------------------------------------------------ */

async function fetchBlackBookSource(
  vin: string,
  vehicle: VehicleConfig,
  mileage: number | undefined,
  state: string,
  conditionScore: number,
): Promise<SourceEstimate | null> {
  // Try VIN first, fallback to YMM
  let result = await fetchBlackBookValuation(vin, mileage, state);
  if (!result) {
    result = await fetchBlackBookByYMM(vehicle.year, vehicle.make, vehicle.model, mileage, state);
  }
  if (!result) return null;

  // Pick condition-appropriate values
  const condition = mapScoreToBBCondition(conditionScore);

  const wholesaleVal = result.adjustedWholesale[condition] || result.wholesale[condition] || 0;
  const retailVal = result.adjustedRetail[condition] || result.retail[condition] || 0;
  const tradeInVal = condition === "extra_clean"
    ? result.tradeIn.clean // no extra_clean for trade-in, use clean
    : (result.tradeIn as Record<string, number>)[condition] || 0;

  // Private party estimate = midpoint of wholesale and retail
  const estimatedValue = Math.round((wholesaleVal + retailVal) / 2) || retailVal || wholesaleVal;
  if (estimatedValue <= 0) return null;

  return {
    source: "blackbook",
    estimatedValue,
    tradeInValue: tradeInVal || Math.round(estimatedValue * 0.85),
    dealerRetailValue: retailVal || Math.round(estimatedValue * 1.15),
    wholesaleValue: wholesaleVal || Math.round(estimatedValue * 0.78),
    loanValue: 0, // Black Book doesn't provide loan value
    confidence: 0.90,
    isConditionTiered: true,
    raw: { condition, wholesale: wholesaleVal, retail: retailVal, tradeIn: tradeInVal },
  };
}

async function fetchVDBSource(
  vin: string,
  mileage: number | undefined,
  state: string,
  conditionScore: number,
): Promise<{ estimate: SourceEstimate; tier: string } | null> {
  const result = await fetchVehicleDatabasesData(vin, mileage, state);
  if (!result) return null;

  const { tier, prices } = selectTierPrices(result.tiers, conditionScore);

  // Use private party as the primary comparison value
  const estimatedValue = prices.privateParty || prices.dealerRetail || prices.tradeIn;
  if (estimatedValue <= 0) return null;

  return {
    estimate: {
      source: "vehicledatabases",
      estimatedValue,
      tradeInValue: prices.tradeIn,
      dealerRetailValue: prices.dealerRetail,
      wholesaleValue: Math.round(prices.tradeIn * 0.90), // estimate wholesale from trade-in
      loanValue: 0,
      confidence: 0.90,
      isConditionTiered: true,
      raw: { tier, allTiers: result.tiers },
    },
    tier,
  };
}

async function fetchNADASource(
  vin: string,
  vehicle: VehicleConfig,
  mileage: number | undefined,
  conditionScore: number,
): Promise<SourceEstimate | null> {
  // Try VIN first (pass year to help resolve), fallback to YMM
  let result = await fetchNADAValuation(vin, mileage, vehicle.year);
  if (!result) {
    result = await fetchNADAByYMM(vehicle.year, vehicle.make, vehicle.model, mileage);
  }
  if (!result) return null;

  // Pick condition-appropriate values
  let retailVal: number;
  let tradeInVal: number;

  if (conditionScore >= 75) {
    retailVal = result.retailClean;
    tradeInVal = result.tradeInClean;
  } else if (conditionScore >= 50) {
    retailVal = result.retailAverage;
    tradeInVal = result.tradeInAverage;
  } else {
    retailVal = result.retailRough;
    tradeInVal = result.tradeInRough;
  }

  // Private party = midpoint of trade-in and retail
  const estimatedValue = Math.round((tradeInVal + retailVal) / 2) || retailVal || tradeInVal;
  if (estimatedValue <= 0) return null;

  return {
    source: "nada",
    estimatedValue,
    tradeInValue: tradeInVal || Math.round(estimatedValue * 0.85),
    dealerRetailValue: retailVal || Math.round(estimatedValue * 1.15),
    wholesaleValue: 0, // NADA doesn't provide wholesale
    loanValue: result.loanValue || Math.round(tradeInVal * 1.05),
    confidence: 0.85,
    isConditionTiered: true,
    raw: result,
  };
}

async function fetchVinAuditSource(
  vin: string,
  mileage: number | undefined,
): Promise<SourceEstimate | null> {
  const result = await fetchVinAuditValue(vin, mileage);
  if (!result || result.estimatedValue <= 1000) return null;

  return {
    source: "vinaudit",
    estimatedValue: result.estimatedValue,
    tradeInValue: Math.round(result.estimatedValue * 0.82),
    dealerRetailValue: result.valueHigh || Math.round(result.estimatedValue * 1.2),
    wholesaleValue: 0,
    loanValue: 0,
    confidence: 0.80,
    isConditionTiered: false,
    raw: result,
  };
}

async function fetchMarketCheckSource(
  vehicle: VehicleConfig,
  zip: string,
  mileage: number | undefined,
): Promise<{ estimate: SourceEstimate; listings: NormalizedListing[] } | null> {
  const result = await fetchMarketCheckData(
    {
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      drivetrain: vehicle.drivetrain,
      transmission: vehicle.transmission,
      bodyStyle: vehicle.bodyStyle,
    },
    zip,
    mileage,
  );
  if (!result) return null;

  // Scale confidence based on listing count
  const listingConfidence = result.nearbyListings.length >= 10 ? 0.85
    : result.nearbyListings.length >= 5 ? 0.75
    : result.nearbyListings.length >= 2 ? 0.65
    : 0.50;

  return {
    estimate: {
      source: "marketcheck",
      estimatedValue: result.estimatedValue,
      tradeInValue: Math.round(result.estimatedValue * 0.85),
      dealerRetailValue: result.valueHigh || Math.round(result.estimatedValue * 1.15),
      wholesaleValue: 0,
      loanValue: 0,
      confidence: listingConfidence,
      isConditionTiered: false,
      raw: {
        stats: { low: result.valueLow, high: result.valueHigh },
        listingCount: result.nearbyListings.length,
        totalFound: result.totalFound,
        avgDaysOnMarket: result.avgDaysOnMarket,
      },
    },
    listings: result.nearbyListings,
  };
}

/* ------------------------------------------------------------------ */
/*  Orchestrator                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch market data from all sources in parallel, apply consensus, then config premiums.
 *
 * @param vehicle        - Vehicle with VIN and decoded specs
 * @param zip            - ZIP code for nearby search
 * @param mileage        - Current odometer reading
 * @param conditionScore - AI condition score (0-100), defaults to 70
 */
export async function fetchMarketData(
  vehicle: VehicleConfig & { vin: string },
  zip: string = "97201",
  mileage?: number,
  conditionScore: number = 70,
): Promise<MarketDataResult> {
  // Derive state from ZIP for regional pricing + API calls that need it
  const state = zipToState(zip);

  const sourceEstimates: SourceEstimate[] = [];
  let allListings: NormalizedListing[] = [];
  let vdbConditionTier: string | null = null;
  let mileageAdjustment = 0;

  // ── Check for missing API keys (report once per hour) ────────────
  if (!process.env.BLACKBOOK_USERNAME) reportMissingKey("BlackBook", "BLACKBOOK_USERNAME").catch(() => {});
  if (!process.env.VEHICLEDATABASES_API_KEY) reportMissingKey("VehicleDatabases", "VEHICLEDATABASES_API_KEY").catch(() => {});
  if (!process.env.NADA_RAPIDAPI_KEY) reportMissingKey("NADA", "NADA_RAPIDAPI_KEY").catch(() => {});
  if (!process.env.VINAUDIT_API_KEY) reportMissingKey("VinAudit", "VINAUDIT_API_KEY").catch(() => {});
  if (!process.env.MARKETCHECK_API_KEY) reportMissingKey("MarketCheck", "MARKETCHECK_API_KEY").catch(() => {});

  // ── Parallel fan-out: fire all API calls simultaneously ─────────
  const [bbResult, vdbResult, nadaResult, vinAuditResult, marketCheckResult, vdbAuctionResult] = await Promise.allSettled([
    // Black Book
    fetchBlackBookSource(vehicle.vin, vehicle, mileage, state, conditionScore).then((r) => {
      if (r) reportSuccess("BlackBook");
      return r;
    }).catch((err) => {
      const statusMatch = String(err).match(/\((\d{3})\)/);
      reportFailure("BlackBook", err, statusMatch ? Number(statusMatch[1]) : undefined, vehicle.vin).catch(() => {});
      return null;
    }),
    // VehicleDatabases
    fetchVDBSource(vehicle.vin, mileage, state, conditionScore).then((r) => {
      if (r) reportSuccess("VehicleDatabases");
      return r;
    }).catch((err) => {
      const statusMatch = String(err).match(/\((\d{3})\)/);
      reportFailure("VehicleDatabases", err, statusMatch ? Number(statusMatch[1]) : undefined, vehicle.vin).catch(() => {});
      return null;
    }),
    // NADA Guides
    fetchNADASource(vehicle.vin, vehicle, mileage, conditionScore).then((r) => {
      if (r) reportSuccess("NADA");
      return r;
    }).catch((err) => {
      const statusMatch = String(err).match(/\((\d{3})\)/);
      reportFailure("NADA", err, statusMatch ? Number(statusMatch[1]) : undefined, vehicle.vin).catch(() => {});
      return null;
    }),
    // VinAudit
    fetchVinAuditSource(vehicle.vin, mileage).then((r) => {
      if (r) reportSuccess("VinAudit");
      return r;
    }).catch((err) => {
      const statusMatch = String(err).match(/\((\d{3})\)/);
      reportFailure("VinAudit", err, statusMatch ? Number(statusMatch[1]) : undefined, vehicle.vin).catch(() => {});
      return null;
    }),
    // MarketCheck
    fetchMarketCheckSource(vehicle, zip, mileage).then((r) => {
      if (r) reportSuccess("MarketCheck");
      return r;
    }).catch((err) => {
      const statusMatch = String(err).match(/\((\d{3})\)/);
      reportFailure("MarketCheck", err, statusMatch ? Number(statusMatch[1]) : undefined, vehicle.vin).catch(() => {});
      return null;
    }),
    // VDB Auction History (real sold-at-auction prices)
    fetchVDBAuctionHistory(vehicle.vin).catch((err) => {
      console.warn(`[VDB Auction] Failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }),
  ]);

  // ── Collect results ──────────────────────────────────────────────

  // Black Book
  const bb = bbResult.status === "fulfilled" ? bbResult.value : null;
  if (bb) {
    sourceEstimates.push(bb);
    console.log(
      `[MarketData] BlackBook: $${bb.estimatedValue} PP / $${bb.wholesaleValue} WS / $${bb.dealerRetailValue} DR`,
    );
  }

  // VehicleDatabases
  const vdb = vdbResult.status === "fulfilled" ? vdbResult.value : null;
  if (vdb) {
    sourceEstimates.push(vdb.estimate);
    vdbConditionTier = vdb.tier;
    console.log(
      `[MarketData] VehicleDatabases (${vdb.tier}): $${vdb.estimate.estimatedValue} PP / $${vdb.estimate.tradeInValue} TI / $${vdb.estimate.dealerRetailValue} DR`,
    );
  }

  // NADA Guides
  const nada = nadaResult.status === "fulfilled" ? nadaResult.value : null;
  if (nada) {
    sourceEstimates.push(nada);
    console.log(
      `[MarketData] NADA: $${nada.estimatedValue} PP / $${nada.tradeInValue} TI / $${nada.loanValue} Loan`,
    );
  }

  // VinAudit
  const vinAudit = vinAuditResult.status === "fulfilled" ? vinAuditResult.value : null;
  if (vinAudit) {
    sourceEstimates.push(vinAudit);
    console.log(`[MarketData] VinAudit: $${vinAudit.estimatedValue}`);
  }

  // MarketCheck
  const mc = marketCheckResult.status === "fulfilled" ? marketCheckResult.value : null;
  if (mc) {
    sourceEstimates.push(mc.estimate);
    allListings = mc.listings;
    console.log(
      `[MarketData] MarketCheck: $${mc.estimate.estimatedValue} (${mc.listings.length} comps)`,
    );
  }

  // VDB Auction History — real sold-at-auction prices as comps
  const vdbAuction = vdbAuctionResult.status === "fulfilled" ? vdbAuctionResult.value : null;
  if (vdbAuction && vdbAuction.records.length > 0) {
    const auctionListings: NormalizedListing[] = vdbAuction.records.map((r) => ({
      title: r.vehicleName || `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      price: r.salePrice,
      mileage: r.mileage || 0,
      location: r.location || "Auction",
      source: `${r.auctionHouse || "Auction"} (Sold${r.saleDate ? ` ${r.saleDate}` : ""})`,
      url: undefined,
    }));
    allListings.push(...auctionListings);
    console.log(`[MarketData] VDB Auction History: ${auctionListings.length} sold records`);
  }

  // AI-powered fallback — understands enthusiast platforms, diesel premiums, etc.
  const bodyCategory = classifyBody(vehicle);
  const apiSourceValues = sourceEstimates
    .filter((s) => s.estimatedValue > 0)
    .map((s) => ({ source: s.source, value: s.estimatedValue }));

  const aiFallback = await estimateMarketValue({
    vehicle: {
      year: vehicle.year, make: vehicle.make, model: vehicle.model,
      trim: vehicle.trim, engine: vehicle.engine, transmission: vehicle.transmission,
      drivetrain: vehicle.drivetrain, bodyStyle: vehicle.bodyStyle,
    },
    mileage,
    conditionScore,
    bodyCategory,
    otherSourceValues: apiSourceValues.length > 0 ? apiSourceValues : undefined,
  });

  const fallback = toSourceEstimate(aiFallback.result);
  sourceEstimates.push(fallback);
  console.log(
    `[MarketData] AI Fallback (tier ${aiFallback.fallbackTier}${aiFallback.result.isEnthusiastPlatform ? ", ENTHUSIAST" : ""}): ` +
    `$${fallback.estimatedValue.toLocaleString()} (conf ${(fallback.confidence * 100).toFixed(0)}%) — ${aiFallback.result.reasoning}`,
  );

  // ── Normalize all sources to acquisition cost ───────────────────
  const compBreakdown = {
    activeDealer: allListings.filter((l) => !l.source.includes("Sold") && !l.source.includes("Auction")).length,
    soldDealer: allListings.filter((l) => l.source.includes("Sold") && !l.source.includes("Auction")).length,
    auction: allListings.filter((l) => l.source.includes("Auction")).length,
    total: allListings.length,
  };
  const isEnthusiastPlatform = aiFallback.result.isEnthusiastPlatform || false;

  const aiNormalization = await normalizeSourcesForAcquisition({
    vehicle: {
      year: vehicle.year, make: vehicle.make, model: vehicle.model,
      trim: vehicle.trim, engine: vehicle.engine, drivetrain: vehicle.drivetrain,
      transmission: vehicle.transmission,
    },
    conditionScore,
    bodyCategory,
    isEnthusiastPlatform,
    sourceEstimates,
    compSummary: compBreakdown,
  });

  // Log normalization results
  for (const ns of aiNormalization.result.normalizedSources) {
    const delta = ns.acquisitionValue - ns.originalValue;
    const sign = delta >= 0 ? "+" : "";
    console.log(
      `[SourceNorm] ${ns.source}: $${ns.originalValue.toLocaleString()} → $${ns.acquisitionValue.toLocaleString()} (${ns.multiplier.toFixed(2)}x, ${sign}$${delta.toLocaleString()}) — ${ns.reason}`,
    );
  }
  console.log(`[SourceNorm] Strategy (tier ${aiNormalization.fallbackTier}): ${aiNormalization.result.reasoning}`);

  // Replace sourceEstimates with acquisition-normalized values
  const normalizedEstimates = applyNormalization(sourceEstimates, aiNormalization.result);

  // ── Mileage cross-check from comparable listings ────────────────
  if (mileage && allListings.length >= 3) {
    const listingsWithMiles = allListings.filter((l) => l.mileage && l.mileage > 0);
    if (listingsWithMiles.length >= 3) {
      const avgCompMiles = Math.round(
        listingsWithMiles.reduce((sum, l) => sum + l.mileage, 0) / listingsWithMiles.length,
      );
      const mileageRatio = mileage / avgCompMiles;
      if (mileageRatio > 1.5 || mileageRatio < 0.5) {
        console.warn(
          `[MarketData] Mileage outlier: vehicle ${mileage} mi vs comparable avg ${avgCompMiles} mi (${(mileageRatio * 100).toFixed(0)}%)`,
        );
      }
      mileageAdjustment = Math.round((avgCompMiles - mileage) * getMileageAdjustmentRate(
        sourceEstimates[0]?.estimatedValue || 20000,
      ));
    }
  }

  // ── AI Consensus Weighting ──────────────────────────────────────
  const conditionTier = mapConditionToTier(conditionScore);

  const aiConsensus = await analyzeConsensusWeights({
    vehicle: {
      year: vehicle.year, make: vehicle.make, model: vehicle.model,
      trim: vehicle.trim, engine: vehicle.engine, drivetrain: vehicle.drivetrain,
      transmission: vehicle.transmission,
    },
    mileage,
    conditionScore,
    conditionTier,
    sourceEstimates: normalizedEstimates,
  });

  // Build a ConsensusResult-shaped object from AI result for downstream compat
  const cr = aiConsensus.result;
  const consensus: ConsensusResult = {
    estimatedValue: cr.consensusValue,
    tradeInValue: cr.tradeInValue,
    dealerRetailValue: cr.dealerRetailValue,
    wholesaleValue: cr.wholesaleValue,
    loanValue: cr.loanValue,
    confidence: cr.confidenceAssessment,
    primarySource: (Object.entries(cr.sourceWeights).sort((a, b) => b[1] - a[1])[0]?.[0] || "fallback") as ConsensusResult["primarySource"],
    consensusMethod: aiConsensus.fallbackTier === 3 ? "weighted-median" : "weighted-median",
    sourceResults: normalizedEstimates,
    configPremiumMode: cr.configPremiumMode,
    conditionAttenuation: cr.conditionAttenuation,
    sourceCount: normalizedEstimates.filter((s) => s.estimatedValue > 0).length,
  };

  console.log(
    `[MarketData] AI Consensus (tier ${aiConsensus.fallbackTier}, ${consensus.sourceCount} sources): ` +
    `$${consensus.estimatedValue} PP | $${consensus.wholesaleValue} WS | $${consensus.loanValue} Loan | ` +
    `Confidence: ${(consensus.confidence * 100).toFixed(0)}%` +
    (aiConsensus.reasoning ? ` — ${aiConsensus.reasoning}` : ""),
  );

  // ── AI Config Premiums + AI Regional Pricing (parallel) ─────────
  const nearbyListingPrices = allListings.filter((l) => l.price > 0).map((l) => l.price);
  const nearbyListingTitles = allListings.slice(0, 10).map((l) => ({ title: l.title || `${vehicle.year} ${vehicle.make} ${vehicle.model}`, price: l.price }));

  const [aiConfigResult, aiGeoResult] = await Promise.all([
    analyzeConfigPremiums({
      vehicle,
      bodyCategory,
      baseConsensusValue: consensus.estimatedValue,
      premiumMode: consensus.configPremiumMode,
      nearbyListings: nearbyListingTitles,
    }),
    analyzeRegionalPricing({
      vehicle: { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim },
      bodyCategory,
      zip,
      state,
      baseValue: consensus.estimatedValue,
      nearbyListingPrices: nearbyListingPrices.length > 0 ? nearbyListingPrices : undefined,
    }),
  ]);

  const premiums: ConfigPremium[] = aiConfigResult.result.premiums;
  const combinedMultiplier = aiConfigResult.result.configMultiplier;
  const regionalMultiplier = aiGeoResult.result.regionalMultiplier;

  // Combined adjustment = config premiums × regional multiplier
  const totalMultiplier = combinedMultiplier * regionalMultiplier;

  const adjustedEstimated = Math.round(consensus.estimatedValue * totalMultiplier);
  const adjustedTradeIn = Math.round(consensus.tradeInValue * totalMultiplier);
  const adjustedRetail = Math.round(consensus.dealerRetailValue * totalMultiplier);
  const adjustedWholesale = Math.round(consensus.wholesaleValue * totalMultiplier);
  const adjustedLoan = Math.round(consensus.loanValue * totalMultiplier);

  if (premiums.length > 0 || regionalMultiplier !== 1.0) {
    console.log(
      `[MarketData] AI Config (tier ${aiConfigResult.fallbackTier}, ${consensus.configPremiumMode} mode, ${combinedMultiplier.toFixed(2)}x): ` +
      `${premiums.map((p) => p.factor).join(", ") || "none"}`,
    );
    if (regionalMultiplier !== 1.0) {
      console.log(
        `[MarketData] AI Regional (tier ${aiGeoResult.fallbackTier}): ${state} ${bodyCategory} → ${regionalMultiplier.toFixed(2)}x`,
      );
    }
    console.log(
      `[MarketData] $${consensus.estimatedValue} x ${totalMultiplier.toFixed(3)} = $${adjustedEstimated}`,
    );
  }

  // ── Build pricing trace ─────────────────────────────────────────
  const afterConfig = Math.round(consensus.estimatedValue * combinedMultiplier);
  const pricingTrace: PricingTraceStep[] = [
    {
      label: "Acquisition Consensus",
      inputDollars: consensus.estimatedValue,
      operation: "starting point",
      outputDollars: consensus.estimatedValue,
      explanation: `${consensus.sourceCount} source(s), ${(consensus.confidence * 100).toFixed(0)}% conf`,
    },
    {
      label: "Config Premium",
      inputDollars: consensus.estimatedValue,
      operation: `× ${combinedMultiplier.toFixed(3)}`,
      outputDollars: afterConfig,
      explanation: `Mode: ${consensus.configPremiumMode}. ${premiums.map((p) => `${p.factor} (${p.multiplier.toFixed(2)}x)`).join(", ") || "none"}`,
    },
    {
      label: "Regional Adjustment",
      inputDollars: afterConfig,
      operation: `× ${regionalMultiplier.toFixed(3)}`,
      outputDollars: adjustedEstimated,
      explanation: `${state} ${bodyCategory} market`,
    },
  ];

  return {
    estimatedValue: adjustedEstimated,
    valueLow: adjustedTradeIn,
    valueHigh: adjustedRetail,
    mileageAdjustment,
    nearbyListings: allListings,

    dataSource: consensus.primarySource,
    confidence: consensus.confidence,
    baseValuePreConfig: consensus.estimatedValue,
    configPremiums: premiums,
    configMultiplier: combinedMultiplier,

    tradeInValue: adjustedTradeIn,
    privatePartyValue: adjustedEstimated,
    dealerRetailValue: adjustedRetail,
    wholesaleValue: adjustedWholesale,
    loanValue: adjustedLoan,

    vdbConditionTier,

    sourceResults: consensus.sourceResults,
    consensusMethod: consensus.consensusMethod,
    configPremiumMode: consensus.configPremiumMode,
    conditionAttenuation: consensus.conditionAttenuation,
    sourceCount: consensus.sourceCount,

    pricingTrace,

    aiMetadata: {
      consensusTier: aiConsensus.fallbackTier,
      configPremiumTier: aiConfigResult.fallbackTier,
      geoPricingTier: aiGeoResult.fallbackTier,
      sourceNormTier: aiNormalization.fallbackTier,
      consensusReasoning: aiConsensus.reasoning,
      configReasoning: aiConfigResult.result.combinedReasoning,
      geoReasoning: aiGeoResult.result.reasoning,
      sourceNormReasoning: aiNormalization.result.reasoning,
      sourceNormalization: aiNormalization.result.normalizedSources,
    },
  };
}
