/**
 * Black Book API Client
 *
 * Industry-standard vehicle valuations used by dealers.
 *
 * Used Car API — condition-tiered pricing across five perspectives:
 *   - Wholesale (4 tiers): Extra Clean / Clean / Average / Rough
 *   - Retail (4 tiers): Extra Clean / Clean / Average / Rough
 *   - Trade-In (3 tiers): Clean / Average / Rough
 *   - Private Party (3 tiers): Clean / Average / Rough
 *   - Finance Advance: single value
 *
 * Retail Listings API — real dealer inventory from 53K+ dealers:
 *   - Active and sold listings with price, mileage, days on market
 *   - Aggregate statistics: mean days to turn, market days supply
 *   - Searched by UVC (from Used Car API) + ZIP + radius
 *
 * API: REST at https://service.blackbookcloud.com/UsedCarWS/UsedCarWS
 * Auth: Basic authentication (username:password)
 * Values: All in whole US dollars (not cents)
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type BBCondition = "extra_clean" | "clean" | "average" | "rough";

export interface BBValuation {
  vin: string;
  uvc: string;              // Universal Vehicle Code — needed for Retail Listings API
  year: number;
  make: string;
  model: string;
  series: string;           // trim/series (e.g., "Lariat", "SE")
  style: string;            // body style (e.g., "Supercrew", "4D Sedan")

  /** Wholesale values by condition — what dealers pay at auction (dollars) */
  wholesale: Record<BBCondition, number>;
  /** Retail values by condition — dealer listing price (dollars) */
  retail: Record<BBCondition, number>;
  /** Trade-in values by condition — what dealers offer on trade (dollars) */
  tradeIn: { clean: number; average: number; rough: number };
  /** Private party values by condition — person-to-person sale price (dollars) */
  privateParty: { clean: number; average: number; rough: number };

  /** Adjusted wholesale — base + mileage + add/deduct + regional (dollars) */
  adjustedWholesale: Record<BBCondition, number>;
  /** Adjusted retail — base + mileage + add/deduct + regional (dollars) */
  adjustedRetail: Record<BBCondition, number>;
  /** Adjusted trade-in — base + mileage + add/deduct + regional (dollars) */
  adjustedTradeIn: { clean: number; average: number; rough: number };
  /** Adjusted private party — base + mileage + add/deduct + regional (dollars) */
  adjustedPrivateParty: { clean: number; average: number; rough: number };

  /** Finance advance value (dollars) */
  financeAdvance: number;

  /** Vehicle classification */
  groupNum: number;          // 7000+ = truck
  classCode: string;         // e.g., "W" for minivan
  className: string;         // e.g., "Minivan", "Full-Size Pickup"
  msrp: number;              // original MSRP (dollars)

  /** Vehicle attributes from BB */
  engineDescription: string | null;
  transmission: string | null;  // "A" = automatic, "M" = manual
  drivetrain: string | null;
  fuelType: string | null;

  /** Data quality flags */
  isTruck: boolean;            // derived from groupNum >= 7000
  firstValuesFlag: boolean;    // true = editorial estimate, not auction-based
  vinOnly: boolean;            // true = limited/unavailable data
  enhancedTrimMatch: boolean;  // true = EVM matched VIN to trim

  /** Mileage used in valuation */
  mileage: number;

  /** Raw API response for debugging */
  rawResponse: unknown;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getCredentials(): { username: string; password: string } {
  const username = process.env.BLACKBOOK_USERNAME;
  const password = process.env.BLACKBOOK_PASSWORD;
  if (!username || !password) {
    throw new Error("Missing BLACKBOOK_USERNAME or BLACKBOOK_PASSWORD environment variables");
  }
  return { username, password };
}

const BB_USED_CAR_BASE = "https://service.blackbookcloud.com/UsedCarWS/UsedCarWS";
const BB_RETAIL_BASE = "https://service.blackbookcloud.com/RetailAPI/RetailAPI";

function parseNum(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val !== "string") return 0;
  const cleaned = val.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function buildAuth(): string {
  const { username, password } = getCredentials();
  return Buffer.from(`${username}:${password}`).toString("base64");
}

/* ------------------------------------------------------------------ */
/*  Used Car API                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch Black Book valuation by VIN.
 *
 * Returns null if Black Book has no data for this VIN.
 *
 * @param vin     - 17-digit VIN
 * @param mileage - Current odometer reading
 * @param state   - Two-letter state code for regional adjustment
 */
