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

  return `TIRE & WHEEL DETAIL (${positionLabel.toUpperCase()}) — ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}).

TREAD ANALYSIS — You MUST analyze the tread in three zones and provide a separate rating for each BEFORE giving an overall classification. This is required.

Your response MUST include a "treadAnalysis" object with per-zone ratings:

"treadAnalysis": {
  "innerEdge": { "rating": "GOOD|WORN|REPLACE", "grooveDepth": "deep|shallow|flush|bald", "notes": "what you see" },
  "center": { "rating": "GOOD|WORN|REPLACE", "grooveDepth": "deep|shallow|flush|bald", "notes": "what you see" },
  "outerEdge": { "rating": "GOOD|WORN|REPLACE", "grooveDepth": "deep|shallow|flush|bald", "notes": "what you see" },
  "overall": "GOOD|WORN|REPLACE"
}

HOW TO EXAMINE EACH ZONE:
- INNER EDGE (ribs closest to the vehicle body): Are the innermost grooves deep or worn smooth?
- CENTER (middle ribs of the tread face): COMPARE the center groove depth to the edge groove depth. On all-terrain and mud-terrain tires, the aggressive outer lugs can mask severe center wear — the edges look chunky while the center row is worn flat. If the center grooves are shallower than the edge grooves, the center is worn faster.
- OUTER EDGE (ribs farthest from vehicle): Are the outermost grooves deep or worn smooth?

GROOVE DEPTH GUIDE — measure by comparing groove depth to lug/block height:
- "deep": Grooves are deep channels — the bottom of the groove is far below the top of the tread block. Significant rubber remains. You could easily see the depth between blocks.
- "shallow": Grooves exist but the blocks have worn partway down. Less than half the original depth remains. The surface is starting to flatten.
- "flush": The tread blocks have worn down nearly level with the groove bottoms. The surface appears almost flat or smooth in this zone. The transition from block to groove is minimal. Wear indicators/bars may be level with the tread.
- "bald": The surface is flat smooth rubber. No groove structure remains. No distinction between tread blocks and grooves.

KEY TEST: Compare the center groove depth to the outer edge groove depth.
- If center grooves are LESS THAN HALF the depth of the edge grooves → center is "flush" → REPLACE.
- If the center tread blocks appear almost level with the groove floor while edges still have deep channels → center is "flush" → REPLACE.
- On all-terrain tires: if the aggressive outer lugs stand tall but the center row has been ground flat from highway use, that center is "flush" even though the edges look fine. This is the #1 missed defect on AT tires.

CLASSIFICATION RULES:
- The OVERALL rating equals the WORST zone rating. If center is REPLACE but edges are GOOD, overall = REPLACE.
- GOOD: All three zones have deep grooves (7+/32")
- WORN: Any zone has shallow grooves (3-6/32") but none are flush/bald
- REPLACE: Any zone has flush or bald grooves (<3/32"), OR wear bars are visible, OR any bald patches exist

ALSO CHECK:
1. Uneven wear pattern — center wear = overinflation, edge wear = alignment/underinflation, cupping = suspension
2. Sidewall cracks or dry rot (surface cracking from age/UV)
3. Tire bulges (SAFETY HAZARD)
4. Sidewall scuffs from curb contact
5. Wheel curb rash, scratches, corrosion
6. Bent or cracked rim
7. Missing lug nuts
8. Tire brand, model, size (read from sidewall if visible)
9. DOT date code (tires over 6 years old are a concern regardless of tread)

When uncertain between WORN and REPLACE, choose REPLACE — a dealer can verify on the lot.`;
}
