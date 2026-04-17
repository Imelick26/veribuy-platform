/**
 * VinAudit API client for vehicle history reports.
 * Docs: https://www.vinaudit.com/vehicle-history-api
 *
 * Endpoint: /v2/pullreport — requires key + user + pass + mode params.
 * Cost: ~$5/report for vehicle history (demo: 25 credits, expires 04/24/2026).
 */

export interface VehicleHistoryData {
  provider: string;
  titleStatus: string;
  accidentCount: number;
  ownerCount: number;
  serviceRecords: number;
  structuralDamage: boolean;
  floodDamage: boolean;
  openRecallCount: number;
  recalls: VinAuditRecall[];
  titleRecords: VinAuditTitleRecord[];
  odometerReadings: VinAuditOdometer[];
  rawData: unknown;
}

export interface VinAuditRecall {
  campaignNumber: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
  completionStatus?: string;
}

export interface VinAuditTitleRecord {
  date: string;
  state: string;
  titleType: string;
  odometerReading?: number;
}

export interface VinAuditOdometer {
  date: string;
  reading: number;
  unit: string;
  source: string;
}

export interface VinAuditMarketValue {
  vin: string;
  make: string;
  model: string;
  year: number;
  estimatedValue: number;
  valueLow: number;
  valueHigh: number;
  mileageAdjustment: number;
  conditionAdjustment: number;
  nearbyListings: VinAuditListing[];
}

export interface VinAuditListing {
  title: string;
  price: number;
  mileage: number;
  location: string;
  source: string;
  url?: string;
}

function getCredentials(): { key: string; user: string; pass: string } {
  const key = process.env.VINAUDIT_API_KEY;
  const user = process.env.VINAUDIT_USER;
  const pass = process.env.VINAUDIT_PASS;
  if (!key || !user || !pass) {
    const missing: string[] = [];
    if (!key) missing.push("VINAUDIT_API_KEY");
    if (!user) missing.push("VINAUDIT_USER");
    if (!pass) missing.push("VINAUDIT_PASS");
    throw new Error(`Missing VinAudit credentials: ${missing.join(", ")}. Check .env.local and restart the dev server.`);
  }
  return { key, user, pass };
}

// Log credential presence exactly once per process so we can confirm the
// running server picked up all three VinAudit env vars.
let vaEnvChecked = false;
function logCredentialStatus(): void {
  if (vaEnvChecked) return;
  vaEnvChecked = true;
  const hasKey = !!process.env.VINAUDIT_API_KEY;
  const hasUser = !!process.env.VINAUDIT_USER;
  const hasPass = !!process.env.VINAUDIT_PASS;
  console.log(
    `[VinAudit] Credentials: VINAUDIT_API_KEY=${hasKey ? "set" : "MISSING"} ` +
    `VINAUDIT_USER=${hasUser ? "set" : "MISSING"} ` +
    `VINAUDIT_PASS=${hasPass ? "set" : "MISSING"}` +
    (hasKey && hasUser && hasPass ? "" : " — restart dev server after adding to .env.local"),
  );
}

const VINAUDIT_BASE = "https://api.vinaudit.com";

/**
 * Fetch vehicle history report from VinAudit (~$5/report).
 *
 * Uses the v2 pullreport endpoint:
 * GET /v2/pullreport?format=json&key=KEY&user=USER&pass=PASS&mode=prod&vin=VIN
 */
