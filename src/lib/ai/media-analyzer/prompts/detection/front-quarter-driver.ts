/**
 * Angle-specific prompt: Front Quarter Driver
 * Phase 1 checklist for the front-left (driver side) three-quarter photo.
 */

import type { VehicleInfo } from "../../types";

export function buildFrontQuarterDriverChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  return `FRONT QUARTER DRIVER VIEW — Inspect the front-left three-quarter angle of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Be specific about location (e.g., "driver fender behind the wheel arch" not just "fender"). Dirty or dusty surfaces are NOT defects — only flag actual damage, wear, or component issues. Dents show as light/shadow distortions on reflective surfaces; examine panel highlights carefully.

1. Driver fender — dents, scratches, paint chips, or rust bubbles; check the area around the wheel arch lip closely
2. Front-left body panels — dings, creases, or scuffs on any visible panel from this angle; note paint color or texture differences between adjacent panels
3. Front-left wheel — curb rash on the rim lip, scratches, corrosion or pitting on the wheel face, bent or warped rim edge
4. Front-left tire — tread depth visible from this angle, sidewall bulges or cuts, uneven wear pattern (inside vs outside edge)
5. Front-left wheel well — rust along the arch lip, torn or missing fender liner, debris buildup indicating neglect
6. Headlight driver-side edge and corner — cracks, chips, or seal separation where the lens meets the fender
7. Paint condition on visible panels — oxidation, clear coat peeling, sun fade, or evidence of respray (orange peel, overspray on trim or seals)
8. Brake rotor visible through wheel spokes — deep grooves, heavy rust scoring, or lip buildup on the rotor edge
9. Driver-side bumper corner — scrapes, cracks, or plastic deformation from parking impacts
10. A-pillar and windshield edge — trim damage, rust at the base of the pillar, or windshield seal separation`;
}
