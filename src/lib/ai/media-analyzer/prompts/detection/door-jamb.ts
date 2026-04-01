/**
 * Angle-specific prompt: Door Jamb
 * Phase 1 checklist for the door jamb photo.
 */

import type { VehicleInfo } from "../../types";

export function buildDoorJambChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  return `DOOR JAMB — Inspect the door jamb area of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Check every item below and be specific about location. Door jambs reveal critical evidence of repaints, flood damage, and hidden rust.

RUST:
1. Rust in door jambs — surface rust, bubbling paint, or corrosion in corners and lower edges
2. Hinge rust or wear (corroded, stiff, or loose hinge hardware)

REPAINT EVIDENCE (high-value clues):
3. Paint consistency — compare color and texture inside the jamb versus the outer body panels; color mismatch is STRONG evidence of repaint
4. Paint drips or runs inside the jamb (sloppy repaint work — paint should be smooth and even)
5. Overspray on rubber seals, weatherstripping edges, or bolt heads (masking was not thorough)

WEATHER STRIPPING & SEALS:
6. Door seal / weather stripping damage — cracked, torn, compressed, or pulling away from the channel
7. Weather stripping dried out — hardened rubber that has lost flexibility

FLOOD & NEGLECT INDICATORS:
8. Heavy dirt or debris buildup in jamb crevices (excessive grime = possible flood or neglect signal)
9. Water line marks or mud deposits in the jamb area — FLOOD INDICATOR; look for a horizontal demarcation line

WIRING & HARDWARE:
10. Wiring harness condition — cracked insulation, exposed copper, corroded connectors passing through the jamb
11. VIN plate present and readable on the door jamb sticker or plate
12. VIN plate tampering signs — scratches around rivets, replaced rivets, adhesive residue, misaligned plate`;
}
