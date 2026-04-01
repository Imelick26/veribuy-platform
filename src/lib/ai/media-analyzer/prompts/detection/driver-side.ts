/**
 * Angle-specific prompt: Driver Side
 * Phase 1 checklist for the full driver-side profile photo.
 */

import type { VehicleInfo } from "../../types";

export function buildDriverSideChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  return `DRIVER SIDE VIEW — Inspect the full driver-side profile of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Be specific about location (e.g., "driver rear door lower panel" not just "door"). Dirty or dusty surfaces are NOT defects — only flag actual damage, wear, or component issues. Dents show as light/shadow distortions on reflective surfaces; examine body line highlights carefully.

1. Driver doors — dents, scratches, dings, or creases on front and rear door panels; note which door and where on the door (upper, center, lower)
2. Door alignment and gaps — uneven spacing between doors, between doors and fenders, or between doors and quarter panel; inconsistent gaps suggest prior repair
3. Door handles — cracked, loose, discolored, or mismatched handles; check for scratches around the handle from key or ring contact
4. Driver mirror — glass cracked or delaminating, housing cracked or scraped, loose or wobbly mounting
5. Side windows — chips, cracks, or scratches in glass; tint film bubbling, peeling, or turning purple
6. Rocker panels — rust, dents, scrapes, or paint peeling along the panels beneath the doors; check the full length from front to rear wheel
7. Side body moldings and trim — missing pieces, faded or peeling trim, clips broken or popped out, aftermarket additions
8. Door edge guards — damaged, peeling, or missing; paint chips on door edges visible when looking at the profile
9. Body line alignment — check that character lines and crease lines flow evenly across panels; waviness or misalignment indicates filler or poor panel fit
10. B-pillar and C-pillar condition — rust, trim damage, or evidence of structural repair at the pillar bases`;
}
