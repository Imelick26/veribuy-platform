/**
 * Phase 2: Comparison scan prompts.
 *
 * Multi-photo calls that look across the entire vehicle for patterns
 * that single-photo analysis structurally cannot detect.
 */

import type { VehicleInfo } from "../types";

// ---------------------------------------------------------------------------
//  Shared response format for comparison scans
// ---------------------------------------------------------------------------

const COMPARISON_RESPONSE_FORMAT = `RESPOND WITH EXACTLY THIS JSON (no markdown):
{
  "findings": [
    {
      "title": "Short finding title",
      "description": "What you see and why it matters — reference specific panels/photos",
      "severity": "minor|moderate|major|critical",
      "confidence": 0.0-1.0,
      "affectedAreas": ["panel/area 1", "panel/area 2"]
    }
  ],
  "notes": "overall summary of this comparison scan"
}

Return {"findings": [], "notes": "..."} if no issues found.`;

// ---------------------------------------------------------------------------
//  Paint consistency scan (all 9 exterior photos)
// ---------------------------------------------------------------------------

export function buildPaintConsistencyPrompt(vehicle: VehicleInfo, mileageStr: string): { system: string; user: string } {
  return {
    system: `You are a paint and body specialist examining a ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}) for evidence of prior body work or repainting.

You are receiving ALL exterior photos of this vehicle. Your ONLY job: compare the paint across every visible panel looking for inconsistencies.

${COMPARISON_RESPONSE_FORMAT}`,

    user: `Compare the paint finish across ALL panels of this ${vehicle.year} ${vehicle.make} ${vehicle.model}. These photos show the vehicle from every exterior angle.

CHECK FOR:
1. Color mismatch between adjacent panels — even slight shade differences (especially metallic/pearl paints)
2. Metallic flake inconsistency — one panel has different sparkle or flake pattern than neighbors
3. Orange peel texture differences — one panel smoother or rougher than others
4. Overspray on trim, rubber seals, or glass edges — paint where it shouldn't be
5. Clear coat variation — one panel glossier or hazier than adjacent panels
6. Fresh paint vs aged paint — one panel looks newer/shinier than the rest
7. Masking tape lines — visible lines where paint was masked during respray
8. Blending evidence — color fading into adjacent panels (blended respray technique)

These are STRONG indicators of prior collision repair or body work. Even subtle differences matter for the dealer.

Compare EVERY pair of adjacent panels you can see across the photos.`,
  };
}

// ---------------------------------------------------------------------------
//  Panel alignment scan (all 9 exterior photos)
// ---------------------------------------------------------------------------

// Trucks and body-on-frame SUVs have wider factory panel tolerances
const TRUCK_MODELS = [
  "f-150", "f-250", "f-350", "silverado", "sierra", "ram", "tundra", "titan",
  "tacoma", "ranger", "colorado", "canyon", "gladiator", "ridgeline", "maverick",
  "santa cruz", "frontier",
];
const TRUCK_BODY_STYLES = ["truck", "pickup", "crew cab", "double cab", "regular cab", "supercab", "supercrew"];

function isLikelyTruck(vehicle: VehicleInfo): boolean {
  const style = (vehicle.bodyStyle || "").toLowerCase();
  if (TRUCK_BODY_STYLES.some((t) => style.includes(t))) return true;
  const model = `${vehicle.make} ${vehicle.model}`.toLowerCase();
  return TRUCK_MODELS.some((t) => model.includes(t));
}

export function buildPanelAlignmentPrompt(vehicle: VehicleInfo, mileageStr: string): { system: string; user: string } {
  const truckCalibration = isLikelyTruck(vehicle)
    ? `\n\nBODY-ON-FRAME CALIBRATION: This is a truck/pickup. Trucks have wider factory panel gaps (4-8mm vs 3-5mm on unibody cars) and more fitment variation from the factory. Slight asymmetry (1-2mm side-to-side difference) is NORMAL on body-on-frame vehicles and should NOT be flagged. Only flag gaps with 3mm+ side-to-side difference or clear evidence of prior collision repair (paint overspray, mismatched texture, fresh sealant).`
    : "";

  return {
    system: `You are a body alignment specialist examining a ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}) for panel fit issues.

You are receiving ALL exterior photos. Your ONLY job: compare panel gaps and alignment across the entire vehicle.
${truckCalibration}

${COMPARISON_RESPONSE_FORMAT}`,

    user: `Compare panel gaps and alignment across the ENTIRE vehicle.

CHECK FOR:
1. Uneven door-to-fender gaps — wider on top vs bottom, or left vs right side
2. Hood-to-fender gap asymmetry — one side wider than the other
3. Tailgate/trunk lid alignment — sitting higher on one side, uneven gaps
4. Bumper fitment — front or rear bumper sitting crooked, uneven gaps to body
5. Door alignment — any door sitting higher/lower than adjacent panels
6. Quarter panel alignment — rear quarter fitting differently than factory spec
7. Headlight/taillight housing fitment — one side tighter than the other

Compare left side to right side for EVERY panel pair. Significantly uneven gaps may indicate prior collision repair — but minor variation is normal, especially on trucks and body-on-frame vehicles.`,
  };
}

// ---------------------------------------------------------------------------
//  Tire comparison (all 4 tire detail photos)
// ---------------------------------------------------------------------------

