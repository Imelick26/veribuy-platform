/**
 * MarketCheck API client for vehicle market value and comparable listings.
 * Docs: https://apidocs.marketcheck.com/
 *
 * Free tier: 1,000 requests/month
 * Provides real-time dealer inventory listings with actual prices.
 *
 * v2 — Enhanced with trim/drivetrain/transmission/mileage filters and
 *       tiered search strategy (exact → relaxed → broad) for better comps.
 */

import { analyzeMileageComps, type MileageAnalysisResult } from "./ai/mileage-analyzer";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MarketCheckListing {
  id: string;
  heading: string;
  price: number;
  miles: number;
  city: string;
  state: string;
  seller_name: string;
  vdp_url?: string;
  inventory_type: string; // "used", "new", "cpo"
  dom?: number; // days on market
  exterior_color?: string;
  interior_color?: string;
  trim?: string;
  transmission?: string;
  drivetrain?: string;
}

export interface MarketCheckSearchResponse {
  num_found: number;
  listings: MarketCheckListing[];
}

export interface MarketCheckStats {
  count: number;
  mean: number;
  median: number;
  std_dev: number;
  min: number;
  max: number;
  avg_miles: number;
}

/** Normalized output matching what the rest of the app expects */
export interface MarketValueResult {
  estimatedValue: number;   // dollars — median market price
  valueLow: number;         // dollars — low end
  valueHigh: number;        // dollars — high end (retail)
  mileageAdjustment: number;
  nearbyListings: NormalizedListing[];
  /** Average days on market for comparable listings (0 if unavailable) */
  avgDaysOnMarket: number;
  /** Total comparable listings found (before row limit) */
  totalFound: number;
  /** AI mileage analysis results (when available) */
  mileageAnalysis?: MileageAnalysisResult;
}

export interface NormalizedListing {
  title: string;
  price: number;     // dollars
  mileage: number;
  location: string;
  source: string;
  url?: string;
  daysOnMarket?: number;
}

/** Vehicle config passed to the enhanced search */
export interface MarketCheckVehicleConfig {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  drivetrain?: string | null;
  transmission?: string | null;
  bodyStyle?: string | null;
}

/* ------------------------------------------------------------------ */
/*  API helpers                                                        */
/* ------------------------------------------------------------------ */

const MARKETCHECK_BASE = "https://mc-api.marketcheck.com/v2";

function getApiKey(): string {
  const key = process.env.MARKETCHECK_API_KEY;
  if (!key) throw new Error("Missing MARKETCHECK_API_KEY environment variable");
  return key;
}

/**
 * Map our drivetrain values to MarketCheck's expected format.
 */
function normalizeDrivetrain(drivetrain: string | null | undefined): string | null {
  if (!drivetrain) return null;
  const dt = drivetrain.toUpperCase();
  if (dt.includes("4WD") || dt.includes("4X4")) return "4wd";
  if (dt.includes("AWD")) return "awd";
  if (dt.includes("RWD") || dt.includes("REAR")) return "rwd";
  if (dt.includes("FWD") || dt.includes("FRONT")) return "fwd";
  return null;
}

/**
 * Map transmission to MarketCheck format.
 */
function normalizeTransmission(transmission: string | null | undefined): string | null {
  if (!transmission) return null;
  const tx = transmission.toUpperCase();
  if (tx.includes("MANUAL") || tx.includes("MT") || tx.includes("STICK")) return "manual";
  if (tx.includes("AUTO") || tx.includes("AT") || tx.includes("CVT")) return "automatic";
  return null;
}

/**
 * Search for active comparable listings with enhanced filters.
 * Uses a tiered strategy: exact match → relaxed → broad to ensure results.
 */
