/**
 * Market Data Orchestrator
 *
 * Central module that fetches vehicle market value from multiple sources
 * in a waterfall pattern, then applies configuration premiums.
 *
 * Waterfall order:
 *   1. VinAudit Market Value API (VIN-based, inherently trim-aware)
 *   2. MarketCheck (year/make/model, good for newer vehicles with dealer inventory)
 *   3. Category-aware fallback (trucks vs sedans vs SUVs)
 *
 * After obtaining a base value, configuration premiums are applied on top
 * (diesel, manual, 4x4, performance trims).
 */

import { fetchMarketValue as fetchVinAuditValue } from "./vinaudit";
import { fetchMarketCheckData } from "./marketcheck";
import {
  calculateConfigPremiums,
  classifyBody,
  type ConfigPremium,
  type VehicleConfig,
} from "./config-premiums";
import type { NormalizedListing } from "./marketcheck";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MarketDataResult {
  /** Estimated market value in dollars (after config premiums) */
  estimatedValue: number;
  /** Low end of range in dollars */
  valueLow: number;
  /** High end of range in dollars */
  valueHigh: number;
  /** Mileage adjustment in dollars (negative = over average miles) */
  mileageAdjustment: number;
  /** Comparable listings from all sources (deduplicated) */
  nearbyListings: NormalizedListing[];

  /** Which data source provided the base value */
  dataSource: "vinaudit" | "marketcheck" | "fallback";
  /** Confidence in the base price (0-1) */
  confidence: number;
  /** Base value BEFORE config premiums (dollars) */
  baseValuePreConfig: number;
  /** Applied configuration premiums */
  configPremiums: ConfigPremium[];
  /** Combined config premium multiplier */
  configMultiplier: number;
}

/* ------------------------------------------------------------------ */
/*  Category-Aware Fallback Curves                                     */
/* ------------------------------------------------------------------ */

/**
 * Fallback base values by vehicle category and age bracket.
 * Trucks hold value much better than sedans, especially with
 * desirable configurations (premiums applied separately).
 */
