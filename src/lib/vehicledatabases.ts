/**
 * VehicleDatabases.com API Client
 *
 * Primary pricing source providing condition-tiered market values:
 *   4 condition tiers (Outstanding/Clean/Average/Rough) x
 *   3 value perspectives (Trade-In / Private Party / Dealer Retail)
 *   = 12 price points per VIN lookup
 *
 * API: GET https://api.vehicledatabases.com/market-value/{vin}
 *      Query: ?mileage={mi}&state={st}
 *      Auth:  x-AuthKey header
 *
 * Cost: ~$0.20-0.50/query depending on plan
 * Coverage: US/Canada VINs 1990-present
 * Docs: https://vehicledatabases.com/docs/
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Condition tier as returned by VehicleDatabases */
export type VDBConditionTier = "Outstanding" | "Clean" | "Average" | "Rough";

/** Prices for a single condition tier */
export interface VDBTierPrices {
  tradeIn: number;       // dollars
  privateParty: number;  // dollars
  dealerRetail: number;  // dollars
}

/** Full VehicleDatabases market value response (normalized) */
export interface VDBMarketValueResult {
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  mileage: number;
  state: string;

  /** All condition tiers with prices */
  tiers: Record<VDBConditionTier, VDBTierPrices>;

  /** Raw API response for debugging */
  rawResponse: unknown;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getApiKey(): string {
  const key = process.env.VEHICLEDATABASES_API_KEY;
  if (!key) throw new Error("Missing VEHICLEDATABASES_API_KEY environment variable");
  return key;
}

/**
 * Parse a price string like "$18,500" or "18500" into a number.
 * Returns 0 if unparseable.
 */
function parsePrice(val: unknown): number {
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
 * Fetch condition-tiered market values from VehicleDatabases.com.
 *
 * Returns null if the API has no data for this VIN (pre-1990, exotic, etc.).
 * The caller handles fallback to other sources.
 *
 * @param vin     - 17-digit VIN
 * @param mileage - Current odometer reading
 * @param state   - Two-letter state code (e.g., "OR", "CA"). Defaults to "OR"
 */
export async function fetchVehicleDatabasesData(
  vin: string,
  mileage?: number,
  state: string = "OR",
): Promise<VDBMarketValueResult | null> {
  const apiKey = getApiKey();

  // Build URL with query params
  const params = new URLSearchParams();
  if (mileage) params.set("mileage", String(mileage));
  if (state) params.set("state", state);

  const queryString = params.toString();
  const url = `https://api.vehicledatabases.com/market-value/${vin}${queryString ? `?${queryString}` : ""}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-AuthKey": apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    // 404 = no data for this VIN (not an error)
    if (res.status === 404) {
      console.warn(`[VehicleDatabases] No data for VIN ${vin}`);
      return null;
    }
    throw new Error(`VehicleDatabases API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return normalizeResponse(data, vin, mileage, state);
}

/* ------------------------------------------------------------------ */
/*  Response normalization                                             */
/* ------------------------------------------------------------------ */

/**
 * VehicleDatabases returns various response formats. This normalizer
 * handles the known shapes and extracts condition-tiered pricing.
 *
 * Expected shape (v2):
 * {
 *   "year": 1996,
 *   "make": "Ford",
 *   "model": "F-250",
 *   "trim": "XLT",
 *   "mileage": 180000,
 *   "state": "OR",
 *   "prices": {
 *     "outstanding": { "trade_in": "$18,500", "private_party": "$21,000", "dealer_retail": "$24,500" },
 *     "clean":       { "trade_in": "$15,200", "private_party": "$17,500", "dealer_retail": "$20,800" },
 *     "average":     { "trade_in": "$12,000", "private_party": "$14,200", "dealer_retail": "$17,000" },
 *     "rough":       { "trade_in": "$8,500",  "private_party": "$10,200", "dealer_retail": "$12,800" }
 *   }
 * }
 */
function normalizeResponse(
  data: Record<string, unknown>,
  vin: string,
  mileage?: number,
  state?: string,
): VDBMarketValueResult | null {
  // Extract vehicle info
  const year = Number(data.year || 0);
  const make = String(data.make || "");
  const model = String(data.model || "");
  const trim = String(data.trim || "");

  // The prices object could be at data.prices, data.market_value, or data.values
  const pricesObj = (data.prices || data.market_value || data.values || data) as Record<string, unknown>;

  // Try to extract tier pricing
  const tiers = extractTiers(pricesObj);

  // Validate: at least one tier must have non-zero prices
  const hasAnyPrice = Object.values(tiers).some(
    (t) => t.tradeIn > 0 || t.privateParty > 0 || t.dealerRetail > 0,
  );

  if (!hasAnyPrice) {
    console.warn(`[VehicleDatabases] Response had no valid prices for VIN ${vin}`);
    return null;
  }

  return {
    vin,
    year,
    make,
    model,
    trim,
    mileage: mileage || Number(data.mileage || 0),
    state: state || String(data.state || ""),
    tiers,
    rawResponse: data,
  };
}

/**
 * Extract condition-tiered pricing from various response shapes.
 */
function extractTiers(
  pricesObj: Record<string, unknown>,
): Record<VDBConditionTier, VDBTierPrices> {
  const empty: VDBTierPrices = { tradeIn: 0, privateParty: 0, dealerRetail: 0 };

  // Map of possible key names for each tier
  const tierKeyMap: Record<VDBConditionTier, string[]> = {
    Outstanding: ["outstanding", "excellent", "Outstanding", "Excellent"],
    Clean: ["clean", "good", "Clean", "Good"],
    Average: ["average", "fair", "Average", "Fair"],
    Rough: ["rough", "poor", "Rough", "Poor"],
  };

  const result: Record<VDBConditionTier, VDBTierPrices> = {
    Outstanding: { ...empty },
    Clean: { ...empty },
    Average: { ...empty },
    Rough: { ...empty },
  };

  for (const [tier, keys] of Object.entries(tierKeyMap) as [VDBConditionTier, string[]][]) {
    for (const key of keys) {
      const tierData = pricesObj[key] as Record<string, unknown> | undefined;
      if (tierData && typeof tierData === "object") {
        result[tier] = {
          tradeIn: parsePrice(tierData.trade_in || tierData.tradeIn || tierData.trade_in_value || 0),
          privateParty: parsePrice(tierData.private_party || tierData.privateParty || tierData.private_party_value || 0),
          dealerRetail: parsePrice(tierData.dealer_retail || tierData.dealerRetail || tierData.retail || tierData.dealer_retail_value || 0),
        };
        break; // Found this tier, move on
      }
    }
  }

  // Fallback: if the response has flat trade_in/private_party/dealer_retail
  // at the top level (no condition tiers), use them for "Clean" tier
  if (!Object.values(result).some((t) => t.tradeIn > 0 || t.privateParty > 0 || t.dealerRetail > 0)) {
    const flatPrices: VDBTierPrices = {
      tradeIn: parsePrice(pricesObj.trade_in || pricesObj.tradeIn || 0),
      privateParty: parsePrice(pricesObj.private_party || pricesObj.privateParty || 0),
      dealerRetail: parsePrice(pricesObj.dealer_retail || pricesObj.dealerRetail || pricesObj.retail || 0),
    };
    if (flatPrices.tradeIn > 0 || flatPrices.privateParty > 0 || flatPrices.dealerRetail > 0) {
      // Estimate other tiers from the flat "Clean" prices
      result.Clean = flatPrices;
      result.Outstanding = {
        tradeIn: Math.round(flatPrices.tradeIn * 1.15),
        privateParty: Math.round(flatPrices.privateParty * 1.15),
        dealerRetail: Math.round(flatPrices.dealerRetail * 1.12),
      };
      result.Average = {
        tradeIn: Math.round(flatPrices.tradeIn * 0.82),
        privateParty: Math.round(flatPrices.privateParty * 0.82),
        dealerRetail: Math.round(flatPrices.dealerRetail * 0.85),
      };
      result.Rough = {
        tradeIn: Math.round(flatPrices.tradeIn * 0.62),
        privateParty: Math.round(flatPrices.privateParty * 0.62),
        dealerRetail: Math.round(flatPrices.dealerRetail * 0.68),
      };
    }
  }

  return result;
}