async function searchActiveListings(
  vehicle: MarketCheckVehicleConfig,
  zip: string,
  mileage?: number,
  radius: number = 150,
  rows: number = 50,
): Promise<MarketCheckSearchResponse> {
  const apiKey = getApiKey();

  // Build base params
  const baseParams: Record<string, string> = {
    api_key: apiKey,
    year: String(vehicle.year),
    make: vehicle.make,
    model: vehicle.model,
    zip,
    radius: String(radius),
    rows: String(rows),
    car_type: "used",
    seller_type: "dealer",
    sort_by: "distance",
    sort_order: "asc",
  };

  // Add mileage range filter (±30% of actual mileage, or ±50K if unknown)
  if (mileage && mileage > 0) {
    const mileageLow = Math.max(0, Math.round(mileage * 0.7));
    const mileageHigh = Math.round(mileage * 1.3);
    baseParams.miles_range = `${mileageLow}-${mileageHigh}`;
  }

  // Tier 1: Exact match with trim + drivetrain + transmission
  const exactParams = { ...baseParams };
  const drivetrain = normalizeDrivetrain(vehicle.drivetrain);
  const transmission = normalizeTransmission(vehicle.transmission);

  if (vehicle.trim) exactParams.trim = vehicle.trim;
  if (drivetrain) exactParams.drivetrain = drivetrain;
  if (transmission) exactParams.transmission = transmission;

  let result = await doSearch(exactParams);

  // Tier 2: Relax trim but keep drivetrain (if exact match had < 5 results)
  if (result.num_found < 5 && vehicle.trim) {
    console.log(`[MarketCheck] Exact match found ${result.num_found}, relaxing trim filter`);
    const relaxedParams = { ...baseParams };
    if (drivetrain) relaxedParams.drivetrain = drivetrain;
    if (transmission) relaxedParams.transmission = transmission;

    const relaxed = await doSearch(relaxedParams);
    if (relaxed.num_found > result.num_found) {
      result = relaxed;
    }
  }

  // Tier 3: Broad — just year/make/model with wider radius (if still < 3 results)
  if (result.num_found < 3) {
    console.log(`[MarketCheck] Relaxed match found ${result.num_found}, going broad with 300mi radius`);
    const { miles_range: _, ...broadBase } = baseParams;
    const broadParams = { ...broadBase, radius: "300" };

    const broad = await doSearch(broadParams);
    if (broad.num_found > result.num_found) {
      result = broad;
    }
  }

  return result;
}