export async function fetchBlackBookValuation(
  vin: string,
  mileage?: number,
  state?: string,
): Promise<BBValuation | null> {
  const auth = buildAuth();

  const params = new URLSearchParams({ vin });
  if (mileage) params.set("mileage", String(mileage));
  if (state) params.set("state", state);

  const url = `${BB_USED_CAR_BASE}/VIN/${vin}?${params}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404 || res.status === 422) {
      console.warn(`[BlackBook] No data for VIN ${vin}: ${text}`);
      return null;
    }
    throw new Error(`BlackBook API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return normalizeValuationResponse(data, vin, mileage);
}

/**
 * Fallback: Fetch Black Book valuation by year/make/model.
 */
export async function fetchBlackBookByYMM(
  year: number,
  make: string,
  model: string,
  mileage?: number,
  state?: string,
): Promise<BBValuation | null> {
  const auth = buildAuth();

  const params = new URLSearchParams({
    year: String(year),
    make,
    series: model,
  });
  if (mileage) params.set("mileage", String(mileage));
  if (state) params.set("state", state);

  const url = `${BB_USED_CAR_BASE}/UsedCar?${params}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404 || res.status === 422) {
      console.warn(`[BlackBook] No data for ${year} ${make} ${model}: ${text}`);
      return null;
    }
    throw new Error(`BlackBook API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return normalizeValuationResponse(data, `${year}-${make}-${model}`, mileage);
}

/* ------------------------------------------------------------------ */
/*  Used Car Response Normalization                                    */
/* ------------------------------------------------------------------ */

function normalizeValuationResponse(
  data: Record<string, unknown>,
  vinOrKey: string,
  mileage?: number,
): BBValuation | null {
  // BB response: { used_vehicles: { used_vehicle_list: [...] } }
  // Also handle legacy shapes for safety
  const usedVehicles = data.used_vehicles as Record<string, unknown> | undefined;
  const vehicleList = (
    (usedVehicles?.used_vehicle_list as Array<Record<string, unknown>>) ||
    (data.used_vehicles as Array<Record<string, unknown>>) ||
    (data.vehicles as Array<Record<string, unknown>>) ||
    [data]
  );

  const v = vehicleList[0];
  if (!v) {
    console.warn(`[BlackBook] Empty response for ${vinOrKey}`);
    return null;
  }

  // ── Wholesale (4 tiers) ──
  const wholesale: Record<BBCondition, number> = {
    extra_clean: parseNum(v.base_whole_xclean),
    clean: parseNum(v.base_whole_clean),
    average: parseNum(v.base_whole_avg),
    rough: parseNum(v.base_whole_rough),
  };
  const adjustedWholesale: Record<BBCondition, number> = {
    extra_clean: parseNum(v.adjusted_whole_xclean) || wholesale.extra_clean,
    clean: parseNum(v.adjusted_whole_clean) || wholesale.clean,
    average: parseNum(v.adjusted_whole_avg) || wholesale.average,
    rough: parseNum(v.adjusted_whole_rough) || wholesale.rough,
  };

  // ── Retail (4 tiers) ──
  const retail: Record<BBCondition, number> = {
    extra_clean: parseNum(v.base_retail_xclean),
    clean: parseNum(v.base_retail_clean),
    average: parseNum(v.base_retail_avg),
    rough: parseNum(v.base_retail_rough),
  };
  const adjustedRetail: Record<BBCondition, number> = {
    extra_clean: parseNum(v.adjusted_retail_xclean) || retail.extra_clean,
    clean: parseNum(v.adjusted_retail_clean) || retail.clean,
    average: parseNum(v.adjusted_retail_avg) || retail.average,
    rough: parseNum(v.adjusted_retail_rough) || retail.rough,
  };

  // ── Trade-In (3 tiers — no extra_clean) ──
  const tradeIn = {
    clean: parseNum(v.base_tradein_clean),
    average: parseNum(v.base_tradein_avg),
    rough: parseNum(v.base_tradein_rough),
  };
  const adjustedTradeIn = {
    clean: parseNum(v.adjusted_tradein_clean) || tradeIn.clean,
    average: parseNum(v.adjusted_tradein_avg) || tradeIn.average,
    rough: parseNum(v.adjusted_tradein_rough) || tradeIn.rough,
  };

  // ── Private Party (3 tiers — no extra_clean) ──
  const privateParty = {
    clean: parseNum(v.base_private_clean),
    average: parseNum(v.base_private_avg),
    rough: parseNum(v.base_private_rough),
  };
  const adjustedPrivateParty = {
    clean: parseNum(v.adjusted_private_clean) || privateParty.clean,
    average: parseNum(v.adjusted_private_avg) || privateParty.average,
    rough: parseNum(v.adjusted_private_rough) || privateParty.rough,
  };

  // ── Finance Advance ──
  const financeAdvance = parseNum(v.adjusted_finadv) || parseNum(v.base_finadv);

  // Validate: at least one perspective should have data
  const hasAnyValue = wholesale.clean > 0 || retail.clean > 0 || tradeIn.clean > 0;
  if (!hasAnyValue) {
    console.warn(`[BlackBook] Response had no valid values for ${vinOrKey}`);
    return null;
  }

  const groupNum = parseNum(v.groupnum);

  return {
    vin: String(v.vin || vinOrKey),
    uvc: String(v.uvc || ""),
    year: Number(v.model_year || 0),
    make: String(v.make || ""),
    model: String(v.model || ""),
    series: String(v.series || ""),
    style: String(v.style || ""),

    wholesale,
    retail,
    tradeIn,
    privateParty,

    adjustedWholesale,
    adjustedRetail,
    adjustedTradeIn,
    adjustedPrivateParty,

    financeAdvance,

    groupNum,
    classCode: String(v.class_code || ""),
    className: String(v.class_name || ""),
    msrp: parseNum(v.msrp),

    engineDescription: v.engine_description ? String(v.engine_description) : null,
    transmission: v.transmission ? String(v.transmission) : null,
    drivetrain: v.drivetrain ? String(v.drivetrain) : null,
    fuelType: v.fuel_type ? String(v.fuel_type) : null,

    isTruck: groupNum >= 7000,
    firstValuesFlag: v.first_values_flag === true,
    vinOnly: v.vin_only === true,
    enhancedTrimMatch: v.enhanced_trim_match === true,

    mileage: Number(v.mileage || mileage || 0),
    rawResponse: data,
  };
}

