/**
 * Phase 3: Targeted re-scan prompts.
 *
 * Triggered conditionally by high-signal findings from Phase 1+2.
 * Each re-scan sends 2-4 related photos with a very focused question.
 */

import type { VehicleInfo, RescanTrigger, ComparisonFinding, DetectedFinding } from "../types";

interface RescanPrompt {
  system: string;
  user: string;
}

const RESCAN_RESPONSE_FORMAT = `RESPOND WITH EXACTLY THIS JSON (no markdown):
{
  "confirmed": true/false,
  "findings": [
    {
      "defectType": "...",
      "location": "...",
      "severity": "minor|moderate|major|critical",
      "confidence": 0.0-1.0,
      "description": "what you found and why it matters",
      "repairApproach": "...",
      "repairCostLow": 0,
      "repairCostHigh": 0
    }
  ],
  "assessment": "1-2 sentence summary of the re-scan results"
}`;

export function buildRescanPrompt(
  vehicle: VehicleInfo,
  trigger: RescanTrigger,
  triggerFindings: (DetectedFinding | ComparisonFinding)[],
): RescanPrompt {
  const mileageStr = vehicle.mileage
    ? `${vehicle.mileage.toLocaleString()} miles`
    : "unknown mileage";
  const v = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  const triggerContext = triggerFindings
    .map((f) => `- ${"defectType" in f ? f.defectType : f.title} at ${"location" in f ? f.location : f.affectedAreas?.join(", ")}`)
    .join("\n");

  switch (trigger) {
    case "paint_mismatch":
      return {
        system: `You are a collision repair detection specialist examining a ${v} (${mileageStr}). A paint mismatch was detected between panels. Your job: confirm or rule out prior body work by looking for secondary evidence.\n\n${RESCAN_RESPONSE_FORMAT}`,
        user: `PAINT MISMATCH DETECTED:\n${triggerContext}\n\nLook SPECIFICALLY for secondary evidence of prior body work:\n1. Overspray on door rubber seals, window trim, or glass edges\n2. Body filler texture — waviness or rippling in panel reflections (filler doesn't reflect like factory metal)\n3. Sanding marks or scratching under the clear coat\n4. Masking tape lines where paint meets adjacent panels\n5. Paint thickness differences (thicker areas = repainted)\n6. Bolt marks or replaced fasteners on panels (panel was removed for repair)\n7. Adhesive residue from removed trim during repaint\n\nConfirm whether this is a professional respray, a poor-quality repair, or a factory variation.`,
      };

    case "panel_gaps":
      return {
        system: `You are a structural alignment specialist examining a ${v} (${mileageStr}). Panel gap inconsistencies were found. Your job: determine if this is collision damage or normal tolerance.\n\n${RESCAN_RESPONSE_FORMAT}`,
        user: `PANEL GAP ISSUES DETECTED:\n${triggerContext}\n\nLook SPECIFICALLY for:\n1. Gap differences left-to-right — measure visually if the same gap is wider on one side\n2. Hinge bolt marks — scoring on hinge bolts indicates they were loosened during panel replacement\n3. Welding evidence — spot welds or seam sealer that looks different from factory\n4. Panel mounting points — any evidence of repair or replacement at attachment points\n5. Structural alignment — does the roofline, beltline, or character line flow smoothly?\n\nDetermine: factory tolerance, minor adjustment needed, or collision repair evidence.`,
      };

    case "rust_cluster":
      return {
        system: `You are a corrosion assessment specialist examining a ${v} (${mileageStr}). Rust was found in one area. Your job: determine how extensive the corrosion is across the vehicle.\n\n${RESCAN_RESPONSE_FORMAT}`,
        user: `RUST DETECTED:\n${triggerContext}\n\nScan ALL visible lower body areas for additional corrosion:\n1. Rocker panels (both sides) — rust at bottom edges\n2. Wheel well lips — rust along the fender edges\n3. Door bottom edges — rust forming from the inside out\n4. Frame rails (if undercarriage visible) — surface vs structural rust\n5. Rear wheel arches — common rust-through areas\n6. Seam rust — along body panel joints and weld seams\n\nAssess: is this isolated surface rust, or spreading structural corrosion?`,
      };

    case "flood_indicators":
      return {
        system: `You are a flood damage detection specialist examining a ${v} (${mileageStr}). Flood indicators were found in the door jamb. Your job: look for corroborating flood evidence in interior and mechanical areas.\n\n${RESCAN_RESPONSE_FORMAT}`,
        user: `FLOOD INDICATORS DETECTED IN DOOR JAMB:\n${triggerContext}\n\nLook for CORROBORATING flood evidence:\n1. Water line marks inside the cabin — tide lines on seats, door panels, or center console\n2. Silt or mud deposits in crevices — between seats, under floor mats, in HVAC vents\n3. Mismatched carpet or floor mats — recently replaced to hide water damage\n4. Corroded electrical connectors visible under dash or in door panels\n5. Musty stain patterns on fabric or headliner\n6. Fogged or moisture-damaged gauges\n7. Engine bay — corrosion patterns inconsistent with normal aging\n\nFlood damage is a CRITICAL finding. Confirm or rule out with high confidence.`,
      };

    case "heavy_towing":
      return {
        system: `You are a drivetrain wear specialist examining a ${v} (${mileageStr}). Heavy towing indicators were found. Your job: look for secondary drivetrain stress evidence.\n\n${RESCAN_RESPONSE_FORMAT}`,
        user: `HEAVY TOWING USE DETECTED:\n${triggerContext}\n\nLook for secondary evidence of drivetrain stress from towing:\n1. Transmission cooler lines — aftermarket auxiliary cooler presence\n2. Frame stress marks around hitch mounting area\n3. Rear suspension sag — rear sitting lower than normal\n4. Transmission fluid condition (if visible) — dark or burnt smell indicators\n5. Rear differential leak signs\n6. Exhaust heat discoloration — heavier near rear from sustained towing loads\n\nHeavy towing significantly reduces remaining drivetrain life even if the vehicle looks clean.`,
      };
  }
}
