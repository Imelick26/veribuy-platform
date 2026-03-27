/**
 * Market Data Orchestrator (v2 — Multi-Source Consensus)
 *
 * Fetches vehicle market value from up to 3 API sources in parallel,
 * then combines them using a weighted consensus algorithm.
 *
 * Sources (parallel fan-out via Promise.allSettled):
 *   1. VehicleDatabases.com — condition-tiered pricing (primary)
 *   2. VinAudit — VIN-based market value
 *   3. MarketCheck — real dealer inventory
 *   4. Category-aware fallback curves (always available, lowest weight)
 *
 * After consensus, configuration premiums are applied with a mode
 * determined by the consensus engine (full/partial/none).
 */

import { fetchVehicleDatabasesData } from "./vehicledatabases";
import { fetchMarketValue as fetchVinAuditValue } from "./vinaudit";
import { fetchMarketCheckData } from "./marketcheck";
import {
  calculateConfigPremiums,
  classifyBody,
  type ConfigPremium,
  type VehicleConfig,
} from "./config-premiums";
import {
  calculateConsensus,
  selectTierPrices,
  type SourceEstimate,
  type ConsensusResult,
} from "./pricing-consensus";
import type { NormalizedListing } from "./marketcheck";

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

  /** Three-perspective pricing (dollars) */
  tradeInValue: number;
  privatePartyValue: number;
  dealerRetailValue: number;

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

function getFallbackEstimate(vehicle: VehicleConfig): SourceEstimate {
  const bodyType = classifyBody(vehicle);
  const age = new Date().getFullYear() - vehicle.year;
  const bracket = getAgeBracket(age);
  const curve = FALLBACK_CURVES[bodyType] || FALLBACK_CURVES.other;
  const estimated = curve[bracket] || 5000;

  return {
    source: "fallback",
    estimatedValue: estimated,
    tradeInValue: Math.round(estimated * 0.75),
    dealerRetailValue: Math.round(estimated * 1.25),
    confidence: 0.25,
    isConditionTiered: false,
  };
}

/* ------------------------------------------------------------------ */
/*  Source Fetchers (return SourceEstimate | null)                      */
/* ------------------------------------------------------------------ */

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
      confidence: 0.90,
      isConditionTiered: true,
      raw: { tier, allTiers: result.tiers },
    },
    tier,
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
    vehicle.year,
    vehicle.make,
    vehicle.model,
    zip,
    mileage,
  );
  if (!result) return null;

  return {
    estimate: {
      source: "marketcheck",
      estimatedValue: result.estimatedValue,
      tradeInValue: Math.round(result.estimatedValue * 0.85),
      dealerRetailValue: result.valueHigh || Math.round(result.estimatedValue * 1.15),
      confidence: result.nearbyListings.length >= 5 ? 0.80 : 0.60,
      isConditionTiered: false,
      raw: { stats: { low: result.valueLow, high: result.valueHigh }, listingCount: result.nearbyListings.length },
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
  // Extract state from ZIP (rough mapping) or default to OR
  const state = "OR"; // TODO: derive from zip

  const sourceEstimates: SourceEstimate[] = [];
  let allListings: NormalizedListing[] = [];
  let vdbConditionTier: string | null = null;
  let mileageAdjustment = 0;

  // ── Parallel fan-out: fire all API calls simultaneously ─────────
  const [vdbResult, vinAuditResult, marketCheckResult] = await Promise.allSettled([
    fetchVDBSource(vehicle.vin, mileage, state, conditionScore).catch((err) => {
      console.warn(`[MarketData] VehicleDatabases failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }),
    fetchVinAuditSource(vehicle.vin, mileage).catch((err) => {
      console.warn(`[MarketData] VinAudit failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }),
    fetchMarketCheckSource(vehicle, zip, mileage).catch((err) => {
      console.warn(`[MarketData] MarketCheck failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }),
  ]);

  // ── Collect results ──────────────────────────────────────────────

  // VehicleDatabases
  const vdb = vdbResult.status === "fulfilled" ? vdbResult.value : null;
  if (vdb) {
    sourceEstimates.push(vdb.estimate);
    vdbConditionTier = vdb.tier;
    console.log(
      `[MarketData] VehicleDatabases (${vdb.tier}): $${vdb.estimate.estimatedValue} PP / $${vdb.estimate.tradeInValue} TI / $${vdb.estimate.dealerRetailValue} DR`,
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

  // Always add fallback as lowest-weight option
  const fallback = getFallbackEstimate(vehicle);
  sourceEstimates.push(fallback);
  console.log(`[MarketData] Fallback (${classifyBody(vehicle)}): $${fallback.estimatedValue}`);

  // ── Calculate consensus ──────────────────────────────────────────
  const consensus: ConsensusResult = calculateConsensus(sourceEstimates);

  console.log(
    `[MarketData] Consensus (${consensus.consensusMethod}): $${consensus.estimatedValue} PP | ` +
    `Primary: ${consensus.primarySource} | Confidence: ${(consensus.confidence * 100).toFixed(0)}%`,
  );

  // ── Apply configuration premiums ─────────────────────────────────
  const { premiums, combinedMultiplier } = calculateConfigPremiums(
    vehicle,
    consensus.configPremiumMode,
  );

  const adjustedEstimated = Math.round(consensus.estimatedValue * combinedMultiplier);
  const adjustedTradeIn = Math.round(consensus.tradeInValue * combinedMultiplier);
  const adjustedRetail = Math.round(consensus.dealerRetailValue * combinedMultiplier);

  if (premiums.length > 0) {
    console.log(
      `[MarketData] Config premiums (${consensus.configPremiumMode} mode, ${combinedMultiplier.toFixed(2)}x): ` +
      `${premiums.map((p) => p.factor).join(", ")}`,
    );
    console.log(
      `[MarketData] $${consensus.estimatedValue} x ${combinedMultiplier.toFixed(2)} = $${adjustedEstimated}`,
    );
  }

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

    vdbConditionTier,

    sourceResults: consensus.sourceResults,
    consensusMethod: consensus.consensusMethod,
    configPremiumMode: consensus.configPremiumMode,
    conditionAttenuation: consensus.conditionAttenuation,
  };
}
