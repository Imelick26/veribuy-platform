/**
 * Detection prompt index — maps capture types to angle-specific checklist builders.
 *
 * Phase 1 of the media analysis pipeline: each photo gets a tailored checklist
 * based on what angle/area it captures.
 */

import type { VehicleInfo } from "../../types";

// Exterior angle-specific prompts
import { buildFrontCenterChecklist } from "./front-center";
import { buildFrontQuarterDriverChecklist } from "./front-quarter-driver";
import { buildFrontQuarterPassengerChecklist } from "./front-quarter-passenger";
import { buildDriverSideChecklist } from "./driver-side";
import { buildPassengerSideChecklist } from "./passenger-side";
import { buildRearQuarterDriverChecklist } from "./rear-quarter-driver";
import { buildRearQuarterPassengerChecklist } from "./rear-quarter-passenger";
import { buildRearCenterChecklist } from "./rear-center";
import { buildRoofChecklist } from "./roof";

// Mechanical prompts
import { buildEngineBayChecklist } from "./engine-bay";
import { buildDoorJambChecklist } from "./door-jamb";
import { buildUndercarriageChecklist } from "./undercarriage";
import { buildTireDetailChecklist } from "./tire-detail";

// Interior prompts
import { buildDashboardChecklist } from "./dashboard";
import { buildFrontSeatsChecklist } from "./front-seats";
import { buildRearSeatsChecklist } from "./rear-seats";

// Cargo prompts
import { buildCargoAreaChecklist } from "./cargo-area";
import { buildTruckBedChecklist } from "./truck-bed";
import { buildHitchTowChecklist } from "./hitch-tow";

// ---------------------------------------------------------------------------
//  Capture type -> checklist mapping
// ---------------------------------------------------------------------------

/**
 * Returns the Phase 1 inspection checklist for a given capture type.
 * Each checklist is tailored to the specific angle/area of the photo.
 */
export function getPhotoChecklist(
  captureType: string,
  vehicle: VehicleInfo,
  isTruck: boolean,
): string {
  const mileageStr = vehicle.mileage
    ? `${vehicle.mileage.toLocaleString()} miles`
    : "unknown mileage";

  switch (captureType) {
    // Exterior angles
    case "FRONT_CENTER":
      return buildFrontCenterChecklist(vehicle, mileageStr);
    case "FRONT_34_DRIVER":
      return buildFrontQuarterDriverChecklist(vehicle, mileageStr);
    case "FRONT_34_PASSENGER":
      return buildFrontQuarterPassengerChecklist(vehicle, mileageStr);
    case "DRIVER_SIDE":
      return buildDriverSideChecklist(vehicle, mileageStr);
    case "PASSENGER_SIDE":
      return buildPassengerSideChecklist(vehicle, mileageStr);
    case "REAR_34_DRIVER":
      return buildRearQuarterDriverChecklist(vehicle, mileageStr);
    case "REAR_34_PASSENGER":
      return buildRearQuarterPassengerChecklist(vehicle, mileageStr);
    case "REAR_CENTER":
      return buildRearCenterChecklist(vehicle, mileageStr);
    case "ROOF":
      return buildRoofChecklist(vehicle, mileageStr);

    // Mechanical
    case "ENGINE_BAY":
      return buildEngineBayChecklist(vehicle, mileageStr);
    case "DOOR_JAMB":
    case "DOOR_JAMB_DRIVER":
      return buildDoorJambChecklist(vehicle, mileageStr);
    case "UNDERCARRIAGE":
      return buildUndercarriageChecklist(vehicle, mileageStr);

    // Tires (4 positions)
    case "TIRE_FRONT_DRIVER":
      return buildTireDetailChecklist(vehicle, mileageStr, "front-left");
    case "TIRE_REAR_DRIVER":
      return buildTireDetailChecklist(vehicle, mileageStr, "rear-left");
    case "TIRE_FRONT_PASSENGER":
      return buildTireDetailChecklist(vehicle, mileageStr, "front-right");
    case "TIRE_REAR_PASSENGER":
      return buildTireDetailChecklist(vehicle, mileageStr, "rear-right");

    // Interior
    case "DASHBOARD_DRIVER":
      return buildDashboardChecklist(vehicle, mileageStr);
    case "FRONT_SEATS":
      return buildFrontSeatsChecklist(vehicle, mileageStr);
    case "REAR_SEATS":
      return buildRearSeatsChecklist(vehicle, mileageStr);

    // Cargo — trucks get truck-bed, everything else gets cargo-area
    case "CARGO_AREA":
      return isTruck
        ? buildTruckBedChecklist(vehicle, mileageStr)
        : buildCargoAreaChecklist(vehicle, mileageStr);

    default:
      return `Inspect this photo of a ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Look for any defects, damage, wear, or issues visible in the image. Be specific about location and severity.`;
  }
}

