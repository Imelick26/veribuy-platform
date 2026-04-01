/**
 * Angle-specific prompt: Front Seats
 * Phase 1 checklist for the front seats / front cabin photo.
 */

import type { VehicleInfo } from "../../types";

export function buildFrontSeatsChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  return `FRONT SEATS & CABIN — Inspect the front seats and surrounding interior of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Check every item below and be specific about location. Score wear relative to the mileage.

DRIVER SEAT:
1. Driver seat tears or rips in the seating surface, bolster, or backrest
2. Leather cracking or peeling on the driver seat (if leather)
3. Heavy bolster wear on the driver side — the outer edge of the seat cushion and backrest where the driver enters/exits
4. Fabric pilling, fraying, or snags (if cloth)
5. Burn holes in the seat material

PASSENGER SEAT:
6. Passenger seat tears, rips, or damage (same checks as driver side)

STAINS:
7. Stains on seats — distinguish between light surface spots and heavy set-in stains

SEAT CONDITION:
8. Driver seat cushion support — collapsed, sagging, or bottomed-out foam (the seat looks flat or compressed)

HEADLINER:
9. Headliner condition if visible — sagging fabric, stains, tears, or separation from backing

DOOR PANELS & TRIM:
10. Door panel trim — scuffs, scratches, broken clips, loose panels, worn armrests
11. A-pillar / B-pillar trim — cracked, loose, or missing trim covers

FLOOR:
12. Carpet condition — stains, excessive wear patterns, dampness or water damage
13. Floor mats — present, worn through, or missing

SAFETY:
14. Seat belt condition — fraying, cuts, or retractor issues visible on the belt webbing`;
}
