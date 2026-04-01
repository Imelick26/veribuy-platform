/**
 * Angle-specific prompt: Rear Seats
 * Phase 1 checklist for the rear seats / rear cabin photo.
 */

import type { VehicleInfo } from "../../types";

export function buildRearSeatsChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  return `REAR SEATS & CABIN — Inspect the rear seats and surrounding interior of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Check every item below and be specific about location. Score wear relative to the mileage.

REAR SEATS:
1. Rear seat tears, rips, or punctures in the seating surface or backrest
2. Leather cracking or peeling (if leather)
3. Fabric damage — pilling, fraying, snags, or pulls (if cloth)
4. Stains on rear seats — light surface spots vs heavy set-in stains

CARPET & FLOOR:
5. Rear carpet condition — stains, wear, or dampness
6. Water staining on carpet or fabric — FLOOD INDICATOR; look for tide-line marks or musty discoloration

TRIM & PANELS:
7. Rear door panel trim — scuffs, scratches, broken clips, loose panels
8. C-pillar trim — cracked, loose, or missing trim covers

HEADLINER:
9. Rear headliner condition — sagging, stains, tears, or separation from backing

OTHER:
10. Rear window shelf / package tray — warped, cracked, sun-damaged, or missing
11. Child seat anchor points — wear or damage from repeated child seat installation
12. Debris in seat crevices or between cushions (neglect indicator)
13. Overall cleanliness and condition
14. Wear consistent with front seats? A pristine rear with a worn front is normal; worn rear with pristine front may indicate commercial passenger use`;
}