/* ------------------------------------------------------------------ */
/*  Condition Mapping Helper                                           */
/* ------------------------------------------------------------------ */

/**
 * Map a VeriBuy condition score (0-100) to a Black Book condition tier.
 *
 * BB condition definitions:
 *   Extra Clean: Like new for model year, perfect paint, no visible wear, very low miles
 *   Clean: Very little interior/exterior wear, matching tires with good tread, mechanically sound
 *   Average: Visible interior and exterior wear, still a good vehicle
 *   Rough: Below-average condition and/or excessive mileage, limited service life
 *
 *   90-100 → extra_clean
 *   75-89  → clean
 *   50-74  → average
 *   0-49   → rough
 */
export function mapScoreToBBCondition(score: number): BBCondition {
  if (score >= 90) return "extra_clean";
  if (score >= 75) return "clean";
  if (score >= 50) return "average";
  return "rough";
}

/* ------------------------------------------------------------------ */
/*  Retail Listings API (Comparable Listings)                           */
/* ------------------------------------------------------------------ */

export interface BBRetailComp {
  listingId: string;
  title: string;
  price: number;              // listing price in dollars (0 = price not listed)
  mileage: number;
  daysOnMarket: number;
  listingType: string;        // "Active" or "Sold"
  listingUrl: string | null;
  dealerName: string;
  dealerCity: string;
  dealerState: string;
  dealerType: string;         // "F" = franchise, "I" = independent
  distanceToDealer: number;   // miles from search ZIP
  vin: string;
  year: string;
  make: string;
  model: string;
  series: string;
  certified: boolean;
  exteriorColor: string | null;

  // For backward compat with existing comp table UI
  location: string;
  source: string;
}

export interface BBRetailInsightsResult {
  comps: BBRetailComp[];
  totalListings: number;

  /** Aggregate statistics from BB */
  meanDaysToTurn: number | null;
  marketDaysSupply: number | null;

  /** Active listing stats */
  activeCount: number;
  activeMeanPrice: number;
  activeMedianPrice: number;
  activeMeanMileage: number;

  /** Sold listing stats */
  soldCount: number;
  soldMeanPrice: number;
  soldMedianPrice: number;
  soldMeanMileage: number;
  soldMeanDaysToTurn: number | null;
}

/**
 * Fetch comparable retail listings from Black Book's Retail Listings API.
 *
 * Uses the UVC (from Used Car API response) to find comparable vehicles
 * within a geographic radius. Returns active and sold listings with
 * aggregate market statistics.
 *
 * @param uvc       - Black Book Universal Vehicle Code (from BBValuation.uvc)
 * @param zip       - ZIP code center for search
 * @param mileage   - Vehicle mileage for filtering comps (±30K range)
 * @param radiusMiles - Search radius (default 200)
 * @param maxListings - Max listings to return (default 25)
 */
