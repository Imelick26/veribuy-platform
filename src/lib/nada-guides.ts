/**
 * NADA Guides API Client (via MicroBilt / RapidAPI)
 *
 * Provides dealer-standard vehicle valuations used by banks and lenders:
 *   - Retail value (what dealers charge)
 *   - Trade-in value (what dealers offer)
 *   - Loan value (what banks use for LTV)
 *
 * API Flow:
 *   1. POST /GetReport with VIN + mileage → full valuation report
 *   2. Fallback: GetYears → GetMake → GetSeries → GetBody → GetReport (by IDs)
 *
 * Authentication: RapidAPI key (x-rapidapi-key header)
 * Base URL: https://nada-vehicle-pricing.p.rapidapi.com
 *
 * Cost: ~$0.05-0.10/query depending on RapidAPI plan
 * Coverage: US vehicles, most model years
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface NADAValuation {
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  bodyStyle: string;

  /** Clean retail value (what a dealer charges) */
  retailClean: number;
  /** Average retail value */
  retailAverage: number;
  /** Rough retail value */
  retailRough: number;

  /** Clean trade-in value (what a dealer offers) */
  tradeInClean: number;
  /** Average trade-in value */
  tradeInAverage: number;
  /** Rough trade-in value */
  tradeInRough: number;

  /** Loan value (what banks use for LTV calculations) */
  loanValue: number;

  /** Mileage used in the valuation */
  mileage: number;

  /** Raw API response for debugging */
  rawResponse: unknown;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getApiKey(): string {
  const key = process.env.NADA_RAPIDAPI_KEY;
  if (!key) throw new Error("Missing NADA_RAPIDAPI_KEY environment variable");
  return key;
}

const NADA_BASE = "https://nada-vehicle-pricing.p.rapidapi.com";
const RAPIDAPI_HOST = "nada-vehicle-pricing.p.rapidapi.com";

