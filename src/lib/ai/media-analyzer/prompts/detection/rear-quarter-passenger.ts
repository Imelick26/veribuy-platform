/**
 * Angle-specific prompt: Rear Quarter Passenger
 * Phase 1 checklist for the rear-right (passenger side) three-quarter photo.
 */

import type { VehicleInfo } from "../../types";

export function buildRearQuarterPassengerChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
): string {
  return `REAR QUARTER PASSENGER VIEW — Inspect the rear-right three-quarter angle of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Be specific about location (e.g., "passenger-side quarter panel below the taillight" not just "quarter panel"). Dirty or dusty surfaces are NOT defects — only flag actual damage, wear, or component issues. Dents show as light/shadow distortions on reflective surfaces; examine panel highlights carefully.

1. Passenger-side rear quarter panel — dents, scratches, creases, or rust bubbles; quarter panels are welded (not bolted), so damage here is expensive to repair
2. Quarter panel paint condition — oxidation, clear coat failure, color mismatch versus the rear door or bumper indicating respray
3. Rear-right wheel — curb rash on the rim lip, scratches, corrosion or pitting on the wheel face, bent or warped rim edge
4. Rear-right tire — visible tread depth, sidewall bulges or cuts, uneven wear pattern (inside vs outside edge)
5. Rear-right wheel well — rust along the arch lip, torn or missing fender liner, road debris packed behind the liner
6. Taillight passenger-side edge — cracks, chips, moisture inside the lens, faded or discolored housing
7. Fuel door area — if on this side, check for dents around the filler door, hinge damage, cap missing or ill-fitting, paint overspray inside the filler pocket (respray indicator)
8. Rear bumper passenger-side corner — scrapes, cracks, or scuffs from parking contact
9. Quarter panel seam along the door edge — rust, filler, or uneven gaps between the rear door and the quarter panel
10. Rear window and C-pillar trim — seal separation, trim damage, or rust at the pillar base visible from this angle`;
}