async function doSearch(params: Record<string, string>): Promise<MarketCheckSearchResponse> {
  const url = `${MARKETCHECK_BASE}/search/car/active?${new URLSearchParams(params)}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MarketCheck search error (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Get market statistics (mean, median, min, max prices) for a vehicle.
 */
async function getMarketStats(
  year: number,
  make: string,
  model: string,
): Promise<MarketCheckStats> {
  const apiKey = getApiKey();

  const params = new URLSearchParams({
    api_key: apiKey,
    year: String(year),
    make,
    model,
    car_type: "used",
  });

  const url = `${MARKETCHECK_BASE}/stats/car?${params}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MarketCheck stats error (${res.status}): ${text}`);
  }

  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Fetch market value + comparable listings from MarketCheck.
 *
 * v2: Uses tiered search (exact → relaxed → broad) with trim, drivetrain,
 * transmission, and mileage filters. Returns up to 50 comparable listings
 * with days-on-market data.
 *
 * Returns null if MarketCheck has no data for the vehicle (common for
 * old/rare vehicles not in active dealer inventory). The caller
 * (market-data.ts orchestrator) handles fallback.
 */
export async function fetchMarketCheckData(
  vehicle: MarketCheckVehicleConfig,
  zip: string = "97201",
  mileage?: number,
): Promise<MarketValueResult | null> {
  // Fire both requests in parallel — catch both so we can fallback gracefully
  const [searchResult, stats] = await Promise.all([
    searchActiveListings(vehicle, zip, mileage).catch((err) => {
      console.warn(`[MarketCheck] Search failed: ${err.message}`);
      return { num_found: 0, listings: [] } as MarketCheckSearchResponse;
    }),
    getMarketStats(vehicle.year, vehicle.make, vehicle.model).catch(() => null),
  ]);

  // Normalize listings
  const nearbyListings: NormalizedListing[] = searchResult.listings
    .filter((l) => l.price > 0)
    .map((l) => ({
      title: l.heading || `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      price: l.price,
      mileage: l.miles || 0,
      location: [l.city, l.state].filter(Boolean).join(", "),
      source: l.seller_name || "Dealer",
      url: l.vdp_url || undefined,
      daysOnMarket: l.dom || undefined,
    }));

  // Calculate average days on market
  const listingsWithDom = nearbyListings.filter((l) => l.daysOnMarket && l.daysOnMarket > 0);
  const avgDaysOnMarket = listingsWithDom.length > 0
    ? Math.round(listingsWithDom.reduce((s, l) => s + (l.daysOnMarket || 0), 0) / listingsWithDom.length)
    : 0;

  // ── AI-Powered Mileage Normalization ─────────────────────────────
  //
  // Problem: comps are at different mileages AND conditions.
  //   A $35K listing at 30K miles ≠ $35K at our 60K miles.
  //
  // Solution: GPT-4o-mini analyzes the comps with vehicle-specific
  //   knowledge to determine the per-mile rate, flag outliers, and
  //   calculate the fair value at our exact mileage.
  //
  // Falls back to regression if AI is unavailable.

  let estimatedValue: number;
  let valueLow: number;
  let valueHigh: number;
  let mileageAdjustment = 0;
  let mileageAnalysis: MileageAnalysisResult | undefined;

  if (nearbyListings.length === 0 && (!stats || stats.mean <= 0)) {
    console.warn(`[MarketCheck] No data for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    return null;
  }

  const compsWithMileage = nearbyListings.filter((l) => l.mileage > 0 && l.price > 0);

  if (compsWithMileage.length >= 3 && mileage) {
    // Run AI mileage analysis (falls back to regression internally if GPT fails)
    mileageAnalysis = await analyzeMileageComps({
      vehicle: {
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        drivetrain: vehicle.drivetrain,
        transmission: vehicle.transmission,
      },
      subjectMileage: mileage,
      comps: compsWithMileage.map((l) => ({
        title: l.title,
        price: l.price,
        mileage: l.mileage,
        daysOnMarket: l.daysOnMarket,
      })),
    });

    if (mileageAnalysis.adjustedValue > 0) {
      estimatedValue = mileageAnalysis.adjustedValue;
      valueLow = mileageAnalysis.adjustedLow;
      valueHigh = mileageAnalysis.adjustedHigh;

      // Track mileage adjustment vs raw median
      const rawPrices = nearbyListings.map((l) => l.price).sort((a, b) => a - b);
      const rawMedian = rawPrices[Math.floor(rawPrices.length / 2)];
      mileageAdjustment = estimatedValue - rawMedian;

      console.log(
        `[MarketCheck] ${mileageAnalysis.aiAnalyzed ? "AI" : "Regression"} mileage normalization: ` +
        `$${mileageAnalysis.perMileRate.toFixed(3)}/mi | raw median $${rawMedian} → $${estimatedValue} ` +
        `(${mileageAnalysis.outlierIndices.length} outliers excluded)`,
      );
    } else {
      // AI returned 0 — fall through to raw calculation
      const prices = nearbyListings.map((l) => l.price).sort((a, b) => a - b);
      estimatedValue = prices[Math.floor(prices.length / 2)];
      valueLow = prices[0];
      valueHigh = prices[prices.length - 1];
    }
  } else if (stats && stats.mean > 0) {
    // No comps with mileage but we have stats — use stats with basic adjustment
    estimatedValue = Math.round(stats.median || stats.mean);
    valueLow = Math.round(stats.min || stats.mean * 0.8);
    valueHigh = Math.round(stats.max || stats.mean * 1.2);

    if (mileage && stats.avg_miles > 0) {
      const avgPrice = compsWithMileage.length > 0
        ? compsWithMileage.reduce((s, c) => s + c.price, 0) / compsWithMileage.length
        : estimatedValue;
      const fallbackRate = avgPrice >= 40000 ? 0.14 : avgPrice >= 25000 ? 0.10 : 0.07;
      const milesDiff = mileage - stats.avg_miles;
      mileageAdjustment = Math.round(-milesDiff * fallbackRate);
      estimatedValue += mileageAdjustment;
    }
  } else {
    // Listings but no mileage to normalize — raw median
    const prices = nearbyListings.map((l) => l.price).sort((a, b) => a - b);
    estimatedValue = prices[Math.floor(prices.length / 2)];
    valueLow = prices[0];
    valueHigh = prices[prices.length - 1];
  }

  return {
    estimatedValue,
    valueLow,
    valueHigh,
    mileageAdjustment,
    nearbyListings,
    avgDaysOnMarket,
    totalFound: searchResult.num_found,
    mileageAnalysis,
  };
}
