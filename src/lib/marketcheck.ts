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
 * Search for comparable listings using a tiered strategy that NEVER drops
 * trim/config specificity. Instead, expands geography and time range.
 *
 * Tier 1: Local active, exact config (100mi)
 * Tier 2: Nationwide active, exact config (no radius)
 * Tier 3: Nationwide recently sold, exact config (last 12 months)
 * Tier 4: Nationwide sold, year-range expansion (±3 years, same engine/drivetrain)
 *
 * Key rule: A gas F-250 is NOT a comp for a Powerstroke. Never drop engine/drivetrain.
 */
async function searchComparables(
  vehicle: MarketCheckVehicleConfig,
  zip: string,
  mileage?: number,
  rows: number = 50,
): Promise<{ active: MarketCheckSearchResponse; sold: MarketCheckSearchResponse }> {
  const apiKey = getApiKey();
  const drivetrain = normalizeDrivetrain(vehicle.drivetrain);
  const transmission = normalizeTransmission(vehicle.transmission);

  /** Build config-specific params (trim/drivetrain/trans always included) */
  function buildConfigParams(overrides?: Record<string, string>): Record<string, string> {
    const params: Record<string, string> = {
      api_key: apiKey,
      year: String(vehicle.year),
      make: vehicle.make,
      model: vehicle.model,
      rows: String(rows),
      car_type: "used",
      ...overrides,
    };
    if (vehicle.trim) params.trim = vehicle.trim;
    if (drivetrain) params.drivetrain = drivetrain;
    if (transmission) params.transmission = transmission;
    return params;
  }

  let activeResult: MarketCheckSearchResponse = { num_found: 0, listings: [] };
  let soldResult: MarketCheckSearchResponse = { num_found: 0, listings: [] };

  // ── Tier 1: Local active, exact config (100mi) ──────────────────
  const tier1Params = buildConfigParams({
    zip,
    radius: "100",
    seller_type: "dealer",
    sort_by: "distance",
    sort_order: "asc",
  });
  if (mileage && mileage > 0) {
    tier1Params.miles_range = `${Math.max(0, Math.round(mileage * 0.7))}-${Math.round(mileage * 1.3)}`;
  }

  activeResult = await doSearch("active", tier1Params);
  console.log(`[MarketCheck] Tier 1 (local active, exact config): ${activeResult.num_found} found`);

  // ── Tier 2: Nationwide active, exact config (no radius) ─────────
  if (activeResult.num_found < 5) {
    const tier2Params = buildConfigParams({
      seller_type: "dealer",
      sort_by: "price",
      sort_order: "asc",
    });
    // No zip/radius = nationwide
    // Drop mileage filter for wider net
    const nationwide = await doSearch("active", tier2Params);
    console.log(`[MarketCheck] Tier 2 (nationwide active, exact config): ${nationwide.num_found} found`);
    if (nationwide.num_found > activeResult.num_found) {
      activeResult = nationwide;
    }
  }

  // ── Tier 3: Nationwide recently sold, exact config ──────────────
  if (activeResult.num_found < 5) {
    const tier3Params = buildConfigParams({
      sort_by: "sold_date",
      sort_order: "desc",
    });
    const sold = await doSearch("sold", tier3Params);
    console.log(`[MarketCheck] Tier 3 (nationwide sold, exact config): ${sold.num_found} found`);
    soldResult = sold;
  }

  // ── Tier 4: Nationwide sold, year-range expansion (±3 years) ────
  const vehicleAge = new Date().getFullYear() - vehicle.year;
  if (activeResult.num_found + soldResult.num_found < 5 && vehicleAge >= 15) {
    const yearLow = vehicle.year - 3;
    const yearHigh = vehicle.year + 3;
    const tier4Params: Record<string, string> = {
      api_key: apiKey,
      make: vehicle.make,
      model: vehicle.model,
      year: `${yearLow}-${yearHigh}`,
      rows: String(rows),
      car_type: "used",
      sort_by: "sold_date",
      sort_order: "desc",
    };
    // Keep drivetrain/transmission (engine/config matters) but drop trim
    // since trim names may differ across years on the same platform
    if (drivetrain) tier4Params.drivetrain = drivetrain;
    if (transmission) tier4Params.transmission = transmission;

    const yearRange = await doSearch("sold", tier4Params);
    console.log(`[MarketCheck] Tier 4 (nationwide sold, ${yearLow}-${yearHigh}, same config): ${yearRange.num_found} found`);

    // Merge with existing sold results (deduplicate by ID)
    const existingIds = new Set(soldResult.listings.map((l) => l.id));
    const newListings = yearRange.listings.filter((l) => !existingIds.has(l.id));
    soldResult = {
      num_found: soldResult.num_found + newListings.length,
      listings: [...soldResult.listings, ...newListings],
    };
  }

  return { active: activeResult, sold: soldResult };
}

/**
 * Execute a MarketCheck search (active or sold inventory).
 * Automatically catches 422 radius errors and retries without radius.
 */
async function doSearch(
  type: "active" | "sold",
  params: Record<string, string>,
): Promise<MarketCheckSearchResponse> {
  const endpoint = type === "sold" ? "search/car/sold" : "search/car/active";
  const url = `${MARKETCHECK_BASE}/${endpoint}?${new URLSearchParams(params)}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  // Handle 422 radius limit error — retry without radius
  if (res.status === 422 && params.radius) {
    console.log(`[MarketCheck] 422 radius limit — retrying without radius (nationwide)`);
    const { radius: _, zip: __, ...noRadiusParams } = params;
    const retryUrl = `${MARKETCHECK_BASE}/${endpoint}?${new URLSearchParams(noRadiusParams)}`;
    const retryRes = await fetch(retryUrl, {
      headers: { Accept: "application/json" },
    });
    if (!retryRes.ok) {
      const text = await retryRes.text();
      throw new Error(`MarketCheck ${type} search error (${retryRes.status}): ${text}`);
    }
    return retryRes.json();
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MarketCheck ${type} search error (${res.status}): ${text}`);
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
  // Fire comps search + stats in parallel
  const [searchResults, stats] = await Promise.all([
    searchComparables(vehicle, zip, mileage).catch((err) => {
      console.warn(`[MarketCheck] Search failed: ${err.message}`);
      return {
        active: { num_found: 0, listings: [] } as MarketCheckSearchResponse,
        sold: { num_found: 0, listings: [] } as MarketCheckSearchResponse,
      };
    }),
    getMarketStats(vehicle.year, vehicle.make, vehicle.model).catch(() => null),
  ]);

  // Normalize active listings
  const activeListings: NormalizedListing[] = searchResults.active.listings
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

  // Normalize sold listings (labeled distinctly)
  const soldListings: NormalizedListing[] = searchResults.sold.listings
    .filter((l) => l.price > 0)
    .map((l) => ({
      title: l.heading || `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      price: l.price,
      mileage: l.miles || 0,
      location: [l.city, l.state].filter(Boolean).join(", "),
      source: `${l.seller_name || "Dealer"} (Sold)`,
      url: l.vdp_url || undefined,
    }));

  // Merge: active listings first, then sold listings
  const nearbyListings: NormalizedListing[] = [...activeListings, ...soldListings];

  if (soldListings.length > 0) {
    console.log(`[MarketCheck] ${activeListings.length} active + ${soldListings.length} sold = ${nearbyListings.length} total comps`);
  }

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
    totalFound: searchResults.active.num_found + searchResults.sold.num_found,
    mileageAnalysis,
  };
}
