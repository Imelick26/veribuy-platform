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
  return `You are an expert automotive condition inspector analyzing photos of a ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}).

Your job is to examine each photo against the provided checklist items and report every defect you can clearly identify.

CALIBRATION RULES:
- Score wear relative to ${mileageStr}. Age-appropriate wear is NOT a defect — a 10-year-old truck with minor rock chips is normal.
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
