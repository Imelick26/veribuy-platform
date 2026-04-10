/**
 * Phase 4: Score synthesis prompt.
 *
 * Receives ALL findings + all exterior photos for visual verification.
 * Produces final 9-area condition scores, tire assessment, red flags, and summary.
 */

import type { VehicleInfo, DetectedFinding, ComparisonFinding } from "../types";
import type { TireAssessment } from "@/types/risk";

export function buildSynthesisPrompt(
  vehicle: VehicleInfo,
  allFindings: DetectedFinding[],
  comparisonFindings: ComparisonFinding[],
  tireAssessment: TireAssessment | null | undefined,
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
- Produce final 1-10 condition scores for 9 areas
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
Age-related wear is expected and should NOT heavily penalize the score. But DAMAGE is NOT age-related and MUST be penalized regardless of age. Area-specific guidance:

paintBody — Dents, scratches, rust, paint chips, fade, respray evidence.
  Age-related (don't penalize heavily): minor paint fade, small rock chips, light surface scratches, slightly faded trim.
  DAMAGE (penalize significantly): dents of any size, deep scratches/gouges, significant paint peeling, rust holes, respray evidence, cracked or broken panels.
  - A single noticeable dent = no higher than 6. A large dent = no higher than 5. Multiple dents = 4 or lower.
  - Visible body damage from impact (crumpled metal, creased panels) = 4 or lower regardless of age.

panelAlignment — Gap asymmetry, bumper fitment, door gaps, collision repair evidence. Trucks have wider factory gaps (4-8mm).
  Age-related (don't penalize heavily): minor gap variation within factory spec.
  DAMAGE (penalize significantly): misaligned panels from collision, uneven gaps between sides, bumper fitment issues, evidence of prior body work.

glassLighting — Windshield chips/cracks, headlight oxidation/moisture, taillights, fog lights, mirrors.
  Age-related (don't penalize heavily): minor headlight haze, light pitting on windshield.
  DAMAGE (penalize significantly): windshield cracks, broken/missing lights, heavy oxidation, moisture intrusion in housings, cracked mirrors.

interiorSurfaces — Seats (tears, stains, wear), carpet, headliner, door panels, steering wheel, dashboard surface.
  Age-related (don't penalize heavily): slight UV fade on dashboard, minor wear on driver seat bolster, light carpet wear.
  DAMAGE/NEGLECT (penalize significantly): torn or heavily worn upholstery, stains, cracked dashboard, heavy soiling, pet damage, smoke damage, sagging headliner, worn-through carpet, broken trim pieces.
  - An interior that "doesn't look good" or shows heavy wear throughout = no higher than 5.
  - Visible neglect (stains + wear + broken pieces) = 4 or lower.

interiorControls — Infotainment screen, HVAC vents, gauges, control buttons/knobs, switches, electronics.
  Age-related (don't penalize heavily): minor button wear, slight screen scratches.
  DAMAGE (penalize significantly): broken controls/switches, non-functional screens, cracked gauges, missing knobs, dead pixels, inoperable electronics.

engineBay — Fluid leaks, belts, hoses, battery, sludge, aftermarket mods. Judge by function not appearance.
  Age-related (don't penalize heavily): aged hoses, faded plastic covers, minor dust/grime.
  DAMAGE (penalize significantly): active leaks, worn/cracked belts, corroded battery terminals, loose components, sludge buildup, unauthorized aftermarket modifications.

tiresWheels — Tread depth per zone, sidewalls, rims, wear patterns, DOT age.
  Penalize significantly: uneven wear patterns (alignment/suspension issue), bald zones, sidewall damage, curb rash, DOT date > 6 years, mismatched tires.

underbodyFrame — Frame rails, structural rust, suspension, splash shields. Light surface oxidation is normal on older vehicles.
  Age-related (don't penalize heavily): light surface oxidation, minor surface rust on non-structural components.
  DAMAGE (penalize significantly): active structural corrosion, perforation, compromised frame integrity, damaged suspension components, missing splash shields = score below 5.

exhaust — Pipes, muffler, catalytic converter shield, hangers, tips. Surface rust is normal on older vehicles.
  Age-related (don't penalize heavily): surface rust on exposed pipes, minor discoloration.
  DAMAGE (penalize significantly): perforated pipes/muffler, missing catalytic converter shield, broken hangers, excessive rust-through, loud exhaust indicating leaks.

IMPORTANT: Be honest about what you see. A dealer needs accurate scores to make a buy decision. Inflated scores lead to overpaying. If the vehicle looks rough, score it accordingly — don't rationalize damage as "age-appropriate wear." Age explains fade and minor chips, NOT dents, tears, stains, or broken components.

RESPOND WITH EXACTLY THIS JSON (no markdown):
{
  "areaScores": {
    "paintBody": {
      "score": 1-10,
      "confidence": 0.0-1.0,
      "keyObservations": ["observation 1", "observation 2", "observation 3"],
      "concerns": ["concern 1", ...],
      "summary": "1-2 sentence summary",
      "scoreJustification": "Why this score. What would make it higher or lower."
    },
    "panelAlignment": { same structure },
    "glassLighting": { same structure },
    "interiorSurfaces": { same structure },
    "interiorControls": { same structure },
    "engineBay": { same structure },
    "tiresWheels": { same structure },
    "underbodyFrame": { same structure },
    "exhaust": { same structure }
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
