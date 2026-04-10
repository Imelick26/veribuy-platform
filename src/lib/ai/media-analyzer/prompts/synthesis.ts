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
1. ALL exterior photos of the vehicle — use these to VISUALLY VERIFY the findings
2. A complete inventory of every defect found across all inspection phases
3. Comparison scan results (paint consistency, tire comparison, wear assessment)

Your job:
- Produce final 0-100 condition scores for 8 areas
- Synthesize all comparison findings into cross-correlation red flags
- Provide an overall dealer-focused vehicle summary

SCORING RUBRIC (0-100 per area):
100: Excellent — no wear or damage visible. Looks new or professionally maintained. Reserve this for areas that genuinely look outstanding.
95-99: Very good — minimal age-appropriate wear only. A buyer would not notice any issues. This is the expected score for a well-maintained area with no damage.
90-94: Good — minor cosmetic wear visible but nothing that needs repair. Normal use wear for the vehicle's age and mileage.
80-89: Above average — minor items a dealer would notice. Small chips, light scratches, visible wear patterns.
70-79: Issues worth noting — a dent, moderate wear, something that might need attention before retail.
60-69: Multiple noticeable issues or one significant issue — will affect buyer perception.
50-59: Below average — heavy wear, damage, or neglect visible. Reconditioning needed.
Below 50: Significant damage or heavy neglect.

KEY SCORING PRINCIPLES:
1. Start at 95 as your baseline for a well-maintained used vehicle with no damage or issues.
2. Only give 100 when the area genuinely looks excellent — not just "no issues found." A 5-year-old truck with 50K miles doesn't get 100 on interior just because nothing is broken. Normal use wear is real even when minor.
3. Deduct for SPECIFIC issues you can identify. Vague "it could be better" is not a deduction — but visible wear IS, even if minor.
4. Areas with limited photo coverage (only 1-2 photos, like engine bay, underbody, exhaust): cap at 95 unless the photos clearly show excellent condition. You cannot confirm perfection from limited angles.

THESE ARE NOT DEFECTS — DO NOT REDUCE ANY SCORE FOR:
- Dirt, dust, debris, or grime (dirty ≠ damaged — a detail solves this)
- Bed floor scratches on trucks/pickups (normal truck use, not body damage)
- Leaves, mud, or road dust on undercarriage or in wheel wells
- Items that are dirty but not damaged (e.g., dusty engine bay, grimy undercarriage)
- "Could use a wash" or "could use a polish" observations
- Preventative maintenance items or "it could be better" observations

AREA-SPECIFIC SCORING GUIDANCE:

paintBody — Paint condition, dents, scratches, rust, chips, respray evidence.
  Do NOT deduct for: minor paint fade, small rock chips on hood leading edge, light surface scratches, slightly faded trim, bed floor scratches on trucks.
  DEDUCT for: dents (single dent = max 70, large dent = max 60, multiple = max 50), deep scratches/gouges, significant paint peeling, rust holes, respray evidence, cracked/broken panels, collision damage (max 40).

glassLighting — Windshield, headlights, taillights, fog lights, mirrors.
  Do NOT deduct for: very minor headlight haze, light windshield pitting from highway use.
  DEDUCT for: windshield chips/cracks, broken/missing lights, heavy oxidation, moisture in housings, cracked mirrors.

interiorSurfaces — Seats, carpet, headliner, door panels, steering wheel, dashboard.
  Do NOT deduct for: slight UV fade on dashboard, light driver seat bolster wear at high mileage, light carpet wear, dirt/dust.
  DEDUCT for: torn or heavily worn upholstery, set-in stains, cracked dashboard, pet damage, smoke damage, sagging headliner, worn-through carpet, broken trim. Heavy wear throughout = max 50. Visible neglect = max 40.

interiorControls — Infotainment, HVAC, gauges, buttons/knobs, switches.
  Do NOT deduct for: minor button wear, slight screen scratches.
  DEDUCT for: broken/non-functional controls, cracked/dead screens, missing knobs, inoperable electronics.

engineBay — Fluid leaks, belts, hoses, battery, sludge, aftermarket mods. Judge by FUNCTION not appearance.
  Do NOT deduct for: aged hoses, faded plastic, dust/grime, normal engine bay appearance.
  DEDUCT for: active leaks, worn/cracked belts, corroded battery terminals, loose components, sludge, sketchy aftermarket wiring.

tiresWheels — Tread depth, sidewalls, rims, wear patterns, DOT age. (Scored separately from overall.)
  DEDUCT for: uneven wear (alignment issue), bald zones, sidewall damage, curb rash, DOT > 6 years, mismatched tires.

underbodyFrame — Frame rails, structural rust, suspension, splash shields.
  Do NOT deduct for: light surface oxidation, minor surface rust on non-structural parts, road grime, dirt.
  DEDUCT for: active structural corrosion, perforation, compromised frame, damaged suspension, missing splash shields.

exhaust — Pipes, muffler, catalytic converter, hangers, tips.
  Do NOT deduct for: surface rust on exposed pipes, minor discoloration, road grime.
  DEDUCT for: perforated pipes/muffler, missing cat shield, broken hangers, rust-through, exhaust leaks.

IMPORTANT: Be honest about what you see. A dealer needs accurate scores. If the vehicle has real damage, score it accordingly. But do NOT penalize for normal use, dirt, or age-appropriate wear. A clean truck with no damage should score 100 in every area.

RESPOND WITH EXACTLY THIS JSON (no markdown):
{
  "areaScores": {
    "paintBody": {
      "score": 0-100,
      "confidence": 0.0-1.0,
      "keyObservations": ["observation 1", "observation 2"],
      "concerns": ["concern 1", ...],
      "summary": "1-2 sentence summary",
      "scoreJustification": "What specific issues caused deductions, or 'No issues found' if score is 100."
    },
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
