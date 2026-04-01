/**
 * Angle-specific prompt: Tire Detail
 * Phase 1 checklist for individual tire/wheel photos.
 *
 * Tread condition is the PRIMARY focus — the prompt explicitly tells
 * the AI to examine three zones (inner, center, outer) independently.
 */

import type { VehicleInfo } from "../../types";

export function buildTireDetailChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
  position: string,
): string {
  const positionLabel = position.replace("-", " ");

  return `TIRE & WHEEL DETAIL (${positionLabel.toUpperCase()}) — Inspect the ${positionLabel} tire and wheel of this ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}).

THIS IS CRITICAL — tread condition directly affects safety and recon cost. Examine the tread surface in THREE separate zones and report each independently.

TREAD — EXAMINE THREE ZONES SEPARATELY:
1. INNER EDGE tread (closest to vehicle): Look at the innermost ribs/grooves. Is tread still present? Are grooves deep or worn smooth? Inner edge wear indicates alignment problems.
2. CENTER tread (middle of the tire face): Look at the center ribs specifically. Is the center worn smooth or bald while the edges still have tread? Center baldness = chronic overinflation. This is easy to miss — look carefully at whether the CENTER grooves are as deep as the edge grooves.
3. OUTER EDGE tread (farthest from vehicle): Look at the outermost ribs. Outer edge wear indicates underinflation or aggressive cornering.

TREAD DEPTH CLASSIFICATION (apply per zone, then overall):
- GOOD: 7+/32" — deep, well-defined grooves with visible depth
- WORN: 3-6/32" — grooves visible but shallow, wear bars starting to appear
- REPLACE: <3/32" — tread is flush with wear bars, grooves are gone, rubber is smooth, or bald patches visible. ANY bald zone = REPLACE regardless of other zones.

4. Bald spots or patches — ANY area where tread is completely gone, rubber is smooth, or you can see wear bars flush with the surface. A tire bald in the center but with tread on edges is STILL a REPLACE tire.
5. Cupping or scalloping — wavy, uneven wear pattern across the tread face (suspension issue)

SIDEWALL:
6. Sidewall cracks — surface cracking from age or UV (dry rot precursor)
7. Dry rot — deep, connected cracking pattern indicating rubber deterioration
8. Tire bulges — outward swelling indicating internal damage (SAFETY HAZARD — REPLACE immediately)
9. Sidewall scuffs or gouges from curb contact

WHEEL:
10. Curb rash — scrapes on rim lip from curb contact
11. Wheel scratches, gouges, or corrosion on wheel face
12. Bent or cracked rim (check edge for waviness or fractures)
13. Missing lug nuts

TIRE INFO (read from sidewall if visible):
14. Tire brand and model
15. Tire size (e.g., 275/65R18)
16. DOT date code (last 4 digits = week + year, e.g., 2321 = week 23 of 2021; tires over 6 years old are a concern regardless of tread)

IMPORTANT: If the center of the tread is noticeably smoother or more worn than the edges, this tire needs replacement even if the edges look fine. Report it clearly.`;
}