function parseNum(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val !== "string") return 0;
  const cleaned = val.replace(/[$,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

async function nadaPost(endpoint: string, body: unknown): Promise<unknown> {
  const apiKey = getApiKey();

  const res = await fetch(`${NADA_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-rapidapi-host": RAPIDAPI_HOST,
      "x-rapidapi-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NADA API error (${res.status}): ${text}`);
  }

  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Fetch NADA vehicle valuation by VIN.
 *
 * Uses POST /GetReport with the VIN in the AutomobileInfo object.
 * Returns null if the API has no data for this VIN.
 *
 * @param vin     - 17-digit VIN
 * @param mileage - Current odometer reading (improves accuracy)
 * @param year    - Model year (helps the API resolve the VIN)
 */
export async function fetchNADAValuation(
  vin: string,
  mileage?: number,
  year?: number,
): Promise<NADAValuation | null> {
  const body: Record<string, unknown> = {
    AutomobileInfo: {
      VIN: vin,
      ...(year ? { ModelYear: String(year) } : {}),
    },
    Period: new Date().toISOString().split("T")[0], // today's date
    ...(mileage ? { Mileage: String(mileage) } : {}),
  };

  try {
    const data = await nadaPost("/GetReport", body) as Record<string, unknown>;
    return normalizeResponse(data, vin, mileage);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // 404/422 = no data for this VIN
    if (errMsg.includes("404") || errMsg.includes("422") || errMsg.includes("not found")) {
      console.warn(`[NADA] No data for VIN ${vin}`);
      return null;
    }
    throw err;
  }
}

/**
 * Fallback: Fetch NADA valuation by year/make/model if VIN lookup fails.
 * This requires multi-step lookup to resolve IDs, then GetReport.
 */
export async function fetchNADAByYMM(
  year: number,
  make: string,
  model: string,
  mileage?: number,
): Promise<NADAValuation | null> {
  try {
    // Step 1: Get make ID for this year
    const makes = await nadaPost("/GetMake", { ModelYear: String(year) }) as Array<Record<string, unknown>>;
    const makeEntry = makes?.find((m) => {
      const makeName = String(m.MakeName || m.Name || m.make || "").toUpperCase();
      return makeName === make.toUpperCase() || makeName.includes(make.toUpperCase());
    });
    if (!makeEntry) {
      console.warn(`[NADA] Make "${make}" not found for year ${year}`);
      return null;
    }
    const makeId = String(makeEntry.MakeId || makeEntry.Id || makeEntry.id);

    // Step 2: Get series (model) ID
    const series = await nadaPost("/GetSeries", {
      ModelYear: String(year),
      Make: makeId,
    }) as Array<Record<string, unknown>>;
    const seriesEntry = series?.find((s) => {
      const seriesName = String(s.SeriesName || s.Name || s.series || "").toUpperCase();
      return seriesName.includes(model.toUpperCase()) || model.toUpperCase().includes(seriesName);
    });
    if (!seriesEntry) {
      console.warn(`[NADA] Series "${model}" not found for ${year} ${make}`);
      return null;
    }
    const seriesId = String(seriesEntry.SeriesId || seriesEntry.Id || seriesEntry.id);

    // Step 3: Get body styles
    const bodies = await nadaPost("/GetBody", {
      ModelYear: String(year),
      Make: makeId,
      Series: seriesId,
    }) as Array<Record<string, unknown>>;
    // Use the first body style (most common)
    const bodyEntry = bodies?.[0];
    const bodyId = bodyEntry ? String(bodyEntry.BodyId || bodyEntry.Id || bodyEntry.id || "") : "";

    // Step 4: Get report
    const body: Record<string, unknown> = {
      AutomobileInfo: {
        Make: makeId,
        Series: seriesId,
        ModelYear: String(year),
        ...(bodyId ? { Body: bodyId } : {}),
      },
      Period: new Date().toISOString().split("T")[0],
      ...(mileage ? { Mileage: String(mileage) } : {}),
    };

    const data = await nadaPost("/GetReport", body) as Record<string, unknown>;
    return normalizeResponse(data, `${year}-${make}-${model}`, mileage);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("404") || errMsg.includes("422")) {
      return null;
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Response normalization                                             */
/* ------------------------------------------------------------------ */

function normalizeResponse(
  data: Record<string, unknown>,
  vinOrKey: string,
  mileage?: number,
): NADAValuation | null {
  // NADA responses can nest values in various ways
  const values = (data.Values || data.values || data.Pricing || data.pricing || data) as Record<string, unknown>;
  const vehicle = (data.VehicleInfo || data.Vehicle || data.vehicle || data) as Record<string, unknown>;

  // Extract pricing — try multiple field name conventions (NADA uses PascalCase)
  const retailClean = parseNum(
    values.RetailClean || values.CleanRetail || values.retail_clean ||
    values.RetailValue || values.Retail || 0,
  );
  const retailAverage = parseNum(
    values.RetailAverage || values.AverageRetail || values.retail_average || 0,
  );
  const retailRough = parseNum(
    values.RetailRough || values.RoughRetail || values.retail_rough || 0,
  );

  const tradeInClean = parseNum(
    values.TradeInClean || values.CleanTradeIn || values.trade_in_clean ||
    values.TradeIn || values.TradeInValue || 0,
  );
  const tradeInAverage = parseNum(
    values.TradeInAverage || values.AverageTradeIn || values.trade_in_average || 0,
  );
  const tradeInRough = parseNum(
    values.TradeInRough || values.RoughTradeIn || values.trade_in_rough || 0,
  );

  const loanValue = parseNum(
    values.LoanValue || values.Loan || values.loan_value || values.LendingValue || 0,
  );

  // If we got no values at all, return null
  const hasAnyValue = retailClean > 0 || tradeInClean > 0 || loanValue > 0 ||
    retailAverage > 0 || tradeInAverage > 0;
  if (!hasAnyValue) {
    console.warn(`[NADA] Response had no valid values for ${vinOrKey}`);
    return null;
  }

  // Fill in missing condition tiers from available data
  const bestRetail = retailClean || retailAverage || retailRough;
  const bestTradeIn = tradeInClean || tradeInAverage || tradeInRough;

  return {
    vin: String(vehicle.VIN || vehicle.vin || vinOrKey),
    year: Number(vehicle.ModelYear || vehicle.Year || vehicle.year || data.ModelYear || 0),
    make: String(vehicle.MakeName || vehicle.Make || vehicle.make || data.Make || ""),
    model: String(vehicle.SeriesName || vehicle.Model || vehicle.model || data.Series || ""),
    trim: String(vehicle.Trim || vehicle.trim || data.Trim || ""),
    bodyStyle: String(vehicle.BodyName || vehicle.Body || vehicle.body || data.Body || ""),

    retailClean: retailClean || Math.round(bestRetail * 1.0),
    retailAverage: retailAverage || Math.round(bestRetail * 0.92),
    retailRough: retailRough || Math.round(bestRetail * 0.82),

    tradeInClean: tradeInClean || Math.round(bestTradeIn * 1.0),
    tradeInAverage: tradeInAverage || Math.round(bestTradeIn * 0.90),
    tradeInRough: tradeInRough || Math.round(bestTradeIn * 0.78),

    loanValue: loanValue || Math.round(bestTradeIn * 1.05),

    mileage: Number(data.Mileage || vehicle.Mileage || mileage || 0),
    rawResponse: data,
  };
}
