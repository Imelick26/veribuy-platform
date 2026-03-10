import type {
  NHTSAComplaint,
  NHTSARecall,
  NHTSAInvestigation,
  AggregatedRisk,
  AggregatedRiskProfile,
  Severity,
} from "@/types/risk";
import { getPositionForCategory, mapNHTSAComponent, resetJitter } from "./risk-positions";
import { getCapturePromptList, getInspectionGuidance } from "./capture-prompts";

interface CuratedRisk {
  severity: string;
  title: string;
  description: string;
  cost: { low: number; high: number };
  source: string;
  position: { x: number; y: number; z: number };
  symptoms: string[];
  category: string;
}

interface AggregateInput {
  vehicleId: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  complaints: NHTSAComplaint[];
  recalls: NHTSARecall[];
  investigations: NHTSAInvestigation[];
  curatedRisks: CuratedRisk[];
  curatedProfileId?: string;
}

/**
 * Aggregates risk data from all sources into a unified risk profile.
 *
 * Priority order:
 * 1. Curated risks (hand-verified, highest quality)
 * 2. NHTSA complaints grouped by component (volume-based severity)
 * 3. NHTSA recalls (always at least MAJOR severity)
 * 4. NHTSA investigations (boosts severity of matching risks)
 */
export function aggregateRiskProfile(input: AggregateInput): AggregatedRiskProfile {
  resetJitter();

  const risks: AggregatedRisk[] = [];
  const coveredCategories = new Set<string>();

  // 1. Add curated risks first — these are the highest quality
  for (const curated of input.curatedRisks) {
    const category = curated.category || "OTHER";
    coveredCategories.add(category);

    risks.push({
      id: `curated-${risks.length}`,
      severity: curated.severity as Severity,
      title: curated.title,
      description: curated.description,
      category,
      source: "CURATED",
      cost: curated.cost,
      position: curated.position,
      symptoms: curated.symptoms || [],
      capturePrompts: getCapturePromptList(category),
      inspectionGuidance: getInspectionGuidance(category),
    });
  }

  // 2. Group NHTSA complaints by component category
  const complaintsByCategory = groupComplaintsByCategory(input.complaints);
  const complaintsByComponent: Record<string, number> = {};

  for (const [category, group] of Object.entries(complaintsByCategory)) {
    // Track complaint counts by component name
    for (const c of group.complaints) {
      const comp = c.component || "UNKNOWN";
      complaintsByComponent[comp] = (complaintsByComponent[comp] || 0) + 1;
    }

    // If curated data already covers this category, merge complaint data into it
    const existingIdx = risks.findIndex(
      (r) => r.source === "CURATED" && r.category === category
    );

    if (existingIdx !== -1) {
      // Enrich curated risk with complaint data
      const existing = risks[existingIdx];
      existing.source = "MERGED";
      existing.complaintCount = group.count;

      // Boost severity if complaint volume is very high
      if (group.count > 50 && severityRank(existing.severity) < severityRank("CRITICAL")) {
        existing.severity = "CRITICAL";
      }

      // Add injury/death info to description if present
      if (group.totalInjuries > 0 || group.totalDeaths > 0) {
        existing.description += ` (NHTSA: ${group.count} complaints, ${group.totalInjuries} injuries, ${group.totalDeaths} deaths reported)`;
      } else {
        existing.description += ` (NHTSA: ${group.count} complaints reported)`;
      }
      continue;
    }

    // New risk from complaints — not covered by curated data
    const severity = scoreComplaintSeverity(group);
    risks.push({
      id: `complaints-${risks.length}`,
      severity,
      title: buildComplaintTitle(category, group),
      description: buildComplaintDescription(group),
      category,
      source: "NHTSA_COMPLAINTS",
      cost: estimateCostFromComplaints(category),
      position: getPositionForCategory(category),
      symptoms: extractSymptoms(group.complaints),
      capturePrompts: getCapturePromptList(category),
      inspectionGuidance: getInspectionGuidance(category),
      complaintCount: group.count,
    });
  }

  // 3. Add recalls that aren't already covered
  for (const recall of input.recalls) {
    const category = mapNHTSAComponent(recall.component);
    const existingIdx = risks.findIndex((r) => r.category === category);

    if (existingIdx !== -1) {
      // Mark existing risk as having an active recall
      risks[existingIdx].hasActiveRecall = true;
      if (!risks[existingIdx].relatedRecalls) {
        risks[existingIdx].relatedRecalls = [];
      }
      risks[existingIdx].relatedRecalls!.push(recall);

      // Boost to at least MAJOR if it has a recall
      if (severityRank(risks[existingIdx].severity) < severityRank("MAJOR")) {
        risks[existingIdx].severity = "MAJOR";
      }
      continue;
    }

    // New risk from recall
    risks.push({
      id: `recall-${risks.length}`,
      severity: "MAJOR",
      title: `Recall: ${recall.component}`,
      description: recall.summary,
      category,
      source: "NHTSA_RECALLS",
      cost: { low: 0, high: 0 }, // Recalls are typically free to fix
      position: getPositionForCategory(category),
      symptoms: [],
      capturePrompts: getCapturePromptList(category),
      inspectionGuidance: `Active recall (Campaign ${recall.campaignNumber}). Check if recall has been completed. ${recall.remedy}`,
      hasActiveRecall: true,
      relatedRecalls: [recall],
    });
  }

  // 4. Check if any investigations affect existing risks
  for (const inv of input.investigations) {
    const category = mapNHTSAComponent(inv.component);
    const existingIdx = risks.findIndex((r) => r.category === category);

    if (existingIdx !== -1) {
      risks[existingIdx].investigationId = inv.investigationId;
      // Active investigation boosts severity
      if (
        inv.investigationStatus?.toUpperCase() !== "CLOSED" &&
        severityRank(risks[existingIdx].severity) < severityRank("MAJOR")
      ) {
        risks[existingIdx].severity = "MAJOR";
      }
      continue;
    }

    // New risk from investigation
    risks.push({
      id: `investigation-${risks.length}`,
      severity: "MODERATE",
      title: `Under Investigation: ${inv.component}`,
      description: inv.summary || `NHTSA investigation ${inv.investigationId} into ${inv.component} issues`,
      category,
      source: "NHTSA_INVESTIGATIONS",
      cost: estimateCostFromComplaints(category),
      position: getPositionForCategory(category),
      symptoms: [],
      capturePrompts: getCapturePromptList(category),
      inspectionGuidance: `NHTSA investigation ${inv.investigationId} is ${inv.investigationStatus || "ongoing"}. ${getInspectionGuidance(category)}`,
      investigationId: inv.investigationId,
    });
  }

  // Sort by severity (CRITICAL first)
  risks.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  return {
    vehicleId: input.vehicleId,
    vin: input.vin,
    make: input.make,
    model: input.model,
    year: input.year,
    curatedProfileId: input.curatedProfileId,
    nhtsaData: {
      complaintCount: input.complaints.length,
      recallCount: input.recalls.length,
      investigationCount: input.investigations.length,
      complaintsByComponent,
    },
    aggregatedRisks: risks,
    generatedAt: new Date().toISOString(),
  };
}

