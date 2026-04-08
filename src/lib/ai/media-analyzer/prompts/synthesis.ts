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
8: Very good. Minor cosmetic wear only — small chips, light scratches. No dents, no damage.
7: Good. Normal age-appropriate wear. Well-maintained. No significant damage, stains, or dents.
6: Above average wear. Some issues beyond normal aging — a noticeable dent, moderate staining, visible wear patterns.
5: Average. Multiple noticeable issues — dents, worn seats, stains, fading beyond normal.
4: Below average. Significant damage or heavy wear — large dents, torn/heavily worn upholstery, multiple areas of damage.
3: Poor. Major damage or neglect clearly visible. Extensive wear, damage, or deterioration.
1-2: Very poor. Severe damage or extreme neglect.

CRITICAL — DISTINGUISH AGE-RELATED WEAR FROM ACTUAL DAMAGE:
Age-related wear (minor paint fade, small rock chips, light surface scratches, slight UV fade) is expected and should NOT heavily penalize the score. But DAMAGE is NOT age-related and MUST be penalized regardless of age:

EXTERIOR — things that ARE age-related (don't penalize heavily): minor paint fade, small rock chips, light surface scratches, slightly faded trim
EXTERIOR — things that are DAMAGE (penalize significantly): dents of any size, cracked or broken panels, deep scratches/gouges, significant paint peeling, rust holes, misaligned panels from collision, broken lights
- A single noticeable dent = no higher than 6. A large dent = no higher than 5. Multiple dents = 4 or lower.
- Visible body damage from impact (crumpled metal, creased panels) = 4 or lower regardless of age.

INTERIOR — things that ARE age-related (don't penalize heavily): slight UV fade on dashboard, minor wear on driver seat bolster, light carpet wear
INTERIOR — things that are DAMAGE/NEGLECT (penalize significantly): torn or heavily worn upholstery, stains, cracked dashboard, broken controls/switches, heavy soiling, pet damage, smoke damage, sagging headliner, worn-through carpet, broken trim pieces
- An interior that "doesn't look good" or shows heavy wear throughout = no higher than 5.
- Visible neglect (stains + wear + broken pieces) = 4 or lower.

UNDERBODY: Light surface oxidation is normal on older vehicles. Active structural corrosion, perforation, or compromised integrity = score below 5.

MECHANICAL: Judge by function, not appearance. Aged hoses and faded plastic are cosmetic. Active leaks, worn belts, corroded battery terminals, loose components = penalize.

IMPORTANT: Be honest about what you see. A dealer needs accurate scores to make a buy decision. Inflated scores lead to overpaying. If the vehicle looks rough, score it accordingly — don't rationalize damage as "age-appropriate wear." Age explains fade and minor chips, NOT dents, tears, stains, or broken components.

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