export async function fetchVehicleHistory(vin: string): Promise<VehicleHistoryData> {
  logCredentialStatus();
  const { key, user, pass } = getCredentials();

  const params = new URLSearchParams({
    format: "json",
    key,
    user,
    pass,
    mode: "prod",
    vin,
  });

  const url = `${VINAUDIT_BASE}/v2/pullreport?${params.toString()}`;
  console.log(`[VinAudit] GET ${VINAUDIT_BASE}/v2/pullreport (VIN ${vin})`);

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    const snippet = text.slice(0, 500);
    if (res.status === 401 || res.status === 403) {
      console.error(`[VinAudit] AUTH FAILURE (${res.status}) for VIN ${vin}: ${snippet}`);
    } else {
      console.error(`[VinAudit] API error ${res.status} for VIN ${vin}: ${snippet}`);
    }
    throw new Error(`VinAudit API error (${res.status}): ${snippet}`);
  }

  const data = await res.json();

  // Check for API-level error responses
  if (data.error || data.status === "error") {
    const msg = data.error || data.message || "Unknown error";
    console.error(`[VinAudit] Report error for VIN ${vin}: ${msg}. Response keys: ${Object.keys(data || {}).join(", ")}`);
    throw new Error(`VinAudit report error: ${msg}`);
  }

  console.log(
    `[VinAudit] VIN ${vin} response keys: ${Object.keys(data || {}).join(", ")} ` +
    `(titles=${Array.isArray(data.titles) ? data.titles.length : 0}, ` +
    `checks=${Array.isArray(data.checks) ? data.checks.length : 0}, ` +
    `accidents=${Array.isArray(data.accidents) ? data.accidents.length : 0}, ` +
    `salvage=${Array.isArray(data.salvage) ? data.salvage.length : 0})`,
  );

  // Normalize the response into our standard format
  return normalizeHistoryResponse(data);
}

/**
 * Fetch market value estimate from VinAudit.
 *
 * Note: No longer used for pricing (Black Book is sole pricing source).
 * Kept for potential future use. Uses the same v2 endpoint with market value mode.
 */
export async function fetchMarketValue(
  vin: string,
  mileage?: number
): Promise<VinAuditMarketValue> {
  const { key, user, pass } = getCredentials();

  const params = new URLSearchParams({
    format: "json",
    key,
    user,
    pass,
    mode: "prod",
    vin,
  });
  if (mileage) params.set("mileage", String(mileage));

  const url = `${VINAUDIT_BASE}/market-value?${params.toString()}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`VinAudit Market API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return normalizeMarketResponse(data, vin);
}

/**
 * Normalize the VinAudit v2 pullreport response into our standard format.
 *
 * Real response structure (verified against live API):
 *   .titles[]      — { vin, state, date, meter, meter_unit, current }
 *   .checks[]      — { brander_code, brand_title, date } — title brands (salvage/rebuilt/flood)
 *   .jsi[]         — junk/salvage/insurance records
 *   .accidents[]   — accident records
 *   .sales[]       — sale/listing history
 *   .salvage[]     — salvage auction records with damage info
 *   .thefts[]      — theft records
 *   .lie[]         — lemon/impound/export records
 *   .attributes    — decoded vehicle info (year, make, model, trim, engine, etc.)
 *   .clean         — boolean: true = clean title, false = branded
 */