// --- Helper functions ---

interface ComplaintGroup {
  category: string;
  count: number;
  complaints: NHTSAComplaint[];
  totalInjuries: number;
  totalDeaths: number;
  hasCrash: boolean;
  hasFire: boolean;
}

function groupComplaintsByCategory(
  complaints: NHTSAComplaint[]
): Record<string, ComplaintGroup> {
  const groups: Record<string, ComplaintGroup> = {};

  for (const c of complaints) {
    const category = mapNHTSAComponent(c.component);
    if (!groups[category]) {
      groups[category] = {
        category,
        count: 0,
        complaints: [],
        totalInjuries: 0,
        totalDeaths: 0,
        hasCrash: false,
        hasFire: false,
      };
    }
    groups[category].count++;
    groups[category].complaints.push(c);
    groups[category].totalInjuries += c.numberOfInjuries;
    groups[category].totalDeaths += c.numberOfDeaths;
    if (c.crash) groups[category].hasCrash = true;
    if (c.fire) groups[category].hasFire = true;
  }

  return groups;
}

function scoreComplaintSeverity(group: ComplaintGroup): Severity {
  // Deaths or fires → CRITICAL
  if (group.totalDeaths > 0 || group.hasFire) return "CRITICAL";
  // Injuries or crashes with high volume → CRITICAL
  if (group.totalInjuries > 0 && group.count > 20) return "CRITICAL";
  // High volume or crashes → MAJOR
  if (group.count > 50 || group.hasCrash) return "CRITICAL";
  if (group.count > 20) return "MAJOR";
  if (group.count > 5) return "MODERATE";
  return "MINOR";
}

