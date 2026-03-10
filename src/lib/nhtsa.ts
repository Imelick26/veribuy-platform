import type { NHTSAComplaint, NHTSARecall, NHTSAInvestigation } from "@/types/risk";

const TIMEOUT_MS = 12000;

async function fetchWithTimeout(url: string, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch NHTSA complaints for a make/model/year.
 * API: https://api.nhtsa.gov/complaints/complaintsByVehicle
 */
export async function fetchComplaints(
  make: string,
  model: string,
  year: number
): Promise<NHTSAComplaint[]> {
  const url = `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`NHTSA complaints API returned ${res.status}`);
  const data = await res.json();
  const results = data.results || [];

  return results.map((r: Record<string, unknown>) => ({
    odiNumber: String(r.odiNumber || ""),
    manufacturer: String(r.manufacturer || ""),
    crash: r.crash === "Y" || r.crash === true,
    fire: r.fire === "Y" || r.fire === true,
    numberOfInjuries: Number(r.numberOfInjuries) || 0,
    numberOfDeaths: Number(r.numberOfDeaths) || 0,
    dateOfIncident: String(r.dateOfIncident || ""),
    dateComplaintFiled: String(r.dateComplaintFiled || ""),
    component: String(r.components || ""),
    summary: String(r.summary || ""),
  }));
}

/**
 * Fetch NHTSA recalls for a specific VIN.
 * API: https://api.nhtsa.gov/recalls/recallsByVehicle
 */
export async function fetchRecalls(vin: string): Promise<NHTSARecall[]> {
  const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?vin=${encodeURIComponent(vin)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`NHTSA recalls API returned ${res.status}`);
  const data = await res.json();
  const results = data.results || [];

  return results.map((r: Record<string, string>) => ({
    campaignNumber: r.NHTSACampaignNumber || "",
    component: r.Component || "",
    summary: r.Summary || "",
    consequence: r.Consequence || "",
    remedy: r.Remedy || "",
    reportDate: r.ReportReceivedDate || "",
  }));
}

/**
 * Fetch NHTSA investigations for a make/model/year.
 * API: https://api.nhtsa.gov/investigations
 */
export async function fetchInvestigations(
  make: string,
  model: string,
  year: number
): Promise<NHTSAInvestigation[]> {
  const url = `https://api.nhtsa.gov/investigations?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`NHTSA investigations API returned ${res.status}`);
  const data = await res.json();
  const results = data.results || [];

  return results.map((r: Record<string, string>) => ({
    investigationId: r.NHTSA_ID || r.investigationId || "",
    investigationStatus: r.investigationStatus || r.INVEST_STATUS || "",
    make: r.MAKE || make,
    model: r.MODEL || model,
    year: r.YEAR || String(year),
    component: r.COMPNAME || r.component || "",
    summary: r.SUMMARY || r.summary || "",
    consequence: r.CONSEQUENCE || r.consequence || "",
  }));
}
