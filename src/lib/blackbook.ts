/**
 * Black Book API Client
 *
 * Industry-standard wholesale vehicle valuations used by dealers.
 * Provides condition-tiered pricing across three perspectives:
 *   - Wholesale: Extra Clean / Clean / Average / Rough
 *   - Retail: Extra Clean / Clean / Average / Rough
 *   - Trade-In: Clean / Average / Rough
 *
 * API: REST at https://service.blackbookcloud.com/UsedCarWS/UsedCarWS
 * Auth: Basic authentication (username:password)
 *
 * Cost: Quote-based (enterprise). Contact support@blackbook.com
 * Coverage: US vehicles, 1981-present
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type BBCondition = "extra_clean" | "clean" | "average" | "rough";

export interface BBValuation {
  vin: string;
  year: number;
  make: string;
  model: string;
  series: string;
  style: string;

  /** Wholesale values by condition (what dealers pay at auction) */
  wholesale: Record<BBCondition, number>;
  /** Retail values by condition (what dealers charge consumers) */
  retail: Record<BBCondition, number>;
  /** Trade-in values by condition (what dealers offer on trade) */
  tradeIn: Omit<Record<BBCondition, number>, "extra_clean">;

  /** Adjusted wholesale (includes mileage + region adjustments) */
  adjustedWholesale: Record<BBCondition, number>;
  /** Adjusted retail (includes mileage + region adjustments) */
  adjustedRetail: Record<BBCondition, number>;

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

const BB_BASE = "https://service.blackbookcloud.com/UsedCarWS/UsedCarWS";

function parseNum(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val !== "string") return 0;
  const cleaned = val.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
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
  const { username, password } = getCredentials();
  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  // Build request URL
  const params = new URLSearchParams({ vin });
  if (mileage) params.set("mileage", String(mileage));
  if (state) params.set("state", state);

  const url = `${BB_BASE}/VIN/${vin}?${params}`;

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
  return normalizeResponse(data, vin, mileage);
}

/**
 * Fallback: Fetch Black Book valuation by UVC (Universal Vehicle Code)
 * or year/make/model when VIN lookup isn't available.
 */
export async function fetchBlackBookByYMM(
  year: number,
  make: string,
  model: string,
  mileage?: number,
  state?: string,
): Promise<BBValuation | null> {
  const { username, password } = getCredentials();
  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  const params = new URLSearchParams({
    year: String(year),
    make,
    series: model,
  });
  if (mileage) params.set("mileage", String(mileage));
  if (state) params.set("state", state);

  const url = `${BB_BASE}/UsedCar?${params}`;

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
  return normalizeResponse(data, `${year}-${make}-${model}`, mileage);
}

/* ------------------------------------------------------------------ */
/*  Response normalization                                             */
/* ------------------------------------------------------------------ */

function normalizeResponse(
  data: Record<string, unknown>,
  vinOrKey: string,
  mileage?: number,
): BBValuation | null {
  // Black Book responses vary — handle known shapes
  // The used car response typically has a `used_vehicles` or `vehicles` array
  const vehiclesArray = (
    data.used_vehicles || data.vehicles || data.results || [data]
  ) as Array<Record<string, unknown>>;

  const vehicle = vehiclesArray[0];
  if (!vehicle) {
    console.warn(`[BlackBook] Empty response for ${vinOrKey}`);
    return null;
  }

  // Extract wholesale values
  const wholesale: Record<BBCondition, number> = {
    extra_clean: parseNum(vehicle.base_whole_xclean || vehicle.wholesale_extra_clean || 0),
    clean: parseNum(vehicle.base_whole_clean || vehicle.wholesale_clean || 0),
    average: parseNum(vehicle.base_whole_avg || vehicle.wholesale_average || 0),
    rough: parseNum(vehicle.base_whole_rough || vehicle.wholesale_rough || 0),
  };

  // Extract retail values
  const retail: Record<BBCondition, number> = {
    extra_clean: parseNum(vehicle.base_retail_xclean || vehicle.retail_extra_clean || 0),
    clean: parseNum(vehicle.base_retail_clean || vehicle.retail_clean || 0),
    average: parseNum(vehicle.base_retail_avg || vehicle.retail_average || 0),
    rough: parseNum(vehicle.base_retail_rough || vehicle.retail_rough || 0),
  };

  // Extract trade-in values (no extra_clean tier for trade-in)
  const tradeIn = {
    clean: parseNum(vehicle.trade_in_clean || vehicle.tradein_clean || 0),
    average: parseNum(vehicle.trade_in_avg || vehicle.tradein_average || 0),
    rough: parseNum(vehicle.trade_in_rough || vehicle.tradein_rough || 0),
  };

  // Extract adjusted values (include mileage + regional adjustments)
  const adjustedWholesale: Record<BBCondition, number> = {
    extra_clean: parseNum(vehicle.adjusted_whole_xclean || 0) || wholesale.extra_clean,
    clean: parseNum(vehicle.adjusted_whole_clean || 0) || wholesale.clean,
    average: parseNum(vehicle.adjusted_whole_avg || 0) || wholesale.average,
    rough: parseNum(vehicle.adjusted_whole_rough || 0) || wholesale.rough,
  };

  const adjustedRetail: Record<BBCondition, number> = {
    extra_clean: parseNum(vehicle.adjusted_retail_xclean || 0) || retail.extra_clean,
    clean: parseNum(vehicle.adjusted_retail_clean || 0) || retail.clean,
    average: parseNum(vehicle.adjusted_retail_avg || 0) || retail.average,
    rough: parseNum(vehicle.adjusted_retail_rough || 0) || retail.rough,
  };

  // Validate: at least one perspective should have data
  const hasAnyValue = wholesale.clean > 0 || retail.clean > 0 || tradeIn.clean > 0;
  if (!hasAnyValue) {
    console.warn(`[BlackBook] Response had no valid values for ${vinOrKey}`);
    return null;
  }

  return {
    vin: String(vehicle.vin || vinOrKey),
    year: Number(vehicle.model_year || vehicle.year || 0),
    make: String(vehicle.make || ""),
    model: String(vehicle.model || ""),
    series: String(vehicle.series || ""),
    style: String(vehicle.style || vehicle.body_type || ""),

    wholesale,
    retail,
    tradeIn,
    adjustedWholesale,
    adjustedRetail,

    mileage: Number(vehicle.mileage || mileage || 0),
    rawResponse: data,
  };
}

/* ------------------------------------------------------------------ */
/*  Condition Mapping Helper                                           */
/* ------------------------------------------------------------------ */

/**
 * Map an AI condition score (0-100) to a Black Book condition tier.
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