function severityRank(severity: Severity | string): number {
  const ranks: Record<string, number> = {
    CRITICAL: 4,
    MAJOR: 3,
    MODERATE: 2,
    MINOR: 1,
    INFO: 0,
  };
  return ranks[severity] ?? 0;
}

const CATEGORY_LABELS: Record<string, string> = {
  ENGINE: "Engine",
  TRANSMISSION: "Transmission",
  DRIVETRAIN: "Drivetrain",
  STRUCTURAL: "Structure",
  SUSPENSION: "Suspension",
  BRAKES: "Brakes",
  TIRES_WHEELS: "Tires/Wheels",
  ELECTRICAL: "Electrical System",
  ELECTRONICS: "Electronics",
  SAFETY: "Safety Systems",
  COSMETIC_EXTERIOR: "Exterior",
  COSMETIC_INTERIOR: "Interior",
  HVAC: "HVAC",
  OTHER: "Other",
};

function buildComplaintTitle(category: string, group: ComplaintGroup): string {
  const label = CATEGORY_LABELS[category] || category;
  return `${label} Issues — ${group.count} Owner Complaints`;
}

function buildComplaintDescription(group: ComplaintGroup): string {
  const parts: string[] = [];
  parts.push(`${group.count} complaints filed with NHTSA.`);
  if (group.totalInjuries > 0) parts.push(`${group.totalInjuries} injuries reported.`);
  if (group.totalDeaths > 0) parts.push(`${group.totalDeaths} deaths reported.`);
  if (group.hasCrash) parts.push("Crash incidents reported.");
  if (group.hasFire) parts.push("Fire incidents reported.");

  // Add a sample summary from the most recent complaint
  const sorted = [...group.complaints].sort(
    (a, b) => (b.dateComplaintFiled || "").localeCompare(a.dateComplaintFiled || "")
  );
  if (sorted[0]?.summary) {
    const summary = sorted[0].summary;
    const truncated = summary.length > 200 ? summary.slice(0, 200) + "..." : summary;
    parts.push(`Recent report: "${truncated}"`);
  }

  return parts.join(" ");
}

function extractSymptoms(complaints: NHTSAComplaint[]): string[] {
  // Extract common keywords from complaint summaries to build symptom list
  const keywords: Record<string, number> = {};
  const symptomPatterns = [
    /stall(s|ed|ing)?/i,
    /leak(s|ed|ing)?/i,
    /noise/i,
    /vibrat(e|ion|ing)/i,
    /shudder(s|ing)?/i,
    /smoke/i,
    /overhe?at(s|ed|ing)?/i,
    /warning light/i,
    /check engine/i,
    /fail(s|ed|ure)?/i,
    /loss of power/i,
    /hesitat(e|ion|ing)/i,
    /grind(s|ing)?/i,
    /squeal(s|ing)?/i,
    /pull(s|ing)? (left|right)/i,
    /dead battery/i,
    /won'?t start/i,
    /misfire/i,
    /rough idle/i,
  ];

  for (const c of complaints) {
    if (!c.summary) continue;
    for (const pattern of symptomPatterns) {
      const match = c.summary.match(pattern);
      if (match) {
        const key = match[0].toLowerCase();
        keywords[key] = (keywords[key] || 0) + 1;
      }
    }
  }

  // Return top symptoms by frequency
  return Object.entries(keywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([symptom, count]) => {
      const capitalized = symptom.charAt(0).toUpperCase() + symptom.slice(1);
      return `${capitalized} (${count} reports)`;
    });
}

function estimateCostFromComplaints(category: string): { low: number; high: number } {
  // Rough cost estimates by category in cents
  const estimates: Record<string, { low: number; high: number }> = {
    ENGINE: { low: 150000, high: 500000 },
    TRANSMISSION: { low: 200000, high: 600000 },
    DRIVETRAIN: { low: 100000, high: 400000 },
    STRUCTURAL: { low: 200000, high: 800000 },
    SUSPENSION: { low: 50000, high: 200000 },
    BRAKES: { low: 30000, high: 150000 },
    TIRES_WHEELS: { low: 40000, high: 200000 },
    ELECTRICAL: { low: 50000, high: 300000 },
    ELECTRONICS: { low: 30000, high: 200000 },
    SAFETY: { low: 50000, high: 300000 },
    COSMETIC_EXTERIOR: { low: 20000, high: 150000 },
    COSMETIC_INTERIOR: { low: 10000, high: 80000 },
    HVAC: { low: 40000, high: 200000 },
    OTHER: { low: 20000, high: 100000 },
  };
  return estimates[category] || estimates.OTHER;
}