// ---------------------------------------------------------------------------
//  Tire-specific system prompt (different JSON format)
// ---------------------------------------------------------------------------

/**
 * Tire photos use a dedicated system prompt that forces per-zone tread
 * analysis in the response format. This prevents GPT-4o from making a
 * holistic "looks fine" judgment when the center is bald.
 */
export function buildTireSystemPrompt(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  return `You are a tire condition specialist inspecting a ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}).

Your PRIMARY job is to assess tread depth across three zones of the tire face independently. You MUST examine each zone and report its condition separately.

RESPOND WITH EXACTLY THIS JSON (no markdown, no code fences):
{
  "treadAnalysis": {
    "innerEdge": { "rating": "GOOD|WORN|REPLACE", "grooveDepth": "deep|shallow|flush|bald", "notes": "what you see in this zone" },
    "center": { "rating": "GOOD|WORN|REPLACE", "grooveDepth": "deep|shallow|flush|bald", "notes": "what you see in this zone" },
    "outerEdge": { "rating": "GOOD|WORN|REPLACE", "grooveDepth": "deep|shallow|flush|bald", "notes": "what you see in this zone" },
    "overall": "GOOD|WORN|REPLACE"
  },
  "findings": [
    {
      "defectType": "center_bald|uneven_wear|sidewall_crack|dry_rot|bulge|curb_rash|corrosion|...",
      "location": "specific location (e.g., 'center tread strip', 'outer sidewall', 'wheel lip')",
      "severity": "minor|moderate|major|critical",
      "confidence": 0.0-1.0,
      "dimensions": "size if applicable",
      "paintDamage": "none",
      "repairApproach": "replace tire|wheel refinish|...",
      "repairCostLow": 0,
      "repairCostHigh": 0,
      "description": "2-3 sentence description"
    }
  ],
  "areaCondition": "good|fair|worn|damaged",
  "notes": "overall tire summary"
}

CRITICAL RULES:
- The overall tread rating = the WORST zone rating. If one zone is REPLACE but the others are GOOD, overall = REPLACE.
- Compare zones against each other: if any zone's grooves are less than half the depth of another zone, the shallower zone is "flush" → REPLACE.
- "flush" means grooves are nearly gone and the rubber surface is almost flat. "bald" means completely smooth.
- When uncertain between WORN and REPLACE, choose REPLACE.
- REPLACE = any zone where grooves are flush or gone (<3/32"), wear bars visible, or bald patches.

TIRE COST GUIDELINES:
- Single tire replacement (installed): $150-350 depending on size
- Wheel refinish: $100-200 per wheel`;
}

// ---------------------------------------------------------------------------
//  Shared Phase 1 system prompt
// ---------------------------------------------------------------------------

/**
 * Builds the system prompt shared by ALL Phase 1 detection calls.
 * Sets the role, calibration rules, and JSON response format.
 */
