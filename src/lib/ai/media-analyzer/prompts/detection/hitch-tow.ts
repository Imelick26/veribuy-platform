/**
 * Angle-specific prompt: Hitch & Tow Components
 * Phase 1 checklist for the rear hitch area (truck-specific).
 */

import type { VehicleInfo } from "../../types";

export function buildHitchTowChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  return `HITCH & TOW COMPONENTS — Inspect the rear hitch and towing hardware of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Check every item below and be specific about location. Heavy towing use significantly affects transmission and drivetrain wear even if the vehicle appears clean otherwise.

HITCH RECEIVER:
1. Hitch receiver rust or corrosion — surface rust vs heavy scale that compromises the receiver
2. Hitch receiver damage — bent, cracked, or deformed receiver tube
3. Hitch ball mount wear (if a ball mount is installed) — worn ball surface, bent shank

HITCH COMPONENTS:
4. Bent hitch components — pins, clips, or mounting hardware that are deformed

WIRING:
5. Tow wiring and electrical connector damage — frayed wires, corroded plug contacts, cracked connector housings
6. Trailer brake controller wiring if visible — proper installation vs loose/dangling wires

HEAVY TOWING INDICATORS:
7. Excessive hitch scratching and wear marks — indicates frequent trailer hookup and disconnect
8. Sway bar marks or wear patterns on the hitch assembly
9. Aftermarket transmission cooler — added specifically for towing duty (indicates the vehicle towed regularly)`;
}