export async function fetchBlackBookRetailInsights(
  uvc: string,
  zip: string,
  mileage?: number,
  radiusMiles: number = 200,
  maxListings: number = 25,
): Promise<BBRetailInsightsResult | null> {
  if (!uvc) {
    console.warn("[BlackBook] No UVC provided — cannot fetch retail insights");
    return null;
  }

  const auth = buildAuth();

  // Build search params per BB Retail Listings API docs
  const params = new URLSearchParams({
    uvc,
    zipcode: zip,
    radius_miles: String(radiusMiles),
    listing_type: "both",       // "active", "sold", or "both" — need sold stats for market intel
    all_trims: "true",          // include similar trims
    duplicate_vins: "false",    // deduplicate
    day_range: "90",            // 90 days of sold data for relevance
    price_analysis: "true",     // enable BB trim matching by price
    dealer_stats: "false",
    listings_per_page: String(maxListings),
    page_number: "1",
  });

  // Filter comps to reasonable mileage range if mileage provided
  if (mileage) {
    params.set("minimum_mileage", String(Math.max(0, mileage - 30000)));
    params.set("maximum_mileage", String(mileage + 30000));
  }

  const url = `${BB_RETAIL_BASE}/Listings?${params}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404 || res.status === 422) {
      console.warn(`[BlackBook] No retail listings for UVC ${uvc}: ${text}`);
      return null;
    }
    throw new Error(`BlackBook Retail API error (${res.status}): ${text}`);
  }

  const data = await res.json() as Record<string, unknown>;

  // Parse listings array
  const rawListings = (data.listings || []) as Array<Record<string, unknown>>;
  const comps: BBRetailComp[] = rawListings
    .filter((l) => parseNum(l.price) > 0) // exclude $0 listings (price not posted)
    .map((l) => ({
      listingId: String(l.listing_id || ""),
      title: String(l.listing_heading || `${l.model_year} ${l.make} ${l.model} ${l.series || ""}`).trim(),
      price: parseNum(l.price),
      mileage: parseNum(l.mileage),
      daysOnMarket: parseNum(l.days_on_market),
      listingType: String(l.listing_type || "Active"),
      listingUrl: l.listing_url ? String(l.listing_url) : null,
      dealerName: String(l.dealer_name || ""),
      dealerCity: String(l.dealer_city || ""),
      dealerState: String(l.dealer_state || ""),
      dealerType: String(l.dealer_type || "I"),
      distanceToDealer: parseNum(l.distance_to_dealer),
      vin: String(l.vin || ""),
      year: String(l.model_year || ""),
      make: String(l.make || ""),
      model: String(l.model || ""),
      series: String(l.series || ""),
      certified: l.certified === true,
      exteriorColor: l.exterior_color ? String(l.exterior_color) : null,

      // Backward compat for existing comp table UI
      location: [l.dealer_city, l.dealer_state].filter(Boolean).join(", "),
      source: `${l.dealer_name || "Dealer"}${l.dealer_type === "F" ? " (Franchise)" : ""}`,
    }));

  // Parse aggregate statistics
  const stats = data.listings_statistics as Record<string, unknown> | undefined;
  const activeStats = stats?.active_statistics as Record<string, unknown> | undefined;
  const soldStats = stats?.sold_statistics as Record<string, unknown> | undefined;

  const totalListings = parseNum(data.record_count);

  console.log(
    `[BlackBook] Retail Insights: ${comps.length} comps (${totalListings} total), ` +
    `active=${parseNum(activeStats?.vehicle_count)} sold=${parseNum(soldStats?.vehicle_count)}, ` +
    `mean days to turn=${parseNum(stats?.mean_days_to_turn) || "N/A"}, ` +
    `market supply=${parseNum(stats?.market_days_supply) || "N/A"}`,
  );

  return {
    comps,
    totalListings,

    meanDaysToTurn: stats?.mean_days_to_turn != null ? parseNum(stats.mean_days_to_turn) : null,
    marketDaysSupply: stats?.market_days_supply != null ? parseNum(stats.market_days_supply) : null,

    activeCount: parseNum(activeStats?.vehicle_count),
    activeMeanPrice: parseNum(activeStats?.mean_price),
    activeMedianPrice: parseNum(activeStats?.median_price),
    activeMeanMileage: parseNum(activeStats?.mean_mileage),

    soldCount: parseNum(soldStats?.vehicle_count),
    soldMeanPrice: parseNum(soldStats?.mean_price),
    soldMedianPrice: parseNum(soldStats?.median_price),
    soldMeanMileage: parseNum(soldStats?.mean_mileage),
    soldMeanDaysToTurn: soldStats?.mean_days_to_turn != null ? parseNum(soldStats.mean_days_to_turn) : null,
  };
}