const FALLBACK_CURVES: Record<string, Record<string, number>> = {
  truck: {
    "0-5": 38000,
    "5-10": 28000,
    "10-15": 20000,
    "15-20": 16000,
    "20-25": 12000,
    "25-30": 9000,
    "30+": 7000,
  },
  suv: {
    "0-5": 32000,
    "5-10": 24000,
    "10-15": 16000,
    "15-20": 12000,
    "20-25": 9000,
    "25-30": 7000,
    "30+": 5000,
  },
  sports: {
    "0-5": 30000,
    "5-10": 22000,
    "10-15": 15000,
    "15-20": 11000,
    "20-25": 8000,
    "25-30": 6000,
    "30+": 5000,
  },
  sedan: {
    "0-5": 24000,
    "5-10": 16000,
    "10-15": 10000,
    "15-20": 6000,
    "20-25": 4000,
    "25-30": 3000,
    "30+": 2500,
  },
  other: {
    "0-5": 28000,
    "5-10": 20000,
    "10-15": 12000,
    "15-20": 8000,
    "20-25": 6000,
    "25-30": 4500,
    "30+": 3500,
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

function getFallbackValue(vehicle: VehicleConfig): {
  estimated: number;
  low: number;
  high: number;
} {
  const bodyType = classifyBody(vehicle);
  const age = new Date().getFullYear() - vehicle.year;
  const bracket = getAgeBracket(age);
  const curve = FALLBACK_CURVES[bodyType] || FALLBACK_CURVES.other;
  const estimated = curve[bracket] || 5000;

  return {
    estimated,
    low: Math.round(estimated * 0.6),
    high: Math.round(estimated * 1.5),
  };
}

/* ------------------------------------------------------------------ */
/*  Orchestrator                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch market data from multiple sources with config premium overlay.
 *
 * @param vehicle - Vehicle object with VIN, year, make, model, and NHTSA fields
 * @param zip     - ZIP code for nearby search
 * @param mileage - Current odometer reading
 */
export async function fetchMarketData(
  vehicle: VehicleConfig & { vin: string },
  zip: string = "97201",
  mileage?: number,
): Promise<MarketDataResult> {
  let baseEstimated = 0;
  let baseLow = 0;
  let baseHigh = 0;
  let mileageAdjustment = 0;
  let allListings: NormalizedListing[] = [];
  let dataSource: MarketDataResult["dataSource"] = "fallback";
  let confidence = 0;

  // ── Source 1: VinAudit (VIN-based, most accurate) ──────────────
  try {
    const vinAuditResult = await fetchVinAuditValue(vehicle.vin, mileage);

    if (vinAuditResult && vinAuditResult.estimatedValue > 1000) {
      baseEstimated = vinAuditResult.estimatedValue;
      baseLow = vinAuditResult.valueLow || Math.round(baseEstimated * 0.8);
      baseHigh = vinAuditResult.valueHigh || Math.round(baseEstimated * 1.2);
      mileageAdjustment = vinAuditResult.mileageAdjustment || 0;
      allListings = vinAuditResult.nearbyListings || [];
      dataSource = "vinaudit";
      confidence = 0.85;
      console.log(`[MarketData] VinAudit: $${baseEstimated} (${allListings.length} comps)`);
    } else {
      console.warn(`[MarketData] VinAudit returned low/no value for ${vehicle.vin}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[MarketData] VinAudit failed: ${msg}`);
  }

  // ── Source 2: MarketCheck (year/make/model dealer inventory) ───
  // Always try MarketCheck for comparable listings, even if VinAudit succeeded
  try {
    const mcResult = await fetchMarketCheckData(
      vehicle.year,
      vehicle.make,
      vehicle.model,
      zip,
      mileage,
    );

    if (mcResult) {
      // Merge comparable listings (deduplicate by price+mileage proximity)
      const existingPrices = new Set(allListings.map((l) => `${l.price}-${l.mileage}`));
      const newListings = mcResult.nearbyListings.filter(
        (l) => !existingPrices.has(`${l.price}-${l.mileage}`),
      );
      allListings = [...allListings, ...newListings];

      // If VinAudit didn't provide a base value, use MarketCheck
      if (dataSource === "fallback") {
        baseEstimated = mcResult.estimatedValue;
        baseLow = mcResult.valueLow;
        baseHigh = mcResult.valueHigh;
        mileageAdjustment = mcResult.mileageAdjustment;
        dataSource = "marketcheck";
        confidence = 0.75;
        console.log(`[MarketData] MarketCheck: $${baseEstimated} (${mcResult.nearbyListings.length} comps)`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[MarketData] MarketCheck failed: ${msg}`);
  }

  // ── Source 3: Category-aware fallback ──────────────────────────
  if (dataSource === "fallback") {
    const fb = getFallbackValue(vehicle);
    baseEstimated = fb.estimated;
    baseLow = fb.low;
    baseHigh = fb.high;
    confidence = 0.3;
    const bodyType = classifyBody(vehicle);
    console.warn(
      `[MarketData] Using ${bodyType} fallback for ${vehicle.year} ${vehicle.make} ${vehicle.model}: $${baseEstimated}`,
    );
  }

  // ── Apply configuration premiums ───────────────────────────────
  const { premiums, combinedMultiplier } = calculateConfigPremiums(vehicle);

  const adjustedEstimated = Math.round(baseEstimated * combinedMultiplier);
  const adjustedLow = Math.round(baseLow * combinedMultiplier);
  const adjustedHigh = Math.round(baseHigh * combinedMultiplier);

  if (premiums.length > 0) {
    console.log(
      `[MarketData] Config premiums (${combinedMultiplier.toFixed(2)}x): ${premiums.map((p) => p.factor).join(", ")}`,
    );
    console.log(
      `[MarketData] $${baseEstimated} × ${combinedMultiplier.toFixed(2)} = $${adjustedEstimated}`,
    );
  }

  return {
    estimatedValue: adjustedEstimated,
    valueLow: adjustedLow,
    valueHigh: adjustedHigh,
    mileageAdjustment,
    nearbyListings: allListings,
    dataSource,
    confidence,
    baseValuePreConfig: baseEstimated,
    configPremiums: premiums,
    configMultiplier: combinedMultiplier,
  };
}