export function buildPhase1SystemPrompt(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - vehicle.year;

  // Age-tier calibration — newer vehicles inspected more critically
  let ageCalibration: string;
  if (vehicleAge <= 3) {
    ageCalibration = `This is a ${vehicleAge}-year-old vehicle (near-new). Inspect VERY critically — any defect matters. Even minor chips, small scratches, or light scuffs should be flagged. Buyers expect near-perfect condition on a vehicle this new.`;
  } else if (vehicleAge <= 7) {
    ageCalibration = `This is a ${vehicleAge}-year-old vehicle. Moderate expectations. Minor rock chips and light scratches on high-exposure areas (bumpers, hood leading edge, rocker panels) are normal wear — do not flag these. Flag anything beyond light wear.`;
  } else if (vehicleAge <= 14) {
    ageCalibration = `This is a ${vehicleAge}-year-old vehicle. Relaxed cosmetic expectations. Paint chips, light scratches, minor clear coat fade, surface brake rotor rust, and light trim oxidation are all EXPECTED at this age — do NOT flag these as defects. Only flag damage that goes beyond normal aging: dents, deep scratches, paint blistering, active corrosion eating through metal, or structural rust.`;
  } else {
    ageCalibration = `This is a ${vehicleAge}-year-old vehicle. Very relaxed cosmetic expectations. Minor paint fade, surface oxidation on chrome/trim, small chips, light scratches, and cosmetic surface rust on non-structural parts are ALL normal aging on a ${vehicleAge}-year-old vehicle — do NOT flag these as defects. Only flag: active structural rust (perforating or compromising metal), significant body damage (large dents, deep creases), heavy corrosion that requires repair, or issues that affect function or safety.`;
  }

  return `You are an expert automotive condition inspector analyzing photos of a ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}, ${vehicleAge} years old).

Your job is to examine each photo against the provided checklist items and report every defect you can clearly identify.

AGE CALIBRATION:
${ageCalibration}

CALIBRATION RULES:
- Score wear relative to ${mileageStr} and vehicle age (${vehicleAge} years). Age-appropriate wear is NOT a defect.
- Dirty or dusty surfaces are NOT defects. Only flag actual damage, wear, corrosion, or component issues.
- Dents show as light/shadow distortions on reflective body panels. Examine panel highlights and reflections carefully.
- Be specific about location: "driver door lower panel, 6 inches above rocker" not just "door".
- Only flag defects you can clearly see with confidence >= 0.4. Do not guess at hidden damage.
- If a checklist item is not visible in the photo, skip it — do not fabricate findings.

RESPOND WITH EXACTLY THIS JSON (no markdown, no code fences):
{
  "findings": [
    {
      "defectType": "dent|scratch|rust_bubble|paint_chip|crack|tear|stain|corrosion|leak|worn|missing|loose|aftermarket|...",
      "location": "specific location on vehicle (e.g., 'hood center-left, 8in from leading edge')",
      "severity": "minor|moderate|major|critical",
      "confidence": 0.0-1.0,
      "dimensions": "approximate size if applicable (e.g., 'approx 4in x 3in')",
      "paintDamage": "none|clear_coat|base_coat|bare_metal",
      "repairApproach": "specific repair method (e.g., 'PDR', 'sand and repaint panel', 'replace seal')",
      "repairCostLow": 0,
      "repairCostHigh": 0,
      "description": "2-3 sentence description for the inspection report"
    }
  ],
  "areaCondition": "good|fair|worn|damaged",
  "notes": "brief overall notes about this area's condition"
}

REPAIR COST GUIDELINES (USD):
- PDR (paintless dent repair): $75-300 per dent depending on size and access
- Panel repaint (sand, prime, paint, clear): $300-800 per panel
- Bumper repaint: $250-600
- Bumper replacement (aftermarket + paint): $400-1200
- Headlight restoration (oxidation): $50-150
- Headlight replacement: $150-600 per side
- Windshield replacement: $250-500
- Tire replacement: $150-350 per tire
- Wheel refinish: $100-200 per wheel
- Wheel replacement: $200-600 per wheel
- Minor scratch buff/polish: $50-150
- Leather seat repair: $150-400
- Headliner replacement: $200-500
- Weather stripping replacement: $50-200 per seal
- Exhaust repair/section: $150-500
- Belt replacement: $75-200
- Hose replacement: $50-200
- Bed liner spray-in: $400-800

Return {"findings": [], "areaCondition": "good", "notes": "No defects found."} if no issues are visible.`;
}
