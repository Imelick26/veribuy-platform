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
 * Strip HTML tags from a string (used for NHTSA investigation descriptions).
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

/**
 * Fetch model variants from NHTSA products API.
 * The complaints API requires exact model variant names (e.g., "F-150 SUPER CREW"
 * instead of just "F-150"). This function discovers all variants for a given make/model/year.
 *
 * API: https://api.nhtsa.gov/products/vehicle/models?modelYear={year}&make={make}&issueType=c
 */
export async function fetchModelVariants(
  make: string,
  model: string,
  year: number
): Promise<string[]> {
  try {
    const url = `https://api.nhtsa.gov/products/vehicle/models?modelYear=${year}&make=${encodeURIComponent(make)}&issueType=c`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [model]; // Fallback to original model name

    const data = await res.json();
    const results = data.results || [];

    // Filter models that contain our base model name (case-insensitive)
    const baseModel = model.toUpperCase();
    const variants: string[] = results
      .map((r: { model?: string }) => r.model)
      .filter((m: string | undefined): m is string =>
        !!m && m.toUpperCase().includes(baseModel)
      );

    // If no variants found, return the original model name as fallback
    return variants.length > 0 ? variants : [model];
  } catch (err) {
    console.error("[nhtsa] fetchModelVariants failed:", err);
    return [model]; // Fallback to original model name
  }
}

/**
 * Fetch NHTSA complaints for a make/model/year.
 * Automatically discovers model variants and aggregates complaints across all of them.
 *
 * API: https://api.nhtsa.gov/complaints/complaintsByVehicle
 */
export async function fetchComplaints(
  make: string,
  model: string,
  year: number
): Promise<NHTSAComplaint[]> {
  // Discover all model variants (e.g., "F-150 SUPER CREW", "F-150 SUPERCAB", etc.)
  const variants = await fetchModelVariants(make, model, year);

  // Fetch complaints for each variant in parallel
  const allResults = await Promise.allSettled(
    variants.map(async (variant) => {
      const url = `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(variant)}&modelYear=${year}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) return [];
      const data = await res.json();
      return data.results || [];
    })
  );

  // Merge all results and deduplicate by ODI number
  const seen = new Set<string>();
  const complaints: NHTSAComplaint[] = [];

  for (const result of allResults) {
    if (result.status !== "fulfilled") continue;
    for (const r of result.value) {
      const odiNumber = String(r.odiNumber || "");
      if (odiNumber && seen.has(odiNumber)) continue;
      if (odiNumber) seen.add(odiNumber);

      complaints.push({
        odiNumber,
        manufacturer: String(r.manufacturer || ""),
        crash: r.crash === "Y" || r.crash === true,
        fire: r.fire === "Y" || r.fire === true,
        numberOfInjuries: Number(r.numberOfInjuries) || 0,
        numberOfDeaths: Number(r.numberOfDeaths) || 0,
        dateOfIncident: String(r.dateOfIncident || ""),
        dateComplaintFiled: String(r.dateComplaintFiled || ""),
        component: String(r.components || ""),
        summary: String(r.summary || ""),
      });
    }
  }

  return complaints;
}

/**
 * Fetch NHTSA recalls for a make/model/year.
 * Uses the make/model/year endpoint which is more reliable than VIN-based lookup.
 *
 * API: https://api.nhtsa.gov/recalls/recallsByVehicle
 */
export async function fetchRecalls(
  make: string,
  model: string,
  year: number
): Promise<NHTSARecall[]> {
  const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
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
 * API field mapping (actual API fields → our interface):
 *   nhtsaId       → investigationId
 *   status        → investigationStatus
 *   subject       → component
 *   description   → summary (HTML stripped)
 *   consequence   → consequence
 *
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
    investigationId: r.nhtsaId || r.NHTSA_ID || "",
    investigationStatus: r.status || r.INVEST_STATUS || "",
    make: r.make || make,
    model: r.model || model,
    year: r.year || String(year),
    component: r.subject || r.COMPNAME || "",
    summary: stripHtml(r.description || r.SUMMARY || ""),
    consequence: r.consequence || r.CONSEQUENCE || "",
  }));
}