function normalizeHistoryResponse(data: Record<string, unknown>): VehicleHistoryData {
  const titleRecords: VinAuditTitleRecord[] = [];
  const odometerReadings: VinAuditOdometer[] = [];
  const recalls: VinAuditRecall[] = [];

  // ── Title records (also contain odometer readings) ──────────────
  const titles = (data.titles || []) as Array<Record<string, unknown>>;
  for (const t of titles) {
    const meterReading = t.meter ? Number(String(t.meter).replace(/[^0-9]/g, "")) : undefined;
    titleRecords.push({
      date: String(t.date || ""),
      state: String(t.state || ""),
      titleType: "Title",
      odometerReading: meterReading,
    });
    // Each title record includes an odometer reading
    if (meterReading && meterReading > 0) {
      odometerReadings.push({
        date: String(t.date || ""),
        reading: meterReading,
        unit: String(t.meter_unit === "K" ? "kilometers" : "miles"),
        source: "Title Record",
      });
    }
  }

  // ── Title brands/checks (salvage, rebuilt, flood, lemon, etc.) ──
  const checks = (data.checks || []) as Array<Record<string, unknown>>;
  const hasSalvage = checks.some((c) => {
    const brand = String(c.brand_title || "").toLowerCase();
    return brand.includes("salvage") || brand.includes("rebuilt") || brand.includes("junk");
  });
  const hasFlood = checks.some((c) => {
    const brand = String(c.brand_title || "").toLowerCase();
    return brand.includes("flood") || brand.includes("water");
  });

  // Add brand info to the matching title record dates, or as standalone entries
  for (const c of checks) {
    titleRecords.push({
      date: String(c.date || ""),
      state: String(c.brander_code || c.brander_name || ""),
      titleType: String(c.brand_title || "Branded"),
    });
  }

  // ── Salvage auction records (structural/primary damage info) ────
  const salvageRecords = (data.salvage || []) as Array<Record<string, unknown>>;
  const hasStructuralDamage = salvageRecords.some((s) => {
    const primary = String(s.primary_damage || "").toLowerCase();
    const secondary = String(s.secondary_damage || "").toLowerCase();
    return primary.includes("front") || primary.includes("frame") ||
           secondary.includes("frame") || primary.includes("structural");
  });

  // Add salvage odometer readings
  for (const s of salvageRecords) {
    const mileStr = String(s.milage || s.mileage || "");
    const miles = Number(mileStr.replace(/[^0-9]/g, ""));
    if (miles > 0) {
      odometerReadings.push({
        date: String(s.date || ""),
        reading: miles,
        unit: "miles",
        source: "Salvage Auction",
      });
    }
  }

  // ── Accidents ───────────────────────────────────────────────────
  const accidents = (data.accidents || []) as Array<Record<string, unknown>>;

  // ── Junk/Salvage/Insurance records ──────────────────────────────
  const jsi = (data.jsi || []) as Array<Record<string, unknown>>;

  // ── Owner count: count unique title transfers ───────────────────
  // Each title with current=false is a previous owner
  const ownerCount = Math.max(1, titles.filter((t) => t.state).length);

  // ── Sales history (for service record count proxy) ──────────────
  const sales = (data.sales || []) as Array<Record<string, unknown>>;

  // Sort odometer readings by date for consistent display
  odometerReadings.sort((a, b) => a.date.localeCompare(b.date));

  return {
    provider: "VinAudit",
    titleStatus: hasSalvage ? "SALVAGE" : (data.clean === false ? "BRANDED" : "CLEAN"),
    accidentCount: accidents.length,
    ownerCount,
    serviceRecords: sales.length, // sales/listings as proxy for activity
    structuralDamage: hasStructuralDamage,
    floodDamage: hasFlood,
    openRecallCount: recalls.length, // VinAudit doesn't return recalls directly — NHTSA covers this
    recalls,
    titleRecords,
    odometerReadings,
    rawData: data,
  };
}

/**
 * Normalize the VinAudit market value response.
 */
function normalizeMarketResponse(data: Record<string, unknown>, vin: string): VinAuditMarketValue {
  const listings = (data.listings || data.comparable_listings || []) as Array<Record<string, unknown>>;

  return {
    vin,
    make: String(data.make || ""),
    model: String(data.model || ""),
    year: Number(data.year || 0),
    estimatedValue: Number(data.estimated_value || data.value || data.mean || 0),
    valueLow: Number(data.value_low || data.below_market || 0),
    valueHigh: Number(data.value_high || data.above_market || 0),
    mileageAdjustment: Number(data.mileage_adjustment || 0),
    conditionAdjustment: Number(data.condition_adjustment || 0),
    nearbyListings: listings.map((l) => ({
      title: String(l.title || l.name || ""),
      price: Number(l.price || 0),
      mileage: Number(l.mileage || 0),
      location: String(l.location || l.city || ""),
      source: String(l.source || l.dealer || ""),
      url: l.url ? String(l.url) : undefined,
    })),
  };
}
