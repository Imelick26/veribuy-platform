/**
 * Angle-specific prompt: Tire Detail
 * Phase 1 checklist for individual tire/wheel photos.
 *
 * Forces per-zone tread analysis (inner/center/outer) so the model
 * can't make a holistic "looks fine" judgment. Works for any tire type.
 */

import type { VehicleInfo } from "../../types";

export function buildTireDetailChecklist(
  vehicle: VehicleInfo,
  mileageStr: string,
  position: string,
): string {
  const positionLabel = position.replace("-", " ");

  return `TIRE & WHEEL DETAIL (${positionLabel.toUpperCase()}) — ${vehicle.year} ${vehicle.make} ${vehicle.model} (${mileageStr}).

TREAD ANALYSIS — You MUST analyze the tread in three zones and provide a separate rating for each BEFORE giving an overall classification.

Your response MUST include a "treadAnalysis" object with per-zone ratings:

"treadAnalysis": {
  "innerEdge": { "rating": "GOOD|WORN|REPLACE", "grooveDepth": "deep|shallow|flush|bald", "notes": "what you see" },
  "center": { "rating": "GOOD|WORN|REPLACE", "grooveDepth": "deep|shallow|flush|bald", "notes": "what you see" },
  "outerEdge": { "rating": "GOOD|WORN|REPLACE", "grooveDepth": "deep|shallow|flush|bald", "notes": "what you see" },
  "overall": "GOOD|WORN|REPLACE"
}

HOW TO EXAMINE EACH ZONE:
- INNER EDGE (ribs closest to the vehicle body): Are the innermost grooves deep or worn smooth?
- CENTER (middle ribs of the tread face): COMPARE the center groove depth to the edge groove depth. If the center grooves are shallower than the edges, the center is wearing faster.
- OUTER EDGE (ribs farthest from vehicle): Are the outermost grooves deep or worn smooth?

GROOVE DEPTH — compare groove depth to tread block height:
- "deep": Grooves are deep channels. The bottom is far below the block tops. Significant rubber remains.
- "shallow": Grooves exist but blocks have worn partway down. Less than half the original depth remains.
- "flush": Blocks have worn nearly level with the groove floor. Surface appears almost flat or smooth. Minimal transition from block to groove. Wear bars may be level with tread.
- "bald": Flat smooth rubber. No groove structure. No block-to-groove distinction.

KEY TEST — compare zones against each other:
- If ANY zone's grooves are less than HALF the depth of another zone's grooves, the shallower zone is "flush" → REPLACE.
- If ANY zone's surface appears flat or smooth while another zone still has deep channels, the flat zone is "flush" → REPLACE.
- This applies regardless of tire type — all-terrain, highway, performance, winter, or any other tread pattern.

CLASSIFICATION RULES:
- The OVERALL rating equals the WORST zone. If one zone is REPLACE but the others are GOOD, overall = REPLACE.
- GOOD: All three zones have deep grooves (7+/32")
- WORN: Any zone has shallow grooves (3-6/32") but none are flush/bald
- REPLACE: Any zone is flush or bald (<3/32"), OR wear bars are visible, OR any bald patches exist

ALSO CHECK:
1. Uneven wear pattern — center wear = overinflation, inner edge = alignment, outer edge = underinflation, cupping = suspension
2. Sidewall cracks or dry rot
3. Tire bulges (SAFETY HAZARD)
4. Sidewall scuffs from curb contact
5. Wheel curb rash, scratches, corrosion
6. Bent or cracked rim
7. Missing lug nuts
8. Tire brand, model, size (read from sidewall if visible)
9. DOT date code (tires over 6 years old are a concern regardless of tread)

When uncertain between WORN and REPLACE, choose REPLACE — a dealer can verify on the lot.`;
}
