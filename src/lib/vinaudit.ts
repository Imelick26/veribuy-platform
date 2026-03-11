/**
 * VinAudit API client for vehicle history reports and market value data.
 * Docs: https://www.vinaudit.com/api
 *
 * Cost: ~$5/report for vehicle history, ~$0.10/query for market value.
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

function getApiKey(): string {
  const key = process.env.VINAUDIT_API_KEY;
  if (!key) throw new Error("Missing VINAUDIT_API_KEY environment variable");
  return key;
}

const VINAUDIT_BASE = "https://api.vinaudit.com";

/**
 * Fetch vehicle history report from VinAudit (~$5/report).
 */
export async function fetchVehicleHistory(vin: string): Promise<VehicleHistoryData> {
  const apiKey = getApiKey();

  const url = `${VINAUDIT_BASE}/vehicle-history?key=${apiKey}&vin=${vin}&format=json`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`VinAudit API error (${res.status}): ${text}`);
  }

  const data = await res.json();

  // Normalize the response into our standard format
  return normalizeHistoryResponse(data);
}

/**
 * Fetch market value estimate from VinAudit (~$0.10/query).
 */
export async function fetchMarketValue(
  vin: string,
  mileage?: number
): Promise<VinAuditMarketValue> {
  const apiKey = getApiKey();

  let url = `${VINAUDIT_BASE}/market-value?key=${apiKey}&vin=${vin}&format=json`;
  if (mileage) url += `&mileage=${mileage}`;

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
 * Normalize the VinAudit history response into our standard format.
 */
function normalizeHistoryResponse(data: Record<string, unknown>): VehicleHistoryData {
  // VinAudit returns various nested structures — extract what we need
  const titleRecords: VinAuditTitleRecord[] = [];
  const odometerReadings: VinAuditOdometer[] = [];
  const recalls: VinAuditRecall[] = [];

  // Extract title records
  const titles = (data.title_records || data.titles || []) as Array<Record<string, unknown>>;
  for (const t of titles) {
    titleRecords.push({
      date: String(t.date || t.report_date || ""),
      state: String(t.state || t.title_state || ""),
      titleType: String(t.title_type || t.type || "Clean"),
      odometerReading: t.odometer ? Number(t.odometer) : undefined,
    });
  }

  // Extract odometer readings
  const odometerData = (data.odometer_records || data.odometer || []) as Array<Record<string, unknown>>;
  for (const o of odometerData) {
    odometerReadings.push({
      date: String(o.date || ""),
      reading: Number(o.reading || o.odometer || 0),
      unit: String(o.unit || "miles"),
      source: String(o.source || "Unknown"),
    });
  }

  // Extract recalls
  const recallData = (data.recalls || []) as Array<Record<string, unknown>>;
  for (const r of recallData) {
    recalls.push({
      campaignNumber: String(r.campaign_number || r.nhtsa_id || ""),
      component: String(r.component || ""),
      summary: String(r.summary || r.description || ""),
      consequence: String(r.consequence || ""),
      remedy: String(r.remedy || ""),
      completionStatus: r.completion_status ? String(r.completion_status) : undefined,
    });
  }

  // Determine title status
  const hasSalvage = titleRecords.some((t) =>
    t.titleType.toLowerCase().includes("salvage") ||
    t.titleType.toLowerCase().includes("rebuilt")
  );

  return {
    provider: "VinAudit",
    titleStatus: hasSalvage ? "SALVAGE" : "CLEAN",
    accidentCount: Number(data.accident_count || data.accidents || 0),
    ownerCount: Number(data.owner_count || data.owners || 1),
    serviceRecords: Number(data.service_count || 0),
    structuralDamage: Boolean(data.structural_damage || data.frame_damage),
    floodDamage: Boolean(data.flood_damage),
    openRecallCount: recalls.filter((r) => !r.completionStatus || r.completionStatus !== "completed").length,
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
