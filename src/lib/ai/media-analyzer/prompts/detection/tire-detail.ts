/**
 * Angle-specific prompt: Tire Detail
 * Phase 1 checklist for individual tire/wheel photos.
 */

import type { VehicleInfo } from "../../types";

export function buildTireDetailChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
  position: string,
): string {
  const positionLabel = position.replace("-", " "); // "front-left" -> "front left"

  return `TIRE & WHEEL DETAIL (${positionLabel.toUpperCase()}) — Inspect the ${positionLabel} tire and wheel of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}). Check every item below carefully.

TREAD:
1. Tread depth assessment — GOOD: 7+/32" with deep, well-defined grooves; WORN: 3-6/32" with shallow grooves; REPLACE: <3/32" where wear bars are flush with tread surface
2. Wear pattern — even wear is normal; inside edge wear = alignment issue; outside edge wear = aggressive cornering; center wear = overinflation; cupping/scalloping = suspension issue
3. Bald spots — localized areas with no tread remaining

SIDEWALL:
4. Sidewall cracks — surface cracking from age or UV exposure (dry rot precursor)
5. Dry rot — deep cracking pattern in sidewall rubber indicating age deterioration
6. Tire bulges — outward swelling on sidewall indicating internal structural damage (SAFETY HAZARD)
7. Sidewall scuffs from curb contact — rubber scraping or gouging on the lower sidewall

WHEEL:
8. Wheel curb rash — scrapes, scratches, or grinding marks on the rim lip or edge from curb contact
9. Wheel scratches or gouges — damage beyond surface scuffs on the wheel face
10. Bent rim — distortion or wobble visible in the rim edge (impacts ride quality)
11. Cracked rim — visible fractures in the wheel (SAFETY HAZARD)
12. Wheel finish corrosion — pitting, peeling clear coat, or white oxidation on the wheel surface
13. Missing lug nuts — count visible lug nuts vs expected for this vehicle

TIRE INFO (read from sidewall if visible):
14. Tire brand and model name
15. Tire size (e.g., 275/65R18)
16. DOT date code if visible (last 4 digits = week and year of manufacture, e.g., 2321 = week 23 of 2021)`;
}
