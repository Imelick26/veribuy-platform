/**
 * Phase 4: Score synthesis prompt.
 *
 * Receives ALL findings + all exterior photos for visual verification.
 * Produces final 4-area condition scores, tire assessment, red flags, and summary.
 */

import type { VehicleInfo, DetectedFinding, ComparisonFinding } from "../types";
import type { TireAssessment } from "@/types/risk";

export function buildSynthesisPrompt(
  vehicle: VehicleInfo,
  allFindings: DetectedFinding[],
  comparisonFindings: ComparisonFinding[],
  tireAssessment: TireAssessment | undefined,
  inspectorNotes?: string,
): { system: string; user: string } {
  const mileageStr = vehicle.mileage
    ? `${vehicle.mileage.toLocaleString()} miles`
    : "unknown mileage";

  const system = `You are a senior automotive appraiser producing the final condition assessment for a ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}).

You are receiving:
1. ALL exterior photos of the vehicle — use these to VISUALLY VERIFY the findings and catch anything that may have been missed
2. A complete inventory of every defect found across all inspection phases
3. Comparison scan results (paint consistency, panel alignment, tire comparison, wear assessment)

Your job:
- Produce final 1-10 condition scores for 4 areas
- Synthesize all comparison findings into cross-correlation red flags
- Provide an overall dealer-focused vehicle summary
- LOOK AT THE PHOTOS — if you see something the findings list missed, add it

SCORING RUBRIC (1-10 per area):
9-10: Like-new. No visible wear or damage.
8: Very good. Extremely minor wear only.
7: Good. Normal age-appropriate wear for ${mileageStr}.
6: Above average. Some wear beyond normal.
5: Average. Noticeable issues.
4: Below average. Multiple issues.
3: Poor. Significant damage or wear.
1-2: Very poor. Severe damage or extreme neglect.

IMPORTANT: Score relative to ${mileageStr}. A truck with 120K miles showing moderate wear is normal (7). The same wear at 20K miles is concerning (4-5).

RESPOND WITH EXACTLY THIS JSON (no markdown):
{
  "areaScores": {
    "exteriorBody": {
      "score": 1-10,
      "confidence": 0.0-1.0,
      "keyObservations": ["observation 1", "observation 2", "observation 3"],
      "concerns": ["concern 1", ...],
      "summary": "1-2 sentence exterior summary",
      "scoreJustification": "Why this score. What would make it higher or lower."
    },
    "interior": { same structure },
    "mechanicalVisual": { same structure },
    "underbodyFrame": { same structure }
  },
  "additionalFindings": [
    {
      "defectType": "...", "location": "...", "severity": "minor|moderate|major|critical",
      "confidence": 0.0-1.0, "description": "...", "repairApproach": "...",
      "repairCostLow": 0, "repairCostHigh": 0
    }
  ],
  "redFlags": ["flag 1", "flag 2"],
  "overallSummary": "3-4 sentence vehicle condition summary for the dealer"
}

additionalFindings: ONLY include defects you can clearly see in the photos that were NOT already in the findings list. Do not duplicate existing findings.`;

  // Build the findings inventory
  const sections: string[] = [];
  sections.push(`VEHICLE: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr})`);

  // Group findings by area
  const byArea: Record<string, DetectedFinding[]> = {
    exterior: [], interior: [], mechanical: [], underbody: [],
  };
  for (const f of allFindings) {
    byArea[f.affectsArea]?.push(f);
  }

  const totalFindings = allFindings.length;
  sections.push(`TOTAL DEFECTS FOUND: ${totalFindings}\n`);

  for (const [area, findings] of Object.entries(byArea)) {
    if (findings.length > 0) {
      sections.push(`--- ${area.toUpperCase()} DEFECTS (${findings.length}) ---`);
      for (const f of findings) {
        sections.push(`- [${f.severity.toUpperCase()}] ${f.defectType} at ${f.location}`);
        sections.push(`  ${f.description}`);
        sections.push(`  Repair: ${f.repairApproach} | Cost: $${(f.repairCostLow / 100).toFixed(0)}-$${(f.repairCostHigh / 100).toFixed(0)}`);
      }
      sections.push("");
    }
  }

  // Comparison findings
  if (comparisonFindings.length > 0) {
    sections.push("--- COMPARISON SCAN FINDINGS ---");
    for (const f of comparisonFindings) {
      sections.push(`- [${f.severity.toUpperCase()}] ${f.title}: ${f.description}`);
      sections.push(`  Affected: ${f.affectedAreas.join(", ")}`);
    }
    sections.push("");
  }

  // Tire data
  if (tireAssessment) {
    sections.push("--- TIRE ASSESSMENT ---");
    sections.push(`FL: ${tireAssessment.frontDriver.condition} | FR: ${tireAssessment.frontPassenger.condition} | RL: ${tireAssessment.rearDriver.condition} | RR: ${tireAssessment.rearPassenger.condition}`);
    sections.push(`Overall tire score: ${tireAssessment.overallTireScore}/10`);
    sections.push(`Summary: ${tireAssessment.summary}`);
    sections.push("");
  }

  if (totalFindings === 0 && comparisonFindings.length === 0) {
    sections.push("NO DEFECTS DETECTED — This is a very clean vehicle. Score areas in the 8-10 range. Use the exterior photos to verify this assessment and flag anything you can see that may have been missed.");
  }

  if (inspectorNotes) {
    sections.push(`INSPECTOR NOTES: ${inspectorNotes}`);
  }

  sections.push("\nNow examine the exterior photos provided and produce the final condition assessment. If you spot ANY defect in the photos not listed above, add it to additionalFindings.");

  return { system, user: sections.join("\n") };
}
