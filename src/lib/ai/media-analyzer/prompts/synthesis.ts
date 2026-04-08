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

  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - vehicle.year;
  const ageStr = `${vehicleAge} years old`;

  const system = `You are a senior automotive appraiser producing the final condition assessment for a ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}, ${ageStr}).

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
9-10: Like-new. No visible wear or damage. Exceptional for any age.
8: Very good. Minor wear only. Outstanding for a ${ageStr} vehicle.
7: Good. Normal age-appropriate wear for a ${ageStr} vehicle with ${mileageStr}. THIS IS THE TARGET SCORE for a well-maintained vehicle of this age.
6: Above average. Wear slightly beyond what's normal for ${ageStr}/${mileageStr}.
5: Average. Noticeable issues beyond normal aging.
4: Below average. Multiple issues or premature wear for the age.
3: Poor. Significant damage or neglect.
1-2: Very poor. Severe damage or extreme neglect.

CRITICAL — AGE-RELATIVE SCORING:
This is a ${vehicleAge}-year-old vehicle. You MUST calibrate your expectations:
- Cosmetic: Minor paint fade, small chips, light surface scratches are NORMAL on a ${ageStr} vehicle. These are NOT defects — they are expected aging. Score 7+ unless damage goes significantly beyond normal age-related wear.
- Interior: Light seat wear, dashboard UV fade, minor carpet wear are EXPECTED at ${ageStr}. Score 7+ unless there's unusual damage, staining, or neglect.
- Underbody: Light surface oxidation is NORMAL on any vehicle over 10 years old, especially trucks. Only score below 7 if there is active structural corrosion, perforation, or compromised integrity.
- Mechanical: Judge by function, not appearance. Aged hoses, faded plastic, surface patina on an engine bay are cosmetic — not mechanical defects.

A ${ageStr} vehicle scoring 7/10 in each area means "well-maintained for its age" — that's a GOOD vehicle. Reserve 8+ for vehicles that look remarkably better than their age suggests. Reserve 5-6 for vehicles showing wear significantly beyond what age explains.

IMPORTANT: Score relative to BOTH age (${ageStr}) and mileage (${mileageStr}). Normal age-related cosmetic wear on a ${vehicleAge}-year-old vehicle is a 7, NOT a 5-6. Only penalize below 7 for wear that goes BEYOND what the vehicle's age explains.

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
  sections.push(`VEHICLE: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}, ${ageStr})`);

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
