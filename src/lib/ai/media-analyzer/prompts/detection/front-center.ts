/**
 * Angle-specific prompt: Front Center
 * Phase 1 checklist for the straight-on front photo.
 */

import type { VehicleInfo } from "../../types";

export function buildFrontCenterChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  return `FRONT CENTER VIEW — Inspect the front of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Check every item below and be specific about location (e.g., "front bumper driver-side corner" not just "bumper"). Dirty or dusty surfaces are NOT defects — only flag actual damage, wear, or component issues. Dents show as light/shadow distortions on reflective surfaces; examine panel highlights carefully.

1. Front bumper — scratches, scuffs, cracks, or sagging/loose clips; note any paint color or texture mismatch versus the adjacent body panels
2. Grille — cracked, broken, or missing slats; aftermarket replacement; mounting damage
3. Hood leading edge — stone chips, dents, or paint erosion along the front lip
4. Windshield — chips, cracks, star breaks, or long stress fractures; note exact position (driver side, center, passenger side)
5. Headlight lenses — oxidation or yellowing of plastic, moisture/condensation inside the housing, cracks or chips
6. License plate — present and readable, or missing/obstructed; mounting bracket damage
7. Front badges and emblems — missing, damaged, crooked, aftermarket, or evidence of rebadging (filled holes, adhesive residue)
8. Fog light housings — cracked lenses, missing covers, moisture intrusion, broken bezels
9. Wiper blades — torn rubber, bent arms, or streaking residue on the windshield if visible from this angle
10. Front bumper-to-fender fitment — uneven gaps or panel misalignment on either side indicating prior repair or impact`;
}
