/**
 * MarketCheck API client for vehicle market value and comparable listings.
 * Docs: https://apidocs.marketcheck.com/
 *
 * Free tier: 1,000 requests/month
 * Provides real-time dealer inventory listings with actual prices.
 */

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
}

export interface NormalizedListing {
  title: string;
  price: number;     // dollars
  mileage: number;
  location: string;
  source: string;
  url?: string;
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
 * Search for active comparable listings near a location.
 */
async function searchActiveListings(
  year: number,
  make: string,
  model: string,
  zip: string,
  radius: number = 100,
  rows: number = 10,
): Promise<MarketCheckSearchResponse> {
  const apiKey = getApiKey();

  const params = new URLSearchParams({
    api_key: apiKey,
    year: String(year),
    make,
    model,
    zip,
    radius: String(radius),
    rows: String(rows),
    car_type: "used",
    seller_type: "dealer",
    sort_by: "distance",
    sort_order: "asc",
  });

  const url = `${MARKETCHECK_BASE}/search/car/active?${params}`;

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
 * Calls both the search and stats endpoints, then normalizes into the
 * same shape the rest of the app expects (dollars, not cents).
 *
 * Returns null if MarketCheck has no data for the vehicle (common for
 * old/rare vehicles not in active dealer inventory). The caller
 * (market-data.ts orchestrator) handles fallback.
 *
 * @param year   - Vehicle model year
 * @param make   - Vehicle make (e.g. "Toyota")
 * @param model  - Vehicle model (e.g. "Camry")
 * @param zip    - ZIP code for nearby search (defaults to "97201" Portland)
 * @param mileage - Current odometer for mileage adjustment estimate
 */
export async function fetchMarketCheckData(
  year: number,
  make: string,
  model: string,
  zip: string = "97201",
  mileage?: number,
): Promise<MarketValueResult | null> {
  // Fire both requests in parallel — catch both so we can fallback gracefully
  const [searchResult, stats] = await Promise.all([
    searchActiveListings(year, make, model, zip, 100, 10).catch((err) => {
      console.warn(`[MarketCheck] Search failed: ${err.message}`);
      return { num_found: 0, listings: [] } as MarketCheckSearchResponse;
    }),
    getMarketStats(year, make, model).catch(() => null), // stats endpoint may fail on rare vehicles
  ]);

  // Normalize listings
  const nearbyListings: NormalizedListing[] = searchResult.listings
    .filter((l) => l.price > 0)
    .map((l) => ({
      title: l.heading || `${year} ${make} ${model}`,
      price: l.price,
      mileage: l.miles || 0,
      location: [l.city, l.state].filter(Boolean).join(", "),
      source: l.seller_name || "Dealer",
      url: l.vdp_url || undefined,
    }));

  // Calculate estimated value from stats or listings
  let estimatedValue: number;
  let valueLow: number;
  let valueHigh: number;

  if (stats && stats.mean > 0) {
    // Use stats endpoint data
    estimatedValue = Math.round(stats.median || stats.mean);
    valueLow = Math.round(stats.min || stats.mean * 0.8);
    valueHigh = Math.round(stats.max || stats.mean * 1.2);
  } else if (nearbyListings.length > 0) {
    // Calculate from listings
    const prices = nearbyListings.map((l) => l.price).sort((a, b) => a - b);
    estimatedValue = prices[Math.floor(prices.length / 2)]; // median
    valueLow = prices[0];
    valueHigh = prices[prices.length - 1];
  } else {
    // No data from MarketCheck — return null so the orchestrator can try other sources
    console.warn(`[MarketCheck] No data for ${year} ${make} ${model}`);
    return null;
  }

  // Rough mileage adjustment: if we have avg miles from stats and actual mileage,
  // estimate a per-mile depreciation
  let mileageAdjustment = 0;
  if (mileage && stats?.avg_miles && stats.avg_miles > 0) {
    const milesDiff = mileage - stats.avg_miles;
    // Approximate $0.05–$0.15 per mile depending on vehicle value
    const perMile = estimatedValue > 30000 ? 0.12 : estimatedValue > 15000 ? 0.08 : 0.05;
    mileageAdjustment = Math.round(-milesDiff * perMile);
  }

  return {
    estimatedValue,
    valueLow,
    valueHigh,
    mileageAdjustment,
    nearbyListings,
  };
}