export function buildTireComparisonPrompt(vehicle: VehicleInfo, mileageStr: string): { system: string; user: string } {
  return {
    system: `You are a tire condition specialist comparing all 4 tires on a ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}).

You are receiving close-up photos of all 4 tires. Compare them against each other.

RESPOND WITH EXACTLY THIS JSON (no markdown):
{
  "tireAssessment": {
    "frontDriver": { "condition": "GOOD|WORN|REPLACE", "observations": ["what you see"] },
    "frontPassenger": { "condition": "GOOD|WORN|REPLACE", "observations": ["..."] },
    "rearDriver": { "condition": "GOOD|WORN|REPLACE", "observations": ["..."] },
    "rearPassenger": { "condition": "GOOD|WORN|REPLACE", "observations": ["..."] },
    "overallTireScore": 1-10,
    "summary": "1-2 sentence summary for the dealer"
  },
  "findings": [
    { "title": "...", "description": "...", "severity": "minor|moderate|major|critical", "confidence": 0.0-1.0, "affectedAreas": ["..."] }
  ],
  "notes": "overall tire comparison notes"
}

Condition tiers — A tire is only as good as its WORST zone:
- GOOD: 7+/32" tread across the full face (inner, center, outer all have deep grooves with clearly visible depth)
- WORN: 3-6/32" in any zone. Shallow grooves, wear bars starting to show, tread that looks low
- REPLACE: <3/32" in ANY zone — bald center, bald edges, or bald patches anywhere. A tire that is bald in the center but has tread on the edges is REPLACE. Wear bars flush, smooth rubber, or visible cord = REPLACE. Dry rot, sidewall cracking, or bulges = REPLACE regardless of tread.

CRITICAL — ERR ON THE SIDE OF REPLACEMENT:
This is a dealer tool. Dealers need worst-case tire cost, not best-case. If a tire looks questionable, borderline, or you're unsure — classify it as the WORSE tier. A dealer would rather budget for tire replacement and be pleasantly surprised than miss a bad tire and have it blow out on a test drive. When in doubt between GOOD and WORN, choose WORN. When in doubt between WORN and REPLACE, choose REPLACE.`,

    user: `Compare all 4 tires on this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}).

Photos are: Front-Left (Driver), Front-Right (Passenger), Rear-Left (Driver), Rear-Right (Passenger).

FOR EACH TIRE — examine the tread in three zones:
- INNER edge (closest to vehicle body)
- CENTER of tread face
- OUTER edge (farthest from vehicle)
If ANY zone is bald or smooth, that tire is REPLACE regardless of the other zones.

THEN COMPARE ACROSS ALL 4:
1. Mismatched tire brands or models between tires
2. Mismatched tire sizes (read sidewall markings if visible)
3. Significantly different tread depths between tires (partial replacement indicator)
4. Different tire age/DOT codes if visible (>2 year difference = concern)
5. Inconsistent wear patterns — center wear on fronts but not rears = overinflation on front axle; inside edge wear = alignment issue
6. One tire dramatically more worn than the others

Rate each tire individually AND as a set. Mismatched tires across an axle = safety concern.`,
  };
}

// ---------------------------------------------------------------------------
//  Interior wear consistency (3 interior photos)
// ---------------------------------------------------------------------------

export function buildInteriorConsistencyPrompt(vehicle: VehicleInfo, mileageStr: string): { system: string; user: string } {
  return {
    system: `You are an interior condition specialist assessing wear consistency on a ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}).

You are receiving dashboard, front seat, and rear seat photos. Compare wear levels across all interior areas.

${COMPARISON_RESPONSE_FORMAT}`,

    user: `Assess interior wear consistency across dashboard, front seats, and rear seats.

CHECK FOR:
1. Driver seat bolster wear dramatically worse than passenger seat — normal or excessive?
2. Dashboard/steering wheel wear matches the seat wear? Mismatch = possible component replacement
3. Rear seat much cleaner than front — normal. Rear seat much more worn than front — unusual
4. Different material textures or colors between areas — possible seat or panel replacement
5. Overall interior wear level appropriate for ${mileageStr}?
6. Any signs of interior water damage (stains, warping) that appear in multiple areas

A pristine interior at high mileage may indicate component replacement. Heavy wear at low mileage is a concern.`,
  };
}

// ---------------------------------------------------------------------------
//  Wear vs mileage assessment (6 representative photos)
// ---------------------------------------------------------------------------

export function buildWearVsMileagePrompt(vehicle: VehicleInfo, mileageStr: string): { system: string; user: string } {
  return {
    system: `You are a senior vehicle appraiser assessing whether a ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}) shows wear consistent with its claimed mileage.

You are receiving representative photos from exterior, interior, engine bay, undercarriage, and tires. Cross-compare them.

${COMPARISON_RESPONSE_FORMAT}`,

    user: `Assess whether this vehicle's overall condition matches ${mileageStr}.

You are seeing: front exterior, driver side, dashboard interior, engine bay, undercarriage, and a tire photo.

CHECK FOR:
1. Exterior condition matches interior condition? Clean exterior + thrashed interior = suspicious
2. Engine bay cleanliness proportionate to mileage? Pristine engine at 200K = recently cleaned for sale
3. Undercarriage rust/wear appropriate for age and region?
4. Tire wear level consistent with claimed mileage?
5. Signs of commercial use — heavy bed wear, hitch wear, fleet markings/residue, contractor modifications
6. Signs of neglect — deferred maintenance across multiple areas simultaneously
7. Odometer rollback indicators — heavy wear that doesn't match a low mileage claim

Flag ANY inconsistency between claimed mileage and observed wear level.`,
  };
}
