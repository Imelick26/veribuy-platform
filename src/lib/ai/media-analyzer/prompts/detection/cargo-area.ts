/**
 * Angle-specific prompt: Cargo Area (non-truck vehicles)
 * Phase 1 checklist for the cargo / trunk photo on SUVs, sedans, wagons, vans.
 */

import type { VehicleInfo } from "../../types";

export function buildCargoAreaChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  return `CARGO AREA — Inspect the cargo area / trunk of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Check every item below and be specific about location. This checklist is for non-truck vehicles (SUVs, sedans, wagons, vans).

CARGO SURFACES:
1. Cargo carpet condition — stains, tears, excessive wear, or cut-outs
2. Cargo trim panels — scratches, cracks, broken clips, or missing pieces on sidewalls and rear seatback

SPARE TIRE AREA:
3. Spare tire area condition (if visible) — rust, water pooling, or damage in the spare tire well

TIE-DOWNS & HARDWARE:
4. Cargo tie-down points — broken hooks, bent anchors, or missing hardware
5. Cargo cover or cargo barrier — present, missing, damaged, or retraction issues

WATER & CLEANLINESS:
6. Water staining in the cargo area — look for tide-line marks, musty discoloration, or rust in low points (FLOOD INDICATOR)
7. Cargo area cleanliness — heavy dirt, debris, or chemical staining suggesting commercial use or neglect

GENERAL:
8. Trunk / liftgate seal condition — cracked or compressed weatherstripping allowing water intrusion
9. Cargo light function and lens condition if visible`;
}
